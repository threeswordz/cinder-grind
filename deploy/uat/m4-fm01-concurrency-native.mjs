// Isolated native proof of FM01 concurrent draft update vs no-work declaration.
// This file is test-only, NEVER touches retained Company/Project or Production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import test from 'node:test';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const api=requireFromApi();
function requireFromApi(){return createRequire(path.join(root,'apps/api/package.json'));}
const {PrismaService}=api('./dist/prisma/prisma.service.js');
const {SiteExecutionService}=api('./dist/site-execution/site-execution.service.js');
const {ProjectAccessService}=api('./dist/projects/project-access.service.js');
const {AuthorizationService}=api('./dist/authorization/authorization.service.js');
const {ProjectScopeService}=api('./dist/authorization/project-scope.service.js');
const {AuditService}=api('./dist/audit/audit.service.js');
api('reflect-metadata');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
const url=new URL(process.env.DATABASE_URL??'https://invalid.invalid');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/erp_m4_fm01_race');
assert.equal(url.port,'5432');

test('Serializable update cannot overtake immutable Foreman no-work declaration',async()=>{
 const prisma=new PrismaService();
 await prisma.$connect();
 let release;
 try{
  const token=randomUUID().slice(0,8);
  const company=await prisma.company.create({data:{companyCode:'FMR-'+token,companyName:'Disposable FM01 race company'}});
  const customer=await prisma.customer.create({data:{companyId:company.id,customerCode:'C-'+token,customerName:'Disposable customer'}});
  const project=await prisma.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'P-'+token,
    projectName:'Disposable FM01 source',contractValue:'1000',plannedStartDate:new Date('2026-11-01'),plannedCompletionDate:new Date('2027-12-31')}});
  const employee=await prisma.employee.create({data:{companyId:company.id,employeeCode:'E-'+token,employeeName:'Foreman test'}});
  const user=await prisma.user.create({data:{companyId:company.id,employeeId:employee.id,
    email:'fmr-'+token+'@example.invalid',displayName:'Foreman',passwordHash:'not-a-password'}});
  await prisma.projectMember.create({data:{projectId:project.id,employeeId:employee.id,projectRole:'PROJECT_ENGINEER'}});
  const calendar=await prisma.workingCalendar.create({data:{companyId:company.id,projectId:project.id,
    calendarName:'Explicit all workdays',timezoneName:'Asia/Singapore',isDefault:true}});
  await prisma.workingCalendarWeekday.createMany({data:Array.from({length:7},(_,i)=>({
    workingCalendarId:calendar.id,weekdayNo:i+1,isWorking:true}))});
  const ctx={auth:{sessionId:randomUUID(),userId:user.id,companyId:company.id,
    email:user.email,displayName:user.displayName,roleCodes:['PROJECT_ENGINEER'],
    permissions:['site.daily_report.create','site.daily_report.edit','site.daily_report.submit','site.daily_report.view'],
    csrfTokenHash:'0'.repeat(64)}};
  const access=new ProjectAccessService(prisma,new ProjectScopeService(new AuthorizationService()));
  const service=new SiteExecutionService(prisma,access,new AuditService(prisma),{});
  const report=await service.create(ctx,{projectId:project.id,reportDate:new Date('2026-11-23T00:00:00.000Z'),
    manpower:[],materialUsage:[],equipmentUsage:[],progress:[],issues:[],delays:[],inspections:[]});
  assert.equal(report.status,'DRAFT');
  let reached;
  const pause=new Promise(ok=>{reached=ok;});
  const hold=new Promise(ok=>{release=ok;});
  let once=true;
  const native=service.noWorkEvents.bind(service);
  service.noWorkEvents=async(...args)=>{
    const records=await native(...args);
    if(once){once=false;reached();await hold;}
    return records;
  };
  // First update reads no no-work audit events within its serializable snapshot,
  // then freezes precisely before attempting to mutate the report date.
  const attempted=service.update(ctx,report.id,{
    reportDate:new Date('2026-11-24T00:00:00.000Z'),
    generalRemarks:'Concurrent draft update must not survive the audit declaration'});
  await Promise.race([pause,new Promise((_,reject)=>setTimeout(()=>reject(Error('UPDATE_DID_NOT_REACH_AUDIT_READ')),12000))]);
  // Declaration commits while update remains paused inside its old snapshot.
  const declaration=await service.declareNoWork(ctx,report.id,'Site access restricted; no planned operations today');
  assert.equal(declaration.noWork.reason,'Site access restricted; no planned operations today');
  release();
  const result=await attempted.then(value=>({ok:true,value}),error=>({ok:false,error}));
  assert.equal(result.ok,false,'stale concurrent report edit must abort');
  assert.ok(result.error?.code==='P2034'||result.error?.response?.code==='NO_WORK_CANNOT_RECORD_WORK',
    'stale edit must reject with a controlled serializable conflict: '+String(result.error?.code??result.error?.message));
  const persisted=await prisma.dailySiteReport.findUniqueOrThrow({where:{id:report.id}});
  assert.equal(persisted.reportDate.toISOString().slice(0,10),'2026-11-23');
  assert.notEqual(persisted.generalRemarks,'Concurrent draft update must not survive the audit declaration');
  // A fresh read now sees the actual immutable source and fails closed.
  await assert.rejects(()=>service.update(ctx,report.id,{
    reportDate:new Date('2026-11-24T00:00:00.000Z')}),error=>
       error?.response?.code==='NO_WORK_CANNOT_RECORD_WORK');
  const retained=await service.get(ctx.auth,report.id);
  assert.equal(retained.noWork.reason,'Site access restricted; no planned operations today');
  console.log('FM01_NATIVE_SERIALIZABLE_INTERLEAVING_NO_WORK_PREVAILS_PASS');
 }finally{
  if(release)release();
  await prisma.$disconnect();
 }
});
