import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';

import { PurchaseOrderPur07Service } from './purchase-order-pur07.service';

// The actual Company/Project/Document lookup stays in the canonical DB path.
// This narrow guard exercises only the missing documented-PDF linkage right.
test('PUR07 external send cannot link a Project Document without document.view', async () => {
  let orderLookups = 0;
  const orders = { getOrder: async () => {
    orderLookups++;
    throw new Error('SOURCE_LOOKUP_SENTINEL');
  } };
  const sut = new PurchaseOrderPur07Service(
    {} as never, {} as never, {} as never, orders as never,
  );
  const auth = {
    roleCodes: ['PROCUREMENT_OFFICER'],
    permissions: ['procurement.po.edit'],
  } as never;
  const base = {
    kind: 'DISPATCH' as const, channel: 'EMAIL' as const,
    recipient: 'supplier@example.invalid',
    evidenceReference: 'Only a human-reported external communication, not a send',
  };
  await assert.rejects(
    () => sut.record({ auth }, '00000000-0000-4000-8000-000000000001', {
      ...base, evidenceDocumentId: '00000000-0000-4000-8000-000000000002',
    }),
    (error: unknown) => {
      if (!(error instanceof ForbiddenException)) return false;
      const response = error.getResponse();
      return typeof response === 'object' && response !== null &&
        'code' in response && response.code === 'PO_DISPATCH_DOCUMENT_VIEW_REQUIRED';
    },
  );
  assert.equal(orderLookups, 0, 'Unauthorized document attachment must fail before PO access');

  // A legitimate text-only reported external dispatch still follows the
  // unchanged normal scoped PO lookup; the guard must not require a grant
  // merely to record a human-observed dispatch reference without a Document.
  await assert.rejects(
    () => sut.record({ auth }, '00000000-0000-4000-8000-000000000001', base),
    /SOURCE_LOOKUP_SENTINEL/,
  );
  assert.equal(orderLookups, 1);
});
