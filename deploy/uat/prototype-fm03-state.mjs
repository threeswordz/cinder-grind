// Populated synthetic preservation and explicit FM03 grant delta. No CLI/reset.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {siteIssueCatalog,verifySiteIssueCatalog} from '../release-candidate/site-issue-catalog-contract.mjs';
import {siteIssueTables} from '../release-candidate/site-issue-schema-contract.mjs';
import {SOURCE,ROLES} from './prototype-actors.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const canonical=v=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?
  Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
export const FM03_GRANTS=Object.freeze({
  FOREMAN:['site.issue.view','site.issue.report','site.issue.verify'],
  KHAIMOOK:['site.issue.view','site.issue.follow_up','site.issue.close','site.issue.routing.manage'],
  BEN:['site.issue.view','site.issue.escalation.view'],
});
// All public tables participate, including Documents, signed histories,
// financial records, private encrypted records and source permission rows.
// Keep complete rows privately so only declared additions can be admitted.
export async function fm03Snapshot(tx){
  const tables=await tx.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename");
  const result={};
  for(const {tablename:t} of tables){
    demand(/^[a-z_]+$/.test(t),'FM03_UNEXPECTED_TABLE_NAME');
    const rows=await tx.$queryRawUnsafe('SELECT to_jsonb(t)::text AS bytes FROM "'+t+'" t');
    demand(rows.length<=10000,'FM03_SYNTHETIC_TABLE_BOUND_EXCEEDED');
    // Preserve PostgreSQL's exact numeric/timestamp bytes before JS parsing.
    result[t]=rows.map(r=>({...JSON.parse(r.bytes),__fm03_exact_row_json:r.bytes})).sort((a,b)=>canonical(a).localeCompare(canonical(b)));
  }
  return result;
}
export function verifyFm03Migration(before,after){
  verifySiteIssueCatalog(after.permissions.filter(p=>siteIssueCatalog.some(c=>c.id===p.id)).map(({__fm03_exact_row_json,...r})=>r),true);
  const normalized=structuredClone(after);
  normalized.permissions=normalized.permissions.filter(p=>!siteIssueCatalog.some(c=>c.id===p.id));
  for(const t of siteIssueTables){demand(!Object.hasOwn(before,t)&&normalized[t]?.length===0,'FM03_NONEMPTY_OR_PRIOR_ISSUE_TABLE');delete normalized[t];}
  const oldMigrations=before._prisma_migrations,newMigrations=after._prisma_migrations;
  demand(newMigrations.length===oldMigrations.length+1&&oldMigrations.every(m=>newMigrations.some(n=>canonical(n)===canonical(m))),
    'FM03_HISTORICAL_MIGRATION_DRIFT');
  const added=newMigrations.filter(n=>!oldMigrations.some(m=>m.id===n.id));
  demand(added.length===1&&added[0].migration_name==='20261114140000_fm03_site_issue_lifecycle'&&
    added[0].finished_at&&!added[0].rolled_back_at,'FM03_WRONG_ADDITIVE_MIGRATION');
  normalized._prisma_migrations=oldMigrations;
  assert.deepEqual(normalized,before,'FM03 migration changed historical data, schema or grants');
}
export async function configureFm03(db,binding,expected){
  const b=structuredClone(binding),f=b.fixture;
  demand(b.sourceSha===SOURCE&&typeof expected==='string'&&/^[a-f0-9]{64}$/.test(expected),'FM03_CONFIGURATION_BINDING_INVALID');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-fm03-configuration-v1'))");
    demand(digest(await fm03Snapshot(tx))===expected,'FM03_CONFIGURATION_STATE_DRIFT');
    const companies=await tx.company.findMany({orderBy:{companyCode:'asc'}});
    demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
      companies.some(c=>c.id===f.companyId&&c.companyCode==='PROTO_A')&&
      companies.some(c=>c.id===f.foreignCompanyId&&c.companyCode==='PROTO_B'),'FM03_SYNTHETIC_COMPANIES_REQUIRED');
    const project=await tx.project.findUnique({where:{id:f.projectId}});
    demand(project?.companyId===f.companyId&&project.projectCode==='SITE_A'&&project.isActive,'FM03_PROJECT_BINDING_DRIFT');
    demand(await tx.siteIssue.count()===0&&await tx.siteIssueRouting.count()===0,'FM03_CONFIGURATION_OR_JOURNEY_ALREADY_EXISTS');
    // Roles are shared authority. Repeat exclusive assignment and the exact
    // pre-existing grant matrix in this write transaction, even if a grant or
    // membership changed after the coordinator's earlier read-only inspection.
    const keys=Object.keys(FM03_GRANTS),members=await tx.userRole.findMany({where:{roleId:{in:keys.map(k=>b.actors[k].roleId)}}});
    demand(members.length===keys.length&&members.every(m=>m.companyId===f.companyId&&keys.some(k=>
      m.roleId===b.actors[k].roleId&&m.userId===b.actors[k].userId)),'FM03_ROLE_MEMBERSHIP_MUST_BE_EXCLUSIVE');
    const added=[];
    for(const [key,codes] of Object.entries(FM03_GRANTS)){
      const a=b.actors[key],user=await tx.user.findUnique({where:{id:a.userId},include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
      demand(user?.isActive&&user.companyId===f.companyId&&user.employeeId===a.employeeId&&user.email==='proto-'+key.toLowerCase()+'@example.invalid'&&
        user.userRoles.length===1&&user.userRoles[0].roleId===a.roleId&&user.userRoles[0].role.companyId===f.companyId&&
        user.userRoles[0].role.roleCode==='PROTO_'+key&&user.userRoles[0].role.isActive&&
        await tx.employee.count({where:{id:a.employeeId,companyId:f.companyId,isActive:true}})===1&&
        await tx.projectMember.count({where:{employeeId:a.employeeId,projectId:f.projectId,isActive:true}})===1,'FM03_ACTOR_SCOPE_DRIFT');
      const delta=b.configuration?.changes?.find(c=>c.roleCode==='PROTO_'+key)?.addedCapabilities??[];
      const expected=[...ROLES[key].permissions,...delta].sort();
      demand(new Set(expected).size===expected.length&&canonical(user.userRoles[0].role.rolePermissions.map(p=>p.permission.permissionCode).sort())===canonical(expected),
        'FM03_EXISTING_ROLE_GRANT_MATRIX_CHANGED');
      const catalog=await tx.permission.findMany({where:{permissionCode:{in:codes}}});
      demand(catalog.length===codes.length&&await tx.rolePermission.count({where:{roleId:a.roleId,permissionId:{in:catalog.map(p=>p.id)}}})===0,
        'FM03_GRANT_CATALOG_OR_PRIOR_DELTA_INVALID');
      for(const p of catalog)added.push(await tx.rolePermission.create({data:{roleId:a.roleId,permissionId:p.id}}));
    }
    await tx.auditLog.create({data:{companyId:f.companyId,entityType:'PROTOTYPE_FM03_CONFIGURATION',entityId:f.projectId,
      action:'CONFIGURE',actorUserId:f.adminUserId,newValues:{syntheticOnly:true,grantMatrix:FM03_GRANTS}}});
    return {status:'FM03_SYNTHETIC_GRANTS_APPLIED',addedRolePermissionIds:added.map(r=>r.id),productionAuthorized:false};
  },{isolationLevel:'Serializable',timeout:30000});
}
export function fm03BrowserBinding(b,origins){
  const f=b.fixture;
  return {...origins,fixture:{company:{id:f.companyId},assigned:{id:f.projectId},unassigned:{id:f.unassignedProjectId},
    foreign:{id:f.foreignProjectId},report:null,activity:null,actors:{REPORTER:b.actors.FOREMAN,OWNER:b.actors.KHAIMOOK,
      MANAGER:b.actors.BEN,CONFIG:b.actors.KHAIMOOK,DENIED:b.actors.STORE_SITE}}};
}
export function verifyFm03JourneyPreservation(before,after,configuration,binding,result){
  const f=binding.fixture,normalized=structuredClone(after);
  for(const t of siteIssueTables)delete normalized[t];
  const baseline=structuredClone(before);for(const t of siteIssueTables)delete baseline[t];
  const addedGrants=normalized.role_permissions.filter(r=>configuration.addedRolePermissionIds.includes(r.id));
  const expectedGrants=Object.entries(FM03_GRANTS).flatMap(([key,codes])=>codes.map(code=>binding.actors[key].roleId+':'+siteIssueCatalog.find(p=>p.permission_code===code).id)).sort();
  demand(addedGrants.length===9&&canonical(addedGrants.map(r=>r.role_id+':'+r.permission_id).sort())===canonical(expectedGrants),
    'FM03_SYNTHETIC_GRANT_DELTA_CHANGED');
  normalized.role_permissions=normalized.role_permissions.filter(r=>!configuration.addedRolePermissionIds.includes(r.id));
  const oldAudit=new Set(before.audit_logs.map(r=>r.id));
  const extraAudit=after.audit_logs.filter(r=>!oldAudit.has(r.id));
  demand(extraAudit.length===8&&extraAudit.every(r=>r.company_id===f.companyId&&
    r.entity_id===(r.entity_type==='SITE_ISSUE'?result.issueId:f.projectId)&&
    ['PROTOTYPE_FM03_CONFIGURATION','SITE_ISSUE','SITE_ISSUE_ROUTING'].includes(r.entity_type)&&
    [f.adminUserId,...Object.values(binding.actors).map(a=>a.userId)].includes(r.actor_user_id)), 'FM03_UNEXPECTED_AUDIT_ADDITION');
  normalized.audit_logs=normalized.audit_logs.filter(r=>oldAudit.has(r.id));
  // Authentication may update only these two User fields. All other identity,
  // private data, permissions and historical sessions remain byte-exact JSON.
  const loginUsers=['FOREMAN','KHAIMOOK','BEN','STORE_SITE'].map(k=>binding.actors[k].userId);
  for(const data of [baseline,normalized])data.users=data.users.map(row=>{
    if(!loginUsers.includes(row.id))return row;
    const {last_login_at,updated_at,__fm03_exact_row_json,...r}=row;return r;
  });
  const oldSessions=new Set(before.user_sessions.map(r=>r.id));
  const fresh=after.user_sessions.filter(r=>!oldSessions.has(r.id));
  demand(fresh.length>0&&fresh.every(r=>r.revoked_at&&[binding.actors.FOREMAN.userId,binding.actors.KHAIMOOK.userId,
    binding.actors.BEN.userId,binding.actors.STORE_SITE.userId].includes(r.user_id)),'FM03_JOURNEY_SESSION_NOT_REVOKED');
  normalized.user_sessions=normalized.user_sessions.filter(r=>oldSessions.has(r.id));
  assert.deepEqual(normalized,baseline,'FM03 journey changed unrelated data, prior sessions, grants or history');
  demand(after.site_issues.length===1&&after.site_issues[0].id===result.issueId&&after.site_issues[0].status==='CLOSED'&&
    after.site_issues[0].version===6&&after.site_issue_events.length===6&&after.site_issue_routings.length===1,
    'FM03_JOURNEY_FINAL_HISTORY_INVALID');
  const issue=after.site_issues[0],route=after.site_issue_routings[0];
  demand(issue.company_id===f.companyId&&issue.project_id===f.projectId&&issue.reporter_user_id===binding.actors.FOREMAN.userId&&
    issue.owner_user_id===binding.actors.KHAIMOOK.userId&&issue.escalation_user_id===binding.actors.BEN.userId&&issue.escalated_at&&
    route.project_id===f.projectId&&route.owner_user_id===binding.actors.KHAIMOOK.userId&&route.escalation_user_id===binding.actors.BEN.userId,
    'FM03_JOURNEY_FINAL_ACTORS_OR_SCOPE_INVALID');
  const events=[...after.site_issue_events].sort((a,b)=>a.version-b.version);
  const actions=['REPORT','FOLLOW_UP','VERIFY','FOLLOW_UP','VERIFY','CLOSE'],states=['OPEN','AWAITING_VERIFICATION','OPEN','AWAITING_VERIFICATION','VERIFIED','CLOSED'];
  demand(events.every((e,i)=>e.issue_id===issue.id&&e.version===i+1&&e.action===actions[i]&&e.status===states[i]&&
    e.actor_user_id===binding.actors[[0,2,4].includes(i)?'FOREMAN':'KHAIMOOK'].userId),'FM03_JOURNEY_EVENT_SEQUENCE_INVALID');
}
