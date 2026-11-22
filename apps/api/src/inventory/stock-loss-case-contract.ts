import {createHash} from 'node:crypto';

export const LOSS_CASE_ENTITY='STOCK_LOSS_CASE';
export const LOSS_OPEN='OPEN',LOSS_SCREEN='SCREEN',LOSS_BEN='BEN_REVIEW',LOSS_NANCY='NANCY_DECIDE';
export type CaseEvent={id:string;actorUserId:string;action:string;occurredAt:Date;newValues:unknown};
export type CaseDocument={id:string;checksum:string;uploadedAt:string;fileSizeBytes:number;linkIds:string[]};
export type LossCaseState={
  caseId:string;
  projectId:string;warehouseId:string;materialId:string;uomId:string;
  quantity:string;kind:'LOSS'|'DAMAGE'|'WASTE';occurredOn:string;
  finderName:string;place:string;cause:string;proposedDisposition:'REPAIR'|'RETURN'|'DISPOSAL';
  evidenceDocumentIds:string[];evidenceFingerprint:string;
  makerUserId:string;registeredAt:string;latestEventId:string;version:number;
  status:'OPEN'|'RETURNED'|'NONDISPOSAL_REVIEWED'|'BEN_PENDING'|
    'NANCY_PENDING'|'NANCY_APPROVED_PENDING_EXECUTION'|'NANCY_REJECTED';
  pmUserId:string|null;pmNote:string|null;benUserId:string|null;benNote:string|null;
  nancyUserId:string|null;nancyNote:string|null;
  stockDisposalExecuted:false;financeWriteOffPosted:false;
};
const obj=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
export const caseUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v===v.trim()&&v.length<=max;
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const date=(v:unknown):v is string=>{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const d=new Date(v+'T00:00:00.000Z');
  return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;
};
export function caseMaterialQuantity(v:unknown):v is string{
 return typeof v==='string'&&/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(v)&&Number(v)>0;
}
export function lossCasePayload(value:unknown){
 const x=obj(value);
 if(!x||Object.keys(x).some(k=>![
   'projectId','warehouseId','materialId','uomId','quantity','kind','occurredOn',
   'finderName','place','cause','proposedDisposition','evidenceDocumentIds',
 ].includes(k)))throw new RangeError('LOSS_CASE_FIELDS_INVALID');
 if(!caseUuid(x.projectId)||!caseUuid(x.warehouseId)||!caseUuid(x.materialId)||
   !caseUuid(x.uomId)||!caseMaterialQuantity(x.quantity)||
   (x.kind!=='LOSS'&&x.kind!=='DAMAGE'&&x.kind!=='WASTE')||
   !date(x.occurredOn)||!text(x.finderName,200)||
   !text(x.place,500)||!text(x.cause,2000)||
   (x.proposedDisposition!=='REPAIR'&&x.proposedDisposition!=='RETURN'&&x.proposedDisposition!=='DISPOSAL')||
   !Array.isArray(x.evidenceDocumentIds)||!x.evidenceDocumentIds.length||
   x.evidenceDocumentIds.length>20||x.evidenceDocumentIds.some(id=>!caseUuid(id))||
   new Set(x.evidenceDocumentIds).size!==x.evidenceDocumentIds.length)
   throw new RangeError('LOSS_CASE_SOURCE_INVALID');
 return {
   projectId:x.projectId as string,warehouseId:x.warehouseId as string,
   materialId:x.materialId as string,uomId:x.uomId as string,
   quantity:x.quantity as string,kind:x.kind as 'LOSS'|'DAMAGE'|'WASTE',
   occurredOn:x.occurredOn as string,finderName:x.finderName as string,
   place:x.place as string,cause:x.cause as string,
   proposedDisposition:x.proposedDisposition as 'REPAIR'|'RETURN'|'DISPOSAL',
   evidenceDocumentIds:[...(x.evidenceDocumentIds as string[])].sort(),
 };
}
export function lossDocumentDigest(rows:readonly CaseDocument[]):string{
 if(!rows.length||rows.length>20)throw new RangeError('LOSS_CASE_DOCS_REQUIRED');
 const ids=new Set<string>();
 const docs=[...rows].sort((a,b)=>a.id.localeCompare(b.id));
 for(const r of docs){
   if(!caseUuid(r.id)||ids.has(r.id)||!sha(r.checksum)||
     typeof r.uploadedAt!=='string'||Number.isNaN(Date.parse(r.uploadedAt))||
     new Date(r.uploadedAt).toISOString()!==r.uploadedAt||
     !Number.isSafeInteger(r.fileSizeBytes)||r.fileSizeBytes<=0||
     !r.linkIds.length||r.linkIds.some(id=>!caseUuid(id))||
     new Set(r.linkIds).size!==r.linkIds.length)
     throw new RangeError('LOSS_CASE_DOC_SOURCE_INVALID');
   ids.add(r.id);
 }
 return createHash('sha256').update(JSON.stringify(
  docs.map(r=>({id:r.id,checksum:r.checksum,uploadedAt:r.uploadedAt,
    bytes:r.fileSizeBytes,links:[...r.linkIds].sort()}))
 )).digest('hex');
}
export function replayLossCase(id:string,rows:readonly CaseEvent[]):LossCaseState|null{
 if(!caseUuid(id))throw new RangeError('LOSS_CASE_ID_INVALID');
 if(!rows.length)return null;
 const roots=rows.filter(r=>r.action===LOSS_OPEN);
 if(roots.length!==1)throw new RangeError('LOSS_CASE_OPEN_REQUIRED_ONCE');
 const root=roots[0]!,v=obj(root.newValues);
 if(!v||!caseUuid(root.id)||!caseUuid(root.actorUserId)||!caseUuid(v.reportedByUserId)||
   v.reportedByUserId!==root.actorUserId||
   !sha(v.evidenceFingerprint)||v.effect!=='NONE_OPERATIONAL_PROPOSAL'||
   v.previousEventId!==null||v.version!==1||
   Number.isNaN(root.occurredAt.getTime()))
   throw new RangeError('LOSS_CASE_OPEN_INVALID');
 const payload=lossCasePayload({
   projectId:v.projectId,warehouseId:v.warehouseId,materialId:v.materialId,
   uomId:v.uomId,quantity:v.quantity,kind:v.kind,occurredOn:v.occurredOn,
   finderName:v.finderName,place:v.place,cause:v.cause,
   proposedDisposition:v.proposedDisposition,evidenceDocumentIds:v.evidenceDocumentIds,
 });
 let state:LossCaseState={caseId:id,...payload,
  evidenceFingerprint:v.evidenceFingerprint,makerUserId:root.actorUserId,
  registeredAt:root.occurredAt.toISOString(),latestEventId:root.id,version:1,status:'OPEN',
  pmUserId:null,pmNote:null,benUserId:null,benNote:null,nancyUserId:null,nancyNote:null,
  stockDisposalExecuted:false,financeWriteOffPosted:false,
 };
 const byParent=new Map<string,CaseEvent>(),seen=new Set<string>();
 for(const row of rows){
   if(!caseUuid(row.id)||seen.has(row.id)||!caseUuid(row.actorUserId)||
     !(row.occurredAt instanceof Date)||Number.isNaN(row.occurredAt.getTime()))
     throw new RangeError('LOSS_CASE_AUDIT_EVENT_INVALID');
   seen.add(row.id);if(row===root)continue;
   const t=obj(row.newValues);
   if(!t||!caseUuid(t.previousEventId)||byParent.has(t.previousEventId)||
     !Number.isSafeInteger(t.version)||![
     LOSS_SCREEN,LOSS_BEN,LOSS_NANCY].includes(row.action))
     throw new RangeError('LOSS_CASE_AUDIT_CHAIN_INVALID');
   byParent.set(t.previousEventId,row);
 }
 let last=root;
 while(byParent.size){
   const row=byParent.get(last.id);
   if(!row||row.occurredAt.getTime()<last.occurredAt.getTime())
     throw new RangeError('LOSS_CASE_EVENT_FORK_OR_ORPHAN');
   const a=obj(row.newValues)!;
   if(a.version!==state.version+1)
     throw new RangeError('LOSS_CASE_VERSION_CONFLICT');
   if(row.action===LOSS_SCREEN){
     if(state.status!=='OPEN'||row.actorUserId===state.makerUserId||
       !text(a.note,2000)||typeof a.escalateToBen!=='boolean'||
       !['RETURN','NONDISPOSAL_REVIEW','FORWARD_DISPOSAL'].includes(String(a.decision))||
       (a.decision==='NONDISPOSAL_REVIEW'&&state.proposedDisposition==='DISPOSAL')||
       (a.decision==='FORWARD_DISPOSAL'&&state.proposedDisposition!=='DISPOSAL')||
       (a.decision==='RETURN'&&a.escalateToBen===true))
       throw new RangeError('LOSS_CASE_PM_DECISION_INVALID');
     state.pmUserId=row.actorUserId;state.pmNote=a.note as string;
     state.status=a.decision==='RETURN'?'RETURNED':
       a.escalateToBen?'BEN_PENDING':
       a.decision==='FORWARD_DISPOSAL'?'NANCY_PENDING':'NONDISPOSAL_REVIEWED';
   }else if(row.action===LOSS_BEN){
     if(state.status!=='BEN_PENDING'||row.actorUserId===state.makerUserId||
       row.actorUserId===state.pmUserId||!text(a.note,2000))
       throw new RangeError('LOSS_CASE_BEN_REVIEW_INVALID');
     state.benUserId=row.actorUserId;state.benNote=a.note as string;
     state.status=state.proposedDisposition==='DISPOSAL'?'NANCY_PENDING':'NONDISPOSAL_REVIEWED';
   }else{
     if(state.status!=='NANCY_PENDING'||state.proposedDisposition!=='DISPOSAL'||
       row.actorUserId===state.makerUserId||row.actorUserId===state.pmUserId||
       row.actorUserId===state.benUserId||!text(a.note,2000)||
       (a.decision!=='APPROVE_PROPOSAL'&&a.decision!=='REJECT_PROPOSAL')||
       a.stockDisposalExecuted!==false||a.financeWriteOffPosted!==false)
       throw new RangeError('LOSS_CASE_NANCY_DECISION_INVALID');
     state.nancyUserId=row.actorUserId;state.nancyNote=a.note as string;
     state.status=a.decision==='APPROVE_PROPOSAL'
       ?'NANCY_APPROVED_PENDING_EXECUTION':'NANCY_REJECTED';
   }
   byParent.delete(last.id);
   last=row;
   state.latestEventId=row.id;state.version++;
 }
 return state;
}
