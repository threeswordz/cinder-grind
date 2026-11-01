import assert from 'node:assert/strict';
import test from 'node:test';
import { hrPrivateFields, safeHrPrivateValues } from '../hr/hr-private-projection.ts';

test('private HR masked projection fails closed on unexpected fields or plaintext', () => {
  const masked = { identityNumber: '••••', passportNumber: '••••' };
  assert.deepEqual(safeHrPrivateValues('identity', masked, true), masked);
  assert.throws(() => safeHrPrivateValues('identity', { identityNumber: 'PRIVATE_NUMBER' }, true));
  assert.throws(() => safeHrPrivateValues('identity', { bankName: '••••' }, true));
  assert.throws(() => safeHrPrivateValues('bank', { accountNumber: '••••', salaryAmount: '••••' }, true));
  assert.throws(() => safeHrPrivateValues('bank', ['••••'], true));
  assert.throws(() => safeHrPrivateValues('identity', null, true));
  assert.throws(() => safeHrPrivateValues('identity', { identityNumber: 7 }, true));
  assert.throws(() => safeHrPrivateValues('identity', { identityNumber: '••••', rawValues: 'SECRET' }, true));
});

test('explicit private reveal only permits category-known string fields', () => {
  assert.deepEqual(safeHrPrivateValues('bank', { accountNumber: 'SYNTHETIC_PRIVATE' }, false),
    { accountNumber: 'SYNTHETIC_PRIVATE' });
  assert.throws(() => safeHrPrivateValues('bank', { identityNumber: 'SYNTHETIC_PRIVATE' }, false));
  assert.throws(() => safeHrPrivateValues('bank', { accountNumber: null }, false));
  assert.ok(hrPrivateFields.identity.includes('dateOfBirth'));
  assert.ok(hrPrivateFields.bank.includes('accountHolder'));
});
