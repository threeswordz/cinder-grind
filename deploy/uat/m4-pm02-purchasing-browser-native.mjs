// One genuinely NEW M4 PM02 authenticated React/Chromium proof.
// Isolated disposable PG + temp document store. Never touches Mac/Production,
// older proven operational browser, retained Company, or live user grants.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startBrowser} from './prototype-browser.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const WEB_ROOT=path.join(ROOT,'apps/web');
const apiRequire=createRequire(path.join(ROOT,'apps/api/package.json'));
const webRequire=createRequire(path.join(WEB_ROOT,'package.json'));
const dbUrl=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.platform,'linux');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(dbUrl.hostname));
assert.equal(dbUrl.pathname,'/erp_m4_pm02_chromium');
assert.equal(dbUrl.port,'5432');
const API='http://127.0.0.1:31362',WEB='http://127.0.0.1:44362';
const browserBin=['google-chrome','chromium','chromium-browser'].find(
 x=>spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(browserBin,'PM02_ACTUAL_CHROMIUM_REQUIRED');
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-pm02-browser-only-'));
process.env.STORAGE_ROOT=path.join(temp,'documents');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(temp,'uploads');
process.env.VITE_API_BASE_URL=WEB+'/api/v1';

const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {createServer,transformWithOxc}=await import(pathToFileURL(webRequire.resolve('vite')).href);
const app=await NestFactory.create(AppModule,{logger:false});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31362,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
let vite=null,browser=null,stage='INIT';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function page(p,s,fn,arg){
 const r=await p.send('Runtime.evaluate',{
   expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
   awaitPromise:true,returnByValue:true,
 },s);
 if(r.exceptionDetails)throw new Error('PM02_BROWSER_EVALUATION_FAILURE');
 if(!r.result||r.result.type==='error')throw new Error('PM02_BROWSER_NO_RESULT');
 return r.result.value;
}
async function until(p,s,fn,arg,label){
 for(let i=0;i<110;i++){
  try{if(await page(p,s,fn,arg))return;}
  catch(e){
   const code=e?.safeCode??e?.message??'UNKNOWN';
   if(code!=='BROWSER_PROTOCOL_COMMAND_FAILED'&&code!=='PM02_BROWSER_NO_RESULT')
    throw e;
  }
  await pause(160);
 }
 throw new Error('PM02_BROWSER_WAIT_TIMEOUT_'+label);
}
async function visible(p,s,fragment){
 await until(p,s,x=>(document.getElementById('root')?.textContent??'').includes(x),
  fragment,'TEXT_'+fragment.slice(0,30));
}
async function click(p,s,title){
 await until(p,s,t=>[...document.querySelectorAll('button')].some(
  b=>b.textContent?.trim()===t&&!b.disabled),title,'BUTTON_'+title.slice(0,30));
 const ok=await page(p,s,t=>{
  const target=[...document.querySelectorAll('button')].find(
   b=>b.textContent?.trim()===t&&!b.disabled);
  if(!target)return false;target.click();return true;
 },title);
 assert.equal(ok,true,'PM02_UI_BUTTON_MISSING_'+title);
}
async function choose(p,s,label,option){
 // MUI's portal keeps the previous menu options in the DOM throughout its
 // close animation. If the next choice is clicked immediately, the old
 // line's matching option wins and silently changes the WRONG PR line.
 await until(p,s,()=>document.querySelectorAll('[role="option"]').length===0,
  null,'PREVIOUS_MUI_MENU_MUST_BE_CLOSED');
 const opened=await page(p,s,value=>{
  const target=[...document.querySelectorAll('[role="combobox"]')].find(
   x=>(x.getAttribute('aria-labelledby')??'').split(' ').some(
    id=>document.getElementById(id)?.textContent?.trim()===value));
  if(!target)return false;
  target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
  return true;
 },label);
 assert.equal(opened,true,'PM02_SELECT_NOT_FOUND_'+label);
 await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(
  x=>x.textContent?.includes(value)),option,'OPTION_'+option);
 const selected=await page(p,s,value=>{
  const target=[...document.querySelectorAll('[role="option"]')].find(
   x=>x.textContent?.includes(value));
  if(!target)return false;target.click();return true;
 },option);
 assert.equal(selected,true,'PM02_OPTION_NOT_SELECTED_'+label);
 // Inspect the actual controlled combobox associated with THIS line's label.
 // Never treat a clicked portal option as success unless its corresponding
 // current React value visibly changed to the requested option.
 await until(p,s,values=>[...document.querySelectorAll('[role="combobox"]')].some(
  x=>(x.getAttribute('aria-labelledby')??'').split(' ').some(
   id=>document.getElementById(id)?.textContent?.trim()===values.label) &&
   x.textContent?.includes(values.option)),{label,option},
  'WRONG_LINE_OR_UNCHANGED_MUI_SELECTOR_'+label);
 await until(p,s,()=>document.querySelectorAll('[role="option"]').length===0,
  null,'MUI_MENU_MUST_CLOSE_BEFORE_NEXT_LINE');
}
async function input(p,s,label,value){
 // React mounts the returned-line reason textarea only AFTER MUI's select
 // updates state. Wait for the actual label AND a visible input, not a fixed
 // 120ms assumption. MUI can move its textarea outside the label's htmlFor.
 await until(p,s,values=>{
  const lbl=[...document.querySelectorAll('label')].find(x=>
   String(x.textContent??'').replaceAll('*','').trim()===values.label);
  if(!lbl)return false;
  const linked=lbl.htmlFor?document.getElementById(lbl.htmlFor):null;
  const el=(linked instanceof HTMLTextAreaElement||linked instanceof HTMLInputElement)
   ?linked:lbl.closest('.MuiFormControl-root')?.querySelector(
    'textarea:not([aria-hidden="true"]),input');
  if(!(el instanceof HTMLTextAreaElement||el instanceof HTMLInputElement))return false;
  const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:
   HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,values.value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
 },{label,value},'RENDERED_INPUT_'+label);
 await pause(180);
}
async function apiCall(actor,method,path,body){
 const headers={Cookie:'erp_session='+actor.token};
 if(method!=='GET')Object.assign(headers,{
  'x-csrf-token':actor.csrf,'Content-Type':'application/json',
 });
 const r=await fetch(API+'/api/v1'+path,{method,headers,
  ...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error('PM02_SETUP_REAL_API_'+method+'_'+path+'_HTTP_'+r.status+
  '_'+(data.code??'UNKNOWN'));
 return data.data;
}
async function run(){
 const key=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'PM02BR-'+key,companyName:'PM02 Browser Disposable',
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'C-'+key,customerName:'Disposable customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,projectCode:'PM02SITE-'+key,
  projectName:'PM02 synthetic site',contractValue:'100000',
  plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31'),
 }});
 const uom=await db.unitOfMeasure.create({data:{
  companyId:company.id,uomCode:'EA-'+key,uomName:'Each',decimalPlaces:2,
 }});
 const perms=['procurement.pr.view','procurement.pr.manage',
  'procurement.pr.submit','procurement.pr.approve'];
 const ids=new Map();
 for(const code of perms){
  const row=await db.permission.upsert({where:{permissionCode:code},update:{},
   create:{permissionCode:code,moduleCode:'PROCUREMENT'}});
  ids.set(code,row.id);
 }
 async function actor(label,roleCode,grants){
  const emp=await db.employee.create({data:{
   companyId:company.id,employeeCode:'P'+label+key,employeeName:'Synthetic '+label,
  }});
  const user=await db.user.create({data:{
   companyId:company.id,employeeId:emp.id,
   email:label.toLowerCase()+'-'+key+'@example.invalid',displayName:label,
   passwordHash:'not-a-login',
  }});
  const role=await db.role.create({data:{
   companyId:company.id,roleCode,roleName:roleCode,
  }});
  await db.rolePermission.createMany({data:grants.map(code=>({
   roleId:role.id,permissionId:ids.get(code),
  }))});
  await db.userRole.create({data:{
   companyId:company.id,userId:user.id,roleId:role.id,
  }});
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:emp.id,projectRole:roleCode,
  }});
  const session=await sessions.create(user.id);
  return {id:user.id,token:session.sessionToken,csrf:session.csrfToken,
   roleId:role.id,roleCode};
 }
 const store=await actor('Store','STOREKEEPER',
  ['procurement.pr.view','procurement.pr.manage','procurement.pr.submit']);
 const pm=await actor('Khaimook','PROJECT_MANAGER',
  ['procurement.pr.view','procurement.pr.approve']);
 await db.numberSequence.create({data:{
  companyId:company.id,entityType:'PURCHASE_REQUEST',
  sequenceCode:'PURCHASE_REQUEST',formatTemplate:'PRYYMM-###',
  resetRule:'MONTHLY',
 }});
 const workflow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PM02BR-'+key,workflowName:'Khaimook single review',
  entityType:'PURCHASE_REQUEST',
  steps:{create:[{stepNo:1,stepName:'PM Review',requiredApprovals:1,
   stepRoles:{create:[{roleId:pm.roleId}]}}]},
 }});

 // Separate real CSRF-protected API setup. The actual decision and correction
 // actions below MUST originate in authenticated browser React controls.
 const request=await apiCall(store,'POST',
  '/procurement/projects/'+project.id+'/purchase-requests',
  {remarks:'PM02 browser mixed A/B decisions'});
 const first=await apiCall(store,'POST',
  '/procurement/purchase-requests/'+request.id+'/lines',
  {lineType:'SERVICE',description:'Approved concrete browser A',
   quantity:'1',uomId:uom.id});
 const second=await apiCall(store,'POST',
  '/procurement/purchase-requests/'+request.id+'/lines',
  {lineType:'SERVICE',description:'Returned transport browser B',
   quantity:'2',uomId:uom.id});
 await apiCall(store,'POST','/procurement/purchase-requests/'+request.id+'/submit',
  {workflowCode:workflow.workflowCode});

 const entry=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {PurchaseRequestsPanel} from '/src/procurement/PurchaseRequestsPanel.tsx';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
(async()=>{
 const response=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});
 if(response.status!==200)throw new Error('REAL_COOKIE_AUTH_REQUIRED');
 const me=(await response.json()).data;
 if(!me.id||!Array.isArray(me.permissions)||!me.companyId)throw Error('AUTH_IDENTITY_MISSING');
 document.body.dataset.identity=me.id;
 createRoot(document.getElementById('root')).render(
  <QueryClientProvider client={client}><PurchaseRequestsPanel
   permissions={me.permissions}
   initialProjectId={${JSON.stringify(project.id)}}
   initialRequestId={${JSON.stringify(request.id)}}/>
  </QueryClientProvider>);
 document.body.dataset.authenticated='yes';
})().catch(error=>{
 document.body.dataset.authenticated='no';document.body.dataset.failure=error.message;
});
`;
 vite=await createServer({root:WEB_ROOT,configFile:false,
  server:{host:'127.0.0.1',port:44362,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[{name:'m4-pm02-real-browser-only',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__pm02-real')return next();
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__pm02-browser.tsx"></script></body></html>');
   });},
   resolveId(id){if(id==='/__pm02-browser.tsx')return 'virtual:pm02-real-entry';},
   async load(id){if(id==='virtual:pm02-real-entry')return transformWithOxc(
    entry,path.join(WEB_ROOT,'__pm02-browser.tsx'),{
     lang:'tsx',jsx:{runtime:'automatic'},
    });},
  }]});
 await vite.listen();
 browser=await startBrowser(browserBin,temp);
 const p=browser.protocol,contexts=[],errors=[],requests=new Map();
 const observe=event=>{
  if(event.method==='Network.responseReceived'){
   const status=event.params?.response?.status??0;
   const u=event.params?.response?.url??'';
   if(u.startsWith(WEB+'/api/v1/')&&status>=400)errors.push('REAL_HTTP_'+status);
  }else if(event.method==='Runtime.exceptionThrown'){
   errors.push('REAL_CHROME_UNHANDLED_JS');
  }
 };
 p.listeners.add(observe);
 async function session(person){
  const {browserContextId}=await p.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});
  const s=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await p.send('Network.enable',{},s);await p.send('Page.enable',{},s);
  await p.send('Runtime.enable',{},s);
  const cookie=await p.send('Network.setCookie',{
   name:'erp_session',value:person.token,url:WEB,httpOnly:true,sameSite:'Lax',
  },s);
  assert.equal(cookie.success,true);
  await p.send('Page.navigate',{url:WEB+'/__pm02-real'},s);
  await until(p,s,()=>document.body?.dataset?.authenticated==='yes',null,'AUTHENTICATED');
  const got=await page(p,s,()=>document.body.dataset.identity);
  assert.equal(got,person.id);
  await visible(p,s,'Purchase Request history');
  await visible(p,s,'Approved concrete browser A');
  return s;
 }
 try{
  stage='STORE_DENIED_REVIEW';
  const storeS=await session(store);
  const storeApprove=await page(p,storeS,()=>[...document.querySelectorAll('button')]
   .some(x=>x.textContent?.trim()==='Approve whole PR'));
  assert.equal(storeApprove,false,'Store cannot render PM independent approval');
  console.log('M4_PM02_BROWSER_STORE_REVIEW_DENIED_PASS');

  stage='KHAIMOOK_REAL_LINE_REVIEW';
  const pmS=await session(pm);
  await visible(p,pmS,'Khaimook — independent line-by-line review (PM02)');
  await choose(p,pmS,'Decision for line 1','Approve this line');
  const wholeDisabled=await page(p,pmS,()=>[...document.querySelectorAll('button')]
   .find(b=>b.textContent?.trim()==='Approve whole PR')?.disabled);
  assert.equal(wholeDisabled,true,'Whole-approve must not bypass partial line decision');
  await choose(p,pmS,'Decision for line 2','Return this line for correction');
  // Safe synthetic-only DOM diagnosis: no tokens, credentials, confidential
  // Company data, or full HTML. Confirm the actual controlled MUI selector
  // adopted RETURNED rather than assuming a MenuItem click changed state.
  const decisionDom=await page(p,pmS,()=>{
   const controls=[...document.querySelectorAll('[role="combobox"]')];
   const second=controls.find(x=>(x.getAttribute('aria-labelledby')??'')
    .split(' ').some(id=>document.getElementById(id)?.textContent?.trim()==='Decision for line 2'));
   const reasonLabels=[...document.querySelectorAll('label')].filter(x=>
    x.textContent?.includes('Correction reason')).map(x=>({
     text:x.textContent?.trim(),hasLinkedInput:Boolean(document.getElementById(x.htmlFor)),
    }));
   return {
    line2Choice:second?.textContent?.trim()??'SELECT_MISSING',
    reasonLabels,
    visibleText:(document.getElementById('root')?.textContent??'').includes('Correction reason for line 2'),
    textareas:document.querySelectorAll('textarea:not([aria-hidden="true"])').length,
   };
  });
  console.log('M4_PM02_SYNTHETIC_DOM_DECISION_'+JSON.stringify(decisionDom));
  await until(p,pmS,()=>[...document.querySelectorAll('[role="combobox"]')].some(
   x=>(x.getAttribute('aria-labelledby')??'').split(' ').some(
    id=>document.getElementById(id)?.textContent?.trim()==='Decision for line 2') &&
    x.textContent?.includes('Return this line for correction')),null,
   'RETURN_DECISION_ACTUALLY_SELECTED');
  await input(p,pmS,'Correction reason for line 2','Wrong transport quantity; correct it before purchasing');
  await click(p,pmS,'Approve selected lines / return the others');
  await visible(p,pmS,'Return for correction: Wrong transport quantity');
  const reviewed=await apiCall(pm,'GET','/procurement/purchase-requests/'+request.id);
  assert.equal(reviewed.lifecycleState,'APPROVED');
  assert.equal(reviewed.lines.find(x=>x.id===first.id)?.reviewDecision,'APPROVED');
  assert.equal(reviewed.lines.find(x=>x.id===second.id)?.reviewDecision,'RETURNED');
  console.log('M4_PM02_BROWSER_REAL_MIXED_DECISION_AND_APPROVAL_BYPASS_DENIED_PASS');

  stage='STORE_CORRECTION_CHAIN';
  // New actual authenticated page avoids reusing stale Store React Query
  // cache or assuming a reload preserves the previous CDP execution context.
  const correctionStoreS=await session(store);
  await visible(p,correctionStoreS,'Copy returned lines to correction Draft');
  await click(p,correctionStoreS,'Copy returned lines to correction Draft');
  await visible(p,correctionStoreS,'This correction Draft contains only returned source lines.');
  const correction=await db.purchaseRequest.findFirstOrThrow({
   where:{companyId:company.id,sourceRequestId:request.id},
   include:{lines:true},
  });
  assert.equal(correction.lines.length,1);
  assert.equal(correction.lines[0].correctionSourceLineId,second.id);
  const original=await apiCall(store,'GET','/procurement/purchase-requests/'+request.id);
  assert.equal(original.lines.find(x=>x.id===second.id)?.reviewDecision,'RETURNED');
  console.log('M4_PM02_BROWSER_MAKER_SINGLE_CORRECTION_DRAFT_PASS');

  assert.deepEqual(errors,[],'No unexpected browser API failure/JS exception permitted');
  console.log('M4_PM02_REAL_CHROMIUM_REAL_NEST_PG17_SCOPED_PASS');
 }finally{
  p.listeners.delete(observe);
  for(const id of contexts.reverse())
   await p.send('Target.disposeBrowserContext',{browserContextId:id}).catch(()=>{});
 }
}
try{await run();}
catch(error){
 console.error('M4_PM02_BROWSER_FAILED_'+stage+': '+String(error?.message??error).slice(0,280));
 process.exitCode=1;
}finally{
 try{if(browser)await browser.stop();}finally{
  try{if(vite)await vite.close();}finally{
   await app.close();await rm(temp,{recursive:true,force:true});
  }
 }
}
