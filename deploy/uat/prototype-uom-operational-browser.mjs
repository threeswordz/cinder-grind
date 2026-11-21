// Actual built React/MUI browser readback on the same preserved synthetic DB.
// View only: canonical business records were written through authenticated API;
// this verifier cannot create a plan, issue, return, approval or stock movement.
import assert from 'node:assert/strict';
import {SOURCE} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
async function evaluate(p,s,fn,arg){
 const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);
 demand(!r.exceptionDetails&&r.result?.type!=='error','UOM_OPERATIONAL_BROWSER_EVALUATION_FAILED');
 return r.result?.value;
}
async function until(p,s,fn,arg,code){
 const end=Date.now()+20000;
 while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(ok=>setTimeout(ok,100));}
 demand(false,code);
}
export async function convertedOperationalBrowser(protocol,binding,source,db){
 const b=structuredClone(binding),f=b.fixture,{api,web}=b,materialId=source?.material?.id;
 demand(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&source?.material?.code==='PROTO_UOM_NEW'&&
  f?.companyId===source?.company?.id&&b?.actors?.STORE_SITE?.userId,
  'UOM_OPERATIONAL_BROWSER_SYNTHETIC_BINDING_REFUSED');
 const [plans,issues,returns,requests,stockBefore,docsBefore,financeBefore]=await Promise.all([
  db.materialUsagePlan.findMany({where:{companyId:f.companyId,projectId:f.projectId,
   lines:{some:{materialId}}}}),
  db.materialIssue.findMany({where:{companyId:f.companyId,projectId:f.projectId,
   items:{some:{materialId}}}}),
  db.materialReturn.findMany({where:{companyId:f.companyId,projectId:f.projectId,
   items:{some:{materialId}}}}),
  db.materialRequest.findMany({where:{companyId:f.companyId,projectId:f.projectId,
   lines:{some:{materialId}}}}),
  db.stockTransaction.findMany({where:{companyId:f.companyId}}),
  db.document.findMany({where:{companyId:f.companyId}}),
  db.payment.findMany({where:{companyId:f.companyId}})
 ]);
 demand(plans.length===1&&plans[0].workPackageCode==='PROTO_UOM_CONVERTED'&&
  issues.length===2&&issues.every(i=>Boolean(i.reversedAt))&&returns.length===1&&
  Boolean(returns[0].reversedAt)&&requests.length===1&&requests[0].version===2,
  'UOM_OPERATIONAL_BROWSER_SOURCE_JOURNEYS_NOT_COMPLETE');
 const balance=await db.stockTransaction.aggregate({where:{companyId:f.companyId,materialId,
  uomId:source.each.id},_sum:{quantity:true}});
 demand(balance._sum.quantity?.toFixed(4)==='60.0000','UOM_OPERATIONAL_BROWSER_SOURCE_BALANCE_CHANGED');
 let context,session,phase='START',cookie,primary;const violations=[],closing=new Set();
 const API=new URL(api),WEB=new URL(web);
 const intercept=e=>{
  if(e.method!=='Fetch.requestPaused')return;
  let allowed=false;
  try{
   const u=new URL(e.params.request.url),m=e.params.request.method;
   allowed=u.origin===WEB.origin&&m==='GET'||
    u.origin===API.origin&&(m==='GET'||m==='OPTIONS'||
     m==='POST'&&['/api/v1/auth/login','/api/v1/auth/logout'].includes(u.pathname));
  }catch{}
  if(!allowed)violations.push('UOM_OPERATIONAL_BROWSER_UNDECLARED_WRITE_OR_ORIGIN');
  protocol.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',
   allowed?{requestId:e.params.requestId}:{requestId:e.params.requestId,errorReason:'BlockedByClient'},
   e.sessionId).catch(()=>{if(!closing.has(e.sessionId))violations.push('UOM_OPERATIONAL_BROWSER_INTERCEPT_FAILED');});
 };
 protocol.listeners.add(intercept);
 try{
  context=(await protocol.send('Target.createBrowserContext')).browserContextId;
  const target=(await protocol.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
  session=(await protocol.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
  for(const method of ['Page.enable','Runtime.enable'])await protocol.send(method,{},session);
  await protocol.send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false},session);
  await protocol.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},session);
  phase='LOGIN';await protocol.send('Page.navigate',{url:web},session);
  await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),
   null,'UOM_OPERATIONAL_BROWSER_LOGIN_FORM_MISSING');
  await evaluate(protocol,session,a=>{
   for(const [type,val]of [['email',a.email],['password',a.password]]){
    const e=document.querySelector('input[type="'+type+'"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,val);
    e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));
   }
   document.querySelector('form').requestSubmit();return true;
  },{email:b.actors.STORE_SITE.email,password:b.actors.STORE_SITE.password});
  await until(protocol,session,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),
   null,'UOM_OPERATIONAL_BROWSER_LOGIN_FAILED');
  demand(await evaluate(protocol,session,async({api,id,companyId})=>{
   const res=await fetch(api+'/auth/me',{credentials:'include'});
   return res.status===200&&(await res.json()).data.id===id&&(await (await fetch(api+'/auth/me',{credentials:'include'})).json()).data.companyId===companyId;
  },{api,id:b.actors.STORE_SITE.userId,companyId:f.companyId}),
   'UOM_OPERATIONAL_BROWSER_WRONG_SCOPE');
  phase='INVENTORY';
  await until(protocol,session,()=>[...document.querySelectorAll('nav [role="button"]')]
   .some(e=>e.textContent==='Inventory'),null,'UOM_OPERATIONAL_BROWSER_INVENTORY_NAV');
  await evaluate(protocol,session,()=>{
   [...document.querySelectorAll('nav [role="button"]')].find(e=>e.textContent==='Inventory').click();return true;
  });
  async function tab(kind){
   await until(protocol,session,k=>[...document.querySelectorAll('[role="tab"]')]
    .some(e=>e.getAttribute('value')===k),kind,'UOM_OPERATIONAL_BROWSER_TAB_UNAVAILABLE_'+kind.toUpperCase());
   await evaluate(protocol,session,k=>{
    [...document.querySelectorAll('[role="tab"]')].find(e=>e.getAttribute('value')===k).click();return true;
   },kind);
   await until(protocol,session,()=>[...document.querySelectorAll('main label')]
    .some(e=>e.textContent.trim()==='Project'),null,'UOM_OPERATIONAL_BROWSER_PROJECT_FIELD_MISSING');
   await evaluate(protocol,session,()=>{
    const label=[...document.querySelectorAll('main label')].find(e=>e.textContent.trim()==='Project');
    document.getElementById(label.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;
   });
   await until(protocol,session,id=>[...document.querySelectorAll('[role="option"]')]
    .some(e=>e.getAttribute('data-value')===id),f.projectId,'UOM_OPERATIONAL_BROWSER_PROJECT_OPTION_MISSING');
   await evaluate(protocol,session,id=>{
    [...document.querySelectorAll('[role="option"]')].find(e=>e.getAttribute('data-value')===id).click();return true;
   },f.projectId);
  }
  phase='PLAN_UI';await tab('plans');
  await until(protocol,session,()=>document.querySelector('main')?.textContent.includes('PROTO_UOM_CONVERTED'),
   null,'UOM_OPERATIONAL_BROWSER_PLAN_SOURCE_MISSING');
  phase='REQUEST_UI';await tab('requests');
  await until(protocol,session,key=>[...document.querySelectorAll('main button')]
   .some(e=>e.textContent.includes(key)),requests[0].id.slice(0,8),'UOM_OPERATIONAL_BROWSER_REQUEST_NOT_LISTED');
  await evaluate(protocol,session,key=>{
   [...document.querySelectorAll('main button')].find(e=>e.textContent.includes(key)).click();return true;
  },requests[0].id.slice(0,8));
  await until(protocol,session,()=>document.querySelector('main')?.textContent.includes('24.0000')&&
   document.querySelector('main')?.textContent.includes('PROTO_UOM_NEW'),
   null,'UOM_OPERATIONAL_BROWSER_FROZEN_REQUEST_NOT_RENDERED');
  phase='ISSUES_UI';await tab('issues');
  await until(protocol,session,numbers=>numbers.every(n=>document.querySelector('main')?.textContent.includes(n)),
   issues.map(i=>i.issueNumber),'UOM_OPERATIONAL_BROWSER_PLAN_ISSUE_REGISTER_INCOMPLETE');
  phase='RETURN_UI';await tab('returns');
  await until(protocol,session,n=>document.querySelector('main')?.textContent.includes(n),
   returns[0].returnNumber,'UOM_OPERATIONAL_BROWSER_ORIGINAL_RETURN_NOT_RENDERED');
  phase='REPORT_UI';await tab('reports');
  await until(protocol,session,code=>[...document.querySelectorAll('main tr')].some(row=>
   row.textContent.includes(code)&&row.textContent.includes('60.0000')),
   source.material.code,'UOM_OPERATIONAL_BROWSER_STOCK_BALANCE_NOT_RENDERED');
  await until(protocol,session,code=>[...document.querySelectorAll('main tr')].some(row=>
   row.textContent.includes(code)&&row.textContent.includes('20/1')&&
   row.textContent.includes('2026-11-19')),
   source.material.code,'UOM_OPERATIONAL_BROWSER_PINNED_MOVEMENT_NOT_RENDERED');
  phase='LOGOUT';
  cookie=(await protocol.send('Storage.getCookies',{browserContextId:context})).cookies.find(x=>
   x.name==='erp_session'&&x.domain==='127.0.0.1');
  demand(cookie?.value,'UOM_OPERATIONAL_BROWSER_COOKIE_MISSING');
  await evaluate(protocol,session,()=>{
   const btn=[...document.querySelectorAll('header button')].find(e=>e.textContent==='Sign out');
   if(!btn)return false;btn.click();return true;
  });
  await until(protocol,session,()=>Boolean(document.querySelector('input[type="password"]')),
   null,'UOM_OPERATIONAL_BROWSER_LOGOUT_FAILED');
  const stale=await fetch(api+'/auth/me',{headers:{Cookie:'erp_session='+cookie.value},
   redirect:'error',signal:AbortSignal.timeout(10000)});
  const revoked=stale.status===401;await stale.body?.cancel();
  demand(revoked,'UOM_OPERATIONAL_BROWSER_SESSION_NOT_REVOKED');
  demand(violations.length===0,'UOM_OPERATIONAL_BROWSER_UNDECLARED_REQUEST');
  assert.deepEqual(await db.stockTransaction.findMany({where:{companyId:f.companyId}}),stockBefore,
   'Read-only browser wrote or altered stock');
  assert.deepEqual(await db.document.findMany({where:{companyId:f.companyId}}),docsBefore,
   'Read-only browser rewrote Documents');
  assert.deepEqual(await db.payment.findMany({where:{companyId:f.companyId}}),financeBefore,
   'Read-only browser modified Finance');
 }catch(e){primary=e;if(!e.safeCode)e.safeCode='UOM_OPERATIONAL_BROWSER_'+phase+'_FAILED';}
 finally{
  protocol.listeners.delete(intercept);
  if(session)closing.add(session);
  if(context)try{await protocol.send('Target.disposeBrowserContext',{browserContextId:context});}
   catch(e){primary??=e;}
 }
 if(primary)throw primary;
 return {actualIntegratedOperationalBrowserReadbackVerified:true,
  planAndRequestRendered:true,issueAndReturnRegistersRendered:true,
  exactStockAndPinnedMovementRendered:true,readOnlyNetworkEnforced:true,
  operationalBrowserSessionRevoked:true};
}
