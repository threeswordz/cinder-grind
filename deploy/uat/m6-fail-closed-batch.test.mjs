import test from 'node:test';
import assert from 'node:assert/strict';
import {batchStages,runM6Batch} from './m6-fail-closed-batch.mjs';
const sourceSha='a'.repeat(40);
test('one exact source and four unique bounded steps',()=>{
 const stages=batchStages(sourceSha);
 assert.deepEqual(stages.map(s=>s.id),['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY','AUTHENTICATED_CD']);
 assert.equal(stages[0].args[0],'--test');
 assert.equal(stages[0].args.length,5);
 assert.deepEqual(stages[1].args.slice(-2),['--inspect-rate-history',sourceSha]);
 assert.deepEqual(stages[2].args.slice(-2),['--inspect-retained-site',sourceSha]);
 assert.deepEqual(stages[3].args.slice(-2),['--authorize-four-synthetic-sessions',sourceSha]);
 assert.throws(()=>batchStages('not-a-sha'),/PIN_REQUIRED/);
});
test('inspect-only never opens authenticated sessions',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,execute:async (id,args)=>{calls.push([id,args]);return {exitCode:0};}});
 assert.equal(v.status,'M6_BATCH_READ_ONLY_PASS');
 assert.deepEqual(calls.map(a=>a[0]),['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY']);
 assert.equal(v.sessionsStarted,false);assert.equal(v.milestone6Accepted,false);
});
test('fixture blocker stops all native observations and sessions',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);return {exitCode:1};}});
 assert.equal(v.status,'M6_BATCH_FIXTURE_BLOCKED');assert.deepEqual(calls,['CHANGED_FIXTURES']);
 assert.equal(v.readOnlyComplete,false);assert.equal(v.sessionsStarted,false);
});
test('rate blocker still runs independent site observation once but bars login',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);return {exitCode:id==='RATE_HISTORY'?1:0};}});
 assert.equal(v.status,'M6_BATCH_READ_ONLY_BLOCKED');
 assert.deepEqual(calls,['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY']);
 assert.equal(v.sessionsStarted,false);assert.equal(v.stages[2].status,'PASS');
});
test('site blocker bars login, preserves rate outcome',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);return {exitCode:id==='SITE_HISTORY'?1:0};}});
 assert.equal(v.status,'M6_BATCH_READ_ONLY_BLOCKED');
 assert.equal(v.stages[1].status,'PASS');assert.equal(v.stages[2].status,'BLOCKED');
 assert.deepEqual(calls,['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY']);
});
test('only one authenticated operation on explicit authorization and green read-only gates',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);return {exitCode:0};}});
 assert.equal(v.status,'M6_BATCH_AUTHENTICATED_CD_PASS');assert.equal(v.sessionsStarted,true);
 assert.deepEqual(calls,['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY','AUTHENTICATED_CD']);
 assert.equal(v.milestone6Accepted,false);assert.equal(v.productionAuthorized,false);
});
test('failed or thrown session operation cannot be retried automatically',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);if(id==='AUTHENTICATED_CD')throw Error('uncertain response');return {exitCode:0};}});
 assert.equal(v.status,'M6_BATCH_AUTHENTICATED_CD_BLOCKED');
 assert.equal(v.sessionsStarted,true);assert.equal(calls.filter(x=>x==='AUTHENTICATED_CD').length,1);
});
test('thrown first observation does not mask independent second observation',async()=>{
 const calls=[];const v=await runM6Batch({sourceSha,authorizeSessions:true,execute:async id=>{calls.push(id);if(id==='RATE_HISTORY')throw Error('private');return {exitCode:0};}});
 assert.equal(v.status,'M6_BATCH_READ_ONLY_BLOCKED');assert.equal(v.sessionsStarted,false);
 assert.deepEqual(calls,['CHANGED_FIXTURES','RATE_HISTORY','SITE_HISTORY']);
});
