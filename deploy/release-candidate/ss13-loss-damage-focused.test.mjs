import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {
 LOSS_CASE_ENTITY,LOSS_OPEN,LOSS_SCREEN,LOSS_BEN,LOSS_NANCY,
 lossCasePayload,lossDocumentDigest,replayLossCase,caseMaterialQuantity,
} from '../../apps/api/src/inventory/stock-loss-case-contract.ts';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const caseId=id(99),docs=[id(21),id(22)];
const payload=()=>({
 projectId:id(1),warehouseId:id(2),materialId:id(3),uomId:id(4),
 kind:'DAMAGE',quantity:'3.5000',occurredOn:'2026-11-22',
 finderName:'Site employee',place:'Site warehouse storage area',
 cause:'Water seepage discovered during goods inspection',
 proposedDisposition:'DISPOSAL',evidenceDocumentIds:docs,
});
const metadata=()=>docs.map((item,i)=>({
 id:item,checksum:(i?'b':'a').repeat(64),
 uploadedAt:'2026-11-22T00:00:00.000Z',fileSizeBytes:100+i,
 linkIds:[id(30+i)],
}));
const fingerprint=lossDocumentDigest(metadata());
const root=()=>({
 id:id(10),action:LOSS_OPEN,actorUserId:id(11),occurredAt:new Date('2026-11-22T08:00:00.000Z'),
 newValues:{...payload(),evidenceFingerprint:fingerprint,reportedByUserId:id(11),
  previousEventId:null,version:1,effect:'NONE_OPERATIONAL_PROPOSAL'},
});
const screen=(decision='FORWARD_DISPOSAL',escalateToBen=true)=>({
 id:id(12),action:LOSS_SCREEN,actorUserId:id(13),
 occurredAt:new Date('2026-11-22T08:01:00.000Z'),
 newValues:{previousEventId:id(10),version:2,decision,escalateToBen,
  note:'Property damage severity assessed independently'},
});
const ben=()=>({id:id(14),action:LOSS_BEN,actorUserId:id(15),
 occurredAt:new Date('2026-11-22T08:02:00.000Z'),
 newValues:{previousEventId:id(12),version:3,note:'Acknowledged serious site property exposure'},
});
const nancy=(withBen=true)=>({id:id(16),action:LOSS_NANCY,actorUserId:id(17),
 occurredAt:new Date('2026-11-22T08:03:00.000Z'),
 newValues:{previousEventId:withBen?id(14):id(12),version:withBen?4:3,
 decision:'APPROVE_PROPOSAL',note:'Proposal approved; accounting posting separate',
 stockDisposalExecuted:false,financeWriteOffPosted:false},
});
test('SS13 strict physical facts with no invented monetary value or stock effect',()=>{
 assert.equal(caseMaterialQuantity('0'),false);
 assert.equal(caseMaterialQuantity('1.2500'),true);
 assert.equal(lossCasePayload(payload()).kind,'DAMAGE');
 assert.equal(lossCasePayload(payload()).proposedDisposition,'DISPOSAL');
 assert.throws(()=>lossCasePayload({...payload(),quantity:0}),RangeError);
 assert.throws(()=>lossCasePayload({...payload(),occurredOn:'2026-02-30'}),RangeError);
 assert.throws(()=>lossCasePayload({...payload(),kind:['DAMAGE']}),RangeError);
 assert.throws(()=>lossCasePayload({...payload(),proposedDisposition:['DISPOSAL']}),RangeError);
 assert.throws(()=>lossCasePayload({...payload(),money:'1000'}),RangeError);
 assert.throws(()=>lossCasePayload({...payload(),evidenceDocumentIds:[]}),RangeError);
});
test('SS13 source digest pins exact Document metadata and links',()=>{
 assert.equal(lossDocumentDigest([...metadata()].reverse()),fingerprint);
 assert.notEqual(lossDocumentDigest(metadata().map((d,i)=>i===0?{...d,checksum:'f'.repeat(64)}:d)),fingerprint);
 assert.notEqual(lossDocumentDigest(metadata().map((d,i)=>i===0?{...d,linkIds:[id(55)]}:d)),fingerprint);
 assert.throws(()=>lossDocumentDigest([metadata()[0],metadata()[0]]),RangeError);
});
test('SS13 Store → PM severity → Ben if flagged → Nancy nonposting decision',()=>{
 const rows=[nancy(),root(),ben(),screen()];
 const state=replayLossCase(caseId,rows);
 assert.equal(state.status,'NANCY_APPROVED_PENDING_EXECUTION');
 assert.equal(state.version,4);
 assert.equal(state.latestEventId,id(16));
 assert.equal(state.stockDisposalExecuted,false);
 assert.equal(state.financeWriteOffPosted,false);
 assert.equal(state.makerUserId,id(11));
 assert.equal(state.pmUserId,id(13));assert.equal(state.benUserId,id(15));
 assert.equal(state.nancyUserId,id(17));
 assert.equal(LOSS_CASE_ENTITY,'STOCK_LOSS_CASE');
});
test('SS13 independent PM → Nancy no Ben if Khaimook explicitly declines escalation',()=>{
 const state=replayLossCase(caseId,[nancy(false),root(),screen('FORWARD_DISPOSAL',false)]);
 assert.equal(state.status,'NANCY_APPROVED_PENDING_EXECUTION');
 assert.equal(state.benUserId,null);
});
test('SS13 non-disposal case stops before Nancy and has no stock effect',()=>{
 const r=root();r.newValues.proposedDisposition='RETURN';
 const state=replayLossCase(caseId,[screen('NONDISPOSAL_REVIEW',false),r]);
 assert.equal(state.status,'NONDISPOSAL_REVIEWED');
 assert.equal(state.nancyUserId,null);
 assert.throws(()=>replayLossCase(caseId,[nancy(false),screen('NONDISPOSAL_REVIEW',false),r]),RangeError);
});
test('SS13 rejects self-review, incorrect escalation sequence, fork and stale predecessor',()=>{
 assert.throws(()=>replayLossCase(caseId,[root(),root()]),RangeError);
 const selfPm={...screen(),actorUserId:id(11)};
 assert.throws(()=>replayLossCase(caseId,[root(),selfPm]),RangeError);
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),nancy(false)]),RangeError);
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),ben(),nancy(false)]),RangeError);
 const stale={...ben(),newValues:{...ben().newValues,previousEventId:id(44)}};
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),stale]),RangeError);
 const duplicate={...screen(),id:id(22)};
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),duplicate]),RangeError);
});
test('SS13 rejects forged array decisions, cross actor and illegal disposal effects',()=>{
 assert.throws(()=>replayLossCase(caseId,[root(),{
  ...screen(),newValues:{...screen().newValues,decision:['FORWARD_DISPOSAL']}}]),RangeError);
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),ben(),{
  ...nancy(),newValues:{...nancy().newValues,stockDisposalExecuted:true}}]),RangeError);
 assert.throws(()=>replayLossCase(caseId,[root(),screen(),ben(),{
  ...nancy(),actorUserId:id(13)}]),RangeError);
});
test('SS13 API/service source keeps live roles, stock and financial ledger untouched',()=>{
 const service=readFileSync(new URL('../../apps/api/src/inventory/stock-loss-case.service.ts',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../../apps/api/src/inventory/stock-loss-case.controller.ts',import.meta.url),'utf8');
 assert.match(service,/TransactionIsolationLevel\.Serializable/);
 assert.match(service,/pg_advisory_xact_lock/);
 assert.match(service,/this\.documents\.filterSourceDocuments/);
 assert.match(service,/this\.access\.assertAccess/);
 for(const role of ['STOREKEEPER','PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'])
  assert.ok(service.includes(role));
 assert.ok(controller.includes('CsrfGuard'));
 assert.ok(controller.includes('expectedPreviousEventId'));
 assert.doesNotMatch(service,/stockTransaction\.(create|update)|payment\.(create|update)|supplierInvoice\.(create|update)/);
 assert.doesNotMatch(controller,/inventory\.stock_count\.approve|inventory\.issue\.approve/);
});
