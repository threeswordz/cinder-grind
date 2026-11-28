// Reopen completed physical/certification records in two real isolated browser contexts.
import {allowSubcontractBrowserRequest,verifySubcontractBrowserObservation} from './m6-subcontract-browser-proof.mjs';
const API='http://127.0.0.1:33072',WEB='http://127.0.0.1:44172';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_SUBCONTRACT_BROWSER_'+c),{safeCode:'M6_SUBCONTRACT_BROWSER_'+c});};
const pause=ms=>new Promise(ok=>setTimeout(ok,ms));
async function evaluate(p,s,fn,arg){const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);need(!r.exceptionDetails&&r.result&&r.result.type!=='error','EVALUATION');return r.result.value;}
// Runs inside the browser. Return only bound UI evidence, never page contents.
export function observeSubcontractPage(b){
 const panel=document.querySelector('[data-testid="physical-acceptance"]'),evidence=document.querySelector('[data-testid="physical-evidence"]');
 const texts=root=>[...(root??document).querySelectorAll('.MuiTypography-root')].map(e=>e.textContent.trim().replace(/\s+/g,' '));
 const physicalTexts=texts(panel),mainTexts=texts(document.querySelector('main'));
 const quantities=physicalTexts.map(t=>/^Accepted: (\d+(?:\.\d+)?) · Held: (\d+(?:\.\d+)?)(?: · (.*))?$/.exec(t)).filter(Boolean);
 const q=quantities.length===1?quantities[0]:null;
 const money=(label,list=mainTexts)=>{const values=list.map(t=>new RegExp('^'+label+': THB (\\d+(?:\\.\\d+)?)$').exec(t)).filter(Boolean);return values.length===1?values[0][1]:null;};
 const confirmed=physicalTexts.map(t=>/Confirmed accepted amount: THB (\d+(?:\.\d+)?)$/.exec(t)).filter(Boolean);
 const finance=mainTexts.includes('Finance Payment references'),allocations=[];
 for(const element of document.querySelectorAll('main .MuiTypography-root')){
  const m=/^Allocated THB (\d+(?:\.\d+)?) · Payment date \d{4}-\d{2}-\d{2}$/.exec(element.textContent.trim().replace(/\s+/g,' '));if(!m)continue;
  const card=element.closest('.MuiCard-root'),identity=card&&texts(card).map(t=>/^(.+) · ([A-Z_]+)$/.exec(t)).filter(Boolean);
  if(identity?.length===1)allocations.push({number:identity[0][1],state:identity[0][2],amount:m[1]});else allocations.push({number:null,state:null,amount:m[1]});
 }
 const certChip=[...document.querySelectorAll('main .MuiChip-clickable')].some(e=>e.textContent.trim()===b.certificationNumber+' · APPROVED');
 return {physical:Boolean(panel),capture:Boolean(document.querySelector('[data-testid="physical-capture"]')),decide:Boolean(document.querySelector('[data-testid="physical-decision"]')),evidence:Boolean(evidence&&[...evidence.querySelectorAll('button')].some(e=>e.textContent.trim()==='Download evidence · '+b.documentName)),accepted:q?.[1]??null,held:q?.[2]??null,rework:q?.[3]==='Rework required',explicitAmount:confirmed.length===1?confirmed[0][1]:null,certification:mainTexts.includes('Payment Certification & retention withholding'),approved:certChip,gross:money('Certified gross'),retained:money('Withheld retention'),net:money('Net certified'),finance,financeError:document.querySelector('main')?.textContent.includes('Unable to load authorized Finance Payment references.')??true,emptyFinance:mainTexts.includes('No Finance Payment allocation is linked to this Certification.'),allocations};
}
export async function runSubcontractBrowser({protocol:p,binding,roster,sessions,verifyRuntime,authorization}){
 need(authorization?.database==='m6_successor_rehearsal'&&authorization.ownerAuthorizedSubcontractReadback===true&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORIZATION');
 need(p?.listeners instanceof Set&&typeof p.send==='function'&&typeof verifyRuntime==='function'&&sessions instanceof Map&&sessions.size===2&&['BEN','NANCY'].every(k=>roster[k]?.companyId===binding.companyId&&sessions.has(roster[k].userId)),'CONTEXT');
 let count=0;const closed=new Set();
 for(const role of ['BEN','NANCY']){
  const actor=roster[role],cookie=sessions.get(actor.userId)?.cookie;need(/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(cookie??''),'COOKIE');await verifyRuntime();
  const {browserContextId}=await p.send('Target.createBrowserContext');let s,failed=false;const successes=new Set(),tracked=new Map();
  const listener=m=>{if(m.sessionId!==s)return;
   if(m.method==='Fetch.requestPaused'){const {requestId,request}=m.params;let ok=allowSubcontractBrowserRequest(request.url,request.method,binding);if(role==='BEN'&&request.url.includes('/certifications'))ok=false;if(!ok&&!closed.has(s))failed=true;p.send(ok?'Fetch.continueRequest':'Fetch.failRequest',ok?{requestId}:{requestId,errorReason:'BlockedByClient'},s).catch(()=>{if(!closed.has(s))failed=true;});}
   if(m.method==='Network.requestWillBeSent'&&m.params.request.method==='GET')tracked.set(m.params.requestId,m.params.request.url);
   if(m.method==='Network.responseReceived'&&tracked.get(m.params.requestId)===m.params.response.url&&m.params.response.status===200)successes.add(m.params.response.url);
  };p.listeners.add(listener);
  const until=async(fn,arg,code)=>{const end=Date.now()+20000;while(Date.now()<end){need(!failed,role+'_NETWORK');if(await evaluate(p,s,fn,arg))return;await pause(100);}need(false,role+'_'+code);};
  const click=async(selector,label)=>{const arg={selector,label};await until(({selector,label})=>[...document.querySelectorAll(selector)].some(e=>e.textContent.trim()===label&&!e.disabled),arg,'ACTION');need(await evaluate(p,s,({selector,label})=>{const e=[...document.querySelectorAll(selector)].find(e=>e.textContent.trim()===label&&!e.disabled);if(!e)return false;e.click();return true;},arg),'CLICK');};
  try{
   await p.send('Storage.setCookies',{browserContextId,cookies:[{name:'erp_session',value:cookie.slice(12),url:API+'/',path:'/',httpOnly:true,secure:false,sameSite:'Lax'}]});const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});s=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
   for(const method of ['Page.enable','Runtime.enable','Network.enable'])await p.send(method,{},s);await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},s);await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);await p.send('Page.navigate',{url:WEB},s);
   await until(()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'WORKSPACE');
   need(await evaluate(p,s,async({api,id,company,roles,permissions})=>{const r=await fetch(api+'/api/v1/auth/me',{credentials:'include',redirect:'error'});if(!r.ok)return false;const u=(await r.json()).data;return u.id===id&&u.companyId===company&&JSON.stringify([...u.roleCodes].sort())===JSON.stringify(roles)&&JSON.stringify([...u.permissions].sort())===JSON.stringify(permissions);},{api:API,id:actor.userId,company:actor.companyId,roles:actor.roleCodes,permissions:actor.permissions}),role+'_IDENTITY');
   await click('nav [role="button"]','Subcontracts');await click('[role="tablist"] button','Claims');
   await until(()=>[...document.querySelectorAll('main label')].some(e=>{const i=document.getElementById(e.htmlFor);return e.textContent==='Agreement (active or history)'&&i&&!i.disabled&&i.getAttribute('aria-disabled')!=='true';}),null,'AGREEMENT');
   need(await evaluate(p,s,()=>{const l=[...document.querySelectorAll('main label')].find(e=>e.textContent==='Agreement (active or history)');document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},null),'AGREEMENT_SELECT');
   await until(p=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===p),binding.agreementId,'AGREEMENT_OPTION');
   need(await evaluate(p,s,id=>{const e=[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===id);if(!e)return false;e.click();return true;},binding.agreementId),'AGREEMENT_CLICK');
   await until(n=>[...document.querySelectorAll('main .MuiChip-clickable')].some(e=>e.textContent.trim().startsWith(n+' · ')),binding.claimNumber,'CLAIM');
   need(await evaluate(p,s,n=>{const e=[...document.querySelectorAll('main .MuiChip-clickable')].filter(e=>e.textContent.trim().startsWith(n+' · '));if(e.length!==1)return false;e[0].click();return true;},binding.claimNumber),'CLAIM_CLICK');
   const base=API+'/api/v1/subcontracts',physical=base+'/physical/claims/'+binding.claimId,ref=base+'/certifications/'+binding.certificationId+'/finance-reference';
   const end=Date.now()+20000;let passed=false;while(Date.now()<end){need(!failed,role+'_NETWORK');const o=await evaluate(p,s,observeSubcontractPage,binding);try{verifySubcontractBrowserObservation(binding,role,o);if(successes.has(physical)&&(role==='BEN'||successes.has(ref)&&(binding.allocations.length>0||o.emptyFinance))){passed=true;break;}}catch{}await pause(100);}
   need(passed,role+'_TERMINAL_READBACK');await verifyRuntime();count++;
  }finally{if(s)closed.add(s);try{await p.send('Target.disposeBrowserContext',{browserContextId});}finally{p.listeners.delete(listener);}}
  need(!failed,role+'_NETWORK');
 }
 need(count===2,'COVERAGE');return {status:'M6_SUBCONTRACT_TERMINAL_BROWSER_PASS',actors:count,physicalAcceptedHeldVerified:true,approvedCertificationVerified:true,financeReferenceUiVerified:true,benCertificationHidden:true,businessMutationsPerformed:false,additionalLogins:0,fullAffectedBrowserJourneysVerified:false,productionAuthorized:false};
}
