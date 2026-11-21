// Read-only proof that the newly restored/updated application still serves
// an original protected subcontract Document, with exact bytes and old access.
import {createHash} from 'node:crypto';
import {httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';

const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};

export function verifyOriginalProtectedBytes(document,bytes){
 demand(document&&Number.isSafeInteger(document.fileSizeBytes)&&document.fileSizeBytes>0&&
  document.fileSizeBytes<=8388608&&/^[a-f0-9]{64}$/.test(document.checksum??'')&&
  Buffer.isBuffer(bytes),'UOM_PROTECTED_DOCUMENT_METADATA_INVALID');
 demand(bytes.length===document.fileSizeBytes&&
  createHash('sha256').update(bytes).digest('hex')===document.checksum,
  'UOM_PROTECTED_DOCUMENT_BYTES_CHANGED');
 return true;
}

export async function verifyUomPriorProtectedReadback(db,binding,origins,technical){
 const {api,web}=structuredClone(origins),b=structuredClone(binding),f=b.fixture;
 demand(validUomOrigins(api,web)&&technical?.userId===f.adminUserId&&
  technical.email==='proto-admin@example.invalid'&&/^[a-f0-9]{64}$/.test(technical.password??''),
  'UOM_PROTECTED_READBACK_BINDING_REFUSED');
 // Created by the completed, immutable subcontract operator; do not upload it
 // again or recreate any claim/Document in the new UOM stage.
 const documents=await db.document.findMany({where:{companyId:f.companyId,fileName:'physical-ui.pdf'}});
 const claims=await db.subcontractClaim.findMany({where:{companyId:f.companyId}});
 demand(documents.length===1&&claims.length===1,'UOM_PRIOR_SUBCONTRACT_DOCUMENT_NOT_UNIQUE');
 const document=documents[0],claim=claims[0],client=httpClient(api,web);
 const route='/documents/projects/'+f.projectId+'/'+document.id+'/download';
 const target='/documents/projects/'+f.projectId+'/targets/SUBCONTRACT_CLAIM/'+claim.id+'/'+document.id+'/download';
 let allowed,denied,primary;
 try{
  allowed=await client.login('UOM_PROTECTED_ALLOWED',b.actors.KHAIMOOK,f.companyId);
  denied=await client.login('UOM_PROTECTED_DENIED',{...technical,expectedRoleCodes:['SYS_ADMIN']},f.companyId);
  for(const path of [route,target]){
   const response=await fetch(api+path,{headers:{Cookie:allowed.cookie,Origin:web},redirect:'error',
    signal:AbortSignal.timeout(15000)});
   demand(response.status===200,'UOM_PRIOR_PROTECTED_READBACK_NOT_ALLOWED');
   verifyOriginalProtectedBytes(document,Buffer.from(await response.arrayBuffer()));
   const negative=await fetch(api+path,{headers:{Cookie:denied.cookie,Origin:web},redirect:'error',
    signal:AbortSignal.timeout(15000)});
   const status=negative.status;await negative.body?.cancel();
   demand(status===403||status===404,'UOM_PRIOR_PROTECTED_DOCUMENT_EXPOSED_TO_TECHNICAL_ADMIN');
  }
 }catch(e){primary=e;}
 finally{
  for(const [label,session] of [['ALLOWED',allowed],['DENIED',denied]])if(session)try{
   await client.logout('UOM_PROTECTED_'+label,session);
   await client.call(session,'UOM_PROTECTED_'+label+'_REVOKED','/auth/me',401);
  }catch(e){primary??=e;}
 }
 if(primary)throw primary;
 return {priorProtectedDocumentReadbackVerified:true,protectedTargetAliasVerified:true,
  technicalAdminDocumentDenied:true,documentSessionsRevoked:true};
}
