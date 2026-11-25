import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

test('PUR07 preserves contractual rate and rounds only monetary presentation', async () => {
  const D = (v: string) => new Prisma.Decimal(v);
  for (const [quantity, unitPrice, amount, shownAmount, total] of [
    ['1000', '0.125', '125', '125.00', '133.75'],
    ['3', '0.125', '0.375', '0.38', '0.40'],
    ['2', '0.1234', '0.2468', '0.25', '0.26'],
  ]) {
    const order = {
      lifecycleState: 'APPROVED', cancelledAt: null,
      approvalInstance: { approvalState: 'APPROVED', completedAt: new Date('2026-11-24T00:00:00Z') },
      currencyCode: 'THB', poNumber: 'PO2611-001', displayNumber: 'K-PO2611-001 ABC',
      revisionNo: 0, companyId: 'synthetic-company', project: { projectCode: 'P1', projectName: 'Site' },
      lines: [{ lineNo: 1, description: 'Concrete', quantity: D(quantity!), uomCodeSnapshot: 'EA',
        unitPrice: D(unitPrice!), amount: D(amount!), quotationAward: { supplierNameSnapshot: 'ABC Ltd' } }],
      discountAmount: D('0'), freightAmount: D('0'), additionalChargeAmount: D('0'), vatRatePercent: D('7'),
      deliveryLocation: null, deliveryTerms: null, paymentTerms: null, creditTerms: null,
    };
    const sut = new PurchaseOrderPur07Service({} as never, {} as never, {} as never,
      { getOrder: async () => order } as never);
    const pdf = (await sut.approvedPdf({} as never, 'synthetic-order')).bytes.toString('ascii');
    assert.ok(pdf.includes(unitPrice + ' | ' + shownAmount), 'approved rate must not be rounded to satang');
    assert.ok(pdf.includes('Subtotal: ' + shownAmount));
    assert.ok(pdf.includes('Total incl VAT: ' + total));
  }
});
