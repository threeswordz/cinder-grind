import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isInLookahead,
  lookaheadWindow,
  scheduleDateKey,
} from './scheduling-presentation';

test('lookahead windows are inclusive 14/28 calendar-day windows', () => {
  const asOf = new Date('2026-09-26T00:00:00.000Z');

  assert.deepEqual(lookaheadWindow(asOf, 14), {
    asOfDate: '2026-09-26',
    endDate: '2026-10-09',
    days: 14,
  });
  assert.deepEqual(lookaheadWindow(asOf, 28), {
    asOfDate: '2026-09-26',
    endDate: '2026-10-23',
    days: 28,
  });
});

test('lookahead inclusion uses inclusive forecast overlap', () => {
  const asOf = new Date('2026-09-26T00:00:00.000Z');

  assert.equal(
    isInLookahead(
      {
        forecastStartDate: '2026-09-20',
        forecastFinishDate: '2026-09-26',
      },
      asOf,
      14,
    ),
    true,
  );
  assert.equal(
    isInLookahead(
      {
        forecastStartDate: '2026-10-09',
        forecastFinishDate: '2026-10-15',
      },
      asOf,
      14,
    ),
    true,
  );
  assert.equal(
    isInLookahead(
      {
        forecastStartDate: '2026-10-10',
        forecastFinishDate: '2026-10-15',
      },
      asOf,
      14,
    ),
    false,
  );
  assert.equal(
    isInLookahead(
      {
        forecastStartDate: '2026-09-01',
        forecastFinishDate: '2026-09-25',
      },
      asOf,
      14,
    ),
    false,
  );
});

test('date key normalization accepts Date and ISO strings', () => {
  assert.equal(
    scheduleDateKey(new Date('2026-09-26T12:00:00.000Z')),
    '2026-09-26',
  );
  assert.equal(
    scheduleDateKey('2026-09-26T23:59:59.000Z'),
    '2026-09-26',
  );
  assert.equal(scheduleDateKey(null), null);
});
