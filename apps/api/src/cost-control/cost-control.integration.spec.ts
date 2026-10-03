import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CostControlController } from './cost-control.controller';
import {
  selectCurrentApprovedPurchaseOrders,
  selectOriginalAndCurrentBudget,
  splitSubcontractCommitment,
  sumCostControlDecimals,
  CostControlService,
} from './cost-control.service';

test('V0.7-A Budget and PO currency checks work without other Finance sources', async () => {
  for (const source of ['budget', 'po']) {
    for (const currencyCode of ['SGD', 'USD', null]) {
      const sourceRow = source === 'budget'
        ? { id: 'budget', revisionNo: 1, revisionNumber: 'BR-1', currencyCode,
            approvalInstance: { completedAt: new Date() }, lines: [] }
        : { id: 'po', poNumber: 'PO-1', revisionNo: 0, currencyCode, cancelledAt: null, lines: [] };
      const prisma = {
        project: { findFirstOrThrow: async () => ({ id: 'project' }) },
        company: { findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }) },
        wbsElement: { findMany: async () => [] },
        costCode: { findMany: async () => [] },
        budgetRevision: { findMany: async () => source === 'budget' ? [sourceRow] : [] },
        purchaseOrder: { findMany: async () => source === 'po' ? [sourceRow] : [] },
        subcontractAgreement: { findMany: async () => [] },
        supplierInvoice: { findMany: async () => [] },
        subcontractCertification: { findMany: async () => [] },
        payment: { findMany: async () => [] },
      };
      const service = new CostControlService(prisma as unknown as PrismaService,
        { assertAccess: async () => {} } as never);
      const read = () => service.projectCostControl({ companyId: 'company', permissions: [] } as never, 'project');
      if (currencyCode === 'SGD') {
        assert.equal((await read()).baseCurrencyCode, 'SGD');
      } else {
        await assert.rejects(read, (error: unknown) => {
          if (!(error instanceof UnprocessableEntityException)) return false;
          return (error.getResponse() as { code: string }).code ===
            (currencyCode === null ? 'COST_CONTROL_CURRENCY_UNVERIFIED' : 'COST_CONTROL_CURRENCY_UNSUPPORTED');
        }, source + ' must independently fail closed for mismatched/unknown provenance');
      }
    }
  }
});

test('V0.7-A source currency is captured, retained and inherited across Company changes', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({ data: {
      companyCode: 'CC-' + suffix, companyName: 'Currency provenance', baseCurrencyCode: 'SGD',
    } });
    const customer = await prisma.customer.create({ data: {
      companyId: company.id, customerCode: 'C-' + suffix, customerName: 'Currency customer',
    } });
    const user = await prisma.user.create({ data: {
      companyId: company.id, email: suffix + '@example.com', displayName: 'Currency maker', passwordHash: 'x',
    } });
    const supplier = await prisma.supplier.create({ data: {
      companyId: company.id, supplierCode: 'S-' + suffix, supplierName: 'Currency supplier',
    } });
    const project = await prisma.project.create({ data: {
      companyId: company.id, projectCode: 'P-' + suffix, projectName: 'Currency project', customerId: customer.id,
      contractValue: '100', plannedStartDate: new Date('2026-10-01'), plannedCompletionDate: new Date('2027-01-01'),
    } });
    const budget = await prisma.budgetRevision.create({ data: {
      companyId: company.id, projectId: project.id, revisionNo: 1, revisionNumber: 'BR-' + suffix, createdByUserId: user.id,
    } });
    const po = await prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'PO-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(budget.currencyCode, 'SGD');
    assert.equal(po.currencyCode, 'SGD');
    await prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode: 'USD' } });
    assert.equal((await prisma.budgetRevision.findUniqueOrThrow({ where: { id: budget.id } })).currencyCode, 'SGD');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).currencyCode, 'SGD');
    await assert.rejects(() => prisma.purchaseOrder.update({ where: { id: po.id }, data: { currencyCode: 'USD' } }));
    await assert.rejects(() => prisma.budgetRevision.update({ where: { id: budget.id }, data: { currencyCode: 'USD' } }));
    const budgetRevision = await prisma.budgetRevision.create({ data: {
      companyId: company.id, projectId: project.id, revisionNo: 2, revisionNumber: 'BR2-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(budgetRevision.currencyCode, 'SGD');
    await assert.rejects(() => prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'FORGED-' + suffix,
      createdByUserId: user.id, currencyCode: 'SGD',
    } }));
    const newPo = await prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'NEW-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(newPo.currencyCode, 'USD');
  } finally {
    await prisma.$disconnect();
  }
});

test('V0.7-A route requires explicit Cost Control permission', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      CostControlController.prototype.projectCostControl,
    ),
    ['cost.control.view'],
  );
});

test('V0.7-A Budget selector preserves first approval and highest approved revision', () => {
  const revisions = [
    {
      id: 'revision-2',
      revisionNo: 2,
      approvalInstance: {
        completedAt: new Date('2026-10-03T02:00:00.000Z'),
      },
    },
    {
      id: 'revision-1',
      revisionNo: 1,
      approvalInstance: {
        completedAt: new Date('2026-10-03T01:00:00.000Z'),
      },
    },
  ];
  const selected = selectOriginalAndCurrentBudget(revisions);
  assert.equal(selected.original?.id, 'revision-1');
  assert.equal(selected.current?.id, 'revision-2');
});

test('V0.7-A PO selector uses latest approved revision and does not revive cancelled commitment', () => {
  const selected = selectCurrentApprovedPurchaseOrders([
    {
      id: 'po-a-0',
      poNumber: 'PO-A',
      revisionNo: 0,
      cancelledAt: null,
    },
    {
      id: 'po-a-1',
      poNumber: 'PO-A',
      revisionNo: 1,
      cancelledAt: null,
    },
    {
      id: 'po-b-0',
      poNumber: 'PO-B',
      revisionNo: 0,
      cancelledAt: null,
    },
    {
      id: 'po-b-1',
      poNumber: 'PO-B',
      revisionNo: 1,
      cancelledAt: new Date('2026-10-03T03:00:00.000Z'),
    },
  ]);
  assert.deepEqual(
    selected.map((row) => row.id),
    ['po-a-1'],
  );
});

test('V0.7-A Work Orders allocate within the subcontract ceiling without double counting', () => {
  const allocation = splitSubcontractCommitment(
    new Prisma.Decimal('125000.00'),
    [
      { amount: new Prisma.Decimal('75000.00') },
      { amount: new Prisma.Decimal('10000.00') },
    ],
  );
  assert.equal(allocation.allocatedAmount.toString(), '85000');
  assert.equal(allocation.unallocatedAmount.toString(), '40000');
  assert.throws(
    () =>
      splitSubcontractCommitment(
        new Prisma.Decimal('100.00'),
        [{ amount: new Prisma.Decimal('100.01') }],
      ),
    (error: unknown) => {
      if (!(error instanceof UnprocessableEntityException)) return false;
      const response = error.getResponse() as { code?: string };
      return (
        response.code ===
        'COST_CONTROL_SUBCONTRACT_ALLOCATION_INVALID'
      );
    },
  );
});

test('V0.7-A Decimal helper preserves exact financial arithmetic beyond Decimal.js default precision', () => {
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('0.1'),
      new Prisma.Decimal('0.2'),
      new Prisma.Decimal('123456789.12345678'),
    ]).toFixed(),
    '123456789.42345678',
  );
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('9999999999999999.9999'),
      new Prisma.Decimal('0.0001'),
    ]).toFixed(),
    '10000000000000000',
  );
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('999999999999999999999999999999.99999999'),
      new Prisma.Decimal('0.00000001'),
    ]).toFixed(),
    '1000000000000000000000000000000',
  );
});

test('V0.7-A permission is seeded without implicit SYS_ADMIN grant', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const permission = await prisma.permission.findUnique({
      where: { permissionCode: 'cost.control.view' },
      select: { id: true, moduleCode: true },
    });
    assert.ok(permission);
    assert.equal(permission.moduleCode, 'COST_CONTROL');
    const implicitTechnicalGrant = await prisma.rolePermission.count({
      where: {
        permissionId: permission.id,
        role: { roleCode: 'SYS_ADMIN' },
      },
    });
    assert.equal(implicitTechnicalGrant, 0);
  } finally {
    await prisma.$disconnect();
  }
});
