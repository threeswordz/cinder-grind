import assert from 'node:assert/strict';
import test from 'node:test';
import { UnprocessableEntityException } from '@nestjs/common';

import {
  validateCurrencyCode,
  validateSystemSettingKey,
} from './admin-validation';

test('currency code is normalized to uppercase', () => {
  assert.equal(validateCurrencyCode('sgd'), 'SGD');
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
