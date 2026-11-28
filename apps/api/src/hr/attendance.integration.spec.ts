import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { securityHeadersMiddleware } from '../common/security-headers';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { PrismaService } from '../prisma/prisma.service';
import { hrFixture, hrFacts } from './hr-test-fixture';

test('HR-02 same-site attendance: actual HTTP, immutable snapshots and scoped replay', async t => {
  // Disposable fixture only; never run on an operational or retained DB.
  const savedKeys=process.env.HR_PRIVATE_KEYS, savedActive=process.env.HR_PRIVATE_ACTIVE_KEY_ID, savedStorage=process.env.STORAGE_ROOT;
  const dir=await mkdtemp(path.join(tmpdir(),'erp-attendance-'));
  process.env.STORAGE_ROOT=dir;
  process.env.HR_PRIVATE_KEYS=JSON.stringify({test1:randomBytes(32).toString('base64')});
  process.env.HR_PRIVATE_ACTIVE_KEY_ID='test1';
  const db=new PrismaService(); await db.$connect();
  const app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0,'127.0.0.1');
  try {
    const f=await hrFixture(db), a=f.actors;
    type Actor=typeof a.hr;
    const base=await app.getUrl()+'/api/v1';
    const route=(project:string)=>'/hr/projects/'+project+'/attendance/2026-11-16';
    const root=route(f.project.id);
    const call=async(actor:Actor|undefined,url:string,status:number,body?:unknown,csrf=true)=>{
      const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{
        ...(actor?{Cookie:'erp_session='+actor.session.sessionToken}:{}),
        ...(body===undefined?{}:{'Content-Type':'application/json'}),
        ...(actor&&csrf?{'x-csrf-token':actor.session.csrfToken}:{}),
      },...(body===undefined?{}:{body:JSON.stringify(body)})});
      assert.equal(r.status,status,await r.clone().text()); return await r.json() as any;
    };
    const grant=async(actor:Actor,code:string)=>{
      const permission=await db.permission.findUniqueOrThrow({where:{permissionCode:code}});
      return db.rolePermission.create({data:{roleId:actor.role.id,permissionId:permission.id}});
    };
    const financialCounts=()=>Promise.all([db.payment.count(),db.directCostPosting.count(),db.stockTransaction.count(),db.dailySiteReportManpower.count()]);
    const before=await financialCounts();
    const enrol={requestId:randomUUID(),expectedVersion:0,facts:hrFacts({projectId:f.project.id})};
    await call(a.hr,'/hr/companies/'+f.company.id+'/employees/'+f.legacy.id+'/employment',201,enrol);
    const row={employeeId:f.legacy.id,workDate:'2026-11-20',startMinute:480,endMinute:720,workType:'Site work'};
    const create={requestId:randomUUID(),expectedVersion:0,action:'CREATE',lines:[row]};
    await t.test('definitions alone grant no access; explicit synthetic grants and CSRF only',async()=>{
      await call(undefined,root,401);
      await call(a.store,root,404);
      await call(a.admin,root,404,create);
      await grant(a.store,'hr.attendance.site.view');
      await grant(a.store,'hr.attendance.site.manage');
      await grant(a.hr,'hr.attendance.review');
      await grant(a.hr,'hr.attendance.correct');
      await call(a.store,root,403,create,false);
      await call(a.store,route(f.foreignProject.id),404,create);
      await call(a.store,route(f.unassigned.id),403,create);
      await call(a.foreman,root,404);
    });
    let batchId='';
    await t.test('creation, same request replay and salary-free readback',async()=>{
      await call(a.store,root,422,{...create,lines:[{...row,workDate:'2026-11-15'}]});
      await call(a.store,root,404,{...create,lines:[{...row,employeeId:randomUUID()}]});
      const result=await call(a.store,root,201,create); batchId=result.data.id;
      assert.deepEqual((await call(a.store,root,201,create)).data,result.data);
      await call(a.store,root,409,{...create,lines:[{...row,endMinute:721}]});
      const view=(await call(a.store,root,200)).data;
      assert.equal(view.version,1); assert.equal(view.state,'DRAFT');
      assert.deepEqual(Object.keys(view.lines[0]).sort(),['allocation','allocationId','employee','employeeId','endMinute','startMinute','workDate','workType']);
      assert.deepEqual(Object.keys(view.lines[0].employee).sort(),['employeeCode','employeeName']);
      assert.equal(await db.hrAttendanceRevision.count({where:{batchId}}),1);
    });
    const command=(action:string,expectedVersion:number,extra:object={})=>({requestId:randomUUID(),action,expectedVersion,...extra});
    let resubmit:ReturnType<typeof command>;
    await t.test('submission lock, independent HR return, reasoned correction, resubmission',async()=>{
      await call(a.store,root,201,command('SUBMIT',1));
      await call(a.store,root,409,command('EDIT',2,{reason:'Synthetic correction',lines:[row]}));
      await call(a.store,root,404,command('RETURN',2,{reason:'Synthetic return'}));
      await call(a.hr,root,422,command('RETURN',2));
      await call(a.hr,root,201,command('RETURN',2,{reason:'Synthetic return'}));
      await call(a.store,root,201,command('EDIT',3,{reason:'Synthetic corrected clock',lines:[row,{...row,startMinute:600,endMinute:780}]}));
      await call(a.store,root,409,command('RESUBMIT',4));
      await call(a.store,root,201,command('EDIT',4,{reason:'Synthetic corrected overlap',lines:[row,{...row,startMinute:780,endMinute:1020}]}));
      resubmit=command('RESUBMIT',5);
      await call(a.store,root,201,resubmit);
      const view=(await call(a.hr,root,200)).data;
      assert.equal(view.state,'SUBMITTED'); assert.equal(view.version,6); assert.equal(view.lines.length,2);
      assert.equal(await db.hrAttendanceRevision.count({where:{batchId}}),6);
      const original=await db.hrAttendanceRevision.findUniqueOrThrow({where:{batchId_version:{batchId,version:1}},include:{lines:true}});
      assert.equal(original.lines.length,1); assert.equal(original.lines[0]!.endMinute,720);
      await assert.rejects(db.hrAttendanceLine.update({where:{id:original.lines[0]!.id},data:{endMinute:721}}));
      await assert.rejects(db.hrAttendanceRevision.delete({where:{id:original.id}}));
      await assert.rejects(db.hrAttendanceBatch.update({where:{id:batchId},data:{currentVersion:4}}));
    });

    await t.test('cross-site overlap is detected; authorized HR corrects without changing historical submission',async()=>{
      // Existing assigned second site, not an access_all or cross-Company override.
      for(const employeeId of [a.store.employee!.id,f.legacy.id]) {
        await db.projectMember.create({data:{projectId:f.unassigned.id,employeeId,projectRole:'Synthetic second site'}});
      }
      const second=route(f.unassigned.id);
      const secondRow={...row,startMinute:600,endMinute:750};
      await call(a.store,second,201,command('CREATE',0,{lines:[secondRow]}));
      await call(a.store,second,409,command('SUBMIT',1));
      const corrected=[{...row,endMinute:600},{...row,startMinute:780,endMinute:1020}];
      await call(a.store,root,404,command('HR_CORRECT',6,{reason:'Synthetic overlap resolution',lines:corrected}));
      await call(a.hr,root,422,command('HR_CORRECT',6,{lines:corrected}));
      await call(a.hr,root,409,command('HR_CORRECT',5,{reason:'Synthetic stale correction',lines:corrected}));
      await call(a.hr,root,409,command('HR_CORRECT',6,{reason:'Synthetic invalid correction',lines:[row,{...row,startMinute:600,endMinute:780}]}));
      // No HR employment Company grant: capability alone cannot authorize this.
      await grant(a.outsider,'hr.attendance.review');
      await grant(a.outsider,'hr.attendance.correct');
      await grant(a.nancy,'hr.attendance.review');
      await call(a.nancy,root,404,command('HR_CORRECT',6,{reason:'Synthetic review-only denial',lines:corrected}));
      await call(a.outsider,root,404,command('HR_CORRECT',6,{reason:'Synthetic denied correction',lines:corrected}));
      const correction=command('HR_CORRECT',6,{reason:'Synthetic reviewed time evidence',lines:corrected});
      const result=await call(a.hr,root,201,correction);
      assert.deepEqual((await call(a.hr,root,201,correction)).data,result.data);
      const view=(await call(a.hr,root,200)).data;
      assert.equal(view.state,'SUBMITTED'); assert.equal(view.version,7); assert.equal(view.action,'HR_CORRECT');
      assert.equal(view.lines[0].endMinute,600);
      const old=await db.hrAttendanceRevision.findUniqueOrThrow({where:{batchId_version:{batchId,version:6}},include:{lines:true}});
      assert.ok(old.lines.some(l=>l.endMinute===720));
      await call(a.store,second,201,command('SUBMIT',1));
      assert.equal((await call(a.store,second,200)).data.state,'SUBMITTED');
      assert.equal(await db.hrAttendanceRevision.count({where:{batchId}}),7);
    });
    await t.test('office raw input reuses the ledger, with explicit HR-only Company scope and no Project impersonation',async()=>{
      const officeRoute=(companyId:string)=>'/hr/companies/'+companyId+'/office-attendance/2026-11-16';
      const officeEmployee=await db.employee.create({data:{companyId:f.company.id,employeeCode:'OFFICE-'+f.suffix,employeeName:'Synthetic office worker'}});
      await call(a.hr,'/hr/companies/'+f.company.id+'/employees/'+officeEmployee.id+'/employment',201,
        {requestId:randomUUID(),expectedVersion:0,facts:hrFacts({siteKind:'OFFICE',payBasis:'MONTHLY'})});
      const officeRow={...row,employeeId:officeEmployee.id,workType:'Office work'};
      const save={requestId:randomUUID(),expectedVersion:0,lines:[officeRow],reason:'Synthetic office clock record'};
      const office=officeRoute(f.company.id);
      await call(a.hr,office,404,save);
      await grant(a.hr,'hr.attendance.office.manage');
      await call(a.store,office,404,save);
      await call(a.hr,officeRoute(f.hidden.id),404,save);
      await call(a.hr,office,403,save,false);
      await call(a.hr,office,404,{...save,lines:[row]});
      await call(a.hr,office,422,{...save,lines:[]});
      const saved=await call(a.hr,office,201,save);
      assert.deepEqual((await call(a.hr,office,201,save)).data,saved.data);
      const officeView=(await call(a.hr,office,200)).data;
      assert.equal(officeView.projectId,null); assert.equal(officeView.state,'SUBMITTED'); assert.equal(officeView.action,'OFFICE_SAVE');
      await call(a.hr,office,409,{...save,requestId:randomUUID()});
      await call(a.hr,office,201,{...save,requestId:randomUUID(),expectedVersion:1,lines:[{...officeRow,endMinute:721}],reason:'Synthetic office correction'});
      const old=await db.hrAttendanceRevision.findUniqueOrThrow({where:{batchId_version:{batchId:saved.data.id,version:1}},include:{lines:true}});
      assert.equal(old.lines[0]!.endMinute,720);
      assert.equal((await call(a.hr,office,200)).data.lines[0].endMinute,721);
      const officeBatch=await db.hrAttendanceBatch.findUniqueOrThrow({where:{id:saved.data.id}});
      assert.equal(officeBatch.scopeKey,'OFFICE'); assert.equal(officeBatch.projectId,null);
      await call(a.store,root,409,command('EDIT',7,{reason:'Synthetic submitted lock',lines:[officeRow]}));
      // The same HR identity may record office input in an explicitly granted
      // other Company, without changing its session or granting site access.
      const foreignEmployee=await db.employee.create({data:{companyId:f.other.id,employeeCode:'OFFICE-B-'+f.suffix,employeeName:'Synthetic office B'}});
      await call(a.hr,'/hr/companies/'+f.other.id+'/employees/'+foreignEmployee.id+'/employment',201,
        {requestId:randomUUID(),expectedVersion:0,facts:hrFacts({siteKind:'OFFICE',payBasis:'MONTHLY'})});
      await call(a.hr,officeRoute(f.other.id),201,{...save,requestId:randomUUID(),lines:[{...officeRow,employeeId:foreignEmployee.id}]});
      assert.equal((await f.sessions.resolve(a.hr.session.sessionToken))!.companyId,f.company.id);
      await call(a.hr,route(f.foreignProject.id),404);
      assert.equal(await db.hrAttendanceBatch.count({where:{companyId:f.hidden.id}}),0);
    });
    await t.test('sending site records temporary small-job actual time in another Project or Company without target access',async()=>{
      const makeAllocation=(targetCompanyId:string,targetProjectId:string,validFrom='2026-11-20',validThrough='2026-11-20')=>
        db.hrAttendanceAllocation.create({data:{sourceCompanyId:f.company.id,sourceProjectId:f.project.id,targetCompanyId,targetProjectId,
          validFrom:new Date(validFrom),validThrough:new Date(validThrough),authorizationReference:'SYNTHETIC_APPROVED_ASSIGNMENT_ONLY'}});
      const same=await makeAllocation(f.company.id,f.unassigned.id);
      const foreign=await makeAllocation(f.other.id,f.foreignProject.id);
      const expired=await makeAllocation(f.other.id,f.foreignProject.id,'2026-11-18','2026-11-19');
      const wrongSource=await db.hrAttendanceAllocation.create({data:{
        sourceCompanyId:f.company.id,sourceProjectId:f.unassigned.id,targetCompanyId:f.other.id,targetProjectId:f.foreignProject.id,
        validFrom:new Date('2026-11-20'),validThrough:new Date('2026-11-20'),authorizationReference:'SYNTHETIC_OTHER_SENDER_ONLY'}});
      await assert.rejects(db.hrAttendanceAllocation.create({data:{
        sourceCompanyId:f.company.id,sourceProjectId:f.project.id,targetCompanyId:f.company.id,targetProjectId:f.foreignProject.id,
        validFrom:new Date('2026-11-20'),validThrough:new Date('2026-11-20'),authorizationReference:'SYNTHETIC_BAD_COMPANY_PAIR'}}));
      const opts=(await call(a.store,root+'/allocations',200)).data;
      assert.ok(opts.some((x:any)=>x.id===same.id));
      assert.ok(opts.some((x:any)=>x.id===foreign.id));
      assert.ok(opts.every((x:any)=>!('authorizationReference' in x)));
      assert.ok(!opts.some((x:any)=>x.id===wrongSource.id));
      await call(a.store,route(f.foreignProject.id),404);
      await call(a.store,route(f.foreignProject.id)+'/allocations',404);
      const original=[{...row,endMinute:600},{...row,startMinute:780,endMinute:1020}];
      // Add nonoverlapping raw intervals to sending-site snapshot. The foreign
      // Project receives no employee master, pay or role membership.
      const sameRow={...row,startMinute:750,endMinute:780,allocationId:same.id};
      const foreignRow={...row,startMinute:1020,endMinute:1080,allocationId:foreign.id};
      await call(a.hr,root,404,command('HR_CORRECT',7,{reason:'Synthetic invalid allocation',lines:[...original,{...foreignRow,allocationId:randomUUID()}]}));
      await call(a.hr,root,404,command('HR_CORRECT',7,{reason:'Synthetic expired allocation',lines:[...original,{...foreignRow,allocationId:expired.id}]}));
      await call(a.hr,root,404,command('HR_CORRECT',7,{reason:'Synthetic wrong source allocation',lines:[...original,{...foreignRow,allocationId:wrongSource.id}]}));
      // Store performs the approved sending-site capture after HR returns.
      await call(a.hr,root,409,command('RETURN',7,{reason:'Synthetic self-return denied'}));
      await call(a.nancy,root,201,command('RETURN',7,{reason:'Synthetic independent return'}));
      await call(a.store,root,201,command('EDIT',8,{reason:'Synthetic sending-site record',lines:[...original,sameRow,foreignRow]}));
      await call(a.store,root,201,command('RESUBMIT',9));
      const view=(await call(a.store,root,200)).data;
      assert.equal(view.version,10);
      const allocated=view.lines.filter((l:any)=>l.allocationId!==null);
      assert.equal(allocated.length,2);
      assert.deepEqual(allocated.map((l:any)=>l.allocation.targetCompanyId).sort(),[f.company.id,f.other.id].sort());
      assert.equal(await db.employee.count({where:{id:f.legacy.id,companyId:f.other.id}}),0);
      await assert.rejects(db.hrAttendanceAllocation.update({where:{id:foreign.id},data:{targetProjectId:f.unassigned.id}}));
      await db.hrAttendanceAllocation.update({where:{id:foreign.id},data:{revokedAt:new Date()}});
      assert.equal((await call(a.store,root,200)).data.lines.find((l:any)=>l.allocationId===foreign.id).allocation.targetProjectId,f.foreignProject.id);
      assert.ok(!(await call(a.store,root+'/allocations',200)).data.some((x:any)=>x.id===foreign.id));
      await call(a.hr,root,201,command('RETURN',10,{reason:'Synthetic scope correction'}));
      await call(a.store,root,404,command('RESUBMIT',11));
      await call(a.store,root,201,command('EDIT',11,{reason:'Synthetic remove revoked allocation',lines:[...original,sameRow]}));
      await call(a.store,root,201,command('RESUBMIT',12));
      assert.equal((await call(a.store,root,200)).data.version,13);
      const sealed=await db.hrAttendanceRevision.findUniqueOrThrow({where:{batchId_version:{batchId,version:10}},include:{lines:true}});
      assert.ok(sealed.lines.some(l=>l.allocationId===foreign.id));
    });
    await t.test('HR review routes bind explicit target Company, immutable versions and no site authority',async()=>{
      const review='/hr/companies/'+f.company.id+'/projects/'+f.project.id+'/attendance/2026-11-16';
      const other='/hr/companies/'+f.other.id+'/projects/'+f.foreignProject.id+'/attendance/2026-11-16';
      const mismatch='/hr/companies/'+f.other.id+'/projects/'+f.project.id+'/attendance/2026-11-16';
      await call(a.store,review,404);
      await call(a.outsider,review,404);
      await call(a.hr,mismatch,404);
      assert.equal((await call(a.hr,other,200)).data,null);
      assert.equal((await call(a.hr,review,200)).data.version,13);
      const history=(await call(a.hr,review+'/history',200)).data;
      assert.equal(history.items.length,13); assert.equal(history.items[0].version,13);
      const old=(await call(a.hr,review+'/history/10',200)).data;
      assert.ok(old.lines.some((x:any)=>x.allocation?.targetCompanyId===f.other.id));
      await call(a.hr,review+'/history/99',404);
      await call(a.hr,other,404,command('CREATE',0,{lines:[row]}));
      assert.equal((await f.sessions.resolve(a.hr.session.sessionToken))!.companyId,f.company.id);
    });
    await t.test('replay is reauthorized after capability revocation',async()=>{
      const permission=await db.permission.findUniqueOrThrow({where:{permissionCode:'hr.attendance.site.manage'}});
      await db.rolePermission.deleteMany({where:{roleId:a.store.role.id,permissionId:permission.id}});
      await call(a.store,root,404,resubmit);
      assert.equal(await db.hrAttendanceRevision.count({where:{batchId}}),13);
      assert.deepEqual(await financialCounts(),before);
    });
  } finally {
    await app.close(); await db.$disconnect(); await rm(dir,{recursive:true,force:true});
    if(savedKeys===undefined) delete process.env.HR_PRIVATE_KEYS; else process.env.HR_PRIVATE_KEYS=savedKeys;
    if(savedActive===undefined) delete process.env.HR_PRIVATE_ACTIVE_KEY_ID; else process.env.HR_PRIVATE_ACTIVE_KEY_ID=savedActive;
    if(savedStorage===undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT=savedStorage;
  }
});
