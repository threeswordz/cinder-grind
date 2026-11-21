import test from 'node:test';
import assert from 'node:assert/strict';
import {customerBufferedQuantity,assertQuantityOnly,executeM6BoqJourney} from './prototype-m6-boq-journey.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const fixture={companyId:id(1),projectId:id(2)},costId=id(5),clientId=id(6),approvalId=id(7),lineId=id(8),uomId=id(9);
const requestKeys={create:id(11),submit:id(12),decide:id(13)};
const base={actors:{BEN:{},NANCY:{},STORE_SITE:{}},fixture,requestKeys};
const cost={id:costId,quantity:'10.0000',uomId,description:'Synthetic Cost material',rate:'12.0000',amount:'120.00'};
function clientMock(failAt){
 const calls=[],sessions=[];
 const client={
  login:async(label)=>{sessions.push('login:'+label);return {label};},
  logout:async(label)=>sessions.push('logout:'+label),
  call:async(session,label,path,status,body)=>{
   calls.push({actor:session.label,label,path,status,body});
   if(failAt===label)throw Error('FOCUSED_BOQ_HTTP_FAILURE');
   let data;
   if(label==='M6_EXISTING_COST_QUANTITIES')data={id:id(99),items:[{quantity:'10.0000',uomCode:'EA'}]};
   if(label==='M6_BEN_COST_REVISION_CREATE')data={id:costId,lifecycleState:'DRAFT'};
   if(label==='M6_BEN_COST_REVISION_SUBMIT')data={id:costId,lifecycleState:'SUBMITTED'};
   if(label==='M6_BEN_COST_SELF_APPROVE')data={id:costId,lifecycleState:'APPROVED'};
   if(label==='M6_STORE_APPROVED_COST_QUANTITY')data={id:costId,lines:[{quantity:'10.0000',itemCode:'TEST'}]};
   if(label==='M6_CLIENT_SOURCE_OPTIONS')data={sources:[{id:costId,lines:[cost]}],
    uoms:[{id:uomId,decimalPlaces:4}],workflows:[{workflowCode:'PROTO_M6_CLIENT_NANCY'}]};
   if(label==='M6_CLIENT_BUFFERED_CREATE'){
    assert.equal(body.draft.sourceRevisionId,costId);
    assert.equal(body.draft.lines[0].bufferQuantity,'1.0000');
    assert.equal(body.draft.lines[0].quantity,'11.0000');
    data={id:clientId,editNo:1,approvalState:'DRAFT'};
   }
   if(label==='M6_CLIENT_DRAFT_HISTORY')data={version:{id:clientId,currentEditNo:1,
    edits:[{editNo:1,lines:[{quantity:'11.0000',pricingSnapshot:{rawQuantity:'10.0000',bufferQuantity:'1.0000'}}]}]}};
   if(label==='M6_CLIENT_SUBMIT')data={id:clientId,approvalState:'SUBMITTED'};
   if(label==='M6_NANCY_APPROVAL_READ')data={allowedActions:{decide:true},
    version:{id:clientId,approvalInstanceId:approvalId}};
   if(label==='M6_NANCY_CLIENT_APPROVE')data={id:clientId,approvalState:'APPROVED'};
   return {value:{data}};
  },
 };
 return {client,calls,sessions};
}
test('exact 4dp buffer arithmetic and no rate/amount in quantity-only projection',()=>{
 assert.equal(customerBufferedQuantity('10.0000','1.0000'),'11.0000');
 assert.equal(customerBufferedQuantity('2','0.25'),'2.2500');
 assert.equal(assertQuantityOnly({items:[{quantity:'10.0000',unit:'EA'}]}),true);
 for(const x of [{rate:'100'},{items:[{amount:'120.00'}]},{foo:{totalAmount:19}}])
  assert.throws(()=>assertQuantityOnly(x),/M6_QUANTITY_MONETARY_FIELD_EXPOSED/);
});
test('Ben Cost self-approval, raw+buffer Client BOQ, Nancy approval and correct session revocation',async()=>{
 const x=clientMock();const result=await executeM6BoqJourney({...base,client:x.client});
 assert.equal(result.status,'M6_DEC054_COST_AND_BUFFERED_CLIENT_BOQ_HTTP_VERIFIED');
 assert.equal(result.sessionsRevoked,true);assert.equal(result.actualMacDeploymentVerified,false);
 assert.deepEqual(x.calls.filter(y=>y.status===403).map(y=>y.label),[
  'M6_STORE_FULL_COST_DENIED','M6_BEN_CLIENT_SELF_APPROVAL_DENIED']);
 assert.deepEqual(x.sessions.slice(-3),['logout:M6_BOQ_STORE_SITE','logout:M6_BOQ_NANCY','logout:M6_BOQ_BEN']);
 assert.equal(x.calls.filter(y=>y.status===401).length,3);
 assert.ok(!x.calls.some(y=>y.label.includes('UOM_')||y.label.includes('RECEIVING_')));
});
test('denied/rejected Client approval does not retry and revokes sessions',async()=>{
 const x=clientMock('M6_NANCY_CLIENT_APPROVE');
 await assert.rejects(executeM6BoqJourney({...base,client:x.client}),/FOCUSED_BOQ_HTTP_FAILURE/);
 assert.equal(x.calls.filter(y=>y.label==='M6_NANCY_CLIENT_APPROVE').length,1);
 assert.deepEqual(x.sessions.slice(-3),['logout:M6_BOQ_STORE_SITE','logout:M6_BOQ_NANCY','logout:M6_BOQ_BEN']);
});
test('bad action keys do not log in or create a draft',async()=>{
 const x=clientMock();await assert.rejects(executeM6BoqJourney({...base,client:x.client,
  requestKeys:{...requestKeys,submit:requestKeys.create}}),/M6_BOQ_REPLAY_KEYS_INVALID/);
 assert.deepEqual(x.calls,[]);assert.deepEqual(x.sessions,[]);
});
