// Disposable browser regression; no API, database, credentials or retained fixtures.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {createServer as createHttpServer} from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const { build, transformWithOxc } = await import(pathToFileURL(require.resolve('vite')).href);
const {default:reactPlugin}=await import(pathToFileURL(require.resolve('@vitejs/plugin-react')).href);
const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find(bin => spawnSync(bin, ['--version'], { stdio: 'ignore' }).status === 0);
const temporary = await mkdtemp(path.join(os.tmpdir(), 'erp-boq-browser-'));
const harness = String.raw`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {CustomerBoqPanel} from '/src/budget/CustomerBoqPanel.tsx';
import {BudgetWorkspace} from '/src/budget/BudgetWorkspace.tsx';
import {MonetaryLocaleContext} from '/src/role-ui/monetary-presentation.tsx';
import App from '/src/App.tsx';
import {fetchCurrentUser} from '/src/api/auth.ts';
import {effectiveUiQueryScope} from '/src/role-ui/role-workspace-policy.ts';
const pid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222',uid='33333333-3333-4333-8333-333333333333',sourceLine='44444444-4444-4444-8444-444444444444',vid='55555555-5555-4555-8555-555555555555';
const all=['budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage','budget.customer.submit','budget.customer.approve'];
let stage='initial',projectChoices=0,appMode=false;
let signedIn=true,deferHistory=false,delayedHistory=[];
let instanceId=null,currentStepNo=1,approvalRound=0,submitRequests=[],decisionRequests=[];const actionReplays=new Map();
let actor='maker',state='DRAFT',edits=[],saved,attempts=[],rejectFirstSave=true,previewResolve,delayPreview=false,historyReads=0,projectReads=0,exportReads=0,printCalls=0,locale='en';
let user={id:uid,companyId:pid,email:'browser@example.invalid',displayName:'Browser actor',roleCodes:['MAKER'],permissions:all};
const options={sources:[{id:sid,revisionNo:1,revisionNumber:'COST-R1',currencyCode:'THB',lines:[{id:sourceLine,itemCode:'C1',description:'Source work',quantity:'10',uomId:uid,uomCode:'EA',rate:'100',amount:'1000'}]}],uoms:[{id:uid,uomCode:'EA',uomName:'Each',decimalPlaces:0}],workflows:[{workflowCode:'CUSTOMER_BOQ',workflowName:'Commercial checker'}]};
const priced=draft=>({currencyCode:'THB',totalAmount:'0.99',lines:draft.lines.map(l=>({...l,rate:'0.0033',amount:'0.99',markupPercent:'0',mappingReason:l.mappingReason??null,pricingReason:null,zeroPriceReason:null,costBasis:'1.0000000000',targetAmount:'1.00',rateRoundingDifference:'-0.01'})),sourceCoverage:[{sourceLineId:sourceLine,allocatedPercent:'0.1',unallocatedPercent:'99.9'}]});
function history(){return {allowedActions:{edit:['DRAFT','REJECTED'].includes(state),submit:['DRAFT','REJECTED'].includes(state),decide:state==='SUBMITTED'&&actor==='checker'},version:{id:vid,versionNo:1,sourceRevisionId:sid,currentEditNo:edits.length,currencyCode:'THB',previousVersionId:null,createdByUserId:uid,submittedByUserId:state==='DRAFT'?null:uid,approvalInstanceId:instanceId,approvalInstance:state==='DRAFT'?null:{approvalState:state,currentStepNo},edits},approvals:state==='DRAFT'?[]:[{id:instanceId,approvalState:state,startedAt:'2026-10-29',actions:state==='APPROVED'||state==='REJECTED'?[{id:'action',action:state,actionByUserId:'checker',actionAt:'2026-10-29',comment:'Checked'}]:[]}]};}
const json=(data,status=200)=>new Response(JSON.stringify({data}),{status,headers:{'Content-Type':'application/json'}});
window.print=()=>{printCalls++;};
const clicks=[];HTMLAnchorElement.prototype.click=function(){clicks.push(this.download);};
window.fetch=async(url,init={})=>{
  const path=new URL(String(url),location.href).pathname.replace('/api/v1',''),method=init.method??'GET',body=init.body?JSON.parse(init.body):undefined;
  if(path==='/auth/me')return signedIn?json(user):new Response(JSON.stringify({code:'AUTHENTICATION_REQUIRED'}),{status:401,headers:{'Content-Type':'application/problem+json'}});
  if(path==='/auth/login'){signedIn=true;return json({user,csrfToken:'browser-login-csrf',expiresAt:'2026-10-30T00:00:00Z'});}
  if(path==='/auth/csrf')return json({csrfToken:'browser-csrf'});
  if(path==='/auth/logout'){signedIn=false;return new Response(null,{status:204});}
  if(path==='/budget/customer/projects'){projectReads++;return json([{id:pid,projectCode:'P',projectName:'Browser project'}]);}
  if(path.endsWith('/options')&&path.includes('/budget/customer/'))return json(options);
  if(path.endsWith('/versions')&&method==='GET')return json(saved?[{id:vid,versionNo:1,sourceRevisionId:sid,currentEditNo:edits.length,approvalState:state,totalAmount:'0.99',currencyCode:'THB'}]:[]);
  if(path.endsWith('/preview')){
    const result=priced(body.draft);
    if(delayPreview)return new Promise(resolve=>{previewResolve=()=>resolve(json({...result,lines:result.lines.map(l=>({...l,costBasis:'314159.2653'}))},201));});
    return json(result,201);
  }
  if(path.endsWith('/versions')&&method==='POST'||path.endsWith('/edit')){
    if(!init.headers.get('x-csrf-token'))throw new Error('Actual client omitted CSRF');
    attempts.push(body);
    if(rejectFirstSave){rejectFirstSave=false;return new Response(JSON.stringify({code:'FIXTURE_RETRY',detail:'Retry identical input'}),{status:503,headers:{'Content-Type':'application/problem+json'}});}
    saved=structuredClone(body.draft);const p=priced(saved);
    edits.push({id:'edit-'+(edits.length+1),editNo:edits.length+1,reason:saved.reason,createdAt:'2026-10-29',totalAmount:p.totalAmount,actorUserId:uid,lines:saved.lines.map((l,i)=>({...l,id:'line-'+i,lineKey:l.lineId,rate:p.lines[i].rate,amount:p.lines[i].amount,uomSnapshot:{code:'EA',name:'Each',decimalPlaces:0},pricingSnapshot:p.lines[i],mappings:l.mappings}))});
    return json({id:vid,editNo:edits.length,approvalState:state},201);
  }
  if(path.endsWith('/submit')){submitRequests.push(body);if(actionReplays.has(body.requestId))return json(actionReplays.get(body.requestId),201);state='SUBMITTED';instanceId=crypto.randomUUID();currentStepNo=1;approvalRound++;const receipt={id:vid,editNo:edits.length,approvalState:state};actionReplays.set(body.requestId,receipt);return json(receipt,201);}
  if(path.endsWith('/decision')){if(actor!=='checker')throw new Error('Maker UI exposed approval');decisionRequests.push(body);if(actionReplays.has(body.requestId))return json(actionReplays.get(body.requestId),201);if(body.expectedInstanceId!==instanceId)throw new Error('UI sent a stale instance');if(body.decision==='REJECT')state='REJECTED';else if(currentStepNo===1)currentStepNo=2;else state='APPROVED';const receipt={id:vid,editNo:edits.length,approvalState:state};actionReplays.set(body.requestId,receipt);return json(receipt,201);}
  if(path.endsWith('/export')){exportReads++;return new Response('Description,Rate,Amount\nWork,0.0033,0.99',{headers:{'Content-Type':'text/csv','Content-Disposition':'attachment; filename="customer-boq.csv"'}});}
  if(path.endsWith('/versions/'+vid)){historyReads++;const snapshot=structuredClone(history());if(deferHistory)return new Promise(resolve=>delayedHistory.push(()=>resolve(json(snapshot))));return json(snapshot);}
  if(path==='/budget/quantity/projects')return json([{id:pid,projectCode:'P',projectName:'Quantity project'}]);
  if(path.startsWith('/budget/quantity/')&&path.endsWith('/revisions'))return json([]);
  if(path.startsWith('/budget/quantity/')&&path.endsWith('/boq'))return json({id:'working',boqName:'Work',items:[{id:'item',itemCode:'Q1',description:'Visible quantity work',quantity:'300',uomCode:'EA'}]});
  if(path==='/budget/projects'||path==='/budget/revision-projects')return json([]);
  if(path==='/budget/revision-workflow-options')return json([]);
  throw new Error('Unexpected fixture request '+method+' '+path);
};
const root=createRoot(document.getElementById('root'));
let cache=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
function render(){root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={cache}><section data-test-actor={actor}><CustomerBoqPanel key={actor} permissions={all}/></section></QueryClientProvider></MonetaryLocaleContext.Provider>);}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(value,message)=>{if(!value)throw new Error(message);};
async function until(fn,message){for(let i=0;i<120;i++){if(fn())return;await wait(30);}throw new Error(message);}
const text=()=>document.getElementById('root').textContent;
const scope=()=>document.querySelector('[data-testid=customer-boq-workspace]')??document.getElementById('root');
const buttons=label=>[...scope().querySelectorAll('button')].filter(b=>b.textContent===label);
async function button(label){await until(()=>buttons(label).some(b=>!b.disabled),'Missing enabled button '+label);buttons(label).find(b=>!b.disabled).click();await wait(60);}
const labelled=(node,label)=>(node.getAttribute('aria-labelledby')??'').split(' ').some(id=>document.getElementById(id)?.textContent===label);
async function select(label,choice){await until(()=>[...scope().querySelectorAll('[role="combobox"]')].some(n=>labelled(n,label)),'Missing selector '+label);const el=[...scope().querySelectorAll('[role="combobox"]')].find(n=>labelled(n,label));el.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await until(()=>[...document.querySelectorAll('[role="option"]')].some(n=>n.textContent.includes(choice)),'Missing choice '+choice);[...document.querySelectorAll('[role="option"]')].find(n=>n.textContent.includes(choice)).click();await wait(80);}
async function input(label,value){const labels=[...scope().querySelectorAll('label')];const lab=labels.find(n=>n.textContent.replace(/\s*\*$/,'')===label);check(lab,'Missing input '+label);const el=document.getElementById(lab.htmlFor);check(el?.tagName==='INPUT','Expected input '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));await wait(40);}
async function chooseProject(){stage='project-'+(++projectChoices);if(!appMode)await until(()=>document.querySelector('[data-test-actor="'+actor+'"]'),'Actor render did not commit');await select('Project','Browser project');await until(()=>text().includes('New draft'),'Customer workspace not loaded');}
async function chooseVersion(){await select('Version','#1');await until(()=>text().includes('Immutable history'),'Stored version not loaded');}
async function run(){
  render();await chooseProject();
  await select('Approved cost revision','COST-R1');await input('Change / negotiation reason','Prepare approved E5 example');await input('Description','Customer work');await input('Quantity','300');await select('Unit','EA');await select('Pricing method','Markup %');await input('Markup %','0');await select('Approved source line','C1');await input('Cost allocation %','0.1');await input('Mapping reason','Independent quantity / allocated share');
  delayPreview=true;await button('Preview pricing');await until(()=>previewResolve,'Preview request was not captured');await input('Markup %','1');previewResolve();await wait(100);check(!text().includes('314159.2653'),'A delayed old preview survived changed inputs');delayPreview=false;await input('Markup %','0');
  await button('Preview pricing');await until(()=>text().includes('Rounding difference: THB -0.01'),'E5 rounding discrepancy was not visible');
  await button('Save draft');await until(()=>text().includes('FIXTURE_RETRY'),'Retry failure not shown');await button('Save draft');await until(()=>text().includes('Immutable history'),'Saved snapshot not shown');check(attempts[0].requestId===attempts[1].requestId,'Identical failed save changed replay identity');check(attempts[1].draft.lines[0].quantity==='300'&&attempts[1].draft.lines[0].mappings[0].sharePercent==='0.1','Exact decimal transport was changed');check(text().includes('Rounding difference: THB -0.01'),'Persisted E5 discrepancy not visible before submit');
  await select('Approval workflow','Commercial checker');await input('Change / negotiation reason','Unsaved negotiation');check(buttons('Submit')[0].disabled,'Unsaved data could submit a different stored snapshot');await button('Save draft');await until(()=>text().includes('#2'),'New immutable edit not visible');await button('Submit');await until(()=>text().includes('SUBMITTED'),'Submission state missing');check(!buttons('Approve').length,'Maker was offered approval');
  // Another configured checker rejects while the maker keeps this exact
  // mounted form, workflow and edit number. Refresh is a real UI operation.
  actor='checker';await window.fetch('http://localhost:3000/api/v1/budget/customer/projects/'+pid+'/versions/'+vid+'/decision',{method:'POST',headers:new Headers({'x-csrf-token':'browser-csrf'}),body:JSON.stringify({requestId:crypto.randomUUID(),expectedInstanceId:instanceId,decision:'REJECT'})});actor='maker';await button('Refresh');await until(()=>text().includes('REJECTED'),'External checker rejection not refreshed');await button('Submit');await until(()=>text().includes('SUBMITTED'),'Same mounted rejected form did not resubmit');check(submitRequests.length===2&&submitRequests[0].requestId!==submitRequests[1].requestId&&approvalRound===2,'Resubmission without edit or workflow change reused the original action key');
  actor='checker';cache.clear();render();await chooseProject();await chooseVersion();await button('Reject');await until(()=>text().includes('REJECTED'),'Rejection state missing');
  actor='maker';cache.clear();render();await chooseProject();await chooseVersion();await select('Approval workflow','Commercial checker');await button('Submit');await until(()=>text().includes('SUBMITTED'),'Unchanged rejected version did not resubmit');check(approvalRound===3,'Resubmission after checker UI rejection did not create an instance');
  actor='checker';cache.clear();render();await chooseProject();await chooseVersion();await button('Approve');await until(()=>currentStepNo===2&&buttons('Approve').some(b=>!b.disabled),'Configured second approval step missing');await button('Approve');await until(()=>text().includes('APPROVED'),'Consecutive approval step did not advance');const approvals=decisionRequests.filter(r=>r.decision==='APPROVE');check(approvals.length===2&&approvals[0].requestId!==approvals[1].requestId&&approvals[0].expectedInstanceId===approvals[1].expectedInstanceId,'Consecutive configured steps reused the previous approval action key');check(!buttons('Save draft').length,'Approved version stayed editable');
  const before=historyReads;await button('Print');await until(()=>printCalls===1,'Browser print not requested');check(historyReads>before,'Print reused a stale cached graph');check(document.getElementById('customer-boq-print').textContent.includes('0.0033'),'Print lost stored rate');check(!document.getElementById('customer-boq-print').textContent.includes('1000'),'Print leaked internal cost');await button('Export CSV');await until(()=>exportReads===1&&clicks.includes('customer-boq.csv'),'Authorized CSV download missing');
  for(const [language,label] of [['th','客戶'],['zh-TW','客戶工程量清單']]){locale=language;render();await wait(100);check(language==='th'?text().includes('BOQ สำหรับลูกค้า'):text().includes(label),'Locale presentation missing '+language);}
  // Exercise the real root App, including its keyed AuthenticatedWorkspace cache.
  const outer=new QueryClient({defaultOptions:{queries:{retry:false}}});
  function AuthProbe(){const {data}=useQuery({queryKey:['current-user'],queryFn:fetchCurrentUser,retry:false});return <output id="auth-probe" data-scope={data?effectiveUiQueryScope(data.id,data.companyId,data.permissions,data.roleCodes):''}/>;}
  const authRendered=()=>until(()=>document.getElementById('auth-probe')?.getAttribute('data-scope')===effectiveUiQueryScope(user.id,user.companyId,user.permissions,user.roleCodes),'Auth scope render did not commit');
  function appRender(){appMode=true;root.render(<React.StrictMode><QueryClientProvider client={outer}><App/><AuthProbe/></QueryClientProvider></React.StrictMode>);}
  appRender();await until(()=>text().includes('Browser actor'),'Real App did not authenticate');
  async function nav(){const node=[...document.querySelectorAll('button,a,[role=button]')].find(n=>n.textContent==='BOQ & Budget');check(node,'Real Budget navigation missing');node.click();await wait(100);}
  await nav();await chooseProject();await chooseVersion();check(text().includes('0.99'),'Full-cost root did not load commercial data');
  const firstProjects=projectReads;deferHistory=true;await button('Refresh');await until(()=>delayedHistory.length,'Old-scope request was not captured');
  user={...user,permissions:['budget.quantity.view'],roleCodes:['QUANTITY']};await outer.invalidateQueries({queryKey:['current-user']});await authRendered();await until(()=>!text().includes('0.0033'),'Old commercial DOM survived permission downgrade');await nav();await select('Project','Quantity project');await until(()=>text().includes('Visible quantity work'),'Quantity DOM missing');deferHistory=false;delayedHistory.forEach(resolve=>resolve());await wait(100);check(!text().includes('0.99')&&!text().includes('1000'),'Quantity workspace reused money from old cache or late old response');
  user={...user,permissions:all,roleCodes:['CHECKER']};await outer.invalidateQueries({queryKey:['current-user']});await authRendered();await nav();await chooseProject();await chooseVersion();check(projectReads>firstProjects,'A-B-A reused the old business cache');
  const priorProjects=projectReads;user={...user,id:sid,companyId:uid};await outer.invalidateQueries({queryKey:['current-user']});await authRendered();await until(()=>!text().includes('0.0033'),'Identity/Company switch retained old commercial DOM');await nav();await chooseProject();check(projectReads>priorProjects,'New identity/Company reused the old Project cache');
  await chooseVersion();const beforeRole=projectReads;user={...user,roleCodes:['OTHER_CHECKER']};await outer.invalidateQueries({queryKey:['current-user']});await authRendered();await until(()=>!text().includes('0.0033'),'Role-only change retained old commercial DOM');await nav();await chooseProject();check(projectReads>beforeRole,'Role-only change reused old business cache');await chooseVersion();
  const logout=[...document.querySelectorAll('button')].find(n=>n.textContent==='Sign out');check(logout,'Sign out missing');logout.click();await until(()=>text().includes('Sign in to the'),'Logout did not return to the actual LoginScreen');check(!text().includes('0.99'),'Logout retained commercial data');
  user={...user,id:uid,companyId:pid,roleCodes:['QUANTITY'],permissions:['budget.quantity.view']};await input('Email','browser@example.invalid');await input('Password','Disposable-browser-password');await button('Sign in');await until(()=>text().includes('Browser actor'),'New sign-in did not authenticate');await authRendered();await nav();await select('Project','Quantity project');await until(()=>text().includes('Visible quantity work'),'New sign-in quantity screen missing');check(!text().includes('0.0033')&&!text().includes('0.99'),'A new signed-in identity reused commercial data');
  document.body.dataset.result='PASS';outer.clear();cache.clear();root.unmount();
}
run().catch(error=>{document.body.dataset.result='FAIL';document.body.dataset.error=error.message+'; stage='+stage+'; projectReads='+projectReads+'; choices='+JSON.stringify([...document.querySelectorAll('[role=option]')].map(n=>n.textContent))+'; ui='+text().slice(-1800);});
`;
let server;
try {
  // Dev-server optimization previously supplied different React generations to
  // a late-mounted Quantity screen and its renderer. Serve one immutable bundle;
  // development React deliberately retains actual StrictMode effect replay.
  const built=await build({root,configFile:false,mode:'development',
    resolve:{dedupe:['react','react-dom']},define:{'process.env.NODE_ENV':JSON.stringify('development')},
    build:{write:false,minify:false,rollupOptions:{input:'/__boq-check.tsx'}},
    plugins:[reactPlugin(),{name:'boq-browser-fixture',
      resolveId(id){if(id==='/__boq-check.tsx')return '\0boq-browser-fixture.tsx';},
      async load(id){if(id==='\0boq-browser-fixture.tsx')return transformWithOxc(harness,path.join(root,'__boq-check.tsx'),{lang:'tsx',jsx:{runtime:'automatic'}});},
    }],
  });
  const output=(Array.isArray(built)?built:[built]).flatMap(bundle=>bundle.output);
  const modules=[...new Set(output.filter(file=>file.type==='chunk').flatMap(file=>Object.keys(file.modules)))];
  const reactCopies=modules.filter(id=>/\/react\/cjs\/react\.(development|production)\.js$/.test(id));
  assert.equal(reactCopies.length,1,'Fixture must contain exactly one React runtime');
  assert.match(reactCopies[0],/react\.development\.js$/,'StrictMode must use development React');
  assert.equal(modules.filter(id=>/\/react-dom\/cjs\/react-dom-client\.development\.js$/.test(id)).length,1,'Fixture must contain one matching development renderer');
  const entry=output.find(file=>file.type==='chunk'&&file.isEntry);assert.ok(entry,'Browser fixture entry missing');
  const files=new Map(output.map(file=>['/'+file.fileName,file]));
  const css=output.filter(file=>file.fileName.endsWith('.css')).map(file=>'<link rel="stylesheet" href="/'+file.fileName+'">').join('');
  const html='<!doctype html><html><head>'+css+'</head><body><div id="root"></div><script type="module" src="/'+entry.fileName+'"></script></body></html>';
  assert.ok(chrome,'Chromium is required for real-browser evidence; no SSR fallback.');
  server=createHttpServer((req,res)=>{
    const pathname=(req.url??'/').split('?',1)[0];res.setHeader('Cache-Control','no-store');
    if(pathname==='/__boq-check'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    const file=files.get(pathname);if(!file){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',file.fileName.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8');
    res.end(file.type==='chunk'?file.code:file.source);
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port+'/__boq-check';
  // Drive this disposable Chrome through its own loopback protocol endpoint.
  // Virtual-time --dump-dom can outrun animation frames used by real print UI.
  // Real elapsed time preserves React/RAF behavior; no animation callback is stubbed.
  const child=spawn(chrome,['--headless','--window-size=1440,1000','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-proxy-server','--disable-background-timer-throttling','--disable-renderer-backgrounding','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+temporary,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let ws;
  try {
    const endpoint=await new Promise((resolve,reject)=>{
      let err='';const timeout=setTimeout(()=>reject(new Error('Disposable Chrome protocol startup timed out')),15000);
      child.stderr.on('data',chunk=>{err+=chunk;const found=err.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found){clearTimeout(timeout);resolve(found[1]);}});
      child.once('error',error=>{clearTimeout(timeout);reject(error);});
      child.once('close',code=>{clearTimeout(timeout);reject(new Error('Disposable Chrome exited '+code+': '+err.slice(-1000)));});
    });
    ws=new WebSocket(endpoint);
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Chrome protocol connection timed out')),10000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Chrome protocol connection failed'));},{once:true});});
    let sequence=0;const pending=new Map(),browserErrors=[],uncaught=[];
    ws.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown'){const detail=message.params.exceptionDetails.exception?.description??message.params.exceptionDetails.text;browserErrors.push(detail);uncaught.push(detail);}if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')browserErrors.push(message.params.args.map(a=>a.description??a.value??'').join(' '));const callback=pending.get(message.id);if(!callback)return;pending.delete(message.id);clearTimeout(callback.timer);if(message.error)callback.reject(new Error(JSON.stringify(message.error)));else callback.resolve(message.result);});
    const command=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Chrome protocol timed out: '+method));},10000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
    const target=await command('Target.createTarget',{url:'about:blank'});
    const {sessionId}=await command('Target.attachToTarget',{targetId:target.targetId,flatten:true});
    await command('Page.enable',{},sessionId);await command('Runtime.enable',{},sessionId);
    await command('Page.navigate',{url},sessionId);await command('Page.bringToFront',{},sessionId);
    const deadline=Date.now()+60000;let state;
    while(Date.now()<deadline){
      const read=await command('Runtime.evaluate',{expression:'({result:document.body?.dataset.result,error:document.body?.dataset.error})',returnByValue:true},sessionId);
      state=read.result?.value;
      if(state?.result)break;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    assert.equal(state?.result,'PASS',(state?.error??'Actual browser did not finish the workflow')+'; browserErrors='+browserErrors.slice(-5).join(' | ').slice(0,5000));
    assert.deepEqual(uncaught,[],'Actual browser emitted an uncaught application exception');
  } finally {
    ws?.close();
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},3000);child.once('close',()=>{clearTimeout(timer);resolve();});});}
  }
  console.log('BOQ_WORKFLOW_BROWSER_PASS — actual Customer/Quantity UI, exact payload/retry, preview race, stored rounding, submit/checker/history, fresh print/CSV and actual App identity/Company/permission cache replacement; mocked transport only');
} finally { if(server)await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await rm(temporary,{recursive:true,force:true}); }
