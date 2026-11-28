import test from 'node:test';
import assert from 'node:assert/strict';
import { createRestoreSequence } from './m7-restore-sequence.mjs';
const plan = { sha: 'a'.repeat(40), tree: 'b'.repeat(40), database: 'm7_restore_abcdef012345', role: 'm7_restore_role_abcdef012345', port: 33072, storage: { documents: '/target/documents', uploads: '/target/uploads', hrkeys: '/target/hrkeys' } };
const sourceDatabase = { cluster: '123', oid: 1, database: 'proto_a_01', role: 'proto_runtime' };
const capture = { sha: plan.sha, tree: plan.tree, dumpSha: 'c'.repeat(64), schemaSha: 'd'.repeat(64), rowsSha: 'e'.repeat(64), documentsSha: 'f'.repeat(64), uploadsSha: '1'.repeat(64), hrkeysSha: '2'.repeat(64), sourceDatabase, sourceProcess: { pid: 111 } };
function fixture(patch = {}) {
  const calls = []; const record = (k, result) => async () => { calls.push(k); return result; };
  const proc = { pid: 222, born: 'start', uid: process.getuid(), entry: '/pinned/main.js' };
  const db = { cluster: '123', oid: 2, database: plan.database, role: plan.role, owner: plan.role, roleIsolated: true, canConnectSource: false, privileged: false, otherSessions: 0, emptyAtDatabaseScope: true };
  const adapter = { inspectCaptureAndSource: record('source', capture), inspectTargetAbsence: record('absence', { databaseAbsent: true, roleAbsent: true, portFree: true, storageEmpty: true }), provisionFreshTarget: record('provision'), inspectDatabase: record('db', db), restoreDatabase: record('restore'), restoreStorageNoOverwrite: record('storage'), inspectRestoredContent: record('content', capture), isPortFree: record('port', true), launchPinnedApi: record('launch', proc), inspectApi: record('api', { ...proc, sha: plan.sha, tree: plan.tree, database: plan.database, role: plan.role, storage: plan.storage, listenerPids: [222], listenAddresses: ['127.0.0.1:33072'], health: 'ok' }), ...patch };
  return { calls, run: createRestoreSequence({ plan, verifyPaths: record('paths') }, capture, adapter), db };
}
test('mocked sequence verifies content before launching API and never accepts milestone', async () => {
  const f = fixture(); const r = await f.run(); assert.equal(r.milestoneAccepted, false); assert.equal(r.authenticatedVerification, false); assert.equal(r.productionAuthorized, false); assert.ok(f.calls.indexOf('content') < f.calls.indexOf('launch')); await assert.rejects(f.run(), /ALREADY_ATTEMPTED/);
});
test('existing database, role, occupied port or nonempty storage refuses before provision', async () => {
  for (const key of ['databaseAbsent', 'roleAbsent', 'portFree', 'storageEmpty']) { const f = fixture({ inspectTargetAbsence: async () => ({ databaseAbsent: true, roleAbsent: true, portFree: true, storageEmpty: true, [key]: false }) }); await assert.rejects(f.run(), /PRIOR_TARGET/); assert.ok(!f.calls.includes('provision')); await assert.rejects(f.run(), /ALREADY_ATTEMPTED/); }
});
test('capture drift prevents provisioning and restore', async () => {
  const f = fixture({ inspectCaptureAndSource: async () => ({ ...capture, dumpSha: '0'.repeat(64) }) }); await assert.rejects(f.run(), /SOURCE_DRIFT/); assert.ok(!f.calls.includes('provision'));
});
test('database identity changes after provisioning prevent restore', async () => {
  const { db } = fixture(); let count = 0; const f = fixture({ inspectDatabase: async () => ({ ...db, oid: ++count === 1 ? 2 : 3 }) }); await assert.rejects(f.run(), /TARGET_DRIFT/); assert.ok(!f.calls.includes('restore'));
});
test('schema, row or any storage digest drift prevents API launch', async () => {
  for (const k of ['schemaSha', 'rowsSha', 'documentsSha', 'uploadsSha', 'hrkeysSha']) { const f = fixture({ inspectRestoredContent: async () => ({ ...capture, [k]: '0'.repeat(64) }) }); await assert.rejects(f.run(), /RESTORED_CONTENT/); assert.ok(!f.calls.includes('launch')); }
});
test('port race prevents launch; failed restore cannot be retried or continue to storage', async () => {
  const p = fixture({ isPortFree: async () => false }); await assert.rejects(p.run(), /PORT_OCCUPIED/); assert.ok(!p.calls.includes('launch'));
  const f = fixture({ restoreDatabase: async () => { throw Error('restore failed'); } }); await assert.rejects(f.run(), /restore failed/); assert.ok(!f.calls.includes('storage')); await assert.rejects(f.run(), /ALREADY_ATTEMPTED/);
});
