import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,ROLES} from '../uat/prototype-actors.mjs';
import {materialCapabilityDelta,inspectMaterialConfiguration} from '../uat/prototype-material-configuration.mjs';

const observed=()=>Object.fromEntries(['STORE_SITE','KHAIMOOK','BEN'].map(k=>[k,[...ROLES[k].permissions]]));
test('journey deltas skip existing capabilities; Cost BOQ preparation rights remain conditional',()=>{
  const current=observed(),before=structuredClone(current);
  const base=materialCapabilityDelta(current,false),withSource=materialCapabilityDelta(current,true);
  assert.deepEqual(current,before);
  assert.deepEqual(base.KHAIMOOK.journeyMissing,['inventory.issue.view','inventory.material_plan.overage.review']);
  assert.deepEqual(base.BEN.journeyMissing,['inventory.issue.view','inventory.material_plan.overage.approve','inventory.material_plan.prototype.enable']);
  assert.equal(base.STORE_SITE.journeyMissing.includes('inventory.issue.view'),false);
  assert.ok(Object.values(base).every(x=>x.conditionalSourceMissing.length===0));
  assert.deepEqual(withSource.KHAIMOOK.conditionalSourceMissing,['budget.revision.approve','budget.revision.view']);
  assert.deepEqual(withSource.BEN.conditionalSourceMissing,['budget.boq.manage','budget.boq.view','budget.revision.submit','budget.revision.view']);
  const already=observed();already.STORE_SITE.push('inventory.issue.create');
  assert.equal(materialCapabilityDelta(already,false).STORE_SITE.journeyMissing.includes('inventory.issue.create'),false);
  const all=Object.values(withSource).flatMap(x=>[...x.journeyMissing,...x.conditionalSourceMissing]);
  assert.ok(!all.some(p=>p.startsWith('hr.')||p.startsWith('finance.')||p==='inventory.material_plan.approve'||p==='inventory.issue.approve'));
  assert.throws(()=>materialCapabilityDelta(current,undefined),e=>e.safeCode==='MATERIAL_CONFIG_SOURCE_STATE_REQUIRED');
});

function fixture(){
  const f=Object.fromEntries(['companyId','adminUserId','foreignCompanyId','projectId','unassignedProjectId','foreignProjectId',
    'uomId','materialId','warehouseId'].map(k=>[k,randomUUID()]));
  const actors=Object.fromEntries(Object.keys(ROLES).map((key,i)=>[key,{userId:randomUUID(),employeeId:randomUUID(),roleId:randomUUID(),
    email:'proto-'+key.toLowerCase()+'@example.invalid',password:String(i+1).repeat(64),expectedRoleCodes:['PROTO_'+key]}]));
  const role=(key,a)=>({roleId:a.roleId,role:{companyId:f.companyId,roleCode:'PROTO_'+key,isActive:true,
    rolePermissions:ROLES[key].permissions.map(permissionCode=>({permission:{permissionCode}}))}});
  const state={sourceCount:0,policyCount:0,planCount:0,types:0,sequence:null,missingCatalog:false,readOnly:true,
    companies:[{id:f.companyId,companyCode:'PROTO_A',isActive:true,baseCurrencyCode:'THB'},
      {id:f.foreignCompanyId,companyCode:'PROTO_B',isActive:true,baseCurrencyCode:'THB'}],
    users:Object.entries(actors).map(([key,a])=>({id:a.userId,companyId:f.companyId,employeeId:a.employeeId,
      email:a.email,isActive:true,userRoles:[role(key,a)]})),workflows:[]};
  state.users.push({id:f.adminUserId,companyId:f.companyId,email:'proto-admin@example.invalid',employeeId:null,isActive:true,
    userRoles:[{role:{companyId:f.companyId,roleCode:'SYS_ADMIN',isActive:true,rolePermissions:[]}}]});
  state.employees=Object.values(actors).map(a=>({id:a.employeeId,companyId:f.companyId,isActive:true}));
  state.members=Object.values(actors).map(a=>({employeeId:a.employeeId,projectId:f.projectId,isActive:true}));
  const calls=[];
  const record=(name,value)=>async(...args)=>{calls.push({name,args});return typeof value==='function'?value(...args):value;};
  const tx={
    $executeRawUnsafe:record('readOnlyMode',()=>0),$queryRawUnsafe:record('readOnlyProof',()=>[{mode:state.readOnly?'on':'off'}]),
    company:{findMany:record('companies',()=>state.companies)},
    project:{findMany:record('projects',()=>[
      {id:f.projectId,companyId:f.companyId,projectCode:'SITE_A',isActive:true},
      {id:f.unassignedProjectId,companyId:f.companyId,projectCode:'SITE_B',isActive:true},
      {id:f.foreignProjectId,companyId:f.foreignCompanyId,projectCode:'SITE_FOREIGN',isActive:true}])},
    user:{findMany:record('users',()=>state.users)},
    employee:{count:record('employeeCount',8),findMany:record('employees',()=>state.employees)},
    projectMember:{findMany:record('members',()=>state.members)},
    role:{count:record('roleCount',9),findMany:record('materialRoles',()=>state.users.slice(0,8).filter(u=>
      ['PROTO_BEN','PROTO_KHAIMOOK','PROTO_STORE_SITE'].includes(u.userRoles[0].role.roleCode)).map(u=>u.userRoles[0].role))},
    hrCompanyAccess:{findMany:record('hrGrants',({where})=>{
      const key=Object.keys(actors).find(k=>actors[k].userId===where.userId);
      return ROLES[key].categories.map(category=>({companyId:f.companyId,category}));}),count:record('adminHr',0)},
    warehouse:{findFirst:record('warehouse',{id:f.warehouseId})},material:{findFirst:record('material',{id:f.materialId})},
    unitOfMeasure:{findFirst:record('uom',{id:f.uomId})},
    materialPlanProjectPolicy:{count:record('policy',()=>state.policyCount)},materialUsagePlan:{count:record('plan',()=>state.planCount)},
    budgetRevision:{count:record('sources',()=>state.sourceCount)},
    permission:{findMany:record('catalog',({where})=>where.permissionCode.in.slice(state.missingCatalog?1:0).map(permissionCode=>({permissionCode})))},
    approvalWorkflow:{findMany:record('workflows',()=>state.workflows)},documentType:{count:record('documentTypes',()=>state.types)},
    numberSequence:{findUnique:record('sequence',()=>state.sequence)},
  };
  const db={$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx);}};
  return {binding:{sourceSha:SOURCE,actors,fixture:f},db,tx,state,calls};
}

test('snapshot establishes READ ONLY before identity reads, exposes gaps without private identifiers or mutation authority',async()=>{
  const t=fixture(),result=await inspectMaterialConfiguration(t.db,t.binding);
  assert.deepEqual(t.calls.slice(0,3).map(x=>x.name),['readOnlyMode','readOnlyProof','companies']);
  assert.equal(t.calls[0].args[0],'SET TRANSACTION READ ONLY');
  assert.equal(result.status,'MATERIAL_CONFIGURATION_INSPECTED');
  assert.equal(result.sourceMapping,'SOURCE_PREPARATION_REQUIRED');
  assert.equal(result.materialIssueSequence,'CREATE_REQUIRED');
  assert.equal(result.configurationApplied,false);assert.equal(result.sourceMappingVerified,false);
  assert.equal(result.targetCustodyVerified,false);assert.equal(result.productionAuthorized,false);
  for(const value of [...Object.values(t.binding.fixture),...Object.values(t.binding.actors).map(a=>a.password)])
    assert.equal(JSON.stringify(result).includes(value),false);
  for(const name of ['warehouse','material','uom','policy','plan','sources','workflows','documentTypes']){
    const call=t.calls.find(c=>c.name===name);assert.equal(call.args[0].where.companyId,t.binding.fixture.companyId);
  }
});

test('existing approved source/type/sequence are reported for explicit selection, never guessed from matching UOM or counts',async()=>{
  const t=fixture();t.state.sourceCount=2;t.state.types=1;
  t.state.sequence={entityType:'MATERIAL_ISSUE',formatTemplate:'MIYYMM-###',resetRule:'MONTHLY'};
  const result=await inspectMaterialConfiguration(t.db,t.binding);
  assert.equal(result.sourceMapping,'EXPLICIT_MAPPING_AND_APPROVAL_PROVENANCE_REQUIRED');
  assert.equal(result.sourceMappingVerified,false);assert.equal(result.documentTypeSelectionRequired,true);
  assert.equal(result.materialIssueSequence,'REUSE_EXISTING');
  assert.ok(Object.values(result.roleDeltas).every(x=>x.conditionalSourceMissing.length===0));
});

test('overage matching requires the exact two independent roles, order, cardinality and single-approval steps',async()=>{
  const t=fixture(),k=t.binding.actors.KHAIMOOK.roleId,b=t.binding.actors.BEN.roleId;
  const step=(stepNo,roleId)=>({stepNo,requiredApprovals:1,stepRoles:[{roleId}]});
  const good={entityType:'MATERIAL_PLAN_OVERAGE',steps:[step(1,k),step(2,b)]};
  t.state.workflows=[good,{...good,steps:[step(1,b),step(2,k)]},
    {...good,steps:[step(1,k),{...step(2,b),requiredApprovals:2}]},
    {...good,steps:[{...step(1,k),stepRoles:[{roleId:k},{roleId:b}]},step(2,b)]},
    {entityType:'BUDGET_REVISION',steps:[step(1,k)]}];
  const result=await inspectMaterialConfiguration(t.db,t.binding);
  assert.equal(result.matchingOverageWorkflows,1);assert.equal(result.matchingSourceWorkflows,1);
});

test('bad source bindings fail before DB access; drift/partial follow-up/catalog/sequence/read-only failures do not return a plan',async()=>{
  const invalid=fixture();invalid.binding.sourceSha='a'.repeat(40);
  await assert.rejects(inspectMaterialConfiguration(invalid.db,invalid.binding),e=>e.safeCode==='MATERIAL_CONFIG_BINDING_INVALID');
  assert.equal(invalid.calls.length,0);
  for(const mutate of [t=>t.state.readOnly=false,t=>t.state.companies[0].companyCode='TCJ',
    t=>t.state.users[0].userRoles[0].role.rolePermissions.push({permission:{permissionCode:'finance.payment.approve'}}),
    t=>t.state.employees[0].isActive=false,t=>t.state.employees[0].companyId=randomUUID(),
    t=>t.state.members[0].projectId=t.binding.fixture.unassignedProjectId,
    t=>t.state.members.push({...t.state.members[0]}),
    t=>t.state.policyCount=1,t=>t.state.planCount=1,t=>t.state.missingCatalog=true,
    t=>t.state.sequence={entityType:'MATERIAL_ISSUE',formatTemplate:'RETAINED',resetRule:'MONTHLY'}]){
    const t=fixture();mutate(t);await assert.rejects(inspectMaterialConfiguration(t.db,t.binding));
    assert.ok(t.calls.every(c=>!['create','update','delete','upsert'].includes(c.name)));
  }
});
