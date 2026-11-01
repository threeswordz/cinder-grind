// Actual disposable Chromium FM01-A workflow; zero live API/DB connections.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../apps/web/',import.meta.url));
const require=createRequire(path.join(root,'package.json'));
const {createServer,transformWithOxc}=await import(pathToFileURL(require.resolve('vite')).href);
const chrome=['google-chrome','chromium','chromium-browser'].find(bin=>spawnSync(bin,['--version'],{stdio:'ignore'}).status===0);
assert.ok(chrome,'Real Chromium required; no SSR fallback');
const temporary=await mkdtemp(path.join(os.tmpdir(),'erp-fm01a-browser-'));
const harness="\nimport React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport { QueryClient, QueryClientProvider } from '@tanstack/react-query';\nimport { WeeklySiteSummaryPanel } from '/src/site-execution/WeeklySiteSummaryPanel.tsx';\nimport { MonetaryLocaleContext } from '/src/role-ui/monetary-presentation.tsx';\nconst today=new Date(),u=Date.UTC(today.getFullYear(),today.getMonth(),today.getDate());\nconst monday=new Date(u-((new Date(u).getUTCDay()+6)%7)*86400000).toISOString().slice(0,10);\nconst sunday=new Date(Date.parse(monday+'T00:00:00.000Z')+6*86400000).toISOString().slice(0,10);\nconst pid='browser-only-project-a',rid='browser-only-report-id';\nconst query=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});\nconst days=Array.from({length:7},(_,i)=>{\n const date=new Date(Date.parse(monday+'T00:00:00.000Z')+i*86400000).toISOString().slice(0,10);\n if(i!==0)return {date,status:'MISSING',report:null};\n return {date,status:'SUBMITTED',report:{id:rid,createdBy:{id:'foreman',displayName:'Authorized Foreman'},\n submittedAt:date+'T09:00:00.000Z',weatherObservation:null,generalRemarks:null,totalManpower:5,\n counts:{materialUsage:1,equipmentUsage:0,progressLines:1,issues:2,delays:1,inspections:3,corrections:1},\n progressObservations:[{reportId:rid,activityId:'activity-1',activityCode:'ACT-FM01',activityName:'Wall formwork',percentComplete:'25.00',note:'On site'}],\n detailPath:'/site-execution/reports/'+rid}};\n});\nquery.setQueryData(['site-execution','weekly',pid,monday,sunday],{data:{projectId:pid,from:monday,to:sunday,\n reviewState:'READ_ONLY_NO_APPROVAL',missingDayMeaning:'UNKNOWN_WORKDAY_OR_HOLIDAY',days,\n totals:{submittedDays:1,draftDays:0,missingDays:6,recordedDays:1,issues:2,delays:1,inspections:3}}});\nwindow.fetch=async()=>{throw new Error('Disposable browser fixture must not access API');};\nlet locale='en',projectId=pid,opened='';\nconst root=createRoot(document.getElementById('root'));\nfunction render(){root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={query}>\n <WeeklySiteSummaryPanel projectId={projectId} onOpenReport={id=>{opened=id;}}/>\n </QueryClientProvider></MonetaryLocaleContext.Provider>);}\nconst sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));\nconst check=(value,message)=>{if(!value)throw new Error(message);};\nasync function run(){\n render();for(let n=0;n<100&&!document.body.textContent.includes('Wall formwork');n++)await sleep(50);\n for(const [language,label] of [['en','Weekly site report'],['th','รายงานหน้างานรายสัปดาห์'],['zh-TW','工地週報']]){\n  locale=language;render();await sleep(180);\n  const visible=document.getElementById('root').textContent;\n  check(visible.includes(label),'Weekly panel not localized '+language);\n  check(visible.includes('Authorized Foreman'),'Source author missing '+language);\n  check(visible.includes('ACT-FM01'),'Canonical activity source missing '+language);\n  check(visible.includes('25.00%'),'Activity percentage missing '+language);\n  check(document.querySelectorAll('#root button').length===1,'Only report-source opening is permitted');\n }\n locale='en';render();await sleep(120);\n const link=[...document.querySelectorAll('#root button')].find(x=>x.textContent?.includes('Open daily report'));\n check(link,'Source report link missing');link.click();await sleep(25);check(opened===rid,'Source link ID wrong');\n // A previously authorized week must become invisible after a 403/failed refresh.\n await query.invalidateQueries({queryKey:['site-execution','weekly',pid]});\n for(let n=0;n<100&&!document.getElementById('root').textContent.includes('Weekly reports are unavailable');n++)await sleep(40);\n const revoked=document.getElementById('root').textContent;\n check(revoked.includes('Weekly reports are unavailable'),'Authorization refetch failure was not surfaced');\n check(!revoked.includes('Authorized Foreman')&&!revoked.includes('ACT-FM01'),'Cached weekly private source leaked after failed authorization refetch');\n projectId='browser-only-project-b';render();await sleep(220);\n const foreign=document.getElementById('root').textContent;\n check(!foreign.includes('Authorized Foreman'),'Prior Project daily source leaked on switch');\n check(!foreign.includes('ACT-FM01'),'Prior Project progress leaked on switch');\n document.body.dataset.result='PASS';\n}\nrun().catch(error=>{document.body.dataset.result='FAIL';document.body.dataset.error=error.message;});\n";
const vite=await createServer({
 root,configFile:false,server:{host:'127.0.0.1',port:0,hmr:false},
 plugins:[{name:'fm01a-weekly-browser-fixture',
  configureServer(server){server.middlewares.use((req,res,next)=>{
   if(req.url!=='/__fm01a-weekly')return next();
   res.setHeader('Content-Type','text/html');
   res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__fm01a-weekly.tsx"></script></body></html>');
  });},
  resolveId(id){if(id==='/__fm01a-weekly.tsx')return '\0fm01a-weekly.tsx';},
  async load(id){if(id==='\0fm01a-weekly.tsx')return transformWithOxc(
    harness,path.join(root,'__fm01a-weekly.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});},
 }],
});
try {
 await vite.listen();const address=vite.httpServer.address();
 const url='http://127.0.0.1:'+address.port+'/__fm01a-weekly';
 const result=await new Promise((resolve,reject)=>{
  const child=spawn(chrome,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
  '--no-proxy-server','--user-data-dir='+temporary,'--virtual-time-budget=20000','--dump-dom',url],
  {stdio:['ignore','pipe','pipe']});
  let out='',err='';
  child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
  const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Weekly browser timed out'));},60000);
  child.on('error',error=>{clearTimeout(timeout);reject(error);});
  child.on('close',code=>{clearTimeout(timeout);resolve({code,out,err});});
 });
 assert.equal(result.code,0,result.err.slice(-2000));
 assert.match(result.out,/data-result="PASS"/,(result.out.match(/data-error="[^"]*"/)??[result.out.slice(-4000)])[0]);
 console.log('FM01A_WEEKLY_BROWSER_PASS — React/MUI 7-day Foreman weekly, EN/TH/zh-TW, source link and Project cache isolation; no DB/API');
} finally {await vite.close();await rm(temporary,{recursive:true,force:true});}
