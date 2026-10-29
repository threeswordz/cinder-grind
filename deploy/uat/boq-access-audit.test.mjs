import assert from 'node:assert/strict';
import test from 'node:test';
import {createServer} from 'node:http';
import {mkdtemp,readFile,stat,rm,mkdir,symlink,readdir} from 'node:fs/promises';
import os from 'node:os';
import {join} from 'node:path';
import {collectAccess,projectFacts,savePrivateReport,functions} from './boq-access-audit.mjs';

const companyId='11111111-1111-4111-8111-111111111111',projectId='22222222-2222-4222-8222-222222222222';
const password='never-export-this-password',email='private-admin@example.invalid',session='z'.repeat(43),csrf='private-csrf-token';
function input(){
  const role=(id,codes,isActive=true)=>({id,companyId,roleCode:id.toUpperCase(),isActive,rolePermissions:codes.map(permissionCode=>({permission:{permissionCode}}))});
  const roles=[role('ben',['budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage']),role('nancy',['budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.approve']),role('khai',['budget.boq.view','budget.revision.view','budget.revision.approve']),role('old',['budget.customer.approve'],false)];
  const users=['ben','nancy','khai'].map((id,i)=>({id,employeeId:'e'+i,email:id+'@private.invalid',displayName:'PRIVATE PERSON',isActive:true,passwordHash:'PRIVATE HASH',salary:999,userRoles:[{role:{id}},{role:{id:'old'}}]}));
  const employees=users.map(u=>({id:u.employeeId,employeeName:'PRIVATE PERSON'}));
  const members=users.map(u=>({employeeId:u.employeeId,isActive:true,employee:{salary:999}}));
  const workflow=(entityType,id,roleId)=>({id,companyId,workflowCode:id,isActive:true,entityType,description:'PRIVATE WORKFLOW NOTES',steps:[{stepNo:1,requiredApprovals:1,stepRoles:[{role:{id:roleId,roleCode:roleId.toUpperCase(),isActive:true}}]}]});
  return {project:{id:projectId,companyId,contractValue:'PRIVATE MONEY'},users,roles,employees,members,workflows:[workflow('BUDGET_REVISION','INTERNAL','khai'),workflow('CUSTOMER_BOQ','CUSTOMER','nancy'),workflow('PAYMENT','FINANCE','nancy')]};
}
const emails={BEN:'ben@private.invalid',NANCY:'nancy@private.invalid',KHAIMOOK:'khai@private.invalid'};
function observations(data=input()){return Object.fromEntries(Object.entries(data).map(([k,v])=>[k,{status:200,data:v}]));}
async function serverTest(fn,{overrides={},wrongCompany=false,redirect=false}={}){
  const calls=[],data=input();
  const server=createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    calls.push({method:req.method,path:req.url,body,headers:req.headers});
    if(req.url==='/api/v1/auth/login'){
      if(redirect){res.writeHead(302,{Location:'/must-not-follow'});res.end();return;}
      res.writeHead(201,{'Content-Type':'application/json','Set-Cookie':'erp_session='+session+'; HttpOnly'});res.end(JSON.stringify({data:{csrfToken:csrf}}));return;
    }
    if(req.url==='/api/v1/auth/logout'){assert.equal(req.headers['x-csrf-token'],csrf);res.writeHead(204);res.end();return;}
    assert.equal(req.headers.cookie,'erp_session='+session);
    const routes={'/auth/me':{companyId:wrongCompany?projectId:companyId},['/projects/'+projectId]:data.project,'/admin/users':data.users,'/admin/roles':data.roles,'/admin/user-employee-options':data.employees,['/projects/'+projectId+'/members']:data.members,'/admin/approval-workflows':data.workflows};
    const route=req.url.replace('/api/v1',''),override=overrides[route];
    res.writeHead(override?.status??200,{'Content-Type':'application/json'});res.end(JSON.stringify({data:override?.data??routes[route]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{return await fn({baseUrl:'http://127.0.0.1:'+server.address().port+'/api/v1',calls});}
  finally{await new Promise(resolve=>server.close(resolve));}
}
const capture=options=>collectAccess({companyId,projectId,adminEmail:email,adminPassword:password,emails,...options});

test('real HTTP collector uses only fixed metadata GETs and authentication writes, redacts source data and logs out',async()=>serverTest(async({baseUrl,calls})=>{
  const report=await capture({baseUrl});
  assert.equal(report.status,'READ_ONLY_FACTS_REVIEW_REQUIRED');assert.equal(report.logoutHttpStatus,204);
  assert.deepEqual(calls.filter(c=>c.method!=='GET').map(c=>c.path),['/api/v1/auth/login','/api/v1/auth/logout']);
  assert.equal(calls.filter(c=>c.method==='GET').length,7);
  assert.deepEqual(JSON.parse(calls[0].body),{email,password});
  assert.ok(calls.slice(1).every(c=>!c.body.includes(password)));
  assert.deepEqual(report.actors[0].permissions,['budget.boq.view','budget.customer.manage','budget.customer.view','budget.revision.view']);
  assert.equal(report.actors[0].projectScope,'ASSIGNED');assert.deepEqual(report.workflows.map(w=>w.steps[0].mappedCandidates),[['KHAIMOOK'],['NANCY']]);
  const text=JSON.stringify(report);for(const secret of [password,email,session,csrf,'@private.invalid','PRIVATE PERSON','PRIVATE HASH','PRIVATE MONEY','PRIVATE WORKFLOW NOTES','salary'])assert.equal(text.includes(secret),false,secret);
  assert.equal(report.runtimeCommit,null);assert.equal(report.businessWrites,false);assert.equal(report.configurationWrites,false);assert.equal(report.humanAcceptance,false);assert.equal(report.productionAuthorized,false);
}));

test('unsafe URL/scope is rejected before transmitting any credentials',async()=>{
  for(const baseUrl of ['http://example.invalid:3001/api/v1','https://127.0.0.1:3001/api/v1','http://localhost:3001/api/v1','http://user:password@127.0.0.1:3001/api/v1','http://127.0.0.1:3001/api/v1/','http://127.0.0.1:3001/api/v1?x=1','http://127.0.0.1:3001/api/v1#x'])await assert.rejects(capture({baseUrl,fetchImpl:()=>{assert.fail('Credentials sent');}}),/INVALID_TARGET/);
  await assert.rejects(capture({baseUrl:'http://127.0.0.1:3001/api/v1',projectId:'../roles',fetchImpl:()=>assert.fail('Credentials sent')}),/INVALID_SCOPE/);
});

test('login redirects are never followed',async()=>serverTest(async({baseUrl,calls})=>{
  await assert.rejects(capture({baseUrl}));assert.equal(calls.length,1);assert.equal(calls[0].path,'/api/v1/auth/login');
},{redirect:true}));

test('wrong authenticated Company stops metadata reads and still logs out',async()=>serverTest(async({baseUrl,calls})=>{
  await assert.rejects(capture({baseUrl}),/WRONG_COMPANY/);assert.deepEqual(calls.map(c=>c.path),['/api/v1/auth/login','/api/v1/auth/me','/api/v1/auth/logout']);
},{wrongCompany:true}));

test('a denied metadata read remains UNVERIFIED rather than a fabricated empty permission union',async()=>serverTest(async({baseUrl})=>{
  const report=await capture({baseUrl});assert.equal(report.observations.roles.httpStatus,403);assert.equal(report.actors[0].status,'ROLE_DEFINITIONS_UNVERIFIED');assert.equal(report.actors[0].permissions,null);
},{overrides:{'/admin/roles':{status:403,data:[]}}}));

test('foreign Project or Company configuration cannot enter a report',()=>{
  for(const field of ['roles','workflows','project']){const source=observations();if(field==='project')source.project.data.companyId=projectId;else source[field].data[0].companyId=projectId;
    assert.throws(()=>projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'}),/FOREIGN_/);}
});

test('permission counts, incomplete roles and inactive users are never authority; aliases are explicit',()=>{
  const source=observations();delete source.roles.data[0].rolePermissions;source.roles.data[0].permissionCount=99;source.users.data[1].isActive=false;
  const report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});
  assert.equal(report.actors[0].permissions,null);assert.equal(report.actors[1].projectScope,'DENIED');assert.equal(report.actors.find(a=>a.function==='JAI').status,'ALIAS_NOT_SUPPLIED');assert.deepEqual(report.workflows[1].steps[0].mappedCandidates,[]);
});

test('Project membership unknown differs from explicit access_all and never implies business approval',()=>{
  const source=observations();source.members={status:403,data:null};
  let report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});assert.equal(report.actors[0].projectScope,'UNVERIFIED');
  source.roles.data[0].rolePermissions.push({permission:{permissionCode:'projects.access_all'}});
  report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});assert.equal(report.actors[0].projectScope,'ACCESS_ALL');assert.deepEqual(report.workflows[1].steps[0].mappedCandidates,[]);
});

test('private report output is exclusive mode0600 and rejects loose/symlink/repository destinations',async()=>{
  const temp=await mkdtemp(join(os.tmpdir(),'boq-config-audit-'));
  try{
    const report={status:'PRIVATE_FACTS'},file=await savePrivateReport(report,join(temp,'private'));assert.equal((await stat(file)).mode&0o777,0o600);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),report);
    await mkdir(join(temp,'loose'),{mode:0o755});await assert.rejects(savePrivateReport(report,join(temp,'loose')),/PRIVATE_DIRECTORY/);assert.deepEqual(await readdir(join(temp,'loose')),[]);
    await symlink(join(temp,'private'),join(temp,'alias'));await assert.rejects(savePrivateReport(report,join(temp,'alias')),/PRIVATE_DIRECTORY/);
    await assert.rejects(savePrivateReport(report,new URL('../../',import.meta.url).pathname),/PUBLIC_REPOSITORY/);
  }finally{await rm(temp,{recursive:true,force:true});}
});


test('missing scope or step metadata stays unverified rather than foreign or empty configuration',()=>{
  const source=observations();delete source.project.data.companyId;delete source.roles.data[0].companyId;delete source.workflows.data[0].steps;delete source.workflows.data[1].companyId;
  const report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});
  assert.equal(report.actors[0].projectScope,'UNVERIFIED');assert.equal(report.actors[0].permissions,null);
  assert.equal(report.workflows[0].status,'STEP_DEFINITIONS_UNVERIFIED');assert.equal(report.workflows[1].status,'COMPANY_SCOPE_UNVERIFIED');assert.deepEqual(report.workflows[1].steps[0].mappedCandidates,[]);
});


test('partial actor/employee/member row shapes do not fabricate absent users or denied membership',()=>{
  const source=observations();delete source.users.data[0].employeeId;source.employees.data=[{count:3}];source.members.data=[{employeeId:'e0'}];
  let report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});assert.equal(report.actors[0].activeEmployee,null);assert.equal(report.actors[0].activeProjectMember,null);assert.equal(report.actors[0].projectScope,'UNVERIFIED');
  source.users.data=[{count:3}];report=projectFacts({companyId,projectId,emails,observations:source,generatedAt:'test'});assert.equal(report.actors[0].status,'USERS_UNVERIFIED');
});
