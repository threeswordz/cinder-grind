// Real React/React Query/Chromium, controlled synthetic HTTP success->403->success.
 // No retained records or real credentials; backend scope tested separately on PG.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {startBrowser} from './prototype-browser.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
const root=fileURLToPath(new URL('../../apps/web/',import.meta.url));
const req=createRequire(path.join(root,'package.json'));
const {createServer,transformWithOxc}=await import(pathToFileURL(req.resolve('vite')).href);
const {default:reactPlugin}=await import(pathToFileURL(req.resolve('@vitejs/plugin-react')).href);
const executable=['google-chrome','chromium','chromium-browser'].find(x=>spawnSync(x,['--version'],{stdio:'ignore'}).status===0);
assert.ok(executable);
const temp=await mkdtemp(path.join(tmpdir(),'m4-asset-cache-'));
const origin='http://127.0.0.1:44386';
process.env.VITE_API_BASE_URL=origin+'/api/v1';
const id='00000000-0000-4000-8000-000000000001';
const version={id:'v1',version:1,purchaseDate:'2026-11-01',acquisitionValueTHB:'918273.45',evidenceReference:'PRIVATE_EVIDENCE_A',recordedBaseLocation:'PRIVATE_LOCATION_A',reason:'PRIVATE_HISTORY_A',createdAt:'2026-11-01'};
let denied=false,requests=0,vite,browser;
const entry=`import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {EquipmentAssetRegisterPanel} from '/src/equipment/EquipmentAssetRegisterPanel.tsx';
const client=new QueryClient({defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><EquipmentAssetRegisterPanel equipmentId="${id}"/></QueryClientProvider>);`;
try{
 vite=await createServer({root,configFile:false,resolve:{dedupe:['react','react-dom','@tanstack/react-query']},
 optimizeDeps:{include:['react','react-dom','react-dom/client','react/jsx-runtime','@tanstack/react-query','@mui/material','@emotion/react','@emotion/styled']},
 server:{host:'127.0.0.1',port:44386,strictPort:true,hmr:false},
 plugins:[reactPlugin(),{name:'m4-asset-cache-fixture',
 configureServer(server){server.middlewares.use((request,response,next)=>{
 const url=request.url?.split('?')[0];
 if(url==='/__asset'){response.setHeader('Content-Type','text/html');return response.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__asset.tsx"></script></body></html>');}
 if(url==='/api/v1/equipment/register/'+id+'/asset'&&request.method==='GET'){
 requests++;response.setHeader('Content-Type','application/json');
 if(denied){response.statusCode=403;return response.end(JSON.stringify({code:'PROJECT_ACCESS_DENIED',detail:'Denied synthetic scope'}));}
 return response.end(JSON.stringify({data:{current:version,history:[version],currentProject:{projectCode:'PRIVATE_PROJECT_A',projectName:'Private project'},custodyVisible:true,currentCustody:{borrowerName:'PRIVATE_BORROWER_A',siteLabel:'PRIVATE_SITE_A',dueOn:'2026-12-01'},canEdit:true}}));}
 next();});},
 resolveId(id){if(id==='/__asset.tsx')return 'virtual:asset-cache';},
 async load(id){if(id==='virtual:asset-cache')return transformWithOxc(entry,path.join(root,'__asset.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});}
 }]});
 await vite.listen();browser=await startBrowser(executable,temp);
 const p=browser.protocol,errors=[];
 const {targetId}=await p.send('Target.createTarget',{url:'about:blank'});
 const {sessionId:s}=await p.send('Target.attachToTarget',{targetId,flatten:true});
 p.listeners.add(event=>{
 if(event.method==='Fetch.requestPaused'){const requestId=event.params.requestId;let allowed=false;
 try{allowed=new URL(event.params.request.url).origin===origin;}catch{}
 if(!allowed)errors.push('unexpected external request');
 void p.send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'},event.sessionId).catch(()=>errors.push('interception failed'));}
 if(event.method==='Runtime.exceptionThrown')errors.push('unhandled browser exception');
 });
 await p.send('Runtime.enable',{},s);await p.send('Page.enable',{},s);
 await p.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]},s);
 await p.send('Page.navigate',{url:origin+'/__asset'},s);
 async function evalPage(fn){const r=await p.send('Runtime.evaluate',{expression:'('+fn.toString()+')()',returnByValue:true,awaitPromise:true},s);if(r.exceptionDetails)throw Error('browser evaluation failed');return r.result.value;}
 async function until(fn,label){for(let i=0;i<160;i++){if(await evalPage(fn))return;await new Promise(r=>setTimeout(r,125));}throw Error(label);}
 await until(()=>document.body.textContent.includes('918273.45')&&document.body.textContent.includes('PRIVATE_HISTORY_A')&&[...document.querySelectorAll('input')].some(e=>e.value==='PRIVATE_EVIDENCE_A'),'initial authorized view missing');
 const click=async()=>assert.equal(await evalPage(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Refresh register'&&!b.disabled);if(!b)return false;b.click();return true;}),true);
 denied=true;await click();
 await until(()=>document.body.textContent.includes('Asset details unavailable')&&!/PRIVATE_|918273\.45/.test(document.body.textContent)&&![...document.querySelectorAll('input')].some(e=>/PRIVATE_|918273\.45/.test(e.value))&&!document.body.textContent.includes('Record acquisition version'),'denied refresh retained protected data or editor');
 assert.ok(requests>=2);
 denied=false;await click();
 await until(()=>document.body.textContent.includes('PRIVATE_HISTORY_A')&&[...document.querySelectorAll('input')].some(e=>e.value==='PRIVATE_EVIDENCE_A'),'authorized recovery missing');
 assert.ok(requests>=3);assert.deepEqual(errors,[]);
 console.log('M4_ASSET_REAL_CHROMIUM_CACHED_HTTP_DENIAL_AND_RECOVERY_PASS');
}finally{if(browser)await browser.stop();if(vite)await vite.close();await rm(temp,{recursive:true,force:true});}
