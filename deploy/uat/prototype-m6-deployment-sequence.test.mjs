import test from 'node:test';
import assert from 'node:assert/strict';
import {executeOneShotM6,verifyM6ExecutionAuthority,M6_ORDER} from './prototype-m6-deployment-sequence.mjs';
const src='9fa0506e9a50fd556f1c4404e4db2e3d88093b85';
const rel='d9a1613f96cc164824a077528d6f8374ac6361c0';
const inputs=()=>({sourceSha:src,releaseSha:rel,isolatedSynthetic:true,productionConnected:false,exactMainReleased:true,
 independentlyReviewed:true,requiredReleaseProofSatisfied:true,priorUomReceiptVerified:true,
 originalMacCustodyVerified:true,noActiveSessions:true,authorizedForOneShot:true,noPriorM6Attempt:true});
function fake(){const seen=[],adapter={claim:async()=>{seen.push('claim');return {claimed:true,releaseSha:rel,newlyCreated:true};},
 readOnlyPreflight:async()=>({sourceSha:src,releaseSha:rel,historicalReceiptsPreserved:true,snapshotDigestMatched:true,runtimeOwned:true}),
 recordPhase:async(name)=>seen.push('record:'+name)};
 for(const name of M6_ORDER)adapter[name]=async()=>{seen.push(name);return {ok:true,releaseSha:rel};};
 return {seen,adapter};}
test('denies premature, unauthorized, production and reused execution before claiming',async()=>{
 for(const [key,value] of [['exactMainReleased',false],['independentlyReviewed',false],['requiredReleaseProofSatisfied',false],
  ['productionConnected',true],['noPriorM6Attempt',false],['authorizedForOneShot',false],
  ['priorUomReceiptVerified',false],['noActiveSessions',false]]){
  const f=fake();await assert.rejects(executeOneShotM6({inputs:{...inputs(),[key]:value},adapter:f.adapter}),
   /M6_RELEASE_OR_CUSTODY_GATE_UNSATISFIED/);assert.deepEqual(f.seen,[]);
 }
});
test('read-only preflight blocks before create-once claim',async()=>{
 const f=fake();f.adapter.readOnlyPreflight=async()=>({sourceSha:src,releaseSha:rel,
   snapshotDigestMatched:false,runtimeOwned:true,historicalReceiptsPreserved:true});
 await assert.rejects(executeOneShotM6({inputs:inputs(),adapter:f.adapter}),
  /M6_READ_ONLY_PREFLIGHT_UNSATISFIED/);assert.deepEqual(f.seen,[]);
});
test('strict one-shot ordering and no false UAT or go-live claim',async()=>{
 const f=fake(),result=await executeOneShotM6({inputs:inputs(),adapter:f.adapter});
 assert.deepEqual(f.seen,['claim',...M6_ORDER.flatMap(k=>k==='seal'?[k]:[k,'record:'+k])]);
 assert.equal(result.milestone6Accepted,false);assert.equal(result.productionAuthorized,false);
 assert.equal(result.automaticRetryAllowed,false);
});
test('failure keeps claim, stops without later-stage execution',async()=>{
 const f=fake();f.adapter.hr=async()=>{f.seen.push('hr:failed');throw new Error('test denied');};
 await assert.rejects(executeOneShotM6({inputs:inputs(),adapter:f.adapter}),
  /M6_STOP_PRESERVE_STAGE_NO_AUTOMATIC_RETRY/);
 assert.deepEqual(f.seen,['claim','upgrade','record:upgrade','configure',
  'record:configure','finance','record:finance','hr:failed']);
});
test('invalid release or missing adapter does not proceed',async()=>{
 assert.throws(()=>verifyM6ExecutionAuthority({...inputs(),releaseSha:'bad'}),
  /M6_RELEASE_OR_CUSTODY_GATE_UNSATISFIED/);
 await assert.rejects(executeOneShotM6({inputs:inputs(),adapter:{}}),
  /M6_OPERATOR_ADAPTER_INCOMPLETE/);
});
test('ambiguous claim cannot mutate anything',async()=>{
 const f=fake();f.adapter.claim=async()=>{f.seen.push('claim');return {claimed:false,releaseSha:rel};};
 await assert.rejects(executeOneShotM6({inputs:inputs(),adapter:f.adapter}),
  /M6_CREATE_ONCE_CLAIM_NOT_PROVEN/);assert.deepEqual(f.seen,['claim']);
});
