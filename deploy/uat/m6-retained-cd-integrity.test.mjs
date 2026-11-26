import test from 'node:test';
import assert from 'node:assert/strict';
import {queries,population,aggregateResult,observeRetainedCD} from './m6-retained-cd-integrity.mjs';
const zeros=()=>Object.fromEntries(Object.keys(queries).map(k=>[k,0n]));
const populated=()=>Object.fromEntries(Object.keys(population).map(k=>[k,1n]));
test('all populated observations are bounded and not workflow acceptance',()=>{
 const result=aggregateResult(zeros(),populated());
 assert.equal(result.status,'M6_CD_RETAINED_INTEGRITY_OBSERVED');
 for(const k of ['authenticatedWorkflowVerified','historicalBaselineVerified','mayMutate','productionAuthorized'])assert.equal(result[k],false);
 assert.equal(result.population.hrAttachments,'1');
});
test('positive differences and absent population never report complete',()=>{
 assert.equal(aggregateResult({...zeros(),retentionCertificationMismatch:1n},populated()).status,'M6_CD_INTEGRITY_DIFFERENCES');
 assert.equal(aggregateResult(zeros(),{...populated(),hrAttachments:0n}).status,'M6_CD_INTEGRITY_EMPTY_COVERAGE');
});
test('invalid count and unexpected keys fail closed',()=>{
 for(const v of [{...zeros(),physicalClaimScopeMismatch:-1n},{...zeros(),physicalClaimScopeMismatch:'0'},{...zeros(),extra:0n},{}])
 assert.throws(()=>aggregateResult(v,populated()),/M6_CD_AGGREGATE_INVALID/);
});
function mock({db='proto_a_01',active=0n,malformed=false}={}){
 const statements=[];
 return {statements,$transaction:async (fn,options)=>{
  assert.equal(options.isolationLevel,'RepeatableRead');
  return fn({
   $executeRawUnsafe:async sql=>{assert.equal(sql,'SET TRANSACTION READ ONLY');statements.push(sql);},
   $queryRawUnsafe:async sql=>{
    statements.push(sql);
    if(sql.startsWith('SELECT current_database()'))return [{db,role:'proto_runtime',ro:'on',isolation:'repeatable read'}];
    if(sql.includes('FROM public.user_sessions'))return [{active,unrevoked:active+1n,expired:1n}];
    assert.ok(sql.startsWith('SELECT count(*) AS n FROM public.')||sql.startsWith('SELECT count(*) AS n FROM (SELECT'));
    if(Object.values(queries).includes(sql))return [{n:malformed?'0':0n}];
    assert.ok(Object.values(population).includes(sql));return [{n:1n}];
   }
  });
 }};
}
test('read-only transaction executes exact bounded probes after session admission',async()=>{
 const db=mock();const result=await observeRetainedCD(db);
 assert.equal(result.status,'M6_CD_RETAINED_INTEGRITY_OBSERVED');
 assert.equal(db.statements.length,3+Object.keys(queries).length+Object.keys(population).length);
 assert.equal(db.statements[0],'SET TRANSACTION READ ONLY');
});
test('wrong database or live session stops before any lane query',async()=>{
 for(const [config,code,count] of [[{db:'production'},/M6_CD_DB_IDENTITY_INVALID/,2],[{active:1n},/M6_NATIVE_ACTIVE_SESSIONS/,3]]){
  const db=mock(config);await assert.rejects(observeRetainedCD(db),code);assert.equal(db.statements.length,count);
 }
});
test('malformed query results stop and do not leak rows',async()=>{
 const db=mock({malformed:true});await assert.rejects(observeRetainedCD(db),/M6_CD_AGGREGATE_INVALID/);assert.equal(db.statements.length,4);
});
