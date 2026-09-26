const EPSILON = 1e-9;
const EPSILON_MS = 1;
const SEARCH_LIMIT_DAYS = 36600;

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type ScheduleMode = 'planned' | 'forecast';

export type EngineCalendar = {
  id: string;
  timezoneName: string;
  weekdays: Array<{
    weekdayNo: number;
    isWorking: boolean;
    startMinute: number | null;
    endMinute: number | null;
  }>;
  exceptions: Array<{
    exceptionDate: Date;
    isWorkingOverride: boolean;
    startMinute: number | null;
    endMinute: number | null;
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

type InternalResult = {
  activity: EngineActivity;
  start: number;
  finish: number;
  latestStart: number;
  latestFinish: number;
};

type WorkInterval = {
  dateKey: string;
  start: number;
  end: number;
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

  for (const calendar of calendars.values()) validateCalendar(calendar);

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
      utcDateKey(activity.plannedStartDate) !==
        utcDateKey(activity.plannedFinishDate)
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
    let start: number;

    if (predecessors.length === 0) {
      start = rootAnchor(activity, calendar, input.mode);
    } else {
      let constrained: number | undefined;

      for (const dependency of predecessors) {
        const predecessor = internal.get(dependency.predecessorActivityId);
        if (!predecessor) {
          throw new ScheduleEngineError(
            'SCHEDULE_ORDER_ERROR',
            'Predecessor schedule result was not available.',
          );
        }

        const predecessorEvent =
          dependency.dependencyType === 'FS' ||
          dependency.dependencyType === 'FF'
            ? predecessor.finish
            : predecessor.start;

        const mappedEvent = mapInstantToCalendar(
          calendar,
          predecessorEvent,
          dependency.lagWorkDays < 0 ? -1 : 1,
        );
        const shifted = addWork(
          calendar,
          mappedEvent,
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

        if (constrained === undefined || candidate > constrained) {
          constrained = candidate;
        }
      }

      start =
        constrained ??
        rootAnchor(activity, calendar, input.mode);
    }

    const finish =
      activity.plannedDurationWorkDays <= EPSILON
        ? start
        : addWork(calendar, start, activity.plannedDurationWorkDays);

    internal.set(id, {
      activity,
      start,
      finish,
      latestStart: start,
      latestFinish: finish,
    });
  }

  let projectFinish: number | undefined;
  let projectFinishOwner: InternalResult | undefined;
  for (const row of internal.values()) {
    if (projectFinish === undefined || row.finish > projectFinish) {
      projectFinish = row.finish;
      projectFinishOwner = row;
    }
  }
  if (projectFinish === undefined || !projectFinishOwner) {
    throw new ScheduleEngineError(
      'SCHEDULE_EMPTY',
      'Schedule analysis did not produce a Project finish.',
    );
  }

  for (const id of order) {
    const row = internal.get(id)!;
    const calendar = calendars.get(row.activity.workingCalendarId)!;
    const latestFinish = mapInstantToCalendar(calendar, projectFinish, -1);
    const latestStart =
      row.activity.plannedDurationWorkDays <= EPSILON
        ? latestFinish
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
    let latestStart = row.latestStart;

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

      const mappedSuccessorEvent = mapInstantToCalendar(
        successorCalendar,
        successorEvent,
        dependency.lagWorkDays < 0 ? 1 : -1,
      );
      const beforeLag = addWork(
        successorCalendar,
        mappedSuccessorEvent,
        -dependency.lagWorkDays,
      );

      let candidateStart: number;
      if (
        dependency.dependencyType === 'FS' ||
        dependency.dependencyType === 'FF'
      ) {
        const predecessorFinishBound = mapInstantToCalendar(
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
        candidateStart = mapInstantToCalendar(calendar, beforeLag, -1);
      }

      if (candidateStart < latestStart) latestStart = candidateStart;
    }

    row.latestStart = latestStart;
    row.latestFinish =
      row.activity.plannedDurationWorkDays <= EPSILON
        ? latestStart
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
      calculatedStartDate: localDateKey(calendar, row.start),
      calculatedFinishDate: localDateKey(calendar, row.finish),
      calculatedStartFraction: round4(intervalFraction(calendar, row.start)),
      calculatedFinishFraction: round4(intervalFraction(calendar, row.finish)),
      totalFloatWorkDays: totalFloat,
      isCritical: Math.abs(totalFloat) < 0.005,
    };
  });

  const ownerCalendar = calendars.get(
    projectFinishOwner.activity.workingCalendarId,
  )!;

  return {
    mode: input.mode,
    projectFinishDate: localDateKey(ownerCalendar, projectFinish),
    projectFinishFraction: round4(
      intervalFraction(ownerCalendar, projectFinish),
    ),
    activities: results,
  };
}

function rootAnchor(
  activity: EngineActivity,
  calendar: EngineCalendar,
  mode: ScheduleMode,
): number {
  const sourceDate =
    mode === 'forecast' && activity.forecastStartDate
      ? activity.forecastStartDate
      : activity.plannedStartDate;
  const interval = findWorkingInterval(
    calendar,
    utcDateKey(sourceDate),
    1,
    true,
  );
  return normalizeActivityStart(
    calendar,
    interval.start,
    activity.plannedDurationWorkDays,
  );
}

function normalizeActivityStart(
  calendar: EngineCalendar,
  instant: number,
  duration: number,
): number {
  let current = mapInstantToCalendar(calendar, instant, 1);
  const interval = intervalAtInstant(calendar, current);
  if (
    duration > EPSILON &&
    interval &&
    current >= interval.end - EPSILON_MS
  ) {
    current = findWorkingInterval(
      calendar,
      addDateKey(interval.dateKey, 1),
      1,
      true,
    ).start;
  }
  return current;
}

function addWork(
  calendar: EngineCalendar,
  instant: number,
  amount: number,
): number {
  if (!Number.isFinite(amount)) {
    throw new ScheduleEngineError(
      'INVALID_WORK_OFFSET',
      'Work-day offsets must be finite numbers.',
    );
  }

  const direction: 1 | -1 = amount < 0 ? -1 : 1;
  let current = mapInstantToCalendar(calendar, instant, direction);
  let remaining = Math.abs(amount);
  if (remaining <= EPSILON) return current;

  let guard = 0;
  while (remaining > EPSILON) {
    if (++guard > SEARCH_LIMIT_DAYS * 4) throw unusableCalendar();

    let interval = intervalAtInstant(calendar, current);
    if (!interval) {
      current = mapInstantToCalendar(calendar, current, direction);
      interval = intervalAtInstant(calendar, current);
      if (!interval) throw unusableCalendar();
    }

    const length = interval.end - interval.start;
    if (length <= 0) throw invalidInterval();

    if (direction > 0) {
      if (current >= interval.end - EPSILON_MS) {
        current = findWorkingInterval(
          calendar,
          addDateKey(interval.dateKey, 1),
          1,
          true,
        ).start;
        continue;
      }
      const available = (interval.end - current) / length;
      const consumed = Math.min(available, remaining);
      current += consumed * length;
      remaining -= consumed;
    } else {
      if (current <= interval.start + EPSILON_MS) {
        current = findWorkingInterval(
          calendar,
          addDateKey(interval.dateKey, -1),
          -1,
          true,
        ).end;
        continue;
      }
      const available = (current - interval.start) / length;
      const consumed = Math.min(available, remaining);
      current -= consumed * length;
      remaining -= consumed;
    }
  }

  return Math.round(current);
}

function workDistance(
  calendar: EngineCalendar,
  from: number,
  to: number,
): number {
  if (Math.abs(from - to) <= EPSILON_MS) return 0;
  if (from > to) return -workDistance(calendar, to, from);

  let current = mapInstantToCalendar(calendar, from, 1);
  let total = 0;
  let guard = 0;

  while (current < to - EPSILON_MS) {
    if (++guard > SEARCH_LIMIT_DAYS * 4) throw unusableCalendar();
    const interval = intervalAtInstant(calendar, current);
    if (!interval) {
      current = mapInstantToCalendar(calendar, current, 1);
      continue;
    }

    const length = interval.end - interval.start;
    const end = Math.min(interval.end, to);
    if (end > current) total += (end - current) / length;
    if (end >= to - EPSILON_MS) break;

    current = findWorkingInterval(
      calendar,
      addDateKey(interval.dateKey, 1),
      1,
      true,
    ).start;
  }

  return total;
}

function mapInstantToCalendar(
  calendar: EngineCalendar,
  instant: number,
  direction: 1 | -1,
): number {
  const key = localDateKey(calendar, instant);
  const interval = intervalForDate(calendar, key);

  if (interval) {
    if (instant < interval.start) {
      if (direction > 0) return interval.start;
      return findWorkingInterval(
        calendar,
        addDateKey(key, -1),
        -1,
        true,
      ).end;
    }
    if (instant > interval.end) {
      if (direction < 0) return interval.end;
      return findWorkingInterval(
        calendar,
        addDateKey(key, 1),
        1,
        true,
      ).start;
    }
    return instant;
  }

  return findWorkingInterval(
    calendar,
    addDateKey(key, direction),
    direction,
    true,
  )[direction > 0 ? 'start' : 'end'];
}

function intervalAtInstant(
  calendar: EngineCalendar,
  instant: number,
): WorkInterval | null {
  const interval = intervalForDate(
    calendar,
    localDateKey(calendar, instant),
  );
  if (
    interval &&
    instant >= interval.start - EPSILON_MS &&
    instant <= interval.end + EPSILON_MS
  ) {
    return interval;
  }
  return null;
}

function intervalFraction(
  calendar: EngineCalendar,
  instant: number,
): number {
  const interval = intervalAtInstant(calendar, instant);
  if (!interval) {
    const mapped = mapInstantToCalendar(calendar, instant, -1);
    const mappedInterval = intervalAtInstant(calendar, mapped);
    if (!mappedInterval) return 0;
    return clamp01(
      (mapped - mappedInterval.start) /
        (mappedInterval.end - mappedInterval.start),
    );
  }
  return clamp01(
    (instant - interval.start) / (interval.end - interval.start),
  );
}

function findWorkingInterval(
  calendar: EngineCalendar,
  startDateKey: string,
  direction: 1 | -1,
  includeStart: boolean,
): WorkInterval {
  let key = includeStart
    ? startDateKey
    : addDateKey(startDateKey, direction);

  for (let i = 0; i < SEARCH_LIMIT_DAYS; i++) {
    const interval = intervalForDate(calendar, key);
    if (interval) return interval;
    key = addDateKey(key, direction);
  }
  throw unusableCalendar();
}

function intervalForDate(
  calendar: EngineCalendar,
  dateKey: string,
): WorkInterval | null {
  const exception = calendar.exceptions.find(
    (row) => utcDateKey(row.exceptionDate) === dateKey,
  );
  const weekdayNo = weekdayNumber(dateKey);
  const weekday = calendar.weekdays.find(
    (row) => row.weekdayNo === weekdayNo,
  );

  const isWorking =
    exception?.isWorkingOverride ?? weekday?.isWorking ?? false;
  if (!isWorking) return null;

  let startMinute = exception?.startMinute ?? null;
  let endMinute = exception?.endMinute ?? null;

  if (startMinute === null && endMinute === null) {
    startMinute = weekday?.startMinute ?? null;
    endMinute = weekday?.endMinute ?? null;
  }

  if (
    startMinute === null ||
    endMinute === null ||
    startMinute < 0 ||
    endMinute > 1439 ||
    startMinute >= endMinute
  ) {
    throw invalidInterval();
  }

  return {
    dateKey,
    start: zonedLocalToUtc(
      calendar.timezoneName,
      dateKey,
      startMinute,
    ),
    end: zonedLocalToUtc(
      calendar.timezoneName,
      dateKey,
      endMinute,
    ),
  };
}

function validateCalendar(calendar: EngineCalendar) {
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: calendar.timezoneName,
    }).format(new Date());
  } catch {
    throw new ScheduleEngineError(
      'INVALID_WORKING_CALENDAR_TIMEZONE',
      'Working Calendar timezone must be a valid IANA timezone.',
    );
  }

  for (const row of calendar.weekdays) {
    if (row.weekdayNo < 1 || row.weekdayNo > 7) {
      throw new ScheduleEngineError(
        'INVALID_WORKING_CALENDAR_WEEKDAY',
        'Working Calendar weekday must be between 1 and 7.',
      );
    }
    if (row.isWorking) validateMinutes(row.startMinute, row.endMinute);
  }
  for (const row of calendar.exceptions) {
    if (row.isWorkingOverride) {
      const weekday = calendar.weekdays.find(
        (item) => item.weekdayNo === weekdayNumber(utcDateKey(row.exceptionDate)),
      );
      if (
        row.startMinute === null &&
        row.endMinute === null &&
        weekday?.isWorking
      ) {
        validateMinutes(weekday.startMinute, weekday.endMinute);
      } else {
        validateMinutes(row.startMinute, row.endMinute);
      }
    }
  }
}

function validateMinutes(
  startMinute: number | null,
  endMinute: number | null,
) {
  if (
    startMinute === null ||
    endMinute === null ||
    startMinute < 0 ||
    endMinute > 1439 ||
    startMinute >= endMinute
  ) {
    throw invalidInterval();
  }
}

function zonedLocalToUtc(
  timezoneName: string,
  dateKey: string,
  minuteOfDay: number,
): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    throw new ScheduleEngineError(
      'INVALID_SCHEDULE_DATE',
      'Scheduling date keys must use YYYY-MM-DD.',
    );
  }
  const year = Number(match[1]!);
  const month = Number(match[2]!);
  const date = Number(match[3]!);
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const desiredAsUtc = Date.UTC(year, month - 1, date, hour, minute, 0, 0);
  let guess = desiredAsUtc;

  for (let i = 0; i < 5; i++) {
    const parts = zonedParts(timezoneName, guess);
    const representedAsUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.date,
      parts.hour,
      parts.minute,
      0,
      0,
    );
    const delta = desiredAsUtc - representedAsUtc;
    guess += delta;
    if (Math.abs(delta) < 1000) return guess;
  }

  return guess;
}

function zonedParts(timezoneName: string, instant: number) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezoneName,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const values: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') values[part.type] = part.value;
  }
  return {
    year: Number(values.year),
    month: Number(values.month),
    date: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function localDateKey(
  calendar: EngineCalendar,
  instant: number,
): string {
  const parts = zonedParts(calendar.timezoneName, instant);
  return (
    String(parts.year).padStart(4, '0') +
    '-' +
    String(parts.month).padStart(2, '0') +
    '-' +
    String(parts.date).padStart(2, '0')
  );
}

function weekdayNumber(dateKey: string): number {
  const day = new Date(dateKey + 'T00:00:00.000Z').getUTCDay();
  return ((day + 6) % 7) + 1;
}

function addDateKey(dateKey: string, amount: number): string {
  const value = new Date(dateKey + 'T00:00:00.000Z');
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

function utcDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function clamp01(value: number): number {
  if (Math.abs(value) <= EPSILON) return 0;
  if (Math.abs(value - 1) <= EPSILON) return 1;
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function invalidInterval() {
  return new ScheduleEngineError(
    'WORKING_CALENDAR_INTERVAL_MISSING',
    'Every working calendar day used by the Scheduling Engine must define a valid start and end time.',
  );
}

function unusableCalendar() {
  return new ScheduleEngineError(
    'WORKING_CALENDAR_HAS_NO_WORKING_TIME',
    'The Working Calendar does not provide a usable working interval in the supported search horizon.',
  );
}
