const EPSILON = 1e-9;
const SEARCH_LIMIT_DAYS = 36600;

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type ScheduleMode = 'planned' | 'forecast';

export type EngineCalendar = {
  id: string;
  weekdays: Array<{ weekdayNo: number; isWorking: boolean }>;
  exceptions: Array<{
    exceptionDate: Date;
    isWorkingOverride: boolean;
  }>;
};

export type EngineActivity = {
  id: string;
  activityCode: string;
  activityName: string;
  workingCalendarId: string;
  plannedDurationWorkDays: number;
  plannedStartDate: Date;
  plannedFinishDate: Date;
  forecastStartDate?: Date | null;
  forecastFinishDate?: Date | null;
  isMilestone: boolean;
};

export type EngineDependency = {
  id?: string;
  predecessorActivityId: string;
  successorActivityId: string;
  dependencyType: DependencyType;
  lagWorkDays: number;
};

export type ScheduleActivityResult = {
  id: string;
  activityCode: string;
  activityName: string;
  calculatedStartDate: string;
  calculatedFinishDate: string;
  calculatedStartFraction: number;
  calculatedFinishFraction: number;
  totalFloatWorkDays: number;
  isCritical: boolean;
};

export type ScheduleAnalysis = {
  mode: ScheduleMode;
  projectFinishDate: string | null;
  projectFinishFraction: number | null;
  activities: ScheduleActivityResult[];
};

type WorkPoint = {
  date: Date;
  fraction: number;
};

type InternalResult = {
  activity: EngineActivity;
  start: WorkPoint;
  finish: WorkPoint;
  latestStart: WorkPoint;
  latestFinish: WorkPoint;
};

export class ScheduleEngineError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScheduleEngineError';
  }
}

export function assertDependencyGraphAcyclic(
  activityIds: string[],
  dependencies: EngineDependency[],
): string[] {
  const ids = new Set(activityIds);
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const id of activityIds) {
    incoming.set(id, 0);
    outgoing.set(id, []);
  }

  for (const dependency of dependencies) {
    if (
      !ids.has(dependency.predecessorActivityId) ||
      !ids.has(dependency.successorActivityId)
    ) {
      throw new ScheduleEngineError(
        'ACTIVITY_DEPENDENCY_ENDPOINT_MISSING',
        'Every dependency endpoint must reference an Activity in the schedule.',
      );
    }
    outgoing
      .get(dependency.predecessorActivityId)!
      .push(dependency.successorActivityId);
    incoming.set(
      dependency.successorActivityId,
      (incoming.get(dependency.successorActivityId) ?? 0) + 1,
    );
  }

  const queue = activityIds.filter((id) => (incoming.get(id) ?? 0) === 0);
  const ordered: string[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const successor of outgoing.get(id) ?? []) {
      const next = (incoming.get(successor) ?? 0) - 1;
      incoming.set(successor, next);
      if (next === 0) queue.push(successor);
    }
  }

  if (ordered.length !== activityIds.length) {
    throw new ScheduleEngineError(
      'ACTIVITY_DEPENDENCY_CYCLE',
      'Activity dependencies cannot contain a circular dependency.',
    );
  }

  return ordered;
}

export function calculateScheduleAnalysis(input: {
  mode: ScheduleMode;
  activities: EngineActivity[];
  dependencies: EngineDependency[];
  calendars: EngineCalendar[];
}): ScheduleAnalysis {
  if (input.activities.length === 0) {
    return {
      mode: input.mode,
      projectFinishDate: null,
      projectFinishFraction: null,
      activities: [],
    };
  }

  const activities = new Map(input.activities.map((row) => [row.id, row]));
  const calendars = new Map(input.calendars.map((row) => [row.id, row]));

  for (const activity of input.activities) {
    if (!calendars.has(activity.workingCalendarId)) {
      throw new ScheduleEngineError(
        'ACTIVITY_CALENDAR_MISSING',
        'Every scheduled Activity must have an available Working Calendar.',
      );
    }
    if (
      !Number.isFinite(activity.plannedDurationWorkDays) ||
      activity.plannedDurationWorkDays < 0
    ) {
      throw new ScheduleEngineError(
        'INVALID_ACTIVITY_DURATION',
        'Activity duration must be a non-negative finite number.',
      );
    }
    if (
      activity.isMilestone &&
      Math.abs(activity.plannedDurationWorkDays) > EPSILON
    ) {
      throw new ScheduleEngineError(
        'INVALID_MILESTONE_DURATION',
        'A milestone must have zero work-day duration.',
      );
    }
    if (
      activity.isMilestone &&
      dateKey(activity.plannedStartDate) !== dateKey(activity.plannedFinishDate)
    ) {
      throw new ScheduleEngineError(
        'INVALID_MILESTONE_DATES',
        'A milestone planned start and planned finish must be the same date.',
      );
    }
  }

  const order = assertDependencyGraphAcyclic(
    input.activities.map((row) => row.id),
    input.dependencies,
  );

  const incoming = new Map<string, EngineDependency[]>();
  const outgoing = new Map<string, EngineDependency[]>();
  for (const activity of input.activities) {
    incoming.set(activity.id, []);
    outgoing.set(activity.id, []);
  }
  for (const dependency of input.dependencies) {
    incoming.get(dependency.successorActivityId)!.push(dependency);
    outgoing.get(dependency.predecessorActivityId)!.push(dependency);
  }

  const internal = new Map<string, InternalResult>();

  for (const id of order) {
    const activity = activities.get(id)!;
    const calendar = calendars.get(activity.workingCalendarId)!;
    const predecessors = incoming.get(id) ?? [];
    let start: WorkPoint;

    if (predecessors.length === 0) {
      start = rootAnchor(activity, calendar, input.mode);
    } else {
      let constrained: WorkPoint | undefined;
      for (const dependency of predecessors) {
        const predecessor = internal.get(dependency.predecessorActivityId);
        if (!predecessor) {
          throw new ScheduleEngineError(
            'SCHEDULE_ORDER_ERROR',
            'Predecessor schedule result was not available.',
          );
        }
        const event =
          dependency.dependencyType === 'FS' ||
          dependency.dependencyType === 'FF'
            ? predecessor.finish
            : predecessor.start;
        const shifted = addWork(
          calendar,
          mapPointToCalendar(
            calendar,
            event,
            dependency.lagWorkDays < 0 ? -1 : 1,
          ),
          dependency.lagWorkDays,
        );

        const candidate =
          dependency.dependencyType === 'FS' ||
          dependency.dependencyType === 'SS'
            ? normalizeActivityStart(
                calendar,
                shifted,
                activity.plannedDurationWorkDays,
              )
            : normalizeActivityStart(
                calendar,
                addWork(
                  calendar,
                  shifted,
                  -activity.plannedDurationWorkDays,
                ),
                activity.plannedDurationWorkDays,
              );

        if (!constrained || comparePoints(candidate, constrained) > 0) {
          constrained = candidate;
        }
      }
      start =
        constrained ??
        rootAnchor(activity, calendar, input.mode);
    }

    const finish =
      activity.plannedDurationWorkDays <= EPSILON
        ? clonePoint(start)
        : addWork(calendar, start, activity.plannedDurationWorkDays);

    internal.set(id, {
      activity,
      start,
      finish,
      latestStart: clonePoint(start),
      latestFinish: clonePoint(finish),
    });
  }

  let projectFinish: WorkPoint | undefined;
  for (const row of internal.values()) {
    if (!projectFinish || comparePoints(row.finish, projectFinish) > 0) {
      projectFinish = clonePoint(row.finish);
    }
  }
  if (!projectFinish) {
    throw new ScheduleEngineError(
      'SCHEDULE_EMPTY',
      'Schedule analysis did not produce a Project finish.',
    );
  }

  for (const id of order) {
    const row = internal.get(id)!;
    const calendar = calendars.get(row.activity.workingCalendarId)!;
    const latestFinish = mapPointToCalendar(calendar, projectFinish, -1);
    const latestStart =
      row.activity.plannedDurationWorkDays <= EPSILON
        ? clonePoint(latestFinish)
        : addWork(
            calendar,
            latestFinish,
            -row.activity.plannedDurationWorkDays,
          );
    row.latestStart = latestStart;
    row.latestFinish = latestFinish;
  }

  for (const id of [...order].reverse()) {
    const row = internal.get(id)!;
    const calendar = calendars.get(row.activity.workingCalendarId)!;
    let latestStart = clonePoint(row.latestStart);

    for (const dependency of outgoing.get(id) ?? []) {
      const successor = internal.get(dependency.successorActivityId)!;
      const successorCalendar = calendars.get(
        successor.activity.workingCalendarId,
      )!;
      const successorEvent =
        dependency.dependencyType === 'FS' ||
        dependency.dependencyType === 'SS'
          ? successor.latestStart
          : successor.latestFinish;

      const beforeLag = addWork(
        successorCalendar,
        mapPointToCalendar(
          successorCalendar,
          successorEvent,
          dependency.lagWorkDays < 0 ? 1 : -1,
        ),
        -dependency.lagWorkDays,
      );

      let candidateStart: WorkPoint;
      if (
        dependency.dependencyType === 'FS' ||
        dependency.dependencyType === 'FF'
      ) {
        const predecessorFinishBound = mapPointToCalendar(
          calendar,
          beforeLag,
          -1,
        );
        candidateStart =
          row.activity.plannedDurationWorkDays <= EPSILON
            ? predecessorFinishBound
            : addWork(
                calendar,
                predecessorFinishBound,
                -row.activity.plannedDurationWorkDays,
              );
      } else {
        candidateStart = mapPointToCalendar(calendar, beforeLag, -1);
      }

      if (comparePoints(candidateStart, latestStart) < 0) {
        latestStart = candidateStart;
      }
    }

    row.latestStart = latestStart;
    row.latestFinish =
      row.activity.plannedDurationWorkDays <= EPSILON
        ? clonePoint(latestStart)
        : addWork(
            calendar,
            latestStart,
            row.activity.plannedDurationWorkDays,
          );
  }

  const results = order.map((id) => {
    const row = internal.get(id)!;
    const calendar = calendars.get(row.activity.workingCalendarId)!;
    const totalFloat = Math.max(
      0,
      round2(workDistance(calendar, row.start, row.latestStart)),
    );
    return {
      id: row.activity.id,
      activityCode: row.activity.activityCode,
      activityName: row.activity.activityName,
      calculatedStartDate: dateKey(row.start.date),
      calculatedFinishDate: displayFinishDate(
        calendar,
        row.finish,
        row.activity.plannedDurationWorkDays,
      ),
      calculatedStartFraction: round4(row.start.fraction),
      calculatedFinishFraction: round4(row.finish.fraction),
      totalFloatWorkDays: totalFloat,
      isCritical: Math.abs(totalFloat) < 0.005,
    };
  });

  const projectFinishOwner = [...internal.values()].find(
    (row) => comparePoints(row.finish, projectFinish!) === 0,
  );
  const projectFinishCalendar = projectFinishOwner
    ? calendars.get(projectFinishOwner.activity.workingCalendarId)!
    : calendars.values().next().value as EngineCalendar;

  return {
    mode: input.mode,
    projectFinishDate: displayFinishDate(
      projectFinishCalendar,
      projectFinish,
      projectFinishOwner?.activity.plannedDurationWorkDays ?? 0,
    ),
    projectFinishFraction: round4(projectFinish.fraction),
    activities: results,
  };
}

function rootAnchor(
  activity: EngineActivity,
  calendar: EngineCalendar,
  mode: ScheduleMode,
): WorkPoint {
  const date =
    mode === 'forecast' && activity.forecastStartDate
      ? activity.forecastStartDate
      : activity.plannedStartDate;
  return normalizeActivityStart(
    calendar,
    { date: day(date), fraction: 0 },
    activity.plannedDurationWorkDays,
  );
}

function normalizeActivityStart(
  calendar: EngineCalendar,
  point: WorkPoint,
  duration: number,
): WorkPoint {
  let current = mapPointToCalendar(calendar, point, 1);
  if (duration > EPSILON && current.fraction >= 1 - EPSILON) {
    current = findWorkingBoundary(
      calendar,
      { date: addDays(current.date, 1), fraction: 0 },
      1,
    );
  }
  return current;
}

function addWork(
  calendar: EngineCalendar,
  point: WorkPoint,
  amount: number,
): WorkPoint {
  if (!Number.isFinite(amount)) {
    throw new ScheduleEngineError(
      'INVALID_WORK_OFFSET',
      'Work-day offsets must be finite numbers.',
    );
  }

  let current = mapPointToCalendar(
    calendar,
    point,
    amount < 0 ? -1 : 1,
  );
  let remaining = Math.abs(amount);
  if (remaining <= EPSILON) return current;

  const direction = amount < 0 ? -1 : 1;
  let guard = 0;

  while (remaining > EPSILON) {
    if (++guard > SEARCH_LIMIT_DAYS * 4) {
      throw unusableCalendar();
    }

    if (!isWorkingDate(calendar, current.date)) {
      current = findWorkingBoundary(calendar, current, direction);
      continue;
    }

    if (direction > 0) {
      if (current.fraction >= 1 - EPSILON) {
        current = findWorkingBoundary(
          calendar,
          { date: addDays(current.date, 1), fraction: 0 },
          1,
        );
        continue;
      }
      const available = 1 - current.fraction;
      const consumed = Math.min(available, remaining);
      current.fraction += consumed;
      remaining -= consumed;
    } else {
      if (current.fraction <= EPSILON) {
        current = findWorkingBoundary(
          calendar,
          { date: addDays(current.date, -1), fraction: 1 },
          -1,
        );
        continue;
      }
      const available = current.fraction;
      const consumed = Math.min(available, remaining);
      current.fraction -= consumed;
      remaining -= consumed;
    }
  }

  current.fraction = clampFraction(current.fraction);
  return current;
}

function workDistance(
  calendar: EngineCalendar,
  from: WorkPoint,
  to: WorkPoint,
): number {
  const comparison = comparePoints(from, to);
  if (comparison === 0) return 0;
  if (comparison > 0) return -workDistance(calendar, to, from);

  let cursor = day(from.date);
  const end = day(to.date);
  let total = 0;
  let guard = 0;

  while (cursor.getTime() <= end.getTime()) {
    if (++guard > SEARCH_LIMIT_DAYS) throw unusableCalendar();
    if (isWorkingDate(calendar, cursor)) {
      const sameStart = cursor.getTime() === day(from.date).getTime();
      const sameEnd = cursor.getTime() === end.getTime();
      const startFraction = sameStart ? from.fraction : 0;
      const endFraction = sameEnd ? to.fraction : 1;
      total += Math.max(0, endFraction - startFraction);
    }
    cursor = addDays(cursor, 1);
  }

  return total;
}

function displayFinishDate(
  calendar: EngineCalendar,
  finish: WorkPoint,
  duration: number,
): string {
  if (duration <= EPSILON) return dateKey(finish.date);
  if (finish.fraction > EPSILON) return dateKey(finish.date);

  let cursor = addDays(finish.date, -1);
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    if (isWorkingDate(calendar, cursor)) return dateKey(cursor);
    cursor = addDays(cursor, -1);
  }
  throw unusableCalendar();
}

function mapPointToCalendar(
  calendar: EngineCalendar,
  point: WorkPoint,
  direction: 1 | -1,
): WorkPoint {
  const normalized = {
    date: day(point.date),
    fraction: clampFraction(point.fraction),
  };
  if (isWorkingDate(calendar, normalized.date)) return normalized;
  return findWorkingBoundary(calendar, normalized, direction);
}

function findWorkingBoundary(
  calendar: EngineCalendar,
  point: WorkPoint,
  direction: 1 | -1,
): WorkPoint {
  let cursor = day(point.date);
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    if (isWorkingDate(calendar, cursor)) {
      return {
        date: cursor,
        fraction: direction > 0 ? 0 : 1,
      };
    }
    cursor = addDays(cursor, direction);
  }
  throw unusableCalendar();
}

function isWorkingDate(calendar: EngineCalendar, date: Date): boolean {
  const key = dateKey(date);
  const exception = calendar.exceptions.find(
    (row) => dateKey(row.exceptionDate) === key,
  );
  if (exception) return exception.isWorkingOverride;

  const weekdayNo = ((date.getUTCDay() + 6) % 7) + 1;
  return (
    calendar.weekdays.find((row) => row.weekdayNo === weekdayNo)?.isWorking ??
    false
  );
}

function comparePoints(left: WorkPoint, right: WorkPoint): number {
  const dateDifference = day(left.date).getTime() - day(right.date).getTime();
  if (dateDifference !== 0) return dateDifference < 0 ? -1 : 1;
  const fractionDifference = left.fraction - right.fraction;
  if (Math.abs(fractionDifference) <= EPSILON) return 0;
  return fractionDifference < 0 ? -1 : 1;
}

function day(value: Date): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear(),
      value.getUTCMonth(),
      value.getUTCDate(),
    ),
  );
}

function addDays(value: Date, amount: number): Date {
  const result = day(value);
  result.setUTCDate(result.getUTCDate() + amount);
  return result;
}

function dateKey(value: Date): string {
  return day(value).toISOString().slice(0, 10);
}

function clampFraction(value: number): number {
  if (Math.abs(value) <= EPSILON) return 0;
  if (Math.abs(value - 1) <= EPSILON) return 1;
  return Math.max(0, Math.min(1, value));
}

function clonePoint(point: WorkPoint): WorkPoint {
  return { date: new Date(point.date.getTime()), fraction: point.fraction };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function unusableCalendar() {
  return new ScheduleEngineError(
    'WORKING_CALENDAR_HAS_NO_WORKING_TIME',
    'The Working Calendar does not provide a usable working day in the supported search horizon.',
  );
}
