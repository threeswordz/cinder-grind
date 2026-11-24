import test from 'node:test';
import assert from 'node:assert/strict';
import {planSupplierDeliveryTransition as plan, SupplierDeliveryPolicyError} from './supplier-delivery-lifecycle.ts';
const po={purchaseOrderId:'poA',companyId:'MKE',projectId:'projectA',latestApprovedRevisionId:'poA-rev1',isLatestApprovedRevision:true,cancelled:false};
const actor=(id,role,permissions)=>({userId:id,companyId:'MKE',roleCodes:[role],permissions,activeSession:true,activeEmployee:true});
const jai=actor('jai','PROCUREMENT_OFFICER',['procurement.po.view']);
const store=actor('store','STOREKEEPER',['inventory.receiving.view']);
const pm=actor('pm','PROJECT_MANAGER',['inventory.receipt.view']);
const basis={source:po,actor:jai,projectAuthorized:true,evidenceDocumentId:'doc-verifiable-from-backend',note:'Supplier evidence recorded',current:null,expectedVersion:0};
const step=(current,action,extra={})=>plan({...basis,action,current,expectedVersion:current?.version??0,...extra});
const err=(fn,code)=>assert.throws(fn,e=>e instanceof SupplierDeliveryPolicyError && e.code===code,code);
test('PUR08 acknowledgment is explicit; approved PO date alone cannot create it',()=>{
  const a=step(null,'ACKNOWLEDGE');
  assert.equal(a.case.stage,'ACKNOWLEDGED');
  assert.equal(a.effect,'NO_PO_GR_STOCK_FINANCE_MUTATION');
  assert.equal(a.case.version,1);
  const t=step(a.case,'CONFIRM_IN_TRANSIT');
  assert.equal(t.case.stage,'IN_TRANSIT');
  const late=step(t.case,'REPORT_DELAY',{newSupplierExpectedDate:'2026-12-09'});
  assert.equal(late.case.stage,'DELAY_REPORTED');
  assert.equal(late.newSupplierExpectedDate,'2026-12-09');
  err(()=>step(null,'CONFIRM_IN_TRANSIT'),'PUR08_ACKNOWLEDGED_PO_AND_JAI_REQUIRED');
  err(()=>step(t.case,'REPORT_DELAY',{newSupplierExpectedDate:'2026-02-30'}),'PUR08_SUPPLIER_REVISED_DATE_EVIDENCE_REQUIRED');
});
test('PUR14 Store→independent PM→Jai→Store replacement evidence never posts GR/stock',()=>{
  const ack=step(null,'ACKNOWLEDGE');
  const discrepancy=step(ack.case,'REPORT_DISCREPANCY',{actor:store,discrepancyKind:'DAMAGED'});
  const decision=step(discrepancy.case,'PM_REVIEW_DISCREPANCY',{actor:pm,pmDecision:'REQUEST_REPLACEMENT'});
  const claim=step(decision.case,'JAI_RECORD_CLAIM');
  const inbound=step(claim.case,'STORE_RECORD_REPLACEMENT_RECEIPT',{actor:store,recordedGoodsReceiptId:'posted-gr-exists'});
  assert.deepEqual([discrepancy.case.stage,decision.case.stage,claim.case.stage,inbound.case.stage],
    ['DISCREPANCY_REPORTED','PM_REVIEWED','CLAIM_RECORDED','REPLACEMENT_RECEIPT_RECORDED']);
  assert.equal(inbound.effect,'NO_PO_GR_STOCK_FINANCE_MUTATION');
  err(()=>step(claim.case,'STORE_RECORD_REPLACEMENT_RECEIPT',{actor:store}),'PUR14_CANONICAL_REPLACEMENT_GR_REQUIRED');
  err(()=>step(claim.case,'STORE_RECORD_RETURN_DISPATCH',{actor:store}),'PUR14_STORE_RETURN_AFTER_AUTHORIZED_CLAIM_REQUIRED');
});
test('PUR14 return path does not infer supplier acceptance or refund',()=>{
  const ack=step(null,'ACKNOWLEDGE');
  const discrep=step(ack.case,'REPORT_DISCREPANCY',{actor:store,discrepancyKind:'WRONG_ITEM'});
  const reviewed=step(discrep.case,'PM_REVIEW_DISCREPANCY',{actor:pm,pmDecision:'REQUEST_RETURN'});
  const claim=step(reviewed.case,'JAI_RECORD_CLAIM');
  assert.equal(step(claim.case,'STORE_RECORD_RETURN_DISPATCH',{actor:store}).effect,'NO_PO_GR_STOCK_FINANCE_MUTATION');
});
test('PUR08/PUR14 fail closed for Company, Project, actor revocation, version, changed PO and missing evidence',()=>{
  const ack=step(null,'ACKNOWLEDGE');
  err(()=>step(null,'ACKNOWLEDGE',{source:{...po,cancelled:true}}),'PUR08_CURRENT_APPROVED_UNCANCELLED_PO_REQUIRED');
  err(()=>step(null,'ACKNOWLEDGE',{source:{...po,isLatestApprovedRevision:false}}),'PUR08_CURRENT_APPROVED_UNCANCELLED_PO_REQUIRED');
  err(()=>step(null,'ACKNOWLEDGE',{actor:{...jai,companyId:'TCJ'}}),'PUR08_ACTIVE_ACTOR_AND_COMPANY_REQUIRED');
  err(()=>step(null,'ACKNOWLEDGE',{projectAuthorized:false}),'PUR08_PROJECT_SCOPE_DENIED');
  err(()=>step(null,'ACKNOWLEDGE',{actor:{...jai,activeEmployee:false}}),'PUR08_ACTIVE_ACTOR_AND_COMPANY_REQUIRED');
  err(()=>step(null,'ACKNOWLEDGE',{actor:store}),'PUR08_INITIAL_JAI_ACK_EVIDENCE_REQUIRED');
  err(()=>step(ack.case,'CONFIRM_IN_TRANSIT',{expectedVersion:0}),'PUR08_STALE_CASE_VERSION');
  err(()=>step(ack.case,'CONFIRM_IN_TRANSIT',{source:{...po,latestApprovedRevisionId:'newApprovedRev'}}),'PUR08_PO_REVISION_SOURCE_CHANGED');
  err(()=>step(null,'ACKNOWLEDGE',{evidenceDocumentId:'  '}),'PUR08_SOURCE_EVIDENCE_AND_NOTE_REQUIRED');
  err(()=>step(null,'ACKNOWLEDGE',{note:'  '}),'PUR08_SOURCE_EVIDENCE_AND_NOTE_REQUIRED');
});
test('PUR14 requires different real maker-checker actors; no claim before PM decision',()=>{
  const ack=step(null,'ACKNOWLEDGE');
  const discrep=step(ack.case,'REPORT_DISCREPANCY',{actor:store,discrepancyKind:'SHORT'});
  err(()=>step(discrep.case,'PM_REVIEW_DISCREPANCY',{actor:{...pm,userId:'store'},pmDecision:'REQUEST_RETURN'}),'PUR14_INDEPENDENT_PM_DECISION_REQUIRED');
  err(()=>step(discrep.case,'JAI_RECORD_CLAIM'),'PUR14_JAI_AFTER_PM_DECISION_REQUIRED');
  const decision=step(discrep.case,'PM_REVIEW_DISCREPANCY',{actor:pm,pmDecision:'DOCUMENT_ONLY'});
  err(()=>step(decision.case,'JAI_RECORD_CLAIM'),'PUR14_JAI_AFTER_PM_DECISION_REQUIRED');
  err(()=>step(ack.case,'REPORT_DISCREPANCY',{actor:jai,discrepancyKind:'DAMAGED'}),'PUR14_STORE_DISCREPANCY_SOURCE_REQUIRED');
});

test('PUR14 Store may report source-backed discrepancy without supplier acknowledgment',()=>{
 const reported=step(null,'REPORT_DISCREPANCY',{actor:store,discrepancyKind:'DAMAGED'});
 assert.equal(reported.case.stage,'DISCREPANCY_REPORTED');
 assert.equal(reported.case.version,1);
 assert.equal(reported.case.storeReporterId,'store');
 assert.equal(reported.effect,'NO_PO_GR_STOCK_FINANCE_MUTATION');
 const reviewed=step(reported.case,'PM_REVIEW_DISCREPANCY',{actor:pm,pmDecision:'REQUEST_RETURN'});
 assert.equal(reviewed.case.stage,'PM_REVIEWED');
});

test('PUR08 does not permit delay/in-transit before an actual recorded acknowledgment',()=>{
 err(()=>step(null,'REPORT_DELAY',{newSupplierExpectedDate:'2026-12-09'}),
 'PUR08_SUPPLIER_REVISED_DATE_EVIDENCE_REQUIRED');
 err(()=>step(null,'CONFIRM_IN_TRANSIT'), 'PUR08_ACKNOWLEDGED_PO_AND_JAI_REQUIRED');
});
