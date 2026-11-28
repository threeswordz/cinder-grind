// Event288: use a real foreign order when present; otherwise preserve the
// previously passed native scope proof and separately test an absent order.
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SUPPLIER_SCOPE_'+c),{safeCode:'M6_SUPPLIER_SCOPE_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export const priorScopeEvidence=Object.freeze({applicationSha:'70013b5139292ef33563447f8937c8f132feabd2',testedSha:'9762c5ecfd4015e6b0cfb87891ab272685a21b48',receipt:'https://github.com/threeswordz/cinder-grind/issues/414#issuecomment-7201626345',test:'supplier-delivery-case.native.integration.spec.ts',foreignCompanyDenial:'SUPPLIER_CASE_PO_NOT_FOUND',wrongProjectDenial:'PROJECT_ACCESS_DENIED'});
const blobs=Object.freeze({'procurement/supplier-delivery-case.native.integration.spec.ts':'020e92f551b810f295e6337ea305617a3899ddca','procurement/supplier-delivery-case.service.ts':'31dbfcfeede39ca3fd5b1e792342a91122bacc20','procurement/supplier-delivery-case.controller.ts':'a47d97bcef35c6aa8da145fbd77373d61dc9627d','projects/project-access.service.ts':'915aa4c6933c4828f74be7aee1feebf03c080652','authorization/project-scope.service.ts':'8ede6aa4012bd26c5ecb43706e2e26acac1449bd','procurement/supplier-delivery-lifecycle.ts':'08af0ecb525d8727177c98e1968d3a29af11ee1b'});
export async function verifyPriorSupplierScopeSources(application){for(const [path,expected] of Object.entries(blobs)){const bytes=await readFile(join(application,'apps/api/src',path)),actual=createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');need(actual===expected,'PRIOR_SOURCE_DRIFT');}return true;}
export function verifySupplierDenialTarget(target,orderId){
 need(uuid(orderId)&&uuid(target?.id)&&target.id!==orderId&&['LIVE_FOREIGN_ORDER','ABSENT_ORDER_PRIOR_NATIVE_SCOPE'].includes(target.kind),'TARGET');
 if(target.kind==='LIVE_FOREIGN_ORDER')need(target.priorEvidence===null,'LIVE_EVIDENCE');
 else need(JSON.stringify(target.priorEvidence)===JSON.stringify(priorScopeEvidence),'PRIOR_EVIDENCE');
 return true;
}
export async function selectSupplierDenialTarget(tx,fixture,orderId,newId=randomUUID){
 need([fixture?.companyId,fixture?.projectId,fixture?.foreignCompanyId,fixture?.foreignProjectId,orderId].every(uuid)&&fixture.companyId!==fixture.foreignCompanyId&&fixture.projectId!==fixture.foreignProjectId,'SCOPE');
 const foreign=await tx.purchaseOrder.findFirst({where:{companyId:fixture.foreignCompanyId,projectId:fixture.foreignProjectId},orderBy:{id:'asc'},select:{id:true,companyId:true,projectId:true}});
 let target;if(foreign){need(foreign.companyId===fixture.foreignCompanyId&&foreign.projectId===fixture.foreignProjectId,'FOREIGN_SCOPE');target={id:foreign.id,kind:'LIVE_FOREIGN_ORDER',priorEvidence:null};}
 else{const id=newId();need(uuid(id)&&id!==orderId&&await tx.purchaseOrder.count({where:{id}})===0,'ABSENT_ORDER_COLLISION');target={id,kind:'ABSENT_ORDER_PRIOR_NATIVE_SCOPE',priorEvidence:{...priorScopeEvidence}};}
 verifySupplierDenialTarget(target,orderId);return target;
}
export function supplierScopeProof(target,orderId){verifySupplierDenialTarget(target,orderId);return {supplierDenialKind:target.kind,foreignOrderDenied:target.kind==='LIVE_FOREIGN_ORDER',absentOrderDenied:target.kind==='ABSENT_ORDER_PRIOR_NATIVE_SCOPE',priorNativeScopeEvidenceReused:target.kind==='ABSENT_ORDER_PRIOR_NATIVE_SCOPE',priorNativeScopeReceipt:target.priorEvidence?.receipt??null};}
export function verifySupplierScopeProof(proof){
 return proof?.supplierDenialKind==='LIVE_FOREIGN_ORDER'?proof.foreignOrderDenied===true&&proof.absentOrderDenied===false&&proof.priorNativeScopeEvidenceReused===false&&proof.priorNativeScopeReceipt===null:proof?.supplierDenialKind==='ABSENT_ORDER_PRIOR_NATIVE_SCOPE'&&proof.foreignOrderDenied===false&&proof.absentOrderDenied===true&&proof.priorNativeScopeEvidenceReused===true&&proof.priorNativeScopeReceipt===priorScopeEvidence.receipt;
}
