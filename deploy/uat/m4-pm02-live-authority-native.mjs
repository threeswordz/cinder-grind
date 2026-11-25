// PM02 distinct live authority revocation test. Actual HTTP, NestJS, PG17; disposable only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const apiRequire=createRequire(path.join(ROOT,'apps/api/package.json'));
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,'/erp_m4_pm02_live_authority');
const API='http://127.0.0.1:31362';
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-pm02-live-'));
process.env.STORAGE_ROOT=path.join(temp,'docs');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(temp,'uploads');
const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const app=await NestFactory.create(AppModule,{logger:['warn','error']});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31362,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
async function apiCall(actor,method,path,body){
 const headers={Cookie:'erp_session='+actor.token};
 if(method!=='GET')Object.assign(headers,{
  'x-csrf-token':actor.csrf,'Content-Type':'application/json',
 });
 const r=await fetch(API+'/api/v1'+path,{method,headers,
  ...(method!=='GET'?{body:JSON.stringify(body??{})}:{})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error('PM02_SETUP_REAL_API_'+method+'_'+path+'_HTTP_'+r.status+
  '_'+(data.code??'UNKNOWN'));
 return data.data;
}
async function run(){
 const key=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'PM02BR-'+key,companyName:'PM02 Browser Disposable',
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'C-'+key,customerName:'Disposable customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,projectCode:'PM02SITE-'+key,
  projectName:'PM02 synthetic site',contractValue:'100000',
  plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31'),
 }});
 const uom=await db.unitOfMeasure.create({data:{
  companyId:company.id,uomCode:'EA-'+key,uomName:'Each',decimalPlaces:2,
 }});
 const perms=['procurement.pr.view','procurement.pr.manage',
  'procurement.pr.submit','procurement.pr.approve'];
 const ids=new Map();
 for(const code of perms){
  const row=await db.permission.upsert({where:{permissionCode:code},update:{},
   create:{permissionCode:code,moduleCode:'PROCUREMENT'}});
  ids.set(code,row.id);
 }
 async function actor(label,roleCode,grants){
  const emp=await db.employee.create({data:{
   companyId:company.id,employeeCode:'P'+label+key,employeeName:'Synthetic '+label,
  }});
  const user=await db.user.create({data:{
   companyId:company.id,employeeId:emp.id,
   email:label.toLowerCase()+'-'+key+'@example.invalid',displayName:label,
   passwordHash:'not-a-login',
  }});
  const role=await db.role.create({data:{
   companyId:company.id,roleCode,roleName:roleCode,
  }});
  await db.rolePermission.createMany({data:grants.map(code=>({
   roleId:role.id,permissionId:ids.get(code),
  }))});
  await db.userRole.create({data:{
   companyId:company.id,userId:user.id,roleId:role.id,
  }});
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:emp.id,projectRole:roleCode,
  }});
  const session=await sessions.create(user.id);
  return {id:user.id,token:session.sessionToken,csrf:session.csrfToken,
   roleId:role.id,roleCode,employeeId:emp.id,sessionId:session.sessionId};
 }
 const store=await actor('Store','STOREKEEPER',
  ['procurement.pr.view','procurement.pr.manage','procurement.pr.submit']);
 const pm=await actor('Khaimook','PROJECT_MANAGER',
  ['procurement.pr.view','procurement.pr.approve']);
 await db.numberSequence.create({data:{
  companyId:company.id,entityType:'PURCHASE_REQUEST',
  sequenceCode:'PURCHASE_REQUEST',formatTemplate:'PRYYMM-###',
  resetRule:'MONTHLY',
 }});
 const workflow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PM02BR-'+key,workflowName:'Khaimook single review',
  entityType:'PURCHASE_REQUEST',
  steps:{create:[{stepNo:1,stepName:'PM Review',requiredApprovals:1,
   stepRoles:{create:[{roleId:pm.roleId}]}}]},
 }});

 // Separate real CSRF-protected API setup. The actual decision and correction
 // actions below MUST originate in authenticated browser React controls.
 const request=await apiCall(store,'POST',
  '/procurement/projects/'+project.id+'/purchase-requests',
  {remarks:'PM02 browser mixed A/B decisions'});
 const first=await apiCall(store,'POST',
  '/procurement/purchase-requests/'+request.id+'/lines',
  {lineType:'SERVICE',description:'Approved concrete browser A',
   quantity:'1',uomId:uom.id});
 const second=await apiCall(store,'POST',
  '/procurement/purchase-requests/'+request.id+'/lines',
  {lineType:'SERVICE',description:'Returned transport browser B',
   quantity:'2',uomId:uom.id});
 await apiCall(store,'POST','/procurement/purchase-requests/'+request.id+'/submit',
  {workflowCode:workflow.workflowCode});

 const root='/procurement/purchase-requests/'+request.id;
 const submitted=await apiCall(pm,'GET',root);
 const approvalId=submitted.approvalInstanceId;
 assert.ok(approvalId);
 assert.equal(submitted.lifecycleState,'SUBMITTED');
 const decision={expectedApprovalInstanceId:approvalId,decisions:[{lineId:first.id,decision:'APPROVED'},{lineId:second.id,decision:'RETURNED',reason:'Correct transport quantity'}]};
 const snapshot=async()=>({request:await db.purchaseRequest.findUniqueOrThrow({where:{id:request.id},include:{lines:{orderBy:{lineNo:'asc'}},approvalInstance:true}}),actions:await db.approvalAction.count({where:{approvalInstanceId:approvalId}}),audit:await db.auditLog.count({where:{companyId:company.id,entityType:'PURCHASE_REQUEST',entityId:request.id}}),corrections:await db.purchaseRequest.count({where:{sourceRequestId:request.id}})});
 const before=await snapshot();
 async function deny(actor,status,code,body=decision){
  const r=await fetch(API+'/api/v1'+root+'/decide-lines',{method:'POST',headers:{Cookie:'erp_session='+actor.token,'X-CSRF-Token':actor.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.status,status);assert.equal((await r.json()).code,code);assert.deepEqual(await snapshot(),before);
 }
 // Same cookie and previously fetched exact decision cannot survive revocation.
 await db.projectMember.updateMany({where:{projectId:project.id,employeeId:pm.employeeId},data:{isActive:false}});
 await deny(pm,403,'PROJECT_ACCESS_DENIED');
 await db.projectMember.updateMany({where:{projectId:project.id,employeeId:pm.employeeId},data:{isActive:true}});
 await db.rolePermission.deleteMany({where:{roleId:pm.roleId,permissionId:ids.get('procurement.pr.approve')}});
 await deny(pm,403,'PERMISSION_DENIED');
 await db.rolePermission.create({data:{roleId:pm.roleId,permissionId:ids.get('procurement.pr.approve')}});
 await sessions.revoke(pm.sessionId);
 await deny(pm,401,'INVALID_SESSION');
 console.log('M4_PM02_ACTUAL_STALE_SESSION_PROJECT_AND_PERMISSION_REVOKED_DENIED_PASS');
 const renewed=await sessions.create(pm.id);
 const valid={...pm,token:renewed.sessionToken,csrf:renewed.csrfToken};
 await deny(valid,409,'PR_LINE_REVIEW_STALE_INSTANCE',{...decision,expectedApprovalInstanceId:randomUUID()});
 const reviewed=await apiCall(valid,'POST',root+'/decide-lines',decision);
 assert.equal(reviewed.lifecycleState,'APPROVED');assert.equal(reviewed.lines.find(x=>x.id===first.id)?.reviewDecision,'APPROVED');assert.equal(reviewed.lines.find(x=>x.id===second.id)?.reviewDecision,'RETURNED');
 const after=await snapshot();assert.equal(after.actions,1);
 const replay=await fetch(API+'/api/v1'+root+'/decide-lines',{method:'POST',headers:{Cookie:'erp_session='+valid.token,'X-CSRF-Token':valid.csrf,'Content-Type':'application/json'},body:JSON.stringify(decision)});
 assert.equal(replay.status,409);assert.deepEqual(await snapshot(),after);
 const corrected=await apiCall(store,'POST',root+'/copy-returned',{remarks:'Correct returned demand'});
 assert.equal(corrected.sourceRequestId,request.id);
 const copied=await db.purchaseRequest.findUniqueOrThrow({where:{id:corrected.id},include:{lines:true}});
 assert.equal(copied.lines.length,1);assert.equal(copied.lines[0].correctionSourceLineId,second.id);
 const original=await db.purchaseRequest.findUniqueOrThrow({where:{id:request.id},include:{lines:{orderBy:{lineNo:'asc'}},approvalInstance:true}});
 assert.deepEqual(original,after.request);
 console.log('M4_PM02_ACTUAL_RENEWED_AUTH_STALE_INSTANCE_REPLAY_AND_IMMUTABLE_CORRECTION_PASS');
}
try{await run();}finally{await app.close();await rm(temp,{recursive:true,force:true});}
