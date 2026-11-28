import {m7RestorePortAllowed} from './m7-source-process.mjs';
import {createHash} from 'node:crypto';
import {bindM7Session} from './m7-persisted-evidence.mjs';

// Preparation only. Caller must bind an independently inspected isolated API,
// private pre-capture fixture expectations and read-only preservation adapter.
const need=(ok,code)=>{if(!ok)throw new Error('M7_VERIFY_'+code);};
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=x=>Array.isArray(x)?[...x].sort():null;
const discard=async r=>{await r.body?.cancel();};
async function json(r){
 const reader=r.body?.getReader();need(reader,'JSON_BODY');const chunks=[];let n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;chunks.push(value);n+=value.length;need(n<=1048576,'JSON_LIMIT');}
 const raw=Buffer.concat(chunks,n);try{return JSON.parse(raw.toString('utf8')).data;}finally{raw.fill(0);}
 }finally{for(const c of chunks)c.fill(0);try{await reader.cancel();}finally{reader.releaseLock();}}
}
async function bytes(r,expected,hr){
 const cache=(r.headers.get('cache-control')??'').toLowerCase().split(',').map(s=>s.trim());
 if(r.status!==200||(hr&&(!cache.includes('private')||!cache.includes('no-store')||cache.includes('public')||r.headers.get('x-content-type-options')!=='nosniff'))){await discard(r);need(false,'DOWNLOAD_STATUS_OR_PRIVACY');}
 const reader=r.body?.getReader();need(reader,'DOWNLOAD_BODY');const h=createHash('sha256');let n=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;try{n+=value.length;need(n<=expected.size,'DOWNLOAD_SIZE');h.update(value);}finally{value.fill(0);}}need(n===expected.size&&h.digest('hex')===expected.sha256,'DOWNLOAD_BYTES');}
 finally{try{await reader.cancel();}finally{reader.releaseLock();}}
}
const evidenceFields=['businessRows','historicalAuditRows','documentInventory','keyInventory','sourceInventory','grants'];
function snapshot(s){need(s&&evidenceFields.every(k=>sha(s[k])),'PRESERVATION_SNAPSHOT');return evidenceFields.map(k=>s[k]);}

export async function verifyM7Restored({target,fixture,actors,inspectTarget,readPreservation,fetchImpl=fetch,mode='correct',onIssuedSession}){
 let failure='M7_VERIFY_UNEXPECTED',cleanup=true,passed=false;const sessions=[];
 try{
 need(['correct','missing','wrong'].includes(mode)&&typeof inspectTarget==='function'&&typeof readPreservation==='function'&&(onIssuedSession===undefined||typeof onIssuedSession==='function'),'CONTEXT');
 const u=new URL(target.api);need(u.protocol==='http:'&&u.hostname==='127.0.0.1'&&m7RestorePortAllowed(Number(u.port))&&u.pathname==='/api/v1'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.href===target.api,'TARGET');
 need(sha(target.manifestSha)&&/^[a-f0-9]{40}$/.test(target.appSha)&&target.keyMode===mode,'TARGET_BINDING');
 const bind=async()=>{const actual=await inspectTarget();need(actual?.isolated===true&&actual.api===target.api&&actual.manifestSha===target.manifestSha&&actual.appSha===target.appSha&&actual.keyMode===mode,'TARGET_IDENTITY');};
 await bind();const before=snapshot(await readPreservation());need(same(before,snapshot(fixture.preservation)),'SOURCE_RESTORE_DRIFT');
 const {company,foreignCompany,project,foreignProject,unassignedProject,employee,otherEmployee,ordinary,signed,hr}=fixture;
 need([company,foreignCompany,project,foreignProject,unassignedProject,employee,otherEmployee,ordinary.id,signed.id,signed.agreementId,hr.id,hr.documentId].every(id)&&company!==foreignCompany&&employee!==otherEmployee&&new Set([project,foreignProject,unassignedProject]).size===3&&new Set([ordinary.id,signed.id,hr.documentId]).size===3,'FIXTURE');
 need([ordinary,signed,hr].every(d=>sha(d.sha256)&&Number.isSafeInteger(d.size)&&d.size>0)&&Array.isArray(hr.history)&&hr.history.some(x=>x.id===hr.id)&&hr.history.every((x,i)=>id(x.id)&&x.version===i+1&&Object.keys(x).length===3&&Number.isFinite(Date.parse(x.createdAt))),'EXPECTED_BYTES_HISTORY');
 const keys=['reader','signedReader','hrReader','restricted'];need(keys.every(k=>id(actors[k]?.id)&&actors[k].companyId===company&&typeof actors[k].email==='string'&&typeof actors[k].password==='string'&&Array.isArray(actors[k].roles)&&actors[k].roles.length>0&&!actors[k].roles.includes('SYS_ADMIN')&&Array.isArray(actors[k].permissions))&&new Set(keys.map(k=>actors[k].id)).size===4,'ACTORS');
 need(actors.reader.permissions.includes('documents.document.view')&&actors.signedReader.permissions.includes('documents.document.view')&&actors.signedReader.permissions.includes('subcontracts.agreement.view')&&actors.restricted.permissions.includes('documents.document.view')&&actors.hrReader.permissions.includes('hr.documents.view')&&!actors.restricted.permissions.includes('hr.documents.view')&&!actors.restricted.permissions.includes('projects.access_all'),'ROLE_SCOPE');
 const call=async(path,s,method='GET',body)=>{const r=await fetchImpl(target.api+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',...(s?{Cookie:s.cookie}:{}),...(s?.csrf&&method==='POST'?{'X-CSRF-Token':s.csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});need(!r.redirected,'REDIRECT');return r;};
 const deny=async(path,s,statuses=[403,404])=>{const r=await call(path,s);await discard(r);need(statuses.includes(r.status),'DENIAL');};
 const live={};
 try{
 for(const k of keys){const a=actors[k],r=await call('/auth/login',null,'POST',{email:a.email,password:a.password});const cookie=r.headers.get('set-cookie')?.split(';',1)[0];const s={cookie,csrf:null};if(cookie&&/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(cookie))sessions.push(s);need(r.status===201&&sessions.includes(s),'LOGIN');const data=await json(r);s.csrf=data?.csrfToken;need(typeof s.csrf==='string'&&s.csrf.length>0,'CSRF');const me=await call('/auth/me',s);need(me.status===200,'ME');const m=await json(me);need(m?.id===a.id&&m.companyId===company&&same(sorted(m.roleCodes),sorted(a.roles))&&same(sorted(m.permissions),sorted(a.permissions)),'ACTOR_DRIFT');if(onIssuedSession)await onIssuedSession(bindM7Session(a.id,s.cookie,s.csrf));live[k]=s;}
 need(new Set(sessions.map(s=>s.cookie)).size===4,'SESSION_ALIAS');
 const p='/documents/projects/'+project, h='/hr/companies/'+company+'/employees/'+employee+'/documents', hd=h+'/'+hr.id+'/download';
 await bytes(await call(p+'/'+ordinary.id+'/download',live.reader),ordinary,false);
 await bytes(await call(p+'/targets/SUBCONTRACT_AGREEMENT/'+signed.agreementId+'/'+signed.id+'/download',live.signedReader),signed,false);
 const history=await call(h,live.hrReader);need(history.status===200,'HISTORY_STATUS');const data=await json(history);need(data?.nextCursor===null&&Array.isArray(data.items)&&same(data.items.map(x=>[x.id,x.version,x.createdAt]),hr.history.map(x=>[x.id,x.version,x.createdAt]))&&data.items.every(x=>Object.keys(x).length===3),'HISTORY_DRIFT');
 if(mode==='correct')await bytes(await call(hd,live.hrReader),hr,true);else await deny(hd,live.hrReader,[503]);
 await deny(hd,null,[401]);await deny(h,live.restricted);await deny(hd,live.restricted);await deny('/hr/companies/'+foreignCompany+'/employees/'+employee+'/documents/'+hr.id+'/download',live.hrReader);await deny('/hr/companies/'+company+'/employees/'+otherEmployee+'/documents/'+hr.id+'/download',live.hrReader);await deny(p+'/'+hr.documentId+'/download',live.reader);await deny('/documents/projects/'+foreignProject,live.reader);await deny('/documents/projects/'+unassignedProject,live.restricted);
 passed=true;
 }finally{
 for(const s of sessions){try{if(!s.csrf){const r=await call('/auth/csrf',s);need(r.status===200,'CSRF_RECOVERY');s.csrf=(await json(r))?.csrfToken;}const r=await call('/auth/logout',s,'POST',{});await discard(r);need([204,401].includes(r.status),'LOGOUT');await deny('/auth/me',s,[401]);}catch{cleanup=false;}finally{s.cookie=null;s.csrf=null;}}
 }
 await bind();need(same(before,snapshot(await readPreservation())),'PRESERVATION_DRIFT');need(cleanup,'SESSION_CLEANUP');
 return {status:'M7_VERIFICATION_PREPARATION_CHECK_PASS',keyMode:mode,authenticatedActors:4,ordinaryAndSignedBytesVerified:true,hrPlaintextVerified:mode==='correct',keyDenialVerified:mode!=='correct',maskedHistoryVerified:true,denials:8,sessionsRevoked:true,preservationMatched:true,actualMilestoneAccepted:false,productionAuthorized:false};
 }catch(e){if(typeof e?.message==='string'&&/^M7_VERIFY_[A-Z_]+$/.test(e.message))failure=e.message;return {status:'M7_VERIFICATION_BLOCKED',code:cleanup?failure:'M7_VERIFY_SESSION_CLEANUP',sessionsRevoked:cleanup&&sessions.length>0,checksCompleted:passed,actualMilestoneAccepted:false,productionAuthorized:false};}
}
