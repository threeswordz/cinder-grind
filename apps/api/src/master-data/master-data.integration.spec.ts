import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConflictException, UnprocessableEntityException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { MasterDataService } from './master-data.service';

function authContext(companyId: string, userId: string): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'master-admin@example.com',
    displayName: 'Master Admin',
    roleCodes: ['SYS_ADMIN'],
    permissions: [
      'master.customer.view',
      'master.customer.manage',
      'master.supplier.view',
      'master.supplier.manage',
      'master.employee.view',
      'master.employee.manage',
      'master.material.view',
      'master.material.manage',
      'master.uom.view',
      'master.uom.manage',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('Master Data enforces company and active-reference boundaries', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'MST-' + suffix,
        companyName: 'Master Data Integration Test',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'OTH-' + suffix,
        companyName: 'Other Company',
      },
    });

    const admin = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'master-admin-' + suffix + '@example.com',
        displayName: 'Master Admin',
        passwordHash: 'not-used-in-this-test',
      },
    });

    const service = new MasterDataService(
      prisma,
      new AuditService(prisma),
    );
    const auth = authContext(company.id, admin.id);

    const customer = await service.createCustomer(
      { auth },
      {
        customerCode: 'C001',
        customerName: 'Customer One',
      },
    );
    assert.equal(customer.customerCode, 'C001');

    const supplier = await service.createSupplier(
      { auth },
      {
        supplierCode: 'S001',
        supplierName: 'Supplier One',
      },
    );
    assert.equal(supplier.supplierCode, 'S001');

    const uom = await service.createUnitOfMeasure(
      { auth },
      {
        uomCode: 'EA',
        uomName: 'Each',
        decimalPlaces: 0,
      },
    );

    const otherUom = await prisma.unitOfMeasure.create({
      data: {
        companyId: otherCompany.id,
        uomCode: 'KG',
        uomName: 'Kilogram',
        decimalPlaces: 3,
      },
    });

    await assert.rejects(
      () =>
        service.createMaterial(
          { auth },
          {
            materialCode: 'BAD-UOM',
            materialName: 'Invalid Material',
            defaultUomId: otherUom.id,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const material = await service.createMaterial(
      { auth },
      {
        materialCode: 'MAT-001',
        materialName: 'Test Material',
        defaultUomId: uom.id,
      },
    );
    assert.equal(material.defaultUom.id, uom.id);

    await assert.rejects(
      () =>
        service.updateUnitOfMeasure(
          { auth },
          uom.id,
          { isActive: false },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const employee = await service.createEmployee(
      { auth },
      {
        employeeCode: 'E001',
        employeeName: 'Employee One',
      },
    );
    const linkedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'employee-' + suffix + '@example.com',
        displayName: 'Employee User',
        passwordHash: 'not-used-in-this-test',
      },
    });
    assert.ok(linkedUser.id);

    await assert.rejects(
      () =>
        service.updateEmployee(
          { auth },
          employee.id,
          { isActive: false },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const searchResults = await service.listCustomers(
      company.id,
      'Customer One',
      true,
    );
    assert.equal(searchResults.length, 1);

    const auditCount = await prisma.auditLog.count({
      where: { companyId: company.id },
    });
    assert.ok(auditCount >= 5);

    const permissionCount = await prisma.permission.count({
      where: {
        permissionCode: {
          in: [
            'master.customer.view',
            'master.customer.manage',
            'master.supplier.view',
            'master.supplier.manage',
            'master.employee.view',
            'master.employee.manage',
            'master.material.view',
            'master.material.manage',
            'master.uom.view',
            'master.uom.manage',
          ],
        },
      },
    });
    assert.equal(permissionCount, 10);
  } finally {
    await prisma.$disconnect();
  }
});
