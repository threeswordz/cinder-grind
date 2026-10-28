// Disposable browser regression; no API, database, credentials or retained fixtures.
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
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find(bin => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0);
assert.ok(chrome, 'Chromium is required for real-browser evidence; no SSR fallback.');
const temporary = await mkdtemp(path.join(os.tmpdir(), 'erp-budget-browser-'));
const harness = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CostControlWorkspace } from '/src/cost-control/CostControlWorkspace.tsx';
import { ManagementDashboards } from '/src/management/ManagementDashboards.tsx';
import { ManagementPrintDocument } from '/src/management/ManagementPrintDocument.tsx';
import { MonetaryLocaleContext } from '/src/role-ui/monetary-presentation.tsx';

const project = { id: 'browser-project', projectCode: 'BROWSER-ONLY', projectName: 'Disposable Budget display', isActive: true };
const money = { originalBudget: '0', revisedBudget: '0', committedCost: {total:'1205'}, actualCost:{total:'1205',direct:'0'}, paidCost:{total:'1205'}, remainingCommitment:{total:'0'}, uncommittedEtc:'0', costToComplete:'0', forecastCost:'1205', variance:'-1205', commercial:{originalContractValue:'10000',approvedVariationValue:'0',revisedContractValue:'10000',actualRevenue:'0',cashReceived:'0',forecastRevenue:'10000',actualProfit:'-1205',forecastProfit:'8795'} };
const today = new Date().toISOString().slice(0,10);
const query = new QueryClient({ defaultOptions: { queries:{ staleTime:Infinity, retry:false } } });
const put = (key,data) => query.setQueryData(key,{data});
put(['cost-control-projects'],[project]);
put(['cost-control-options',project.id],{wbs:[],costCodes:[]});
put(['management','projects'],[project]);
let baseline = { original:false,current:false };
let currentReport;
function seed(approved) {
  baseline = {original:approved,current:approved};
  const cost = {project,baseCurrencyCode:'THB',budgetBaseline:baseline,totals:money,currentForecast:null,filters:{wbs:null,costCode:null,wbsIncludesDescendants:false},reportDimensions:{wbs:[],costCodes:[]},sourceEvidence:{},dimensionBreakdown:[{...money,wbs:null,costCode:null,allocationState:'UNALLOCATED'}]};
  put(['cost-control-read-model',project.id],cost);
  put(['cost-control-rpt009',project.id,'',''],cost);
  const flat = {...money,committedCost:'1205',actualCost:'1205',paidCost:'1205',remainingCommitment:'0',budgetBaseline:baseline};
  put(['management','project-summary',project.id,today,14],{project,asOfDate:today,lookaheadDays:14,baseCurrencyCode:'THB',domains:{cost:flat,schedule:{currentBaseline:{status:'UNAVAILABLE',reason:'NO_APPROVED_BASELINE'},summary:{total:0,completed:0,delayed:0,critical:0},lookaheadActivityCount:0},siteExecution:{recentReportCount:0,issueCount:0,delayCount:0,inspectionCount:0,assignedEquipmentCount:0},procurement:{summary:{total:0,AT_RISK:0,ON_TIME:0,UNAVAILABLE:0}}},sourceTraceability:{}});
  currentReport = {project,asOfDate:today,lookaheadDays:14,baseCurrencyCode:'THB',budgetBaseline:baseline,filters:{domain:'COST',status:null},rowCount:1,rows:[{domain:'COST',metric:'ORIGINAL_BUDGET',label:approved?'Original budget':'Original budget (no approved Budget)',status:approved?'AVAILABLE':'UNAVAILABLE',value:approved?'0':null,unit:'MONEY',currencyCode:'THB',canonicalSource:'V0.7 Cost Control'}]};
}
seed(false);
let locale = 'en';
const root = createRoot(document.getElementById('root'));
function render() {root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={query}><section id="cost"><CostControlWorkspace permissions={['cost.control.view']} initialProjectId={project.id}/></section><section id="management"><ManagementDashboards permissions={[]} initialProjectId={project.id}/></section><ManagementPrintDocument report={currentReport}/></QueryClientProvider></MonetaryLocaleContext.Provider>);}
window.fetch = async () => { throw new Error('Browser fixture must not contact any API'); };
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const check = (value, message) => {if(!value) throw new Error(message);};
async function run() {
  render();
  for(let n=0;n<100&&!document.querySelector('#management [role="tab"]');n++) await wait(50);
  const tab = [...document.querySelectorAll('#management [role="tab"]')].find(node=>node.textContent==='Cost');
  check(tab,'Actual Management Cost tab did not render'); tab.click(); await wait(100);
  for(const [language,text] of [['en','No approved Budget'],['th','ยังไม่มีงบประมาณที่อนุมัติ'],['zh-TW','尚無已核准預算']]) {
    locale=language; seed(false);render(); await wait(100);
    check(document.querySelector('#cost').textContent.includes('Original Budget '+text),'Cost workspace lost missing-budget state '+language);
    check(document.querySelector('#cost tbody td:nth-child(4)').textContent===text,'Cost report row falsely displays approved zero '+language);
    check(document.querySelector('#management').textContent.includes('Original budget: '+text),'Management Cost lost missing-budget state '+language);
    check(document.querySelector('#erp-management-print-document').textContent.includes('UNAVAILABLE'),'Print lost unavailable Budget');
    check(document.querySelector('#cost').textContent.includes('Committed THB 1205'),'Canonical committed cost changed');
    seed(true); render(); await wait(100);
    check(document.querySelector('#cost').textContent.includes('Original Budget THB 0'),'Approved zero missing from Cost workspace');
    check(document.querySelector('#cost tbody td:nth-child(4)').textContent==='0','Approved zero missing from dimensional report');
    check(document.querySelector('#management').textContent.includes('Original budget: THB 0'),'Approved zero missing from Management');
    check(!document.querySelector('#cost').textContent.includes(text),'Stale missing-budget warning survived approval');
  }
  document.body.dataset.result='PASS';
}
run().catch(error=>{document.body.dataset.result='FAIL';document.body.dataset.error=error.message;});
`;
const vite = await createServer({
  root, configFile: false, server: { host: '127.0.0.1', port: 0, hmr: false },
  plugins: [{ name: 'budget-browser-fixture',
    configureServer(server) { server.middlewares.use((req,res,next) => { if(req.url !== '/__budget-check') return next(); res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><body><div id="root"></div><script type="module" src="/__budget-check.tsx"></script></body></html>'); }); },
    resolveId(id) { if(id === '/__budget-check.tsx') return '\0budget-browser-fixture.tsx'; },
    async load(id) { if(id === '\0budget-browser-fixture.tsx') return transformWithOxc(harness, path.join(root, '__budget-check.tsx'), { lang: 'tsx', jsx: { runtime: 'automatic' } }); },
  }],
});
try {
  await vite.listen();
  const address = vite.httpServer.address();
  const url = 'http://127.0.0.1:' + address.port + '/__budget-check';
  const result = await new Promise((resolve,reject) => {
    const child = spawn(chrome, ['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--user-data-dir='+temporary,'--virtual-time-budget=15000','--dump-dom',url], { stdio:['ignore','pipe','pipe'] });
    let out='',err='';child.stdout.on('data',chunk=>out+=chunk);child.stderr.on('data',chunk=>err+=chunk);
    const timeout=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Browser timed out'));},60000);
    child.on('error',error=>{clearTimeout(timeout);reject(error);});
    child.on('close',code=>{clearTimeout(timeout);resolve({code,out,err});});
  });
  assert.equal(result.code,0,result.err.slice(-2000));
  assert.match(result.out,/data-result="PASS"/,(result.out.match(/data-error="[^"]*"/) ?? [result.out.slice(-4000)])[0]);
  console.log('BUDGET_PRESENCE_BROWSER_PASS — actual Cost workspace/report, Management Cost and print DOM; absent/approved-zero; EN/TH/zh-TW; no API/database');
} finally { await vite.close(); await rm(temporary,{recursive:true,force:true}); }
