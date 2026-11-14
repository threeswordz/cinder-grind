import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE} from '../uat/prototype-actors.mjs';
import {validMaterialUiBinding,materialUiAllowedRequest,verifyMaterialUiRevision,materialUiRevision,UI_NOTE,UI_REASON} from '../uat/prototype-material-ui.mjs';
import {validMaterialRunReceipt,MATERIAL_MAIN,verifyMaterialUiPreservation} from '../uat/prototype-material-ui-state.mjs';
import {toolingOnly,operator} from '../uat/prototype-material-ui-operator.mjs';

function fixture(){
  const b={sourceSha:SOURCE,api:'http://127.0.0.1:33071/api/v1',web:'http://127.0.0.1:44171',
    ...Object.fromEntries(['companyId','projectId','warehouseId','requestId','documentId'].map(k=>[k,randomUUID()])),
    actors:Object.fromEntries(['STORE_SITE','FOREMAN'].map((key,i)=>[key,{userId:randomUUID(),
      email:'proto-'+key.toLowerCase()+'@example.invalid',password:String(i+1).repeat(64),expectedRoleCodes:['PROTO_'+key],
      permissions:['inventory.material_request.view',...(i===0?['inventory.material_request.edit']:[])]}]))};
  const before={id:b.requestId,companyId:b.companyId,projectId:b.projectId,warehouseId:b.warehouseId,
    requesterEmployeeId:randomUUID(),requestDate:'2026-11-14T00:00:00.000Z',version:3,remarks:'Synthetic material handover',
    lines:[{id:randomUUID(),requestedQuantity:'3.0000',remarks:null,issuedQuantity:'0.0000',acknowledgedQuantity:'0.0000',
      issueLinks:[{id:randomUUID(),receipts:[{id:randomUUID(),documentId:b.documentId}]}]}],
    revisions:[{id:randomUUID(),version:1,action:'CAPTURE',reason:'Original'}]};
  const body={requestKey:randomUUID(),expectedVersion:before.version,requestDate:'2026-11-14',reason:UI_REASON,remarks:UI_NOTE,
    lines:before.lines.map(l=>({id:l.id,requestedQuantity:l.requestedQuantity,remarks:l.remarks}))};
  const after={...structuredClone(before),version:4,remarks:UI_NOTE,
    revisions:[...structuredClone(before.revisions),{id:randomUUID(),version:4,action:'REVISE',reason:UI_REASON,facts:{remarks:UI_NOTE}}]};
  return {b,before,body,after,request:{url:b.api+'/inventory/material-requests/'+b.requestId+'/revisions',method:'POST',postData:JSON.stringify(body)}};
}
test('UI binding refuses another target, actor, source or ordinary user credential',()=>{
  const t=fixture();assert.equal(validMaterialUiBinding(t.b),true);
  for(const change of [b=>b.api='http://localhost:33071/api/v1',b=>b.web='https://example.invalid',b=>b.sourceSha='a'.repeat(40),
    b=>b.actors.STORE_SITE.userId=b.actors.FOREMAN.userId,b=>b.actors.STORE_SITE.password='ordinary',
    b=>b.actors.STORE_SITE.expectedRoleCodes=['SYS_ADMIN']]){
    const b=structuredClone(t.b);change(b);assert.equal(validMaterialUiBinding(b),false);
  }
});
test('only exact retained-request note correction reaches the real API; stock, source, uploads and approvals cannot',()=>{
  const t=fixture(),{b,before,request}=t,store=b.actors.STORE_SITE;
  assert.equal(materialUiAllowedRequest(request,b,store,before),true);
  assert.equal(materialUiAllowedRequest({...request,method:'OPTIONS',postData:undefined},b,store,before),true);
  assert.equal(materialUiAllowedRequest(request,b,b.actors.FOREMAN,before),false);
  assert.equal(materialUiAllowedRequest(request,b,store,null),false);
  for(const mutate of [body=>body.expectedVersion++,body=>body.remarks='OTHER',body=>body.reason='',
    body=>body.requestDate='2026-11-15',body=>body.lines[0].requestedQuantity='4.0000',
    body=>body.lines[0].id=randomUUID(),body=>body.lines[0].remarks='CHANGED',body=>body.extra=true]){
    const body=structuredClone(t.body);mutate(body);
    assert.equal(materialUiAllowedRequest({...request,postData:JSON.stringify(body)},b,store,before),false);
  }
  for(const [url,method] of [[b.api+'/inventory/material-requests','POST'],[b.api+'/inventory/material-issues','POST'],
    [b.api+'/inventory/material-plans','POST'],[b.api+'/documents/type-options','POST'],[b.api+'/finance/payments','GET'],
    [b.api+'/hr/companies','GET'],[b.api+'/inventory/../inventory/material-requests/'+b.requestId,'GET'],
    [b.api+'/inventory/material-requests/'+randomUUID(),'GET'],[request.url+'?override=1','POST'],
    [request.url.replace('127.0.0.1','example.invalid'),'POST'],[request.url,'PATCH'],[request.url,'DELETE']])
    assert.equal(materialUiAllowedRequest({...request,url,method},b,store,before),false,url);
});
test('UI startup/read paths stay bounded to the assigned Project and source',()=>{
  const {b,before}=fixture(),actor=b.actors.STORE_SITE,read=url=>materialUiAllowedRequest({url,method:'GET'},b,actor,before);
  for(const path of ['/auth/me','/auth/csrf','/projects?active=true','/procurement/projects',
    '/inventory/material-requests/projects','/inventory/material-requests?projectId='+b.projectId,
    '/inventory/material-requests/'+b.requestId,'/documents/type-options',
    '/inventory/material-requests/choices?projectId='+b.projectId+'&kind=materials'])assert.equal(read(b.api+path),true,path);
  assert.equal(read(b.api+'/inventory/material-requests?projectId='+randomUUID()),false);
  assert.equal(read(b.web+'/assets/app-123.js'),true);
  assert.equal(read(b.web+'/api/v1/auth/me'),false);
  assert.equal(materialUiAllowedRequest({url:b.api+'/auth/login',method:'POST',postData:JSON.stringify({email:actor.email,password:actor.password})},b,actor),true);
  assert.equal(materialUiAllowedRequest({url:b.api+'/auth/login',method:'POST',postData:JSON.stringify({email:actor.email,password:'WRONG'})},b,actor),false);
});
test('observed UI revision must preserve signed evidence, old revisions and every quantity',()=>{
  const t=fixture();verifyMaterialUiRevision(t.before,t.after,t.b);
  for(const change of [a=>a.id=randomUUID(),a=>a.companyId=randomUUID(),a=>a.warehouseId=randomUUID(),a=>a.version++,
    a=>a.lines[0].requestedQuantity='7.0000',a=>a.lines[0].issueLinks[0].receipts=[],
    a=>a.lines[0].issueLinks[0].receipts[0].documentId=randomUUID(),a=>a.revisions[0].reason='OVERWRITTEN',
    a=>a.revisions[1].reason='UNRELATED',a=>a.revisions[1].action='ACKNOWLEDGE']){
    const a=structuredClone(t.after);change(a);assert.throws(()=>verifyMaterialUiRevision(t.before,a,t.b));
  }
});
test('the exact completed Mac API receipt is required, and it cannot claim subsequent milestones',()=>{
  const r={status:'MATERIAL_AUTHENTICATED_API_JOURNEY_VERIFIED',sourceSha:SOURCE,operatorMainSha:MATERIAL_MAIN,
    stockHistory:['20.0000','17.0000','13.0000','20.0000'],financeUnchanged:true,apiSessionsRevoked:true,compiledArtifactBytesVerified:true,
    actualUiJourneyVerified:false,fullBusinessRoleMatrixVerified:false,populatedRecoveryVerified:false,prototypeFrozen:false,
    humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
  assert.equal(validMaterialRunReceipt(r),true);
  for(const [k,v] of [['operatorMainSha','f'.repeat(40)],['financeUnchanged',false],['apiSessionsRevoked',false],
    ['actualUiJourneyVerified',true],['productionAuthorized',true],['stockHistory',['20.0000']]])
    assert.equal(validMaterialRunReceipt({...r,[k]:v}),false);
});
test('preservation guard rejects unrelated changes, header drift, lost history and unrevoked new sessions',()=>{
  const before={preservedSha256:'a'.repeat(64),request:{id:'request',version:3,remarks:'old',updatedAt:new Date(0)},
    requestRevisions:[{id:'old',facts:{a:1,b:2}}],requestOperations:[{id:'operation'}],activeSessions:[]};
  const after={...structuredClone(before),request:{...before.request,version:4,remarks:UI_NOTE,updatedAt:new Date(1)},
    requestRevisions:[{id:'old',facts:{b:2,a:1}},{id:'new'}],requestOperations:[{id:'operation'},{id:'new-op'}]};
  verifyMaterialUiPreservation(before,after);
  for(const change of [a=>a.preservedSha256='b'.repeat(64),a=>a.request.id='another',a=>a.requestRevisions.shift(),
    a=>a.requestOperations[0].id='another',a=>a.activeSessions=['new-session']]){
    const a=structuredClone(after);change(a);assert.throws(()=>verifyMaterialUiPreservation(before,a));
  }
});
test('new operator accepts only reviewed tool paths and exact Owner governance blobs; no non-Mac/write shortcut',async()=>{
  const file={filename:'deploy/uat/prototype-material-ui.mjs',status:'added'},base={filename:'deploy/uat/prototype-material-operator.mjs',status:'added'};
  assert.equal(toolingOnly({status:'ahead',files:[base,file]}),true);
  assert.equal(toolingOnly({status:'ahead',files:[base,{filename:'AGENTS.md',status:'modified',sha:'3ddba391916ee2a9b04b44c5357240c7cb66f03d'}]}),true);
  for(const f of [{filename:'apps/api/src/main.ts',status:'modified'},{filename:'AGENTS.md',status:'modified',sha:'f'.repeat(40)},
    {...file,status:'removed'},{...file,status:'renamed',previous_filename:'old'}])assert.equal(toolingOnly({status:'ahead',files:[base,f]}),false);
  await assert.rejects(operator('--reset'),e=>e.safeCode==='MATERIAL_UI_EXECUTE_ONLY');
  if(process.platform!=='darwin')await assert.rejects(operator('--execute'),e=>e.safeCode==='NONROOT_MAC_OPERATOR_REQUIRED');
  let calls=0;await assert.rejects(materialUiRevision({send:()=>{calls++;}},{sourceSha:'bad'}),e=>e.safeCode==='MATERIAL_UI_BINDING_INVALID');
  assert.equal(calls,0);
});
