import test from 'node:test';
import assert from 'node:assert/strict';
import {queries,observeLane} from './m6-lane-b-observe.mjs';
function fixture({bad=false,active=0n,malformed=false}={}){
  const calls=[];
  return {calls,$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'RepeatableRead');return fn({$executeRawUnsafe:async sql=>{assert.equal(sql,'SET TRANSACTION READ ONLY');calls.push(sql);},$queryRawUnsafe:async sql=>{calls.push(sql);if(sql.includes('current_database'))return [{db:bad?'wrong':'proto_a_01',role:'proto_runtime',ro:'on',isolation:'repeatable read'}];if(sql.includes('FROM public.user_sessions'))return [{unrevoked:active,active,expired:0n}];assert.ok(Object.values(queries).includes(sql));return [{n:malformed?-1n:2n}];}});}};
}
test('only bounded aggregate counts returned; no workflow or mutation claim',async()=>{const db=fixture(),r=await observeLane(db);assert.deepEqual(r,{lane:'B',observations:Object.fromEntries(Object.keys(queries).map(k=>[k,'2'])),workflowVerified:false,mayMutate:false});assert.equal(db.calls.length,3+Object.keys(queries).length);});
test('wrong database rejected before lane queries',async()=>{const db=fixture({bad:true});await assert.rejects(observeLane(db),{safeCode:'M6_LANE_DB_IDENTITY_INVALID'});assert.equal(db.calls.length,2);});
test('active session blocks native observation',async()=>{const db=fixture({active:1n});await assert.rejects(observeLane(db),{safeCode:'M6_NATIVE_ACTIVE_SESSIONS'});assert.equal(db.calls.length,3);});
test('invalid count refused and query set is aggregate-only',async()=>{assert.ok(Object.values(queries).every(q=>/^SELECT count\(\*\) AS n FROM /.test(q)));await assert.rejects(observeLane(fixture({malformed:true})),{safeCode:'M6_LANE_COUNT_INVALID'});});

test('receipt comparisons use document alias, not schema-qualified column reference',()=>{
  assert.match(queries.receivingEvidenceBindingDifferences,/e\.checksum IS DISTINCT FROM d\.checksum$/);
  assert.match(queries.transferReceiptBindingDifferences,/r\.checksum IS DISTINCT FROM d\.checksum\)\)$/);
  assert.ok(Object.values(queries).every(sql=>!/\bpublic\.[a-z]+\.[a-z_]+\b/.test(sql)));
});
