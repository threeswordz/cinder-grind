// Explicitly authorized isolated configuration transaction. No runnable CLI.
import {randomUUID} from 'node:crypto';
import {planResidualRoles,residualRolePlanDigest,verifyResidualRoleAuthority,verifyResidualRoleDelta,event284Specs} from './m6-residual-role-plan.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_WRITER_'+c),{safeCode:'M6_RESIDUAL_WRITER_'+c});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),sort=x=>[...x].sort();
const tables={role:'roles',userRole:'user_roles',rolePermission:'role_permissions',auditLog:'audit_logs'};
const include={company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}};
export async function observeResidualRolePlan(tx,{fixture,original,roster,inventoryBinding}){
 need(inventoryBinding?.companyId===fixture.companyId&&inventoryBinding?.projectId===fixture.projectId&&typeof inventoryBinding.orderId==='string','PUR07_SCOPE');
 const events=await tx.poDispatchEvent.findMany({where:{companyId:fixture.companyId,projectId:fixture.projectId,purchaseOrderId:inventoryBinding.orderId},take:3});const sends=events.filter(e=>e.kind==='DISPATCH'),acks=events.filter(e=>e.kind==='ACKNOWLEDGMENT');need(events.length===sends.length+acks.length&&sends.length<=1&&acks.length<=1&&(!sends.length||sends[0].acknowledgesEventId===null)&&(!acks.length||acks[0].acknowledgesEventId===sends[0]?.id),'PUR07_CHAIN');const needsPoEdit=acks.length===0;
 const users=await tx.user.findMany({take:13,include}),roles=await tx.role.findMany({where:{companyId:fixture.companyId}}),permissions=await tx.permission.findMany({where:{permissionCode:{in:[...new Set(event284Specs(needsPoEdit).flatMap(x=>x[2]))]}}}),project=await tx.project.findUnique({where:{id:fixture.projectId},include:{members:true}});
 return planResidualRoles({fixture,original,roster,users,roles,permissions,project,needsPoEdit});
}
export async function writeResidualRoles({db,context,plan,baseline,operatorSha,authorization,capture,verifyCustody,sealAttempt,sealCommitted}){
 verifyResidualRoleAuthority(plan,authorization,baseline,operatorSha);
 need([capture,verifyCustody,sealAttempt,sealCommitted].every(f=>typeof f==='function'),'ADAPTER');
 await verifyCustody();
 await sealAttempt({operatorSha,planSha256:residualRolePlanDigest(plan),baselineSha256:residualRolePlanDigest(baseline)});
 const committed=await db.$transaction(async tx=>{
  const rows=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(rows.length===1&&rows[0].db==='m6_successor_rehearsal'&&rows[0].role==='proto_runtime'&&rows[0].ro==='off'&&rows[0].isolation==='serializable','DATABASE');
  await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('m6-residual-role-configuration'))::text AS lock");
  const active=await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP');
  need(active.length===1&&active[0].n==='0','ACTIVE_SESSIONS');
  const before=await capture(tx);need(same(before,baseline)&&before.user_sessions?.length===129,'BASELINE');
  need(same(await observeResidualRolePlan(tx,context),plan),'PLAN_DRIFT');
  const added={},ids={};
  async function add(model,data){const table=tables[model],id=randomUUID();need(table,'MODEL');const row=await tx[model].create({data:{...data,id}});need(row.id===id,'CREATE_ID');const h=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+table+'" t WHERE id=$1::uuid',id);need(h.length===1&&/^[a-f0-9]{64}$/.test(h[0].hash),'ROW_HASH');(added[table]??=[]).push(h[0].hash);(ids[table]??=[]).push(id);return id;}
  for(const c of plan.changes){let roleId=c.existingRoleId;if(c.createRole){roleId=await add('role',{companyId:plan.companyId,roleCode:c.createRole,roleName:'Synthetic M6 '+c.createRole});await add('userRole',{companyId:plan.companyId,userId:c.userId,roleId});}for(const p of c.permissions)await add('rolePermission',{roleId,permissionId:p.id});}
  await add('auditLog',{companyId:plan.companyId,entityType:'M6_RESIDUAL_SYNTHETIC_ROLES',entityId:plan.projectId,actorUserId:plan.adminUserId,action:'CONFIGURE',newValues:{syntheticOnly:true,planSha256:residualRolePlanDigest(plan),operatorSha,actors:plan.changes.map(c=>c.actor),productionAuthorized:false}});
  const users=await tx.user.findMany({take:13,include});need(users.length===12,'USER_CENSUS');
  for(const c of plan.changes){const u=users.find(x=>x.id===c.userId);need(u&&u.companyId===plan.companyId&&u.isActive===true&&u.userRoles.every(e=>e.companyId===plan.companyId&&e.role.companyId===plan.companyId&&e.role.isActive===true),'POST_SCOPE');const actualRoles=sort(u.userRoles.map(e=>e.role.roleCode)),actualPermissions=sort(new Set(u.userRoles.flatMap(e=>e.role.rolePermissions.map(p=>p.permission.permissionCode))));need(same(actualRoles,sort([...c.beforeRoles,...(c.createRole?[c.createRole]:[])]))&&same(actualPermissions,sort(new Set([...c.beforePermissions,...c.permissions.map(p=>p.code)]))),'POST_ROSTER');}
  const after=await capture(tx);verifyResidualRoleDelta(before,after,added,plan.expected.role_permissions);
  return {before,after,added,ids,planSha256:residualRolePlanDigest(plan),operatorSha};
 },{isolationLevel:'Serializable',timeout:120000});
 await verifyCustody();await sealCommitted(committed);
 return {status:'M6_RESIDUAL_SYNTHETIC_ROLES_COMMITTED',rolesCreated:2,assignmentsCreated:2,permissionEdgesCreated:plan.expected.role_permissions,auditRowsAdded:1,historicalSessionRowsPreserved:129,sessionsCreated:0,productionAuthorized:false,milestone6Accepted:false,automaticRetryAllowed:false};
}
