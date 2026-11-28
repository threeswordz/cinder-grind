// PUR08/PUR14 synthetic reported-evidence return journey. Caller owns sessions,
// source fixture admission, durable attempt seal and exact audit-only DB proof.
import {verifySupplierDenialTarget,supplierScopeProof} from './m6-residual-denial-target.mjs';
import {matchesSupplierApplication} from './m6-residual-recovery-authority.mjs';
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SUPPLIER_JOURNEY_'+c),{safeCode:'M6_SUPPLIER_JOURNEY_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
export const supplierBindingDigest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
function units(x){need(typeof x==='string'&&/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(x),'QUANTITY');const [a,b='']=x.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));}
export function createSupplierCanonicalJourney({binding,authorization:a,operatorSha,request,verifyRuntime,verifySources,verifyDelta}){
 const b=structuredClone(binding),keys=['companyId','projectId','orderId','denialOrderId','ackEventId','ackDocumentId','transitDocumentId','delayDocumentId','conditionDocumentId','handoverDocumentId','originalDeliveryId','originalDeliveryLineId','jaiUserId','storeUserId','pmUserId'];
 need(b&&keys.every(k=>uuid(b[k]))&&new Set(keys.map(k=>b[k])).size===keys.length&&hex(b.conditionChecksum)&&hex(b.handoverChecksum)&&b.conditionChecksum!==b.handoverChecksum&&typeof b.supplierSignatory==='string'&&b.supplierSignatory.trim().length>=2&&b.supplierSignatory.length<=200&&!/[\x00-\x1f\x7f]/.test(b.supplierSignatory),'BINDING');
 need(b.denialOrderId===b.supplierDenialTarget?.id&&verifySupplierDenialTarget(b.supplierDenialTarget,b.orderId),'DENIAL_BINDING');
 need(typeof b.revisedDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.revisedDate)&&Number.isFinite(Date.parse(b.revisedDate))&&new Date(b.revisedDate).toISOString().slice(0,10)===b.revisedDate,'DATE');
 need(units(b.returnQuantity)>0n&&units(b.returnQuantity)===units(b.observedQuantity)-units(b.goodQuantity),'HELD_QUANTITY');
 need(matchesSupplierApplication(a)&&a.database==='m6_successor_rehearsal'&&/^[a-f0-9]{40}$/.test(operatorSha??'')&&a.operatorSha===operatorSha&&a.bindingSha256===supplierBindingDigest(b)&&a.ownerAuthorizedSupplierJourney===true&&a.retainedMutationAuthorized===false&&a.productionAuthorized===false,'AUTHORITY');
 need([request,verifyRuntime,verifySources,verifyDelta].every(f=>typeof f==='function'),'ADAPTER');
 const path='/procurement/purchase-orders/'+b.orderId+'/supplier-case';let attempted=false,previous=null,version=0;const events=[];
 async function call(actor,method,p,body,status){await verifyRuntime();const r=await request({actor,method,path:p,body});need(r?.status===status,'HTTP_'+status);return r.data;}
 function state(s,stage,n){need(s?.companyId===b.companyId&&s.projectId===b.projectId&&s.purchaseOrderId===b.orderId&&s.revisionId===b.orderId&&s.stage===stage&&s.version===n,'STATE');}
 async function step(actor,action,stage,evidenceDocumentId,fields={}){
  const body={action,expectedVersion:version,expectedPreviousEventId:previous,evidenceDocumentId,note:'Synthetic M6 '+action,...fields};
  const r=await call(actor,'POST',path+'/events',body,201);state(r?.case,stage,version+1);
  need(r.purchaseOrderId===b.orderId&&uuid(r.expectedPreviousEventId)&&!events.some(e=>e.id===r.expectedPreviousEventId)&&r.stockEffect===false&&r.financeEffect===false&&r.supplierNoticeSent===false,'EVENT');
  events.push({id:r.expectedPreviousEventId,previousEventId:previous,actor,action,stage,evidenceDocumentId});previous=r.expectedPreviousEventId;version++;return r.case;
 }
 return async()=>{
  need(!attempted,'NO_REPLAY');attempted=true;await verifyRuntime();need(await verifySources(b)===true,'SOURCE_PROOF');
  const initial=await call('JAI','GET',path,undefined,200);need(initial?.purchaseOrderId===b.orderId&&initial.projectId===b.projectId&&initial.approvedLatest===true&&initial.case===null&&initial.expectedPreviousEventId===null&&initial.advisoryOnly===true&&initial.stockEffect===false&&initial.financeEffect===false,'INITIAL');
  await call('JAI','GET','/procurement/purchase-orders/'+b.denialOrderId+'/supplier-case',undefined,404);
  await call('FOREMAN','GET',path,undefined,403);
  await step('JAI','ACKNOWLEDGE','ACKNOWLEDGED',b.ackDocumentId,{recordedPoAcknowledgmentEventId:b.ackEventId});
  await step('JAI','CONFIRM_IN_TRANSIT','IN_TRANSIT',b.transitDocumentId);
  await step('JAI','REPORT_DELAY','DELAY_REPORTED',b.delayDocumentId,{newSupplierExpectedDate:b.revisedDate});
  await call('JAI','POST',path+'/events',{action:'CONFIRM_IN_TRANSIT',expectedVersion:version-1,expectedPreviousEventId:previous,evidenceDocumentId:b.transitDocumentId,note:'Synthetic stale-version denial'},409);
  let s=await step('STORE_SITE','REPORT_DISCREPANCY','DISCREPANCY_REPORTED',b.conditionDocumentId,{discrepancyKind:'DAMAGED'});need(s.storeReporterId===b.storeUserId&&s.discrepancyKind==='DAMAGED','STORE');
  s=await step('KHAIMOOK','PM_REVIEW_DISCREPANCY','PM_REVIEWED',b.conditionDocumentId,{pmDecision:'REQUEST_RETURN'});need(s.storeReporterId===b.storeUserId&&s.pmReviewerId===b.pmUserId&&s.pmDecision==='REQUEST_RETURN','PM');
  s=await step('JAI','JAI_RECORD_CLAIM','CLAIM_RECORDED',b.delayDocumentId);need(s.jaiClaimerId===b.jaiUserId&&s.pmReviewerId===b.pmUserId,'JAI');
  await step('STORE_SITE','STORE_RECORD_RETURN_DISPATCH','RETURN_DISPATCH_RECORDED',b.handoverDocumentId,{originalReceivingDeliveryLineId:b.originalDeliveryLineId,returnQuantity:b.returnQuantity,supplierSignatory:b.supplierSignatory,supplierSignatureConfirmed:true});
  const terminal=await call('STORE_SITE','GET',path,undefined,200);state(terminal?.case,'RETURN_DISPATCH_RECORDED',7);
  const trace=terminal.returnCustodyTrace;
  need(terminal.approvedLatest===true&&terminal.expectedPreviousEventId===previous&&terminal.advisoryOnly===true&&terminal.stockEffect===false&&terminal.financeEffect===false&&trace?.returnType==='UNPOSTED_DAMAGED_CUSTODY_ONLY'&&units(trace.quantity)===units(b.returnQuantity)&&trace.stockEffect===false&&trace.financeEffect===false&&trace.signedHandoverOperatorAttested===true&&trace.originalDeliveryId===b.originalDeliveryId&&trace.originalDeliveryLineId===b.originalDeliveryLineId&&trace.signedHandoverDocumentId===b.handoverDocumentId&&trace.signedHandoverChecksum===b.handoverChecksum,'RETURN_TRACE');
  need(await verifyDelta({events:structuredClone(events),expected:{audit_logs:7},orderId:b.orderId})===true,'DELTA');
  return {status:'M6_SUPPLIER_CANONICAL_RETURN_VERIFIED',events:7,canonicalApiVerified:true,...supplierScopeProof(b.supplierDenialTarget,b.orderId),unauthorizedActorDenied:true,staleVersionDenied:true,stockEffect:false,financeEffect:false,replacementJourneyVerified:false,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false};
 };
}
