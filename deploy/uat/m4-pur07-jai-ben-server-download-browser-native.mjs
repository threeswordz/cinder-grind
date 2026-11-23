// New PUR07 real authenticated Jai/Ben Thai PDF SERVER download and reported external-send browser test.
// Disposable localhost PG17.11 + Nest + real React/MUI + Chrome CDP ONLY.
// Source alone is NOT a PASS. No retained users, Mac, external endpoints or Production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
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
assert.equal(url.pathname,'/erp_m4_pur07_auth_browser');
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
const D=value=>new Prisma.Decimal(value);
const app=await NestFactory.create(AppModule,{logger:false});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
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
  companyCode:'P01B-'+suffix,companyName:'PUR07 disposable browser only',
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
  'procurement.po.edit','procurement.po.submit','procurement.po.approve',
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
  'procurement.po.submit','procurement.rfq.view','procurement.rfq.manage',
  'procurement.quotation.view','procurement.quotation.manage',
  'procurement.award.select',
 ]}]);
 const ben=await actor('Ben',[
  {code:'MANAGEMENT',grants:['procurement.po.view','procurement.po.approve']},
  {code:poRole.roleCode,grants:[]},
 ]);
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
 assert.equal((await pos.getOrder(ben.auth,po.id)).lines[0].quotationAward.supplierNameSnapshot,
  'บริษัท เซมิคอนกรีต จำกัด');
 console.log('M4_PUR07_REAL_APPROVED_PG_THAI_FIXTURE_PASS');
 const stockBefore=await db.stockTransaction.count({where:{companyId:company.id}});
 const financeBefore=await db.directCostPosting.count({where:{companyId:company.id}});

 const entry=[
  "import React from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {QueryClient,QueryClientProvider} from '@tanstack/react-query';",
  "import {PurchaseOrdersPanel} from '/src/procurement/PurchaseOrdersPanel.tsx';",
  "import {MonetaryLocaleContext} from '/src/role-ui/monetary-presentation.tsx';",
  "const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});",
  "(async()=>{",
  " const r=await fetch('/api/v1/auth/me',{credentials:'include',redirect:'error'});",
  " if(r.status!==200)throw Error('PUR07_AUTH_COOKIE_REQUIRED');",
  " const me=(await r.json()).data;",
  " if(!me.id||!me.companyId||!Array.isArray(me.roleCodes)||!Array.isArray(me.permissions))throw Error('PUR07_REAL_ROLE_MISSING');",
  " document.body.dataset.identity=me.id;",
  " document.body.dataset.roleCodes=me.roleCodes.join(',');",
  " createRoot(document.getElementById('root')).render(",
  "  <QueryClientProvider client={client}><MonetaryLocaleContext.Provider value='en'>",
  "   <PurchaseOrdersPanel permissions={me.permissions}",
  "    initialProjectId="+JSON.stringify(project.id),
  "    initialOrderId="+JSON.stringify(po.id)+"/>",
  "  </MonetaryLocaleContext.Provider></QueryClientProvider>);",
  " document.body.dataset.authenticated='yes';",
  "})().catch(e=>{document.body.dataset.authenticated='no';document.body.dataset.failure=e.message;});",
 ].join('\n');
 vite=await createServer({
  root:WEB_ROOT,configFile:false,
  server:{host:'127.0.0.1',port:44364,strictPort:true,hmr:false,
   proxy:{'/api/v1':{target:API,changeOrigin:false}}},
  plugins:[{name:'m4-pur07-only-new-chrome',
   configureServer(server){server.middlewares.use((req,res,next)=>{
    if(req.url!=='/__pur07-real')return next();
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
  if(event.method==='Network.responseReceived'){
   const url=event.params?.response?.url??'';
   const status=event.params?.response?.status??0;
   if(url.endsWith('/procurement/purchase-orders/'+po.id+'/pdf')&&status===200){
    downloadHttp200.push({status,mimeType:event.params?.response?.mimeType});
   }else if(url.startsWith(WEB+'/api/v1/')&&status>=400){
    errors.push('PUR07_UNEXPECTED_HTTP_'+status);
   }
  }else if(event.method==='Runtime.exceptionThrown'){
   errors.push('PUR07_UNHANDLED_BROWSER_JS');
  }
 };
 protocol.listeners.add(handle);
 async function session(actor){
  const {browserContextId}=await protocol.send('Target.createBrowserContext');
  contexts.push(browserContextId);
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
  const cookie=await protocol.send('Network.setCookie',{
   name:'erp_session',value:actor.token,url:WEB,httpOnly:true,sameSite:'Lax',
  },s);
  assert.equal(cookie.success,true);
  await protocol.send('Page.navigate',{url:WEB+'/__pur07-real'},s);
  await until(protocol,s,()=>document.body?.dataset?.authenticated==='yes',
   null,'REAL_COOKIE_LOGIN');
  assert.equal(await page(protocol,s,()=>document.body.dataset.identity),actor.id);
  await visible(protocol,s,'Workflow & Revision Controls');
  await visible(protocol,s,'Approved PO PDF');
  return s;
 }
 try{
  stage='JAI_REAL_THAI_PDF_DOWNLOAD';
  const buyer=await session(jai);
  await visible(protocol,buyer,'Approved PO PDF & Manual Dispatch (PUR07)');
  await visible(protocol,buyer,'APPROVED');
  await visible(protocol,buyer,'Download approved PDF (Thai / English)');
  await click(protocol,buyer,'Download approved PDF (Thai / English)');
  for(let n=0;n<150&&downloadHttp200.length<1;n++)await delay(140);
  assert.equal(downloadHttp200.length,1,'One actual Jai UI PDF request');
  assert.equal(downloadHttp200[0].mimeType,'application/pdf');
  await until(protocol,buyer,()=>{
   const button=[...document.querySelectorAll('button')]
    .find(b=>b.textContent?.trim()==='Download approved PDF (Thai / English)');
   return !!button&&!button.disabled&&
    ![...document.querySelectorAll('.MuiAlert-standardError')]
     .some(e=>e.textContent?.includes('PO_PDF_UNICODE_RENDERER_UNAVAILABLE'));
  },null,'JAI_PDF_DOWNLOAD_COMPLETED');
  assert.deepEqual(errors,[]);
  console.log('M4_PUR07_REAL_JAI_MUI_UNICODE_BACKEND_PDF_HTTP200_PASS');
  stage='JAI_REPORTED_EXTERNAL_SEND_UI';
  await input(protocol,buyer,'Recipient email / LINE contact','supplier@example.invalid');
  await input(protocol,buyer,'External evidence reference (required)',
   'Synthetic reported email ID '+suffix+' (NO ACTUAL EXTERNAL MESSAGE)');
  await click(protocol,buyer,'Record reported external send');
  for(let n=0;n<85;n++){
   const total=await db.poDispatchEvent.count({
    where:{companyId:company.id,purchaseOrderId:po.id,kind:'DISPATCH'},
   });
   if(total===1)break;
   await delay(125);
  }
  const sent=await db.poDispatchEvent.findMany({
   where:{companyId:company.id,purchaseOrderId:po.id},
  });
  assert.equal(sent.length,1);
  assert.equal(sent[0].recordedByUserId,jai.id);
  assert.equal(sent[0].pdfSha256,null,'Download is NOT proof of third-party delivery');
  assert.match(sent[0].evidenceReference,/NO ACTUAL EXTERNAL MESSAGE/);
  await visible(protocol,buyer,'Reported sent');
  console.log('M4_PUR07_REAL_JAI_MUI_MANUAL_DISPATCH_REPORTED_ONLY_PASS');
  stage='BEN_READ_ONLY_REAL_BROWSER';
  const management=await session(ben);
  await visible(protocol,management,'Reported sent');
  await visible(protocol,management,'Download approved PDF (Thai / English)');
  assert.equal(await page(protocol,management,()=>{
   return [...document.querySelectorAll('button')]
    .some(b=>b.textContent?.includes('Record reported external send'));
  }),false,'Ben must not have Jai-only dispatch controls');
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stockBefore);
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),financeBefore);
  assert.deepEqual(errors,[]);
  console.log('M4_PUR07_REAL_BEN_READ_ONLY_MUI_ROLE_AND_HISTORY_PASS');
  console.log('M4_PUR07_AUTHENTICATED_THAI_PDF_DOWNLOAD_AND_REPORTED_SEND_PASS');
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
