import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {SessionService} from '../auth/session.service';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {securityHeadersMiddleware} from '../common/security-headers';
import {PrismaService} from '../prisma/prisma.service';
import {CLOSEOUT_CATEGORIES} from './project-closeout-contract';

// This source contains NO generic database teardown. Only run against a fresh
// CI-only PostgreSQL service explicitly named for this exact test.
const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
if(process.env.M4_NON_PRODUCTION_CONFIRMED!=='YES'||
  !['localhost','127.0.0.1'].includes(target.hostname)||
  target.pathname!=='/erp_m4_weekly_closeout')throw Error('M4_FM01_BEN04_DISPOSABLE_DB_ONLY');
type Actor={id:string;sessionId:string;token:string;csrf:string};
type Read<T>={status:number;data:T;raw:unknown};
const values=async<T=any>(r:Response):Promise<Read<T>>=>{
 const raw:any=await r.json().catch(()=>({}));
 return {status:r.status,data:raw.data as T,raw};
};
test('M4 actual HTTP/PostgreSQL FM01 weekly calendar and BEN04 closeout with independent actors',async()=>{
 const prior=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'m4-fm01-ben04-'));
 process.env.STORAGE_ROOT=storage;
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');
 app.use(securityHeadersMiddleware(false));
 app.useGlobalFilters(new ProblemDetailsFilter());
 await app.listen(0,'127.0.0.1');
 const db=app.get(PrismaService),sessions=app.get(SessionService);
 try{
  const base=(await app.getUrl())+'/api/v1',key=randomUUID().slice(0,8);
  const company=await db.company.create({data:{companyCode:'M4C-'+key,companyName:'Disposable FM01 BEN04'}});
  const foreignCompany=await db.company.create({data:{companyCode:'M4F-'+key,companyName:'Foreign test company'}});
  const customer=await db.customer.create({data:{companyId:company.id,customerCode:'C-'+key,customerName:'Synthetic'}});
  const otherCustomer=await db.customer.create({data:{companyId:foreignCompany.id,customerCode:'C-'+key,customerName:'Foreign'}});
  const fields={contractValue:'1000',plannedStartDate:new Date('2026-11-01'),plannedCompletionDate:new Date('2027-12-31')};
  const project=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'P-'+key,projectName:'Worksite FM01/closeout',...fields}});
  const wrong=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'X-'+key,projectName:'Other project',...fields}});
  const foreign=await db.project.create({data:{companyId:foreignCompany.id,customerId:otherCustomer.id,projectCode:'F-'+key,projectName:'Other Company Project',...fields}});
  const permissionCodes=[
   'site.daily_report.create','site.daily_report.edit','site.daily_report.submit','site.daily_report.view',
   'projects.project.view','projects.project.edit',
  ];
  const permissionIds=new Map<string,string>();
  for(const code of permissionCodes){
   const p=await db.permission.upsert({where:{permissionCode:code},update:{},
    create:{permissionCode:code,moduleCode:code.slice(0,code.indexOf('.')).toUpperCase()}});
   permissionIds.set(code,p.id);
  }
  async function actor(label:string,roleCode:string,codes:string[],projectScope:string):Promise<Actor>{
   const employee=await db.employee.create({data:{companyId:company.id,employeeCode:label+key,employeeName:'Synthetic '+label}});
   const user=await db.user.create({data:{companyId:company.id,employeeId:employee.id,
    email:label.toLowerCase()+'-'+key+'@example.invalid',displayName:label,passwordHash:'not-a-login'}});
   const role=(await db.role.findFirst({where:{companyId:company.id,roleCode}})) ??
    await db.role.create({data:{companyId:company.id,roleCode,roleName:roleCode}});
   await db.rolePermission.createMany({data:codes.map(code=>({roleId:role.id,permissionId:permissionIds.get(code)!})),skipDuplicates:true});
   await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
   await db.projectMember.create({data:{projectId:projectScope,employeeId:employee.id,projectRole:roleCode}});
   const session=await sessions.create(user.id);
   return {id:user.id,sessionId:session.sessionId,token:session.sessionToken,csrf:session.csrfToken};
  }
  const foreman=await actor('Foreman','PROJECT_ENGINEER',[
   'site.daily_report.create','site.daily_report.edit','site.daily_report.submit','site.daily_report.view',
  ],project.id);
  const alternativeForeman=await actor('AlternateForeman','PROJECT_ENGINEER',[
   'site.daily_report.create','site.daily_report.edit','site.daily_report.submit','site.daily_report.view',
  ],project.id);
  const pm=await actor('Khaimook','PROJECT_MANAGER',['projects.project.view','projects.project.edit','site.daily_report.view'],project.id);
  const ben=await actor('Ben','MANAGEMENT',['projects.project.view','site.daily_report.view'],project.id);
  const nancy=await actor('Nancy','FINANCE_MANAGER',['projects.project.view'],project.id);
  const outsider=await actor('Outsider','PROJECT_MANAGER',['projects.project.view','projects.project.edit','site.daily_report.view'],wrong.id);
  const request=async<T=any>(who:Actor,method:'GET'|'POST',path:string,input?:unknown):Promise<Read<T>>=>values<T>(await fetch(base+path,{
   method,headers:{Cookie:'erp_session='+who.token,
     ...(method==='POST'?{'x-csrf-token':who.csrf,'Content-Type':'application/json'}:{})},
   ...(method==='POST'?{body:JSON.stringify(input??{})}:{})
  }));
  const pass=async<T=any>(who:Actor,method:'GET'|'POST',path:string,input?:unknown,status=method==='GET'?200:201)=>{
   const out=await request<T>(who,method,path,input);
   assert.equal(out.status,status,method+' '+path+' '+JSON.stringify(out.raw));
   return out.data;
  };
  const reject=async(who:Actor,method:'GET'|'POST',path:string,input?:unknown)=>{
   const out=await request(who,method,path,input);
   assert.ok([400,401,403,404,409,422].includes(out.status),
    'Expected genuine refusal, not an application crash '+method+' '+path+' '+JSON.stringify(out.raw));
  };
  const closeout='/projects/'+project.id+'/closeout';
  const checklist=()=>CLOSEOUT_CATEGORIES.map(category=>({
   category,state:'CLEAR',evidenceNote:'Verified synthetic '+category+' source',
   evidenceReference:'SOURCE-'+category,
  }));
  const beforeFinance=await db.directCostPosting.count({where:{companyId:company.id}});
  const beforeStock=await db.stockTransaction.count({where:{companyId:company.id}});
  // BEN04: real row lock + 6 categories, separate Project manager, Ben and Nancy.
  await (async()=>{
   const input={checklist:checklist(),outstandingItems:[],overallNote:'Synthetic operational handover verified'};
   await reject(ben,'POST',closeout+'/prepare',input);
   await reject(outsider,'GET',closeout);
   await reject(ben,'GET','/projects/'+foreign.id+'/closeout');
   const prepared=await pass<{status:string;current:{fingerprint:string}}>(pm,'POST',closeout+'/prepare',input);
   assert.equal(prepared.status,'PREPARED');
   const fingerprint=prepared.current.fingerprint;
   // Temporarily give the actual preparer the eligible Ben reviewer role:
   // the denial must come from maker/checker, not missing role/permission.
   const benReviewerRole=await db.role.findFirstOrThrow({
    where:{companyId:company.id,roleCode:'MANAGEMENT'},
   });
   const syntheticDualRole=await db.userRole.create({
    data:{companyId:company.id,userId:pm.id,roleId:benReviewerRole.id},
   });
   try {
    const self=await request(pm,'POST',closeout+'/sign',{
     expectedFingerprint:fingerprint,note:'A dual-role maker cannot sign their own preparation',
    });
    assert.equal(self.status,403);
    assert.match(JSON.stringify(self.raw),/BEN04_SELF_APPROVAL_DENIED/);
   } finally {
    await db.userRole.delete({where:{id:syntheticDualRole.id}});
   }
   await pass(ben,'POST',closeout+'/sign',{expectedFingerprint:fingerprint,note:'Ben independently reviewed'});
   await reject(ben,'POST',closeout+'/sign',{expectedFingerprint:fingerprint,note:'Duplicate signer'});
   const approved=await pass<{status:string}>(nancy,'POST',closeout+'/sign',{
    expectedFingerprint:fingerprint,note:'Nancy independently reviewed'});
   assert.equal(approved.status,'JOINTLY_APPROVED');
   assert.equal((await db.project.findUniqueOrThrow({where:{id:project.id}})).isActive,true);
   // New preparation supersedes both old signatures; old fingerprint is invalid.
   const revised=await pass<{status:string;current:{version:number;fingerprint:string}}>(pm,'POST',closeout+'/prepare',{
    ...input,revisionReason:'Required new handover snapshot after earlier signoff'});
   assert.equal(revised.status,'PREPARED');
   assert.equal(revised.current.version,2);
   await reject(nancy,'POST',closeout+'/sign',{expectedFingerprint:fingerprint,note:'Old signature must fail'});
   await pass(ben,'POST',closeout+'/sign',{expectedFingerprint:revised.current.fingerprint,note:'New Ben review'});
   await pass(nancy,'POST',closeout+'/sign',{expectedFingerprint:revised.current.fingerprint,note:'New Nancy review'});
   console.log('M4_NATIVE_BEN04_CLOSEOUT_INDEPENDENT_PASS');
  })();
  // FM01: calendar is configured rather than assumed. A no-work report has
  // zero work, may only originate from original Foreman on a planned work day.
  await (async()=>{
   const calendar=await db.workingCalendar.create({data:{
    companyId:company.id,projectId:project.id,calendarName:'Explicit M4 weekdays',
    timezoneName:'Asia/Singapore',isDefault:true,
   }});
   await db.workingCalendarWeekday.createMany({data:Array.from({length:7},(_,index)=>({
    workingCalendarId:calendar.id,weekdayNo:index+1,isWorking:true,
   }))});
   const form={projectId:project.id,reportDate:'2026-11-23',
    manpower:[],materialUsage:[],equipmentUsage:[],progress:[],issues:[],delays:[],inspections:[]};
   await reject(pm,'POST','/site-execution/reports',form);
   const report=await pass<{id:string}>(foreman,'POST','/site-execution/reports',form);
   const path='/site-execution/reports/'+report.id;
   const wrongMaker=await request(alternativeForeman,'POST',path+'/no-work',{
    reason:'Another authorized Foreman cannot take over a draft'});
   assert.equal(wrongMaker.status,403);
   assert.match(JSON.stringify(wrongMaker.raw),/NO_WORK_ORIGINAL_FOREMAN_REQUIRED/);
   await pass(foreman,'POST',path+'/no-work',{reason:'No work due to unexpected site access'});
   await reject(foreman,'POST',path+'/no-work',{reason:'Duplicate no-work evidence'});
   await pass(foreman,'POST',path+'/submit',{});
   const wrongCorrector=await request(alternativeForeman,'POST',path+'/no-work/corrections',{
    reason:'Another Foreman cannot revise the submitted author history'});
   assert.equal(wrongCorrector.status,403);
   assert.match(JSON.stringify(wrongCorrector.raw),/NO_WORK_REASON_CORRECTION_DENIED/);
   await pass(foreman,'POST',path+'/no-work/corrections',{reason:'Updated access closure details'});
   await reject(foreman,'POST',path+'/no-work/corrections',{reason:'Updated access closure details'});
   const week='/site-execution/reports/weekly?projectId='+project.id+'&from=2026-11-23&to=2026-11-29';
   await reject(outsider,'GET',week);
   const summary=await pass<{reviewFingerprint:string;reviewAcknowledgment:{status:string};days:any[]}>(ben,'GET',week);
   assert.match(summary.reviewFingerprint,/^[a-f0-9]{64}$/);
   assert.equal(summary.reviewAcknowledgment.status,'NOT_REVIEWED');
   assert.ok(summary.days.some(day=>day.report?.id===report.id&&
    day.report?.noWork?.reason==='Updated access closure details'));
   const ack='/site-execution/reports/weekly/acknowledge';
   const body={projectId:project.id,from:'2026-11-23',to:'2026-11-29',expectedFingerprint:summary.reviewFingerprint};
   await reject(foreman,'POST',ack,body);
   await pass(ben,'POST',ack,body);
   await reject(ben,'POST',ack,body);
   const reviewed=await pass<{reviewAcknowledgment:{status:string;authority:string}}>(pm,'GET',week);
   assert.equal(reviewed.reviewAcknowledgment.status,'CURRENT');
   assert.equal(reviewed.reviewAcknowledgment.authority,'MANAGEMENT_REVIEW_ONLY_NOT_APPROVAL');
   assert.equal(await db.activityProgress.count({where:{companyId:company.id,projectId:project.id}}),0);
   console.log('M4_NATIVE_FM01_WEEKLY_NO_WORK_PASS');
  })();
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),beforeFinance);
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),beforeStock);
  console.log('M4_NATIVE_FM01_BEN04_SCOPED_PASS: real HTTP, separate actors and 0 inventory/Finance changes');
 }finally{
  await app.close();
  if(prior===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=prior;
  await rm(storage,{recursive:true,force:true});
 }
});
