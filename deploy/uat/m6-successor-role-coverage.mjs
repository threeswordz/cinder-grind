// Read-only coverage census; no guessed actors or grants, no session creation.
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_COVERAGE_'+code),{safeCode:'M6_COVERAGE_'+code});};
const required=['inventory.receipt','inventory.issue','inventory.return','inventory.transfer'];
const functional=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'];
const all=(set,items)=>items.every(x=>set.has(x));
export function assessSuccessorRoleCoverage({actors,companyId,foreignCompanyId,projectId,users,workflow,projects}){
  need(companyId&&foreignCompanyId&&companyId!==foreignCompanyId&&projectId&&Array.isArray(users)&&users.length<=100&&new Set(users.map(u=>u.id)).size===users.length,'INPUT');
  need(Array.isArray(projects)&&projects.length>0&&projects.some(p=>p.id===projectId)&&new Set(projects.map(p=>p.id)).size===projects.length,'PROJECTS');
  const eligible=users.filter(u=>u.isActive&&u.company?.isActive&&u.employee?.isActive&&u.employee.companyId===u.companyId&&u.employee.id===u.employeeId);
  const roles=u=>u.userRoles.filter(a=>a.companyId===u.companyId&&a.role?.companyId===u.companyId&&a.role.isActive).map(a=>a.role);
  const grants=r=>new Set(r.rolePermissions.map(x=>x.permission.permissionCode));
  const permissions=u=>new Set(roles(u).flatMap(r=>[...grants(r)]));
  const assigned=(u,p)=>p.members.some(m=>m.isActive&&m.employeeId===u.employeeId);
  const home=eligible.filter(u=>u.companyId===companyId),target=projects.find(p=>p.id===projectId);
  need(target.companyId===companyId&&target.isActive===true&&projects.every(p=>p.companyId===companyId&&p.isActive===true),'PROJECT_SCOPE');
  const named=key=>home.find(u=>u.id===actors?.[key]?.userId&&u.employeeId===actors[key].employeeId&&u.email===actors[key].email&&roles(u).some(r=>r.id===actors[key].roleId&&r.roleCode==='PROTO_'+key));
  const bound=functional.filter(k=>named(k)).length;
  const roleReady=(u,code,actions)=>!!u&&roles(u).some(r=>r.roleCode===code&&all(grants(r),required.flatMap(p=>actions.map(a=>p+'.'+a))));
  const store=named('STORE_SITE'),pm=named('KHAIMOOK');
  const storeReady=roleReady(store,'STOREKEEPER',['view','edit']),pmReady=roleReady(pm,'PROJECT_MANAGER',['view','approve','reverse']);
  const step=workflow?.steps?.[0],pmRole=pm&&roles(pm).find(r=>r.roleCode==='PROJECT_MANAGER');
  const workflowReady=!!(pmRole&&workflow?.companyId===companyId&&workflow.workflowCode==='SS16_MOVEMENT_CORRECTION'&&workflow.entityType==='MOVEMENT_CORRECTION'&&workflow.isActive&&workflow.steps.length===1&&step?.stepNo===1&&step.requiredApprovals===1&&step.stepRoles?.length===1&&step.stepRoles[0].roleId===pmRole.id);
  const memberReady=!!(store&&pm&&store.employeeId!==pm.employeeId&&projects.every(p=>assigned(store,p)&&assigned(pm,p)));
  const cv='subcontracts.certification.view',pv='finance.payment.view';
  const finance=home.filter(u=>assigned(u,target)&&all(permissions(u),[cv,pv]));
  const certOnly=home.filter(u=>assigned(u,target)&&permissions(u).has(cv)&&!permissions(u).has(pv));
  const unassigned=home.filter(u=>!assigned(u,target)&&all(permissions(u),[cv,pv])&&!permissions(u).has('projects.access_all'));
  const foreign=eligible.filter(u=>u.companyId===foreignCompanyId&&!assigned(u,target)&&all(permissions(u),[cv,pv])&&!permissions(u).has('projects.access_all'));
  return {status:'M6_SUCCESSOR_ROLE_COVERAGE_OBSERVED',functionalActorsBound:bound,requiredFunctionalActors:8,ss16:{canonicalStoreReady:storeReady,canonicalPmReady:pmReady,workflowReady,projectMembershipReady:memberReady,ready:storeReady&&pmReady&&workflowReady&&memberReady},certification:{finance:finance.length,certificationOnly:certOnly.length,unassigned:unassigned.length,foreign:foreign.length,ready:[finance,certOnly,unassigned,foreign].every(a=>a.length>0)},mayMutate:false,authenticatedReadbackPerformed:false,milestone6Accepted:false,productionAuthorized:false};
}
