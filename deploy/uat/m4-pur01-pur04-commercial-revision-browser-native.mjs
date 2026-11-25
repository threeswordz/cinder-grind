// M4 PUR01/PUR04 actual authenticated revised commercial header and independent Ben exception approval browser test.
// Disposable localhost PG17.11 + Nest + real React/MUI + Chrome CDP ONLY.
// Source alone is NOT a PASS. No retained users, Mac, external endpoints or Production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
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
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true','Only disposable GitHub runner');
assert.equal(process.platform,'linux');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,'/erp_m4_pur01_pur04_browser');
const API='http://127.0.0.1:31364';
const WEB='http://127.0.0.1:44364';
const executable=['google-chrome','chromium','chromium-browser'].find(x=>
 spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(executable,'PUR07_ACTUAL_CHROME_REQUIRED');
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-pur01-browser-'));
process.env.STORAGE_ROOT=path.join(temp,'docs');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(temp,'uploads');
process.env.VITE_API_BASE_URL=WEB+'/api/v1';

const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProcurementService}=apiRequire('./dist/procurement/procurement.service.js');
const {SourcingService}=apiRequire('./dist/procurement/sourcing.service.js');
const {PurchaseOrderService}=apiRequire('./dist/procurement/purchase-order.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {Prisma}=apiRequire('@prisma/client');
const {createServer,transformWithOxc}=
 await import(pathToFileURL(webRequire.resolve('vite')).href);
const {default:reactPlugin}=await import(pathToFileURL(webRequire.resolve('@vitejs/plugin-react')).href);
const D=value=>new Prisma.Decimal(value);
const pdfServerResponses=[];
let expectedPdfPath=null;
const app=await NestFactory.create(AppModule,{logger:['warn','error']});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
// Observe only the exact synthetic PO PDF route; no credentials or bodies logged.
app.use((req,res,next)=>{
 if(req.method==='GET'&&expectedPdfPath&&req.path===expectedPdfPath){
  res.once('finish',()=>pdfServerResponses.push({status:res.statusCode,
   mimeType:String(res.getHeader('content-type')??'').split(';')[0]}));
 }
 next();
});
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31364,'127.0.0.1');
const db=app.get(PrismaService);
const sessions=app.get(SessionService);
const prs=app.get(ProcurementService);
const sourcing=app.get(SourcingService);
const pos=app.get(PurchaseOrderService);
let vite=null,browser=null,stage='SETUP';
const delay=ms=>new Promise(done=>setTimeout(done,ms));

async function page(protocol,session,fn,arg){
 const r=await protocol.send('Runtime.evaluate',{
  expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',
  awaitPromise:true,returnByValue:true,
 },session);
 if(r.exceptionDetails||!r.result||r.result.type==='error')
  throw new Error('PUR07_REAL_BROWSER_EVALUATION_FAILED');
 return r.result.value;
}
async function until(p,s,fn,arg,label){
 for(let n=0;n<130;n++){
  try{if(await page(p,s,fn,arg))return;}
  catch(e){
   const code=e?.safeCode??e?.message??'UNKNOWN';
   if(!['BROWSER_PROTOCOL_COMMAND_FAILED','PUR07_REAL_BROWSER_EVALUATION_FAILED'].includes(code))
    throw e;
  }
  await delay(175);
 }
 throw new Error('PUR07_REAL_BROWSER_TIMEOUT_'+label);
}
async function visible(p,s,value){
 await until(p,s,v=>(document.getElementById('root')?.textContent??'').includes(v),
 value,'VISIBLE_'+value.slice(0,24));
}
async function click(p,s,value){
 await until(p,s,v=>[...document.querySelectorAll('button')].some(
  b=>b.textContent?.trim()===v&&!b.disabled),value,'CLICKABLE_'+value.slice(0,25));
 const clicked=await page(p,s,v=>{
  const b=[...document.querySelectorAll('button')].find(
   b=>b.textContent?.trim()===v&&!b.disabled);
  if(!b)return false;
  b.click();return true;
 },value);
 assert.equal(clicked,true,'PUR07_REAL_BUTTON_NOT_CLICKED_'+value);
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
 assert.equal(opened,true,'PUR07_SELECT_NOT_FOUND_'+label);
 await until(p,s,value=>[...document.querySelectorAll('[role="option"]')].some(
  x=>x.textContent?.includes(value)),option,'OPTION_'+option);
 const selected=await page(p,s,value=>{
  const target=[...document.querySelectorAll('[role="option"]')].find(
   x=>x.textContent?.includes(value));
  if(!target)return false;target.click();return true;
 },option);
 assert.equal(selected,true,'PUR07_OPTION_NOT_SELECTED_'+label);
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
 await until(p,s,({label,value})=>{
  const elLabel=[...document.querySelectorAll('label')].find(l=>
   l.textContent?.replaceAll('*','').trim()===label);
  if(!elLabel)return false;
  const direct=elLabel.htmlFor?document.getElementById(elLabel.htmlFor):null;
  const el=direct instanceof HTMLInputElement||direct instanceof HTMLTextAreaElement?
   direct:elLabel.closest('.MuiFormControl-root')?.querySelector(
    'textarea:not([aria-hidden="true"]),input');
  if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement)||el.disabled)
   return false;
  const proto=el instanceof HTMLInputElement?
   HTMLInputElement.prototype:HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
  return el.value===value;
 },{label,value},'INPUT_'+label.slice(0,22));
 await delay(180);
}

async function run(){
 const suffix=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'MKE',companyName:'PUR07 disposable browser only',
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'P01C-'+suffix,
  customerName:'PUR07 Browser synthetic customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,
  projectCode:'P01P-'+suffix,projectName:'PUR07 synthetic Project',
  contractValue:D('180000'),
  plannedStartDate:new Date('2026-10-01T00:00:00Z'),
  plannedCompletionDate:new Date('2027-12-31T00:00:00Z'),
 }});
 const uom=await db.unitOfMeasure.create({data:{
  companyId:company.id,uomCode:'EA-'+suffix,uomName:'Each',decimalPlaces:2,
 }});
 const permissions=[
  'procurement.pr.view','procurement.pr.manage','procurement.pr.submit',
  'procurement.pr.approve','procurement.rfq.view','procurement.rfq.manage',
  'procurement.quotation.view','procurement.quotation.manage',
  'procurement.award.select','procurement.po.view','procurement.po.create',
  'procurement.po.edit','procurement.po.submit','procurement.po.approve','procurement.po.revise',
 ];
 const permissionIds=new Map();
 for(const code of permissions){
  const v=await db.permission.upsert({where:{permissionCode:code},
   update:{},create:{permissionCode:code,moduleCode:'PROCUREMENT'}});
  permissionIds.set(code,v.id);
 }
 const roleCache=new Map();
 async function role(code){
  if(roleCache.has(code))return roleCache.get(code);
  const found=await db.role.create({data:{
   companyId:company.id,roleCode:code,roleName:'Synthetic '+code,
  }});
  roleCache.set(code,found);
  return found;
 }
 const prRole=await role('PUR07_PR_REVIEW_'+suffix);
 const poRole=await role('PUR07_PO_REVIEW_'+suffix);
 async function actor(label,assignment){
  const employee=await db.employee.create({data:{
   companyId:company.id,employeeCode:label.slice(0,3).toUpperCase()+suffix,
   employeeName:'Synthetic '+label,
  }});
  const user=await db.user.create({data:{
   companyId:company.id,employeeId:employee.id,
   email:label.toLowerCase()+'-'+suffix+'@example.invalid',
   displayName:'Synthetic '+label,passwordHash:'not-an-auth-password',
  }});
  const roleCodes=[];
  for(const {code,grants} of assignment){
   const r=await role(code);
   roleCodes.push(code);
   await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:r.id}});
   if(grants.length){
    await db.rolePermission.createMany({data:grants.map(g=>({
     roleId:r.id,permissionId:permissionIds.get(g),
    })),skipDuplicates:true});
   }
  }
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:employee.id,projectRole:'PUR07 fixture',
  }});
  const live=await sessions.create(user.id);
  return {
   id:user.id,token:live.sessionToken,csrf:live.csrfToken,roleCodes,
   auth:{
    sessionId:randomUUID(),userId:user.id,companyId:company.id,
    email:user.email,displayName:user.displayName,roleCodes,
    permissions,csrfTokenHash:'0'.repeat(64),
   },
  };
 }
 const maker=await actor('Store',[{code:'STOREKEEPER',grants:[
  'procurement.pr.view','procurement.pr.manage','procurement.pr.submit',
 ]}]);
 const khaimook=await actor('Khaimook',[
  {code:'PROJECT_MANAGER',grants:['procurement.pr.view','procurement.pr.approve']},
  {code:prRole.roleCode,grants:[]},
 ]);
 const jai=await actor('Jai',[{code:'PROCUREMENT_OFFICER',grants:[
  'procurement.po.view','procurement.po.create','procurement.po.edit',
  'procurement.po.submit','procurement.po.revise','procurement.rfq.view','procurement.rfq.manage',
  'procurement.quotation.view','procurement.quotation.manage',
  'procurement.award.select',
 ]}]);
 const ben=await actor('Ben',[
  {code:'MANAGEMENT',grants:['procurement.po.view','procurement.po.approve']},
  {code:poRole.roleCode,grants:[]},
 ]);
 // The real PO panel now also reads PUR10. Configure only the three
 // already-created independent synthetic actors for this disposable company.
 // Do not grant new permissions, fabricate a cancellation or suppress HTTP409.
 await db.systemSetting.create({data:{
  companyId:company.id,settingKey:'PUR10_NAMED_ACTORS_V1',
  settingValue:{jai:jai.id,khaimook:khaimook.id,ben:ben.id},
 }});
 for(const [entityType,sequenceCode,formatTemplate] of [
  ['PURCHASE_REQUEST','PURCHASE_REQUEST','PRYYMM-###'],
  ['RFQ','RFQ','RFQYYMM-###'],
  ['PURCHASE_ORDER','PURCHASE_ORDER','POYYMM-###'],
 ]){
  await db.numberSequence.create({data:{
   companyId:company.id,entityType,sequenceCode,formatTemplate,resetRule:'MONTHLY',
  }});
 }
 const prFlow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PUR07-PR-'+suffix,
  entityType:'PURCHASE_REQUEST',workflowName:'Synthetic Khaimook PR',
  steps:{create:[{stepNo:1,stepName:'Khaimook review',requiredApprovals:1,
   stepRoles:{create:[{roleId:prRole.id}]}}]},
 }});
 const poFlow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PUR07-PO-'+suffix,
  entityType:'PURCHASE_ORDER',workflowName:'Synthetic Ben PO',
  steps:{create:[{stepNo:1,stepName:'Independent Ben',requiredApprovals:1,
   stepRoles:{create:[{roleId:poRole.id}]}}]},
 }});
 const supplier=await db.supplier.create({data:{
  companyId:company.id,supplierCode:'PUR07-S-'+suffix,
  supplierName:'บริษัท เซมิคอนกรีต จำกัด',shortName:'SEMICON',
 }});
 // Fixture-only genuine backend services: normal approved Store PR,
 // Khaimook decision, Jai RFQ/THB quotation/award, real draft PO.
 // The actions under test below MUST originate in actual React browser.
 const request=await prs.createRequest({auth:maker.auth},project.id,'PUR07 quote exception');
 const prLine=await prs.createLine({auth:maker.auth},request.id,{
  lineType:'SERVICE',description:'บริการคอนกรีตสำหรับไซต์',
  quantity:D('1'),uomId:uom.id,
 });
 await prs.submitRequest({auth:maker.auth},request.id,prFlow.workflowCode);
 await prs.approveRequest({auth:khaimook.auth},request.id,'Synthetic valid demand');
 const rfq=await sourcing.createRfq({auth:maker.auth},project.id,{
  lines:[{purchaseRequestLineId:prLine.id,quantity:D('1')}],
 });
 await sourcing.inviteSupplier({auth:jai.auth},rfq.id,supplier.id);
 const quote=await sourcing.createQuotation({auth:jai.auth},rfq.id,supplier.id,{
  quotationDate:new Date(),supplierReference:'PUR07-AUTH-CHROME-'+suffix,
 });
 assert.equal(quote.currencyCode,'THB');
 const quotedLine=await sourcing.upsertQuotationLine(
  {auth:jai.auth},quote.id,rfq.lines[0].id,
  {quantity:D('1'),unitPrice:D('2000')},
 );
 const award=await sourcing.selectAward(
  {auth:jai.auth},rfq.lines[0].id,quotedLine.id,'Valid synthetic sole-supplier award',
 );
 const po=await pos.createOrder(
  {auth:jai.auth},project.id,[award.id],'Real UI exception flow only',
 );
 await pos.updateOrder({auth:jai.auth},po.id,{
  discountAmount:D('100'),freightAmount:D('50'),
  additionalChargeAmount:D('20'),vatRatePercent:D('7'),
  deliveryLocation:'โกดังไซต์งาน',paymentTerms:'เครดิต 30 วัน',
 });
 await pos.submit({auth:jai.auth},po.id,poFlow.workflowCode);
 const checked=await pos.approve({auth:ben.auth},po.id,'Ben independently approved sourced THB PO');
 assert.equal(checked.lifecycleState,'APPROVED');
 const exactIdentity='K-'+po.poNumber+' SEMICON';
 const persisted=await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}});
 assert.equal(persisted.displayNumber,exactIdentity);
 assert.equal(persisted.supplierShortNameSnapshot,'SEMICON');
 const finalAudit=await db.auditLog.findMany({where:{companyId:company.id,
  entityType:'PURCHASE_ORDER',entityId:po.id,action:'PUR01_FINAL_QUOTE_POLICY'}});
 assert.equal(finalAudit.length,1);
 assert.equal(finalAudit[0].actorUserId,ben.id);
 const basis=finalAudit[0].newValues;
 assert.equal(basis.netExVatTHB,'1970.00');
 assert.equal(basis.requiredSuppliers,1);
 assert.equal(basis.comparableSuppliers,1);
 assert.equal(basis.approvalInstanceId,persisted.approvalInstanceId);
 console.log('M4_V25_PUR01_PUR04_PUR12_FINAL_AUDIT_AND_IDENTITY_PASS');
 assert.equal((await pos.getOrder(ben.auth,po.id)).lines[0].quotationAward.supplierNameSnapshot,
  'บริษัท เซมิคอนกรีต จำกัด');
 console.log('M4_PUR07_REAL_APPROVED_PG_THAI_FIXTURE_PASS');
 const stockBefore=await db.stockTransaction.count({where:{companyId:company.id}});
 const financeBefore=await db.directCostPosting.count({where:{companyId:company.id}});

 const entry=[
  "import React from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {QueryClient,QueryClientProvider} from '@tanstack/react-query';",

  "import {MonetaryLocaleContext} from '/src/role-ui/monetary-presentation.tsx';",
  "import {PurchaseOrdersPanel} from '/src/procurement/PurchaseOrdersPanel.tsx';",
  "const classify=e=>{const m=String(e?.message??'');return ['Invalid hook call','Cannot read properties of null','No QueryClient set','React is not defined','Maximum update depth exceeded','is not a function','Cannot access','Cannot read properties of undefined'].find(x=>m.includes(x))??'OTHER_RENDER_EXCEPTION';};",
  "const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});",
  "(async()=>{",
  " const r=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});",
  " if(r.status!==200)throw Error('PUR07_AUTH_COOKIE_REQUIRED');",
  " const me=(await r.json()).data;",
  " if(!me.id||!me.companyId||!Array.isArray(me.roleCodes)||!Array.isArray(me.permissions))throw Error('PUR07_REAL_ROLE_MISSING');",
  " document.body.dataset.identity=me.id;",
  " document.body.dataset.roleCodes=me.roleCodes.join(',');",
  " document.body.dataset.cookieVerified='yes';",
  " if(typeof PurchaseOrdersPanel!=='function')throw Error('PUR07_PANEL_EXPORT_MISSING');",
  " document.body.dataset.moduleLoaded='yes';",
  " createRoot(document.getElementById('root'),{onUncaughtError(e){document.body.dataset.renderFailed='yes';document.body.dataset.renderError=classify(e);}}).render(",
  "  <QueryClientProvider client={client}><MonetaryLocaleContext.Provider value='en'>",
  "   <PurchaseOrdersPanel permissions={me.permissions} roleCodes={me.roleCodes} initialProjectId={new URLSearchParams(location.search).get('project')??undefined} initialOrderId={new URLSearchParams(location.search).get('order')??undefined}/>",
  "  </MonetaryLocaleContext.Provider></QueryClientProvider>);",
  " document.body.dataset.authenticated='yes';",
  "})().catch(e=>{document.body.dataset.authenticated='no';document.body.dataset.failure=e.message;});",
 ].join('\n');
 vite=await createServer({
  root:WEB_ROOT,configFile:false,
  resolve:{dedupe:['react','react-dom','@tanstack/react-query']},
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','@tanstack/react-query','@mui/material','@emotion/react','@emotion/styled']},
  server:{host:'127.0.0.1',port:44364,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[reactPlugin(),{name:'m4-pur07-only-new-chrome',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url?.split('?')[0]!=='/__pur07-real')return next();
    res.setHeader('Content-Type','text/html');
    res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__pur07-browser.tsx"></script></body></html>');
   });},
   resolveId(id){if(id==='/__pur07-browser.tsx')return 'virtual:pur07-browser';},
   async load(id){if(id==='virtual:pur07-browser')return transformWithOxc(
    entry,path.join(WEB_ROOT,'__pur07-browser.tsx'),{
     lang:'tsx',jsx:{runtime:'automatic'},
    });},
  }],
 });
 await vite.listen();
 browser=await startBrowser(executable,temp);
 const protocol=browser.protocol,contexts=[],errors=[],downloadHttp200=[];
 const pdfRequests=new Set(),pdfFailures=[],downloadStarted=new Map(),completedDownloads=new Set();
 const downloadDir=path.join(temp,'actual-browser-downloads');
 await mkdir(downloadDir,{mode:0o700});
 expectedPdfPath='/api/v1/procurement/purchase-orders/'+po.id+'/pdf';
 const local=new Set([new URL(API).origin,new URL(WEB).origin]);
 const handle=event=>{
  if(event.method==='Fetch.requestPaused'){
   const requestId=event.params?.requestId;
   let ok=false;
   try{
    const v=new URL(event.params?.request?.url??'');
    ok=v.protocol==='http:'&&local.has(v.origin)&&!v.username&&!v.password;
   }catch{}
   if(!ok)errors.push('PUR07_EXTERNAL_NETWORK_BLOCKED');
   void protocol.send(ok?'Fetch.continueRequest':'Fetch.failRequest',
    ok?{requestId}:{requestId,errorReason:'BlockedByClient'},
    event.sessionId).catch(()=>errors.push('PUR07_INTERCEPT_FAILURE'));
   return;
  }
  if(event.method==='Browser.downloadWillBegin'){
   const {guid,suggestedFilename}=event.params;
   downloadStarted.set(guid,suggestedFilename);return;
  }
  if(event.method==='Browser.downloadProgress'){
   if(event.params.state==='completed')completedDownloads.add(event.params.guid);
   if(event.params.state==='canceled')errors.push('PUR07_ACTUAL_DOWNLOAD_CANCELLED');
   return;
  }
  if(event.method==='Network.requestWillBeSent'){
   try{const u=new URL(event.params.request.url);
    if(u.origin===WEB&&u.pathname===expectedPdfPath&&event.params.request.method==='GET')
     pdfRequests.add(event.params.requestId);
   }catch{}
  }
  if(event.method==='Network.loadingFailed'&&pdfRequests.has(event.params.requestId))
   pdfFailures.push({canceled:Boolean(event.params.canceled),blocked:Boolean(event.params.blockedReason)});
  if(event.method==='Network.responseReceived'){
   const url=event.params?.response?.url??'';
   const status=event.params?.response?.status??0;
   if(url.endsWith('/procurement/purchase-orders/'+po.id+'/pdf')&&status===200){
    downloadHttp200.push({status,mimeType:event.params?.response?.mimeType});
   }else if(url.startsWith(WEB+'/api/v1/')&&status>=400){
    // Record only a normalized local path; never log query values or credentials.
    const route=new URL(url).pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,':id');
    errors.push('PUR07_UNEXPECTED_HTTP_'+status+' '+route);
   }
  }else if(event.method==='Runtime.exceptionThrown'){
   errors.push('PUR07_UNHANDLED_BROWSER_JS');
  }
 };
 protocol.listeners.add(handle);
 async function session(actor,sourceLink=false){
  const {browserContextId}=await protocol.send('Target.createBrowserContext');
  contexts.push(browserContextId);
  await protocol.send('Browser.setDownloadBehavior',{behavior:'allowAndName',browserContextId,downloadPath:downloadDir,eventsEnabled:true});
  const {targetId}=await protocol.send('Target.createTarget',{
   url:'about:blank',browserContextId,
  });
  const s=(await protocol.send('Target.attachToTarget',{
   targetId,flatten:true,
  })).sessionId;
  await protocol.send('Network.enable',{},s);
  await protocol.send('Page.enable',{},s);
  await protocol.send('Runtime.enable',{},s);
  await protocol.send('Fetch.enable',{
   patterns:[{urlPattern:'*',requestStage:'Request'}],
  },s);
  // A separate actual same-origin HTTP read isolates backend authentication
  // from Vite module loading; never print a session token or response payload.
  const direct=await fetch(WEB+'/api/v1/auth/me',{headers:{Cookie:'erp_session='+actor.token}});
  assert.equal(direct.status,200,'PUR07_PROXY_COOKIE_AUTH_FAILED');
  const directIdentity=(await direct.json()).data;
  assert.equal(directIdentity.id,actor.id);
  assert.deepEqual([...directIdentity.roleCodes].sort(),[...actor.roleCodes].sort());
  assert.ok(directIdentity.permissions.includes('procurement.po.view'));
  // Witness actual scoped API data separately from React state. No fake query
  // data, no grants or request interception beyond the existing local guard.
  for(const [route,expectedId] of [
   ['/procurement/po-projects',project.id],
   ['/procurement/projects/'+project.id+'/purchase-orders',po.id],
  ]){
   const response=await fetch(WEB+'/api/v1'+route,{headers:{Cookie:'erp_session='+actor.token}});
   assert.equal(response.status,200,'PUR07_SCOPED_LIST_HTTP_FAILED');
   assert.ok((await response.json()).data.some(row=>row.id===expectedId),
    'PUR07_SCOPED_LIST_SOURCE_MISSING');
  }
  const cancellationRead=await fetch(WEB+'/api/v1/procurement/purchase-orders/'+po.id+'/cancellation-case',{headers:{Cookie:'erp_session='+actor.token}});
  assert.equal(cancellationRead.status,200,'PUR10_SYNTHETIC_NAMED_ACTORS_READ_FAILED');
  assert.equal((await cancellationRead.json()).data.case,null,'No cancellation may be fabricated by PUR07 fixture');
  console.log('PUR07_ACTUAL_SCOPED_PROJECT_AND_PO_HTTP_PASS');
  const cookie=await protocol.send('Network.setCookie',{
   name:'erp_session',value:actor.token,url:WEB,httpOnly:true,sameSite:'Lax',
  },s);
  assert.equal(cookie.success,true);
  await protocol.send('Page.navigate',{url:WEB+'/__pur07-real'+(sourceLink?'?'+new URLSearchParams({project:project.id,order:po.id}):'')},s);
  try {
   await until(protocol,s,()=>document.body?.dataset?.cookieVerified==='yes',
    null,'REAL_BROWSER_COOKIE_VERIFICATION');
   await until(protocol,s,()=>document.body?.dataset?.moduleLoaded==='yes',
    null,'REAL_PURCHASE_ORDER_MODULE_LOAD');
   await until(protocol,s,()=>document.body?.dataset?.authenticated==='yes',
    null,'REAL_REACT_MOUNT');
  } catch(error) {
   const state=await page(protocol,s,()=>({
    cookieVerified:document.body?.dataset?.cookieVerified==='yes',
    moduleLoaded:document.body?.dataset?.moduleLoaded==='yes',
    authenticated:document.body?.dataset?.authenticated==='yes',
    entryFailure:Boolean(document.body?.dataset?.failure),
    readyState:document.readyState,
    hasRoot:Boolean(document.getElementById('root')),
   })).catch(()=>({unreadable:true}));
   console.log('PUR07_SYNTHETIC_BROWSER_STAGE '+JSON.stringify({state,errors}));
   throw error;
  }
  assert.equal(await page(protocol,s,()=>document.body.dataset.identity),actor.id);
  try {
   await until(protocol,s,()=>document.body?.dataset?.renderFailed==='yes'||Boolean(document.getElementById('root')?.firstElementChild),null,'FIRST_REACT_COMMIT');
   const renderError=await page(protocol,s,()=>document.body.dataset.renderError??null);
   assert.equal(renderError,null,'PUR07_REACT_RENDER_EXCEPTION_CLASS_'+renderError);
   await visible(protocol,s,'Purchase Orders');
   if(!sourceLink){
    await choose(protocol,s,'Project',project.projectName);
    await visible(protocol,s,'Purchase Order Register');
    await choose(protocol,s,'Purchase Order revision',exactIdentity);
   } else {
    await visible(protocol,s,'Purchase Order Register');
    await visible(protocol,s,exactIdentity);
   }
   await visible(protocol,s,'Workflow & Revision Controls');
   await visible(protocol,s,'Approved PO PDF');
  } catch(error) {
   const state=await page(protocol,s,()=>({
    renderError:document.body?.dataset?.renderError??null,
    rootMounted:Boolean(document.getElementById('root')?.firstElementChild),
    hasPoRegister:document.getElementById('root')?.textContent?.includes('Purchase Order Register')??false,
    hasPoWorkflow:document.getElementById('root')?.textContent?.includes('Workflow & Revision Controls')??false,
    selects:document.querySelectorAll('[role="combobox"]').length,
    alerts:document.querySelectorAll('[role="alert"]').length,
    progress:document.querySelectorAll('[role="progressbar"]').length,
   })).catch(()=>({unreadable:true}));
   console.log('PUR07_SCOPED_SYNTHETIC_RENDER_STAGE '+JSON.stringify({state,errors}));
   throw error;
  }
  return s;
 }
 try{
  stage='JAI_CREATE_COMMERCIAL_REVISION';
  const buyer=await session(jai);
  const original=await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}});
  await input(protocol,buyer,'Revision reason','Synthetic independent commercial revision '+suffix);
  await click(protocol,buyer,'Create New Revision');
  let revision=null;
  for(let n=0;n<130&&!revision;n++){
   revision=await db.purchaseOrder.findFirst({where:{previousRevisionId:po.id}});
   if(!revision)await delay(150);
  }
  assert.ok(revision,'Real browser must persist a successor revision');
  assert.equal(revision.revisionNo,1);
  assert.equal(revision.poNumber,original.poNumber);
  assert.equal(revision.displayNumber,original.displayNumber);
  assert.equal(revision.supplierShortNameSnapshot,original.supplierShortNameSnapshot);
  assert.equal(revision.freightAmount.toFixed(2),'50.00');
  await visible(protocol,buyer,'Previous revision: Rev 0');
  await visible(protocol,buyer,'Save PO Header');
  await input(protocol,buyer,'Delivery location','Revised site warehouse '+suffix);
  await input(protocol,buyer,'Delivery contact','Synthetic site receiver');
  await input(protocol,buyer,'Partial delivery / delivery terms','Two scheduled deliveries');
  await input(protocol,buyer,'Payment terms','Net 45');
  await input(protocol,buyer,'Credit terms','45 days');
  await input(protocol,buyer,'Freight (THB)','11000');
  await input(protocol,buyer,'Special/sole supplier exception reason for Ben','Synthetic sole supplier compatibility exception '+suffix);
  await click(protocol,buyer,'Save PO Header');
  let saved=null;
  for(let n=0;n<100;n++){
   saved=await db.purchaseOrder.findUniqueOrThrow({where:{id:revision.id}});
   if(saved.freightAmount?.toFixed(2)==='11000.00')break;
   await delay(150);
  }
  assert.equal(saved.freightAmount.toFixed(2),'11000.00');
  assert.equal(saved.deliveryLocation,'Revised site warehouse '+suffix);
  assert.equal(saved.deliveryContact,'Synthetic site receiver');
  assert.equal(saved.deliveryTerms,'Two scheduled deliveries');
  assert.equal(saved.paymentTerms,'Net 45');
  assert.equal(saved.creditTerms,'45 days');
  assert.equal(saved.discountAmount.toFixed(2),'100.00');
  assert.equal(saved.additionalChargeAmount.toFixed(2),'20.00');
  assert.equal(saved.vatRatePercent.toFixed(2),'7.00');
  assert.equal(saved.supplierQuoteExceptionReason,'Synthetic sole supplier compatibility exception '+suffix);
  assert.deepEqual(await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}}),original,'Approved predecessor values and timestamp must remain unchanged');
  console.log('M4_PUR04_REAL_JAI_BROWSER_REVISION_COMMERCIAL_HEADER_IMMUTABLE_PREDECESSOR_PASS');
  stage='JAI_SUBMIT_REASONED_PUR01_EXCEPTION';
  await choose(protocol,buyer,'Approval workflow',poFlow.workflowCode);
  await click(protocol,buyer,'Submit for Approval');
  for(let n=0;n<100;n++){
   const row=await db.purchaseOrder.findUniqueOrThrow({where:{id:revision.id},include:{approvalInstance:true}});
   if(row.approvalInstance?.approvalState==='SUBMITTED')break;
   await delay(150);
  }
  const pending=await db.purchaseOrder.findUniqueOrThrow({where:{id:revision.id},include:{approvalInstance:true}});
  assert.equal(pending.approvalInstance?.approvalState,'SUBMITTED');
  assert.equal(pending.submittedByUserId,jai.id);
  assert.equal(await db.auditLog.count({where:{companyId:company.id,entityType:'PURCHASE_ORDER',entityId:revision.id,action:'PUR01_FINAL_QUOTE_POLICY'}}),0);
  console.log('M4_PUR01_REAL_JAI_BROWSER_EXCEPTION_SUBMITTED_NOT_APPROVED_PASS');
  stage='BEN_INDEPENDENT_REVISION_EXCEPTION_APPROVAL';
  const management=await session(ben,true);
  await choose(protocol,management,'Purchase Order revision','Rev 1');
  await visible(protocol,management,'Previous revision: Rev 0');
  await until(protocol,management,()=>[...document.querySelectorAll('label')].some(l=>{
   if(l.textContent?.trim()!=='Delivery location')return false;
   const el=document.getElementById(l.htmlFor);return el?.disabled===true&&el.value.startsWith('Revised site warehouse ');
  }),null,'BEN_READONLY_REVISED_COMMERCIAL_TERMS');
  assert.equal(await page(protocol,management,()=>[...document.querySelectorAll('button')].some(b=>b.textContent?.trim()==='Save PO Header')),false);
  await input(protocol,management,'Approval comment','Independent Ben accepts synthetic sole supplier exception');
  await click(protocol,management,'Approve');
  for(let n=0;n<100;n++){
   const row=await db.purchaseOrder.findUniqueOrThrow({where:{id:revision.id},include:{approvalInstance:true}});
   if(row.approvalInstance?.approvalState==='APPROVED')break;
   await delay(150);
  }
  const approved=await db.purchaseOrder.findUniqueOrThrow({where:{id:revision.id},include:{approvalInstance:true}});
  assert.equal(approved.approvalInstance?.approvalState,'APPROVED');
  const audits=await db.auditLog.findMany({where:{companyId:company.id,entityType:'PURCHASE_ORDER',entityId:revision.id,action:'PUR01_FINAL_QUOTE_POLICY'}});
  assert.equal(audits.length,1);
  assert.equal(audits[0].actorUserId,ben.id);
  assert.equal(audits[0].newValues.netExVatTHB,'12920.00');
  assert.equal(audits[0].newValues.requiredSuppliers,2);
  assert.equal(audits[0].newValues.comparableSuppliers,1);
  assert.equal(audits[0].newValues.exceptionReason,saved.supplierQuoteExceptionReason);
  assert.equal(audits[0].newValues.approvalInstanceId,approved.approvalInstanceId);
  assert.deepEqual(await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}}),original);
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stockBefore);
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),financeBefore);
  await delay(400);
  assert.deepEqual(errors,[]);
  console.log('M4_PUR01_REAL_BEN_BROWSER_INDEPENDENT_EXCEPTION_AUDIT_PASS');
  console.log('M4_PUR01_PUR04_AUTHENTICATED_COMMERCIAL_REVISION_BROWSER_PASS');
 }finally{
  protocol.listeners.delete(handle);
  for(const id of contexts.reverse())await protocol.send(
   'Target.disposeBrowserContext',{browserContextId:id}).catch(()=>{});
 }
}
try{await run();}
catch(error){
 console.error('M4_PUR07_REAL_UI_FAILED_'+stage+': '+
  String(error?.safeCode??error?.message??error).slice(0,300));
 process.exitCode=1;
}finally{
 try{if(browser)await browser.stop();}finally{
  try{if(vite)await vite.close();}finally{
   await app.close();await rm(temp,{recursive:true,force:true});
  }
 }
}
