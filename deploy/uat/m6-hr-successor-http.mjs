// HR-only GET transport. Existing synthetic session owner retains responsibility
// for login/logout and before/after auth-history preservation. Never logs data.
import {assertHrSuccessorDenials} from './m6-hr-successor-boundaries.mjs';
import {requireSuccessorOrigins} from './m6-successor-session-batch.mjs';
const RETAINED_API='http://127.0.0.1:33071',RETAINED_WEB='http://127.0.0.1:44171',MAX=1048576;
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_HR_HTTP_'+code),{safeCode:'M6_HR_HTTP_'+code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const cookie=/^erp_session=[A-Za-z0-9_-]{20,256}$/;
const roles=['KOH','BEN','FOREMAN'];
function paths(b){
 const {companyId:c,foreignCompanyId:f,employeeId:e,otherEmployeeId:o,attachmentId:a,documentId:d,projectId:p,controlDocumentId:x}=b;
 need([c,f,e,o,a,d,p,x].every(uuid)&&c!==f&&e!==o&&d!==x,'BINDING');
 const hr=(company,employee)=>'/hr/companies/'+company+'/employees/'+employee,doc=hr(c,e)+'/documents',download=doc+'/'+a+'/download',foreign=hr(f,e)+'/documents',project='/documents/projects/'+p,alias=project+'/targets/HR_ATTACHMENT/'+e;
 const positive={KOH:new Set(['/auth/me',doc]),BEN:new Set(['/auth/me',project]),FOREMAN:new Set(['/auth/me'])};
 const negative={KOH:new Set([foreign,foreign+'/'+a+'/download',hr(c,o)+'/documents/'+a+'/download']),BEN:new Set([doc,download,project+'/'+d+'/download',alias,alias+'/'+d+'/download']),FOREMAN:new Set([doc,download,...['/employment','/private/identity','/private/identity/history','/private/bank','/private/bank/history'].map(s=>hr(c,o)+s)])};
 return {positive,negative};
}
async function discard(response){try{await response.body?.cancel();}catch{need(false,'BODY_CLEANUP');}}
function privateHeaders(response){const cache=(response.headers.get('cache-control')??'').toLowerCase().split(',').map(x=>x.trim());return cache.includes('private')&&cache.includes('no-store')&&!cache.includes('public')&&response.headers.get('x-content-type-options')?.trim().toLowerCase()==='nosniff'&&!response.headers.has('content-disposition');}
async function json(response){
 const length=response.headers.get('content-length');
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')||(length!==null&&(!/^\d+$/.test(length)||Number(length)>MAX))){await discard(response);need(false,'JSON_HEADERS');}
 const reader=response.body?.getReader();need(reader,'BODY');const chunks=[];let total=0,bytes;
 try{for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);total+=value.byteLength;need(total<=MAX,'BODY_LIMIT');}
  bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength;}
  try{const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));need(envelope&&Object.hasOwn(envelope,'data'),'JSON');return envelope.data;}catch{need(false,'JSON');}
 }finally{bytes?.fill(0);for(const c of chunks)c.fill(0);try{await reader.cancel();}finally{reader.releaseLock();}}
}
export async function executeHrSuccessorDenials({binding,sessions,fetchImpl=fetch,origin=RETAINED_API,webOrigin=RETAINED_WEB}){
 if(origin!==RETAINED_API||webOrigin!==RETAINED_WEB)requireSuccessorOrigins(origin,webOrigin);
 need(binding&&sessions instanceof Map&&typeof fetchImpl==='function','CONTEXT');const {positive,negative}=paths(binding);
 const cookies=new Map();for(const k of roles){const c=sessions.get(k)?.cookie;need(typeof c==='string'&&cookie.test(c),'SESSION');cookies.set(k,c);}
 need(new Set(cookies.values()).size===roles.length,'SESSION_ALIAS');
 const get=async(k,p)=>{
  need(roles.includes(k)&&(positive[k].has(p)||negative[k].has(p)),'PATH');
  let response;try{response=await fetchImpl(origin+'/api/v1'+p,{method:'GET',headers:{Origin:webOrigin,Accept:'application/json',Cookie:cookies.get(k)},redirect:'error',signal:AbortSignal.timeout(15000)});}catch{need(false,'TRANSPORT');}
  if(response.redirected||!privateHeaders(response)){await discard(response);need(false,'PRIVACY_HEADERS');}
  // Do not decode any denial body, even if the server incorrectly returns
  // success. The assertion kernel will reject its status without leaking data.
  if(negative[k].has(p)||response.status!==200){await discard(response);return {status:response.status};}
  return {status:response.status,data:await json(response)};
 };
 try{const result=await assertHrSuccessorDenials({...binding,get});return {...result,privacyHeadersVerified:true,denialBodiesNotDecoded:true,sessionsOwnedByCaller:true};}finally{cookies.clear();}
}
