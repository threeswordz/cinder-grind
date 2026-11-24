import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SessionService } from '../auth/session.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { PrismaService } from '../prisma/prisma.service';
import { subcontractPhysicalFixture } from '../subcontracts/subcontract-physical-test-fixture';

const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.M4_NON_PRODUCTION_CONFIRMED!=='YES'||
 !['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/erp_m4_pm15_pending')
 throw Error('PM15_DISPOSABLE_DB_ONLY');

test('PM15 actual submitted and decided stock count, work order, claim and certification appear only with scope and capability',async()=>{
 const prior=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'pm15-pending-'));
 process.env.STORAGE_ROOT=storage;
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
 await app.listen(0,'127.0.0.1');
 const db=app.get(PrismaService),sessions=app.get(SessionService);
 try{
  const f=await subcontractPhysicalFixture(db);
  const views=['inventory.stock_count.view','subcontracts.work_order.view','subcontracts.claim.view','subcontracts.certification.view'];
  await db.role.update({where:{id:f.maker.role.id},data:{roleCode:'PROJECT_MANAGER'}});
  await f.grant(f.maker.role.id,[...views,'inventory.stock.view','inventory.stock_count.approve',
   'subcontracts.work_order.create','subcontracts.work_order.submit']);
  await f.grant(f.ben.role.id,['subcontracts.work_order.view','subcontracts.work_order.approve']);
  // Reuse the synthetic outsider as a distinct Store actor on this one site.
  await db.role.update({where:{id:f.outsider.role.id},data:{roleCode:'STOREKEEPER'}});
  await f.grant(f.outsider.role.id,['inventory.stock.view','inventory.stock_count.view','inventory.stock_count.create','inventory.stock_count.submit']);
  await db.projectMember.create({data:{projectId:f.project.id,employeeId:f.outsider.employee!.id,projectRole:'STOREKEEPER'}});
  const hidden=await db.project.create({data:{companyId:f.company.id,customerId:f.project.customerId,
   projectCode:'HIDDEN',projectName:'Hidden project',contractValue:'1000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
  await db.projectMember.create({data:{projectId:hidden.id,employeeId:f.outsider.employee!.id,projectRole:'STOREKEEPER'}});
  const material=await db.material.create({data:{companyId:f.company.id,materialCode:'COUNT',materialName:'Synthetic count',defaultUomId:f.uom.id}});
  async function site(projectId:string,warehouseCode:string){
   return db.warehouse.create({data:{companyId:f.company.id,projectId,warehouseCode,warehouseName:warehouseCode,isSiteWarehouse:true}});
  }
  const visibleSite=await site(f.project.id,'VISIBLE'), hiddenSite=await site(hidden.id,'HIDDEN');
  const woWorkflow=await db.approvalWorkflow.create({data:{companyId:f.company.id,entityType:'SUBCONTRACT_WORK_ORDER',
   workflowCode:'PM15-WO',workflowName:'Independent Ben work-order approval',
   steps:{create:{stepNo:1,stepName:'Ben',requiredApprovals:1,stepRoles:{create:{roleId:f.ben.role.id}}}}}});
  const base=await app.getUrl()+'/api/v1';
  const actors={pm:await sessions.create(f.maker.user.id),store:await sessions.create(f.outsider.user.id),
   ben:await sessions.create(f.ben.user.id),porn:await sessions.create(f.porn.user.id),nancy:await sessions.create(f.nancy.user.id)};
  async function call(actor:keyof typeof actors,path:string,body?:unknown,expected=body===undefined?200:201){
   const s=actors[actor],r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'erp_session='+s.sessionToken,
    ...(body===undefined?{}:{'Content-Type':'application/json','x-csrf-token':s.csrfToken})},
    ...(body===undefined?{}:{body:JSON.stringify(body)})});
   const raw=await r.json() as any;assert.equal(r.status,expected,path+' '+JSON.stringify(raw));return raw.data;
  }
  const queue='/inventory/stock-minimums/portfolio-work-queue';
  const fields=['pendingStockCounts','pendingWorkOrders','pendingClaims','pendingCertifications'] as const;
  async function expectCounts(expected:(number|null)[]){
   const data=await call('pm',queue);
   assert.deepEqual(data.projects.map((p:any)=>p.id),[f.project.id]);
   assert.deepEqual(fields.map(k=>data.projects[0][k]),expected);
   assert.equal(data.stockEffect,false);assert.equal(data.financeEffect,false);
  }
  const beforeRead=async()=>({stock:await db.stockTransaction.count({where:{companyId:f.company.id}}),
   audit:await db.auditLog.count({where:{companyId:f.company.id}}),
   ap:await db.supplierInvoice.count({where:{companyId:f.company.id}}),
   payments:await db.payment.count({where:{companyId:f.company.id}})});
  async function count(projectId:string,warehouseId:string){
   const draft=await call('store','/inventory/stock-counts',{projectId,warehouseId,materialId:material.id,
    uomId:f.uom.id,countedAt:new Date().toISOString(),actualQuantity:'0',evidenceReference:'Disposable physical count'});
   return call('store','/inventory/stock-counts/'+draft.id+'/submit',{expectedVersion:draft.version});
  }
  const visibleCount=await count(f.project.id,visibleSite.id);
  await count(hidden.id,hiddenSite.id);
  const root='/subcontracts',agreement=root+'/agreements/'+f.agreement.id;
  const wo=await call('pm',agreement+'/work-orders',{scopeOfWork:'Synthetic subcontract work',amount:'1000'});
  await call('pm',root+'/work-orders/'+wo.id+'/submit',{workflowCode:woWorkflow.workflowCode,actionKey:randomUUID()});
  // This fixture is deliberately the existing non-opted-in agreement path;
  // no new Finance behavior or physical-policy override is introduced.
  const claim=await call('pm',agreement+'/claims',{periodStart:'2026-02-01',periodEnd:'2026-02-20'});
  await call('pm',root+'/claims/'+claim.id+'/lines',{amount:'1000'});
  await call('pm',root+'/claims/'+claim.id+'/submit',{actionKey:randomUUID()});
  const before=await beforeRead();
  await expectCounts([1,1,1,0]);assert.deepEqual(await beforeRead(),before);
  await call('store',queue,undefined,403);
  await call('pm','/inventory/stock-counts/'+visibleCount.id+'/approve',{expectedVersion:visibleCount.version,postKey:randomUUID(),comment:'Independent zero-variance count'});
  await call('ben',root+'/work-orders/'+wo.id+'/approve',{actionKey:randomUUID(),comment:'Independent work-order decision'});
  await call('ben',root+'/claims/'+claim.id+'/assess',{actionKey:randomUUID(),assessedAmount:'200',reason:'Independent existing assessment'});
  const cert=await call('porn',root+'/claims/'+claim.id+'/certifications',{certifiedGross:'200'});
  await call('porn',root+'/certifications/'+cert.id+'/submit',{workflowCode:f.workflow.workflowCode,actionKey:randomUUID()});
  await expectCounts([0,0,0,1]);
  // Live revocation masks each metric rather than presenting misleading zero.
  await db.rolePermission.deleteMany({where:{roleId:f.maker.role.id,permission:{permissionCode:{in:views}}}});
  await expectCounts([null,null,null,null]);
  await f.grant(f.maker.role.id,views);
  await expectCounts([0,0,0,1]);
  await call('nancy',root+'/certifications/'+cert.id+'/approve',{actionKey:randomUUID(),comment:'Independent existing certification decision'});
  const after=await beforeRead();
  await expectCounts([0,0,0,0]);assert.deepEqual(await beforeRead(),after);
  console.log('PM15_NATIVE_PENDING_STOCK_COUNT_SUBCONTRACT_DECISION_SCOPE_PASS');
 }finally{
  await app.close();if(prior===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=prior;
  await rm(storage,{recursive:true,force:true});
 }
});
