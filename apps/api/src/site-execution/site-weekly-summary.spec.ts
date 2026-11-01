import assert from 'node:assert/strict';
import test from 'node:test';

import { buildWeeklySiteSummary, isSevenCalendarDays, WeeklySiteReportSource } from './site-weekly-summary';

const from = new Date('2026-10-26T00:00:00.000Z');
const to = new Date('2026-11-01T00:00:00.000Z');
function source(id: string, date: string, status: string, project = 'project-a'): WeeklySiteReportSource {
  void project;
  return {
    id, reportDate: new Date(date + 'T00:00:00.000Z'), status,
    submittedAt: status === 'SUBMITTED' ? new Date(date + 'T09:00:00.000Z') : null,
    createdBy: { id: 'foreman', displayName: 'Foreman' },
    weatherObservation: 'Rain', generalRemarks: 'Planned work observed',
    totalManpower: 5,
    _count: {
      materialUsage: 2, equipmentUsage: 1, progressLines: 1,
      issues: 2, delays: 1, inspections: 3, corrections: 1,
    },
  };
}

test('FM01-A exact seven-calendar-day coverage includes month boundary and source statuses', () => {
  assert.equal(isSevenCalendarDays(from, to), true);
  assert.equal(isSevenCalendarDays(from, new Date('2026-11-02T00:00:00.000Z')), false);
  assert.equal(isSevenCalendarDays(from, new Date('2026-11-01T00:00:00.001Z')), false);

  const result = buildWeeklySiteSummary('project-a', from, to,
    [source('a', '2026-10-28', 'DRAFT'), source('b', '2026-10-26', 'SUBMITTED')],
    [
      { reportId: 'b', activityId: 'act-1', activityCode: 'A1', activityName: 'Wall',
        percentComplete: '25.00', note: 'Observed' },
      { reportId: 'unrelated', activityId: 'act-2', activityCode: 'SECRET',
        activityName: 'No', percentComplete: '99', note: null },
    ]);
  assert.deepEqual(result.days.map(d => d.status),
    ['SUBMITTED', 'MISSING', 'DRAFT', 'MISSING', 'MISSING', 'MISSING', 'MISSING']);
  assert.equal(result.totals.submittedDays, 1);
  assert.equal(result.totals.draftDays, 1);
  assert.equal(result.totals.missingDays, 5);
  assert.equal(result.totals.issues, 4);
  assert.equal(result.totals.delays, 2);
  assert.equal(result.totals.inspections, 6);
  assert.equal(result.reviewState, 'READ_ONLY_NO_APPROVAL');
  assert.equal(result.missingDayMeaning, 'UNKNOWN_WORKDAY_OR_HOLIDAY');
  assert.equal(result.days[0]?.report?.progressObservations.length, 1);
  assert.equal(result.days[0]?.report?.progressObservations[0]?.note, 'Observed');
  assert.equal(result.days[0]?.report?.detailPath, '/site-execution/reports/b');
  assert.equal(result.days[0]?.report?.totalManpower, 5);
  assert.equal(result.days[1]?.report, null);
  assert.equal('finance' in result, false);
  assert.equal('approvedBy' in result, false);
});

test('FM01-A ignores out-of-range reports and progress, rejects invalid week and duplicate source dates', () => {
  const result = buildWeeklySiteSummary('project-a', from, to,
    [source('out', '2026-10-25', 'SUBMITTED')],
    [{ reportId: 'out', activityId: 'act', activityCode: 'X', activityName: 'Outside',
       percentComplete: '100', note: null }]);
  assert.equal(result.totals.recordedDays, 0);
  assert.equal(result.days.every(day => day.report === null), true);
  assert.throws(() => buildWeeklySiteSummary('p', from, new Date('2026-11-02T00:00:00.000Z'), [], []),
    RangeError);
  assert.throws(() => buildWeeklySiteSummary('p', from, to,
    [source('one', '2026-10-26', 'DRAFT'), source('two', '2026-10-26', 'SUBMITTED')], []),
    RangeError);
});
