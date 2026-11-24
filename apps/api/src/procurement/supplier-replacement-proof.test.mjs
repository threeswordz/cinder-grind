import test from 'node:test';
import assert from 'node:assert/strict';
import { verifySupplierReplacementProof as verify, SupplierReplacementProofError } from './supplier-replacement-proof.ts';
const scope={companyId:'MKE',projectId:'PROJECT-A',supplierId:'SUP-A',purchaseOrderId:'PO-REV-2'};
const line={purchaseOrderLineId:'PO-LINE-7',materialId:'MAT-1',uomId:'EACH'};
const sample=()=>({
 expected:{...scope,...line,discrepancyKind:'DAMAGED',claimAt:'2026-11-24T04:00:00Z'},
 original:{...scope,...line,id:'DEL-ORIG',lineId:'DL-ORIG',status:'CHECKED',
   receivedAt:'2026-11-23T01:00:00Z',observedQuantity:'5.0000',goodQuantity:'3.0000',discrepancyDocumentLinked:true},
 receipt:{...scope,id:'GR-REPLACE',itemId:'GR-ITEM',postedAt:'2026-11-24T07:00:00Z',reversedAt:null,
   approvalState:'APPROVED',item:{...line,quantity:'2.0000'},
   delivery:{...scope,id:'DEL-REPLACE',receivedAt:'2026-11-24T05:00:00Z',
     checkedAt:'2026-11-24T06:00:00Z',status:'CHECKED',supersedesId:null,
     line:{...line,goodQuantity:'2.0000'}}}
});
const rejects=(change,code)=>{const x=sample();change(x);assert.throws(()=>verify(x),
 e=>e instanceof SupplierReplacementProofError&&e.code===code,code)};
test('actual positive posted replacement item matches original damaged quantity, leaves ledgers unchanged',()=>{
 const x=verify(sample());
 assert.equal(x.quantity,'2.0000');assert.equal(x.originalDeliveryLineId,'DL-ORIG');
 assert.equal(x.replacementGoodsReceiptItemId,'GR-ITEM');
 assert.equal(x.effect,'TRACE_ONLY_NO_STOCK_FINANCE_MUTATION');
});
test('foreign supplier, Company, Project and same-number different PO revision denied',()=>{
 for(const key of ['supplierId','companyId','projectId','purchaseOrderId'])
  rejects(x=>{x.receipt[key]='OTHER'},'PUR14_REPLACEMENT_SCOPE_MISMATCH');
 rejects(x=>{x.receipt.delivery.projectId='OTHER'},'PUR14_REPLACEMENT_SCOPE_MISMATCH');
 rejects(x=>{x.original.companyId='OTHER'},'PUR14_REPLACEMENT_SCOPE_MISMATCH');
});
test('wrong PO item/material/UOM, unsupported original and missing receiving document denied',()=>{
 for(const key of ['purchaseOrderLineId','materialId','uomId'])
  rejects(x=>{x.receipt.item[key]='OTHER'},'PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
 rejects(x=>{x.receipt.delivery.line.materialId='OTHER'},'PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
 rejects(x=>{x.original.discrepancyDocumentLinked=false},'PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
 rejects(x=>{x.original.status='HELD'},'PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
});
test('unapproved, unposted, reversed, same delivery, superseded and unchecked receipt denied',()=>{
 rejects(x=>{x.receipt.approvalState='PENDING'},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
 rejects(x=>{x.receipt.postedAt=null},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
 rejects(x=>{x.receipt.reversedAt='2026-11-24T08:00:00Z'},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
 rejects(x=>{x.receipt.delivery.id=x.original.id},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
 rejects(x=>{x.receipt.delivery.supersedesId=x.original.id},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
 rejects(x=>{x.receipt.delivery.checkedAt=null},'PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
});
test('quantity mismatch, older delivery and future checker denied',()=>{
 rejects(x=>{x.receipt.item.quantity='3.0000'},'PUR14_REPLACEMENT_QUANTITY_MISMATCH');
 rejects(x=>{x.receipt.delivery.line.goodQuantity='3.0000'},'PUR14_REPLACEMENT_QUANTITY_MISMATCH');
 rejects(x=>{x.original.goodQuantity='5.0000'},'PUR14_REPLACEMENT_QUANTITY_MISMATCH');
 rejects(x=>{x.receipt.delivery.receivedAt='2026-11-23T01:00:00Z'},'PUR14_REPLACEMENT_NOT_AFTER_CLAIM');
 rejects(x=>{x.receipt.delivery.checkedAt='2026-11-25T01:00:00Z'},'PUR14_REPLACEMENT_NOT_AFTER_CLAIM');
});
test('SHORT and WRONG_ITEM must not be claimed resolved without approved allocation rule',()=>{
 rejects(x=>{x.expected.discrepancyKind='SHORT'},'PUR14_REPLACEMENT_SOURCE_KIND_NOT_YET_SUPPORTED');
 rejects(x=>{x.expected.discrepancyKind='WRONG_ITEM'},'PUR14_REPLACEMENT_SOURCE_KIND_NOT_YET_SUPPORTED');
});
