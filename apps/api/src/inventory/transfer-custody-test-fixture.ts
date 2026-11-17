import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { receivingFixture } from './receiving-test-fixture';

// Disposable-only source: canonical approved PR/PO/GR, never an injected stock balance.
export async function transferCustodyFixture(db: PrismaService, app: INestApplication) {
  const f = await receivingFixture(db);
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
  const po = await db.purchaseOrder.findUniqueOrThrow({ where: { id: f.po.id }, include: { lines: true } });
  const receipt = await receipts.create({ auth: f.store.auth }, { projectId: f.project.id, warehouseId: f.warehouse.id, purchaseOrderId: po.id, lines: [{ purchaseOrderLineId: po.lines[0]!.id, quantity: new Prisma.Decimal(10) }] });
  await receipts.submit({ auth: f.store.auth }, receipt.id, f.receiptWorkflow.workflowCode);
  await receipts.approve({ auth: f.pm.auth }, receipt.id, randomUUID(), 'Canonical synthetic source stock');
  return { ...f, destinationWarehouse, workflow, grant, sourceReceiptId: receipt.id, transferInput: {
    sourceWarehouseId: f.warehouse.id, destinationWarehouseId: destinationWarehouse.id, transferDate: new Date().toISOString().slice(0,10), remarks: 'Synthetic physical transfer',
    lines: [{ materialId: f.material.id, quantity: '5.0000', uomId: f.uom.id, sourceProjectId: f.project.id, destinationProjectId: f.unassigned.id, remarks: 'Origin commercial remarks must never reach destination-only projection' }],
  } };
}
