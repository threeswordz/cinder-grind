// Synthetic rehearsal only. This module has no CLI, DB connection or session authority.
import {createHash} from 'node:crypto';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_ROLE_'+c),{safeCode:'M6_RESIDUAL_ROLE_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const sort=x=>[...x].sort(),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const app='70013b5139292ef33563447f8937c8f132feabd2';
const discovery='840477f8c18665953ed3285635adc81f5091fadb';
const baseSpecs=[['BEN','MANAGEMENT',['schedule.programme.view','schedule.work_plan.confirm']],['JAI','PROCUREMENT_OFFICER',['procurement.po.view']],['KHAIMOOK',null,['schedule.programme.view','schedule.work_plan.prepare']],['FOREMAN',null,['schedule.programme.view','schedule.progress.record']]];
export const event284Specs=needsPoEdit=>{need(typeof needsPoEdit==='boolean','PUR07_SCOPE');return baseSpecs.map(([actor,role,permissions])=>[actor,role,[...permissions,...(actor==='KHAIMOOK'?['wbs.wbs.create','schedule.activity.create','schedule.calendar.manage','admin.activity_types.manage']:actor==='JAI'?['documents.document.upload','documents.document.link',...(needsPoEdit?['procurement.po.edit']:[])]:[])]]);};
const grants=u=>sort(new Set(u.userRoles.flatMap(e=>e.role.rolePermissions.map(p=>p.permission.permissionCode))));
export function planResidualRoles({fixture,original,roster,users,roles,permissions,project,needsPoEdit}){
 const specs=event284Specs(needsPoEdit);
 const companyId=fixture?.companyId,projectId=fixture?.projectId;
 need([companyId,projectId,fixture?.adminUserId].every(uuid)&&project?.id===projectId&&project.companyId===companyId&&project.projectCode==='SITE_A'&&project.isActive===true,'PROJECT');
 need(Array.isArray(users)&&users.length===12&&new Set(users.map(u=>u.id)).size===12&&Array.isArray(roles)&&Array.isArray(permissions)&&roles.every(r=>r.companyId===companyId),'CENSUS');
 const codes=sort(new Set(specs.flatMap(x=>x[2]))),catalog=permissions.filter(p=>codes.includes(p.permissionCode));
 need(catalog.length===codes.length&&same(sort(catalog.map(p=>p.permissionCode)),codes)&&catalog.every(p=>uuid(p.id))&&new Set(catalog.map(p=>p.id)).size===codes.length,'CATALOG');
 need(!roles.some(r=>['MANAGEMENT','PROCUREMENT_OFFICER'].includes(r.roleCode)),'CANONICAL_ROLE_EXISTS');
 const changes=[];
 for(const [actor,createRole,required] of specs){
  const a=original?.[actor],b=roster?.[actor],u=users.find(x=>x.id===a?.userId);
  need(a&&[a.userId,a.employeeId,a.roleId].every(uuid)&&a.userId!==fixture.adminUserId&&b?.userId===a.userId&&b.companyId===companyId&&u?.companyId===companyId&&u.company?.companyCode==='PROTO_A'&&u.company.isActive===true&&u.isActive===true&&u.email==='proto-'+actor.toLowerCase()+'@example.invalid'&&u.email===a.email&&u.employeeId===a.employeeId&&u.employee?.id===a.employeeId&&u.employee.companyId===companyId&&u.employee.isActive===true,'ACTOR');
  need(project.members.some(m=>m.employeeId===a.employeeId&&m.isActive===true),'MEMBERSHIP');
  need(Array.isArray(u.userRoles)&&u.userRoles.every(e=>e.companyId===companyId&&e.role?.companyId===companyId&&e.role.isActive===true&&e.roleId===e.role.id)&&same(sort(u.userRoles.map(e=>e.role.roleCode)),sort(b.roleCodes))&&same(grants(u),sort(b.permissions)),'ROSTER');
  const base=u.userRoles.find(e=>e.roleId===a.roleId&&e.role.roleCode==='PROTO_'+actor);
  need(base&&users.filter(x=>x.userRoles?.some(e=>e.roleId===a.roleId)).length===1&&roles.some(r=>r.id===a.roleId&&r.roleCode==='PROTO_'+actor&&r.isActive===true),'EXCLUSIVE_ROLE');
  const before=grants(u);
  need(required.every(p=>actor==='JAI'&&p==='procurement.po.view'?before.includes(p):!before.includes(p)),'PERMISSION_DRIFT');
  changes.push({actor,userId:a.userId,existingRoleId:createRole?null:a.roleId,createRole,permissions:required.map(code=>({code,id:catalog.find(p=>p.permissionCode===code).id})),beforeRoles:sort(b.roleCodes),beforePermissions:before});
 }
 return {applicationSha:app,discoverySha:discovery,database:'m6_successor_rehearsal',companyId,projectId,adminUserId:fixture.adminUserId,needsPoEdit,changes,expected:{roles:2,user_roles:2,role_permissions:needsPoEdit?14:13,audit_logs:1}};
}
export const residualRolePlanDigest=digest;
export function verifyResidualRoleAuthority(plan,authorization,baseline,operatorSha){
 need(/^[a-f0-9]{40}$/.test(operatorSha??'')&&plan?.applicationSha===app&&plan.discoverySha===discovery&&plan.database==='m6_successor_rehearsal'&&authorization?.operatorSha===operatorSha&&authorization.applicationSha===app&&authorization.database===plan.database&&authorization.planSha256===digest(plan)&&authorization.baselineSha256===digest(baseline)&&authorization.ownerAuthorizedSyntheticRoleDelta===true&&authorization.ownerAuthorizedEvent284===true&&typeof plan.needsPoEdit==='boolean'&&plan.expected?.role_permissions===(plan.needsPoEdit?14:13)&&authorization.retainedMutationAuthorized===false&&authorization.productionAuthorized===false,'AUTHORITY');
 return true;
}
export function verifyResidualRoleDelta(before,after,added,permissionEdges){
 need([13,14].includes(permissionEdges),'EDGE_COUNT');
 const keys=sort(Object.keys(before??{})),expected={roles:2,user_roles:2,role_permissions:permissionEdges,audit_logs:1};
 need(keys.length===174&&same(keys,sort(Object.keys(after??{})))&&same(sort(Object.keys(added??{})),sort(Object.keys(expected)))&&Object.entries(expected).every(([t,n])=>keys.includes(t)&&Array.isArray(added[t])&&added[t].length===n),'DELTA_SHAPE');
 for(const t of keys){const b=before[t],a=after[t],extra=added[t]??[];need(Array.isArray(b)&&Array.isArray(a)&&[...b,...a,...extra].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))&&new Set([...b,...extra]).size===b.length+extra.length&&same(sort([...b,...extra]),sort(a)),'UNEXPECTED_DELTA');}
 return true;
}
