// HR encrypted-document M6 evidence only. Does not change employee records,
// grants, keys, source identities, or other completed HR journeys.
// Uses dedicated HR-only endpoints. One isolated synthetic plaintext file,
// canonical encrypted storage, authenticated raw-byte readback, no retries.
import {randomUUID} from 'node:crypto';

const requireCheck=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const uuid4=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s);
const MIME='text/plain', FILENAME='synthetic-m6-hr-proof.txt';
const SYNTHETIC_BYTES=Buffer.from('CONSTRUCTION_ERP_SYNTHETIC_M6_ENCRYPTED_HR_FILE_PROOF_20261122\n','utf8');
const MAX_RESPONSE_BYTES=1024*1024;

export function validateM6HrSource(fixture,source){
  requireCheck(uuid4(fixture?.companyId)&&uuid4(fixture?.foreignCompanyId)&&
    fixture.companyId!==fixture.foreignCompanyId&&
    uuid4(source?.employeeId)&&uuid4(source?.documentTypeId)&&
    Number.isSafeInteger(source?.expectedVersion)&&source.expectedVersion>=0&&source.expectedVersion<=999999999&&
    source.syntheticOnly===true,'M6_HR_EXPLICIT_SYNTHETIC_SOURCE_REQUIRED');
}

export async function executeM6HrDocumentJourney({client,actors,fixture,source,
  api='http://127.0.0.1:33071/api/v1',web='http://127.0.0.1:44171',fetchImpl=fetch,requestKey=randomUUID()}={}){
  requireCheck(client&&['login','logout','call'].every(k=>typeof client[k]==='function')&&
    actors?.KOH&&actors?.STORE_SITE&&typeof fetchImpl==='function',
    'M6_HR_AUTHENTICATED_TRANSPORT_REQUIRED');
  validateM6HrSource(fixture,source);
  requireCheck(uuid4(requestKey)&&
    api==='http://127.0.0.1:33071/api/v1'&&web==='http://127.0.0.1:44171',
    'M6_HR_PINNED_LOCAL_ORIGINS_REQUIRED');
  const path='/hr/companies/'+fixture.companyId+'/employees/'+source.employeeId+'/documents';
  const sessions={};let error,completion;
  try{
    sessions.KOH=await client.login('M6_HR_KOH',actors.KOH,fixture.companyId);
    sessions.STORE_SITE=await client.login('M6_HR_STORE_SITE',actors.STORE_SITE,fixture.companyId);
    const koh=sessions.KOH,store=sessions.STORE_SITE;
    const call=async(session,label,route,status)=>(await client.call(session,label,route,status)).value?.data;
    // Current state is read before the single write; unknown history is blocked.
    const initial=await call(koh,'M6_HR_PRIOR_HISTORY',path,200);
    requireCheck(initial&&Array.isArray(initial.items)&&initial.items.length<100&&
      initial.items.every(item=>uuid4(item.id)&&Number.isInteger(item.version))&&
      (initial.items.at(-1)?.version??0)===source.expectedVersion,
      'M6_HR_SOURCE_HISTORY_DRIFT');
    await client.call(store,'M6_HR_STORE_LIST_DENIED',path,403);
    await client.call(store,'M6_HR_STORE_FOREIGN_DENIED',
      '/hr/companies/'+fixture.foreignCompanyId+'/employees/'+source.employeeId+'/documents',403);
    const form=new FormData();
    form.append('requestId',requestKey);
    form.append('documentTypeId',source.documentTypeId);
    form.append('expectedVersion',String(source.expectedVersion));
    form.append('file',new Blob([SYNTHETIC_BYTES],{type:MIME}),FILENAME);
    const upload=await fetchImpl(api+path,{method:'POST',redirect:'error',
      signal:AbortSignal.timeout(15000),headers:{Origin:web,Cookie:koh.cookie,
        'x-csrf-token':koh.csrf,Accept:'application/json'},body:form});
    requireCheck(upload.status===201,'M6_HR_UPLOAD_HTTP_'+upload.status);
    const body=await upload.text();
    requireCheck(body.length<=MAX_RESPONSE_BYTES,'M6_HR_UPLOAD_RESPONSE_TOO_LARGE');
    let envelope;try{envelope=JSON.parse(body);}catch{requireCheck(false,'M6_HR_UPLOAD_RESPONSE_NOT_JSON');}
    const receipt=envelope?.data;
    requireCheck(uuid4(receipt?.id)&&receipt?.version===source.expectedVersion+1,
      'M6_HR_UPLOAD_RECEIPT_INVALID');
    const history=await call(koh,'M6_HR_MASKED_HISTORY',path+'?after='+source.expectedVersion,200);
    requireCheck(history&&Array.isArray(history.items)&&history.items.length===1&&
      history.items[0]?.id===receipt.id&&history.items[0]?.version===receipt.version&&
      Object.keys(history.items[0]).every(x=>['id','version','createdAt'].includes(x)),
      'M6_HR_MASKED_HISTORY_INVALID');
    const downloadPath=path+'/'+receipt.id+'/download';
    await client.call(store,'M6_HR_STORE_DOWNLOAD_DENIED',downloadPath,403);
    const downloaded=await fetchImpl(api+downloadPath,{method:'GET',redirect:'error',
      signal:AbortSignal.timeout(15000),headers:{Origin:web,Cookie:koh.cookie,
        Accept:'text/plain'}});
    requireCheck(downloaded.status===200&&
      downloaded.headers.get('content-type')?.toLowerCase().includes(MIME),
      'M6_HR_AUTHORIZED_DOWNLOAD_DENIED');
    const raw=Buffer.from(await downloaded.arrayBuffer());
    requireCheck(raw.length<=MAX_RESPONSE_BYTES&&raw.equals(SYNTHETIC_BYTES),
      'M6_HR_AUTHORIZED_BYTES_MISMATCH');
    raw.fill(0);
    completion={status:'M6_ENCRYPTED_HR_ATTACHMENT_HTTP_VERIFIED',
      encryptedStorageProofRequiresPrivateInspection:true,
      uploadAndAuthorizedPlaintextReadbackVerified:true,maskedHistoryVerified:true,
      unauthorizedStoreListAndDownloadDenied:true,crossCompanyStoreDenied:true,
      hrActor:'KOH',syntheticOnly:true,productionAuthorized:false,
      hrPrivateDataPrinted:false,fullBusinessJourneysVerified:false,
      macDeploymentVerified:false};
  }catch(e){error=e;}
  finally{
    for(const key of ['STORE_SITE','KOH'])if(sessions[key]){
      try{await client.logout('M6_HR_'+key,sessions[key]);
        await client.call(sessions[key],'M6_HR_'+key+'_SESSION_REVOKED','/auth/me',401);
      }catch(e){error??=e;}
    }
  }
  if(error)throw error;
  return {...completion,sessionsRevoked:true};
}
