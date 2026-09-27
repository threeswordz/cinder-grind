import assert from 'node:assert/strict';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';

import { procurementDecimal } from './procurement-validation';

test('Purchase Request quantity validation respects DECIMAL(18,4) magnitude', () => {
  assert.equal(
    procurementDecimal('99999999999999.9999', 'quantity').toString(),
    '99999999999999.9999',
  );

  assert.throws(
    () => procurementDecimal('100000000000000', 'quantity'),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );

  assert.throws(
    () => procurementDecimal('99999999999999.99999', 'quantity'),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );
});
