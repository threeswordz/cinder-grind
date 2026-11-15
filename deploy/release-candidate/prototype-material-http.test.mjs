import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {SOURCE,API,WEB,safeEnvironment} from '../uat/prototype-actors.mjs';
import {materialJourneyHttp} from '../uat/prototype-material-http.mjs';

const binding=()=>Object.fromEntries([['sourceSha',SOURCE],['api',API],['web',WEB],['overageWorkflowCode','PROTO_MATERIAL_OVERAGE'],
  ...['companyId','projectId','warehouseId','materialId','uomId','budgetRevisionId','budgetRevisionLineId',
    'storeEmployeeId','foremanEmployeeId','documentTypeId'].map(k=>[k,randomUUID()])]);
const denied=e=>e.safeCode==='MATERIAL_HTTP_BOUNDARY_REFUSED'&&!e.message.includes('PRIVATE');
const actor={cookie:'erp_session=PRIVATE',csrf:'PRIVATE'};
const json=data=>new Response(JSON.stringify({data}),{status:201,headers:{'Content-Type':'application/json'}});
const input=(b,kind)=>({projectId:b.projectId,warehouseId:b.warehouseId,
  ...(kind==='plans'?{budgetRevisionId:b.budgetRevisionId}:{}),
  ...(kind==='issues'?{issuedToEmployeeId:b.foremanEmployeeId}:{}),
  ...(kind==='requests'?{requesterEmployeeId:b.foremanEmployeeId}:{}),
  lines:[{materialId:b.materialId,uomId:b.uomId,quantity:'3.0000',
    ...(kind==='plans'?{budgetRevisionLineId:b.budgetRevisionLineId}:{})}]});
const routes={plans:'/inventory/material-plans',issues:'/inventory/material-issues',requests:'/inventory/material-requests'};

test('target must be the exact source-bound Mac pair; caller changes cannot retarget it',async()=>{
  const b=binding();let sent;
  const c=materialJourneyHttp(b,async(url)=>{sent=url;return new Response('{}');});
  b.api='https://PRIVATE.example';b.projectId=randomUUID();
  await c.call(actor,'ME','/auth/me',200);assert.equal(sent,API+'/auth/me');
  for(const delta of [{api:'http://localhost:33071/api/v1'},{api:API+'/../v1'},{web:'http://remote'},
    {sourceSha:'a'.repeat(40)},{projectId:'TCJ'},{companyId:b.warehouseId}]){
    const good=binding();if(delta.companyId)delta.companyId=good.warehouseId;
    assert.throws(()=>materialJourneyHttp({...good,...delta}),denied);
  }
});

test('undeclared writes, old IDs, financial/HR/admin routes and path tricks are refused before transport',async()=>{
  let calls=0;const c=materialJourneyHttp(binding(),async()=>{calls++;return json({});});
  const id=randomUUID();
  for(const [path,method] of [['https://PRIVATE.example','POST'],['//PRIVATE.example','GET'],
    ['/auth/me?PRIVATE=true','GET'],['/inventory/material-plans/../material-issues','POST'],
    ['/inventory/%2e%2e/finance','POST'],['/auth/me#PRIVATE','GET'],['/auth/me\\PRIVATE','GET'],
    ['/finance/payments','POST'],['/hr/companies/'+id+'/employees','GET'],['/admin/roles','POST'],
    ['/inventory/material-plans/'+id+'/decision','POST'],['/inventory/material-issues/'+id+'/reverse','POST'],
    ['/inventory/material-issues/'+id,'PATCH'],['/inventory/material-requests/'+id+'/receipts','POST'],
    ['/inventory/stock-balances','GET'],['/inventory/stock-counts','POST']]){
    await assert.rejects(c.call(actor,'DENIED',path,200,method==='GET'?undefined:{},method),denied);
  }
  assert.equal(calls,0);
});

test('create calls bind project, warehouse, material, UOM and actual source/recipient before network',async()=>{
  const b=binding();let calls=0;const c=materialJourneyHttp(b,async()=>{calls++;return json({});});
  for(const kind of Object.keys(routes))for(const mutate of [x=>x.projectId=randomUUID(),x=>x.warehouseId=randomUUID(),
    x=>x.lines[0].materialId=randomUUID(),x=>x.lines[0].uomId=randomUUID(),x=>x.lines[0].wbsId=randomUUID(),
    x=>x.lines.push({...x.lines[0]})]){
    const body=input(b,kind);mutate(body);
    await assert.rejects(c.call(actor,'DENIED',routes[kind],201,body),denied);
  }
  const plan=input(b,'plans');plan.lines[0].budgetRevisionLineId=randomUUID();
  await assert.rejects(c.call(actor,'WRONG_SOURCE',routes.plans,201,plan),denied);
  for(const kind of ['issues','requests']){
    const body=input(b,kind);body[kind==='issues'?'issuedToEmployeeId':'requesterEmployeeId']=randomUUID();
    await assert.rejects(c.call(actor,'WRONG_RECIPIENT',routes[kind],201,body),denied);
  }
  assert.equal(calls,0);
});

test('creation outcomes alone cannot authorize a write; successful scoped parent readback is required',async()=>{
  for(const kind of Object.keys(routes)){
    const b=binding(),id=randomUUID(),child=randomUUID();let calls=0;
    const c=materialJourneyHttp(b,async(_url,options)=>{
      calls++;return options.method==='POST'?json({id,version:1}):new Response(JSON.stringify({data:{id,
        companyId:b.companyId,projectId:b.projectId,warehouseId:b.warehouseId,
        ...(kind==='issues'?{items:[{id:child,materialId:b.materialId,uomId:b.uomId}]}:{}),
        ...(kind==='requests'?{lines:[{id:child,materialId:b.materialId,uomId:b.uomId,issueLinks:[]}]}:{}),
        ...(kind==='plans'?{approvedRevision:null}:{})}}));
    });
    await c.call(actor,'CREATE',routes[kind],201,input(b,kind));
    const action={plans:'/submit',issues:'/reverse',requests:'/issue-links'}[kind];
    await assert.rejects(c.call(actor,'EARLY_WRITE',routes[kind]+'/'+id+action,201,{}),denied);
    assert.equal(calls,1);
    await c.call(actor,'READ',routes[kind]+'/'+id,200);
    if(kind!=='requests')await c.call(actor,'SCOPED_WRITE',routes[kind]+'/'+id+action,201,{});
    assert.equal(calls,kind==='requests'?2:3);
  }
});

test('wrong Company readback never promotes a pending object to mutable ownership',async()=>{
  const b=binding(),id=randomUUID();let calls=0;
  const c=materialJourneyHttp(b,async(_url,opts)=>{calls++;return opts.method==='POST'?json({id}):
    new Response(JSON.stringify({data:{id,companyId:randomUUID(),projectId:b.projectId,warehouseId:b.warehouseId}}));});
  await c.call(actor,'CREATE',routes.plans,201,input(b,'plans'));
  await assert.rejects(c.call(actor,'READ',routes.plans+'/'+id,200),denied);
  await assert.rejects(c.call(actor,'MUTATE',routes.plans+'/'+id+'/decision',201,{}),denied);
  assert.equal(calls,2);
});

test('existing CSRF helper passes only bounded synthetic credentials and preserves missing-CSRF probes',async()=>{
  const b=binding();let options;
  const c=materialJourneyHttp(b,async(_url,o)=>{options=o;return new Response('{}',{status:403});});
  await assert.rejects(c.call(undefined,'LOGIN','/auth/login',403,{email:'real@PRIVATE.example',password:'PRIVATE'}),denied);
  const body={workflowCode:b.overageWorkflowCode,confirmation:'ISOLATED_SYNTHETIC'};
  await c.call(actor,'CSRF_DENIAL','/inventory/material-plan-issues/projects/'+b.projectId+'/enable',403,body,'POST',false);
  assert.equal(options.headers['x-csrf-token'],undefined);
  assert.equal(options.redirect,'error');assert.equal(options.headers.Origin,WEB);
  await assert.rejects(c.call(actor,'WRONG_WORKFLOW','/inventory/material-plan-issues/projects/'+b.projectId+'/enable',403,
    {...body,workflowCode:'RETAINED'}),denied);
  await assert.rejects(c.call(actor,'WRONG_CONFIRM','/inventory/material-plan-issues/projects/'+b.projectId+'/enable',403,
    {...body,confirmation:'PRODUCTION'}),denied);
});

test('transport errors never reflect private request, session, response or native details',async()=>{
  const c=materialJourneyHttp(binding(),async()=>{throw Error('PRIVATE credentials and native message');});
  await assert.rejects(c.call(actor,'ME','/auth/me',200),e=>e.safeCode==='MATERIAL_HTTP_TRANSPORT_FAILED'&&
    !JSON.stringify({message:e.message,...e}).includes('PRIVATE'));
});

test('only readback-derived child IDs and a source-linked upload can reach receipt, overage and byte-download paths',async()=>{
  // Fake transport proves this helper boundary only. It does not certify any
  // business workflow, stock effect, native NestJS/PostgreSQL, browser or Mac.
  const b=binding(),plan=randomUUID(),issue=randomUUID(),request=randomUUID(),planLine=randomUUID(),
    issueItem=randomUUID(),requestLine=randomUUID(),link=randomUUID(),authorization=randomUUID(),document=randomUUID();
  const bytes=new TextEncoder().encode('%PDF-1.4\nSYNTHETIC TEST ONLY\n%%EOF');
  let linked=false;const seen=[];
  const c=materialJourneyHttp(b,async(url,options)=>{
    const p=url.slice(API.length);seen.push(p);
    const common={companyId:b.companyId,projectId:b.projectId,warehouseId:b.warehouseId};
    const child=id=>({id,materialId:b.materialId,uomId:b.uomId});
    if(p===routes.plans)return json({id:plan,projectId:b.projectId,version:1});
    if(p===routes.issues)return json({id:issue,...common});
    if(p===routes.requests)return json({id:request,version:1,revisionId:randomUUID()});
    if(p===routes.plans+'/'+plan&&options.method==='GET')return new Response(JSON.stringify({data:{id:plan,...common,
      approvedRevision:{lines:[child(planLine)]}}}));
    if(p===routes.issues+'/'+issue&&options.method==='GET')return new Response(JSON.stringify({data:{id:issue,...common,items:[child(issueItem)]}}));
    if(p===routes.requests+'/'+request&&options.method==='GET')return new Response(JSON.stringify({data:{id:request,...common,
      lines:[{...child(requestLine),issueLinks:linked?[{id:link,materialIssueItemId:issueItem}]:[]}]}}));
    if(p.endsWith('/issue-links')){linked=true;return json({id:request,version:2,revisionId:randomUUID()});}
    if(p.endsWith('/overage'))return json({issueId:issue,authorizationId:authorization});
    if(p.endsWith('/download'))return new Response(bytes);
    if(p==='/documents/projects/'+b.projectId+'/targets/MATERIAL_REQUEST/'+request){
      assert.ok(options.body instanceof FormData);assert.equal(options.headers['Content-Type'],undefined);
      assert.equal(options.body.get('documentTypeId'),b.documentTypeId);
      return json({id:document,documentTypeId:b.documentTypeId});
    }
    return json({});
  });
  for(const [kind,id] of [['plans',plan],['issues',issue],['requests',request]]){
    await c.call(actor,'CREATE_'+kind.toUpperCase(),routes[kind],201,input(b,kind));
    await c.call(actor,'READ_'+kind.toUpperCase(),routes[kind]+'/'+id,200);
  }
  const pin={requestKey:randomUUID(),bindings:[{issueItemId:issueItem,planLineId:planLine,expectedPlanVersion:3}]};
  const root='/inventory/material-plan-issues';
  await assert.rejects(c.call(actor,'BAD_PIN',root+'/issues/'+issue+'/preview',201,
    {...pin,bindings:[{...pin.bindings[0],issueItemId:randomUUID()}]}),denied);
  await c.call(actor,'OVERAGE',root+'/issues/'+issue+'/overage',201,pin);
  await c.call(actor,'REVIEW',root+'/authorizations/'+authorization+'/review',201,{decision:'APPROVE'});
  await c.call(actor,'DECIDE',root+'/authorizations/'+authorization+'/decision',201,{decision:'APPROVE'});
  await c.call(actor,'LINK',routes.requests+'/'+request+'/issue-links',201,
    {requestLineId:requestLine,materialIssueItemId:issueItem});
  await c.call(actor,'REFRESH_LINKS',routes.requests+'/'+request,200);
  await assert.rejects(c.upload(actor,'FOREIGN_UPLOAD',randomUUID(),201,bytes),denied);
  await c.upload(actor,'UPLOAD',request,201,bytes);
  assert.deepEqual(await c.download(actor,'DOWNLOAD',request,document,200),bytes);
  const receipt={issueLinkId:link,documentId:document,recipientEmployeeId:b.foremanEmployeeId,
    issuerEmployeeId:b.storeEmployeeId,supersedesReceiptId:null};
  await assert.rejects(c.call(actor,'FOREIGN_DOCUMENT',routes.requests+'/'+request+'/receipts',201,
    {...receipt,documentId:randomUUID()}),denied);
  await c.call(actor,'RECEIPT',routes.requests+'/'+request+'/receipts',201,receipt);
  await c.call(actor,'REVERSE',routes.issues+'/'+issue+'/reverse',201,{reversalKey:randomUUID()});
  assert.equal(c.observations.length,seen.length);
  assert.ok(c.observations.every(x=>!JSON.stringify(x).includes('PRIVATE')));
});

test('a successful GET with another returned parent identity cannot unlock a pending record',async()=>{
  const b=binding(),id=randomUUID();let sent=0;
  const c=materialJourneyHttp(b,async(_url,options)=>{sent++;return options.method==='POST'?json({id}):
    new Response(JSON.stringify({data:{id:randomUUID(),projectId:b.projectId,companyId:b.companyId,warehouseId:b.warehouseId}}));});
  await c.call(actor,'CREATE',routes.plans,201,input(b,'plans'));
  await assert.rejects(c.call(actor,'WRONG_ID',routes.plans+'/'+id,200),denied);
  await assert.rejects(c.call(actor,'NO_PROMOTION',routes.plans+'/'+id+'/submit',201,{}),denied);
  assert.equal(sent,2);
});

test('native compatibility harness refuses a normal workstation before loading DB code and prints no connection input',()=>{
  const child=spawnSync(process.execPath,[fileURLToPath(new URL('../uat/prototype-material-http-native.mjs',import.meta.url))],
    {env:{...safeEnvironment(),GITHUB_ACTIONS:'false',DATABASE_URL:'postgresql://PRIVATE:SECRET@retained.invalid/production'},
      encoding:'utf8',timeout:5000});
  assert.equal(child.status,1);
  assert.equal(child.stdout,'');assert.equal(child.stderr.trim(),'MATERIAL_HTTP_NATIVE_FAILED: GUARD_OR_CLEANUP_FAILED');
});
