import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {Prisma} from '@prisma/client';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {PrismaService} from '../prisma/prisma.service';
import {MaterialReservationService} from '../inventory/material-reservation.service';
import {ApprovalService} from '../approval/approval.service';
import {GoodsReceiptService} from '../inventory/goods-receipt.service';
import {receivingFixture} from '../inventory/receiving-test-fixture';
import {materialUomFixture} from './material-uom-test-fixture';
import {resolveStockEffectPin} from './material-uom-effect-pin';
import {MaterialUomService} from './material-uom.service';

const code = (expected:string) => (error:unknown) => (error as {getResponse?:()=>{code?:string}}).getResponse?.().code === expected;

test('DEC-050 B explicit activation: current authority, immutable opt-in and denied source fallback on PostgreSQL',async t=>{
 const url=new URL(process.env.DATABASE_URL??'');
 assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
 assert.ok(/^\/(?:erp_validation|construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(url.pathname));
 const db=new PrismaService();await db.$connect();
 const app=await NestFactory.create(AppModule,{logger:false});await app.init();
 try{
  await t.test('prepared definitions are inactive; only a current scoped maintainer may explicitly activate',async()=>{
   const f=await materialUomFixture(db);
   await f.service.prepare({auth:f.maker.auth},f.material.id,{requestKey:randomUUID(),stockUomId:f.each.id,reason:'Disposable activation basis'});
   assert.equal(await db.materialUomActivation.count({where:{materialId:f.material.id}}),0);
   const input={requestKey:randomUUID(),expectedVersion:1,reason:'Explicit disposable stock activation'};
   for(const actor of [f.viewer,f.noConversion,f.technical,f.detached])
    await assert.rejects(f.service.activateStock({auth:actor.auth},f.material.id,input),code('MATERIAL_UOM_AUTHORITY_DENIED'));
   await assert.rejects(f.service.activateStock({auth:f.foreign.auth},f.material.id,input),code('MATERIAL_UOM_NOT_FOUND'));
   await assert.rejects(f.service.activateStock({auth:f.maker.auth},f.material.id,{...input,expectedVersion:2}),code('MATERIAL_UOM_ACTIVATION_VERSION_CONFLICT'));
   const outcomes=await Promise.all([f.service.activateStock({auth:f.maker.auth},f.material.id,input),f.service.activateStock({auth:f.maker.auth},f.material.id,input)]);
   assert.deepEqual(outcomes[0],outcomes[1]);assert.equal(outcomes[0].inventoryConversionEnabled,true);
   assert.equal(await db.materialUomActivation.count({where:{materialId:f.material.id}}),1);
   assert.equal((await f.service.get(f.viewer.auth,f.material.id)).inventoryConversionEnabled,true);
   assert.equal(await db.auditLog.count({where:{entityId:f.material.id,action:'ACTIVATE_STOCK'}}),1);
   await assert.rejects(f.service.activateStock({auth:f.maker.auth},f.material.id,{...input,reason:'Changed replay'}),code('MATERIAL_UOM_REPLAY_CONFLICT'));
   await assert.rejects(db.materialUomActivation.update({where:{materialId:f.material.id},data:{reason:'Rewrite'}}),/MATERIAL_UOM_ACTIVATION_IMMUTABLE/);
   await assert.rejects(db.materialUomActivation.delete({where:{materialId:f.material.id}}),/MATERIAL_UOM_ACTIVATION_IMMUTABLE/);
   await f.service.revise({auth:f.maker.auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,sourceUomId:f.carton.id,effectiveFrom:'2026-01-01',numerator:'20',denominator:'1',reason:'Later explicit definition'});
   assert.deepEqual(await f.service.activateStock({auth:f.maker.auth},f.material.id,input),outcomes[0]);
   const capability=await db.permission.findUniqueOrThrow({where:{permissionCode:'master.material.conversion.manage'}});
   await db.rolePermission.delete({where:{roleId_permissionId:{roleId:f.maker.role.id,permissionId:capability.id}}});
   await assert.rejects(f.service.activateStock({auth:f.maker.auth},f.material.id,input),code('MATERIAL_UOM_AUTHORITY_DENIED'));
  });

  async function receivingBasis(){
   const f=await receivingFixture(db),definitions=app.get(MaterialUomService);
   const permissions=await db.permission.findMany({where:{permissionCode:{in:['master.material.view','master.material.manage','master.material.conversion.manage']}}});
   assert.equal(permissions.length,3);
   await db.rolePermission.createMany({data:permissions.map(p=>({roleId:f.config.role.id,permissionId:p.id}))});
   const auth=await f.sessions.resolve(f.config.session.sessionToken);assert.ok(auth);
   const each=await db.unitOfMeasure.create({data:{companyId:f.company.id,uomCode:'ACT-EA',uomName:'Activation stock unit',decimalPlaces:0}});
   await definitions.prepare({auth},f.material.id,{requestKey:randomUUID(),stockUomId:each.id,reason:'Disposable activation stock basis'});
   await definitions.revise({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,sourceUomId:f.uom.id,effectiveFrom:'2026-01-01',numerator:'20',denominator:'1',reason:'Exact synthetic carton'});
   const create=()=>app.get(GoodsReceiptService).create({auth:f.store.auth},{projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal(1)}]});
   return {f,definitions,auth,each,create,receipts:app.get(GoodsReceiptService)};
  }
  await t.test('open sources block activation; offsetting foreign-unit history still blocks after reversal',async()=>{
   const {f,definitions,auth,create,receipts}=await receivingBasis();
   const receipt=await create(),input={requestKey:randomUUID(),expectedVersion:2,reason:'Must reject unfrozen sources'};
   await assert.rejects(definitions.activateStock({auth},f.material.id,input),code('MATERIAL_UOM_OPEN_SOURCE_CONFLICT'));
   await assert.rejects(receipts.submit({auth:f.store.auth},receipt.id,f.receiptWorkflow.workflowCode,'2026-11-19'),code('MATERIAL_UOM_NOT_ACTIVATED'));
   await assert.rejects(db.$transaction(async tx=>{
    const {effectSign:_sign,...pin}=await resolveStockEffectPin(tx,{companyId:f.company.id,materialId:f.material.id,sourceUomId:f.uom.id,quantity:new Prisma.Decimal(1),businessDate:'2026-11-19',effectSign:1});
    const item=await tx.goodsReceiptItem.findFirstOrThrow({where:{goodsReceiptId:receipt.id}});
    await tx.materialUomReceiptSourcePin.create({data:{...pin,projectId:f.project.id,receiptId:receipt.id,receiptItemId:item.id}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}),/MATERIAL_UOM_NOT_ACTIVATED/);

   assert.equal(await db.materialUomActivation.count({where:{materialId:f.material.id}}),0);
   await receipts.submit({auth:f.store.auth},receipt.id,f.receiptWorkflow.workflowCode);
   await receipts.approve({auth:f.pm.auth},receipt.id,randomUUID());
   await assert.rejects(definitions.activateStock({auth},f.material.id,input),code('MATERIAL_UOM_HISTORICAL_UNIT_CONFLICT'));
   await receipts.reverse({auth:f.store.auth},receipt.id,randomUUID(),'Disposable original-unit reversal');
   assert.equal((await db.stockTransaction.aggregate({where:{companyId:f.company.id,materialId:f.material.id},_sum:{quantity:true}}))._sum.quantity?.toString(),'0');
   await assert.rejects(definitions.activateStock({auth},f.material.id,input),code('MATERIAL_UOM_HISTORICAL_UNIT_CONFLICT'));
  });
  await t.test('a source insert racing activation is observed after lock wait; no unfrozen source escapes',async()=>{
   const f=await receivingFixture(db),definitions=app.get(MaterialUomService);
   const permissions=await db.permission.findMany({where:{permissionCode:{in:['master.material.view','master.material.manage','master.material.conversion.manage']}}});
   await db.rolePermission.createMany({data:permissions.map(p=>({roleId:f.config.role.id,permissionId:p.id}))});
   const auth=await f.sessions.resolve(f.config.session.sessionToken);assert.ok(auth);
   await definitions.prepare({auth},f.material.id,{requestKey:randomUUID(),stockUomId:f.uom.id,reason:'Race-safe synthetic identity basis'});
   let signal!:()=>void,release!:()=>void;
   const ready=new Promise<void>(resolve=>{signal=resolve;}), gate=new Promise<void>(resolve=>{release=resolve;});
   const writer=db.$transaction(async tx=>{
    const receipt=await tx.goodsReceipt.create({data:{companyId:f.company.id,projectId:f.project.id,supplierId:f.supplier.id,warehouseId:f.warehouse.id,purchaseOrderId:f.po.id,receiptNumber:'RACE-'+randomUUID(),createdByUserId:f.store.user.id}});
    await tx.goodsReceiptItem.create({data:{goodsReceiptId:receipt.id,lineNo:1,purchaseOrderLineId:f.po.lines[0]!.id,quotationAwardId:f.po.lines[0]!.quotationAwardId,materialId:f.material.id,materialCodeSnapshot:f.material.materialCode,description:'Synthetic uncommitted source',quantity:new Prisma.Decimal(1),uomId:f.uom.id,uomCodeSnapshot:f.uom.uomCode}});
    signal();await gate;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000});
   // Attach the rejection handler before awaiting the barrier.
   const written=writer.then(()=>({error:undefined}),error=>({error}));
   try{
    await Promise.race([ready,written.then(r=>{if(r.error)throw r.error;})]);
    const activation=definitions.activateStock({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,reason:'Must see the committed racing source'}).then(value=>({value,error:undefined}),error=>({value:undefined,error}));
    let waiting=false;
    for(let i=0;i<250;i++){
     const [row]=await db.$queryRaw<{waiting:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.datname=current_database()) AS waiting`;
     if(row?.waiting){waiting=true;break;}
     await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'Exercise an observed material advisory-lock wait');
    release();assert.equal((await written).error,undefined);
    const result=await activation;
    assert.ok(code('MATERIAL_UOM_OPEN_SOURCE_CONFLICT')(result.error));
    assert.equal(await db.materialUomActivation.count({where:{materialId:f.material.id}}),0);
   }finally{release();await written;}
  });
  await t.test('receipt waiting on the warehouse mutex does not hold a material lock in the opposite order',async()=>{
   const {f,definitions,auth,create,receipts}=await receivingBasis();
   await definitions.activateStock({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:2,reason:'Disposable posting lock order'});
   const receipt=await create();await receipts.submit({auth:f.store.auth},receipt.id,f.receiptWorkflow.workflowCode,'2026-11-19');
   let signal!:()=>void,release!:()=>void;
   const ready=new Promise<void>(resolve=>{signal=resolve;}),gate=new Promise<void>(resolve=>{release=resolve;});
   const locker=db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'inventory-warehouse:'+f.warehouse.id}))`;
    signal();await gate;
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:15000});
   const held=locker.then(()=>({error:undefined}),error=>({error}));
   let posting:Promise<{error:unknown}>|undefined;
   try{
    await Promise.race([ready,held.then(r=>{if(r.error)throw r.error;})]);
    posting=receipts.approve({auth:f.pm.auth},receipt.id,randomUUID()).then(()=>({error:undefined}),error=>({error}));
    let waiting=false;
    for(let i=0;i<250;i++){
     const [row]=await db.$queryRaw<{waiting:boolean}[]>`SELECT EXISTS(SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND NOT l.granted AND a.datname=current_database()) AS waiting`;
     if(row?.waiting){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.equal(waiting,true,'Exercise actual blocked receipt approval');
    await db.$transaction(async tx=>{
     await tx.$executeRawUnsafe("SET LOCAL lock_timeout='500ms'");
     await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom',f.company.id,f.material.id].join(':')},0))`;
    });
    release();assert.equal((await held).error,undefined);assert.equal((await posting).error,undefined);
    assert.equal((await db.stockTransaction.findFirstOrThrow({where:{goodsReceiptId:receipt.id}})).quantity.toString(),'20');
   }finally{release();await held;if(posting)await posting;}
  });
  await t.test('activated material refuses unpinned GR stock; dated original source posts once in canonical units',async()=>{
   const {f,definitions,auth,each,create,receipts}=await receivingBasis();
   await definitions.activateStock({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:2,reason:'Explicit disposable conversion'});
   const unpinned=await create();
   await assert.rejects(receipts.submit({auth:f.store.auth},unpinned.id,f.receiptWorkflow.workflowCode),code('MATERIAL_UOM_BUSINESS_DATE_REQUIRED'));
   assert.equal((await db.goodsReceipt.findUniqueOrThrow({where:{id:unpinned.id}})).submittedAt,null);
   // Deliberately bypass source submission at the DB boundary to prove that
   // current SQL guards still reject a subsequently attempted unpinned post.
   await db.$transaction(async tx=>{
    const approval=await app.get(ApprovalService).start({companyId:f.company.id,workflowCode:f.receiptWorkflow.workflowCode,entityType:'GOODS_RECEIPT',entityId:unpinned.id},tx);
    await tx.goodsReceipt.update({where:{id:unpinned.id},data:{approvalInstanceId:approval.id,submittedAt:new Date(),submittedByUserId:f.store.auth.userId}});
   },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
   await assert.rejects(receipts.approve({auth:f.pm.auth},unpinned.id,randomUUID()),code('MATERIAL_UOM_RECEIPT_SOURCE_INCOMPLETE'));
   const unpinnedHeader=await db.goodsReceipt.findUniqueOrThrow({where:{id:unpinned.id}});
   await assert.rejects(app.get(ApprovalService).approve(unpinnedHeader.approvalInstanceId!,f.pm.auth,f.store.user.id,'Negative missing-post proof',async tx=>{
    await tx.goodsReceipt.update({where:{id:unpinned.id},data:{postedAt:new Date(),postedByUserId:f.pm.user.id,postKey:randomUUID()}});
   }),/MATERIAL_UOM_RECEIPT_POST_PROOF_REQUIRED/);
   assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:unpinned.id}}),0);
   assert.equal((await db.goodsReceipt.findUniqueOrThrow({where:{id:unpinned.id}})).postedAt,null);
   const receipt=await create();
   await receipts.submit({auth:f.store.auth},receipt.id,f.receiptWorkflow.workflowCode,'2026-11-19');
   const key=randomUUID();await receipts.approve({auth:f.pm.auth},receipt.id,key);await receipts.approve({auth:f.pm.auth},receipt.id,key);
   const movement=await db.stockTransaction.findFirstOrThrow({where:{goodsReceiptId:receipt.id},include:{materialUomEffectPin:true}});
   assert.equal(movement.uomId,each.id);assert.equal(movement.quantity.toString(),'20');
   assert.equal(movement.materialUomEffectPin?.sourceQuantity.toString(),'1');
   assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:receipt.id}}),1);
   const rights=await db.permission.findMany({where:{permissionCode:{in:['inventory.reservation.view','inventory.reservation.create','inventory.reservation.activate','inventory.reservation.release']}}});
   assert.equal(rights.length,4);
   await db.rolePermission.createMany({data:rights.map(r=>({roleId:f.store.role.id,permissionId:r.id}))});
   await db.numberSequence.create({data:{companyId:f.company.id,entityType:'MATERIAL_RESERVATION',sequenceCode:'MATERIAL_RESERVATION',formatTemplate:'RSVYYMM-###',resetRule:'MONTHLY'}});
   const store=await f.sessions.resolve(f.store.session.sessionToken);assert.ok(store);
   const reservations=app.get(MaterialReservationService);
   const reservation=await reservations.create({auth:store},{projectId:f.project.id,warehouseId:f.warehouse.id,materialId:f.material.id,uomId:each.id,quantity:new Prisma.Decimal('10')});
   await assert.rejects(reservations.activate({auth:store},reservation.id),code('MATERIAL_UOM_BUSINESS_DATE_REQUIRED'));
   await assert.rejects(db.materialReservation.update({where:{id:reservation.id},data:{status:'ACTIVE',activatedAt:new Date(),activatedByUserId:store.userId}}),/MATERIAL_UOM_ACTIVATED_SOURCE_PIN_REQUIRED/);
   assert.equal((await db.materialReservation.findUniqueOrThrow({where:{id:reservation.id}})).status,'DRAFT');
   await reservations.activate({auth:store},reservation.id,'2026-11-19');
   assert.equal((await db.materialUomReservationPin.findUniqueOrThrow({where:{reservationId:reservation.id}})).stockQuantity.toString(),'10');
   await assert.rejects(receipts.reverse({auth:f.store.auth},receipt.id,randomUUID(),'Reserved activated receipt'),code('RECEIPT_REVERSAL_INSUFFICIENT_AVAILABLE'));
   await reservations.release({auth:store},reservation.id,'Release disposable reservation');
   await receipts.reverse({auth:f.store.auth},receipt.id,randomUUID(),'Original activated receipt reversal');
   assert.equal((await db.stockTransaction.aggregate({where:{goodsReceiptId:receipt.id},_sum:{quantity:true}}))._sum.quantity?.toString(),'0');
  });
 }finally{await app.close();await db.$disconnect();}
});
