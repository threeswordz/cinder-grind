// Real React in disposable Chromium. Synthetic transport only; no live ERP requests.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MovementCorrectionPanel } from '/src/inventory/MovementCorrectionPanel.tsx';
import { MonetaryLocaleContext } from '/src/role-ui/monetary-presentation.tsx';
import { setCsrfToken } from '/src/api/client.ts';

const company='11111111-1111-4111-8111-111111111111';
const store='22222222-2222-4222-8222-222222222222';
const pm='33333333-3333-4333-8333-333333333333';
const source='44444444-4444-4444-8444-444444444444';
const requestId='55555555-5555-4555-8555-555555555555';
const date='2026-11-26T00:00:00.000Z';
const base='/inventory/movement-corrections';
const requestPath=base+'/sources/GOODS_RECEIPT/'+source+'/requests';
let rows=[], actor=store, denied=false, loseResponse=true, requests=[], decisions=[], effects=0, refreshes=0;
const check=(v,msg)=>{if(!v)throw Error(msg);};
const response=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
setCsrfToken('synthetic-only');
window.fetch=async (input,init={})=>{
 const raw=typeof input==='string'?input:input.url;
 const path=new URL(raw,location.origin).pathname.replace(/^\/api\/v1/,'');
 check(path===requestPath||path===base+'/'+requestId+'/approve'||path===base+'/'+requestId+'/reject','Unexpected transport '+path);
 if(denied)return response(403,{code:'SS16_CORRECTION_AUTHORITY_DENIED'});
 if((init.method??'GET')==='GET')return response(200,{data:structuredClone(rows)});
 check(new Headers(init.headers).get('X-CSRF-Token')==='synthetic-only','CSRF missing');
 const body=JSON.parse(init.body);
 if(path===requestPath){
  check(actor===store,'PM unexpectedly requested');requests.push(body);
  if(!rows.length){
   rows=[{id:requestId,sourcePostedAt:date,requestedByUserId:store,requestedAt:date,reason:body.reason,
    approvalInstance:{approvalState:'SUBMITTED'}}];
   effects++;
  }else check(body.requestKey===requests[0].requestKey&&body.reason===requests[0].reason,'Retry changed payload');
  if(loseResponse){loseResponse=false;throw Error('Synthetic committed response lost');}
  return response(201,{data:rows[0]});
 }
 check(actor===pm,'Maker unexpectedly decided');decisions.push({path,body});
 rows[0].approvalInstance.approvalState=path.endsWith('/approve')?'APPROVED':'REJECTED';
 return response(201,{data:rows[0]});
};
const root=createRoot(document.getElementById('root'));
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const text=()=>document.getElementById('root').textContent??'';
const button=label=>[...document.querySelectorAll('button')].find(n=>n.textContent?.trim()===label);
async function until(fn,msg){for(let i=0;i<180;i++){if(fn())return;await pause(40);}throw Error(msg);}
async function click(label){await until(()=>button(label)&&!button(label).disabled,'Missing enabled '+label);button(label).click();await pause(60);}
async function input(label,value){
 const l=[...document.querySelectorAll('label')].find(n=>n.textContent.trim()===label);check(l,'Missing field '+label);
 const el=document.getElementById(l.htmlFor);check(el,'Missing input '+label);
 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);
 el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));await pause(60);
}
let client,renderNo=0;
const maker=['inventory.receipt.view','inventory.receipt.edit'];
const reviewer=['inventory.receipt.view','inventory.receipt.approve','inventory.receipt.reverse'];
function render(user,roles,permissions,locale='en'){
 actor=user;client?.clear();client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
 root.render(<MonetaryLocaleContext.Provider value={locale}><QueryClientProvider client={client}>
  <MovementCorrectionPanel key={++renderNo} kind="GOODS_RECEIPT" sourceId={source} permissions={permissions}
    roleCodes={roles} userId={user} companyId={company} reverseEligible={true} cancelEligible={false}
    onChanged={async()=>{refreshes++;}}/>
 </QueryClientProvider></MonetaryLocaleContext.Provider>);
}
async function run(){
 render(store,['STOREKEEPER'],maker);
 await until(()=>text().includes('No correction requests'),'Maker list unavailable');
 check(button('Request stock reversal')?.disabled,'Blank reason allowed');
 await input('Reason','Synthetic correction reason');await click('Request stock reversal');
 await until(()=>text().includes('Request result uncertain'),'Uncertain result absent');
 check(effects===1,'Expected one committed request');await click('Retry same request');
 await until(()=>text().includes('Pending review'),'Pending request absent');
 check(requests.length===2&&requests[0].requestKey===requests[1].requestKey&&effects===1,'Replay duplicated request');
 check(!button('Approve correction')&&!button('Reject correction'),'Maker sees decision');
 render(store,['STOREKEEPER','PROJECT_MANAGER'],[...maker,...reviewer]);
 await until(()=>text().includes('Pending review'),'Dual role pending absent');
 check(!button('Approve correction')&&!button('Reject correction'),'Dual-role self approval exposed');
 render(pm,['PROJECT_MANAGER'],reviewer);
 await until(()=>button('Approve correction'),'PM decision unavailable');
 check(button('Approve correction').disabled,'Blank decision allowed');
 check(!button('Request stock reversal'),'PM sees maker request');
 denied=true;await client.invalidateQueries({queryKey:['movement-corrections']});
 await until(()=>text().includes('Unable to verify current correction access'),'Revoked read not reported');
 check(!text().includes('Synthetic correction reason')&&!button('Approve correction'),'Revoked read leaves protected data/actions');
 denied=false;await client.invalidateQueries({queryKey:['movement-corrections']});
 await until(()=>button('Approve correction'),'PM recovery absent');
 await input('Decision reason','Independent review');await click('Approve correction');
 await until(()=>text().includes('Approved'),'Decision result absent');
 check(decisions.length===1&&decisions[0].body.comment==='Independent review'&&refreshes>=2,'Decision not bound or refreshed');
 render(pm,['PROJECT_MANAGER'],reviewer,'th');
 await until(()=>text().includes('แก้ไขรายการเคลื่อนไหว')&&text().includes('อนุมัติแล้ว'),'Thai history absent');
 render(pm,['PROJECT_MANAGER'],reviewer,'zh-TW');
 await until(()=>text().includes('庫存異動更正')&&text().includes('已核准'),'Chinese history absent');
 render(pm,['FINANCE_MANAGER'],reviewer);
 await until(()=>!document.querySelector('[data-testid="movement-correction-panel"]'),'Unrelated role sees panel');
 document.documentElement.setAttribute('data-result','PASS');
}
run().catch(error=>{document.documentElement.setAttribute('data-result','FAIL');document.documentElement.setAttribute('data-error',String(error?.message??error).slice(0,500));});
