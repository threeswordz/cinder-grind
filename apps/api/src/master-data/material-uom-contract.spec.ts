import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { exactUomQuantity, uomDate, uomPrepare, uomPreview, uomRatio, uomRevise } from './material-uom-contract';

test('material ratios are exact reduced positive integers without floating point or inferred units', () => {
  assert.deepEqual(uomRatio('200', '10'), { numerator: '20', denominator: '1' });
  assert.deepEqual(uomRatio('1', '3'), { numerator: '1', denominator: '3' });
  for (const n of ['0', '-1', '1.5', '01', '1e2', '9'.repeat(39), 20, null]) assert.throws(() => uomRatio(n, '1'));
  assert.throws(() => uomRatio('1', '0'));
});
test('normalization rejects residuals and respects both unit precisions and DECIMAL bounds', () => {
  assert.deepEqual(exactUomQuantity('2', 0, 0, '20', '1'), { enteredQuantity: '2.0000', stockQuantity: '40.0000' });
  assert.equal(exactUomQuantity('3', 0, 4, '1', '3').stockQuantity, '1.0000');
  assert.equal(exactUomQuantity('0.0001', 4, 4, '1', '1').stockQuantity, '0.0001');
  assert.equal(exactUomQuantity('99999999999999.9999', 4, 4, '1', '1').stockQuantity, '99999999999999.9999');
  for (const [q, source, stock, n, d] of [['1', 0, 4, '1', '3'], ['0.1', 0, 4, '20', '1'], ['0.1', 4, 0, '1', '1'], ['99999999999999.9999', 4, 4, '2', '1']] as const) assert.throws(() => exactUomQuantity(q, source, stock, n, d));
  for (const q of ['0', '-1', '01', '1e3', '1.00001', '100000000000000', ' 1 ']) assert.throws(() => exactUomQuantity(q, 4, 4, '1', '1'));
});
test('conversion business dates are explicit valid calendar dates', () => {
  for (const date of ['0001-01-01', '2028-02-29', '9999-12-31']) assert.equal(uomDate(date), date);
  for (const date of [undefined, '', '0000-01-01', '2026-02-29', '2026-04-31', '2026-1-1', '2026-01-01T00:00:00Z']) assert.throws(() => uomDate(date));
});
test('mutation and preview contracts reject extra identifiers, implicit dates and stale-version shapes', () => {
  const requestKey = randomUUID(), stockUomId = randomUUID(), sourceUomId = randomUUID();
  assert.equal(uomPrepare({ requestKey, stockUomId, reason: ' Explicit basis ' }).reason, 'Explicit basis');
  assert.equal(uomRevise({ requestKey, expectedVersion: 1, sourceUomId, effectiveFrom: '2026-01-01', numerator: '40', denominator: '2', reason: 'Versioned definition' }).numerator, '20');
  assert.equal(uomPreview({ sourceUomId, businessDate: '2026-01-01', quantity: '2' }).quantity, '2.0000');
  assert.throws(() => uomPrepare({ requestKey, stockUomId, reason: 'x', companyId: randomUUID() }));
  assert.throws(() => uomRevise({ requestKey, expectedVersion: '1', sourceUomId, effectiveFrom: '2026-01-01', numerator: '1', denominator: '1', reason: 'x' }));
  assert.throws(() => uomPreview({ sourceUomId, quantity: '2' }));
});
