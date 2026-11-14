import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES} from '../uat/prototype-actors.mjs';
import {inspectMaterialPreconditions} from '../uat/prototype-material-preconditions.mjs';

function fixture(){
  const f=Object.fromEntries(['companyId','projectId','warehouseId','materialId','uomId'].map(k=>[k,randomUUID()]));
  const actors=Object.fromEntries(Object.keys(ROLES).map((key,i)=>[key,{userId:randomUUID(),employeeId:randomUUID(),roleId:randomUUID(),
    password:String(i).repeat(64),email:'proto-'+key.toLowerCase()+'@example.invalid',expectedRoleCodes:['PROTO_'+key]}]));
  const id=randomUUID(),postKey=randomUUID();
  const state={readOnly:true,sources:0,reservations:0,issues:0,returns:0,transfers:0,counts:1,
    count:{...f,id,status:'APPROVED',postKey,actualQuantity:'20',varianceQuantity:'20.0000',expectedOnHand:'0',
      expectedReserved:'0',expectedLedgerEventCount:0,createdByUserId:actors.STORE_SITE.userId,
      submittedByUserId:actors.STORE_SITE.userId,decidedByUserId:actors.KHAIMOOK.userId},
    ledger:[{...f,stockCountId:id,movementType:'STOCK_COUNT_ADJUSTMENT',quantity:'20',effectKey:'stock-count:'+id+':'+postKey,
      postedByUserId:actors.KHAIMOOK.userId,...Object.fromEntries(['goodsReceiptId','goodsReceiptItemId','materialIssueId',
        'materialIssueItemId','materialReturnId','materialReturnItemId','stockTransferId','stockTransferItemId',
        'reversalOfId','wbsId','costCodeId','activityId'].map(k=>[k,null]))}]};
  const mapping={budgetRevisionId:randomUUID(),budgetRevisionLineId:randomUUID(),materialId:f.materialId,uomId:f.uomId,quantity:'10.0000'};
  state.source={id:mapping.budgetRevisionId,createdByUserId:actors.BEN.userId,submittedByUserId:actors.BEN.userId,
    submittedAt:new Date(),approvalInstance:{companyId:f.companyId,entityType:'BUDGET_REVISION',entityId:mapping.budgetRevisionId,
      approvalState:'APPROVED',completedAt:new Date(),actions:[{action:'APPROVE',actionByUserId:actors.KHAIMOOK.userId,
        approvalStep:{stepNo:1}}]}};
  state.line={id:mapping.budgetRevisionLineId,uomId:f.uomId,quantity:'10',wbsId:null,costCodeId:null};
  const calls=[],read=(key,value)=>async args=>{calls.push({key,args});return typeof value==='function'?value():value;};
  const tx={$executeRawUnsafe:read('setReadOnly',0),$queryRawUnsafe:read('readOnly',()=>[{mode:state.readOnly?'on':'off'}]),
    stockCount:{findUnique:read('originalCount',()=>state.count),count:read('countCount',()=>state.counts)},
    stockTransaction:{findMany:read('ledger',()=>state.ledger)},
    materialReservation:{count:read('reservations',()=>state.reservations)},materialIssue:{count:read('issues',()=>state.issues)},
    materialReturn:{count:read('returns',()=>state.returns)},stockTransfer:{count:read('transfers',()=>state.transfers)},
    budgetRevision:{count:read('sources',()=>state.sources),findFirst:read('selectedSource',()=>state.source)},
    budgetRevisionLine:{findFirst:read('selectedLine',()=>state.line)}};
  const db={$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx);}};
  return {state,calls,mapping,binding:{sourceSha:SOURCE,actors,fixture:f,initial:{stockCountId:id}},db};
}
test('stock preflight preserves original 20 and never selects an approved source by count, UOM or price',async()=>{
  const t=fixture(),before=structuredClone(t.state);
  let r=await inspectMaterialPreconditions(t.db,t.binding);
  assert.equal(r.stockPreconditionVerified,true);assert.equal(r.sourceMapping,'SOURCE_PREPARATION_REQUIRED');
  assert.equal(r.onHand,'20.0000');assert.equal(r.sourceMappingVerified,false);
  assert.equal(r.writeJourneyAuthorized,false);assert.equal(r.configurationApplied,false);
  assert.deepEqual(t.state,before);
  assert.deepEqual(t.calls.slice(0,3).map(c=>c.key),['setReadOnly','readOnly','originalCount']);
  assert.equal(t.calls[0].args,'SET TRANSACTION READ ONLY');
  t.state.sources=2;r=await inspectMaterialPreconditions(t.db,t.binding);
  assert.equal(r.sourceMapping,'EXPLICIT_MAPPING_REQUIRED');assert.equal(r.sourceMappingVerified,false);
  assert.equal(t.calls.some(c=>c.key==='selectedSource'),false);
  for(const secret of [...Object.values(t.binding.fixture),...Object.values(t.binding.actors).map(a=>a.password)])
    assert.equal(JSON.stringify(r).includes(secret),false);
});
test('explicit same-UOM 10-unit source checks scoped revision/line and independent approval provenance',async()=>{
  const t=fixture();t.binding.sourceMapping=t.mapping;
  const r=await inspectMaterialPreconditions(t.db,t.binding);
  assert.equal(r.sourceMappingVerified,true);assert.equal(r.sourceMapping,'EXPLICIT_SOURCE_PROVENANCE_VERIFIED');
  assert.deepEqual(t.calls.find(c=>c.key==='selectedSource').args.where,{id:t.mapping.budgetRevisionId,
    companyId:t.binding.fixture.companyId,projectId:t.binding.fixture.projectId});
  assert.deepEqual(t.calls.find(c=>c.key==='selectedLine').args.where,{id:t.mapping.budgetRevisionLineId,
    budgetRevisionId:t.mapping.budgetRevisionId});
  assert.equal(JSON.stringify(r).includes(t.mapping.budgetRevisionId),false);
});
test('wrong source, material mapping, approval, dimensions and precision stop without writes',async()=>{
  for(const mutate of [t=>t.binding.sourceMapping.materialId=randomUUID(),t=>t.binding.sourceMapping.uomId=randomUUID(),
    t=>t.binding.sourceMapping.quantity='9.0000',t=>t.binding.sourceMapping.price='10',
    t=>t.state.source=null,t=>t.state.source.createdByUserId=t.binding.actors.STORE_SITE.userId,
    t=>t.state.source.submittedByUserId=t.binding.actors.KHAIMOOK.userId,
    t=>t.state.source.approvalInstance.companyId=randomUUID(),t=>t.state.source.approvalInstance.entityType='PAYMENT',
    t=>t.state.source.approvalInstance.entityId=randomUUID(),t=>t.state.source.approvalInstance.approvalState='PENDING',
    t=>t.state.source.approvalInstance.actions[0].actionByUserId=t.binding.actors.BEN.userId,
    t=>t.state.source.approvalInstance.actions[0].action='REJECT',
    t=>t.state.source.approvalInstance.actions.push({...t.state.source.approvalInstance.actions[0]}),
    t=>t.state.source.approvalInstance.actions[0].approvalStep.stepNo=2,
    t=>t.state.source.approvalInstance.completedAt=null,t=>t.state.line=null,
    t=>t.state.line.uomId=randomUUID(),t=>t.state.line.quantity='10.00001',t=>t.state.line.quantity='99999',
    t=>t.state.line.wbsId=randomUUID(),t=>t.state.line.costCodeId=randomUUID()]){
    const t=fixture();t.binding.sourceMapping=t.mapping;mutate(t);
    await assert.rejects(inspectMaterialPreconditions(t.db,t.binding));
  }
});
test('unchanged net stock cannot conceal compensating postings, new drafts, reservation or count drift',async()=>{
  for(const mutate of [t=>t.state.readOnly=false,t=>t.state.count=null,t=>t.state.count.companyId=randomUUID(),
    t=>t.state.count.status='SUBMITTED',t=>t.state.count.decidedByUserId=t.binding.actors.STORE_SITE.userId,
    t=>t.state.count.actualQuantity='20.00001',t=>t.state.count.actualQuantity='2e1',
    t=>t.state.count.varianceQuantity='-20',t=>t.state.count.expectedReserved='1',
    t=>t.state.count.expectedLedgerEventCount=1,t=>t.state.ledger[0].uomId=randomUUID(),
    t=>t.state.ledger[0].quantity='19.9999',t=>t.state.ledger[0].reversalOfId=randomUUID(),
    t=>t.state.ledger[0].effectKey='other',t=>t.state.ledger[0].materialIssueId=randomUUID(),
    t=>t.state.ledger.push({...t.state.ledger[0],quantity:'-1'},{...t.state.ledger[0],quantity:'1'}),
    ...['reservations','issues','returns','transfers'].map(k=>t=>t.state[k]=1),t=>t.state.counts=2]){
    const t=fixture();mutate(t);await assert.rejects(inspectMaterialPreconditions(t.db,t.binding));
  }
});
test('invalid or caller-mutated bindings cannot retarget an in-flight read',async()=>{
  const invalid=fixture();invalid.binding.sourceSha='a'.repeat(40);
  await assert.rejects(inspectMaterialPreconditions(invalid.db,invalid.binding));assert.equal(invalid.calls.length,0);
  const t=fixture(),pending=inspectMaterialPreconditions(t.db,t.binding);
  t.binding.fixture.companyId=randomUUID();t.binding.initial.stockCountId=randomUUID();
  assert.equal((await pending).stockPreconditionVerified,true);
});
