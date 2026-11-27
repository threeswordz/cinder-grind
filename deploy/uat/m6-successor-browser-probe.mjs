// Reuse existing successor sessions. No browser logins, CSRF rotations, or
// business writes; the common session owner revokes cookies after this probe.
const API='http://127.0.0.1:33072',WEB='http://127.0.0.1:44172';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_BROWSER_PROBE_'+c),{safeCode:'M6_BROWSER_PROBE_'+c});};
export function allowedSuccessorBrowserRequest(url,method){try{const u=new URL(url);return !u.username&&!u.password&&!u.hash&&['GET','HEAD','OPTIONS'].includes(method)&&(u.origin===WEB||u.origin===API&&u.pathname.startsWith('/api/v1/')&&!/^\/api\/v1\/auth\/(?:csrf|login|logout)(?:\/|$)/.test(u.pathname));}catch{return false;}}
export function expectedSuccessorModules(permissions){need(Array.isArray(permissions),'PERMISSIONS');return Object.fromEntries([['BOQ & Budget',permissions.some(p=>p.startsWith('budget.'))],['Inventory',permissions.some(p=>p.startsWith('inventory.'))],['Site Execution',permissions.some(p=>p.startsWith('site.'))],['Subcontracts',permissions.some(p=>p.startsWith('subcontracts.'))],['Employees & HR',permissions.includes('hr.employment.view')]]);}
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function evaluate(p,s,fn,arg){const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);need(!r.exceptionDetails&&r.result&&r.result.type!=='error','EVALUATION');return r.result.value;}
async function until(p,s,fn,arg,code){const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await pause(200);}need(false,code);}
export async function probeSuccessorBrowser({protocol:p,binding,sessions,verifyRuntime}){
 need(p?.listeners instanceof Set&&typeof p.send==='function'&&typeof verifyRuntime==='function'&&sessions instanceof Map&&sessions.size===11&&binding.actorIds.length===11,'CONTEXT');
 const violations=[],closing=new Set();let count=0,opened=0;
 const intercept=m=>{if(m.method!=='Fetch.requestPaused')return;const {requestId,request}=m.params,allowed=allowedSuccessorBrowserRequest(request.url,request.method);if(!allowed)violations.push('OUTBOUND_OR_WRITE');p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},m.sessionId).catch(()=>{if(!closing.has(m.sessionId))violations.push('INTERCEPTION');});};p.listeners.add(intercept);
 try{for(const [key,a] of Object.entries(binding.roster)){
   await verifyRuntime();const cookie=sessions.get(a.userId)?.cookie;need(/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(cookie??''),'COOKIE');const {browserContextId}=await p.send('Target.createBrowserContext');let s;
   try{await p.send('Storage.setCookies',{browserContextId,cookies:[{name:'erp_session',value:cookie.slice('erp_session='.length),url:API+'/',path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]});const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});s=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
    for(const method of ['Page.enable','Runtime.enable'])await p.send(method,{},s);await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false},s);await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);await p.send('Page.navigate',{url:WEB},s);
    await until(p,s,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'WORKSPACE');
    need(await evaluate(p,s,async({api,id,company,roles,permissions})=>{const r=await fetch(api+'/api/v1/auth/me',{credentials:'include',redirect:'error'});if(!r.ok)return false;const u=(await r.json()).data;return u.id===id&&u.companyId===company&&JSON.stringify([...u.roleCodes].sort())===JSON.stringify(roles)&&JSON.stringify([...u.permissions].sort())===JSON.stringify(permissions);},{api:API,id:a.userId,company:a.companyId,roles:a.roleCodes,permissions:a.permissions}),'IDENTITY');
    const expected=expectedSuccessorModules(a.permissions);need(await evaluate(p,s,expected=>{const labels=[...document.querySelectorAll('nav [role="button"]')].map(e=>e.textContent.trim());return Object.entries(expected).every(([label,visible])=>labels.includes(label)===visible);},expected),'NAVIGATION');
    for(const [label,visible] of Object.entries(expected)){if(!visible)continue;need(await evaluate(p,s,label=>{const e=[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent.trim()===label);if(!e)return false;e.click();return true;},label),'NAVIGATION_CLICK');await until(p,s,label=>Boolean(document.querySelector('main'))&&[...document.querySelectorAll('nav [aria-current="page"]')].some(e=>e.textContent.trim()===label),label,'MODULE_RENDER');opened++;}
    need(await evaluate(p,s,()=>!document.body.textContent.includes('SYNTHETIC_PRIVATE_ID')&&!document.body.textContent.includes('SYNTHETIC_ACCOUNT'),null),'PRIVATE_VALUE');count++;
   }finally{if(s)closing.add(s);await p.send('Target.disposeBrowserContext',{browserContextId});}
   need(violations.length===0,'NETWORK');
 }}finally{p.listeners.delete(intercept);}
 need(count===11&&violations.length===0,'COVERAGE');return {status:'M6_SUCCESSOR_BROWSER_WORKSPACE_PROBE_PASS',actors:count,modulesOpened:opened,additionalLogins:0,readOnly:true,fullAffectedBrowserJourneysVerified:false,productionAuthorized:false};
}
