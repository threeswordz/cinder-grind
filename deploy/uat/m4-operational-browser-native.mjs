// M4 real Chromium + real NestJS / PostgreSQL operational exceptions.
// EXCLUSIVE ephemeral localhost DB and own temp file storage; NO API mocks.
// This proof does not use or modify any retained Mac/Production target.
// One focused run only, after independent source review.
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
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
assert.equal(process.env.GITHUB_ACTIONS,'true','Run only within ephemeral CI');
assert.equal(process.platform,'linux','This proof is Linux-only');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/erp_m4_chromium');
assert.equal(url.port,'5432');
const API='http://127.0.0.1:31359', WEB='http://127.0.0.1:44359';
const browserBin=['google-chrome','chromium','chromium-browser'].find(bin=>
  spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
assert.ok(browserBin,'REAL_CHROMIUM_REQUIRED_NO_BROWSER_MOCK');
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-real-browser-only-'));
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
await app.listen(31359,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
let vite=null,browser=null;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function page(p,session,fn,arg){
 const r=await p.send('Runtime.evaluate',{
  expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
  awaitPromise:true,returnByValue:true},session);
 if(r.exceptionDetails||!r.result||r.result.type==='error'){
  throw new Error('REAL_BROWSER_EVALUATION_FAILED');
 }
 return r.result.value;
}
async function until(p,session,fn,arg,code){
 for(let i=0;i<110;i++){
  if(await page(p,session,fn,arg))return;
  await delay(160);
 }
 throw new Error(code);
}
async function tab(p,s,label){
 const found=await page(p,s,value=>{
  const node=[...document.querySelectorAll('[role="tab"]')].find(
   x=>x.textContent.trim()===value);
  if(!node)return false;node.click();return true;
 },label);
 assert.equal(found,true,'Missing tab '+label);
 await delay(120);
}
async function choose(p,s,label,option){
 const found=await page(p,s,value=>{
  const controls=[...document.querySelectorAll('[role="combobox"]')];
  const target=controls.find(x=>
   (x.getAttribute('aria-labelledby')??'').split(' ').some(
    id=>document.getElementById(id)?.textContent?.trim()===value));
  if(!target)return false;
  target.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
  return true;
 },label);
 assert.equal(found,true,'Missing real selector '+label);
 await until(p,s,fragment=>[...document.querySelectorAll('[role="option"]')]
  .some(x=>x.textContent.includes(fragment)),option,'OPTION_NOT_LOADED_'+label);
 const picked=await page(p,s,fragment=>{
  const node=[...document.querySelectorAll('[role="option"]')].find(
   x=>x.textContent.includes(fragment));
  if(!node)return false;node.click();return true;
 },option);
 assert.equal(picked,true,'Could not choose '+option);
 await delay(160);
}
async function input(p,s,label,value){
 const good=await page(p,s,({label,value})=>{
  const lbl=[...document.querySelectorAll('label')].find(
   x=>x.textContent.replace(/\\s*\\*$/,'').trim()===label);
  if(!lbl)return false;
  const element=document.getElementById(lbl.htmlFor);
  if(!element)return false;
  const proto=element instanceof HTMLTextAreaElement?
   HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  if(!(element instanceof HTMLTextAreaElement||
    element instanceof HTMLInputElement))return false;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(element,value);
  element.dispatchEvent(new Event('input',{bubbles:true}));
  element.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
 },{label,value});
 assert.equal(good,true,'Missing actual input '+label);
 await delay(120);
}
async function click(p,s,text){
 await until(p,s,name=>[...document.querySelectorAll('button')].some(
  b=>b.textContent?.trim()===name&&!b.disabled),text,'BUTTON_NOT_READY_'+text);
 const ok=await page(p,s,name=>{
  const el=[...document.querySelectorAll('button')].find(
   b=>b.textContent?.trim()===name&&!b.disabled);
  if(!el)return false;el.click();return true;
 },text);
 assert.equal(ok,true,'Unclickable '+text);
 await delay(140);
}
async function visible(p,s,phrase){
 await until(p,s,fragment=>document.body.innerText.includes(fragment),
  phrase,'MISSING_REAL_UI_TEXT_'+phrase);
}
async function absent(p,s,phrase){
 const exists=await page(p,s,fragment=>document.body.innerText.includes(fragment),phrase);
 assert.equal(exists,false,'Forbidden UI text appeared '+phrase);
}
async function apiCall(actor,method,pathname,body){
 const headers={Cookie:'erp_session='+actor.token};
 if(method==='POST')Object.assign(headers,{'x-csrf-token':actor.csrf,
   'Content-Type':'application/json'});
 const res=await fetch(API+'/api/v1'+pathname,{method,headers,
  ...(method==='POST'?{body:JSON.stringify(body??{})}:{})});
 const raw=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error('FIXTURE_REAL_API_'+pathname+'_STATUS_'+res.status+
  '_'+(raw.code??'UNKNOWN'));
 return raw.data;
}
async function upload(actor,projectId,docTypeId){
 const form=new FormData();
 form.set('documentTypeId',docTypeId);
 form.set('file',new Blob([new Uint8Array(Buffer.from(
  '%PDF-1.4\\nReal isolated M4 browser source evidence\\n%%EOF\\n'))],
  {type:'application/pdf'}),'m4-browser-evidence.pdf');
 const r=await fetch(API+'/api/v1/documents/projects/'+projectId,{
  method:'POST',headers:{Cookie:'erp_session='+actor.token,
   'x-csrf-token':actor.csrf},body:form});
 const data=await r.json();
 assert.equal(r.status,201,JSON.stringify(data));
 return data.data.id;
}
const harness=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {OperationalExceptionsPanel} from '/src/inventory/OperationalExceptionsPanel.tsx';
const container=document.getElementById('root');
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
(async()=>{
 const response=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});
 if(response.status!==200)throw Error('REAL_COOKIE_AUTH_REQUIRED_'+response.status);
 const me=(await response.json()).data;
 if(!me.id||!me.companyId||!Array.isArray(me.roleCodes)||!Array.isArray(me.permissions))
  throw Error('INVALID_REAL_SESSION_IDENTITY');
 document.body.dataset.identity=me.id;
 document.body.dataset.company=me.companyId;
 document.body.dataset.roles=me.roleCodes.join(',');
 createRoot(container).render(<QueryClientProvider client={client}>
  <OperationalExceptionsPanel permissions={me.permissions}
    roleCodes={me.roleCodes} userId={me.id}/>
 </QueryClientProvider>);
 document.body.dataset.authenticated='yes';
})().catch(e=>{document.body.dataset.authenticated='no';document.body.dataset.failure=e.message;});
`;
async function realBrowser(){
 const key=randomUUID().slice(0,8);
 const company=await db.company.create({data:{companyCode:'M4B-'+key,companyName:'Disposable M4 Chromium'}});
 const customer=await db.customer.create({data:{companyId:company.id,
  customerCode:'C-'+key,customerName:'Disposable customer'}});
 const projectFields={companyId:company.id,customerId:customer.id,
  contractValue:'1000',plannedStartDate:new Date('2026-01-01'),
  plannedCompletionDate:new Date('2027-12-31')};
 const project=await db.project.create({data:{...projectFields,
  projectCode:'M4-ASSIGNED-'+key,projectName:'M4 Operational Site'}});
 const other=await db.project.create({data:{...projectFields,
  projectCode:'M4-OTHER-'+key,projectName:'Not Assigned Site'}});
 const warehouse=await db.warehouse.create({data:{companyId:company.id,projectId:project.id,
  warehouseCode:'M4-SITE-'+key,warehouseName:'Actual Browser Site',isSiteWarehouse:true}});
 const uom=await db.unitOfMeasure.create({data:{companyId:company.id,
  uomCode:'EA-'+key,uomName:'Each',decimalPlaces:4}});
 const material=await db.material.create({data:{companyId:company.id,defaultUomId:uom.id,
  materialCode:'AGG-'+key,materialName:'Synthetic Aggregate',materialCategory:'AGGREGATE'}});
 const dt=await db.documentType.create({data:{companyId:company.id,
  documentTypeCode:'M4B-'+key,documentTypeName:'Browser synthetic project evidence'}});
 const permissions=[
  'inventory.issue.view','inventory.issue.create','inventory.issue.approve',
  'inventory.stock.view','inventory.stock_count.view',
  'documents.document.view','documents.document.upload','documents.document.link',
 ];
 const permissionIds=new Map();
 for(const code of permissions){
  const record=await db.permission.upsert({where:{permissionCode:code},update:{},
   create:{permissionCode:code,moduleCode:code.slice(0,code.indexOf('.')).toUpperCase()}});
  permissionIds.set(code,record.id);
 }
 async function actor(label,roleCode,codes,projectScope){
  const employee=await db.employee.create({data:{companyId:company.id,
   employeeCode:label+key,employeeName:'Synthetic '+label}});
  const user=await db.user.create({data:{companyId:company.id,employeeId:employee.id,
   email:label.toLowerCase()+'-'+key+'@example.invalid',displayName:label,
   passwordHash:'not-a-login'}});
  const role=(await db.role.findFirst({where:{companyId:company.id,roleCode}}))??
   await db.role.create({data:{companyId:company.id,roleCode,roleName:roleCode}});
  await db.rolePermission.createMany({data:codes.map(code=>({
   roleId:role.id,permissionId:permissionIds.get(code)
  })),skipDuplicates:true});
  await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
  await db.projectMember.create({data:{projectId:projectScope,employeeId:employee.id,
   projectRole:roleCode}});
  const session=await sessions.create(user.id);
  return {id:user.id,token:session.sessionToken,csrf:session.csrfToken,
   sessionId:session.sessionId};
 }
 const docView='documents.document.view',stock='inventory.stock.view',count='inventory.stock_count.view';
 const store=await actor('Store','STOREKEEPER',[docView,stock,count,'inventory.issue.view',
  'inventory.issue.create','documents.document.upload','documents.document.link'],project.id);
 const pm=await actor('Khaimook','PROJECT_MANAGER',[docView,stock,count,'inventory.issue.view',
  'inventory.issue.approve'],project.id);
 const ben=await actor('Ben','MANAGEMENT',[docView,stock],project.id);
 const nancy=await actor('Nancy','FINANCE_MANAGER',[docView,stock,count],project.id);
 const outsider=await actor('Elsewhere','STOREKEEPER',[docView,stock,count,'inventory.issue.view'],other.id);
 const stockBefore=await db.stockTransaction.count({where:{companyId:company.id}});
 const costBefore=await db.directCostPosting.count({where:{companyId:company.id}});
 const posted=new Date(Date.now()-54*3600000);
 const issue=await db.materialIssue.create({data:{companyId:company.id,projectId:project.id,
  warehouseId:warehouse.id,issueNumber:'ISSUE-'+key,issueDate:posted,
  createdByUserId:store.id,postedByUserId:store.id,postedAt:posted,
  postKey:'M4-BROWSER-ONLY-'+key}});
 // Real data and real source-linked bytes are created using the actual backend;
 // the Chromium probe does not re-run the previous independent native suites.
 const docId=await upload(store,project.id,dt.id);
 const issueForm=new FormData();
 issueForm.set('documentTypeId',dt.id);
 issueForm.set('file',new Blob([new Uint8Array(Buffer.from(
  '%PDF-1.4\\nActual posted issue browser evidence\\n%%EOF\\n'))],
  {type:'application/pdf'}),'m4-posted-issue.pdf');
 const issueUpload=await fetch(API+'/api/v1/documents/projects/'+project.id+
  '/targets/MATERIAL_ISSUE/'+issue.id,{
  method:'POST',headers:{Cookie:'erp_session='+store.token,
   'x-csrf-token':store.csrf},body:issueForm,
 });
 const issueUploaded=await issueUpload.json();
 assert.equal(issueUpload.status,201,JSON.stringify(issueUploaded));
 const issueDoc=issueUploaded.data.id;
 await apiCall(store,'POST','/inventory/urgent-issue-documents/'+issue.id+'/register',
  {reason:'Original posted issue requires complete paperwork'});
 await apiCall(store,'POST','/inventory/urgent-issue-documents/'+issue.id+'/submit',
  {documentIds:[issueDoc],completionNote:'Actual linked evidence supplied to Khaimook'});
 const loss=await apiCall(store,'POST','/inventory/stock-loss-cases',{
  projectId:project.id,warehouseId:warehouse.id,materialId:material.id,uomId:uom.id,
  quantity:'2.0000',kind:'DAMAGE',occurredOn:'2026-11-23',
  finderName:'Synthetic site staff',place:'Section A',cause:'Damage in storage',
  proposedDisposition:'DISPOSAL',evidenceDocumentIds:[docId],
 });
 assert.ok(loss.caseId,'Actual SS13 case was not opened');
 vite=await createServer({root:WEB_ROOT,configFile:false,
  server:{host:'127.0.0.1',port:44359,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[{name:'m4-real-browser-fixture',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__m4-operational-live')return next();
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__m4-live.tsx"></script></body></html>');
   });},
   resolveId(id){if(id==='/__m4-live.tsx')return 'virtual:m4-live-fixture-entry';},
   async load(id){if(id==='virtual:m4-live-fixture-entry')
    return transformWithOxc(harness,path.join(WEB_ROOT,'__m4-live.tsx'),
     {lang:'tsx',jsx:{runtime:'automatic'}});}
  }]});
 await vite.listen();
 browser=await startBrowser(browserBin,temp);
 const p=browser.protocol,contexts=[];
 async function session(actor){
  const {browserContextId}=await p.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId});
  const attached=await p.send('Target.attachToTarget',{targetId,flatten:true});
  const s=attached.sessionId;
  await p.send('Network.enable',{},s);
  await p.send('Page.enable',{},s);
  await p.send('Runtime.enable',{},s);
  const cookie=await p.send('Network.setCookie',{
   name:'erp_session',value:actor.token,url:WEB,httpOnly:true,sameSite:'Lax'},s);
  assert.equal(cookie.success,true,'Real HTTP-only session cookie was not created');
  await p.send('Page.navigate',{url:WEB+'/__m4-operational-live'},s);
  await until(p,s,()=>document.body.dataset.authenticated==='yes',null,'REAL_BROWSER_AUTH_FAILED');
  const identity=await page(p,s,async()=>{
   const r=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});
   return r.status===200?(await r.json()).data:null;
  });
  assert.equal(identity?.id,actor.id,'Actual auth/me identity mismatch');
  await visible(p,s,'Operational exceptions / evidence decisions');
  return s;
 }
 try{
  // Store can only view schedules, can see urgency and SS13 forms; not Nancy's editor.
  const storeS=await session(store);
  await visible(p,storeS,'Urgent issue documents');
  await tab(p,storeS,'Count schedules');
  await choose(p,storeS,'Project','M4-ASSIGNED-'+key);
  await choose(p,storeS,'Site Warehouse','M4-SITE-'+key);
  await visible(p,storeS,'Physical count scheduling');
  await absent(p,storeS,'Save category schedule');
  console.log('M4_BROWSER_STORE_SCOPED_READONLY_PASS');

  // Nancy writes a true site/category schedule via React/MUI + CSRF + PostgreSQL.
  const nancyS=await session(nancy);
  await visible(p,nancyS,'Count schedules');
  await choose(p,nancyS,'Project','M4-ASSIGNED-'+key);
  await choose(p,nancyS,'Site Warehouse','M4-SITE-'+key);
  await visible(p,nancyS,'Set or revise a category schedule');
  await input(p,nancyS,'Material category (exact)','AGGREGATE');
  await input(p,nancyS,'First due date','2026-11-24');
  await input(p,nancyS,'Repeat every (days)','7');
  await input(p,nancyS,"Nancy's reason",'Weekly physical inventory schedule');
  await click(p,nancyS,'Save category schedule');
  await visible(p,nancyS,'Saved a new immutable site/category scheduling revision.');
  const schedule=await apiCall(nancy,'GET','/inventory/stock-count-schedules/projects/'+project.id+
   '/sites/'+warehouse.id+'?asOfDate=2026-11-23');
  assert.equal(schedule.schedules[0]?.materialCategory,'AGGREGATE');
  assert.equal(schedule.schedules[0]?.intervalDays,7);
  console.log('M4_BROWSER_NANCY_REAL_SAVE_PASS');

  // PM09 Khaimook closes posted issue document follow-up from real React tab.
  const pmS=await session(pm);
  await visible(p,pmS,'Urgent issue documents');
  await choose(p,pmS,'Project','M4-ASSIGNED-'+key);
  await choose(p,pmS,'Posted material issue','ISSUE-'+key);
  await visible(p,pmS,'Khaimook — independent evidence decision');
  await input(p,pmS,'Reviewer note','Independent on-site paperwork verification');
  await click(p,pmS,'Record independent decision');
  await visible(p,pmS,'Closure recorded');
  const urgent=await apiCall(pm,'GET','/inventory/urgent-issue-documents/'+issue.id);
  assert.equal(urgent.record?.status,'CLOSED');
  console.log('M4_BROWSER_PM09_KHAIMOOK_REAL_REVIEW_PASS');

  // SS13 Khaimook→Ben→Nancy actual source/actor stage transitions in browser.
  await tab(p,pmS,'Loss / damage / waste');
  await choose(p,pmS,'Project','M4-ASSIGNED-'+key);
  await input(p,pmS,'Case UUID',loss.caseId);
  await click(p,pmS,'Open authorized case');
  await visible(p,pmS,'Khaimook severity screen');
  await choose(p,pmS,'Escalate to Ben?','Yes — Ben must acknowledge severity');
  await input(p,pmS,'Independent review reason','Significant disposal severity to management');
  await click(p,pmS,'Record independent operational decision');
  await visible(p,pmS,'Status: BEN_PENDING');

  const benS=await session(ben);
  await visible(p,benS,'Loss / damage / waste');
  await choose(p,benS,'Project','M4-ASSIGNED-'+key);
  await input(p,benS,'Case UUID',loss.caseId);
  await click(p,benS,'Open authorized case');
  await visible(p,benS,'Ben property-severity acknowledgment');
  await input(p,benS,'Independent review reason','Severity independently acknowledged by management');
  await click(p,benS,'Record independent operational decision');
  await visible(p,benS,'Status: NANCY_PENDING');

  await tab(p,nancyS,'Loss / damage / waste');
  await choose(p,nancyS,'Project','M4-ASSIGNED-'+key);
  await input(p,nancyS,'Case UUID',loss.caseId);
  await click(p,nancyS,'Open authorized case');
  await visible(p,nancyS,'Nancy disposal-proposal decision');
  await input(p,nancyS,'Independent review reason','Operational disposal proposal approved only');
  await click(p,nancyS,'Record independent operational decision');
  await visible(p,nancyS,'Status: NANCY_APPROVED_PENDING_EXECUTION');
  await visible(p,nancyS,'Actual disposal and financial write-off are NOT posted');
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stockBefore);
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),costBefore);
  console.log('M4_BROWSER_SS13_SEPARATE_ROLE_STAGE_NO_POST_PASS');

  // Actual unrelated-Project authenticated UI and protected API isolation.
  const outsiderS=await session(outsider);
  await tab(p,outsiderS,'Count schedules');
  await until(p,outsiderS,()=>document.querySelectorAll('[role="combobox"]').length>=1,
   null,'OUTSIDER_PROJECT_SELECTOR_MISSING');
  const canSee=await page(p,outsiderS,text=>document.body.innerText.includes(text),
   'M4-ASSIGNED-'+key);
  assert.equal(canSee,false,'Other Project leaked into real browser');
  const denied=await page(p,outsiderS,async path=>{
   const r=await fetch('/api/v1'+path,{credentials:'include',redirect:'error'});
   return r.status;
  },'/inventory/stock-count-schedules/projects/'+project.id+'/sites/'+warehouse.id);
  assert.ok([403,404].includes(denied),'Nonmember Project scope rejected with '+denied);
  console.log('M4_BROWSER_OTHER_PROJECT_AUTH_DENIAL_PASS');
 }finally{
  for(const contextId of contexts.reverse())
   await p.send('Target.disposeBrowserContext',{browserContextId:contextId}).catch(()=>{});
 }
}
try{
 await realBrowser();
 console.log('M4_REAL_CHROMIUM_REAL_API_REAL_POSTGRES_SCOPED_PASS');
}catch(error){
 console.error('M4_REAL_BROWSER_FOCUSED_FAILED: '+String(error?.message??error).slice(0,350));
 process.exitCode=1;
}finally{
 try{if(browser)await browser.stop();}finally{
  try{if(vite)await vite.close();}finally{
   await app.close();
   await rm(temp,{recursive:true,force:true});
  }
 }
}
