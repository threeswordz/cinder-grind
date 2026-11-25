import assert from 'node:assert/strict';
import test from 'node:test';
import { custodyThailandDay } from './equipment-custody-date';

test('SS11 custody issue/return accepts today in Bangkok when server UTC is still yesterday', () => {
  assert.equal(custodyThailandDay(new Date('2026-11-24T16:59:59.999Z')).toISOString(),
    '2026-11-24T00:00:00.000Z');
  assert.equal(custodyThailandDay(new Date('2026-11-24T17:00:00.000Z')).toISOString(),
    '2026-11-25T00:00:00.000Z');
  assert.equal(custodyThailandDay(new Date('2026-11-24T23:59:59.999Z')).toISOString(),
    '2026-11-25T00:00:00.000Z');
});

test('SS11 same-day cutoff is independent of Singapore/browser midnight and server timezone', () => {
  // 00:00 Singapore is 23:00 on the previous Thailand business date.
  assert.equal(custodyThailandDay(new Date('2026-11-24T16:00:00.000Z')).toISOString(),
    '2026-11-24T00:00:00.000Z');
  // UTC midnight is 07:00 Bangkok, still the same business date.
  assert.equal(custodyThailandDay(new Date('2026-11-25T00:00:00.000Z')).toISOString(),
    '2026-11-25T00:00:00.000Z');
});

test('SS11 Thailand business dates preserve leap-day and reject invalid clock input', () => {
  assert.equal(custodyThailandDay(new Date('2028-02-28T17:00:00.000Z')).toISOString(),
    '2028-02-29T00:00:00.000Z');
  assert.throws(() => custodyThailandDay(new Date('invalid')),
    /SS14_BUSINESS_TIME_INVALID/);
});
