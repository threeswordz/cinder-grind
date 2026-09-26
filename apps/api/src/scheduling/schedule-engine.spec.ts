import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EngineActivity,
  EngineCalendar,
  EngineDependency,
  ScheduleEngineError,
  assertDependencyGraphAcyclic,
  calculateScheduleAnalysis,
  calculateWorkingDayVariance,
} from './schedule-engine';

function date(value: string) {
  return new Date(value + 'T00:00:00.000Z');
}

function calendar(
  id = 'CAL',
  workingWeekdays = [1, 2, 3, 4, 5],
  holidays: string[] = [],
  timezoneName = 'Asia/Singapore',
  startMinute = 8 * 60,
  endMinute = 17 * 60,
): EngineCalendar {
  return {
    id,
    timezoneName,
    weekdays: [1, 2, 3, 4, 5, 6, 7].map((weekdayNo) => {
      const isWorking = workingWeekdays.includes(weekdayNo);
      return {
        weekdayNo,
        isWorking,
        startMinute: isWorking ? startMinute : null,
        endMinute: isWorking ? endMinute : null,
      };
    }),
    exceptions: holidays.map((value) => ({
      exceptionDate: date(value),
      isWorkingOverride: false,
      startMinute: null,
      endMinute: null,
    })),
  };
}

function activity(
  id: string,
  start: string,
  duration: number,
  options: Partial<EngineActivity> = {},
): EngineActivity {
  return {
    id,
    activityCode: id,
    activityName: id,
    workingCalendarId: 'CAL',
    plannedDurationWorkDays: duration,
    plannedStartDate: date(start),
    plannedFinishDate: date(start),
    isMilestone: false,
    ...options,
  };
}

function dependency(
  predecessorActivityId: string,
  successorActivityId: string,
  dependencyType: EngineDependency['dependencyType'] = 'FS',
  lagWorkDays = 0,
): EngineDependency {
  return {
    predecessorActivityId,
    successorActivityId,
    dependencyType,
    lagWorkDays,
  };
}

test('working-calendar analysis skips holidays and identifies the critical chain', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [calendar('CAL', [1, 2, 3, 4, 5], ['2026-10-07'])],
    activities: [
      activity('A', '2026-10-05', 2, {
        plannedFinishDate: date('2026-10-06'),
      }),
      activity('B', '2026-10-05', 1),
      activity('M', '2026-10-05', 0, {
        isMilestone: true,
      }),
    ],
    dependencies: [
      dependency('A', 'B'),
      dependency('B', 'M'),
    ],
  });

  const byId = new Map(result.activities.map((row) => [row.id, row]));
  assert.equal(byId.get('A')?.calculatedFinishDate, '2026-10-06');
  assert.equal(byId.get('B')?.calculatedStartDate, '2026-10-08');
  assert.equal(byId.get('B')?.calculatedFinishDate, '2026-10-08');
  assert.equal(byId.get('M')?.calculatedStartDate, '2026-10-08');
  assert.equal(byId.get('M')?.calculatedFinishDate, '2026-10-08');
  assert.equal(result.projectFinishDate, '2026-10-08');
  assert.equal(byId.get('A')?.isCritical, true);
  assert.equal(byId.get('B')?.isCritical, true);
  assert.equal(byId.get('M')?.isCritical, true);
});

test('negative lag creates lead time using the successor calendar', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [calendar()],
    activities: [
      activity('A', '2026-10-05', 2, {
        plannedFinishDate: date('2026-10-06'),
      }),
      activity('B', '2026-10-05', 1),
    ],
    dependencies: [dependency('A', 'B', 'FS', -1)],
  });

  const b = result.activities.find((row) => row.id === 'B');
  assert.equal(b?.calculatedStartDate, '2026-10-06');
  assert.equal(b?.calculatedFinishDate, '2026-10-06');
});

test('mixed calendars apply lag on the successor Activity calendar', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [
      calendar('PRED', [1, 2, 3, 4, 5]),
      calendar('SUCC', [6, 7, 1, 2, 3]),
    ],
    activities: [
      activity('A', '2026-10-02', 1, {
        workingCalendarId: 'PRED',
      }),
      activity('B', '2026-10-02', 1, {
        workingCalendarId: 'SUCC',
      }),
    ],
    dependencies: [dependency('A', 'B', 'FS', 1)],
  });

  const b = result.activities.find((row) => row.id === 'B');
  assert.equal(b?.calculatedStartDate, '2026-10-04');
  assert.equal(b?.calculatedFinishDate, '2026-10-04');
});

test('working hours and timezones affect cross-calendar scheduling', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [
      calendar('SG', [1, 2, 3, 4, 5], [], 'Asia/Singapore', 8 * 60, 17 * 60),
      calendar('UTC', [1, 2, 3, 4, 5], [], 'UTC', 8 * 60, 12 * 60),
    ],
    activities: [
      activity('A', '2026-10-02', 1, {
        workingCalendarId: 'SG',
      }),
      activity('B', '2026-10-02', 1, {
        workingCalendarId: 'UTC',
      }),
    ],
    dependencies: [dependency('A', 'B', 'FS', 0)],
  });

  const b = result.activities.find((row) => row.id === 'B');
  assert.equal(b?.calculatedStartDate, '2026-10-02');
  assert.equal(b?.calculatedStartFraction, 0.25);
  assert.equal(b?.calculatedFinishDate, '2026-10-05');
  assert.equal(b?.calculatedFinishFraction, 0.25);
});

test('fractional work days are preserved internally while DATE fields project the containing work date', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [calendar()],
    activities: [
      activity('A', '2026-10-05', 1.5, {
        plannedFinishDate: date('2026-10-06'),
      }),
      activity('B', '2026-10-05', 1),
    ],
    dependencies: [dependency('A', 'B')],
  });

  const a = result.activities.find((row) => row.id === 'A');
  const b = result.activities.find((row) => row.id === 'B');
  assert.equal(a?.calculatedFinishDate, '2026-10-06');
  assert.equal(a?.calculatedFinishFraction, 0.5);
  assert.equal(b?.calculatedStartDate, '2026-10-06');
  assert.equal(b?.calculatedStartFraction, 0.5);
  assert.equal(b?.calculatedFinishDate, '2026-10-07');
  assert.equal(b?.calculatedFinishFraction, 0.5);
});

test('non-critical independent work receives Total Float while the controlling chain remains critical', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [calendar()],
    activities: [
      activity('A', '2026-10-05', 1),
      activity('B', '2026-10-05', 1),
      activity('C', '2026-10-05', 1),
    ],
    dependencies: [dependency('A', 'B')],
  });

  const byId = new Map(result.activities.map((row) => [row.id, row]));
  assert.equal(byId.get('A')?.totalFloatWorkDays, 0);
  assert.equal(byId.get('A')?.isCritical, true);
  assert.equal(byId.get('B')?.totalFloatWorkDays, 0);
  assert.equal(byId.get('B')?.isCritical, true);
  assert.equal(byId.get('C')?.totalFloatWorkDays, 1);
  assert.equal(byId.get('C')?.isCritical, false);
});

test('SS, FF and SF constraints are evaluated without converting them to FS', () => {
  const result = calculateScheduleAnalysis({
    mode: 'planned',
    calendars: [calendar()],
    activities: [
      activity('A', '2026-10-05', 2, {
        plannedFinishDate: date('2026-10-06'),
      }),
      activity('SS', '2026-10-05', 1),
      activity('FF', '2026-10-05', 1),
      activity('SF', '2026-10-05', 0, { isMilestone: true }),
    ],
    dependencies: [
      dependency('A', 'SS', 'SS', 1),
      dependency('A', 'FF', 'FF', 0),
      dependency('A', 'SF', 'SF', 0),
    ],
  });

  const byId = new Map(result.activities.map((row) => [row.id, row]));
  assert.equal(byId.get('SS')?.calculatedStartDate, '2026-10-06');
  assert.equal(byId.get('FF')?.calculatedFinishDate, '2026-10-06');
  assert.equal(byId.get('SF')?.calculatedStartDate, '2026-10-05');
  assert.equal(byId.get('SF')?.calculatedFinishDate, '2026-10-05');
});

test('forecast analysis uses forecast start for root Activities and falls back to planned start', () => {
  const result = calculateScheduleAnalysis({
    mode: 'forecast',
    calendars: [calendar()],
    activities: [
      activity('A', '2026-10-05', 1, {
        forecastStartDate: date('2026-10-08'),
      }),
      activity('B', '2026-10-05', 1),
    ],
    dependencies: [dependency('A', 'B')],
  });

  const byId = new Map(result.activities.map((row) => [row.id, row]));
  assert.equal(byId.get('A')?.calculatedStartDate, '2026-10-08');
  assert.equal(byId.get('B')?.calculatedStartDate, '2026-10-09');
});

test('circular dependency graphs are rejected deterministically', () => {
  assert.throws(
    () =>
      assertDependencyGraphAcyclic(
        ['A', 'B', 'C'],
        [
          dependency('A', 'B'),
          dependency('B', 'C'),
          dependency('C', 'A'),
        ],
      ),
    (error: unknown) =>
      error instanceof ScheduleEngineError &&
      error.code === 'ACTIVITY_DEPENDENCY_CYCLE',
  );
});

test('milestones must have zero duration and one planned date', () => {
  assert.throws(
    () =>
      calculateScheduleAnalysis({
        mode: 'planned',
        calendars: [calendar()],
        activities: [
          activity('M', '2026-10-05', 1, {
            isMilestone: true,
            plannedFinishDate: date('2026-10-05'),
          }),
        ],
        dependencies: [],
      }),
    (error: unknown) =>
      error instanceof ScheduleEngineError &&
      error.code === 'INVALID_MILESTONE_DURATION',
  );

  assert.throws(
    () =>
      calculateScheduleAnalysis({
        mode: 'planned',
        calendars: [calendar()],
        activities: [
          activity('M', '2026-10-05', 0, {
            isMilestone: true,
            plannedFinishDate: date('2026-10-06'),
          }),
        ],
        dependencies: [],
      }),
    (error: unknown) =>
      error instanceof ScheduleEngineError &&
      error.code === 'INVALID_MILESTONE_DATES',
  );
});


test('working-day variance reports signed delay and ahead values', () => {
  const cal = calendar();
  assert.equal(
    calculateWorkingDayVariance(
      cal,
      date('2026-10-05'),
      date('2026-10-07'),
    ),
    2,
  );
  assert.equal(
    calculateWorkingDayVariance(
      cal,
      date('2026-10-07'),
      date('2026-10-05'),
    ),
    -2,
  );
  assert.equal(
    calculateWorkingDayVariance(
      cal,
      date('2026-10-09'),
      date('2026-10-12'),
    ),
    1,
  );
});
