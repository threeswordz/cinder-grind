import test from 'node:test';
import assert from 'node:assert/strict';
import {assertSS16Config,readSS16Config,observeRetainedSS16Config} from './m6-parallel-03-ss16-config.mjs';
const uuid=n=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const b={companyId:uuid(1),storeUserId:uuid(2),pmUserId:uuid(3),projectIds:[uuid(4),uuid(5)],kinds:['GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER'],sourceSha:'a'.repeat(40)};
const grants=actions=>['receipt','issue','return','transfer'].flatMap(k=>actions.map(a=>({permission:{permissionCode:'inventory.'+k+'.'+a}})));
function actor(id,employee,code,rid,actions){
 return {id,companyId:b.companyId,isActive:true,employee:{id:employee,companyId:b.companyId,isActive:true},userRoles:[{companyId:b.companyId,role:{id:rid,companyId:b.companyId,isActive:true,roleCode:code,rolePermissions:grants(actions)}}]};
}
function fixture(){
 const store=actor(b.storeUserId,uuid(6),'STOREKEEPER',uuid(8),['view','edit']),pm=actor(b.pmUserId,uuid(7),'PROJECT_MANAGER',uuid(9),['view','approve','reverse']);
 return {company:{id:b.companyId,isActive:true,companyCode:'PROTO_A'},store,pm,workflow:{companyId:b.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION',entityType:'MOVEMENT_CORRECTION',isActive:true,steps:[{stepNo:1,requiredApprovals:1,stepRoles:[{roleId:uuid(9)}]}]},projects:b.projectIds.map(id=>({id,companyId:b.companyId,isActive:true,members:[{employeeId:store.employee.id,isActive:true},{employeeId:pm.employee.id,isActive:true}]}))};
}
test('all four movement kinds, both projects and exact independent same-role grants',()=>{
 const result=assertSS16Config(b,fixture());
 assert.equal(result.workflowConfigured,true);assert.equal(result.movementKinds,4);assert.equal(result.projects,2);assert.equal(result.mayMutate,false);assert.equal(result.authenticatedJourneyVerified,false);
});
test('missing workflow, wrong entity, step, role or Company fails closed',()=>{
 for(const edit of [x=>x.workflow=null,x=>x.workflow.entityType='STOCK_TRANSFER',x=>x.workflow.steps[0].stepNo=2,x=>x.workflow.steps[0].requiredApprovals=2,x=>x.workflow.steps[0].stepRoles[0].roleId=uuid(8),x=>x.workflow.companyId=uuid(20)]){
  const f=fixture();edit(f);assert.throws(()=>assertSS16Config(b,f),/WORKFLOW/);
 }
});
test('a second role cannot supplement missing PM reverse grant; inactive or foreign roles denied',()=>{
 const f=fixture(),pm=f.pm.userRoles[0].role;pm.rolePermissions=pm.rolePermissions.filter(p=>p.permission.permissionCode!=='inventory.transfer.reverse');
 f.pm.userRoles.push({companyId:b.companyId,role:{...pm,id:uuid(10),roleCode:'SYS_ADMIN',rolePermissions:grants(['reverse'])}});
 assert.throws(()=>assertSS16Config(b,f),/GRANTS_PROJECT_MANAGER/);
 for(const edit of [x=>x.pm.userRoles[0].role.isActive=false,x=>x.pm.userRoles[0].role.companyId=uuid(20)]){
  const g=fixture();edit(g);assert.throws(()=>assertSS16Config(b,g),/ROLE_PROJECT_MANAGER/);
 }
});
test('both distinct employees must remain active and assigned to every affected project',()=>{
 const f=fixture();f.projects[1].members[1].isActive=false;assert.throws(()=>assertSS16Config(b,f),/PROJECT_MEMBERSHIP/);
 const g=fixture();g.store.employee.isActive=false;assert.throws(()=>assertSS16Config(b,g),/ACTOR_ACTIVE/);
 const h=fixture();h.store.employee.id=h.pm.employee.id;assert.throws(()=>assertSS16Config(b,h),/INDEPENDENCE/);
 assert.throws(()=>assertSS16Config({...b,pmUserId:b.storeUserId},fixture()),/ACTORS/);
});
function mock(f,{database='proto_a_01',active=0n}={}){
 const seen=[];
 const tx={$executeRawUnsafe:async q=>{seen.push(q);},$queryRawUnsafe:async q=>{seen.push(q);return q.includes('current_database()')?[{db:database,role:'proto_runtime',ro:'on',isolation:'repeatable read'}]:[{unrevoked:active,active,expired:0n}];},
 company:{findUnique:async q=>{assert.equal(q.where.id,b.companyId);return f.company;}},
 approvalWorkflow:{findUnique:async q=>{assert.deepEqual(q.where.companyId_workflowCode,{companyId:b.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION'});return f.workflow;}},
 user:{findUnique:async q=>q.where.id===b.storeUserId?f.store:f.pm},
 project:{findMany:async q=>{assert.deepEqual(q.where,{id:{in:b.projectIds},companyId:b.companyId});return f.projects;}}};
 return {tx,seen,db:{$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'RepeatableRead');return fn(tx);}}};
}
test('readback scoped to bound Company, users, workflow and projects',async()=>{
 const m=mock(fixture());assert.equal(assertSS16Config(b,await readSS16Config(m.tx,b)).sameRoleGrantsVerified,true);
});
test('retained observer enforces transaction read-only and known runtime before reading config',async()=>{
 const m=mock(fixture());assert.equal((await observeRetainedSS16Config(m.db,b)).status,'M6_SS16_CONFIGURATION_OBSERVED');assert.equal(m.seen[0],'SET TRANSACTION READ ONLY');
 await assert.rejects(observeRetainedSS16Config(mock(fixture(),{database:'production'}).db,b),/DATABASE/);
 await assert.rejects(observeRetainedSS16Config(mock(fixture(),{active:1n}).db,b),/ACTIVE_SESSIONS/);
 const f=fixture();f.company.companyCode='REAL';await assert.rejects(observeRetainedSS16Config(mock(f).db,b),/RETAINED_COMPANY/);
});
