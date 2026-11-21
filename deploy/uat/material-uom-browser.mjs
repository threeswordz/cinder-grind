// Actual built React and authenticated API. Native disposable or guarded synthetic Mac coordinator only.
import assert from 'node:assert/strict';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(),{safeCode:code});};
const panel='[data-testid="material-uom-panel"]',definition='[data-testid="material-uom-definition"]',previewForm='[data-testid="material-uom-preview-form"]';
async function evaluate(p,s,fn,arg){const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);demand(!r.exceptionDetails&&r.result?.type!=='error','UOM_BROWSER_EVALUATION_FAILED');return r.result?.value;}
async function until(p,s,fn,arg,code){const end=Date.now()+20000;while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,100));}demand(false,code);}
async function click(p,s,label,scope=panel){await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' button')].some(e=>e.textContent===label&&!e.disabled),{label,scope},'UOM_BROWSER_ACTION_MISSING');await evaluate(p,s,({label,scope})=>{[...document.querySelectorAll(scope+' button')].find(e=>e.textContent===label&&!e.disabled).click();return true;},{label,scope});}
async function field(p,s,label,value,scope=panel){await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(l=>l.textContent.replace(/\s*\*$/,'').trim()===label),{label,scope},'UOM_BROWSER_FIELD_MISSING');await evaluate(p,s,({label,value,scope})=>{const l=[...document.querySelectorAll(scope+' label')].find(l=>l.textContent.replace(/\s*\*$/,'').trim()===label),e=document.getElementById(l.htmlFor);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;},{label,value,scope});}
async function select(p,s,label,value,scope=panel){await until(p,s,({label,scope})=>[...document.querySelectorAll(scope+' label')].some(l=>l.textContent.replace(/\s*\*$/,'').trim()===label),{label,scope},'UOM_BROWSER_SELECT_MISSING');await evaluate(p,s,({label,scope})=>{const l=[...document.querySelectorAll(scope+' label')].find(l=>l.textContent.replace(/\s*\*$/,'').trim()===label);document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;},{label,scope});await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(e=>e.getAttribute('data-value')===value),value,'UOM_BROWSER_OPTION_MISSING');await evaluate(p,s,value=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===value).click();return true;},value);}

export async function executeMaterialUomBrowser(p,binding,db){
 const {api:API,web:WEB,fixture:f}=structuredClone(binding);
 demand(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&((API==='http://127.0.0.1:31359/api/v1'&&WEB==='http://127.0.0.1:44359')||(API==='http://127.0.0.1:31319/api/v1'&&WEB==='http://127.0.0.1:44319'))||process.platform==='darwin'&&API==='http://127.0.0.1:33071/api/v1'&&WEB==='http://127.0.0.1:44171','UOM_BROWSER_ORIGINS_REFUSED');
 assert.equal(await db.materialUomBasis.count({where:{materialId:f.material.id}}),0);
 const original=await db.material.findUniqueOrThrow({where:{id:f.material.id}}),stock=await db.stockTransaction.count({where:{companyId:f.company.id}});
 let dropped=false,phase='START';const violations=[],closing=new Set(),route='/api/v1/master-data/material-conversions/'+f.material.id;
 const intercept=e=>{
  if(e.method!=='Fetch.requestPaused')return;
  if(e.params.responseStatusCode!==undefined){
   const drop=e.params.responseStatusCode===201&&!dropped&&new URL(e.params.request.url).pathname===route+'/revisions';if(drop)dropped=true;
   p.send(drop?'Fetch.failRequest':'Fetch.continueRequest',drop?{requestId:e.params.requestId,errorReason:'Failed'}:{requestId:e.params.requestId},e.sessionId).catch(()=>violations.push('UOM_BROWSER_RESPONSE_CONTROL_FAILED'));return;
  }
  let allowed=false;try{const u=new URL(e.params.request.url),method=e.params.request.method;allowed=u.origin===WEB&&method==='GET'||u.origin===new URL(API).origin&&(['GET','OPTIONS'].includes(method)||method==='POST'&&['/api/v1/auth/login','/api/v1/auth/logout',route+'/basis',route+'/revisions',route+'/preview'].includes(u.pathname));}catch{}
  if(!allowed)violations.push('UOM_BROWSER_UNDECLARED_WRITE');
  p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:e.params.requestId}:{requestId:e.params.requestId,errorReason:'BlockedByClient'},e.sessionId).catch(()=>{if(!closing.has(e.sessionId))violations.push('UOM_BROWSER_REQUEST_CONTROL_FAILED');});
 };
 p.listeners.add(intercept);
 try{
  async function actor(key,work){
   phase=key.toUpperCase()+'_LOGIN';const a=f.actors[key],context=(await p.send('Target.createBrowserContext')).browserContextId;
   let s;try{
    const target=(await p.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;s=(await p.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
    await p.send('Page.enable',{},s);await p.send('Runtime.enable',{},s);await p.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},s);
    await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'},{urlPattern:'*'+route+'/revisions',requestStage:'Response'}]},s);
    await p.send('Page.navigate',{url:WEB},s);await until(p,s,()=>Boolean(document.querySelector('input[type="password"]')),null,'UOM_BROWSER_LOGIN_FORM_MISSING');
    await evaluate(p,s,a=>{for(const [type,value]of[['email',a.email],['password',a.password]]){const e=document.querySelector('input[type="'+type+'"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}document.querySelector('form').requestSubmit();return true;},{email:a.email,password:a.password});
    await until(p,s,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'UOM_BROWSER_LOGIN_FAILED');
    demand(await evaluate(p,s,async({api,id,companyId})=>{const r=await fetch(api+'/auth/me',{credentials:'include'}),v=await r.json();return r.status===200&&v.data.id===id&&v.data.companyId===companyId;},{api:API,id:a.userId,companyId:f.company.id}),'UOM_BROWSER_WRONG_ACTOR');
    phase=key.toUpperCase()+'_WORKSPACE';
    await until(p,s,()=>[...document.querySelectorAll('nav [role="button"]')].some(e=>e.textContent==='Master Data'),null,'UOM_BROWSER_NAV_MISSING');
    await evaluate(p,s,()=>{[...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Master Data').click();return true;});
    // Real prototype actors also view other masters; their first available tab
    // is not necessarily Materials, unlike the isolated foundation fixture.
    await until(p,s,()=>[...document.querySelectorAll('[role="tab"]')].some(e=>e.textContent==='Materials'),null,'UOM_BROWSER_MATERIAL_TAB_MISSING');
    await evaluate(p,s,()=>{[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent==='Materials').click();return true;});
    await until(p,s,({code,name})=>[...document.querySelectorAll('main .MuiCard-root')].some(c=>[...c.querySelectorAll('p')].some(e=>e.textContent===code+' — '+name)),f.material,'UOM_BROWSER_MATERIAL_MISSING');
    await evaluate(p,s,({code,name})=>{const card=[...document.querySelectorAll('main .MuiCard-root')].find(c=>[...c.querySelectorAll('p')].some(e=>e.textContent===code+' — '+name));[...card.querySelectorAll('button')].find(e=>e.textContent==='UOM · หน่วย · 單位').click();return true;},f.material);
    await until(p,s,()=>Boolean(document.querySelector('[data-testid="material-uom-panel"]'))||[...document.querySelectorAll('main [role="alert"]')].some(e=>e.textContent.includes('Unable to complete this action')),null,'UOM_BROWSER_PANEL_MISSING');
    await work(s);
    phase=key.toUpperCase()+'_LOGOUT';
    const cookie=(await p.send('Storage.getCookies',{browserContextId:context})).cookies.find(c=>c.name==='erp_session'&&c.domain==='127.0.0.1');demand(cookie?.value,'UOM_BROWSER_COOKIE_MISSING');
    await click(p,s,'Sign out','header');await until(p,s,()=>Boolean(document.querySelector('input[type="password"]')),null,'UOM_BROWSER_LOGOUT_FAILED');
    const revoked=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},redirect:'error',signal:AbortSignal.timeout(10000)});assert.equal(revoked.status,401);await revoked.body?.cancel();
   }finally{if(s)closing.add(s);await p.send('Target.disposeBrowserContext',{browserContextId:context});}
  }
  await actor('maker',async s=>{
   phase='PREPARE';await select(p,s,'Stock unit (pinned)',f.each.id,definition);await field(p,s,'Reason','Explicit synthetic browser stock basis',definition);await click(p,s,'Prepare stock unit',definition);
   await until(p,s,()=>document.querySelector('[data-testid="material-uom-panel"]')?.textContent.includes('Version 1'),null,'UOM_BROWSER_BASIS_NOT_CREATED');
   phase='REVISION_RESPONSE_LOSS';await select(p,s,'Entered unit',f.carton.id,definition);await field(p,s,'Stock units in ratio','20',definition);await field(p,s,'Entered units in ratio','1',definition);await field(p,s,'Effective from','2026-01-01',definition);await field(p,s,'Reason','First browser exact definition',definition);await click(p,s,'Append definition revision',definition);
   await until(p,s,()=>[...document.querySelectorAll('[data-testid="material-uom-panel"] [role="alert"]')].some(e=>e.textContent.includes('Unable to complete this action')),null,'UOM_BROWSER_RESPONSE_LOSS_NOT_VISIBLE');assert.equal(await db.materialUomRevision.count({where:{materialId:f.material.id}}),1);
   await click(p,s,'Retry same request');await until(p,s,()=>document.querySelector('[data-testid="material-uom-panel"]')?.textContent.includes('Version 2'),null,'UOM_BROWSER_RETRY_FAILED');assert.equal(await db.materialUomRevision.count({where:{materialId:f.material.id}}),1);
   phase='PREVIEW';await field(p,s,'Conversion business date','2026-11-18',previewForm);await field(p,s,'Entered quantity','2',previewForm);await click(p,s,'Preview exact quantity',previewForm);
   await until(p,s,()=>document.querySelector('[data-testid="material-uom-preview"]')?.textContent.includes('40.0000 EA'),null,'UOM_BROWSER_EXACT_PREVIEW_MISSING');
   await field(p,s,'Entered quantity','3',previewForm);await until(p,s,()=>!document.querySelector('[data-testid="material-uom-preview"]'),null,'UOM_BROWSER_STALE_PREVIEW_VISIBLE');await field(p,s,'Entered quantity','2',previewForm);
   phase='FUTURE_REVISION';await field(p,s,'Stock units in ratio','24',definition);await field(p,s,'Effective from','2027-01-01',definition);await field(p,s,'Reason','Future browser definition',definition);await click(p,s,'Append definition revision',definition);
   await until(p,s,()=>document.querySelector('[data-testid="material-uom-panel"]')?.textContent.includes('Version 3'),null,'UOM_BROWSER_FUTURE_REVISION_MISSING');
   await click(p,s,'Preview exact quantity',previewForm);await until(p,s,()=>document.querySelector('[data-testid="material-uom-preview"]')?.textContent.includes('40.0000 EA'),null,'UOM_BROWSER_OLD_DATE_CHANGED');
   await field(p,s,'Conversion business date','2027-01-01',previewForm);await click(p,s,'Preview exact quantity',previewForm);await until(p,s,()=>document.querySelector('[data-testid="material-uom-preview"]')?.textContent.includes('48.0000 EA'),null,'UOM_BROWSER_NEW_DATE_NOT_SELECTED');
   phase='LOCALES';for(const [label,title]of [['ไทย','การแปลงหน่วยวัสดุ'],['繁中','材料單位換算'],['EN','Material unit conversions']]){
    await evaluate(p,s,()=>{document.querySelector('header [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});await until(p,s,label=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent===label),label,'UOM_BROWSER_LOCALE_MENU');await evaluate(p,s,label=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent===label).click();return true;},label);await until(p,s,title=>document.querySelector('[data-testid="material-uom-panel"]')?.textContent.includes(title),title,'UOM_BROWSER_LOCALE_MISSING');
   }
   phase='MOBILE';await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);await until(p,s,()=>{const e=document.querySelector('[data-testid="material-uom-panel"]');return innerWidth===390&&e.getBoundingClientRect().right<=innerWidth+2&&e.scrollWidth<=e.clientWidth+2;},null,'UOM_BROWSER_MOBILE_OVERFLOW');
  });
  await actor('viewer',async s=>{demand(await evaluate(p,s,()=>!document.querySelector('[data-testid="material-uom-definition"]')),'UOM_BROWSER_VIEWER_CAN_EDIT');await select(p,s,'Entered unit',f.carton.id,previewForm);await field(p,s,'Conversion business date','2026-11-18',previewForm);await field(p,s,'Entered quantity','2',previewForm);await click(p,s,'Preview exact quantity',previewForm);await until(p,s,()=>document.querySelector('[data-testid="material-uom-preview"]')?.textContent.includes('40.0000 EA'),null,'UOM_BROWSER_READER_PREVIEW_FAILED');});
  await actor('noConversion',async s=>{demand(await evaluate(p,s,()=>!document.querySelector('[data-testid="material-uom-definition"]')),'UOM_BROWSER_LEGACY_MAINTAINER_CAN_EDIT');});
  await actor('technical',async s=>{demand(await evaluate(p,s,()=>!document.querySelector('[data-testid="material-uom-panel"]')&&[...document.querySelectorAll('main [role="alert"]')].some(e=>e.textContent.includes('Unable to complete this action'))),'UOM_BROWSER_TECHNICAL_AUTHORITY_ACCEPTED');});
  assert.equal(dropped,true);assert.equal(await db.materialUomRevision.count({where:{materialId:f.material.id}}),2);assert.deepEqual(await db.material.findUniqueOrThrow({where:{id:f.material.id}}),original);assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),stock);assert.deepEqual(violations,[]);
 }catch(e){throw Object.assign(new Error(),{safeCode:'UOM_BROWSER_'+phase+'_'+(e.safeCode??'ASSERTION_FAILED')});}finally{p.listeners.delete(intercept);}
}
