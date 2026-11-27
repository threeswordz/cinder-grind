import test from 'node:test';
import assert from 'node:assert/strict';
import {acceptCorrection} from './ss16-correction-acceptance.mjs';
const id='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222';
const maker={userId:'maker'},reviewer={userId:'pm'};
function fixture(kind='MATERIAL_ISSUE',blockedCode,override={}){
 const seen=[],registered=[], row={id:rid,sourceId:id,sourceKind:kind,approvalInstance:{approvalState:'SUBMITTED',actions:[]}};
 const pending={data:row},approved={data:{...row,approvalInstance:{approvalState:'APPROVED'}}};
 const actions=[{action:'APPROVE',actionByUserId:'pm',comment:'Independent acceptance decision'}];
 const responses={LEGACY_DENIED:{code:'SS16_CORRECTION_APPROVAL_REQUIRED'},CORRECTION_REQUEST:pending,CORRECTION_REPLAY:pending,
 CORRECTION_SELF_DENIED:{code:'DENIED'},CORRECTION_DECISION:blockedCode?{code:blockedCode}:approved,
 CORRECTION_PENDING_HISTORY:{data:[row]},CORRECTION_REJECT:{data:{...row,approvalInstance:{approvalState:'REJECTED'}}},
 CORRECTION_DECISION_REPLAY_DENIED:{code:'SS16_DECISION_ALREADY_RECORDED'},
 CORRECTION_HISTORY:{data:[{...row,approvalInstance:{approvalState:'APPROVED',actions}}]},
 CORRECTION_SOURCE_READ:{data:{id,reversedAt:blockedCode?null:'now',reversalKey:blockedCode?null:'ss16:'+rid}},...override};
 const call=async(actor,label,path,expected,body)=>{seen.push({actor,label,path,expected,body});assert.ok(Object.hasOwn(responses,label));return responses[label];};
 return {seen,registered,args:{call,maker,reviewer,kind,id,key:'exact-key',reason:'Synthetic reason',blockedCode,verifyLegacy:true,registerDecision:(...x)=>registered.push(x)}};
}
for(const kind of ['GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER'])test('canonical independent path '+kind,async()=>{
 const f=fixture(kind);await acceptCorrection(f.args);
 assert.equal(f.seen.filter(s=>s.label==='CORRECTION_DECISION').length,1);
 assert.equal(f.seen.find(s=>s.label==='CORRECTION_DECISION').actor,reviewer);
 assert.equal(f.seen.find(s=>s.label==='CORRECTION_SELF_DENIED').actor,maker);
 assert.deepEqual(f.seen[1].body,f.seen[2].body);
 assert.equal(f.seen.filter(s=>s.path.endsWith('/reverse')&&s.expected===201).length,0);
 assert.equal(f.registered[0][0],'/inventory/movement-corrections/'+rid+'/approve');
});
test('canonical restriction exact reason and rollback followed by rejection',async()=>{
 const f=fixture('MATERIAL_ISSUE','MATERIAL_ISSUE_HAS_OUTSTANDING_RETURN');await acceptCorrection(f.args);
 assert.equal(f.seen.find(s=>s.label==='CORRECTION_REJECT').actor,reviewer);
 assert.equal(f.seen.find(s=>s.label==='CORRECTION_DECISION').expected,409);
});
test('generic 409 cannot substitute for canonical dependency denial',async()=>{
 const f=fixture('GOODS_RECEIPT','RECEIPT_REVERSAL_FINANCE_SOURCE_LOCKED',{CORRECTION_DECISION:{code:'SS16_CORRECTION_APPROVAL_REQUIRED'}});
 await assert.rejects(acceptCorrection(f.args),/CANONICAL_BLOCK/);
});
test('wrong request source fails before any decision',async()=>{
 const f=fixture('MATERIAL_ISSUE',undefined,{CORRECTION_REQUEST:{data:{id:rid,sourceId:rid,sourceKind:'MATERIAL_ISSUE',approvalInstance:{approvalState:'SUBMITTED'}}}});
 await assert.rejects(acceptCorrection(f.args),/SOURCE/);assert.equal(f.registered.length,0);
});
test('wrong replay id and missing stock outcome both fail closed',async()=>{
 const f=fixture('MATERIAL_ISSUE',undefined,{CORRECTION_REPLAY:{data:{id}}});await assert.rejects(acceptCorrection(f.args),/REPLAY/);
 const g=fixture('MATERIAL_ISSUE',undefined,{CORRECTION_SOURCE_READ:{data:{id,reversedAt:null}}});await assert.rejects(acceptCorrection(g.args),/OUTCOME/);
});
test('completed history cannot be silently absent',async()=>{
 const f=fixture('MATERIAL_ISSUE',undefined,{CORRECTION_HISTORY:{data:[]}});await assert.rejects(acceptCorrection(f.args),/HISTORY/);
});
