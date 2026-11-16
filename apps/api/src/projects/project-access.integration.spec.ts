import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ForbiddenException} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from './project-access.service';
import {DocumentTargetsService} from '../documents/document-targets.service';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {receivingProofFixture} from '../inventory/receiving-proof-fixture';

test('shared Project scope requires active Employee across authenticated owning/Document/report aliases',async t=>{
 const target=new URL(process.env.DATABASE_URL??'');
 assert.ok(['127.0.0.1','localhost'].includes(target.hostname));
 assert.ok(/^\/(?:erp_validation|construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(target.pathname));
 const priorStorage=process.env.STORAGE_ROOT;
 const storage=await mkdtemp(join(tmpdir(),'erp-project-scope-'));process.env.STORAGE_ROOT=storage;
 const db=new PrismaService();
 const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
 try{
  const {f}=await receivingProofFixture(db,app);
  const codes=['projects.access_all','projects.project.view','documents.document.view','inventory.report.view','schedule.calendar.manage'];
  const permissions=await db.permission.findMany({where:{permissionCode:{in:codes}}});assert.equal(permissions.length,codes.length);
  await db.rolePermission.createMany({data:permissions.map(p=>({roleId:f.viewer.role.id,permissionId:p.id})),skipDuplicates:true});
  const wbs=await db.wbsElement.findFirstOrThrow({where:{projectId:f.project.id}}),bytes=Buffer.from('%PDF-1.4\nordinary scoped audit evidence\n');
  const document=await app.get(DocumentTargetsService).upload({auth:f.store.auth},f.project.id,'WBS',wbs.id,f.documentType.id,{originalname:'ordinary.pdf',mimetype:'application/pdf',size:bytes.length,buffer:bytes});
  const companyCalendar=await db.workingCalendar.create({data:{companyId:f.company.id,calendarName:'Company calendar',timezoneName:'Asia/Bangkok'}});
  for(const p of [f.project,f.unassigned])await db.workingCalendar.create({data:{companyId:f.company.id,projectId:p.id,calendarName:'Project '+p.projectCode,timezoneName:'Asia/Bangkok'}});
  const root=await app.getUrl()+'/api/v1',access=app.get(ProjectAccessService);
  const login=await fetch(root+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:f.viewer.user.email,password:f.viewer.password})});assert.equal(login.status,201);
  const rawCookie=login.headers.get('set-cookie');assert.ok(rawCookie);const cookie=rawCookie.split(';')[0]!;
  const get=async(path:string,status=200)=>{const r=await fetch(root+path,{headers:{Cookie:cookie}});assert.equal(r.status,status,path);return r;};
  const data=async(path:string)=>(await(await get(path)).json() as {data:Array<{id:string}>}).data;
  const ordinary='/documents/projects/'+f.project.id+'/targets/WBS/'+wbs.id;
  const download=ordinary+'/'+document.id+'/download';
  const generic='/documents/projects/'+f.project.id+'/'+document.id+'/download';
  const auth=await f.sessions.resolve(cookie.slice('erp_session='.length));assert.ok(auth);
  const before={stock:await db.stockTransaction.findMany({where:{companyId:f.company.id}}),payments:await db.payment.count({where:{companyId:f.company.id}}),costs:await db.directCostPosting.count({where:{companyId:f.company.id}})};
  await t.test('active assigned/all-Project identity sees intended source rows and ordinary file bytes',async()=>{
   assert.equal((await data('/projects')).length,2);await get('/projects/'+f.unassigned.id);
   assert.equal((await data('/inventory/reports/balances')).length,1);assert.equal((await data('/inventory/reports/movements')).length,1);
   assert.equal((await data('/working-calendars')).length,3);
   assert.equal((await data(ordinary)).length,1);assert.deepEqual(Buffer.from(await(await get(download)).arrayBuffer()),bytes);await get(generic);
  });
  for(const state of ['inactive','detached']){
   if(state==='inactive')await db.employee.update({where:{id:f.viewer.employee.id},data:{isActive:false}});
   else{await db.employee.update({where:{id:f.viewer.employee.id},data:{isActive:true}});await db.user.update({where:{id:f.viewer.user.id},data:{employeeId:null}});}
   await t.test(state+': shared list predicate and direct/transaction assertions deny all-Project bypass',async()=>{
    assert.equal(await db.project.count({where:await access.scopeWhere(auth)}),0);
    for(const run of [()=>access.assertAccess(auth,f.project.id),()=>db.$transaction(tx=>access.assertAccess(auth,f.project.id,tx))])await assert.rejects(run,(e:unknown)=>e instanceof ForbiddenException);
   });
   await t.test(state+': owning Project API and ordinary Documents cannot leak metadata or bytes',async()=>{
    assert.deepEqual(await data('/projects'),[]);await get('/projects/'+f.project.id,403);
    await get(ordinary,403);await get(download,403);await get(generic,403);
   });
   await t.test(state+': unfiltered and dimension-filtered stock reports exclude source rows',async()=>{
    for(const path of ['/inventory/reports/balances','/inventory/reports/balances?warehouseId='+f.warehouse.id,'/inventory/reports/movements','/inventory/reports/movements?materialId='+f.material.id])assert.deepEqual(await data(path),[],path);
    await get('/inventory/reports/balances?projectId='+f.project.id,403);
   });
   await t.test(state+': calendar shortcut excludes Project data while company configuration remains visible',async()=>{
    assert.deepEqual((await data('/working-calendars')).map((r:{id:string})=>r.id),[companyCalendar.id]);await get('/working-calendars?projectId='+f.project.id,403);
   });
  }
  await db.user.update({where:{id:f.viewer.user.id},data:{employeeId:f.viewer.employee.id}});
  await t.test('active Employee identity does not replace membership or source permission, and all-Project bypass is Company bounded',async()=>{
   const all=permissions.find(p=>p.permissionCode==='projects.access_all');assert.ok(all);
   await db.projectMember.updateMany({where:{employeeId:f.viewer.employee.id,projectId:f.project.id},data:{isActive:false}});
   await get('/projects/'+f.project.id);assert.equal((await data('/projects')).length,2);
   await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.viewer.role.id,permissionId:all.id}}});
   assert.deepEqual(await data('/projects'),[]);await get('/projects/'+f.project.id,403);
   await db.projectMember.updateMany({where:{employeeId:f.viewer.employee.id,projectId:f.project.id},data:{isActive:true}});
   assert.deepEqual((await data('/projects')).map((r:{id:string})=>r.id),[f.project.id]);await get('/projects/'+f.unassigned.id,403);
   const foreign=await db.company.create({data:{companyCode:'SCOPE-'+f.project.id.slice(0,8),companyName:'Foreign scope fixture'}});
   const customer=await db.customer.create({data:{companyId:foreign.id,customerCode:'FOREIGN',customerName:'Foreign'}});
   const project=await db.project.create({data:{companyId:foreign.id,customerId:customer.id,projectCode:'FOREIGN',projectName:'Foreign',contractValue:'0',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-01-01')}});
   await db.rolePermission.create({data:{roleId:f.viewer.role.id,permissionId:all.id}});await get('/projects/'+project.id,404);
   for(const [code,path] of [['projects.project.view','/projects/'+f.project.id],['documents.document.view',download],['inventory.report.view','/inventory/reports/balances']] as const){
    const permission=permissions.find(p=>p.permissionCode===code);assert.ok(permission);
    await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.viewer.role.id,permissionId:permission.id}}});
    await get(path,403);
    await db.rolePermission.create({data:{roleId:f.viewer.role.id,permissionId:permission.id}});
   }
   await db.user.update({where:{id:f.viewer.user.id},data:{isActive:false}});await get('/projects',401);
   await assert.rejects(()=>access.assertAccess(auth,f.project.id),(e:unknown)=>e instanceof ForbiddenException);
  });
  await t.test('scope denials never alter the canonical stock or Finance ledger',async()=>{
   assert.deepEqual(await db.stockTransaction.findMany({where:{companyId:f.company.id}}),before.stock);
   assert.equal(await db.payment.count({where:{companyId:f.company.id}}),before.payments);assert.equal(await db.directCostPosting.count({where:{companyId:f.company.id}}),before.costs);
  });
 }finally{await app.close();await db.$disconnect();await rm(storage,{recursive:true,force:true});if(priorStorage===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=priorStorage;}
});
