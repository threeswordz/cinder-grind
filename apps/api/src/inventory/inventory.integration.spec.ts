import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryService } from './inventory.service';

function auth(
  companyId: string,
  userId: string,
  accessAll = false,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'Inventory User',
    roleCodes: ['INVENTORY_USER'],
    permissions: [
      'inventory.warehouse.view',
      'inventory.warehouse.create',
      'inventory.warehouse.edit',
      'inventory.warehouse.archive',
      ...(accessAll ? ['projects.access_all'] : []),
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.4-A Warehouse enforces Company, Project scope, lifecycle and audit', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'INV-' + suffix,
        companyName: 'Inventory Test ' + suffix,
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'IVX-' + suffix,
        companyName: 'Other Inventory Company ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'INV-C-' + suffix,
        customerName: 'Inventory Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompany.id,
        customerCode: 'IVX-C-' + suffix,
        customerName: 'Other Inventory Customer',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'INV-E-' + suffix,
        employeeName: 'Storekeeper',
      },
    });
    const scopedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'store-' + suffix + '@example.com',
        displayName: 'Storekeeper',
        passwordHash: 'x',
      },
    });
    const allUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'store-all-' + suffix + '@example.com',
        displayName: 'Inventory Administrator',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'INV-P-' + suffix,
        projectName: 'Assigned Inventory Project',
        customerId: customer.id,
        contractValue: '1000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    const unassignedProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'INV-U-' + suffix,
        projectName: 'Unassigned Inventory Project',
        customerId: customer.id,
        contractValue: '1000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: otherCompany.id,
        projectCode: 'IVX-P-' + suffix,
        projectName: 'Other Company Project',
        customerId: otherCustomer.id,
        contractValue: '1000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Storekeeper',
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const service = new InventoryService(
      prisma,
      access,
      new AuditService(prisma),
    );
    const scopedAuth = auth(company.id, scopedUser.id);
    const allAuth = auth(company.id, allUser.id, true);

    const general = await service.createWarehouse(
      { auth: scopedAuth },
      {
        warehouseCode: 'MAIN-' + suffix,
        warehouseName: 'Main Warehouse',
        location: 'Central Yard',
        isSiteWarehouse: false,
      },
    );
    assert.equal(general.projectId, null);

    const site = await service.createWarehouse(
      { auth: scopedAuth },
      {
        warehouseCode: 'SITE-' + suffix,
        warehouseName: 'Assigned Site Store',
        projectId: project.id,
        location: 'Site compound',
        isSiteWarehouse: true,
      },
    );
    assert.equal(site.project?.id, project.id);

    await assert.rejects(
      () =>
        service.createWarehouse(
          { auth: scopedAuth },
          {
            warehouseCode: 'NOPE-' + suffix,
            warehouseName: 'Unassigned Project Store',
            projectId: unassignedProject.id,
            isSiteWarehouse: true,
          },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const restricted = await service.createWarehouse(
      { auth: allAuth },
      {
        warehouseCode: 'REST-' + suffix,
        warehouseName: 'Restricted Store',
        projectId: unassignedProject.id,
        isSiteWarehouse: true,
      },
    );

    const scopedList = await service.listWarehouses(scopedAuth, {
      includeInactive: true,
    });
    assert.deepEqual(
      scopedList.map((row) => row.id).sort(),
      [general.id, site.id].sort(),
    );
    const allList = await service.listWarehouses(allAuth, {
      includeInactive: true,
    });
    assert.equal(allList.length, 3);

    await assert.rejects(
      () => service.getWarehouse(scopedAuth, restricted.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        service.updateWarehouse(
          { auth: scopedAuth },
          site.id,
          { projectId: null, isSiteWarehouse: false },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        service.createWarehouse(
          { auth: scopedAuth },
          {
            warehouseCode: general.warehouseCode,
            warehouseName: 'Duplicate',
            isSiteWarehouse: false,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    await assert.rejects(
      () =>
        service.createWarehouse(
          { auth: scopedAuth },
          {
            warehouseCode: 'BAD-SITE-' + suffix,
            warehouseName: 'Bad Site Store',
            isSiteWarehouse: true,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(
      () =>
        prisma.warehouse.create({
          data: {
            companyId: company.id,
            warehouseCode: 'CROSS-' + suffix,
            warehouseName: 'Cross Company Store',
            projectId: otherProject.id,
            isSiteWarehouse: true,
          },
        }),
      'database trigger must reject cross-Company Project ownership',
    );

    await assert.rejects(
      () =>
        prisma.warehouse.update({
          where: { id: general.id },
          data: { companyId: otherCompany.id },
        }),
      'database trigger must prevent Warehouse Company reassignment',
    );

    await assert.rejects(
      () => prisma.warehouse.delete({ where: { id: general.id } }),
      'Warehouse history requires archive rather than hard deletion',
    );

    const archived = await service.archiveWarehouse(
      { auth: scopedAuth },
      general.id,
    );
    assert.equal(archived.isActive, false);
    const activeOnly = await service.listWarehouses(scopedAuth);
    assert.equal(activeOnly.some((row) => row.id === general.id), false);

    const reactivated = await service.reactivateWarehouse(
      { auth: scopedAuth },
      general.id,
    );
    assert.equal(reactivated.isActive, true);

    await service.archiveWarehouse({ auth: scopedAuth }, site.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { isActive: false },
    });
    await assert.rejects(
      () => service.reactivateWarehouse({ auth: scopedAuth }, site.id),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const auditActions = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: 'WAREHOUSE',
        entityId: general.id,
      },
      orderBy: { occurredAt: 'asc' },
      select: { action: true },
    });
    assert.deepEqual(
      auditActions.map((row) => row.action),
      ['CREATE', 'ARCHIVE', 'REACTIVATE'],
    );
  } finally {
    await prisma.$disconnect();
  }
});
