// M6-03 configuration evidence, not a grant installer. The caller binds the exact
// source receipt, Company, named synthetic actors and all affected Projects.
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error('M6_SS16_CONFIG_'+code),{safeCode:'M6_SS16_CONFIG_'+code});};
const prefix={GOODS_RECEIPT:'inventory.receipt',MATERIAL_ISSUE:'inventory.issue',MATERIAL_RETURN:'inventory.return',STOCK_TRANSFER:'inventory.transfer'};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function binding(b){
 need(b&&uuid.test(b.companyId??'')&&uuid.test(b.storeUserId??'')&&uuid.test(b.pmUserId??'')&&b.storeUserId!==b.pmUserId,'ACTORS');
 need(Array.isArray(b.projectIds)&&b.projectIds.length>0&&b.projectIds.length<=200&&new Set(b.projectIds).size===b.projectIds.length&&b.projectIds.every(x=>uuid.test(x)),'PROJECTS');
 need(Array.isArray(b.kinds)&&b.kinds.length>0&&new Set(b.kinds).size===b.kinds.length&&b.kinds.every(k=>Object.hasOwn(prefix,k)),'KINDS');
}
function actorRole(user,id,companyId,code,actions,kinds){
 need(user?.id===id&&user.companyId===companyId&&user.isActive===true&&user.employee?.isActive===true&&user.employee.companyId===companyId,'ACTOR_ACTIVE');
 const roles=user.userRoles?.filter(a=>a.companyId===companyId&&a.role?.companyId===companyId&&a.role.isActive===true&&a.role.roleCode===code);
 need(roles?.length===1,'ROLE_'+code);
 const role=roles[0].role,permissions=new Set(role.rolePermissions?.map(x=>x.permission?.permissionCode));
 need(kinds.every(k=>actions.every(a=>permissions.has(prefix[k]+'.'+a))),'GRANTS_'+code);
 return role.id;
}
export function assertSS16Config(b,{company,workflow,store,pm,projects}){
 binding(b);
 need(company?.id===b.companyId&&company.isActive===true,'COMPANY');
 const storeRole=actorRole(store,b.storeUserId,b.companyId,'STOREKEEPER',['view','edit'],b.kinds);
 const pmRole=actorRole(pm,b.pmUserId,b.companyId,'PROJECT_MANAGER',['view','approve','reverse'],b.kinds);
 need(storeRole!==pmRole&&store.employee.id!==pm.employee.id,'INDEPENDENCE');
 const step=workflow?.steps?.[0];
 need(workflow?.companyId===b.companyId&&workflow.workflowCode==='SS16_MOVEMENT_CORRECTION'&&workflow.entityType==='MOVEMENT_CORRECTION'&&workflow.isActive===true&&workflow.steps.length===1&&step?.stepNo===1&&step.requiredApprovals===1&&step.stepRoles?.length===1&&step.stepRoles[0].roleId===pmRole,'WORKFLOW');
 need(Array.isArray(projects)&&projects.length===b.projectIds.length&&new Set(projects.map(p=>p.id)).size===projects.length&&b.projectIds.every(id=>projects.some(p=>p.id===id&&p.companyId===b.companyId&&p.isActive===true&&[store.employee.id,pm.employee.id].every(e=>p.members?.some(m=>m.employeeId===e&&m.isActive===true)))),'PROJECT_MEMBERSHIP');
 return {status:'M6_SS16_CONFIGURATION_OBSERVED',movementKinds:b.kinds.length,projects:b.projectIds.length,workflowConfigured:true,sameRoleGrantsVerified:true,independentEmployees:true,mayMutate:false,authenticatedJourneyVerified:false,productionAuthorized:false};
}
export async function readSS16Config(tx,b){
 binding(b);
 const select={id:true,companyId:true,isActive:true,employee:{select:{id:true,companyId:true,isActive:true}},userRoles:{select:{companyId:true,role:{select:{id:true,companyId:true,isActive:true,roleCode:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}}}}};
 const [company,workflow,store,pm]=await Promise.all([
  tx.company.findUnique({where:{id:b.companyId},select:{id:true,isActive:true,companyCode:true}}),
  tx.approvalWorkflow.findUnique({where:{companyId_workflowCode:{companyId:b.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION'}},include:{steps:{include:{stepRoles:true}}}}),
  tx.user.findUnique({where:{id:b.storeUserId},select}),
  tx.user.findUnique({where:{id:b.pmUserId},select})
 ]);
 need(store?.employee?.id&&pm?.employee?.id,'ACTOR_EMPLOYEE');
 const projects=await tx.project.findMany({where:{id:{in:b.projectIds},companyId:b.companyId},select:{id:true,companyId:true,isActive:true,members:{where:{employeeId:{in:[store.employee.id,pm.employee.id]}},select:{employeeId:true,isActive:true}}}});
 return {company,workflow,store,pm,projects};
}
export async function observeRetainedSS16Config(db,b){
 binding(b);
 need(/^[0-9a-f]{40}$/.test(b.sourceSha??''),'SOURCE_SHA');
 return db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const rows=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(rows?.length===1&&rows[0].db==='proto_a_01'&&rows[0].role==='proto_runtime'&&rows[0].ro==='on'&&rows[0].isolation==='repeatable read','DATABASE');
  await requireNoLiveSessions(tx);
  const snapshot=await readSS16Config(tx,b);
  need(snapshot.company?.companyCode==='PROTO_A','RETAINED_COMPANY');
  return assertSS16Config(b,snapshot);
 },{isolationLevel:'RepeatableRead',timeout:30000});
}
