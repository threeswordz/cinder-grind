import test from 'node:test';
import assert from 'node:assert/strict';
import {exactRowsPreserved,originalInventoryPreserved,verifyM6MigrationLedger,classifyUomPredecessor,verifyUomHrKeyBaseline} from './prototype-m6-mac-runtime.mjs';
import {resolveM6FinanceSource,resolveM6HrSource} from './prototype-m6-mac-operator.mjs';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
test('forward-only preserved historical rows accept new tables and append-only entries',()=>{
 const before={original:[{id:uuid(1),value:'old',__fm03_exact_row_json:'source'}]};
 assert.equal(exactRowsPreserved(before,{original:[
  {id:uuid(1),value:'old',newNullableColumn:null,__fm03_exact_row_json:'new'},
  {id:uuid(2),value:'new',newNullableColumn:null}],added:[{id:uuid(3)}]}),true);
 assert.throws(()=>exactRowsPreserved(before,{original:[{id:uuid(1),value:'MODIFIED'}]}),/M6_HISTORIC_ROW_CHANGED/);
 assert.throws(()=>exactRowsPreserved(before,{}),/M6_PRESERVED_TABLE_REMOVED/);
});
test('original encrypted files must be unchanged; only one declared synthetic blob may appear',()=>{
 const old=[['','directory'],['prior.bin',4,'abcd']];
 const after=[...old,['sub','directory'],['sub/new.enc',7,'efgh']];
 assert.equal(originalInventoryPreserved(old,after,['sub/new.enc']),true);
 assert.throws(()=>originalInventoryPreserved(old,[['','directory'],['prior.bin',4,'altered']]),/M6_PREVIOUS_PROTECTED_FILE_CHANGED/);
 assert.throws(()=>originalInventoryPreserved(old,[...after,['surprise',3,'else']],['sub/new.enc']),/M6_UNEXPLAINED_PROTECTED_FILE/);
});
test('finance selects canonical approved and uninvoiced posted GR, never creates a PO',async()=>{
 const binding={fixture:{companyId:uuid(1),projectId:uuid(2)}};
 const row={id:uuid(3),purchaseOrderLineId:uuid(4),quantity:'3',
  purchaseOrderLine:{purchaseOrderId:uuid(5),amount:'100'},
  goodsReceipt:{supplierId:uuid(6),purchaseOrderId:uuid(5),supplier:{isActive:true},
   approvalInstance:{approvalState:'APPROVED'},
   purchaseOrder:{supplierId:uuid(6),currencyCode:'THB',cancelledAt:null,nextRevision:null,
    approvalInstance:{approvalState:'APPROVED'}}}};
 let calls=0;
 const db={goodsReceiptItem:{findMany:async query=>{calls++;assert.equal(query.take,200);
    assert.deepEqual(query.where.supplierInvoiceItems,{none:{}});return [row];}}};
 const out=await resolveM6FinanceSource({binding,db});
 assert.equal(out.approvedPoAndGoodGrVerified,true);assert.equal(out.noProcurementReplay,true);
 assert.equal(out.source.goodsReceiptItemId,uuid(3));assert.equal(out.source.amount,'1.00');
 assert.equal(calls,1);
 // An inactive supplier or a superseded PO must fail before any invoice write.
 for(const changes of [
   {goodsReceipt:{...row.goodsReceipt,supplier:{isActive:false}}},
   {goodsReceipt:{...row.goodsReceipt,purchaseOrder:{...row.goodsReceipt.purchaseOrder,nextRevision:{id:uuid(9)}}}}
 ]){
   await assert.rejects(resolveM6FinanceSource({binding,db:{
     goodsReceiptItem:{findMany:async()=>[{...row,...changes}]}
   }}),/M6_APPROVED_UNINVOICED_PO_GR_SOURCE_NOT_FOUND/);
 }
 await assert.rejects(resolveM6FinanceSource({binding,db:{
  goodsReceiptItem:{findMany:async()=>[{...row,goodsReceipt:{...row.goodsReceipt,approvalInstance:{approvalState:'SUBMITTED'}}}]}
 }}),/M6_APPROVED_UNINVOICED_PO_GR_SOURCE_NOT_FOUND/);
});
test('HR derives existing synthetic Koh employee and canonical document version',async()=>{
 const binding={fixture:{companyId:uuid(1)},actors:{KOH:{employeeId:uuid(5)}}};
 const db={
  employee:{findFirst:async()=>({id:uuid(5)})},
  documentType:{findMany:async()=>[
    {id:uuid(9),documentTypeCode:'GENERIC'},
    {id:uuid(10),documentTypeCode:'PROTO_HR'}]},
  hrDocumentAttachment:{findFirst:async()=>({version:4})}};
 const r=await resolveM6HrSource({binding,db});
 assert.deepEqual(r,{employeeId:uuid(5),documentTypeId:uuid(10),expectedVersion:4,syntheticOnly:true});
});

test('migration ledger appends only declared completed forward migrations',()=>{
 const previousSources=[{name:'old',checksum:'aaa'}],releaseSources=[...previousSources,{name:'new',checksum:'bbb'}];
 const old={migration_name:'old',checksum:'aaa',finished_at:'2026-11-20T00:00:00.000Z',rolled_back_at:null};
 const added={migration_name:'new',checksum:'bbb',finished_at:'2026-11-22T00:00:00.000Z',rolled_back_at:null};
 assert.deepEqual(verifyM6MigrationLedger([old],[old,added],previousSources,releaseSources),
  {newMigrationCount:1,forwardOnly:true});
 assert.throws(()=>verifyM6MigrationLedger([old],[old,added],previousSources,
  [{name:'old',checksum:'altered'},{name:'new',checksum:'bbb'}]),/M6_PREDECESSOR_MIGRATION_FILE_DRIFT/);
 assert.throws(()=>verifyM6MigrationLedger([old],[old,{...added,rolled_back_at:'some date'}],
  previousSources,releaseSources),/M6_MIGRATION_LEDGER_NOT_EXACT/);
 assert.throws(()=>verifyM6MigrationLedger([old],[{...old,finished_at:'altered'},added],
  previousSources,releaseSources),/M6_HISTORIC_MIGRATION_CHANGED/);
});

test('finalized UOM may have both owned processes stopped, but not a partial or unknown stop',()=>{
 const receipt={status:'UOM_POPULATED_MAC_UPGRADE_AND_CONVERTED_RECEIVING_VERIFIED',
  applicationSha:'9fa0506e9a50fd556f1c4404e4db2e3d88093b85',
  operatorMainSha:'9fa0506e9a50fd556f1c4404e4db2e3d88093b85',
  forwardOnlyMigration:true,sourceHistoryPreserved:true,
  documentsUploadsKeysAndPriorReceiptsPreserved:true,
  preUpgradeSeparatePopulatedRestoreAndJourneyVerified:true,
  newConvertedStockJourneyVerified:true,humanUatCompleted:false,productionAuthorized:false};
 const api={port:33071,pid:101},web={port:44171,pid:202};
 const failure={phase:'FINAL_PRESERVATION',code:'RC_UNEXPECTED_DOCUMENT_FILES',
  sourceMayBeStopped:true,sourceMayBeMigrated:true,automaticRetryAllowed:false};
 const base={receipt,api,web,failure,portsFree:true};
 assert.equal(classifyUomPredecessor({...base,apiAbsent:true,webAbsent:true}),'finalized-stopped');
 assert.equal(classifyUomPredecessor({...base,apiAbsent:false,webAbsent:false}),'running');
 assert.throws(()=>classifyUomPredecessor({...base,apiAbsent:true,webAbsent:false}),/M6_PREDECESSOR_PARTIAL_PROCESS_STATE/);
 assert.throws(()=>classifyUomPredecessor({...base,apiAbsent:true,webAbsent:true,portsFree:false}),
  /M6_STOPPED_PREDECESSOR_CUSTODY_INVALID/);
 assert.throws(()=>classifyUomPredecessor({...base,apiAbsent:true,webAbsent:true,
  failure:{...failure,automaticRetryAllowed:true}}),/M6_STOPPED_PREDECESSOR_CUSTODY_INVALID/);
});
test('historical HR keyring must match both the sealed UOM inventory and preserved original',()=>{
 const snapshot=[['','directory'],['keyring.json',55,'original-key-sha256']];
 const baseline={hrkeys:snapshot,documents:[]},recorded={inventories:structuredClone(baseline)};
 assert.equal(verifyUomHrKeyBaseline(baseline,recorded,snapshot,structuredClone(snapshot)),true);
 assert.throws(()=>verifyUomHrKeyBaseline(baseline,recorded,snapshot,
  [['','directory'],['keyring.json',55,'substituted-key-sha256']]),
  /M6_HR_KEYS_DRIFTED_FROM_UOM_CUSTODY/);
 assert.throws(()=>verifyUomHrKeyBaseline(baseline,{inventories:{...baseline,hrkeys:[]}},snapshot,snapshot),
  /M6_HR_KEYS_DRIFTED_FROM_UOM_CUSTODY/);
 assert.throws(()=>verifyUomHrKeyBaseline(baseline,recorded,
  [['','directory'],['keyring.json',55,'bad-preserved-key']],snapshot),
  /M6_HR_KEYS_DRIFTED_FROM_UOM_CUSTODY/);
});
