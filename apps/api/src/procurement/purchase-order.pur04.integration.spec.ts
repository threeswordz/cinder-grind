import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { PurchaseOrderService } from './purchase-order.service';

// Dedicated disposable-PG PUR04 draft-only contract; do NOT rerun the old
// 2,400-line Purchase Order integration suite to test these new fields.
test('PUR04: nullable PO commercial draft fields, audit, and DB validation', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: { companyCode: 'PUR04-' + suffix, companyName: 'PUR04 ' + suffix },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'PUR04-C-' + suffix,
        customerName: 'PUR04 Customer',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PUR04-E-' + suffix,
        employeeName: 'PUR04 Employee',
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id, employeeId: employee.id,
        email: 'pur04-' + suffix + '@example.com',
        displayName: 'PUR04 Actor', passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        projectCode: 'PUR04-P-' + suffix,
        projectName: 'PUR04 Project',
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.create({
      data: { projectId: project.id, employeeId: employee.id, projectRole: 'PUR04 test' },
    });
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'PUR04-S-' + suffix,
        supplierName: 'PUR04 Supplier',
      },
    });
    const auth: AuthenticatedUserContext = {
      sessionId: randomUUID(), userId: user.id, companyId: company.id,
      email: user.email, displayName: user.displayName,
      roleCodes: ['PROCUREMENT_OFFICER'],
      permissions: ['procurement.po.view', 'procurement.po.edit'],
      csrfTokenHash: '0'.repeat(64),
    };
    const service = new PurchaseOrderService(
      prisma,
      new ProjectAccessService(
        prisma, new ProjectScopeService(new AuthorizationService()),
      ),
      new AuditService(prisma),
      new ApprovalService(prisma),
      new NumberSequenceService(prisma),
    );
    const po = await prisma.purchaseOrder.create({
      data: {
        companyId: company.id, projectId: project.id, supplierId: supplier.id,
        poNumber: 'PUR04-TEST-' + suffix, revisionNo: 0, createdByUserId: user.id,
      },
    });
    assert.equal(po.discountAmount, null);
    assert.equal(po.deliveryLocation, null);

    const edited = await service.updateOrder({ auth }, po.id, {
      deliveryLocation: 'Store A',
      deliveryContact: 'Site storekeeper',
      deliveryTerms: 'Partial delivery by agreement',
      paymentTerms: 'Thirty days from invoice',
      creditTerms: 'Net 30',
      discountAmount: new Prisma.Decimal('12.25'),
      freightAmount: new Prisma.Decimal('3.50'),
      additionalChargeAmount: new Prisma.Decimal('2.75'),
      vatRatePercent: new Prisma.Decimal('7.00'),
    });
    assert.equal(edited.deliveryLocation, 'Store A');
    assert.equal(edited.discountAmount?.toString(), '12.25');
    assert.equal(edited.freightAmount?.toString(), '3.5');
    assert.equal(edited.vatRatePercent?.toString(), '7');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
    })).creditTerms, 'Net 30');

    await assert.rejects(
      () => service.updateOrder({ auth }, po.id, {
        vatRatePercent: new Prisma.Decimal('101'),
      }),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      () => prisma.purchaseOrder.update({
        where: { id: po.id },
        data: { discountAmount: new Prisma.Decimal('-1') },
      }),
    );
    const cleared = await service.updateOrder({ auth }, po.id, {
      freightAmount: null,
      deliveryContact: null,
    });
    assert.equal(cleared.freightAmount, null);
    assert.equal(cleared.deliveryContact, null);
    assert.equal(cleared.discountAmount?.toString(), '12.25');
    assert.equal(cleared.approvalInstanceId, null);
  } finally {
    await prisma.$disconnect();
  }
});
