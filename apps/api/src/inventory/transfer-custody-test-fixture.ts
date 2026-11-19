import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { MaterialUomService } from '../master-data/material-uom.service';
import { receivingFixture } from './receiving-test-fixture';

// Disposable-only source: canonical approved PR/PO/GR, never an injected stock balance.
export async function transferCustodyFixture(db: PrismaService, app: INestApplication, converted=false,mixed=false) {
  const f = await receivingFixture(db,mixed);
  const grant = async (actor: typeof f.store, codes: string[]) => {
    const definitions = await db.permission.findMany({ where: { permissionCode: { in: codes } } });
    if (definitions.length !== new Set(codes).size) throw Error('Missing transfer fixture capability');
    await db.rolePermission.createMany({ data: definitions.map((p) => ({ roleId: actor.role.id, permissionId: p.id })), skipDuplicates: true });
    actor.auth = (await f.sessions.resolve(actor.session.sessionToken))!;
  };
  await grant(f.store, ['inventory.transfer.view','inventory.transfer.create','inventory.transfer.edit','inventory.transfer.submit','inventory.transfer.dispatch','inventory.transfer.reverse','inventory.transfer.receipt_view']);
  await grant(f.pm, ['inventory.transfer.view','inventory.transfer.approve','inventory.transfer.assign_receiver','inventory.transfer.configure','inventory.transfer.receipt_view']);
  await grant(f.viewer, ['inventory.transfer.receipt_view','inventory.transfer.receive_assigned','documents.document.view','documents.document.upload','documents.document.link']);
  await grant(f.jai, ['inventory.transfer.receipt_view','inventory.transfer.receive','documents.document.view','documents.document.upload','documents.document.link']);
  for (const actor of [f.store,f.pm,f.viewer,f.jai]) await db.projectMember.create({ data: { projectId: f.unassigned.id, employeeId: actor.employee.id, projectRole: 'Synthetic destination' } });
  await db.projectMember.deleteMany({ where: { employeeId: f.jai.employee.id, projectId: f.project.id } });
  const destinationWarehouse = await db.warehouse.create({ data: { companyId: f.company.id, projectId: f.unassigned.id, warehouseCode: 'DEST', warehouseName: 'Synthetic destination warehouse', isSiteWarehouse: true } });
  await db.numberSequence.create({ data: { companyId: f.company.id, entityType: 'STOCK_TRANSFER', sequenceCode: 'STOCK_TRANSFER', formatTemplate: 'STYYMM-###', resetRule: 'MONTHLY' } });
  const workflow = await db.approvalWorkflow.create({ data: { companyId: f.company.id, entityType: 'STOCK_TRANSFER', workflowCode: 'TRANSFER-'+randomUUID(), workflowName: 'Independent synthetic Khaimook decision', steps: { create: [{ stepNo: 1, stepName: 'Khaimook', requiredApprovals: 1, stepRoles: { create: [{ roleId: f.pm.role.id }] } }] } } });
  const receipts = app.get(GoodsReceiptService);
  let canonicalUomId=f.uom.id;
  if(converted){
    await grant(f.config,['master.material.view','master.material.manage','master.material.conversion.manage']);
    const unit=await db.unitOfMeasure.create({data:{companyId:f.company.id,uomCode:'BASE-EA',uomName:'Synthetic stock piece',decimalPlaces:0}});
    canonicalUomId=unit.id;
    const defs=app.get(MaterialUomService);
    await defs.prepare({auth:f.config.auth},f.material.id,{requestKey:randomUUID(),stockUomId:unit.id,reason:'Synthetic transfer stock basis'});
    await defs.revise({auth:f.config.auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,sourceUomId:f.uom.id,effectiveFrom:'2026-01-01',numerator:'20',denominator:'1',reason:'Synthetic transfer pack'});
    await defs.activateStock({auth:f.config.auth},f.material.id,{requestKey:randomUUID(),expectedVersion:2,reason:'Explicit disposable transfer material activation'});
  }
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: f.po.id }, include: { lines: true } });
  const receipt = await receipts.create({ auth: f.store.auth }, { projectId: f.project.id, warehouseId: f.warehouse.id, purchaseOrderId: po.id, lines: po.lines.map(line=>({purchaseOrderLineId:line.id,quantity:new Prisma.Decimal(10)})) });
  await receipts.submit({ auth: f.store.auth }, receipt.id, f.receiptWorkflow.workflowCode, converted?'2026-11-19':undefined);
  await receipts.approve({ auth: f.pm.auth }, receipt.id, randomUUID(), 'Canonical synthetic source stock');
  return { ...f, destinationWarehouse, workflow, grant, canonicalUomId, sourceReceiptId: receipt.id, transferInput: {
    sourceWarehouseId: f.warehouse.id, destinationWarehouseId: destinationWarehouse.id, transferDate: new Date().toISOString().slice(0,10), remarks: 'Synthetic physical transfer',
    lines: [{ materialId: f.material.id, quantity: '5.0000', uomId: f.uom.id, sourceProjectId: f.project.id, destinationProjectId: f.unassigned.id, remarks: 'Origin commercial remarks must never reach destination-only projection' }],
  } };
}
