import test from 'node:test';
import assert from 'node:assert/strict';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
function tx(rows){return {async $queryRawUnsafe(sql){
  assert.match(sql,/^SELECT\s/);
  assert.match(sql,/revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP/);
  assert.match(sql,/revoked_at IS NULL AND expires_at <= CURRENT_TIMESTAMP/);
  assert.match(sql,/FROM public\.user_sessions$/);
  return rows;
}};}
test('zero unrevoked sessions admitted',async()=>assert.equal(await requireNoLiveSessions(tx([{unrevoked:0n,active:0n,expired:0n}])),true));
test('actual observed expired-only count admitted without mutation',async()=>assert.equal(await requireNoLiveSessions(tx([{unrevoked:1n,active:0n,expired:1n}])),true));
test('one live session blocks read-only admission',async()=>assert.rejects(requireNoLiveSessions(tx([{unrevoked:2n,active:1n,expired:1n}])),{safeCode:'M6_NATIVE_ACTIVE_SESSIONS'}));
for(const rows of [[],[null],[{unrevoked:1n,active:0n,expired:0n}],[{unrevoked:-1n,active:0n,expired:-1n}],[{unrevoked:1,active:0,expired:1}],[{unrevoked:0n,active:0n,expired:0n},{unrevoked:0n,active:0n,expired:0n}]])
  test('invalid count response fails closed',async()=>assert.rejects(requireNoLiveSessions(tx(rows)),{safeCode:'M6_SESSION_COUNTS_INVALID'}));
