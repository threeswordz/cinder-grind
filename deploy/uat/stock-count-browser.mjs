// Disposable real-browser proof for #289 / OP-STOCK-COUNT-01.
// No API server, database, retained credentials/grants or Production access.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const { createServer, transformWithOxc } = await import(pathToFileURL(require.resolve('vite')).href);
const chrome = ['google-chrome','chromium','chromium-browser'].find(bin =>
  spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
assert.ok(chrome,'Chromium required for stock-count browser evidence; no SSR fallback');
const temporary = await mkdtemp(path.join(os.tmpdir(),'erp-stock-count-browser-'));

const harness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StockCountsPanel } from '/src/inventory/StockCountsPanel.tsx';

const project='11111111-1111-4111-8111-111111111111';
const warehouse='22222222-2222-4222-8222-222222222222';
const material='33333333-3333-4333-8333-333333333333';
const uom='44444444-4444-4444-8444-444444444444';
const countId='55555555-5555-4555-8555-555555555555';
const transactionId='66666666-6666-4666-8666-666666666666';
const base={id:countId,companyId:'77777777-7777-4777-8777-777777777777',projectId:project,
  warehouseId:warehouse,materialId:material,uomId:uom,countedAt:'2026-10-31T08:00:00.000Z',
  expectedOnHand:'5.0000',expectedReserved:'2.0000',actualQuantity:'3.0000',varianceQuantity:'-2.0000',
  evidenceReference:'PHOTO-COUNT-001',version:1,createdByUserId:'88888888-8888-4888-8888-888888888888',
  submittedByUserId:null,decidedByUserId:null,decisionComment:null,postKey:null,
  createdAt:'2026-10-31T08:01:00.000Z',updatedAt:'2026-10-31T08:01:00.000Z',
  submittedAt:null,decidedAt:null,status:'DRAFT',
  warehouse:{warehouseCode:'SITE-01',warehouseName:'Site Warehouse',isSiteWarehouse:true},
  material:{materialCode:'MAT-STEEL',materialName:'Steel'},uom:{uomCode:'EA',uomName:'Each'},
  stockTransaction:null};
let rows=[];
let csrfCount=0,createBodies=[],submitBodies=[],approvalBodies=[],lostApproval=false;
const reply=(data,status=200)=>new Response(
  JSON.stringify(status>=200&&status<300?{data}:{code:'SYNTHETIC_FAILURE',detail:'Synthetic uncertain response'}),
  {status,headers:{'content-type':'application/json','cache-control':'private, no-store'}});
window.fetch=async(url,options={})=>{
  const full=new URL(String(url),location.href);
  const path=full.pathname.replace('/api/v1','');
  const method=(options.method??'GET').toUpperCase();
  if(path==='/auth/csrf'){csrfCount++;return reply({csrfToken:'synthetic-csrf'});}
  if(path==='/inventory/stock-count-projects'&&method==='GET')
    return reply([{id:project,projectCode:'P-001',projectName:'Synthetic Project'}]);
  if(path==='/inventory/projects/'+project+'/stock-count-warehouses'&&method==='GET')
    return reply([{id:warehouse,warehouseCode:'SITE-01',warehouseName:'Site Warehouse',projectId:project}]);
  if(path==='/inventory/projects/'+project+'/stock-count-choices'&&method==='GET'){
    if(full.searchParams.get('warehouseId')!==warehouse) throw Error('Missing warehouse-bound count choices');
    return reply({items:[{materialId:material,materialCode:'MAT-STEEL',materialName:'Steel',
      uomId:uom,uomCode:'EA',uomName:'Each'}],nextCursor:null});
  }
  if(path==='/inventory/projects/'+project+'/stock-counts'&&method==='GET')return reply(rows);
  if(path==='/inventory/stock-counts'&&method==='POST'){
    if(!options.headers.get('X-CSRF-Token'))throw Error('Create omitted CSRF');
    createBodies.push(JSON.parse(options.body));
    rows=[{...base,status:'DRAFT'}];
    return reply(rows[0],201);
  }
  if(path==='/inventory/stock-counts/'+countId+'/submit'&&method==='POST'){
    if(!options.headers.get('X-CSRF-Token'))throw Error('Submit omitted CSRF');
    submitBodies.push(JSON.parse(options.body));
    rows=[{...rows[0],status:'SUBMITTED',version:2,
      submittedByUserId:'88888888-8888-4888-8888-888888888888',
      submittedAt:'2026-10-31T08:05:00.000Z'}];
    return reply(rows[0],201);
  }
  if(path==='/inventory/stock-counts/'+countId+'/approve'&&method==='POST'){
    if(!options.headers.get('X-CSRF-Token'))throw Error('Approval omitted CSRF');
    const body=JSON.parse(options.body);approvalBodies.push(body);
    rows=[{...rows[0],status:'APPROVED',version:3,postKey:body.postKey,
      decidedByUserId:'99999999-9999-4999-8999-999999999999',
      decidedAt:'2026-10-31T08:10:00.000Z',
      stockTransaction:{id:transactionId,movementType:'STOCK_COUNT_ADJUSTMENT',
        quantity:'-2.0000',effectKey:'stock-count:'+countId+':'+body.postKey,
        postedAt:'2026-10-31T08:10:00.000Z'}}];
    if(!lostApproval){lostApproval=true;return reply(null,503);}
    return reply(rows[0],201);
  }
  throw Error('Unexpected stock-count browser endpoint '+method+' '+path);
};

const query=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
const root=createRoot(document.getElementById('root'));
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(value,message)=>{if(!value)throw Error(message);};
const text=()=>document.getElementById('root').textContent;
async function until(fn,message){for(let i=0;i<160;i++){if(fn())return;await wait(50);}throw Error(message);}
const labelled=(node,label)=>(node.getAttribute('aria-labelledby')??'').split(' ').some(
  id=>document.getElementById(id)?.textContent===label);
async function choose(label,choice){
  await until(()=>[...document.querySelectorAll('[role="combobox"]')].some(x=>labelled(x,label)),'Missing selector '+label);
  const control=[...document.querySelectorAll('[role="combobox"]')].find(x=>labelled(x,label));
  control.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
  await until(()=>[...document.querySelectorAll('[role="option"]')].some(x=>x.textContent.includes(choice)),'Missing option '+choice);
  [...document.querySelectorAll('[role="option"]')].find(x=>x.textContent.includes(choice)).click();
  await wait(60);
}
async function input(label,value){
  const lab=[...document.querySelectorAll('label')].find(x=>x.textContent.replace(/\\s*\\*$/,'').trim()===label);
  check(lab,'Missing field '+label);
  const el=document.getElementById(lab.htmlFor);
  check(el instanceof HTMLInputElement,'Not an input '+label);
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(50);
}
async function click(label){
  await until(()=>[...document.querySelectorAll('button')].some(x=>x.textContent===label&&!x.disabled),'Missing action '+label);
  [...document.querySelectorAll('button')].find(x=>x.textContent===label&&!x.disabled).click();
  await wait(40);
}
function render(permissions){
  root.render(<QueryClientProvider client={query}><StockCountsPanel permissions={permissions}/></QueryClientProvider>);
}
async function run(){
  const store=['inventory.stock_count.view','inventory.stock_count.create',
    'inventory.stock_count.edit','inventory.stock_count.submit'];
  render(store);
  await choose('Project','P-001');
  await choose('Site Warehouse','SITE-01');
  await choose('Material / UOM','MAT-STEEL');
  await input('Actual physical quantity','3');
  await input('Inspection evidence reference','PHOTO-COUNT-001');
  check(!text().includes('Review'),'Store Site unexpectedly received approval action');
  await click('Save draft count');
  await until(()=>text().includes('DRAFT'),'Draft physical count missing');
  check(createBodies.length===1&&createBodies[0].materialId===material&&
    createBodies[0].uomId===uom&&createBodies[0].actualQuantity==='3','Count create body incorrect');
  await click('Submit');
  await until(()=>text().includes('SUBMITTED'),'Submitted count missing');
  check(submitBodies.length===1&&submitBodies[0].expectedVersion===1,'Submit optimistic version missing');

  render(['inventory.stock_count.view','inventory.stock_count.approve']);
  await until(()=>text().includes('SUBMITTED'),'Reviewer lost submitted count');
  check(!text().includes('Save draft count'),'Reviewer unexpectedly received Store Site create action');
  await click('Review');
  await click('Approve quantity adjustment');
  await until(()=>text().includes('Synthetic uncertain response'),'Uncertain approval response not surfaced');
  check(approvalBodies.length===1,'First approval request missing');
  await click('Approve quantity adjustment');
  await until(()=>text().includes('APPROVED'),'Retry-safe approval did not complete');
  check(approvalBodies.length===2&&approvalBodies[0].postKey===approvalBodies[1].postKey,
    'Approval retry changed durable post key');
  check(rows[0].stockTransaction.quantity==='-2.0000'&&
    rows[0].stockTransaction.movementType==='STOCK_COUNT_ADJUSTMENT',
    'Approved count did not expose quantity-only ledger effect');
  check(csrfCount>=1,'Stock-count writes did not obtain CSRF');
  document.body.dataset.result='PASS';
}
run().catch(error=>{document.body.dataset.result='FAIL';document.body.dataset.error=error.message;});
`;

const vite = await createServer({
  root, configFile:false, server:{host:'127.0.0.1',port:0,hmr:false},
  plugins:[{name:'stock-count-browser-fixture',
    configureServer(server){server.middlewares.use((req,res,next)=>{
      if(req.url!=='/__stock-count-check')return next();
      res.setHeader('Content-Type','text/html');
      res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__stock-count-check.tsx"></script></body></html>');
    });},
    resolveId(id){if(id==='/__stock-count-check.tsx')return '\0stock-count-browser-fixture.tsx';},
    async load(id){if(id==='\0stock-count-browser-fixture.tsx')
      return transformWithOxc(harness,path.join(root,'__stock-count-check.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});
    },
  }],
});
try{
  await vite.listen();
  const address=vite.httpServer.address();
  const url='http://127.0.0.1:'+address.port+'/__stock-count-check';
  const result=await new Promise((resolve,reject)=>{
    const child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--no-proxy-server','--user-data-dir='+temporary,'--virtual-time-budget=25000','--dump-dom',url],
      {stdio:['ignore','pipe','pipe']});
    let out='',err='';
    child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
    const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Stock-count browser timeout'));},75000);
    child.on('error',error=>{clearTimeout(timeout);reject(error);});
    child.on('close',code=>{clearTimeout(timeout);resolve({code,out,err});});
  });
  assert.equal(result.code,0,result.err.slice(-2000));
  assert.match(result.out,/data-result="PASS"/,
    (result.out.match(/data-error="[^"]*"/)??[result.out.slice(-5000)])[0]);
  console.log('STOCK_COUNT_BROWSER_PASS — actual React/MUI Store draft+submit, reviewer separation, CSRF and retry-safe quantity-only approval; synthetic-only');
} finally {
  await vite.close();
  await rm(temporary,{recursive:true,force:true});
}
