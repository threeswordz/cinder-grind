import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';

import { PurchaseOrderPur07Service } from './purchase-order-pur07.service';

// Source-only negative guards. No synthetic role grants, database mutation,
// browser, real supplier send or duplicate existing approved-PDF positive proof.
test('PUR07 server PDF cannot invent completed independent PO approval evidence', async () => {
  const completion = new Date('2026-11-24T00:00:00.000Z');
  const invalidApprovalRecords = [
    null,
    { approvalState: 'APPROVED', completedAt: null },
    { approvalState: 'PENDING', completedAt: completion },
    { approvalState: 'REJECTED', completedAt: completion },
  ];
  for (const approvalInstance of invalidApprovalRecords) {
    const orders = { getOrder: async () => ({
      lifecycleState: 'APPROVED', cancelledAt: null,
      approvalInstance,
      // Deliberately omit commercial/line fields: the fail-closed approval
      // preflight MUST run before PDF generation can consume these sources.
    }) };
    const sut = new PurchaseOrderPur07Service(
      {} as never, {} as never, {} as never, orders as never,
    );
    await assert.rejects(
      () => sut.approvedPdf({} as never, '00000000-0000-4000-8000-000000000001'),
      (error: unknown) => {
        if (!(error instanceof ConflictException)) return false;
        const response = error.getResponse();
        return typeof response === 'object' && response !== null &&
          'code' in response &&
          response.code === 'PO_PDF_INDEPENDENT_APPROVAL_EVIDENCE_REQUIRED';
      },
      'Approved-facing PDF must not substitute an unverified approval label',
    );
  }
});
