// Bind exactly the eight historical actors and three Event239 additions. No login.
import {createHash} from 'node:crypto';
import {createHrFixtureProjection} from './m6-hr-fixture-projection.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_ROSTER_'+c),{safeCode:'M6_ROSTER_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sorted=a=>[...a].sort();
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const names=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'];
const controls={certificationOnly:['PROTO_M6_CERT_ONLY','SITE_A'],unassigned:['PROTO_M6_CERT_UNASSIGNED',null],foreign:['PROTO_M6_CERT_FOREIGN','SITE_FOREIGN']};
const cv='subcontracts.certification.view',pv='finance.payment.view';
export function bindSuccessorRoster({fixture,original,attempt,committed,users,projects}){
 createHrFixtureProjection(committed);
 need(attempt?.applicationSha===committed.applicationSha&&attempt.applicationTree===committed.applicationTree&&attempt.operatorSha===committed.operatorSha&&attempt.planSha256===committed.planSha256,'ATTEMPT');
 need([fixture?.companyId,fixture?.foreignCompanyId,fixture?.projectId,fixture?.unassignedProjectId,fixture?.foreignProjectId,fixture?.adminUserId].every(uuid)&&fixture.companyId!==fixture.foreignCompanyId,'FIXTURE');
 need(same(sorted(Object.keys(original??{})),sorted(names))&&same(sorted(Object.keys(attempt.actors??{})),sorted(Object.keys(controls))),'ACTOR_KEYS');
 need(Array.isArray(users)&&users.length===12&&new Set(users.map(u=>u.id)).size===12&&users.some(u=>u.id===fixture.adminUserId&&u.employeeId===null),'USER_CENSUS');
 need(Array.isArray(projects)&&projects.length===3,'PROJECTS');
 const p={};for(const [code,id,companyId] of [['SITE_A',fixture.projectId,fixture.companyId],['SITE_B',fixture.unassignedProjectId,fixture.companyId],['SITE_FOREIGN',fixture.foreignProjectId,fixture.foreignCompanyId]]){const rows=projects.filter(x=>x.id===id&&x.companyId===companyId&&x.projectCode===code&&x.isActive===true);need(rows.length===1&&Array.isArray(rows[0].members),'PROJECT');p[code]=rows[0];}
 const bind=(a,companyId,roleCodes,expectedRoleId)=>{need(a&&uuid(a.userId)&&uuid(a.employeeId)&&/^[a-f0-9]{64}$/.test(a.password??'')&&/^proto-[a-z0-9_]+@example\.invalid$/.test(a.email??''),'PRIVATE_ACTOR');const u=users.find(x=>x.id===a.userId);need(u?.isActive===true&&u.companyId===companyId&&u.company?.isActive===true&&u.employeeId===a.employeeId&&u.employee?.id===a.employeeId&&u.employee.companyId===companyId&&u.employee.isActive===true&&u.email===a.email,'IDENTITY');
  const roles=u.userRoles??[];need(roles.length===roleCodes.length&&roles.every(r=>r.companyId===companyId&&r.role?.companyId===companyId&&r.role.isActive===true)&&same(sorted(roles.map(r=>r.role.roleCode)),sorted(roleCodes))&&(!expectedRoleId||roles.some(r=>r.roleId===expectedRoleId&&r.role.id===expectedRoleId)),'ROLE');
  const permissions=sorted(new Set(roles.flatMap(r=>r.role.rolePermissions.map(x=>x.permission.permissionCode))));need(permissions.every(x=>typeof x==='string'&&x.length>0),'PERMISSIONS');return {userId:u.id,companyId,email:u.email,password:a.password,roleCodes:sorted(roleCodes),permissions};};
 const roster={},assigned=(a,project)=>p[project].members.some(m=>m.isActive===true&&m.employeeId===a.employeeId);
 for(const key of names){const a=original[key];need(a.email==='proto-'+key.toLowerCase()+'@example.invalid'&&uuid(a.roleId),'ORIGINAL');const roles=['PROTO_'+key];if(key==='STORE_SITE')roles.push('STOREKEEPER');if(key==='KHAIMOOK')roles.push('PROJECT_MANAGER');roster[key]=bind(a,fixture.companyId,roles,a.roleId);if(roles.length===2)need(['SITE_A','SITE_B'].every(project=>assigned(a,project)),'MOVEMENT_MEMBERSHIP');}
 for(const [key,[code,project]] of Object.entries(controls)){const a=attempt.actors[key],companyId=key==='foreign'?fixture.foreignCompanyId:fixture.companyId;need(committed.addedIds.users.includes(a.userId)&&committed.addedIds.employees.includes(a.employeeId)&&a.email==='proto-'+code.toLowerCase()+'@example.invalid','ADDED_ACTOR');const r=bind(a,companyId,[code]);const expected=['projects.project.view',cv,...(key==='certificationOnly'?[]:[pv])];need(same(r.permissions,sorted(expected))&&Object.keys(p).every(k=>assigned(a,k)===(k===project)),'CONTROL_SCOPE');roster[key]=r;}
 need(new Set(Object.values(roster).map(x=>x.userId)).size===11&&new Set(Object.values(roster).map(x=>x.email)).size===11&&!Object.values(roster).some(x=>x.userId===fixture.adminUserId),'DUPLICATE');
 const finance=names.filter(k=>assigned(original[k],'SITE_A')&&[cv,pv].every(c=>roster[k].permissions.includes(c)));need(finance.length===2,'FINANCE_CENSUS');
 const financeKey=['NANCY','PORN',...names].find(k=>finance.includes(k));
 const actorIds=Object.values(roster).map(a=>a.userId).sort();
 const certification={finance:roster[financeKey].userId,...Object.fromEntries(Object.keys(controls).map(k=>[k,roster[k].userId]))};
 const rosterSha256=digest({applicationSha:committed.applicationSha,applicationTree:committed.applicationTree,fixturePlan:committed.planSha256,actors:Object.entries(roster).map(([key,{password,...a}])=>({key,...a})),certification});
 return {roster,actorIds,certification,financeKey,rosterSha256};
}
export function mapSuccessorSessions(binding,live){
 need(live instanceof Map&&live.size===11&&binding.actorIds.every(id=>live.has(id)),'SESSION_ROSTER');
 const named=new Map(Object.entries(binding.roster).map(([key,a])=>[key,live.get(a.userId)]));
 need([...named.values()].every(s=>/^erp_session=[A-Za-z0-9_-]{20,256}$/.test(s?.cookie??''))&&new Set([...named.values()].map(s=>s.cookie)).size===11,'SESSION_COOKIE');
 return {site:named,hr:new Map(['KOH','BEN','FOREMAN'].map(k=>[k,named.get(k)])),certification:Object.fromEntries(Object.entries(binding.certification).map(([k,id])=>[k,live.get(id).cookie]))};
}
