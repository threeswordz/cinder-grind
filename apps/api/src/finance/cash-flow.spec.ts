import assert from 'node:assert/strict';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { CashFlowController } from './cash-flow.controller';
import {
  CashFlowSourceRow,
  deriveProjectCashFlow,
} from './cash-flow.service';

function source(
  overrides: Partial<CashFlowSourceRow> & Pick<CashFlowSourceRow, 'id'>,
): CashFlowSourceRow {
  return {
    id: overrides.id,
    paymentNumber: 'PAY-' + overrides.id,
    paymentDirection: 'OUTBOUND',
    paymentDate: new Date('2026-10-03T00:00:00.000Z'),
    amount: new Prisma.Decimal('100.00'),
    currencyCode: 'SGD',
    paymentMethod: null,
    reference: null,
    state: 'APPROVED',
    cancelledAt: null,
    supplier: null,
    customer: null,
    subcontractor: null,
    supplierAllocations: [],
    clientAllocations: [],
    subcontractAllocations: [],
    ...overrides,
  };
}

test('V0.6-E cash-flow routes retain Payment view permission', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      CashFlowController.prototype.projects,
    ),
    ['finance.payment.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      CashFlowController.prototype.projectCashFlow,
    ),
    ['finance.payment.view'],
  );
});

test('V0.6-E cash flow counts each approved Payment once independent of allocation completeness', () => {
  const result = deriveProjectCashFlow(
    [
      source({
        id: 'unallocated-outbound',
        amount: new Prisma.Decimal('100.00'),
      }),
      source({
        id: 'partial-outbound',
        amount: new Prisma.Decimal('200.00'),
        supplierAllocations: [
          {
            allocatedAmount: new Prisma.Decimal('80.00'),
            supplierInvoice: {
              id: 'si-1',
              supplierInvoiceNumber: 'SI-001',
              supplierReference: 'SUP-REF-1',
            },
          },
        ],
      }),
      source({
        id: 'full-inbound',
        paymentDirection: 'INBOUND',
        amount: new Prisma.Decimal('300.00'),
        clientAllocations: [
          {
            allocatedAmount: new Prisma.Decimal('300.00'),
            clientInvoice: {
              id: 'ci-1',
              clientInvoiceNumber: 'CI-001',
            },
          },
        ],
      }),
      source({
        id: 'cancelled',
        amount: new Prisma.Decimal('999.00'),
        state: 'CANCELLED',
        cancelledAt: new Date('2026-10-03T01:00:00.000Z'),
      }),
      source({
        id: 'not-approved',
        amount: new Prisma.Decimal('999.00'),
        state: 'SUBMITTED',
      }),
    ],
    'SGD',
  );

  assert.equal(result.rows.length, 3);
  assert.equal(result.baseCurrencyCode, 'SGD');
  assert.equal(result.rows[0]?.settlementStatus, 'UNALLOCATED');
  assert.equal(result.rows[0]?.unallocatedAmount.toFixed(2), '100.00');
  assert.equal(result.rows[1]?.settlementStatus, 'PARTIALLY_ALLOCATED');
  assert.equal(result.rows[1]?.allocatedAmount.toFixed(2), '80.00');
  assert.equal(result.rows[1]?.unallocatedAmount.toFixed(2), '120.00');
  assert.equal(result.rows[2]?.settlementStatus, 'FULLY_ALLOCATED');
  assert.equal(result.totals.inflowAmount.toFixed(2), '300.00');
  assert.equal(result.totals.outflowAmount.toFixed(2), '300.00');
  assert.equal(result.totals.netCashFlow.toFixed(2), '0.00');
});

test('V0.6-E allocation trace never changes Payment-level cash-flow amount', () => {
  const result = deriveProjectCashFlow(
    [
      source({
        id: 'trace',
        paymentDirection: 'INBOUND',
        amount: new Prisma.Decimal('500.00'),
        clientAllocations: [
          {
            allocatedAmount: new Prisma.Decimal('150.00'),
            clientInvoice: {
              id: 'ci-2',
              clientInvoiceNumber: 'CI-002',
            },
          },
          {
            allocatedAmount: new Prisma.Decimal('100.00'),
            clientInvoice: {
              id: 'ci-3',
              clientInvoiceNumber: 'CI-003',
            },
          },
        ],
      }),
    ],
    'SGD',
  );

  assert.equal(result.rows[0]?.amount.toFixed(2), '500.00');
  assert.equal(result.rows[0]?.inflowAmount.toFixed(2), '500.00');
  assert.equal(result.rows[0]?.allocatedAmount.toFixed(2), '250.00');
  assert.equal(result.rows[0]?.unallocatedAmount.toFixed(2), '250.00');
  assert.equal(result.rows[0]?.allocations.length, 2);
  assert.equal(result.totals.netCashFlow.toFixed(2), '500.00');
});
