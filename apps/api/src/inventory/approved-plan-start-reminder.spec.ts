import assert from 'node:assert/strict';
import test from 'node:test';
import {
  approvedPlanStartWindow, dayPlus, thailandBusinessDate,
} from './approved-plan-start-reminder';

test('SS14 uses Thailand business calendar, not UTC or server timezone', () => {
  assert.equal(thailandBusinessDate(new Date('2026-11-23T16:59:59Z')), '2026-11-23');
  assert.equal(thailandBusinessDate(new Date('2026-11-23T17:00:00Z')), '2026-11-24');
  assert.equal(thailandBusinessDate(new Date('2026-11-23T23:59:59Z')), '2026-11-24');
  assert.throws(() => thailandBusinessDate(new Date('invalid')), /SS14_BUSINESS_TIME_INVALID/);
});

test('SS14 boundaries: exact day 14, 7 and 0; exclude day 15 and past starts', () => {
  const now = '2026-11-24';
  assert.deepEqual(approvedPlanStartWindow('2026-12-08', now),
    { window: 'WITHIN_14_DAYS', daysUntilStart: 14 });
  assert.deepEqual(approvedPlanStartWindow('2026-12-01', now),
    { window: 'WITHIN_7_DAYS', daysUntilStart: 7 });
  assert.deepEqual(approvedPlanStartWindow('2026-11-24', now),
    { window: 'DUE_TODAY', daysUntilStart: 0 });
  assert.equal(approvedPlanStartWindow('2026-12-09', now), null);
  assert.equal(approvedPlanStartWindow('2026-11-23', now), null);
});

test('SS14 date-only arithmetic handles leap day, month and year transitions', () => {
  assert.equal(dayPlus('2028-02-28', 1).toISOString().slice(0,10), '2028-02-29');
  assert.equal(dayPlus('2026-12-25', 14).toISOString().slice(0,10), '2027-01-08');
  assert.deepEqual(approvedPlanStartWindow('2028-02-29','2028-02-22'),
    { window:'WITHIN_7_DAYS',daysUntilStart:7 });
});

test('SS14 malformed dates and over-wide horizons fail closed', () => {
  assert.throws(() => approvedPlanStartWindow('2026-02-30','2026-02-15'),
    /SS14_PLAN_DATE_INVALID/);
  assert.throws(() => approvedPlanStartWindow('2026-12-01','2026-11-32'),
    /SS14_PLAN_DATE_INVALID/);
  assert.throws(() => dayPlus('2026-11-24', 15), /SS14_DATE_RANGE_INVALID/);
  assert.throws(() => dayPlus('0000-01-01', 14), /SS14_DATE_RANGE_INVALID/);
});
