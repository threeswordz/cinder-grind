/**
 * SS14 / PM15: scoped, read-only reminders for the START of a current approved
 * material-usage-plan revision. A plan's validFrom is NOT a dated delivery,
 * supplier commitment, daily material issue, stock reservation or shortage.
 *
 * No timers, notifications, procurement, inventory or Finance side effects.
 */
export type PlanStartWindow = 'DUE_TODAY' | 'WITHIN_7_DAYS' | 'WITHIN_14_DAYS';

const isoDay = (day: unknown): day is string => {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith('0000')) return false;
  const parsed = new Date(day + 'T00:00:00.000Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
};

const dayNumber = (value: string) =>
  Math.floor(new Date(value + 'T00:00:00.000Z').getTime() / 86400000);

/** Thailand business calendar date; never use server-local timezone. */
export function thailandBusinessDate(now: Date): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()))
    throw new RangeError('SS14_BUSINESS_TIME_INVALID');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value;
  const result = [part('year'), part('month'), part('day')].join('-');
  if (!isoDay(result)) throw new RangeError('SS14_BUSINESS_DATE_INVALID');
  return result;
}

/** A reminder is on screen only from 14 days before through the start day. */
export function approvedPlanStartWindow(startDay: string, businessDay: string):
  { window: PlanStartWindow; daysUntilStart: number } | null {
  if (!isoDay(startDay) || !isoDay(businessDay))
    throw new RangeError('SS14_PLAN_DATE_INVALID');
  const daysUntilStart = dayNumber(startDay) - dayNumber(businessDay);
  if (daysUntilStart < 0 || daysUntilStart > 14) return null;
  return {
    daysUntilStart,
    window: daysUntilStart === 0 ? 'DUE_TODAY' :
      daysUntilStart <= 7 ? 'WITHIN_7_DAYS' : 'WITHIN_14_DAYS',
  };
}

export function dayPlus(businessDay: string, days: number): Date {
  if (!isoDay(businessDay) || !Number.isSafeInteger(days) || days < 0 || days > 14)
    throw new RangeError('SS14_DATE_RANGE_INVALID');
  return new Date((dayNumber(businessDay) + days) * 86400000);
}
