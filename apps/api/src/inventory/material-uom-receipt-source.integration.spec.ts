import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { MaterialUomService } from '../master-data/material-uom.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { receivingFixture } from './receiving-test-fixture';

test('DEC-050 B actual PostgreSQL receipt freeze: approved commercial source, exact dated stock posting and original reversal', async () => {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.ok(/^\/(?:erp_validation|construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(url.pathname));
  const db=new PrismaService();await db.$connect();
  const app=await NestFactory.create(AppModule,{logger:false});await app.init();
  try{
    const f=await receivingFixture(db), receipts=app.get(GoodsReceiptService);
    const definitions=app.get(MaterialUomService);
    const permissions=await db.permission.findMany({where:{permissionCode:{in:['master.material.view','master.material.manage','master.material.conversion.manage']}}});
    assert.equal(permissions.length,3);
    await db.rolePermission.createMany({data:permissions.map(p=>({roleId:f.config.role.id,permissionId:p.id}))});
    const auth=await f.sessions.resolve(f.config.session.sessionToken);
    assert.ok(auth);
    const each=await db.unitOfMeasure.create({data:{companyId:f.company.id,uomCode:'STOCK-EA',uomName:'Synthetic stock piece',decimalPlaces:0}});
    await definitions.prepare({auth},f.material.id,{requestKey:randomUUID(),stockUomId:each.id,reason:'Synthetic receipt pin proof'});
    await definitions.revise({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,sourceUomId:f.uom.id,effectiveFrom:'2026-01-01',numerator:'20',denominator:'1',reason:'Synthetic original pack'});
    const receipt=await receipts.create({auth:f.store.auth},{projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal(2)}]});
    await receipts.submit({auth:f.store.auth},receipt.id,f.receiptWorkflow.workflowCode,'2026-11-19');
    const pin=await db.materialUomReceiptSourcePin.findFirstOrThrow({where:{receiptId:receipt.id}});
    const item=await db.goodsReceiptItem.findUniqueOrThrow({where:{id:pin.receiptItemId}});
    assert.equal(item.quantity.toString(),'2');
    assert.equal(item.uomId,f.uom.id);
    assert.equal(pin.sourceQuantity.toString(),'2');
    assert.equal(pin.stockQuantity.toString(),'40');
    assert.equal(pin.stockUomId,each.id);
    assert.equal(pin.businessDate.toISOString(),'2026-11-19T00:00:00.000Z');
    // A future-effective revision does not affect this source.
    await definitions.revise({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:2,sourceUomId:f.uom.id,effectiveFrom:'2027-01-01',numerator:'24',denominator:'1',reason:'Synthetic later pack'});
    const unchanged=await db.materialUomReceiptSourcePin.findUniqueOrThrow({where:{receiptItemId:pin.receiptItemId}});
    assert.equal(unchanged.revisionId,pin.revisionId);assert.equal(unchanged.stockQuantity.toString(),'40');
    await assert.rejects(db.materialUomReceiptSourcePin.update({where:{receiptItemId:pin.receiptItemId},data:{numerator:'999'}}),/MATERIAL_UOM_RECEIPT_SOURCE_IMMUTABLE/);
    await assert.rejects(db.materialUomReceiptSourcePin.delete({where:{receiptItemId:pin.receiptItemId}}),/MATERIAL_UOM_RECEIPT_SOURCE_IMMUTABLE/);
    const postKey=randomUUID();
    await receipts.approve({auth:f.pm.auth},receipt.id,postKey);
    await receipts.approve({auth:f.pm.auth},receipt.id,postKey);
    const movement=await db.stockTransaction.findFirstOrThrow({where:{goodsReceiptId:receipt.id,movementType:'GOODS_RECEIPT'}});
    assert.equal(movement.uomId,each.id);assert.equal(movement.quantity.toString(),'40');
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:receipt.id}}),1);
    const effect=await db.materialUomEffectPin.findUniqueOrThrow({where:{stockTransactionId:movement.id}});
    assert.equal(effect.sourceQuantity.toString(),'2');assert.equal(effect.revisionId,pin.revisionId);
    // A correction effective on the actual date invalidates a pending approval,
    // but must not change an already posted receipt's exact reversal.
    const pending=await receipts.create({auth:f.store.auth},{projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal(1)}]});
    await receipts.submit({auth:f.store.auth},pending.id,f.receiptWorkflow.workflowCode,'2026-11-19');
    await definitions.revise({auth},f.material.id,{requestKey:randomUUID(),expectedVersion:3,sourceUomId:f.uom.id,effectiveFrom:'2026-01-01',numerator:'22',denominator:'1',reason:'Synthetic effective-date correction'});
    await assert.rejects(receipts.approve({auth:f.pm.auth},pending.id,randomUUID()),error=>(error as {getResponse:()=>{code:string}}).getResponse().code==='MATERIAL_UOM_RECEIPT_DEFINITION_CHANGED');
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:pending.id}}),0);
    const pendingHeader=await db.goodsReceipt.findUniqueOrThrow({where:{id:pending.id}});
    assert.equal(pendingHeader.postedAt,null);
    assert.notEqual((await db.approvalInstance.findUniqueOrThrow({where:{id:pendingHeader.approvalInstanceId!}})).approvalState,'APPROVED');
    const reversalKey=randomUUID();
    await receipts.reverse({auth:f.store.auth},receipt.id,reversalKey,'Reverse synthetic pinned receipt');
    await receipts.reverse({auth:f.store.auth},receipt.id,reversalKey,'Reverse synthetic pinned receipt');
    const reversed=await db.stockTransaction.findFirstOrThrow({where:{reversalOfId:movement.id}});
    assert.equal(reversed.quantity.toString(),'-40');
    assert.equal(reversed.uomId,each.id);
    const reversedPin=await db.materialUomEffectPin.findUniqueOrThrow({where:{stockTransactionId:reversed.id}});
    assert.equal(reversedPin.revisionId,pin.revisionId);
    assert.equal(reversedPin.stockQuantity.toString(),'40');
    assert.equal(reversedPin.effectSign,-1);
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:receipt.id}}),2);
    // PO ceiling remains the commercial source quantity, not normalized pieces.
    const excessive=await receipts.create({auth:f.store.auth},{projectId:f.project.id,purchaseOrderId:f.po.id,warehouseId:f.warehouse.id,lines:[{purchaseOrderLineId:f.po.lines[0]!.id,quantity:new Prisma.Decimal(11)}]});
    await receipts.submit({auth:f.store.auth},excessive.id,f.receiptWorkflow.workflowCode,'2026-11-19');
    await assert.rejects(receipts.approve({auth:f.pm.auth},excessive.id,randomUUID()),error=>(error as {getResponse:()=>{code:string}}).getResponse().code==='RECEIPT_OVER_PO_QUANTITY');
    assert.equal(await db.stockTransaction.count({where:{goodsReceiptId:excessive.id}}),0);
  }finally{await app.close();await db.$disconnect();}
});
