// C readback through actual built operational screens and authenticated HTTP.
// The prior native tests create source facts; no transport replacement or writes.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const require=createRequire(resolve('apps/api/package.json'));
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(),{safeCode:code});};
async function evaluate(p,s,fn,arg){const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',awaitPromise:true,returnByValue:true},s);demand(!r.exceptionDetails&&r.result?.type!=='error','UOM_C_EVALUATION_FAILED');return r.result?.value;}
async function until(p,s,fn,arg,code){const end=Date.now()+15000;while(Date.now()<end){if(await evaluate(p,s,fn,arg))return;await new Promise(r=>setTimeout(r,80));}demand(false,code);}
async function button(p,s,label,contains=false){await until(p,s,({label,contains})=>[...document.querySelectorAll('button,nav [role="button"]')].some(e=>(contains?e.textContent.includes(label):e.textContent===label)&&!e.disabled),{label,contains},'UOM_C_ACTION_MISSING');await evaluate(p,s,({label,contains})=>{[...document.querySelectorAll('button,nav [role="button"]')].find(e=>(contains?e.textContent.includes(label):e.textContent===label)&&!e.disabled).click();return true;},{label,contains});}
async function project(p,s,id){await until(p,s,()=>[...document.querySelectorAll('main label')].some(e=>e.textContent==='Project'),null,'UOM_C_PROJECT_MISSING');await evaluate(p,s,()=>{const l=[...document.querySelectorAll('main label')].find(e=>e.textContent==='Project');document.getElementById(l.htmlFor).dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});await until(p,s,id=>Boolean(document.querySelector('[role="option"][data-value="'+id+'"]')),id,'UOM_C_PROJECT_OPTION_MISSING');await evaluate(p,s,id=>{document.querySelector('[role="option"][data-value="'+id+'"]').click();return true;},id);}
export async function stageCBrowserFixture(db){
 const plan=await db.materialUsagePlan.findFirstOrThrow({where:{issueAllocations:{some:{materialUomPlanAllocationPin:{isNot:null}}}},orderBy:{createdAt:'desc'}});
 const request=await db.materialRequest.findFirstOrThrow({where:{lines:{some:{materialUomRequestLinePins:{some:{}}}}},orderBy:{createdAt:'desc'}});
 const users=await db.user.findMany({where:{id:{in:[plan.createdByUserId,request.createdByUserId]}}});
 assert.equal(users.length,2);for(const u of users)assert.match(u.email,/@example\.invalid$/);
 return {plan,request,actors:Object.fromEntries(users.map(u=>[u.id,{userId:u.id}]))};
}
export async function executeMaterialUomStageCBrowser(p,{api:API,web:WEB,fixture:f},db){
 demand(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&API==='http://127.0.0.1:31359/api/v1'&&WEB==='http://127.0.0.1:44359','UOM_C_ORIGINS_REFUSED');
 const {SessionService}=require('./dist/auth/session.service.js'),sessions=new SessionService(db);
 const effects=await db.stockTransaction.count(),violations=[];let phase='START';
 const intercept=e=>{
  if(e.method!=='Fetch.requestPaused')return;
  let allowed=false;try{const u=new URL(e.params.request.url),m=e.params.request.method;
   allowed=u.origin===WEB&&m==='GET'||u.origin===new URL(API).origin&&(['GET','OPTIONS'].includes(m)||m==='POST'&&u.pathname==='/api/v1/auth/logout');}catch{}
  if(!allowed)violations.push('UOM_C_UNDECLARED_WRITE');
  p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId:e.params.requestId}:{requestId:e.params.requestId,errorReason:'BlockedByClient'},e.sessionId).catch(()=>violations.push('UOM_C_REQUEST_CONTROL_FAILED'));
 };
 p.listeners.add(intercept);
 try{
  for(const [kind,row]of [['plan',f.plan],['request',f.request]]){
   phase=kind.toUpperCase();const context=(await p.send('Target.createBrowserContext')).browserContextId;
   const session=await sessions.create(row.createdByUserId);let s;
   try{
    await p.send('Storage.setCookies',{browserContextId:context,cookies:[{name:'erp_session',value:session.sessionToken,url:API,httpOnly:true,sameSite:'Lax'}]});
    const target=(await p.send('Target.createTarget',{url:'about:blank',browserContextId:context})).targetId;
    s=(await p.send('Target.attachToTarget',{targetId:target,flatten:true})).sessionId;
    await p.send('Page.enable',{},s);await p.send('Runtime.enable',{},s);await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
    await p.send('Page.navigate',{url:WEB},s);
    await until(p,s,()=>Boolean(document.querySelector('nav[aria-label="Main navigation"]')),null,'UOM_C_AUTHENTICATED_SHELL_MISSING');
    demand(await evaluate(p,s,async({api,userId,companyId})=>{const r=await fetch(api+'/auth/me',{credentials:'include'}),v=await r.json();return r.status===200&&v.data.id===userId&&v.data.companyId===companyId;},{api:API,userId:row.createdByUserId,companyId:row.companyId}),'UOM_C_WRONG_ACTOR');
    await button(p,s,'Inventory');await button(p,s,kind==='plan'?'Material plans':'Material requests');
    await project(p,s,row.projectId);
    await button(p,s,kind==='plan'?row.workPackageCode+' · v'+row.version:row.id.slice(0,8),kind==='request');
    for(const [locale,caption]of [['EN',kind==='plan'?'Frozen stock allowance':'Frozen requested stock'],['ไทย',kind==='plan'?'ปริมาณแผนที่ล็อกไว้ในหน่วยสต็อก':'จำนวนสต็อกที่ขอ (อัตราที่บันทึกไว้)'],['繁中',kind==='plan'?'固定庫存計畫上限':'固定申領庫存量']]){
     await evaluate(p,s,()=>{document.querySelector('header [role="combobox"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;});
     await until(p,s,locale=>[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent===locale),locale,'UOM_C_LOCALE_MENU_MISSING');
     await evaluate(p,s,locale=>{[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent===locale).click();return true;},locale);
     await until(p,s,caption=>document.querySelector('main')?.textContent.includes(caption),caption,'UOM_C_FROZEN_STOCK_DISPLAY_MISSING');
     demand(await evaluate(p,s,()=>!document.querySelector('main').textContent.includes('98765.4321')),'UOM_C_COMMERCIAL_LEAK');
    }
    await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},s);
    demand(await evaluate(p,s,()=>innerWidth===390&&Boolean(document.querySelector('main'))),'UOM_C_MOBILE_SURFACE_MISSING');
    // Read-only probe of a real other-Company source, through this actual browser session.
    const other=kind==='plan'?f.request:f.plan;
    const route=kind==='plan'?'/inventory/material-requests/':'/inventory/material-plans/';
    demand(await evaluate(p,s,async({api,path})=>{const r=await fetch(api+path,{credentials:'include'});return [403,404].includes(r.status);},{api:API,path:route+other.id}),'UOM_C_FOREIGN_SOURCE_VISIBLE');
   }finally{
    await db.userSession.update({where:{id:session.sessionId},data:{revokedAt:new Date()}});
    const revoked=await fetch(API+'/auth/me',{headers:{Cookie:'erp_session='+session.sessionToken}});assert.equal(revoked.status,401);await revoked.body?.cancel();
    await p.send('Target.disposeBrowserContext',{browserContextId:context});
   }
  }
  assert.equal(await db.stockTransaction.count(),effects);assert.deepEqual(violations,[]);
 }catch(e){throw Object.assign(new Error(),{safeCode:'UOM_C_BROWSER_'+phase+'_'+(e.safeCode??'ASSERTION_FAILED')});}
 finally{p.listeners.delete(intercept);}
}
