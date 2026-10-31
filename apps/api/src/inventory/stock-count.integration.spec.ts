import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { StockCountService } from './stock-count.service';

function auth(companyId: string, userId: string, permissions: string[]): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(), userId, companyId, email: userId + '@example.com',
    displayName: 'Stock Count User', roleCodes: ['SYNTHETIC_STOCK_COUNT'],
    permissions, csrfTokenHash: '0'.repeat(64),
  };
}

test('OP-STOCK-COUNT-01 quantity-only reconciliation is scoped, stale-safe, reserved-safe and maker-checker', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({ data: { companyCode: 'SC-' + suffix, companyName: 'Stock Count ' + suffix } });
    const customer = await prisma.customer.create({ data: {
      companyId: company.id, customerCode: 'SC-C-' + suffix, customerName: 'Count Customer',
    }});
    const project = await prisma.project.create({ data: {
      companyId: company.id, projectCode: 'SC-P-' + suffix, projectName: 'Count Project',
      customerId: customer.id, contractValue: '1000',
      plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
      plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
    }});
    const storeEmployee = await prisma.employee.create({ data: {
      companyId: company.id, employeeCode: 'SC-S-' + suffix, employeeName: 'Store Site',
    }});
    const managerEmployee = await prisma.employee.create({ data: {
      companyId: company.id, employeeCode: 'SC-M-' + suffix, employeeName: 'Project Manager',
    }});
    const store = await prisma.user.create({ data: {
      companyId: company.id, employeeId: storeEmployee.id, email: 'store-' + suffix + '@example.com',
      displayName: 'Store Site', passwordHash: 'x',
    }});
    const manager = await prisma.user.create({ data: {
      companyId: company.id, employeeId: managerEmployee.id, email: 'pm-' + suffix + '@example.com',
      displayName: 'Khaimook synthetic', passwordHash: 'x',
    }});
    await prisma.projectMember.createMany({ data: [
      { projectId: project.id, employeeId: storeEmployee.id, projectRole: 'Store' },
      { projectId: project.id, employeeId: managerEmployee.id, projectRole: 'Project Manager' },
    ]});
    const uom = await prisma.unitOfMeasure.create({ data: {
      companyId: company.id, uomCode: 'EA-' + suffix, uomName: 'Each', decimalPlaces: 4,
    }});
    const material = await prisma.material.create({ data: {
      companyId: company.id, materialCode: 'MAT-' + suffix, materialName: 'Count Material', defaultUomId: uom.id,
    }});
    const site = await prisma.warehouse.create({ data: {
      companyId: company.id, projectId: project.id, warehouseCode: 'SITE-' + suffix,
      warehouseName: 'Site Store', isSiteWarehouse: true,
    }});
    const central = await prisma.warehouse.create({ data: {
      companyId: company.id, warehouseCode: 'MAIN-' + suffix, warehouseName: 'Central Store', isSiteWarehouse: false,
    }});

    const access = new ProjectAccessService(prisma, new ProjectScopeService(new AuthorizationService()));
    const quantities = new InventoryQuantityService(prisma);
    const service = new StockCountService(prisma, access, new AuditService(prisma), quantities);
    const storeAuth = auth(company.id, store.id, [
      'inventory.stock_count.view','inventory.stock_count.create','inventory.stock_count.edit','inventory.stock_count.submit',
    ]);
    const managerAuth = auth(company.id, manager.id, ['inventory.stock_count.view','inventory.stock_count.approve']);

    await assert.rejects(() => service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: central.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'inspection',
    }), (error: unknown) => error instanceof UnprocessableEntityException);

    const plus = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(5), evidenceReference: 'photo ref +5',
    });
    assert.equal(plus.expectedOnHand.toString(), '0');
    const plusSubmitted = await service.submit({ auth: storeAuth }, plus.id, plus.version);
    const plusApproved = await service.approve(
      { auth: managerAuth }, plus.id, plusSubmitted.version, 'SC-PLUS-' + suffix, 'verified count',
    );
    assert.equal(plusApproved.status, 'APPROVED');
    assert.equal(plusApproved.stockTransaction?.quantity.toString(), '5');
    const dimension = { companyId: company.id, projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id };
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '5');

    const minus = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3), evidenceReference: 'photo ref -2',
    });
    const minusSubmitted = await service.submit({ auth: storeAuth }, minus.id, minus.version);
    const minusApproved = await service.approve({ auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-' + suffix);
    assert.equal(minusApproved.stockTransaction?.quantity.toString(), '-2');
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '3');
    const replay = await service.approve({ auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-' + suffix);
    assert.equal(replay.stockTransaction?.id, minusApproved.stockTransaction?.id);
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, minus.id, minusSubmitted.version, 'SC-MINUS-CHANGED-' + suffix,
    ), (error: unknown) => error instanceof ConflictException);

    const zero = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3),
    });
    const zeroSubmitted = await service.submit({ auth: storeAuth }, zero.id, zero.version);
    const zeroApproved = await service.approve({ auth: managerAuth }, zero.id, zeroSubmitted.version, 'SC-ZERO-' + suffix);
    assert.equal(zeroApproved.stockTransaction, null);

    const noEvidence = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4),
    });
    await assert.rejects(() => service.submit({ auth: storeAuth }, noEvidence.id, noEvidence.version),
      (error: unknown) => error instanceof UnprocessableEntityException);

    const stale = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(3),
    });
    const mover = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4), evidenceReference: 'move stock',
    });
    const moverSubmitted = await service.submit({ auth: storeAuth }, mover.id, mover.version);
    await service.approve({ auth: managerAuth }, mover.id, moverSubmitted.version, 'SC-MOVE-' + suffix);
    await assert.rejects(() => service.submit({ auth: storeAuth }, stale.id, stale.version),
      (error: unknown) => error instanceof ConflictException);

    const selfMade = await service.create({ auth: managerAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(4),
    });
    const selfSubmitted = await service.submit({ auth: managerAuth }, selfMade.id, selfMade.version);
    await assert.rejects(() => service.approve(
      { auth: managerAuth }, selfMade.id, selfSubmitted.version, 'SC-SELF-' + suffix,
    ), (error: unknown) => error instanceof ForbiddenException);

    const reservationSnapshot = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'physical shortage observed',
    });
    const reservation = await prisma.materialReservation.create({ data: {
      companyId: company.id, projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      reservationNumber: 'SC-RSV-' + suffix, quantity: new Prisma.Decimal(2), createdByUserId: store.id,
    }});
    await prisma.materialReservation.update({ where: { id: reservation.id }, data: {
      status: 'ACTIVE', activatedByUserId: store.id, activatedAt: new Date(),
    }});
    await assert.rejects(() => service.submit(
      { auth: storeAuth }, reservationSnapshot.id, reservationSnapshot.version,
    ), (error: unknown) => error instanceof ConflictException,
    'reservation changes after the physical snapshot must force a recount/review');

    const shortage = await service.create({ auth: storeAuth }, {
      projectId: project.id, warehouseId: site.id, materialId: material.id, uomId: uom.id,
      countedAt: new Date(), actualQuantity: new Prisma.Decimal(1), evidenceReference: 'verified shortage below reservation',
    });
    const shortageSubmitted = await service.submit({ auth: storeAuth }, shortage.id, shortage.version);
    const shortageApproved = await service.approve(
      { auth: managerAuth }, shortage.id, shortageSubmitted.version, 'SC-SHORT-' + suffix,
    );
    assert.equal(shortageApproved.stockTransaction?.quantity.toString(), '-3');
    assert.equal((await quantities.onHand(prisma, dimension)).toString(), '1');

    await assert.rejects(() => prisma.stockCount.update({
      where: { id: plus.id }, data: { evidenceReference: 'tampered', version: plusApproved.version + 1 },
    }), 'approved count history must be immutable');

    assert.equal(await prisma.auditLog.count({
      where: { companyId: company.id, entityType: { in: ['PAYMENT','SUPPLIER_INVOICE','DIRECT_COST_POSTING'] } },
    }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
