// Native Prisma transaction kernel. Caller owns pinned Mac admission, private
// attempt/credential custody and exact Event237 authorization. No sessions.
import {randomUUID,randomBytes} from 'node:crypto';
import {verifySuccessorFixtureAuthorization} from './m6-successor-fixture-plan.mjs';
import {verifySuccessorFixtureDelta} from './m6-successor-fixture-preservation.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(Error('M6_FIXTURE_WRITER_'+code),{safeCode:'M6_FIXTURE_WRITER_'+code});};
const scope='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=a=>[...a].sort();
const tables={employee:'employees',user:'users',role:'roles',userRole:'user_roles',rolePermission:'role_permissions',projectMember:'project_members',approvalWorkflow:'approval_workflows',approvalStep:'approval_steps',approvalStepRole:'approval_step_roles',auditLog:'audit_logs'};
const rowHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
export async function captureFixtureRows(tx){
 const names=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);
 need(names.length===174&&new Set(names).size===174&&names.every(n=>/^[a-z_][a-z0-9_]*$/.test(n)),'TABLES');
 const out={};for(const n of names){const rows=await tx.$queryRawUnsafe('SELECT '+rowHash+' AS hash FROM public."'+n+'" t LIMIT 10001');need(rows.length<=10000,'ROW_LIMIT');out[n]=sorted(rows.map(r=>r.hash));}return out;
}
export async function writeSuccessorFixture({db,census,authorization,fixture,actors,passwordService,verifyRuntime,sealAttempt,sealCommitted,observeCoverage}){
 const {plan,planSha256}=verifySuccessorFixtureAuthorization(census,authorization);
 need(planSha256===scope&&[verifyRuntime,sealAttempt,sealCommitted,observeCoverage,passwordService?.hash].every(f=>typeof f==='function'),'CONTEXT');
 await verifyRuntime();
 const fresh={};for(const spec of plan.certification.newActors){const password=randomBytes(32).toString('hex');fresh[spec.key]={userId:randomUUID(),employeeId:randomUUID(),email:'proto-'+spec.roleCode.toLowerCase()+'@example.invalid',password,passwordHash:await passwordService.hash(password)};}
 // Exclusive private attempt must succeed before any database write. Retain
 // failed attempts for diagnosis; never automatically repeat or reset.
 await sealAttempt({planSha256,actors:fresh});
 const result=await db.$transaction(async tx=>{
  const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
  need(ids.length===1&&ids[0].db===plan.database&&ids[0].role==='proto_runtime'&&ids[0].ro==='off'&&ids[0].isolation==='serializable','DATABASE');
  await tx.$queryRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('m6-event237-fixture'))::text AS lock");
  const sessions=await tx.$queryRawUnsafe('SELECT count(*)::text AS n FROM public.user_sessions WHERE revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP');need(sessions.length===1&&sessions[0].n==='0','SESSIONS');
  const old=await observeCoverage(tx);need(same(old.ss16,census.ss16)&&same(old.certification,census.certification)&&old.functionalActorsBound===8,'COVERAGE_DRIFT');
  const before=await captureFixtureRows(tx), additions={}, addedIds={};
  const create=async(model,data)=>{const table=tables[model],id=data.id??randomUUID();need(table,'MODEL');const row=await tx[model].create({data:{...data,id}});need(row.id===id,'CREATE_ID');const hashes=await tx.$queryRawUnsafe('SELECT '+rowHash+' AS hash FROM public."'+table+'" t WHERE id=$1::uuid',id);need(hashes.length===1&&/^[a-f0-9]{64}$/.test(hashes[0].hash),'CREATE_HASH');(additions[table]??=[]).push(hashes[0].hash);(addedIds[table]??=[]).push(id);return row;};
  const companies=await tx.company.findMany({where:{isActive:true}});need(companies.length===2&&companies.some(c=>c.id===fixture.companyId&&c.companyCode==='PROTO_A')&&companies.some(c=>c.id===fixture.foreignCompanyId&&c.companyCode==='PROTO_B'),'COMPANIES');
  const projects=await tx.project.findMany({where:{isActive:true}});const project=(code,company,id)=>{const p=projects.filter(x=>x.projectCode===code&&x.companyId===company);need(p.length===1&&(!id||p[0].id===id),'PROJECT');return p[0].id;};
  const a=project('SITE_A',fixture.companyId,fixture.projectId),b=project('SITE_B',fixture.companyId,fixture.unassignedProjectId),f=project('SITE_FOREIGN',fixture.foreignCompanyId);
  const allCodes=[...new Set([...plan.ss16.roles,...plan.certification.newActors].flatMap(x=>x.permissions))];const permissions=await tx.permission.findMany({where:{permissionCode:{in:allCodes}}});need(permissions.length===allCodes.length&&allCodes.every(c=>permissions.some(p=>p.permissionCode===c)),'PERMISSIONS');
  const role=async(companyId,code,grants,newOnly=false)=>{const r=await tx.role.findUnique({where:{companyId_roleCode:{companyId,roleCode:code}},include:{rolePermissions:{include:{permission:true}}}});if(r){need(!newOnly&&r.isActive&&same(sorted(r.rolePermissions.map(x=>x.permission.permissionCode)),sorted(grants)),'ROLE_CONFLICT');return r.id;}const made=await create('role',{companyId,roleCode:code,roleName:'Synthetic M6 '+code});for(const c of grants)await create('rolePermission',{roleId:made.id,permissionId:permissions.find(p=>p.permissionCode===c).id});return made.id;};
  const attach=async(companyId,userId,roleId)=>{const found=await tx.userRole.findUnique({where:{companyId_userId_roleId:{companyId,userId,roleId}}});if(!found)await create('userRole',{companyId,userId,roleId});};
  const assign=async(projectId,employeeId,projectRole)=>{const rows=await tx.projectMember.findMany({where:{projectId,employeeId}});if(rows.some(x=>x.isActive))return;need(!rows.some(x=>x.projectRole===projectRole),'MEMBERSHIP_CONFLICT');await create('projectMember',{projectId,employeeId,projectRole});};
  let pmRole;
  for(const spec of plan.ss16.roles){const actor=actors[spec.actor];need(actor&&actor.userId&&actor.employeeId,'ACTOR');const u=await tx.user.findUnique({where:{id:actor.userId}});need(u?.companyId===fixture.companyId&&u.employeeId===actor.employeeId&&u.email===actor.email&&u.isActive,'ACTOR_ID');const rid=await role(fixture.companyId,spec.code,spec.permissions);await attach(fixture.companyId,u.id,rid);for(const p of [a,b])await assign(p,u.employeeId,spec.code);if(spec.code==='PROJECT_MANAGER')pmRole=rid;}
  const wf=await tx.approvalWorkflow.findUnique({where:{companyId_workflowCode:{companyId:fixture.companyId,workflowCode:plan.ss16.workflow.code}},include:{steps:{include:{stepRoles:true}}}});
  if(wf){const s=wf.steps[0];need(wf.isActive&&wf.entityType==='MOVEMENT_CORRECTION'&&wf.steps.length===1&&s.stepNo===1&&s.requiredApprovals===1&&s.stepRoles.length===1&&s.stepRoles[0].roleId===pmRole,'WORKFLOW_CONFLICT');}else{const w=await create('approvalWorkflow',{companyId:fixture.companyId,workflowCode:plan.ss16.workflow.code,entityType:'MOVEMENT_CORRECTION',workflowName:'Synthetic SS16 correction'});const s=await create('approvalStep',{approvalWorkflowId:w.id,stepNo:1,stepName:'Independent PM approval',requiredApprovals:1});await create('approvalStepRole',{approvalStepId:s.id,roleId:pmRole});}
  for(const spec of plan.certification.newActors){const x=fresh[spec.key],companyId=spec.company==='PROTO_A'?fixture.companyId:fixture.foreignCompanyId;const rid=await role(companyId,spec.roleCode,spec.permissions,true);await create('employee',{id:x.employeeId,companyId,employeeCode:spec.roleCode,employeeName:'Synthetic M6 '+spec.key});await create('user',{id:x.userId,companyId,employeeId:x.employeeId,email:x.email,passwordHash:x.passwordHash,displayName:'Synthetic M6 '+spec.key});await attach(companyId,x.userId,rid);if(spec.project)await assign(spec.project==='SITE_A'?a:f,x.employeeId,spec.roleCode);}
  const afterCoverage=await observeCoverage(tx);need(afterCoverage.functionalActorsBound===8&&afterCoverage.ss16.ready===true&&afterCoverage.certification.ready===true&&afterCoverage.certification.finance===2&&afterCoverage.certification.certificationOnly===1&&afterCoverage.certification.unassigned===1&&afterCoverage.certification.foreign===1,'POST_COVERAGE');
  const after=await captureFixtureRows(tx);const proof=verifySuccessorFixtureDelta(before,after,additions,authorization);
  return {proof,addedIds,additions,before,after};
 },{isolationLevel:'Serializable',timeout:120000});
 await verifyRuntime();await sealCommitted({planSha256,...result});
 return {...result.proof,status:'M6_SUCCESSOR_FIXTURE_COMMITTED',newActors:3,ss16Ready:true,certificationReady:true,sessionsCreated:false,secretsPrinted:false};
}
