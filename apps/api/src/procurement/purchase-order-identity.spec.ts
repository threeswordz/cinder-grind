import assert from 'node:assert/strict';
import { test } from 'node:test';

import { purchaseOrderCompanyPrefix, purchaseOrderPresentation } from './purchase-order-identity';

test('PUR12: MKE and TCJ company prefixes are distinct from partner codes', () => {
  assert.equal(purchaseOrderCompanyPrefix('MKE'), 'K');
  assert.equal(purchaseOrderCompanyPrefix(' tcj '), 'T');
  assert.equal(purchaseOrderCompanyPrefix('UATCI'), null);
  assert.deepEqual(purchaseOrderPresentation('MKE', 'PO2610-001', ' ABC '), {
    displayNumber: 'K-PO2610-001 ABC',
    supplierShortNameSnapshot: 'ABC',
  });
  assert.deepEqual(purchaseOrderPresentation('TCJ', 'PO2610-001', 'ผู้ขาย ทดสอบ'), {
    displayNumber: 'T-PO2610-001 ผู้ขาย ทดสอบ',
    supplierShortNameSnapshot: 'ผู้ขาย ทดสอบ',
  });
});

test('PUR12: no fabricated supplier short name or historical legacy rewrite', () => {
  assert.deepEqual(purchaseOrderPresentation('TCJ', 'PO2610-002', null), {
    displayNumber: null,
    supplierShortNameSnapshot: null,
  });
  assert.deepEqual(purchaseOrderPresentation('MKE', 'PO2610-002', ' \n '), {
    displayNumber: null,
    supplierShortNameSnapshot: null,
  });
  assert.deepEqual(purchaseOrderPresentation('UATCI', 'PO2610-002', 'ABC'), {
    displayNumber: null,
    supplierShortNameSnapshot: null,
  });
  assert.deepEqual(purchaseOrderPresentation('TCJ', 'PO2610-002', '  A  B  '), {
    displayNumber: 'T-PO2610-002 A B',
    supplierShortNameSnapshot: 'A B',
  });
});
