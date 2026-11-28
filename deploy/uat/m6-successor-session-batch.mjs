// Shared successor-only session owner. No retained origin, role changes or retries.
export const successorApiOrigin='http://127.0.0.1:33072';
export const successorWebOrigin='http://127.0.0.1:44172';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_SESSION_BATCH_'+code),{safeCode:'M6_SESSION_BATCH_'+code});};
const hex=/^[a-f0-9]{40}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const cookie=/^erp_session=[A-Za-z0-9_-]{20,256}$/,token=/^[A-Za-z0-9_-]{20,256}$/;
const sorted=a=>Array.isArray(a)&&a.every(x=>typeof x==='string')&&new Set(a).size===a.length?[...a].sort():null;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function requireSuccessorOrigins(api,web){need(api===successorApiOrigin&&web===successorWebOrigin,'ORIGIN');}
async function readJson(r){
  if(!r.headers.get('content-type')?.toLowerCase().startsWith('application/json')){await r.body?.cancel();need(false,'CONTENT_TYPE');}
  const reader=r.body?.getReader();need(reader,'BODY');const chunks=[];let length=0,bytes;
  try{for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);length+=value.byteLength;need(length<=1048576,'BODY_LIMIT');}
    bytes=Buffer.concat(chunks.map(c=>Buffer.from(c.buffer,c.byteOffset,c.byteLength)));
    const envelope=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));need(envelope?.data&&typeof envelope.data==='object','ENVELOPE');return envelope.data;
  }catch(e){if(e.safeCode)throw e;need(false,'JSON');}
  finally{bytes?.fill(0);for(const c of chunks)c.fill(0);await reader.cancel().catch(()=>{});reader.releaseLock();}
}
// Actors must be independently bound to the actual isolated DB. Alias roles
// may share an actor; the caller maps these from one session per distinct user.
export function createSuccessorSessionBatch({candidate,authorization,origin,webOrigin,actors,verifyRuntime,verifyQuiescent,fetchImpl=fetch}){
  requireSuccessorOrigins(origin,webOrigin);
  need(hex.test(candidate?.sha??'')&&hex.test(candidate?.tree??'')&&candidate.syntheticOnly===true&&candidate.rehearsalOnly===true&&candidate.productionAuthorized===false,'CANDIDATE');
  need(Array.isArray(actors)&&actors.length>0&&actors.length<=12&&actors.every(a=>uuid.test(a?.userId??'')&&uuid.test(a.companyId??'')&&/^proto-[a-z0-9_]+@example\.invalid$/.test(a.email??'')&&/^[a-f0-9]{64}$/.test(a.password??'')&&sorted(a.roleCodes)?.length&&sorted(a.permissions)),'ACTORS');
  need(new Set(actors.map(a=>a.userId)).size===actors.length&&new Set(actors.map(a=>a.email)).size===actors.length,'DUPLICATE_ACTOR');
  const roster=structuredClone(actors),ids=roster.map(a=>a.userId).sort();
  need(authorization?.candidateSha===candidate.sha&&authorization.candidateTree===candidate.tree&&authorization.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedSessions===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false&&equal(sorted(authorization.actorIds),ids),'AUTHORIZATION');
  need([verifyRuntime,verifyQuiescent,fetchImpl].every(f=>typeof f==='function'),'ADAPTER');
  let attempted=false;
  const request=async(path,method,session,body)=>{
    await verifyRuntime();const headers={Accept:'application/json',Origin:webOrigin};
    if(session){headers.Cookie=session.cookie;if(method==='POST')headers['x-csrf-token']=session.csrf;}
    if(body!==undefined)headers['Content-Type']='application/json';
    let r;try{r=await fetchImpl(origin+'/api/v1'+path,{method,headers,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{need(false,'TRANSPORT');}
    need(!r.redirected,'REDIRECT');return r;
  };
  return async function withSessions(callback){
    need(!attempted&&typeof callback==='function','NO_REPLAY');attempted=true;
    const live=new Map();let primary,cleanupFailed=false,result;
    await verifyRuntime();await verifyQuiescent();
    try{
      for(const a of roster){
        const r=await request('/auth/login','POST',undefined,{email:a.email,password:a.password});
        const c=r.headers.get('set-cookie')?.split(';',1)[0];
        if(cookie.test(c??''))live.set(a.userId,{cookie:c,csrf:null});
        if(r.status!==201){await r.body?.cancel();need(false,'LOGIN_STATUS');}
        const data=await readJson(r),s=live.get(a.userId);
        if(s&&token.test(data.csrfToken??''))s.csrf=data.csrfToken;
        need(s&&s.csrf&&data.user?.id===a.userId&&data.user.companyId===a.companyId&&data.user.email===a.email,'LOGIN_IDENTITY');
        need(new Set([...live.values()].map(x=>x.cookie)).size===live.size,'COOKIE_ALIAS');
        const me=await request('/auth/me','GET',s);if(me.status!==200){await me.body?.cancel();need(false,'ME_STATUS');}
        const u=await readJson(me);need(u.id===a.userId&&u.companyId===a.companyId&&u.email===a.email&&equal(sorted(u.roleCodes),sorted(a.roleCodes))&&equal(sorted(u.permissions),sorted(a.permissions)),'ROLE_BINDING');
      }
      result=await callback(new Map([...live].map(([id,s])=>[id,Object.freeze({...s})])));
    }catch(e){primary=e;}
    finally{
      for(const s of live.values())try{
        need(token.test(s.csrf??''),'UNCERTAIN_CSRF');
        const out=await request('/auth/logout','POST',s,{});await out.body?.cancel();need(out.status===204,'LOGOUT');
        const stale=await request('/auth/me','GET',s);await stale.body?.cancel();need(stale.status===401,'REVOKED');
      }catch{cleanupFailed=true;}
      live.clear();for(const a of roster)a.password='';
      try{await verifyRuntime();await verifyQuiescent();}catch{cleanupFailed=true;}
    }
    need(!cleanupFailed,'CLEANUP_OR_QUIESCENCE');if(primary)throw primary;
    return result;
  };
}
