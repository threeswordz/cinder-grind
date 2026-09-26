export type LookaheadActivity = {
  forecastStartDate: Date | string | null;
  forecastFinishDate: Date | string | null;
};

export function scheduleDateKey(
  value: Date | string | null | undefined,
): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }
  const key = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function lookaheadWindow(asOf: Date, days: 14 | 28) {
  const start = new Date(
    Date.UTC(
      asOf.getUTCFullYear(),
      asOf.getUTCMonth(),
      asOf.getUTCDate(),
    ),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + days - 1);

  return {
    asOfDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
    days,
  };
}

export function isInLookahead(
  activity: LookaheadActivity,
  asOf: Date,
  days: 14 | 28,
) {
  const start = scheduleDateKey(activity.forecastStartDate);
  const finish = scheduleDateKey(activity.forecastFinishDate);
  if (!start || !finish) return false;

  const window = lookaheadWindow(asOf, days);
  return start <= window.endDate && finish >= window.asOfDate;
}
