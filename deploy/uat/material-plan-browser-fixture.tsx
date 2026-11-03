// Disposable Chromium fixture for the C user interface only.
// Synthetic transport: no PostgreSQL, retained roles/Companies or Production calls.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MaterialPlansPanel } from '/src/inventory/MaterialPlansPanel.tsx';
import { MaterialPlanIssueControls } from '/src/inventory/MaterialPlanIssueControls.tsx';
import { materialPlansApi as plansApi } from '/src/api/material-plans.ts';
import { materialPlanIssuesApi as issueApi } from '/src/api/material-plan-issues.ts';
import { MonetaryLocaleContext } from '/src/role-ui/monetary-presentation.tsx';

const project='11111111-1111-4111-8111-111111111111';
const warehouse='22222222-2222-4222-8222-222222222222';
const material='33333333-3333-4333-8333-333333333333';
const unit='44444444-4444-4444-8444-444444444444';
const planId='55555555-5555-4555-8555-555555555555';
const planLine='66666666-6666-4666-8666-666666666666';
const issueId='77777777-7777-4777-8777-777777777777';
const issueItem='88888888-8888-4888-8888-888888888888';
const revision='99999999-9999-4999-8999-999999999999';
const source='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const basis='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const author='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const active='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const now='2026-11-03';
const approved={
  id:revision,revisionNo:2,status:'APPROVED',validFrom:'2026-11-01',validTo:'2026-11-30',
  reason:'Approved synthetic quantities',createdByUserId:author,submittedByUserId:author,
  decidedByUserId:active,decisionComment:'Authorized independent approval',
  lines:[{id:planLine,budgetRevisionLineId:source,materialId:material,uomId:unit,quantity:'10.0000',
    material:{materialCode:'MAT-A',materialName:'Synthetic steel'},uom:{uomCode:'EA'}}],
};
const plan={
  id:planId,companyId:project,projectId:project,warehouseId:warehouse,budgetRevisionId:basis,
  workPackageCode:'WP-1',version:3,createdByUserId:author,
  latestRevision:approved,approvedRevision:approved,issueEnforcement:'ENABLED_FOR_NEW_SYNTHETIC_ISSUES',
  privateSentinel:'NEVER_DISPLAY_COST_BOQ_PRICE',
};
const row={id:plan.id,companyId:plan.companyId,projectId:plan.projectId,warehouseId:plan.warehouseId,
  budgetRevisionId:plan.budgetRevisionId,workPackageCode:plan.workPackageCode,
  version:plan.version,createdByUserId:plan.createdByUserId};
const issue={
 id:issueId,issueNumber:'MI-SYN-1',projectId:project,warehouseId:warehouse,
 issueDate:now,issuedToEmployeeId:null,remarks:null,createdAt:now,submittedAt:null,
 postedAt:null,reversedAt:null,
 items:[{id:issueItem,lineNo:1,materialId:material,uomId:unit,quantity:'4.0000',
  reservationId:null,wbsId:null,costCodeId:null,activityId:null,
  material:{materialCode:'MAT-A',materialName:'Synthetic steel'},uom:{uomCode:'EA'}}],
};
const history={binding:{issueId,policyId:project,authorizationId:null},items:[],nextCursor:null};
const reviewAuth={
 id:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',sequence:1,mode:'OVERAGE',
 createdByUserId:author,createdAt:now,approval:{
  approvalState:'SUBMITTED',currentStepNo:1,actions:[],
 },lines:[{issueItemId:issueItem,planId,planLineId:planLine,
 planVersion:3,quantity:'12.0000',overageQuantity:'2.0000'}],
};
const store=['inventory.material_plan.view','inventory.material_plan.create','inventory.material_plan.revise',
 'inventory.material_plan.submit','inventory.material_plan.issue.post','inventory.issue.view'];
const reviewer=['inventory.material_plan.view','inventory.issue.view','inventory.material_plan.overage.review'];
const approver=['inventory.material_plan.view','inventory.issue.view','inventory.material_plan.overage.approve'];
let creates=0, previews=0, effects=0, issueCalls=[], decisions=[], receivedKeys=new Set();
let deny=false, browserQuery=null, fixtureHistory=history;
const check=(v,msg)=>{if(!v)throw Error(msg);};
const clone=v=>structuredClone(v);
const data=value=>({data:clone(value)});
plansApi.projects=async()=>{if(deny)throw Error('403 revoked Project');return data([{id:project,projectCode:'P-001',projectName:'Synthetic Project'}]);};
plansApi.list=async()=>{if(deny)throw Error('403 revoked plan list');return data({items:[row],nextCursor:null});};
plansApi.get=async()=>{if(deny)throw Error('403 revoked plan detail');return data(plan);};
plansApi.history=async()=>{if(deny)throw Error('403 revoked plan history');return data({items:[{id:revision,revisionNo:2,status:'APPROVED',
 reason:'Approved synthetic quantities',createdByUserId:author}],nextCursor:null});};
plansApi.choices=async(_project,kind)=>{if(deny)throw Error('403 revoked choices');return data({items:
 kind==='warehouses'?[{id:warehouse,warehouseCode:'SITE-A',warehouseName:'Site warehouse'}]:
 kind==='materials'?[{id:material,materialCode:'MAT-A',materialName:'Synthetic steel',defaultUomId:unit}]:
 kind==='revisions'?[{id:basis,revisionNo:1,revisionNumber:'BOQ-COST-1'}]:
 kind==='source-lines'?[{id:source,itemCode:'BOQ-001',description:'Synthetic steel only',
  quantity:'10.0000',uomId:unit,uomCode:'EA'}]:[],nextCursor:null});};
plansApi.create=async body=>{creates++;return data({id:planId,projectId:project,revisionId:revision,version:1,status:'DRAFT'});};
issueApi.history=async (_issue, after='')=>{
 if(deny)throw Error('403 revoked issue authorization history');
 if(after)check(fixtureHistory.nextCursor===after,'Unknown history cursor');
 return data(fixtureHistory);
};
issueApi.preview=async (_issue, bindings)=>{
 previews++;check(bindings.length===1&&bindings[0].issueItemId===issueItem&&
  bindings[0].planLineId===planLine&&bindings[0].expectedPlanVersion===3,
  'Preview did not bind exactly to approved line/version');
 return data({issueId,result:'WITHIN_PLAN',overageQuantity:'0.0000',
  items:[{issueItemId:issueItem,planId,planLineId:planLine,planVersion:3,quantity:'4.0000',
   overageQuantity:'0.0000',allowance:'10.0000',used:'0.0000',remaining:'10.0000'}]});
};
issueApi.withinPlan=async(id,key,bindings)=>{
 issueCalls.push({id,key,bindings:clone(bindings)});
 if(!receivedKeys.has(key)){receivedKeys.add(key);effects++;throw Error('Synthetic committed response lost');}
 return data({issueId:id,policyId:project,authorizationId:'a'});
};
issueApi.submitOverage=async()=>{throw Error('Synthetic overage posting not invoked in within-plan test');};
issueApi.decide=async (id,stage,key,decision,comment)=>{
 decisions.push({id,stage,key,decision,comment});
 return data({issueId,policyId:project,authorizationId:id});
};
window.fetch=async()=>{throw Error('Browser fixture must not touch a real backend');};
const root=createRoot(document.getElementById('root'));
const pause=(ms=40)=>new Promise(resolve=>setTimeout(resolve,ms));
const text=()=>document.getElementById('root').textContent??'';
async function until(fn,msg){for(let i=0;i<160;i++){if(fn())return;await pause();}throw Error(msg);}
const labelled=(n,label)=>(n.getAttribute('aria-labelledby')??'').split(' ')
  .some(id=>document.getElementById(id)?.textContent===label);
async function choose(label,value){
 await until(()=>[...document.querySelectorAll('[role=combobox]')].some(n=>labelled(n,label)),'Missing selector '+label);
 const picker=[...document.querySelectorAll('[role=combobox]')].find(n=>labelled(n,label));
 picker.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
 await until(()=>[...document.querySelectorAll('[role=option]')].some(n=>n.textContent.includes(value)),'Missing option '+value);
 [...document.querySelectorAll('[role=option]')].find(n=>n.textContent.includes(value)).click();
 await pause(70);
}
function button(label){
 return [...document.querySelectorAll('button,[role=button]')].find(n=>
  n.textContent?.trim()===label && !n.getAttribute('aria-disabled')?.includes('true'));
}
async function click(label){await until(()=>button(label)&&!button(label).disabled,'Missing button '+label);button(label).click();await pause(50);}
async function input(label,value){
 const labelEl=[...document.querySelectorAll('label')].find(n=>n.textContent.trim()===label);
 check(labelEl,'Missing field '+label);
 const el=document.getElementById(labelEl.htmlFor);
 check(el,'Missing input for '+label);
 const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));await pause(50);
}
function render(kind,locale,permissions,authHistory=history){
 // A changed authenticated scope/actor must mount a new UI and query cache.
 fixtureHistory=authHistory;
 browserQuery=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={browserQuery}>{
   kind==='plans'?<MaterialPlansPanel permissions={permissions}/>:
     <MaterialPlanIssueControls key={[kind,locale,...permissions].join(':')} issue={issue} permissions={permissions} history={authHistory} onChanged={async()=>{}}/>
 }</QueryClientProvider></MonetaryLocaleContext.Provider>);
}
async function run(){
 render('plans','en',store);
 await until(()=>text().includes('Material plans'),'Plan surface absent');
 await choose('Project','P-001');
 await until(()=>text().includes('WP-1'),'Authorized plan list absent');
 await click('WP-1 · v3');
 await until(()=>text().includes('Approved synthetic quantities'),'Approved plan details absent');
 check(!text().includes('NEVER_DISPLAY_COST_BOQ_PRICE'),'Secret BOQ fields disclosed');
 await click('Edit as new revision');
 await until(()=>text().includes('Work package'),'Authorized revision form not loaded');
 // A failed refresh must mask both fetched rows and a prefilled protected revision form.
 deny=true;
 await browserQuery.invalidateQueries({queryKey:['material-plan-ui']});
 await until(()=>!text().includes('Approved synthetic quantities')&&!text().includes('WP-1')&&
  !text().includes('Work package'),
  'Revoked Project/plan values or prefilled revision form remained visible after a 403 refetch');
 deny=false;
 await browserQuery.invalidateQueries({queryKey:['material-plan-ui']});
 await until(()=>text().includes('WP-1'),'Authorized plan list failed to recover after scope restoration');
 render('plans','th',store);
 await until(()=>text().includes('แผนการใช้วัสดุ'),'Thai plan labels absent');
 render('plans','zh-TW',store);
 await until(()=>text().includes('材料使用計畫'),'Traditional Chinese plan labels absent');
 render('issues','en',store);
 await until(()=>text().includes('Approved plan issue controls'),'Issue plan control absent');
 check(button('Check complete issue')?.disabled,'Unbound issue preview enabled');
 await choose('Approved plan','WP-1');
 await choose('Matching plan allocation','MAT-A');
 await click('Check complete issue');
 await until(()=>text().includes('Within plan'),'Canonical issue preview absent');
 check(previews===1,'Unexpected preview count');
 // Authorization can disappear between a successful preview and posting.
 // Old cached approved quantities and the post button must not survive a 403.
 deny=true;
 await browserQuery.invalidateQueries({queryKey:['material-plan-issues']});
 await until(()=>{
  const candidate=[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='Check complete issue');
  return (!candidate || candidate.disabled || candidate.getAttribute('aria-disabled')==='true') &&
   !text().includes('Within plan')&&!text().includes('Issue stock within plan');
 },
  'Stale plan preview/posting authority survived revoked source access');
 check(effects===0,'Revoked preview caused a stock effect');
 deny=false;
 await browserQuery.invalidateQueries({queryKey:['material-plan-issues']});
 await click('Check complete issue');
 await until(()=>text().includes('Within plan'),'Source recovery did not require fresh preview');
 await click('Issue stock within plan');
 await until(()=>text().includes('A posting/approval outcome could not be confirmed'),'Uncertain posting not surfaced');
 check(effects===1,'Posting fixture missed the committed effect');
 await click('Retry same operation');
 await until(()=>text().includes('Server action recorded'),'Identical retry did not recover');
 check(issueCalls.length===2&&issueCalls[0].key===issueCalls[1].key&&effects===1,'Retry duplicated or changed issue effect');
 render('issues','th',store);
 await until(()=>text().includes('การเบิกตามแผนอนุมัติ'),'Thai issue labels absent');
 render('issues','zh-TW',store);
 await until(()=>text().includes('核准計畫領料控制'),'Chinese issue labels absent');
 render('issues','en',reviewer,{...history,items:[reviewAuth]});
 await until(()=>text().includes('Independent overage review')&&text().includes('#1'),
  'Independent overage authorization and source history absent: '+text().slice(-750));
 await input('Decision comment','Synthetic independent review');
 await click('Approve');
 await until(()=>decisions.length===1,'Reviewer decision absent');
 check(decisions[0].stage==='review','Reviewer called final-stage endpoint');
 const final={...reviewAuth,approval:{...reviewAuth.approval,currentStepNo:2,
  actions:[{id:'f',action:'APPROVE',actionByUserId:active,comment:'First independent approval'}]}};
 render('issues','en',approver,{...history,items:[final]});
 await until(()=>text().includes('Final independent overage decision')&&text().includes('#1'),
  'Final-stage authorization history absent: '+text().slice(-750));
 await input('Decision comment','Synthetic separate final approval');
 await click('Approve');
 await until(()=>decisions.length===2,'Final decision absent');
 check(decisions[1].stage==='decision','Final reviewer called first-stage endpoint');
 document.documentElement.setAttribute('data-result','PASS');
}
run().catch(error=>{
 document.documentElement.setAttribute('data-result','FAIL');
 document.documentElement.setAttribute('data-error',String(error?.message??error).slice(0,500));
});
