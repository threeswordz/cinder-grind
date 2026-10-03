import assert from 'node:assert/strict';
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
} from './cost-control.service';

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

test('V0.7-A Decimal helper preserves exact financial arithmetic', () => {
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('0.1'),
      new Prisma.Decimal('0.2'),
      new Prisma.Decimal('123456789.12345678'),
    ]).toString(),
    '123456789.42345678',
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
