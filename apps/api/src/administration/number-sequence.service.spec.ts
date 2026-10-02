import assert from 'node:assert/strict';
import test from 'node:test';
import { ConflictException } from '@nestjs/common';

import {
  formatBusinessNumber,
  normalizeResetRule,
  NumberSequenceService,
  validateFormatTemplate,
} from './number-sequence.service';

test('formats the approved POYYMM-### style', () => {
  assert.equal(
    formatBusinessNumber(
      validateFormatTemplate('POYYMM-###'),
      4,
      new Date('2026-04-15T00:00:00Z'),
    ),
    'PO2604-004',
  );
});

test('formats the approved PAYYYMM-### style without consuming the literal Y prefix', () => {
  assert.equal(
    formatBusinessNumber(
      validateFormatTemplate('PAYYYMM-###'),
      1,
      new Date('2026-10-03T00:00:00Z'),
    ),
    'PAY2610-001',
  );
});

test('supports controlled reset rules only', () => {
  assert.equal(normalizeResetRule('monthly'), 'MONTHLY');
  assert.throws(() => normalizeResetRule('WEEKLY'));
});

test('sequence configuration becomes immutable after use', () => {
  const service = new NumberSequenceService({} as never);

  assert.doesNotThrow(() => service.assertCreatable('CUSTOM_SEQUENCE'));
  assert.doesNotThrow(() => service.assertCreatable('constructor'));
  assert.doesNotThrow(() => service.assertCreatable('__proto__'));
  assert.throws(
    () => service.assertCreatable('SUBCONTRACT_AGREEMENT'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.throws(
    () => service.assertCreatable('CLIENT_INVOICE'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.throws(
    () => service.assertCreatable('PAYMENT'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.doesNotThrow(() => service.assertEditable(1, null));
  assert.throws(
    () => service.assertEditable(1, null, 'SUBCONTRACT_AGREEMENT'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.throws(
    () => service.assertEditable(1, null, 'CLIENT_INVOICE'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.throws(
    () => service.assertEditable(1, null, 'PAYMENT'),
    (error: unknown) => error instanceof ConflictException,
  );
  assert.throws(
    () => service.assertEditable(2, null),
    (error: unknown) => error instanceof ConflictException,
  );
});
