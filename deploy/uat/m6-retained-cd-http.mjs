// Explicit bounded synthetic readback session scope. Does not authorize a live
// run: caller must enforce exact Mac custody and before/after preservation.
import {assertRetainedCDMetadata} from './m6-retained-cd-readback.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_CD_HTTP_'+code),{safeCode:'M6_CD_HTTP_'+code});};
const API='http://127.0.0.1:33071/api/v1',WEB='http://127.0.0.1:44171';
const keys=['BEN','NANCY','KOH','FOREMAN'];
const uid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const token=/^[A-Za-z0-9_-]{20,256}$/;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function allowedReadbackPaths(binding){
 const {finance:f,hr:h}=binding;
 for(const v of [f.claimId,f.certificationId,h.companyId,h.employeeId,binding.foreignCompanyId])need(typeof v==='string'&&uid.test(v),'BINDING');
 const b='/hr/companies/'+h.companyId+'/employees/'+h.employeeId,p='/subcontracts/physical/claims/'+f.claimId;
 const categories=h.privateCategories.map(x=>x.category);
 need(categories.length===2&&new Set(categories).size===2&&categories.every(x=>['identity','bank'].includes(x)),'CATEGORY');
 const hr=[b+'/employment',b+'/documents',...categories.flatMap(c=>[b+'/private/'+c,b+'/private/'+c+'/history'])];
 return {BEN:new Set(['/auth/me',p]),NANCY:new Set(['/auth/me','/subcontracts/certifications/'+f.certificationId]),KOH:new Set(['/auth/me',...hr,'/hr/companies/'+binding.foreignCompanyId+'/employees/'+h.employeeId+'/employment']),FOREMAN:new Set(['/auth/me',p,...hr])};
}
async function parseResponse(response){
 if(response.status!==200&&response.status!==201){await response.body?.cancel();return undefined;}
 need(response.headers.get('content-type')?.toLowerCase().includes('application/json'),'CONTENT_TYPE');
 const reader=response.body?.getReader();need(reader,'EMPTY_RESPONSE');
 const chunks=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;need(size<=1048576,'RESPONSE_LIMIT');chunks.push(value);}
  const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{need(false,'INVALID_JSON');}
  finally{bytes.fill(0);for(const c of chunks)c.fill(0);}
 }finally{await reader.cancel().catch(()=>{});}
}
export async function runRetainedCDMetadata(binding,{fetchImpl=fetch}={}){
 const allow=allowedReadbackPaths(binding),live=new Map();
 const request=async(path,method,session,body)=>{
   const headers={Accept:'application/json',Origin:WEB};
   if(session){headers.Cookie=session.cookie;if(method==='POST')headers['x-csrf-token']=session.csrf;}
   if(body!==undefined)headers['Content-Type']='application/json';
   try{return await fetchImpl(API+path,{method,headers,redirect:'error',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});}
   catch{need(false,'TRANSPORT');}
 };
 const get=async(key,path)=>{
   need(keys.includes(key)&&live.has(key)&&allow[key].has(path),'PATH_REFUSED');
   const response=await request(path,'GET',live.get(key));
   const envelope=await parseResponse(response);
   return {status:response.status,data:envelope?.data};
 };
 let primary,result,cleanupFailed=false;
 try{
  for(const key of keys){
   const actor=binding.actors[key];
   need(actor?.email==='proto-'+key.toLowerCase()+'@example.invalid'&&/^[a-f0-9]{64}$/.test(actor.password??'')&&uid.test(actor.userId)&&uid.test(actor.companyId),'ACTOR');
   const response=await request('/auth/login','POST',undefined,{email:actor.email,password:actor.password});
   const cookie=response.headers.get('set-cookie')?.split(';',1)[0],envelope=await parseResponse(response),csrf=envelope?.data?.csrfToken;
   if(cookie?.startsWith('erp_session=')&&token.test(cookie.slice(12))&&token.test(csrf??''))live.set(key,{cookie,csrf});
   need(response.status===201&&live.has(key)&&envelope?.data?.user?.id===actor.userId&&envelope.data.user.companyId===actor.companyId,'LOGIN_BINDING');
   const me=await get(key,'/auth/me');
   need(me.status===200&&me.data?.id===actor.userId&&me.data.companyId===actor.companyId&&me.data.email===actor.email&&same([...(me.data.roleCodes??[])].sort(),actor.expectedRoleCodes)&&same([...(me.data.permissions??[])].sort(),actor.permissions),'ROLE_BINDING');
  }
  result=await assertRetainedCDMetadata({...binding,get});
  const foreign=await get('KOH','/hr/companies/'+binding.foreignCompanyId+'/employees/'+binding.hr.employeeId+'/employment');
  need([403,404].includes(foreign.status),'FOREIGN_COMPANY_DENIAL');
 }catch(e){primary=e;}
 finally{
  for(const [key,session] of live){
   try{const logout=await request('/auth/logout','POST',session,{});await logout.body?.cancel();need(logout.status===204,'LOGOUT');
    const stale=await request('/auth/me','GET',session);await stale.body?.cancel();need(stale.status===401,'REVOKED_COOKIE');
   }catch{cleanupFailed=true;}
  }
  live.clear();
 }
 need(!cleanupFailed,'SESSION_CLEANUP');
 if(primary)throw primary;
 return {...result,foreignCompanyDenial:true,sessionRevocationVerified:true};
}
