import assert from 'node:assert/strict';
import test from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';

import {
  validateCurrencyCode,
  validateSystemSettingKey,
} from './admin-validation';

test('THB operating currency is normalized and foreign overrides are rejected', () => {
  assert.equal(validateCurrencyCode('thb'), 'THB');
  for (const currency of ['sgd', 'SGD', 'USD', '']) {
    assert.throws(() => validateCurrencyCode(currency), UnprocessableEntityException);
  }
});

test('system settings reject secret-like keys', () => {
  assert.throws(
    () => validateSystemSettingKey('auth.api_token'),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );

  assert.equal(
    validateSystemSettingKey('ui.default_page_size'),
    'ui.default_page_size',
  );
});
