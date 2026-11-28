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
      assert.deepEqual(Object.keys(view.lines[0]).sort(),['employee','employeeId','endMinute','startMinute','workDate','workType']);
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
    await t.test('replay is reauthorized after capability revocation',async()=>{
      const permission=await db.permission.findUniqueOrThrow({where:{permissionCode:'hr.attendance.site.manage'}});
      await db.rolePermission.deleteMany({where:{roleId:a.store.role.id,permissionId:permission.id}});
      await call(a.store,root,404,resubmit);
      assert.equal(await db.hrAttendanceRevision.count({where:{batchId}}),7);
      assert.deepEqual(await financialCounts(),before);
    });
  } finally {
    await app.close(); await db.$disconnect(); await rm(dir,{recursive:true,force:true});
    if(savedKeys===undefined) delete process.env.HR_PRIVATE_KEYS; else process.env.HR_PRIVATE_KEYS=savedKeys;
    if(savedActive===undefined) delete process.env.HR_PRIVATE_ACTIVE_KEY_ID; else process.env.HR_PRIVATE_ACTIVE_KEY_ID=savedActive;
    if(savedStorage===undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT=savedStorage;
  }
});
