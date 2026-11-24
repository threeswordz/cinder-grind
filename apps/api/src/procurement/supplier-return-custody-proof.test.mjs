import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySupplierReturnCustody as verify, SupplierReturnCustodyError} from './supplier-return-custody-proof.ts';
const scope={companyId:'MKE',projectId:'PROJECT-A',supplierId:'SUP-A',purchaseOrderId:'PO-1'};
const item={purchaseOrderLineId:'PO-LINE-A',materialId:'MAT-1',uomId:'EACH'};
const fixture=()=>({
 expected:{...scope,...item,discrepancyKind:'DAMAGED'},
 original:{...scope,...item,deliveryId:'DEL-1',lineId:'LINE-1',
   warehouseId:'WH-1',status:'CHECKED',condition:'DAMAGED',
   checkedAt:'2026-11-24T01:00:00Z',superseded:false,
   observedQuantity:'5.0000',goodQuantity:'3.0000',conditionPhotoVerified:true},
 handover:{quantity:'2.0000',supplierSignatory:'Supplier receiver',
  supplierSignatureConfirmed:true,documentId:'SIGN-DOC-1',
  documentChecksum:'a'.repeat(64),documentDistinctFromConditionPhoto:true},
});
const rejects=(mutate,code)=>{const input=fixture();mutate(input);
 assert.throws(()=>verify(input),e=>e instanceof SupplierReturnCustodyError&&e.code===code,code);};
test('signed supplier return covers only damaged not posted quantity; no stock/AP postings',()=>{
 const p=verify(fixture());
 assert.equal(p.quantity,'2.0000');
 assert.equal(p.returnType,'UNPOSTED_DAMAGED_CUSTODY_ONLY');
 assert.equal(p.warehouseId,'WH-1');
 assert.equal(p.stockEffect,false);
 assert.equal(p.financeEffect,false);
 assert.equal(p.financeResolution,'REPLACEMENT_ONLY_NO_AP_CREDIT');
 assert.equal(p.requiresSeparateCanonicalReversalForPostedGoods,true);
 assert.equal(p.supplierSignatory,'Supplier receiver');
});
test('no physical return finalization for SHORT WRONG_ITEM EXCESS absent quantity rules',()=>{
 for(const discrepancyKind of ['SHORT','WRONG_ITEM','EXCESS'])
  rejects(x=>{x.expected.discrepancyKind=discrepancyKind},'PUR14_RETURN_KIND_REQUIRES_ATTRIBUTION_POLICY');
});
test('foreign Company Project supplier PO revision or wrong material/UOM/line denied',()=>{
 for(const key of ['companyId','projectId','supplierId','purchaseOrderId'])
  rejects(x=>{x.original[key]='OTHER'},'PUR14_RETURN_SOURCE_SCOPE_OR_ITEM_MISMATCH');
 for(const key of ['purchaseOrderLineId','materialId','uomId'])
  rejects(x=>{x.original[key]='OTHER'},'PUR14_RETURN_SOURCE_SCOPE_OR_ITEM_MISMATCH');
});
test('do not return received good/posted goods under damaged-only custody event',()=>{
 for(const qty of ['3.0000','5.0000','2.0001','1.9999','0','-1','abc','1.00001'])
  rejects(x=>{x.handover.quantity=qty},
    ['-1','abc','1.00001'].includes(qty)?'PUR14_RETURN_QUANTITY_INVALID':'PUR14_RETURN_UNPOSTED_DAMAGED_QUANTITY_REQUIRED');
 rejects(x=>{x.original.observedQuantity='3.0000'},'PUR14_RETURN_UNPOSTED_DAMAGED_QUANTITY_REQUIRED');
});
test('held/unchecked/superseded or unverified condition photo cannot be returned',()=>{
 rejects(x=>{x.original.status='HELD'},'PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
 rejects(x=>{x.original.condition='NORMAL'},'PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
 rejects(x=>{x.original.checkedAt=null},'PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
 rejects(x=>{x.original.superseded=true},'PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
 rejects(x=>{x.original.conditionPhotoVerified=false},'PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
});
test('signed separate actual uploaded evidence and named attestation required',()=>{
 rejects(x=>{x.handover.supplierSignatureConfirmed=false},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
 rejects(x=>{x.handover.supplierSignatory=' '},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
 rejects(x=>{x.handover.supplierSignatory='A\nB'},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
 rejects(x=>{x.handover.documentDistinctFromConditionPhoto=false},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
 rejects(x=>{x.handover.documentChecksum=null},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
 rejects(x=>{x.handover.documentChecksum='not-a-checksum'},'PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
});
