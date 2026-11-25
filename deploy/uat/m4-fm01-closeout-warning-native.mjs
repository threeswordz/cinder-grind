// Actual HTTP weekly stale-review and warned closeout controls. Disposable only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const apiRequire=createRequire(path.join(ROOT,'apps/api/package.json'));
const dbUrl=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(dbUrl.hostname));
assert.equal(dbUrl.port,'5432');
assert.equal(dbUrl.pathname,'/erp_m4_fm01_closeout_warning');
const API='http://127.0.0.1:31363';
const tmp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-closeout-warning-'));
process.env.STORAGE_ROOT=path.join(tmp,'documents');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(tmp,'uploads');
const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {CLOSEOUT_CATEGORIES}=apiRequire('./dist/projects/project-closeout-contract.js');
const app=await NestFactory.create(AppModule,{logger:['warn','error']});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31363,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService);
async function call(actor,method,pathname,body){
 const headers={Cookie:'erp_session='+actor.token};
 if(method==='POST')Object.assign(headers,{
  'x-csrf-token':actor.csrf,'Content-Type':'application/json',
 });
 const response=await fetch(API+'/api/v1'+pathname,{
  method,headers,...(method==='POST'?{body:JSON.stringify(body??{})}:{})
 });
 const raw=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error('M4_03_SETUP_API_'+method+'_'+pathname+
  '_'+response.status+'_'+(raw.code??'UNKNOWN'));
 return raw.data;
}
async function run(){
 const key=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'M4F-'+key,companyName:'Disposable M4 browser company',
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'C-'+key,customerName:'Synthetic customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,projectCode:'P-'+key,
  projectName:'Synthetic no-work and closeout site',contractValue:'1000',
  plannedStartDate:new Date('2026-11-01'),
  plannedCompletionDate:new Date('2027-12-31'),
 }});
 const perms=[
  'site.daily_report.create','site.daily_report.edit',
  'site.daily_report.submit','site.daily_report.view',
  'projects.project.view','projects.project.edit',
 ];
 const ids=new Map();
 for(const code of perms){
  const v=await db.permission.upsert({where:{permissionCode:code},
   update:{},create:{permissionCode:code,
    moduleCode:code.slice(0,code.indexOf('.')).toUpperCase()}});
  ids.set(code,v.id);
 }
 async function actor(label,roleCode,codes){
  const employee=await db.employee.create({data:{companyId:company.id,
   employeeCode:label+key,employeeName:'Synthetic '+label}});
  const user=await db.user.create({data:{companyId:company.id,
   employeeId:employee.id,email:label.toLowerCase()+'-'+key+'@example.invalid',
   displayName:label,passwordHash:'not-a-login'}});
  const role=(await db.role.findFirst({where:{companyId:company.id,roleCode}}))??
   await db.role.create({data:{companyId:company.id,
    roleCode,roleName:roleCode}});
  await db.rolePermission.createMany({data:codes.map(code=>({
   roleId:role.id,permissionId:ids.get(code)})),skipDuplicates:true});
  await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:employee.id,projectRole:roleCode}});
  const live=await sessions.create(user.id);
  return {id:user.id,token:live.sessionToken,csrf:live.csrfToken,
   sessionId:live.sessionId};
 }
 const foreman=await actor('Foreman','PROJECT_ENGINEER',[
  'site.daily_report.create','site.daily_report.edit',
  'site.daily_report.submit','site.daily_report.view']);
 const pm=await actor('Khaimook','PROJECT_MANAGER',[
  'projects.project.view','projects.project.edit','site.daily_report.view']);
 const ben=await actor('Ben','MANAGEMENT',[
  'projects.project.view','site.daily_report.view']);
 const nancy=await actor('Nancy','FINANCE_MANAGER',['projects.project.view']);
 const beforeStock=await db.stockTransaction.count({where:{companyId:company.id}});
 const beforeFinance=await db.directCostPosting.count({where:{companyId:company.id}});
 const calendar=await db.workingCalendar.create({data:{
  companyId:company.id,projectId:project.id,
  calendarName:'Explicit workdays, not calendar assumptions',
  timezoneName:'Asia/Singapore',isDefault:true,
 }});
 await db.workingCalendarWeekday.createMany({data:
  Array.from({length:7},(_,i)=>({workingCalendarId:calendar.id,
   weekdayNo:i+1,isWorking:true}))});
 const report=await call(foreman,'POST','/site-execution/reports',{
  projectId:project.id,reportDate:'2026-11-23',manpower:[],
  materialUsage:[],equipmentUsage:[],progress:[],issues:[],delays:[],inspections:[],
 });
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/no-work',{
  reason:'No work due to site access restriction',
 });
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/submit',{});
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/no-work/corrections',{
  reason:'Updated access closure details',
 });
 const week='/site-execution/reports/weekly';
 const window={projectId:project.id,from:'2026-11-23',to:'2026-11-29'};
 const getWeek=()=>call(ben,'GET',week+'?'+new URLSearchParams(window));
 const ack=week+'/acknowledge';
 const count=()=>db.auditLog.count({where:{companyId:company.id}});
 async function deny(actor,url,body,status,code){
  const before=await count();
  const r=await fetch(API+'/api/v1'+url,{method:'POST',headers:{Cookie:'erp_session='+actor.token,'x-csrf-token':actor.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.status,status,url);assert.equal((await r.json()).code,code,url);
  assert.equal(await count(),before);
 }
 const first=await getWeek();
 const firstHash=first.reviewFingerprint;
 assert.match(firstHash,/^[a-f0-9]{64}$/);
 await deny(foreman,ack,{...window,expectedFingerprint:firstHash},403,'WEEKLY_BEN_REVIEW_DENIED');
 await call(ben,'POST',ack,{...window,expectedFingerprint:firstHash});
 assert.equal((await getWeek()).reviewAcknowledgment.status,'CURRENT');
 await call(foreman,'POST','/site-execution/reports/'+report.id+'/no-work/corrections',{reason:'Further documented site access correction'});
 const stale=await getWeek();
 assert.equal(stale.reviewAcknowledgment.status,'STALE');
 assert.notEqual(stale.reviewFingerprint,firstHash);
 await deny(ben,ack,{...window,expectedFingerprint:firstHash},409,'WEEKLY_SOURCE_CHANGED');
 await call(ben,'POST',ack,{...window,expectedFingerprint:stale.reviewFingerprint});
 assert.equal((await getWeek()).reviewAcknowledgment.status,'CURRENT');
 await deny(ben,ack,{...window,expectedFingerprint:stale.reviewFingerprint},409,'WEEKLY_ALREADY_ACKNOWLEDGED');
 console.log('M4_FM01_REAL_HTTP_CORRECTION_INVALIDATES_OLD_REVIEW_AND_DUPLICATE_DENIAL_PASS');
 const closeout='/projects/'+project.id+'/closeout';
 const checklist=CLOSEOUT_CATEGORIES.map(category=>({category,state:category==='AP_AR_PAYMENTS'?'WARNING':'CLEAR',evidenceNote:'Synthetic evidence reviewed for '+category,evidenceReference:'SOURCE-'+category}));
 const item={category:'AP_AR_PAYMENTS',description:'Outstanding supplier payment reconciliation',reason:'Invoice reconciliation remains open',ownerUserId:nancy.id,dueDate:'2026-12-15',remainingAmount:'1234.56',remainingQuantity:null,quantityUom:null,notQuantifiableReason:null};
 const input={checklist,outstandingItems:[item],overallNote:'Operational closure only; supplier reconciliation remains open',expectedFingerprint:null};
 await deny(pm,closeout+'/prepare',{...input,outstandingItems:[]},422,'BEN04_WARNING_NEEDS_FOLLOWUP');
 await deny(pm,closeout+'/prepare',{...input,outstandingItems:[{...item,ownerUserId:randomUUID()}]},422,'BEN04_OWNER_SCOPE_INVALID');
 const prepared=await call(pm,'POST',closeout+'/prepare',input);
 assert.equal(prepared.status,'PREPARED');
 const hash=prepared.current.fingerprint;
 await deny(ben,closeout+'/sign',{expectedFingerprint:hash,note:''},422,'BEN04_SIGN_NOTE_INVALID');
 await call(ben,'POST',closeout+'/sign',{expectedFingerprint:hash,note:'Ben acknowledges unresolved reconciliation'});
 await deny(nancy,closeout+'/sign',{expectedFingerprint:hash,note:''},422,'BEN04_SIGN_NOTE_INVALID');
 const joint=await call(nancy,'POST',closeout+'/sign',{expectedFingerprint:hash,note:'Nancy acknowledges amount remains outstanding'});
 assert.equal(joint.status,'JOINTLY_APPROVED');assert.deepEqual(joint.current.preparation.outstandingItems,[item]);
 assert.ok(joint.current.signatures.BEN);assert.ok(joint.current.signatures.NANCY);
 assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).isActive,true);
 assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),beforeStock);
 assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),beforeFinance);
 console.log('M4_BEN04_PM16_ACTUAL_WARNED_CLOSEOUT_OWNER_NOTE_AND_OUTSTANDING_BALANCE_PRESERVED_PASS');
}
try{await run();}finally{await app.close();await rm(tmp,{recursive:true,force:true});}
