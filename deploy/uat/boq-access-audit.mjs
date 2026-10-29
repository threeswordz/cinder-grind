// Configuration metadata only. Never use this collector to activate grants or
// treat a dated capture as acceptance of a retained runtime/release.
import {mkdir,open,readFile,lstat,realpath} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,sep} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';

export const functions=['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const sorted=values=>[...new Set(values)].sort();
const fail=code=>{throw new Error(code);};

export function validateTarget(baseUrl,companyId,projectId){
  let url;try{url=new URL(baseUrl);}catch{fail('INVALID_TARGET');}
  if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||!url.port||url.pathname!=='/api/v1'||url.search||url.hash||url.username||url.password||url.href!==baseUrl)fail('INVALID_TARGET');
  if(!uuid.test(companyId)||!uuid.test(projectId))fail('INVALID_SCOPE');
}

export function projectFacts({companyId,projectId,emails,observations,generatedAt}){
  const list=key=>{
    const rows=observations[key]?.status===200&&Array.isArray(observations[key].data)?observations[key].data:null;
    if(!rows||!rows.every(r=>r&&typeof r==='object'&&!Array.isArray(r)))return null;
    if(key==='users'&&!rows.every(r=>typeof r.id==='string'&&typeof r.email==='string'))return null;
    if(key==='employees'&&!rows.every(r=>typeof r.id==='string'))return null;
    if(key==='members'&&!rows.every(r=>typeof r.employeeId==='string'&&typeof r.isActive==='boolean'))return null;
    return rows;
  };
  const users=list('users'),roles=list('roles'),employees=list('employees'),members=list('members'),workflows=list('workflows');
  if(roles?.some(r=>typeof r.companyId==='string'&&r.companyId!==companyId)||workflows?.some(w=>typeof w.companyId==='string'&&w.companyId!==companyId))fail('FOREIGN_CONFIGURATION');
  const roleMap=new Map((roles??[]).filter(r=>r.companyId===companyId).map(r=>[r.id,r]));
  const project=observations.project;
  if(project?.status===200&&((typeof project.data?.id==='string'&&project.data.id!==projectId)||(typeof project.data?.companyId==='string'&&project.data.companyId!==companyId)))fail('FOREIGN_PROJECT');
  const projectVerified=project?.status===200&&project.data?.id===projectId&&project.data?.companyId===companyId;
  const actors=functions.map(key=>{
    const matches=emails[key]&&users?users.filter(u=>typeof u.email==='string'&&u.email.toLowerCase()===emails[key].toLowerCase()):[];
    if(matches.length!==1)return {function:key,status:!emails[key]?'ALIAS_NOT_SUPPLIED':!users?'USERS_UNVERIFIED':matches.length?'AMBIGUOUS_ALIAS':'USER_NOT_FOUND'};
    const user=matches[0],activeUser=typeof user.isActive==='boolean'?user.isActive:null,assignments=Array.isArray(user.userRoles)?user.userRoles:null;
    const assigned=assignments?.map(a=>roleMap.get(a.role?.id));
    const complete=Boolean(roles&&assignments&&assigned.every(Boolean)&&assigned.every(r=>typeof r.isActive==='boolean'&&typeof r.id==='string'&&typeof r.roleCode==='string'&&Array.isArray(r.rolePermissions)&&r.rolePermissions.every(p=>typeof p.permission?.permissionCode==='string')));
    const active=(assigned??[]).filter(r=>r?.isActive===true);
    const permissions=complete?sorted(active.flatMap(r=>r.rolePermissions.map(p=>p.permission.permissionCode))):null;
    const activeEmployee=typeof user.employeeId==='string'?(employees?employees.some(e=>e.id===user.employeeId):null):user.employeeId===null?false:null;
    const membership=typeof user.employeeId==='string'?(members?members.some(m=>m.employeeId===user.employeeId&&m.isActive===true):null):user.employeeId===null?false:null;
    const scope=!projectVerified?'UNVERIFIED':activeUser===false?'DENIED':activeUser===null?'UNVERIFIED':permissions?.includes('projects.access_all')?'ACCESS_ALL':activeEmployee===true&&membership===true?'ASSIGNED':activeEmployee===null||membership===null||permissions===null?'UNVERIFIED':'DENIED';
    return {function:key,status:complete?'FACTS_CAPTURED':'ROLE_DEFINITIONS_UNVERIFIED',userId:user.id,activeUser,
      activeEmployee,activeProjectMember:membership,projectScope:scope,activeRoleIds:active.map(r=>r.id),roleCodes:active.map(r=>r.roleCode).sort(),permissions};
  });
  const selectedWorkflows=(workflows??[]).filter(w=>['BUDGET_REVISION','CUSTOMER_BOQ'].includes(w.entityType)).map(w=>({
    id:w.id,entityType:w.entityType,workflowCode:w.workflowCode,isActive:typeof w.isActive==='boolean'?w.isActive:null,
    status:w.companyId!==companyId?'COMPANY_SCOPE_UNVERIFIED':Array.isArray(w.steps)&&w.steps.every(s=>Number.isInteger(s.stepNo)&&Number.isInteger(s.requiredApprovals)&&Array.isArray(s.stepRoles))?'FACTS_CAPTURED':'STEP_DEFINITIONS_UNVERIFIED',
    steps:(w.steps??[]).map(s=>({stepNo:s.stepNo,requiredApprovals:s.requiredApprovals,
      roles:(s.stepRoles??[]).map(a=>({id:a.role?.id,roleCode:a.role?.roleCode,isActive:a.role?.isActive===true})),
      mappedCandidates:actors.filter(a=>w.companyId===companyId&&a.activeUser&&['ASSIGNED','ACCESS_ALL'].includes(a.projectScope)&&a.permissions&&
        (w.entityType==='BUDGET_REVISION'?a.permissions.includes('budget.revision.approve'):['budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.approve'].every(p=>a.permissions.includes(p)))&&
        (s.stepRoles??[]).some(r=>r.role?.isActive===true&&a.activeRoleIds?.includes(r.role.id))).map(a=>a.function),
    })),
  }));
  return {schema:'construction-erp-boq-access-facts-v1',generatedAt,companyId,projectId,
    status:'READ_ONLY_FACTS_REVIEW_REQUIRED',businessWrites:false,configurationWrites:false,humanAcceptance:false,productionAuthorized:false,
    runtimeCommit:null,runtimeIdentity:'UNVERIFIED_BY_CONFIGURATION_API',atomicSnapshot:false,
    observations:Object.fromEntries(Object.entries(observations).map(([key,value])=>[key,{httpStatus:value.status,shape:value.status===200?(key==='project'?projectVerified?'VERIFIED_SCOPE':'UNVERIFIED':Array.isArray(value.data)?'ARRAY':'UNVERIFIED'):'UNVERIFIED'}])),
    actors,workflows:selectedWorkflows,
    limitations:['Sequential metadata GET observations are not an atomic database snapshot; reconcile concurrent configuration changes separately.','No business records, salaries, passwords, email addresses or session tokens are exported.','Configuration capture is not a release/runtime identity attestation, business acceptance or permission to activate.','Mapped workflow candidates do not attest creator/editor separation for a particular record or sufficient independent approvers.','Unmapped users, inactive roles and unrelated Finance/Procurement authority require separate configuration review; no automatic changes are proposed.']};
}

export async function collectAccess({baseUrl,companyId,projectId,adminEmail,adminPassword,emails,fetchImpl=fetch}){
  validateTarget(baseUrl,companyId,projectId);
  if(!adminEmail||!adminPassword)fail('ADMIN_CREDENTIALS_REQUIRED');
  for(const key of Object.keys(emails))if(!functions.includes(key))fail('UNKNOWN_FUNCTION');
  let cookie,csrf,report,logoutStatus=null;
  const request=async(path,method='GET',body)=>{
    // Callers cannot supply URLs or mutation routes. Only authentication writes
    // occur; every business/configuration endpoint below uses GET.
    const response=await fetchImpl(baseUrl+path,{method,redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'application/json',...(cookie?{Cookie:cookie}:{}),...(csrf?{'x-csrf-token':csrf}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return response;
  };
  try{
    const login=await request('/auth/login','POST',{email:adminEmail,password:adminPassword});
    if(login.status!==201)fail('LOGIN_FAILED');
    const raw=login.headers.get('set-cookie')?.split(';',1)[0];if(!/^erp_session=[A-Za-z0-9_-]{20,}$/.test(raw??''))fail('INVALID_SESSION');cookie=raw;
    const payload=await login.json();csrf=payload?.data?.csrfToken;if(typeof csrf!=='string'||!csrf)fail('INVALID_CSRF');
    const me=await request('/auth/me');if(me.status!==200)fail('IDENTITY_UNVERIFIED');
    if((await me.json())?.data?.companyId!==companyId)fail('WRONG_COMPANY');
    const observations={};
    const routes={project:'/projects/'+projectId,users:'/admin/users',roles:'/admin/roles',employees:'/admin/user-employee-options',members:'/projects/'+projectId+'/members',workflows:'/admin/approval-workflows'};
    for(const [key,path]of Object.entries(routes)){
      const response=await request(path);observations[key]={status:response.status,data:response.status===200?(await response.json())?.data:null};
    }
    report=projectFacts({companyId,projectId,emails,observations,generatedAt:new Date().toISOString()});
  }finally{
    if(cookie){try{logoutStatus=(await request('/auth/logout','POST')).status;}catch{logoutStatus='FAILED';}}
  }
  return {...report,authenticationSessionWrites:true,logoutHttpStatus:logoutStatus};
}

export async function savePrivateReport(report,directory){
  if(typeof directory!=='string'||!directory)fail('PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
  const repository=await realpath(fileURLToPath(new URL('../../',import.meta.url)));
  const requested=resolve(directory);if(requested===repository||requested.startsWith(repository+sep))fail('PUBLIC_REPOSITORY_OUTPUT_DENIED');
  await mkdir(requested,{recursive:true,mode:0o700});
  const info=await lstat(requested);if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0)fail('PRIVATE_DIRECTORY_REQUIRED');
  const actual=await realpath(requested);if(actual===repository||actual.startsWith(repository+sep))fail('PUBLIC_REPOSITORY_OUTPUT_DENIED');
  const path=resolve(actual,'boq-access-'+Date.now()+'-'+randomUUID()+'.json');
  const file=await open(path,'wx',0o600);
  try{await file.writeFile(JSON.stringify(report,null,2)+'\n');}finally{await file.close();}
  return path;
}

async function main(){
  if(process.argv.length!==3||process.argv[2]!=='--capture')fail('USAGE_CAPTURE_ONLY');
  const env=process.env;
  if(!env.BOQ_AUDIT_EVIDENCE_DIR)fail('PRIVATE_OUTPUT_DIRECTORY_REQUIRED');
  const report=await collectAccess({baseUrl:env.BOQ_AUDIT_API_BASE_URL,companyId:env.BOQ_AUDIT_COMPANY_ID,projectId:env.BOQ_AUDIT_PROJECT_ID,
    adminEmail:env.E2_ADMIN_EMAIL??env.BOOTSTRAP_ADMIN_EMAIL,adminPassword:env.E2_ADMIN_PASSWORD??env.BOOTSTRAP_ADMIN_PASSWORD,
    emails:Object.fromEntries(functions.filter(k=>env['E2_'+k+'_EMAIL']).map(k=>[k,env['E2_'+k+'_EMAIL']]))});
  report.collectorSha256=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
  const path=await savePrivateReport(report,env.BOQ_AUDIT_EVIDENCE_DIR);
  console.log(JSON.stringify({status:report.status,evidencePath:path,businessWrites:false,configurationWrites:false,runtimeIdentity:report.runtimeIdentity,logoutHttpStatus:report.logoutHttpStatus}));
  if(report.logoutHttpStatus!==204)process.exitCode=1;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{console.error('BOQ_ACCESS_CAPTURE_INCOMPLETE — no business/configuration mutation route is implemented; inspect approved configuration inputs privately.');process.exitCode=1;});
