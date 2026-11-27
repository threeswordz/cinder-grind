// Real successor browser action using a caller-owned authenticated KOH session.
// No login/logout, uploads, reveals, direct API download, or retained access.
import {constants} from 'node:fs';
import {open,lstat,realpath,mkdtemp,readdir,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {allowedSuccessorBrowserRequest} from './m6-successor-browser-probe.mjs';
import {verifyHrBrowserDownload} from './m6-hr-download-proof.mjs';
const API='http://127.0.0.1:33072',WEB='http://127.0.0.1:44172';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_HR_BROWSER_'+c),{safeCode:'M6_HR_BROWSER_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
export function createHrDownloadGate(binding){
 need([binding?.companyId,binding?.employeeId,binding?.attachmentId].every(uuid)&&binding.path==='/hr/companies/'+binding.companyId+'/employees/'+binding.employeeId+'/documents/'+binding.attachmentId+'/download','BINDING');
 let armed=false,count=0;const base='/api/v1/hr/companies/'+binding.companyId,employee=base+'/employees/'+binding.employeeId,download=API+'/api/v1'+binding.path;
 return {arm(){need(!armed&&count===0,'NO_REPLAY');armed=true;},count:()=>count,allow(url,method){
  if(typeof url==='string'&&url.startsWith('blob:'))return armed&&count===1&&method==='GET'&&/^blob:http:\/\/127\.0\.0\.1:44172\/[a-f0-9-]{36}$/.test(url);
  if(!allowedSuccessorBrowserRequest(url,method))return false;const u=new URL(url);
  if(u.origin===WEB)return true;
  if(u.href===download){if(method==='OPTIONS')return armed&&count===0;if(!armed||method!=='GET'||count!==0)return false;count++;return true;}
  if(/\/(?:download|export|print)(?:\/|$)/.test(u.pathname))return false;
  if(!u.pathname.startsWith('/api/v1/hr/'))return true;
  return ['/api/v1/hr/companies',base+'/employees',base+'/document-types',...['/employment','/documents','/private/identity','/private/identity/history','/private/bank','/private/bank/history'].map(s=>employee+s)].includes(u.pathname);
 }};
}
async function readOwnedFile(root,guid,expectedSize){
 need(typeof guid==='string'&&/^[a-f0-9-]{36}$/.test(guid)&&Number.isSafeInteger(expectedSize)&&expectedSize>0&&expectedSize<=1048576,'FILE');const p=join(root,guid);need(await realpath(p)===p&&JSON.stringify(await readdir(root))===JSON.stringify([guid]),'DOWNLOAD_FILES');
 const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const a=await f.stat();need(a.isFile()&&a.uid===process.getuid()&&a.nlink===1&&a.size===expectedSize,'FILE');const b=await f.readFile(),z=await f.stat();need(b.length===expectedSize&&['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===z[k]),'FILE_DRIFT');return b;}finally{await f.close();}
}
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
export async function runHrDownloadBrowser({protocol:p,binding,actor,session,stage,authorization,verifyRuntime}){
 need(authorization?.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedHrDownloadAudit===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORIZATION');
 need(p?.listeners instanceof Set&&typeof p.send==='function'&&typeof verifyRuntime==='function'&&actor?.userId===binding.actorId&&actor.companyId===binding.companyId&&actor.permissions?.includes('hr.documents.view')&&actor.permissions.includes('hr.employment.view')&&/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(session?.cookie??''),'ACTOR');
 need(typeof stage==='string'&&resolve(stage)===stage&&await realpath(stage)===stage,'STAGE');const st=await lstat(stage);need(st.isDirectory()&&st.uid===process.getuid()&&!(st.mode&0o077),'STAGE');
 const gate=createHrDownloadGate(binding),directory=await mkdtemp(join(stage,'hr-download-'));let context,s,frame,download,response,requestIdForDownload,complete=false,closing=false,failed=false;
 const url=API+'/api/v1'+binding.path;
 const listener=m=>{if(m.method==='Fetch.requestPaused'&&m.sessionId===s){const {requestId,request}=m.params,allowed=gate.allow(request.url,request.method);if(!allowed&&!closing)failed=true;p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},s).catch(()=>{if(!closing)failed=true;});}
  if(m.method==='Network.requestWillBeSent'&&m.sessionId===s&&m.params.request.url===url&&m.params.request.method==='GET'){if(requestIdForDownload)failed=true;requestIdForDownload=m.params.requestId;}
  if(m.method==='Network.responseReceived'&&m.sessionId===s&&m.params.requestId===requestIdForDownload&&m.params.response.url===url){if(response)failed=true;const r=m.params.response;response={status:r.status,headers:Object.fromEntries(Object.entries(r.headers).map(([k,v])=>[k.toLowerCase(),String(v)]))};}
  if(m.method==='Browser.downloadWillBegin'){if(download||m.params.frameId!==frame||!m.params.url.startsWith('blob:'+WEB+'/'))failed=true;download=m.params;}
  if(m.method==='Browser.downloadProgress'){if(!download||m.params.guid!==download.guid||m.params.state==='canceled')failed=true;else if(m.params.state==='completed')complete=true;}
 };
 const evaluate=async(fn,arg)=>{const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);need(!r.exceptionDetails&&r.result?.type!=='error','EVALUATION');return r.result?.value;};
 const until=async(fn,code)=>{const end=Date.now()+20000;while(Date.now()<end){need(!failed,'NETWORK');if(await fn())return;await pause(100);}need(false,code);};
 try{await verifyRuntime();({browserContextId:context}=await p.send('Target.createBrowserContext'));await p.send('Storage.setCookies',{browserContextId:context,cookies:[{name:'erp_session',value:session.cookie.slice(12),url:API+'/',path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]});
  const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId:context});s=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;p.listeners.add(listener);
  for(const method of ['Page.enable','Runtime.enable','Network.enable'])await p.send(method,{},s);await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},s);await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
  await p.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId:context,downloadPath:directory,eventsEnabled:true});({frameId:frame}=await p.send('Page.navigate',{url:WEB},s));
  await until(()=>evaluate(()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null),'WORKSPACE');
  need(await evaluate(async({api,id,company})=>{const r=await fetch(api+'/api/v1/auth/me',{credentials:'include',redirect:'error'});if(!r.ok)return false;const u=(await r.json()).data;return u.id===id&&u.companyId===company&&u.permissions.includes('hr.documents.view');},{api:API,id:actor.userId,company:actor.companyId}),'IDENTITY');
  need(await evaluate(()=>{const a=[...document.querySelectorAll('nav [role="button"]')].filter(e=>e.textContent.trim()==='Employees & HR');if(a.length!==1)return false;a[0].click();return true;},null),'HR_NAVIGATION');
  await until(()=>evaluate(code=>{const a=[...document.querySelectorAll('main tr')].filter(r=>r.querySelector('td')?.textContent.trim()===code);return a.length===1;},binding.employeeCode),'EMPLOYEE');
  need(await evaluate(code=>{const a=[...document.querySelectorAll('main tr')].filter(r=>r.querySelector('td')?.textContent.trim()===code);if(a.length!==1)return false;a[0].click();return true;},binding.employeeCode),'EMPLOYEE_SELECT');
  const ready=()=>{const h=[...document.querySelectorAll('main h6')].filter(e=>e.textContent.trim()==='Protected HR documents');if(h.length!==1)return false;const panel=h[0].parentElement;const buttons=[...panel.querySelectorAll('button')].filter(e=>e.textContent.trim()==='Download'&&!e.disabled);return buttons.length===1&&panel.textContent.includes('Version #1')&&!panel.textContent.includes('SYNTHETIC_PRIVATE_ID')&&!panel.textContent.includes('SYNTHETIC_ACCOUNT');};
  await until(()=>evaluate(ready,null),'DOCUMENT_CONTROL');await verifyRuntime();gate.arm();need(await evaluate(()=>{const h=[...document.querySelectorAll('main h6')].filter(e=>e.textContent.trim()==='Protected HR documents');if(h.length!==1)return false;const a=[...h[0].parentElement.querySelectorAll('button')].filter(e=>e.textContent.trim()==='Download'&&!e.disabled);if(a.length!==1)return false;a[0].click();return true;},null),'DOWNLOAD_CLICK');
  await until(()=>complete&&response&&download,'DOWNLOAD_COMPLETE');need(!failed,'NETWORK');const bytes=await readOwnedFile(directory,download.guid,binding.expectedSize);try{const proof=verifyHrBrowserDownload(binding,{...response,name:download.suggestedFilename,bytes,requests:gate.count()});await verifyRuntime();return proof;}finally{bytes.fill(0);}
 }finally{closing=true;try{if(context)await p.send('Target.disposeBrowserContext',{browserContextId:context});}finally{p.listeners.delete(listener);await rm(directory,{recursive:true,force:true});}}
}
