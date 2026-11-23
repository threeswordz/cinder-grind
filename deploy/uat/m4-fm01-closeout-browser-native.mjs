// New M4-03 browser-only source. NOT executed, approved, or release evidence.
// Disposable localhost PostgreSQL 17.11 and ephemeral files ONLY. No CI replay,
// retained access, Mac or production writes. Real Nest, React/MUI and Chrome CDP.
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
assert.equal(process.env.GITHUB_ACTIONS,'true','Ephemeral CI only');
assert.equal(process.platform,'linux','Linux browser proof only');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(dbUrl.hostname));
assert.equal(dbUrl.pathname,'/erp_m4_fm01_closeout_chromium');
assert.equal(dbUrl.port,'5432');
const API='http://127.0.0.1:31363',WEB='http://127.0.0.1:44363';
const chrome=['google-chrome','chromium','chromium-browser'].find(
 x=>spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(chrome,'M4_03_REAL_CHROME_REQUIRED');
const tmp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-fm01-browser-'));
process.env.STORAGE_ROOT=path.join(tmp,'documents');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(tmp,'uploads');
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
await app.listen(31363,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
let vite=null,browser=null,stage='FIXTURE';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function page(p,s,fn,arg){
 const r=await p.send('Runtime.evaluate',{
  expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
  awaitPromise:true,returnByValue:true,
 },s);
 if(r.exceptionDetails)throw new Error('M4_03_REAL_BROWSER_EVALUATION_FAILED');
 if(!r.result||r.result.type==='error')throw new Error('M4_03_NO_BROWSER_RESULT');
 return r.result.value;
}
async function until(p,s,fn,arg,label){
 for(let i=0;i<115;i++){
  try{if(await page(p,s,fn,arg))return;}
  catch(e){
   const code=e?.safeCode??e?.message??'UNKNOWN';
   if(code!=='BROWSER_PROTOCOL_COMMAND_FAILED'&&code!=='M4_03_NO_BROWSER_RESULT')
    throw e;
  }
  await sleep(160);
 }
 throw new Error('M4_03_TIMEOUT_'+label);
}
async function visible(p,s,text){
 await until(p,s,x=>(document.getElementById('root')?.textContent??'').includes(x),
  text,'TEXT_'+text.slice(0,28));
}
async function click(p,s,text){
 await until(p,s,x=>[...document.querySelectorAll('button')].some(
  b=>b.textContent?.trim()===x&&!b.disabled),text,'BUTTON_'+text.slice(0,28));
 assert.equal(await page(p,s,x=>{
  const b=[...document.querySelectorAll('button')].find(
   b=>b.textContent?.trim()===x&&!b.disabled);
  if(!b)return false;b.click();return true;
 },text),true);
}
async function inputAt(p,s,label,index,value){
 // React native setter, not uncontrolled DOM assignment. The repeated six
 // closeout fields must be selected by their individual label occurrence.
 await until(p,s,({label,index,value})=>{
  const labels=[...document.querySelectorAll('label')].filter(l=>
   l.textContent?.replace(/\s*\*/g,'').trim()===label);
  const l=labels[index];
  const linked=l?.htmlFor?document.getElementById(l.htmlFor):null;
  const el=(linked instanceof HTMLInputElement||
    linked instanceof HTMLTextAreaElement)?linked:
    l?.closest('.MuiFormControl-root')?.querySelector(
     'textarea:not([aria-hidden="true"]),input');
  if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return false;
  const proto=el instanceof HTMLTextAreaElement?
   HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return true;
 },{label,index,value},'INPUT_'+label.slice(0,20)+'_'+index);
 await sleep(100);
}
async function call(actor,method,pathname,body){
 const headers={Cookie:'erp_session='+actor.token};
 if(method==='POST')Object.assign(headers,{
  'x-csrf-token':actor.csrf,'Content-Type':'application/json',
 });
 const response=await fetch(API+'/api/v1'+pathname,{
  method,headers,...(method==='POST'?{body:JSON.stringify(body??{})}:{})
 });
 const raw=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('M4_03_SETUP_API_'+method+'_'+pathname+
  '_'+response.status+'_'+(raw.code??'UNKNOWN'));
 return raw.data;
}
async function run(){
 const key=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'M4F-'+key,companyName:'Disposable M4 browser company',
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'C-'+key,customerName:'Synthetic customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,projectCode:'P-'+key,
  projectName:'Synthetic no-work and closeout site',contractValue:'1000',
  plannedStartDate:new Date('2026-11-01'),
  plannedCompletionDate:new Date('2027-12-31'),
 }});
 const perms=[
  'site.daily_report.create','site.daily_report.edit',
  'site.daily_report.submit','site.daily_report.view',
  'projects.project.view','projects.project.edit',
 ];
 const ids=new Map();
 for(const code of perms){
  const v=await db.permission.upsert({where:{permissionCode:code},
   update:{},create:{permissionCode:code,
    moduleCode:code.slice(0,code.indexOf('.')).toUpperCase()}});
  ids.set(code,v.id);
 }
 async function actor(label,roleCode,codes){
  const employee=await db.employee.create({data:{companyId:company.id,
   employeeCode:label+key,employeeName:'Synthetic '+label}});
  const user=await db.user.create({data:{companyId:company.id,
   employeeId:employee.id,email:label.toLowerCase()+'-'+key+'@example.invalid',
   displayName:label,passwordHash:'not-a-login'}});
  const role=(await db.role.findFirst({where:{companyId:company.id,roleCode}}))??
   await db.role.create({data:{companyId:company.id,
    roleCode,roleName:roleCode}});
  await db.rolePermission.createMany({data:codes.map(code=>({
   roleId:role.id,permissionId:ids.get(code)})),skipDuplicates:true});
  await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:employee.id,projectRole:roleCode}});
  const live=await sessions.create(user.id);
  return {id:user.id,token:live.sessionToken,csrf:live.csrfToken,
   sessionId:live.sessionId};
 }
 const foreman=await actor('Foreman','PROJECT_ENGINEER',[
  'site.daily_report.create','site.daily_report.edit',
  'site.daily_report.submit','site.daily_report.view']);
 const pm=await actor('Khaimook','PROJECT_MANAGER',[
  'projects.project.view','projects.project.edit','site.daily_report.view']);
 const ben=await actor('Ben','MANAGEMENT',[
  'projects.project.view','site.daily_report.view']);
 const nancy=await actor('Nancy','FINANCE_MANAGER',['projects.project.view']);
 const beforeStock=await db.stockTransaction.count({where:{companyId:company.id}});
 const beforeFinance=await db.directCostPosting.count({where:{companyId:company.id}});
 const calendar=await db.workingCalendar.create({data:{
  companyId:company.id,projectId:project.id,
  calendarName:'Explicit workdays, not calendar assumptions',
  timezoneName:'Asia/Singapore',isDefault:true,
 }});
 await db.workingCalendarWeekday.createMany({data:
  Array.from({length:7},(_,i)=>({workingCalendarId:calendar.id,
   weekdayNo:i+1,isWorking:true}))});
 const report=await call(foreman,'POST','/site-execution/reports',{
  projectId:project.id,reportDate:'2026-11-23',manpower:[],
  materialUsage:[],equipmentUsage:[],progress:[],issues:[],delays:[],inspections:[],
 });
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/no-work',{
  reason:'No work due to site access restriction',
 });
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/submit',{});
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/no-work/corrections',{
  reason:'Updated access closure details',
 });
 const entry=[
  "import React from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {QueryClient,QueryClientProvider} from '@tanstack/react-query';",
  "import {WeeklySiteSummaryPanel} from '/src/site-execution/WeeklySiteSummaryPanel.tsx';",
  "import {ProjectCloseoutPanel} from '/src/projects/ProjectCloseoutPanel.tsx';",
  "import {MonetaryLocaleContext} from '/src/role-ui/monetary-presentation.tsx';",
  "const projectId="+JSON.stringify(project.id)+";",
  "const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});",
  "(async()=>{",
  " const res=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});",
  " if(res.status!==200)throw Error('AUTHENTICATED_REAL_SESSION_REQUIRED');",
  " const me=(await res.json()).data;",
  " if(!me.id||!me.companyId||!Array.isArray(me.permissions)||!Array.isArray(me.roleCodes))throw Error('INVALID_REAL_IDENTITY');",
  " document.body.dataset.identity=me.id;",
  " document.body.dataset.company=me.companyId;",
  " document.body.dataset.roles=me.roleCodes.join(',');",
  " const content=new URLSearchParams(location.search).get('view')==='weekly'",
  "  ? <WeeklySiteSummaryPanel projectId={projectId} onOpenReport={()=>{}} canAcknowledge={me.roleCodes.includes('MANAGEMENT')}/>",
  "  : <ProjectCloseoutPanel projectId={projectId} permissions={me.permissions} roleCodes={me.roleCodes}/>;",
  " createRoot(document.getElementById('root')).render(",
  "  <QueryClientProvider client={client}><MonetaryLocaleContext.Provider value='en'>{content}</MonetaryLocaleContext.Provider></QueryClientProvider>);",
  " document.body.dataset.authenticated='yes';",
  "})().catch(error=>{document.body.dataset.authenticated='no';document.body.dataset.failure=error.message;});",
 ].join('\n');
 vite=await createServer({root:WEB_ROOT,configFile:false,
  server:{host:'127.0.0.1',port:44363,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[{name:'m4-03-real-browser-only',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(!req.url?.startsWith('/__m4-fm01-closeout'))return next();
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__m4-03-live.tsx"></script></body></html>');
   });},
   resolveId(id){if(id==='/__m4-03-live.tsx')return 'virtual:m4-03-live';},
   async load(id){if(id==='virtual:m4-03-live')return transformWithOxc(
    entry,path.join(WEB_ROOT,'__m4-03-live.tsx'),{
     lang:'tsx',jsx:{runtime:'automatic'}});},
  }]});
 await vite.listen();
 browser=await startBrowser(chrome,tmp);
 const p=browser.protocol,contexts=[],errors=[];
 const local=new Set([new URL(WEB).origin,new URL(API).origin]);
 const observer=event=>{
  if(event.method==='Fetch.requestPaused'){
   const id=event.params?.requestId;
   let permitted=false;
   try{
    const u=new URL(event.params?.request?.url??'');
    permitted=u.protocol==='http:'&&local.has(u.origin)&&!u.username&&!u.password;
   }catch{}
   if(!permitted)errors.push('M4_03_NONLOCAL_REQUEST');
   void p.send(permitted?'Fetch.continueRequest':'Fetch.failRequest',
    permitted?{requestId:id}:{requestId:id,errorReason:'BlockedByClient'},
    event.sessionId).catch(()=>errors.push('M4_03_FETCH_INTERCEPTION_FAILED'));
   return;
  }
  if(event.method==='Network.responseReceived'){
   const u=event.params?.response?.url??'',code=event.params?.response?.status??0;
   if(u.startsWith(WEB+'/api/v1/')&&code>=400)
    errors.push('M4_03_UNEXPECTED_BROWSER_HTTP_'+code);
  }else if(event.method==='Runtime.exceptionThrown')
   errors.push('M4_03_UNHANDLED_BROWSER_JS');
 };
 p.listeners.add(observer);
 async function session(person,view){
  const ctx=(await p.send('Target.createBrowserContext')).browserContextId;
  contexts.push(ctx);
  const target=(await p.send('Target.createTarget',{
   url:'about:blank',browserContextId:ctx})).targetId;
  const s=(await p.send('Target.attachToTarget',{
   targetId:target,flatten:true})).sessionId;
  await p.send('Network.enable',{},s);
  await p.send('Page.enable',{},s);
  await p.send('Runtime.enable',{},s);
  await p.send('Fetch.enable',{
   patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
  const cookie=await p.send('Network.setCookie',{
   name:'erp_session',value:person.token,url:WEB,httpOnly:true,sameSite:'Lax'},s);
  assert.equal(cookie.success,true);
  await p.send('Page.navigate',{
   url:WEB+'/__m4-fm01-closeout?view='+view},s);
  await until(p,s,()=>document.body?.dataset?.authenticated==='yes',
   null,'REAL_AUTHENTICATED_COOKIE');
  assert.equal(await page(p,s,()=>document.body.dataset.identity),person.id);
  return s;
 }
 try{
  stage='FOREMAN_WEEKLY_READONLY';
  const f=await session(foreman,'weekly');
  await visible(p,f,'Weekly site report');
  await inputAt(p,f,'First day of seven-day period',0,'2026-11-23');
  await visible(p,f,'Updated access closure details');
  const unauthorized=await page(p,f,()=>[...document.querySelectorAll('button')]
   .some(b=>b.textContent?.trim()==='Acknowledge reviewed weekly source'));
  assert.equal(unauthorized,false,'Foreman must never see Ben acknowledgment control');
  console.log('M4_03_FM01_FOREMAN_REAL_WEEKLY_READONLY_PASS');

  stage='BEN_WEEKLY_ACK';
  const b=await session(ben,'weekly');
  await inputAt(p,b,'First day of seven-day period',0,'2026-11-23');
  await visible(p,b,'Updated access closure details');
  await click(p,b,'Acknowledge reviewed weekly source');
  await visible(p,b,'Reviewed');
  const reviewed=await call(ben,'GET','/site-execution/reports/weekly?projectId='+
   project.id+'&from=2026-11-23&to=2026-11-29');
  assert.equal(reviewed.reviewAcknowledgment.status,'CURRENT');
  assert.equal(reviewed.reviewAcknowledgment.authority,
   'MANAGEMENT_REVIEW_ONLY_NOT_APPROVAL');
  console.log('M4_03_FM01_BEN_REAL_WEEKLY_ACK_PASS');

  stage='PM_SIX_CATEGORY_CLOSEOUT_PREPARE';
  const k=await session(pm,'closeout');
  await visible(p,k,'Operational Project closeout');
  for(let i=0;i<6;i++){
   await inputAt(p,k,'Source evidence / record reference',i,
    'SOURCE-'+(i+1)+'-'+key);
   await inputAt(p,k,'Evidence note and remaining concerns',i,
    'Synthetic source reviewed for category '+(i+1));
  }
  await inputAt(p,k,'Khaimook preparation summary',0,
   'All six operational checks recorded; no settlement or archive');
  await click(p,k,'Save six-category preparation (append-only revision)');
  await visible(p,k,'Preparation version: 1');
  const prepared=await call(pm,'GET','/projects/'+project.id+'/closeout');
  assert.equal(prepared.status,'PREPARED');
  assert.equal(prepared.current.preparation.checklist.length,6);
  console.log('M4_03_BEN04_PM_REAL_SIX_CATEGORY_PREPARE_PASS');

  stage='BEN_INDEPENDENT_SIGN';
  const bs=await session(ben,'closeout');
  await visible(p,bs,'Preparation version: 1');
  await inputAt(p,bs,'Reviewer note (mandatory when warnings remain)',0,
   'Ben independently reviewed source obligations');
  await click(p,bs,'Sign this exact preparation (not archive/payment)');
  await visible(p,bs,'Signed');
  console.log('M4_03_BEN04_BEN_REAL_INDEPENDENT_SIGN_PASS');

  stage='NANCY_INDEPENDENT_SIGN';
  const n=await session(nancy,'closeout');
  await visible(p,n,'Preparation version: 1');
  await inputAt(p,n,'Reviewer note (mandatory when warnings remain)',0,
   'Nancy independently reviewed without financial posting');
  await click(p,n,'Sign this exact preparation (not archive/payment)');
  await visible(p,n,'JOINTLY_APPROVED');
  const closed=await call(nancy,'GET','/projects/'+project.id+'/closeout');
  assert.equal(closed.status,'JOINTLY_APPROVED');
  assert.ok(closed.current.signatures.BEN);
  assert.ok(closed.current.signatures.NANCY);
  assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).isActive,true);
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),beforeFinance);
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),beforeStock);
  assert.deepEqual(errors,[],'No unexpected API, external network or JS errors');
  console.log('M4_03_PM16_BEN_NANCY_REAL_SIGNOFF_NO_FINANCE_STOCK_PASS');
  console.log('M4_03_ACTUAL_CHROMIUM_NEST_PG17_SCOPED_PASS');
 }finally{
  p.listeners.delete(observer);
  for(const id of contexts.reverse())
   await p.send('Target.disposeBrowserContext',{browserContextId:id}).catch(()=>{});
 }
}
try{await run();}
catch(error){
 console.error('M4_03_BROWSER_SOURCE_UNVERIFIED_'+stage+': '+
  String(error?.message??error).slice(0,280));
 process.exitCode=1;
}finally{
 try{if(browser)await browser.stop();}finally{
  try{if(vite)await vite.close();}finally{
   await app.close();await rm(tmp,{recursive:true,force:true});
  }
 }
}
