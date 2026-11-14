// #338: inspect the original stock fixture and an explicitly selected source.
// No grants, approvals, repair, inferred material mapping or business writes.
import {SOURCE} from './prototype-actors.mjs';
import {validPrivateActors} from './prototype-browser-operator.mjs';

const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const quantity=v=>{
  const text=String(v??'');
  demand(/^-?\d{1,14}(?:\.\d{1,4})?$/.test(text),'MATERIAL_PRECONDITION_QUANTITY_INVALID');
  const [whole,fraction='']=text.replace('-','').split('.');
  return BigInt(whole)*10000n*(text.startsWith('-')?-1n:1n)+
    BigInt(fraction.padEnd(4,'0'))*(text.startsWith('-')?-1n:1n);
};
export async function inspectMaterialPreconditions(db,binding){
  const b=structuredClone(binding),f=b?.fixture,a=b?.actors,m=b?.sourceMapping;
  demand(b?.sourceSha===SOURCE&&validPrivateActors(b)&&
    ['companyId','projectId','warehouseId','materialId','uomId'].every(k=>uuid(f?.[k]))&&
    uuid(b.initial?.stockCountId),'MATERIAL_PRECONDITION_BINDING_INVALID');
  if(m!==undefined)demand(m&&Object.keys(m).sort().join(',')===
    'budgetRevisionId,budgetRevisionLineId,materialId,quantity,uomId'&&
    ['budgetRevisionId','budgetRevisionLineId','materialId','uomId'].every(k=>uuid(m[k]))&&
    m.materialId===f.materialId&&m.uomId===f.uomId&&m.quantity==='10.0000',
    'MATERIAL_EXPLICIT_SOURCE_MAPPING_INVALID');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const mode=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    demand(mode.length===1&&mode[0].mode==='on','MATERIAL_PRECONDITION_READ_ONLY_REQUIRED');
    return {...await inspectMaterialPreconditionsState(tx,b),readOnlyTransactionVerified:true};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}

// Shared state rules; caller owns the transaction and its access mode.
export async function inspectMaterialPreconditionsState(tx,binding){
  const b=structuredClone(binding),f=b?.fixture,a=b?.actors,m=b?.sourceMapping;
  demand(b?.sourceSha===SOURCE&&validPrivateActors(b)&&
    ['companyId','projectId','warehouseId','materialId','uomId'].every(k=>uuid(f?.[k]))&&
    uuid(b.initial?.stockCountId),'MATERIAL_PRECONDITION_BINDING_INVALID');
  if(m!==undefined)demand(m&&Object.keys(m).sort().join(',')===
    'budgetRevisionId,budgetRevisionLineId,materialId,quantity,uomId'&&
    ['budgetRevisionId','budgetRevisionLineId','materialId','uomId'].every(k=>uuid(m[k]))&&
    m.materialId===f.materialId&&m.uomId===f.uomId&&m.quantity==='10.0000',
    'MATERIAL_EXPLICIT_SOURCE_MAPPING_INVALID');
    const count=await tx.stockCount.findUnique({where:{id:b.initial.stockCountId}});
    const same=row=>row&&['companyId','projectId','warehouseId','materialId','uomId'].every(k=>row[k]===f[k]);
    demand(same(count)&&count.status==='APPROVED'&&quantity(count.actualQuantity)===200000n&&
      quantity(count.varianceQuantity)===200000n&&quantity(count.expectedOnHand)===0n&&
      quantity(count.expectedReserved)===0n&&count.expectedLedgerEventCount===0&&
      count.createdByUserId===a.STORE_SITE.userId&&count.submittedByUserId===a.STORE_SITE.userId&&
      count.decidedByUserId===a.KHAIMOOK.userId&&typeof count.postKey==='string'&&count.postKey.length>0,
      'MATERIAL_ORIGINAL_COUNT_CHANGED');
    // Original fixture had exactly one canonical movement and no reservations.
    // A net balance of 20 alone must not hide intervening/reversed operations.
    const ledger=await tx.stockTransaction.findMany();
    demand(ledger.length===1&&same(ledger[0])&&ledger[0].stockCountId===count.id&&
      ledger[0].movementType==='STOCK_COUNT_ADJUSTMENT'&&quantity(ledger[0].quantity)===200000n&&
      ledger[0].effectKey==='stock-count:'+count.id+':'+count.postKey&&
      ledger[0].postedByUserId===a.KHAIMOOK.userId&&
      ['goodsReceiptId','goodsReceiptItemId','materialIssueId','materialIssueItemId','materialReturnId',
        'materialReturnItemId','stockTransferId','stockTransferItemId','reversalOfId','wbsId','costCodeId','activityId']
        .every(k=>ledger[0][k]===null)&&await tx.stockCount.count()===1&&
      await tx.materialReservation.count()===0&&await tx.materialIssue.count()===0&&
      await tx.materialReturn.count()===0&&await tx.stockTransfer.count()===0,
      'MATERIAL_STOCK_HISTORY_CHANGED');
    const sources=await tx.budgetRevision.count({where:{companyId:f.companyId,projectId:f.projectId,
      approvalInstance:{approvalState:'APPROVED'}}});
    if(m){
      const source=await tx.budgetRevision.findFirst({where:{id:m.budgetRevisionId,companyId:f.companyId,projectId:f.projectId},
        select:{id:true,createdByUserId:true,submittedByUserId:true,submittedAt:true,approvalInstance:{select:{
          companyId:true,entityType:true,entityId:true,approvalState:true,completedAt:true,
          actions:{select:{action:true,actionByUserId:true,approvalStep:{select:{stepNo:true}}}}}}}});
      const approval=source?.approvalInstance;
      demand(source?.createdByUserId===a.BEN.userId&&source.submittedByUserId===a.BEN.userId&&source.submittedAt&&
        approval?.companyId===f.companyId&&approval.entityType==='BUDGET_REVISION'&&approval.entityId===source.id&&
        approval.approvalState==='APPROVED'&&approval.completedAt&&approval.actions.length===1&&
        approval.actions[0].action==='APPROVE'&&approval.actions[0].actionByUserId===a.KHAIMOOK.userId&&
        approval.actions[0].approvalStep.stepNo===1,'MATERIAL_SOURCE_APPROVAL_PROVENANCE_INVALID');
      const line=await tx.budgetRevisionLine.findFirst({where:{id:m.budgetRevisionLineId,budgetRevisionId:m.budgetRevisionId},
        select:{id:true,uomId:true,quantity:true,wbsId:true,costCodeId:true}});
      demand(line?.uomId===m.uomId&&quantity(line.quantity)===100000n&&line.wbsId===null&&line.costCodeId===null,
        'MATERIAL_SOURCE_QUANTITY_OR_DIMENSIONS_INVALID');
    }
    return {status:'MATERIAL_PRECONDITIONS_INSPECTED',sourceSha:SOURCE,
      stockPreconditionVerified:true,onHand:'20.0000',reserved:'0.0000',canonicalLedgerEvents:1,
      sourceMappingVerified:!!m,sourceMapping:m?'EXPLICIT_SOURCE_PROVENANCE_VERIFIED':
        sources?'EXPLICIT_MAPPING_REQUIRED':'SOURCE_PREPARATION_REQUIRED',
      configurationApplied:false,writeJourneyAuthorized:false,productionAuthorized:false,secretsPrinted:false};
}
