import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../app.module';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { PrismaService } from '../prisma/prisma.service';
import { receivingFixture } from './receiving-test-fixture';
import { GoodsReceiptService } from './goods-receipt.service';
import { StockMinimumService } from './stock-minimum.service';
import { MaterialReservationService } from './material-reservation.service';
import { thailandBusinessDate } from './approved-plan-start-reminder';

const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.M4_NON_PRODUCTION_CONFIRMED!=='YES'||
  !['localhost','127.0.0.1'].includes(target.hostname)||
  target.pathname!=='/erp_m4_pm15_stock_delivery')throw Error('PM15_DISPOSABLE_DB_ONLY');

test('PM15 portfolio native stock thresholds and PO delay across multiple sites, no duplicate receipts or obligations',async()=>{
 const prior=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'m4-pm15-stock-'));
 process.env.STORAGE_ROOT=storage;
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');
 app.use(securityHeadersMiddleware(false));
 app.useGlobalFilters(new ProblemDetailsFilter());
 await app.listen(0,'127.0.0.1');
 const db=app.get(PrismaService);
 try{
  const f=await receivingFixture(db,true);
  await db.role.update({where:{id:f.pm.role.id},data:{roleCode:'PROJECT_MANAGER'}});
  await db.role.update({where:{id:f.store.role.id},data:{roleCode:'STOREKEEPER'}});
  const permission=await db.permission.findUniqueOrThrow({where:{permissionCode:'inventory.stock.view'}});
  await db.rolePermission.createMany({data:[{roleId:f.pm.role.id,permissionId:permission.id},{roleId:f.store.role.id,permissionId:permission.id}],skipDuplicates:true});
  const pm=await f.sessions.resolve(f.pm.session.sessionToken);
  const store=await f.sessions.resolve(f.store.session.sessionToken);
  assert.ok(pm&&store);
  const ctx={auth:pm};
  const second=await db.warehouse.create({data:{companyId:f.company.id,projectId:f.project.id,warehouseCode:'RC-W2',warehouseName:'Second authorized site',isSiteWarehouse:true}});
  const hidden=await db.warehouse.create({data:{companyId:f.company.id,projectId:f.unassigned.id,warehouseCode:'RC-HIDDEN',warehouseName:'Hidden site',isSiteWarehouse:true}});
  const day=thailandBusinessDate(new Date());
  const yesterday=new Date(new Date(day+'T00:00:00Z').getTime()-86400000);
  const original=await db.purchaseOrder.findUniqueOrThrow({where:{id:f.po.id},include:{lines:true}});
  const mainLine=original.lines.find(x=>x.materialId===f.material.id)!;
  const unknownLine=original.lines.find(x=>x.materialId===f.secondaryMaterial!.id)!;
  assert.ok(mainLine&&unknownLine);
  const gr=app.get(GoodsReceiptService);
  async function receive(orderId:string,lineId:string,warehouseId:string,quantity:number){
   const draft=await gr.create({auth:store!},{projectId:f.project.id,purchaseOrderId:orderId,warehouseId,
    lines:[{purchaseOrderLineId:lineId,quantity:new Prisma.Decimal(quantity)}]});
   await gr.submit({auth:store!},draft.id,f.receiptWorkflow.workflowCode);
   return gr.approve(ctx,draft.id,randomUUID(),'Independent receipt check');
  }
  // Actual original approved PO receipt. The newer approved revision must
  // still include this posted quantity in its Project-wide total.
  await receive(original.id,mainLine.id,f.warehouse.id,3);
  const revised=await f.orders.revise({auth:f.buyer.auth},original.id,'Update expected delivery date');
  const newLine=await db.purchaseOrderLine.findFirstOrThrow({where:{purchaseOrderId:revised.id,materialId:f.material.id}});
  assert.ok(newLine);
  await f.orders.updateLine({auth:f.buyer.auth},newLine.id,{expectedDelivery:yesterday,requiredOnSite:yesterday});
  const poWorkflow=await db.approvalWorkflow.findFirstOrThrow({where:{companyId:f.company.id,entityType:'PURCHASE_ORDER'}});
  await f.orders.submit({auth:f.buyer.auth},revised.id,poWorkflow.workflowCode);
  await f.orders.approve({auth:f.buyerChecker.auth},revised.id,'Independent revised date approval');
  await receive(revised.id,newLine.id,second.id,2);

  const minimum=app.get(StockMinimumService);
  const body={materialId:f.material.id,uomId:f.uom.id,minimumQuantity:'3.0000',status:'ACTIVE',reason:'Synthetic minimum threshold'};
  await minimum.set(ctx,f.project.id,f.warehouse.id,body,null);
  await minimum.set(ctx,f.project.id,second.id,body,null);
  await minimum.set(ctx,f.project.id,second.id,{...body,materialId:f.secondaryMaterial!.id,status:'PAUSED'},null);
  await db.numberSequence.create({data:{companyId:f.company.id,entityType:'MATERIAL_RESERVATION',sequenceCode:'MATERIAL_RESERVATION',formatTemplate:'RSVYYMM-###',resetRule:'MONTHLY'}});
  const reservations=app.get(MaterialReservationService);
  const res=await reservations.create(ctx,{projectId:f.project.id,warehouseId:f.warehouse.id,materialId:f.material.id,uomId:f.uom.id,quantity:new Prisma.Decimal(1)});
  await reservations.activate(ctx,res.id);
  const base=(await app.getUrl())+'/api/v1/inventory/stock-minimums/portfolio-work-queue';
  async function get(token:string){
   const r=await fetch(base,{headers:{Cookie:'erp_session='+token}});
   return {status:r.status,body:await r.json() as any};
  }
  const stockBefore=await db.stockTransaction.count({where:{companyId:f.company.id}});
  const auditBefore=await db.auditLog.count({where:{companyId:f.company.id}});
  const apBefore=await db.supplierInvoice.count({where:{companyId:f.company.id}});
  const result=await get(f.pm.session.sessionToken);
  assert.equal(result.status,200,JSON.stringify(result.body));
  assert.deepEqual(result.body.data.projects.map((x:any)=>x.id),[f.project.id]);
  const p=result.body.data.projects[0];
  assert.equal(p.activeSiteWarehouses,2,'Hidden site cannot count');
  assert.notEqual(hidden.id,second.id);
  assert.equal(p.configuredMinimums,3);
  assert.equal(p.comparableActiveMinimums,2);
  assert.equal(p.belowMinimumSiteDimensions,2,'Reserved stock reduces first site availability, second has only two');
  assert.equal(p.minimumsRequireReview,0);
  assert.equal(p.lateDeliveryLines,1,'One PO line despite two sites and two revisions');
  assert.equal(p.lateRequiredOnSiteLines,1);
  assert.equal(p.unknownDeliveryDateLines,1);
  assert.equal(p.deliveryLinesDueToday,0);
  assert.equal(p.deliveryLinesWithin7Days,0);
  assert.equal(result.body.data.stockEffect,false);
  assert.equal(result.body.data.financeEffect,false);
  const a=await minimum.supplierCommitments(pm,f.project.id,f.warehouse.id);
  const b=await minimum.supplierCommitments(pm,f.project.id,second.id);
  assert.equal(a.alerts.find(x=>x.poLineId===newLine.id)?.pendingQuantity,'5.0000');
  assert.equal(b.alerts.find(x=>x.poLineId===newLine.id)?.receivedAtSelectedSite,'2.0000');
  assert.equal(a.alerts.find(x=>x.poLineId===newLine.id)?.receivedAtSelectedSite,'3.0000');
  assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),stockBefore);
  assert.equal(await db.auditLog.count({where:{companyId:f.company.id}}),auditBefore);
  assert.equal(await db.supplierInvoice.count({where:{companyId:f.company.id}}),apBefore);
  assert.equal((await get(f.store.session.sessionToken)).status,403);
  // Fulfill remaining current PO quantity; report must stop showing the late
  // line. Reversal restores its outstanding quantity and warning.
  const final=await receive(revised.id,newLine.id,second.id,5);
  const filled=await get(f.pm.session.sessionToken);
  assert.equal(filled.status,200,JSON.stringify(filled.body));
  assert.equal(filled.body.data.projects[0].lateDeliveryLines,0);
  assert.equal(filled.body.data.projects[0].belowMinimumSiteDimensions,1);
  await gr.reverse({auth:store},final.id,randomUUID(),'Synthetic reversal of last receipt');
  const reversed=await get(f.pm.session.sessionToken);
  assert.equal(reversed.status,200,JSON.stringify(reversed.body));
  assert.equal(reversed.body.data.projects[0].lateDeliveryLines,1);
  assert.equal(reversed.body.data.projects[0].belowMinimumSiteDimensions,2);
  console.log('PM15_NATIVE_MULTI_SITE_MINIMA_RESERVATION_PO_REVISION_PARTIAL_FULL_REVERSE_PASS');
 }finally{
  await app.close();
  if(prior===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=prior;
  await rm(storage,{recursive:true,force:true});
 }
});
