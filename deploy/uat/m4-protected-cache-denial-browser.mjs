// Actual React components and real Chromium; deliberately synthetic HTTP
// 200→403 fixture to isolate stale-query rendering. Not backend authorization
// or retained UAT proof. Native asset HTTP and PO DB proofs run separately.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startBrowser} from './prototype-browser.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
const ROOT=fileURLToPath(new URL('../../',import.meta.url)), WEB_ROOT=path.join(ROOT,'apps/web');
const require=createRequire(path.join(WEB_ROOT,'package.json'));
const {createServer,transformWithOxc}=await import(pathToFileURL(require.resolve('vite')).href);
const {default:reactPlugin}=await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const bin=['google-chrome','chromium','chromium-browser'].find(x=>spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(bin,'REAL_CHROMIUM_REQUIRED');
const temp=await mkdtemp(path.join(os.tmpdir(),'m4-cache-scope-'));
const WEB='http://127.0.0.1:44381';
process.env.VITE_API_BASE_URL=WEB+'/api/v1';
let denied=false,denials=0,server,browser;
const v={id:'version-one',version:1,purchaseDate:'2026-01-01',acquisitionValueTHB:'9876.54',evidenceReference:'PRIVATE-ACQUISITION-EVIDENCE',recordedBaseLocation:'PRIVATE-BASE',reason:'PRIVATE-HISTORY',createdAt:'2026-01-01'};
const asset={current:v,history:[v],currentProject:{projectCode:'PRIVATE-SITE',projectName:'Protected project'},custodyVisible:true,currentCustody:{borrowerName:'PRIVATE-CUSTODIAN',siteLabel:'PRIVATE-SITE',dueOn:'2026-12-01'},canEdit:true};
const supplier={purchaseOrderId:'test-po',projectId:'test-project',approvedLatest:true,case:{version:3,stage:'CLAIM_RECORDED',pmDecision:'REQUEST_RETURN',discrepancyKind:'DAMAGED'},expectedPreviousEventId:'previous',returnCustodyTrace:{quantity:'1',originalDeliveryLineId:'line',warehouseId:'warehouse',supplierSignatory:'PRIVATE-SUPPLIER-SIGNATORY',signedHandoverDocumentId:'PRIVATE-SIGNED-DOCUMENT',signedHandoverOperatorAttested:true},replacementReceiptLiveStatus:null};
const harness=`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {EquipmentAssetRegisterPanel} from '/src/equipment/EquipmentAssetRegisterPanel.tsx';
import {EquipmentCustodyPanel} from '/src/equipment/EquipmentCustodyPanel.tsx';
import {SupplierDeliveryCasePanel} from '/src/procurement/SupplierDeliveryCasePanel.tsx';
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
const perms=['equipment.custody.view','equipment.custody.manage','inventory.receiving.view','documents.document.view'];
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}>
 <button id="refresh-all" onClick={()=>void client.invalidateQueries()}>Refresh all fixture queries</button>
 <EquipmentAssetRegisterPanel equipmentId="test-equipment"/>
 <EquipmentCustodyPanel equipmentId="test-equipment" permissions={perms}/>
 <SupplierDeliveryCasePanel orderId="test-po" permissions={perms} roleCodes={['STOREKEEPER']}/>
</QueryClientProvider>);`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 server=await createServer({root:WEB_ROOT,configFile:false,
  resolve:{dedupe:['react','react-dom','@tanstack/react-query']},
  optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','@tanstack/react-query','@mui/material','@emotion/react','@emotion/styled']},
  server:{host:'127.0.0.1',port:44381,strictPort:true,hmr:false},
  plugins:[reactPlugin(),{name:'m4-cache-scope-fixture',
   configureServer(s){s.middlewares.use((req,res,next)=>{
    const url=new URL(req.url,WEB);
    if(url.pathname==='/__m4-cache-scope'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__m4-cache.tsx"></script></body></html>');return;}
    if(!url.pathname.startsWith('/api/v1/'))return next();
    assert.equal(req.method,'GET','No business writes allowed in cache fixture');
    res.setHeader('Content-Type','application/json');
    if(denied){denials++;res.statusCode=403;res.end(JSON.stringify({code:'PROJECT_ACCESS_DENIED',detail:'Synthetic scope denied'}));return;}
    let data;
    if(url.pathname.endsWith('/asset'))data=asset;
    else if(url.pathname.endsWith('/supplier-case'))data=supplier;
    else if(url.pathname.endsWith('/custody/projects'))data=[{id:'test-project',projectCode:'PRIVATE-CUSTODY-PROJECT',projectName:'Test site'}];
    else if(url.pathname.endsWith('/custody/borrowers'))data=[{id:'borrower',employeeCode:'TEST',employeeName:'PRIVATE-BORROWER'}];
    else if(url.pathname.endsWith('/custody'))data=[{id:'loan',borrowerName:'PRIVATE-LOAN-CUSTODIAN',siteLabel:'PRIVATE-LOAN-SITE',issuedOn:'2026-01-01',dueOn:'2026-12-01',conditionOut:'PRIVATE-CONDITION',returnedOn:null}];
    else{res.statusCode=404;res.end('{}');return;}
    res.end(JSON.stringify({data}));
   });},
   resolveId(id){if(id==='/__m4-cache.tsx')return 'virtual:m4-cache-scope-entry';},
   async load(id){if(id==='virtual:m4-cache-scope-entry')return transformWithOxc(harness,path.join(WEB_ROOT,'__m4-cache.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});}
  }]});
 await server.listen();
 browser=await startBrowser(bin,temp);
 const p=browser.protocol,{targetId}=await p.send('Target.createTarget',{url:'about:blank'});
 const {sessionId}=await p.send('Target.attachToTarget',{targetId,flatten:true});
 await p.send('Runtime.enable',{},sessionId);
 const errors=[];
 p.listeners.add(e=>{if(e.method==='Runtime.exceptionThrown'&&e.sessionId===sessionId)errors.push(e.params.exceptionDetails?.text);});
 const ev=async(fn,arg)=>{const x=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')('+JSON.stringify(arg??null)+')',returnByValue:true,awaitPromise:true},sessionId);assert.ok(!x.exceptionDetails,JSON.stringify(x.exceptionDetails));return x.result.value;};
 const until=async(fn,arg)=>{const end=Date.now()+30000;while(Date.now()<end){if(await ev(fn,arg))return;await sleep(150);}throw Error('Browser assertion timed out: '+fn.toString());};
 await p.send('Page.navigate',{url:WEB+'/__m4-cache-scope'},sessionId);
 await until(()=>document.body.innerText.includes('9876.54 THB')&&document.body.innerText.includes('PRIVATE-SUPPLIER-SIGNATORY'));
 // Select the MUI custody Project combobox using real browser input events.
 const box=await ev(()=>{const e=[...document.querySelectorAll('[role="combobox"]')].find(x=>x.closest('.MuiFormControl-root')?.textContent.includes('Project / site scope'));if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
 assert.ok(box,'Custody selector missing');
 await p.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box},sessionId);
 await p.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...box},sessionId);
 await until(()=>[...document.querySelectorAll('[role="option"]')].some(x=>x.textContent.includes('PRIVATE-CUSTODY-PROJECT')));
 await ev(()=>[...document.querySelectorAll('[role="option"]')].find(x=>x.textContent.includes('PRIVATE-CUSTODY-PROJECT')).click());
 await until(()=>document.body.innerText.includes('PRIVATE-LOAN-CUSTODIAN'));
 denied=true;
 await ev(()=>document.querySelector('#refresh-all').click());
 await until(()=>document.body.innerText.includes('Asset details unavailable in your current scope')&&document.body.innerText.includes('Synthetic scope denied')&&
  !document.body.innerText.includes('PRIVATE-')&&
  ![...document.querySelectorAll('input,textarea')].some(x=>x.value.includes('PRIVATE-')||x.value.includes('9876.54')));
 assert.ok(denials>=3,'Expected current denied HTTP responses');
 assert.equal(await ev(()=>[...document.querySelectorAll('button')].some(x=>x.textContent.includes('Record acquisition version')||x.textContent.includes('Record source-linked evidence')||x.textContent.includes('Record Return'))),false);
 denied=false;
 await ev(()=>[...document.querySelectorAll('button')].find(x=>x.textContent==='Refresh register').click());
 await until(()=>document.body.innerText.includes('9876.54 THB'));
 assert.equal(errors.length,0,JSON.stringify(errors));
 console.log('M4_PROTECTED_CACHE_REAL_CHROMIUM_DENIAL_AND_RETRY_PASS');
}finally{await browser?.stop();await server?.close();await rm(temp,{recursive:true,force:true});}
