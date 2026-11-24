// PUR08/PUR14 one NEW authenticated supplier-case browser journey:
// real NestJS + Vite React/MUI + Chrome + PostgreSQL 17.11.
// Synthetic disposable Company, existing actual approved PO/GR, uploaded files.
// No retained users, external supplier messages, production, or full CI replay.
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
const uri=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true','GITHUB_DISPOSABLE_ONLY');
assert.equal(process.env.PUR0814_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.platform,'linux');
assert.ok(['127.0.0.1','localhost'].includes(uri.hostname));
assert.equal(uri.port,'5432');
assert.equal(uri.pathname,'/construction_erp');
const browserExe=['google-chrome','chromium','chromium-browser']
  .find(x=>spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(browserExe,'REAL_CHROME_REQUIRED');
const API='http://127.0.0.1:31386';
const WEB='http://127.0.0.1:44386';
const tmp=await mkdtemp(path.join(os.tmpdir(),'erp-pur08-14-chrome-'));
process.env.STORAGE_ROOT=path.join(tmp,'documents');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(tmp,'uploads');
process.env.VITE_API_BASE_URL=WEB+'/api/v1';
process.env.NODE_ENV='test';
apiRequire('reflect-metadata');
const {NestFactory}=apiRequire('@nestjs/core');
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
await app.listen(31386,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
let vite=null,browser=null,stage='INIT';
const sleep=ms=>new Promise(ok=>setTimeout(ok,ms));
const checkPath='/api/v1/procurement/purchase-orders/';

async function page(protocol,session,fn,arg){
 const r=await protocol.send('Runtime.evaluate',{
  expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
  awaitPromise:true,returnByValue:true,
 },session);
 if(r.exceptionDetails||!r.result||r.result.type==='error')
  throw new Error('CHROME_RUNTIME_EVALUATION_FAILED');
 return r.result.value;
}
async function until(protocol,session,fn,arg,label){
 for(let i=0;i<115;i++){
  try{if(await page(protocol,session,fn,arg))return;}
  catch(e){if(!['BROWSER_PROTOCOL_COMMAND_FAILED','CHROME_RUNTIME_EVALUATION_FAILED'].includes(e?.message))throw e;}
  await sleep(170);
 }
 throw new Error('CHROME_TIMEOUT_'+label);
}
async function visible(protocol,session,s){
 await until(protocol,session,v=>(document.getElementById('root')?.textContent??'').includes(v),
  s,'VISIBLE_'+s.slice(0,20));
}
async function click(protocol,session,match){
 await until(protocol,session,t=>[...document.querySelectorAll('button')].some(
  b=>b.textContent?.trim().includes(t)&&!b.disabled),match,'BUTTON_'+match);
 const ok=await page(protocol,session,t=>{
  const b=[...document.querySelectorAll('button')].find(
   b=>b.textContent?.trim().includes(t)&&!b.disabled);
  if(!b)return false;b.click();return true;
 },match);
 assert.equal(ok,true,'BUTTON_NOT_CLICKED_'+match);
}
async function input(protocol,session,label,value){
 await until(protocol,session,({label,value})=>{
  const l=[...document.querySelectorAll('label')]
   .find(x=>x.textContent?.replaceAll('*','').trim()===label);
  if(!l)return false;
  const direct=l.htmlFor?document.getElementById(l.htmlFor):null;
  const el=direct instanceof HTMLInputElement||direct instanceof HTMLTextAreaElement?
   direct:l.closest('.MuiFormControl-root')?.querySelector('textarea:not([aria-hidden]),input');
  if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)||el.disabled)return false;
  const proto=el instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return el.value===value;
 },{label,value},'TEXT_'+label.slice(0,24));
 await sleep(150);
}
async function select(protocol,session,label,choice){
 // Open one MUI non-native select by label, then select the visible portal option.
 await until(protocol,session,x=>{
  const l=[...document.querySelectorAll('label')]
   .find(e=>e.textContent?.replaceAll('*','').trim()===x);
  const cb=l?.htmlFor?document.getElementById(l.htmlFor):
   l?.closest('.MuiFormControl-root')?.querySelector('[role="combobox"]');
  if(!cb||cb.getAttribute('aria-disabled')==='true')return false;
  cb.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true}));
  return true;
 },label,'MUI_OPEN_'+label);
 await until(protocol,session,x=>[...document.querySelectorAll('[role="option"]')]
  .some(el=>el.textContent?.includes(x)),choice,'MUI_CHOICE_'+choice.slice(0,18));
 const ok=await page(protocol,session,x=>{
  const o=[...document.querySelectorAll('[role="option"]')]
    .find(el=>el.textContent?.includes(x));
  if(!o)return false;o.click();return true;
 },choice);
 assert.equal(ok,true,'MUI_OPTION_NOT_CLICKED');
 await until(protocol,session,()=>document.querySelectorAll('[role="option"]').length===0,
   null,'MUI_MENU_CLOSED');
}

async function run(){
 stage='SYNTHETIC_APPROVED_PO_REAL_RECEIVING';
 const {receivingProofFixture}=apiRequire('./dist/inventory/receiving-proof-fixture.js');
 const {f,id:deliveryId,grId,docs}=await receivingProofFixture(db,app,true);
 assert.ok(grId&&docs.length>=1,'RECEIVING_POSTED_GR_AND_DOCUMENT_REQUIRED');
 const {store,jai,pm,outsider,po,project,company}=f;
 // The existing receiving fixture uses fixture-only labels as role codes. Convert
 // ONLY these newly created synthetic Company roles to the real policy roles.
 await db.role.update({where:{id:store.role.id},data:{roleCode:'STOREKEEPER'}});
 await db.role.update({where:{id:jai.role.id},data:{roleCode:'PROCUREMENT_OFFICER'}});
 await db.role.update({where:{id:pm.role.id},data:{roleCode:'PROJECT_MANAGER'}});
 const view=await db.permission.findUniqueOrThrow({where:{permissionCode:'procurement.po.view'}});
 await db.rolePermission.create({data:{roleId:jai.role.id,permissionId:view.id}});
 // Outsider has the Store role, but NO Project membership: must fail scope.
 await db.userRole.create({data:{
  companyId:company.id,userId:outsider.user.id,roleId:store.role.id,
 }});
 const actor=[store,jai,pm].map(a=>({token:a.session.sessionToken,csrf:a.session.csrfToken}));
 for(const a of actor)assert.ok((await sessions.resolve(a.token))?.roleCodes.length);
 const initialStock=await db.stockTransaction.count({where:{companyId:company.id}});
 const initialFinance=await db.supplierInvoice.count({where:{companyId:company.id}});
 const initialPayments=await db.payment.count({where:{companyId:company.id}});
 const url=checkPath+po.id+'/supplier-case';
 const scoped=async(a,pathname,opts={})=>fetch(API+pathname,{
  ...opts,headers:{cookie:'erp_session='+a.token,...opts.headers},
 });
 const storeActor=actor[0],jaiActor=actor[1],pmActor=actor[2];
 stage='REAL_HTTP_SECURITY_NEGATIVE_GATES';
 const noSession=await fetch(API+url);
 assert.equal(noSession.status,401,'Must reject anonymous supplier case');
 const missingCsrf=await scoped(storeActor,url+'/events',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({action:'REPORT_DISCREPANCY'}),
 });
 assert.equal(missingCsrf.status,403,'Mutation without CSRF must fail before body');
 const scopeDenied=await scoped({token:outsider.session.sessionToken},url);
 assert.ok([403,404].includes(scopeDenied.status),'Nonmember Store must not read Project case');
 const actualDocument=await scoped(storeActor,
  '/api/v1/documents/projects/'+project.id+'/targets/RECEIVING_DELIVERY/'+deliveryId+
  '/'+docs[0].id+'/download');
 assert.equal(actualDocument.status,200,'Source document download not accessible');
 assert.deepEqual(Buffer.from(await actualDocument.arrayBuffer()),
  Buffer.from(docs[0].bytes,'base64'),'Real evidence bytes differ from uploaded source');
 console.log('PUR0814_REAL_AUTH_CSRF_PROJECT_AND_UPLOADED_BYTES_PASS');

 stage='START_REAL_VITE_REACT_CHROME';
 const entry=[
  "import React from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {QueryClient,QueryClientProvider} from '@tanstack/react-query';",
  "import {MonetaryLocaleContext} from '/src/role-ui/monetary-presentation.tsx';",
  "import {ReceivingPanel} from '/src/inventory/ReceivingPanel.tsx';",
  "import {SupplierDeliveryCasePanel} from '/src/procurement/SupplierDeliveryCasePanel.tsx';",
  "const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});",
  "(async()=>{",
  " const r=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});",
  " if(r.status!==200)throw Error('SYNTHETIC_COOKIE_LOGIN_REQUIRED');",
  " const me=(await r.json()).data;",
  " if(!me.id||!me.companyId||!Array.isArray(me.roleCodes)||!Array.isArray(me.permissions))throw Error('ROLE_IDENTITY_REQUIRED');",
  " document.body.dataset.identity=me.id;",
  " document.body.dataset.roles=me.roleCodes.join(',');",
  " const node=me.roleCodes.includes('STOREKEEPER')?",
  "  <ReceivingPanel permissions={me.permissions} roleCodes={me.roleCodes} userId={me.id}",
  "   companyId={me.companyId} onOpenGr={()=>{}}/>:",
  "  <SupplierDeliveryCasePanel orderId="+JSON.stringify(po.id)+" permissions={me.permissions}",
  "   roleCodes={me.roleCodes} preferredEvidenceDocumentId="+JSON.stringify(docs[0].id)+"/>;",
  " createRoot(document.getElementById('root')).render(",
  " <QueryClientProvider client={qc}><MonetaryLocaleContext.Provider value='en'>{node}</MonetaryLocaleContext.Provider></QueryClientProvider>);",
  " document.body.dataset.authenticated='yes';",
  "})().catch(e=>{document.body.dataset.authenticated='no';document.body.dataset.failure=e.message;});",
 ].join('\n');
 vite=await createServer({
  root:WEB_ROOT,configFile:false,
  server:{host:'127.0.0.1',port:44386,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[{name:'pur0814-focused-real-ui',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__pur0814-real')return next();
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__pur0814-browser.tsx"></script></body></html>');
   });},
   resolveId(id){if(id==='/__pur0814-browser.tsx')return 'virtual:pur0814-real';},
   async load(id){if(id==='virtual:pur0814-real')return transformWithOxc(
    entry,path.join(WEB_ROOT,'__pur0814-browser.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});
   },
  }],
 });
 await vite.listen();
 browser=await startBrowser(browserExe,tmp);
 const protocol=browser.protocol,contexts=[],external=[],jsErrors=[];
 const okOrigin=new Set([new URL(API).origin,new URL(WEB).origin]);
 const onBrowser=e=>{
  if(e.method==='Fetch.requestPaused'){
   let allow=false;
   try{const u=new URL(e.params?.request?.url??'');
    allow=u.protocol==='http:'&&okOrigin.has(u.origin)&&!u.username&&!u.password;
   }catch{}
   if(!allow)external.push('EXTERNAL_REQUEST_BLOCKED');
   const requestId=e.params?.requestId;
   void protocol.send(allow?'Fetch.continueRequest':'Fetch.failRequest',
    allow?{requestId}:{requestId,errorReason:'BlockedByClient'},e.sessionId)
    .catch(()=>external.push('INTERCEPT_FAILURE'));
   return;
  }
  if(e.method==='Runtime.exceptionThrown')jsErrors.push('UNHANDLED_BROWSER_JS');
 };
 protocol.listeners.add(onBrowser);
 async function open(a){
  const {browserContextId}=await protocol.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  const {targetId}=await protocol.send('Target.createTarget',{url:'about:blank',browserContextId});
  const sid=(await protocol.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await protocol.send('Network.enable',{},sid);
  await protocol.send('Page.enable',{},sid);
  await protocol.send('Runtime.enable',{},sid);
  await protocol.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},sid);
  const cookie=await protocol.send('Network.setCookie',{
   name:'erp_session',value:a.session.sessionToken,url:WEB,httpOnly:true,sameSite:'Lax',
  },sid);
  assert.equal(cookie.success,true);
  await protocol.send('Page.navigate',{url:WEB+'/__pur0814-real'},sid);
  await until(protocol,sid,()=>document.body?.dataset?.authenticated==='yes',
   null,'REAL_SESSION_LOGIN');
  assert.equal(await page(protocol,sid,()=>document.body.dataset.identity),a.user.id);
  return sid;
 }
 async function openStoreReceipt(){
  const sid=await open(store);
  await visible(protocol,sid,'Receiving');
  await select(protocol,sid,'Project',project.projectName);
  await until(protocol,sid,()=>[...document.querySelectorAll('button')]
   .some(b=>b.textContent?.includes('Store receiver')),null,'REAL_RECEIVING_ROW');
  await click(protocol,sid,'Store receiver');
  await visible(protocol,sid,'Supplier delivery and discrepancy evidence (PUR08/PUR14)');
  const existing=await page(protocol,sid,()=>{
   const l=[...document.querySelectorAll('label')].find(e=>
    e.textContent?.includes('Existing authorized Project Document UUID'));
   const el=l?.htmlFor?document.getElementById(l.htmlFor):null;
   return el instanceof HTMLInputElement?el.value:'';
  });
  assert.equal(existing,docs[0].id,'Real receiving evidence must prefill supplier case');
  return sid;
 }
 try{
  stage='STORE_REAL_RECEIVING_BROWSER_DISCREPANCY';
  const storeSid=await openStoreReceipt();
  await visible(protocol,storeSid,'Record source-linked evidence');
  await input(protocol,storeSid,
   'Evidence notes (not a substitute for a real supplier acknowledgment)',
   'Damaged delivery seen and evidence uploaded on site');
  await click(protocol,storeSid,'Record source-linked evidence');
  await visible(protocol,storeSid,'DISCREPANCY_REPORTED');
  const beforeReview=await db.auditLog.count({
   where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:po.id},
  });
  assert.equal(beforeReview,1,'Browser must create exactly one Store discrepancy event');
  console.log('PUR0814_REAL_STORE_RECEIVING_CHROME_REPORT_PASS');

  stage='PM_REAL_CHROME_INDEPENDENT_REVIEW';
  const pmSid=await open(pm);
  await visible(protocol,pmSid,'DISCREPANCY_REPORTED');
  await select(protocol,pmSid,'Khaimook decision','REQUEST_RETURN');
  await input(protocol,pmSid,
   'Evidence notes (not a substitute for a real supplier acknowledgment)',
   'Independent PM decision to request physical supplier return');
  await click(protocol,pmSid,'Record source-linked evidence');
  await visible(protocol,pmSid,'PM_REVIEWED');
  console.log('PUR0814_REAL_PM_CHROME_INDEPENDENT_REVIEW_PASS');

  stage='JAI_REAL_CHROME_CLAIM';
  const jaiSid=await open(jai);
  await visible(protocol,jaiSid,'PM_REVIEWED');
  await input(protocol,jaiSid,
   'Evidence notes (not a substitute for a real supplier acknowledgment)',
   'Purchasing claim recorded with actual receiver evidence');
  await click(protocol,jaiSid,'Record source-linked evidence');
  await visible(protocol,jaiSid,'CLAIM_RECORDED');
  console.log('PUR0814_REAL_JAI_CHROME_CLAIM_PASS');

  stage='STORE_REAL_CHROME_RETURN_REPORT_ONLY';
  const finalStore=await openStoreReceipt();
  await visible(protocol,finalStore,'CLAIM_RECORDED');
  await input(protocol,finalStore,
   'Evidence notes (not a substitute for a real supplier acknowledgment)',
   'Actual physical outward supplier handover evidenced; financial credit remains separate');
  await click(protocol,finalStore,'Record source-linked evidence');
  await visible(protocol,finalStore,'RETURN_DISPATCH_RECORDED');

  const logs=await db.auditLog.findMany({
   where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:po.id},
   select:{action:true,actorUserId:true},
  });
  assert.equal(logs.length,4,'Exactly four append-only case records');
  for(const [name,who] of [
   ['REPORT_DISCREPANCY',store],['PM_REVIEW_DISCREPANCY',pm],
   ['JAI_RECORD_CLAIM',jai],['STORE_RECORD_RETURN_DISPATCH',store]]){
   assert.equal(logs.filter(x=>x.action===name&&x.actorUserId===who.user.id).length,1,
    'Named role separation for '+name);
  }
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),initialStock);
  assert.equal(await db.supplierInvoice.count({where:{companyId:company.id}}),initialFinance);
  assert.equal(await db.payment.count({where:{companyId:company.id}}),initialPayments);
  assert.deepEqual(external,[],'No nonlocal browser requests');
  assert.deepEqual(jsErrors,[],'No unhandled UI JS exceptions');
  console.log('PUR0814_REAL_CHROME_NEST_PG17_FOUR_ROLE_EVENTS_NO_SIDE_EFFECTS_PASS');
 }finally{
  protocol.listeners.delete(onBrowser);
  for(const ctx of contexts.reverse())
   await protocol.send('Target.disposeBrowserContext',{browserContextId:ctx}).catch(()=>{});
 }
}
try{await run();}
catch(error){
 console.error('PUR0814_AUTHENTICATED_CHROME_FAILED_'+stage+': '+
  String(error?.message??error).slice(0,330));
 process.exitCode=1;
}finally{
 try{if(browser)await browser.stop();}finally{
  try{if(vite)await vite.close();}finally{
   await app.close();await rm(tmp,{recursive:true,force:true});
  }
 }
}
