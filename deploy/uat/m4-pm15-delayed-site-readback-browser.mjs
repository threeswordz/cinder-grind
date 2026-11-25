// Real Chrome + actual StockMinimumsPanel React/MUI, with deterministic synthetic HTTP timing.
// This is a client regression test, NOT authenticated API, PG, retained-role UAT or release proof.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startBrowser} from './prototype-browser.mjs';

const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const WEB_ROOT=path.join(ROOT,'apps/web');
const req=createRequire(path.join(WEB_ROOT,'package.json'));
const {createServer,transformWithOxc}=await import(pathToFileURL(req.resolve('vite')).href);
const {default:reactPlugin}=await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href);
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES','Disposable UI fixture only');
const executable=['google-chrome','chromium','chromium-browser'].find(x=>
 spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(executable,'Real Chrome required');
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-pm15-delay-'));
const base='/api/v1/inventory/stock-minimums';
process.env.VITE_API_BASE_URL='/api/v1';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const held=[];
let holdA=true,failA=false,browser,vite,context,intercept;
const unexpected=[];
const projects=[{id:'p1',projectCode:'PM15-P1',projectName:'First project'},
 {id:'p2',projectCode:'PM15-P2',projectName:'Second project'}];
const sites={p1:[{id:'a',warehouseCode:'PM15-A',warehouseName:'Site A'},
 {id:'b',warehouseCode:'PM15-B',warehouseName:'Site B'}],
 p2:[{id:'c',warehouseCode:'PM15-C',warehouseName:'Site C'}]};
function payload(site,suffix){
 const material={materialId:'m-'+site,uomId:'ea',materialCode:'MATERIAL-'+site.toUpperCase(),
  materialName:'Synthetic '+site,uomCode:'EA',uomName:'Each'};
 if(suffix==='/choices')return {items:[material],nextCursor:null};
 if(suffix==='/plan-starts')return {asOfThailandDate:'2026-11-25',alerts:[]};
 if(suffix==='/supplier-indicators')return {asOfThailandDate:'2026-11-25',alerts:[]};
 assert.equal(suffix,'');
 return {alerts:[{...material,minimumQuantity:'10',status:'ACTIVE',reason:'Fixture',
  lastEventId:'e-'+site,onHand:'5',reserved:'1',available:'4',shortage:'6',
  belowMinimum:true,configurationStale:false}],advisoryOnly:true,
  approvedPlanDemandAlertsIncluded:true,externalNotificationsSent:false};
}
const reply=(res,data,status=200)=>{
 if(res.destroyed||res.writableEnded)return;
 res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});
 res.end(JSON.stringify(status===200?{data}:data));
};
function fixture(req,res,next){
 const route=new URL(req.url??'/','http://127.0.0.1').pathname;
 if(route==='/__pm15-delay'){
  res.setHeader('Content-Type','text/html');
  return res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__pm15-delay.tsx"></script></body></html>');
 }
 if(!route.startsWith('/api/v1/'))return next();
 if(req.method!=='GET'){unexpected.push('MUTATION');return reply(res,{detail:'Read only'},405);}
 if(route===base+'/projects')return reply(res,projects);
 if(route===base+'/portfolio-work-queue')return reply(res,{companyId:'synthetic',asOfThailandDate:'2026-11-25',projects:[]});
 for(const p of projects)if(route===base+'/projects/'+p.id+'/sites')return reply(res,sites[p.id]);
 const m=route.match(/^\/api\/v1\/inventory\/stock-minimums\/projects\/(p1|p2)\/sites\/(a|b|c)(\/choices|\/plan-starts|\/supplier-indicators)?$/);
 if(!m||!sites[m[1]].some(s=>s.id===m[2])){
  unexpected.push('UNKNOWN_SCOPE_OR_ROUTE');return reply(res,{detail:'Unexpected route'},404);
 }
 const site=m[2],suffix=m[3]??'';
 if(site==='a'&&holdA){
  const failure=failA&&suffix==='';
  held.push(()=>failure?reply(res,{detail:'STALE-A-ERROR'},403):reply(res,payload(site,suffix)));
  return;
 }
 return reply(res,payload(site,suffix));
}
const entry=[
 "import React from 'react';",
 "import {createRoot} from 'react-dom/client';",
 "import {StockMinimumsPanel} from '/src/inventory/StockMinimumsPanel.tsx';",
 "window.__fixtureReads=[];",
 "const originalFetch=window.fetch.bind(window);",
 "window.fetch=async(...args)=>{const response=await originalFetch(...args); const json=response.json.bind(response);",
 " response.json=async()=>{const value=await json();window.__fixtureReads.push(String(args[0]));return value;};return response;};",
 "createRoot(document.getElementById('root')).render(<StockMinimumsPanel roleCodes={['PROJECT_MANAGER']}/>);",
].join('\n');
async function wait(fn,label){
 for(let i=0;i<200;i++){if(await fn())return;await pause(100);}
 throw new Error('PM15_TIMEOUT_'+label);
}
async function page(p,s,fn,arg=null){
 const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg)+')',
  awaitPromise:true,returnByValue:true},s);
 assert.ok(!r.exceptionDetails&&r.result&&r.result.type!=='error','PM15_PAGE_EVALUATION');
 return r.result.value;
}
async function visible(p,s,text){
 await wait(()=>page(p,s,t=>document.getElementById('root')?.textContent?.includes(t),text),'VISIBLE_'+text);
}
async function choose(p,s,label,option){
 await wait(()=>page(p,s,()=>document.querySelectorAll('[role="option"]').length===0),'CLOSED_MENU');
 await wait(()=>page(p,s,l=>{
  const x=[...document.querySelectorAll('[role="combobox"]')].find(el=>
   (el.getAttribute('aria-labelledby')??'').split(' ').some(id=>document.getElementById(id)?.textContent?.trim()===l));
  if(!x||x.getAttribute('aria-disabled')==='true')return false;
  x.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));return true;
 },label),'OPEN_'+label);
 await wait(()=>page(p,s,o=>{
  const x=[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent?.includes(o));
  if(!x)return false;x.click();return true;
 },option),'SELECT_'+option);
 await wait(()=>page(p,s,({label,option})=>
  [...document.querySelectorAll('[role="combobox"]')].some(el=>
   (el.getAttribute('aria-labelledby')??'').split(' ').some(id=>document.getElementById(id)?.textContent?.trim()===label)&&el.textContent?.includes(option)),
  {label,option}),'CONTROLLED_VALUE_'+option);
 await wait(()=>page(p,s,()=>document.querySelectorAll('[role="option"]').length===0),'MENU_CLOSE');
}
async function releaseAndCheck(p,s,expected,readCount){
 assert.equal(held.length,4,'All four prior-scope HTTP requests must be held');
 for(const release of held.splice(0))release();
 await wait(()=>page(p,s,count=>window.__fixtureReads.filter(x=>x.includes('/sites/a')).length===count,readCount),'OLD_RESPONSES_CONSUMED');
 await page(p,s,()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>setTimeout(()=>resolve(true),0)))));
 assert.equal(await page(p,s,material=>{
  const text=document.getElementById('root')?.textContent??'';
  return text.includes(material)&&!text.includes('MATERIAL-A')&&!text.includes('STALE-A-ERROR');
 },expected),true,'Late previous-scope data/error must not overwrite current site');
}
try{
 vite=await createServer({root:WEB_ROOT,configFile:false,
  resolve:{dedupe:['react','react-dom']},
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','@mui/material','@emotion/react','@emotion/styled']},
  server:{host:'127.0.0.1',port:0,hmr:false},
  plugins:[reactPlugin(),{name:'pm15-deterministic-local-ui-fixture',
   configureServer(server){server.middlewares.use(fixture);},
   resolveId(id){if(id==='/__pm15-delay.tsx')return 'virtual:pm15-delay';},
   async load(id){if(id==='virtual:pm15-delay')return transformWithOxc(entry,
    path.join(WEB_ROOT,'__pm15-delay.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});}
  }]});
 await vite.listen();
 const address=vite.httpServer.address();
 assert.ok(address&&typeof address==='object');
 const web='http://127.0.0.1:'+address.port;
 browser=await startBrowser(executable,temp);
 const p=browser.protocol;
 intercept=event=>{
  if(event.method==='Runtime.exceptionThrown')unexpected.push('UNHANDLED_BROWSER_ERROR');
  if(event.method!=='Fetch.requestPaused')return;
  const {requestId,request}=event.params;
  let allowed=false;
  try{allowed=new URL(request.url).origin===web&&request.method==='GET';}catch{}
  if(!allowed)unexpected.push('UNEXPECTED_OUTBOUND_OR_WRITE');
  void p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',
   allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},event.sessionId)
   .catch(()=>unexpected.push('INTERCEPTION_FAILURE'));
 };
 p.listeners.add(intercept);
 context=(await p.send('Target.createBrowserContext')).browserContextId;
 const {targetId}=await p.send('Target.createTarget',{url:'about:blank',browserContextId:context});
 const s=(await p.send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
 await p.send('Page.enable',{},s);await p.send('Runtime.enable',{},s);
 await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
 await p.send('Page.navigate',{url:web+'/__pm15-delay'},s);
 await visible(p,s,'Material / Site minimum-stock alerts');
 await choose(p,s,'Authorized Project','PM15-P1');
 await choose(p,s,'Site Warehouse','PM15-A');
 await wait(()=>held.length===4,'A_REQUESTS_HELD');
 await choose(p,s,'Site Warehouse','PM15-B');
 await visible(p,s,'MATERIAL-B');
 await releaseAndCheck(p,s,'MATERIAL-B',4);
 // Repeat with a stale error and a cross-Project selection.
 failA=true;
 await choose(p,s,'Site Warehouse','PM15-A');
 await wait(()=>held.length===4,'A_ERROR_REQUESTS_HELD');
 await choose(p,s,'Authorized Project','PM15-P2');
 await choose(p,s,'Site Warehouse','PM15-C');
 await visible(p,s,'MATERIAL-C');
 await releaseAndCheck(p,s,'MATERIAL-C',8);
 assert.deepEqual(unexpected,[]);
 console.log('PM15_SYNTHETIC_HTTP_REAL_CHROME_DELAYED_SITE_SUCCESS_AND_PROJECT_ERROR_ISOLATION_PASS');
}finally{
 for(const release of held.splice(0))release();
 if(browser){
  if(intercept)browser.protocol.listeners.delete(intercept);
  if(context)await browser.protocol.send('Target.disposeBrowserContext',{browserContextId:context}).catch(()=>{});
  await browser.stop();
 }
 if(vite)await vite.close();
 await rm(temp,{recursive:true,force:true});
}
