import { createHash } from 'node:crypto';

import type { AuthenticatedUserContext } from '../auth/auth.types';
import type { WeeklySiteReportSource } from './site-weekly-summary';

export const NO_WORK_ACTION = 'DECLARE_NO_WORK';
export const NO_WORK_CORRECTION_ACTION = 'CORRECT_NO_WORK';
export const WEEKLY_ACK_ACTION = 'REVIEW_ACK';
export const NO_WORK_ENTITY = 'DAILY_SITE_REPORT_NO_WORK';
export const WEEKLY_REVIEW_ENTITY = 'SITE_WEEKLY_REVIEW';

export type EvidenceRow = {
  id: string;
  action: string;
  occurredAt: Date;
  actorUserId: string;
  newValues: unknown;
};

export type NoWorkEvidence = {
  reason: string;
  declarationId: string;
  declaredByUserId: string;
  declaredAt: string;
  correctedByUserId: string | null;
  correctedAt: string | null;
  correctionCount: number;
  plannedDayEvidence: {
    calendarId: string;
    calendarName: string;
    timezoneName: string;
    reportDate: string;
    plannedDayKind: 'PLANNED_WORKDAY';
    dueLocalDate: string | null;
    dueLocalStartTime: string | null;
    calendarFingerprint: string;
    historicTimeliness: 'NOT_ASSESSED';
  };
};

type WeekSource = {
  projectId: string;
  from: string;
  to: string;
  days: readonly {
    date: string;
    status: string;
    report: null | {
      id: string;
      createdBy: { id: string };
      submittedAt: Date | string | null;
      updatedAt: Date | string;
      totalManpower: number;
      counts: WeeklySiteReportSource['_count'];
      progressObservations: readonly {
        activityId: string; percentComplete: string; note: string | null;
      }[];
    };
  }[];
};

const sha256 = (value: unknown) => createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

export function calendarFingerprint(calendar: {
  id: string;
  projectId: string | null;
  isActive: boolean;
  isDefault: boolean;
  timezoneName: string;
  weekdays: readonly { weekdayNo: number; isWorking: boolean; startTime: Date | null }[];
  exceptions: readonly { exceptionDate: Date; isWorkingOverride: boolean; startTime: Date | null; reason: string | null }[];
}): string {
  return sha256({
    id: calendar.id, projectId: calendar.projectId, isActive: calendar.isActive,
    isDefault: calendar.isDefault, timezone: calendar.timezoneName,
    weekdays: calendar.weekdays.map(w => ({
      weekdayNo: w.weekdayNo, working: w.isWorking, start: w.startTime?.toISOString() ?? null,
    })).sort((a,b) => a.weekdayNo - b.weekdayNo),
    exceptions: calendar.exceptions.map(e => ({
      date: e.exceptionDate.toISOString().slice(0, 10), working: e.isWorkingOverride,
      start: e.startTime?.toISOString() ?? null, reason: e.reason,
    })).sort((a,b) => a.date.localeCompare(b.date)),
  });
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

export function noWorkEvidence(rows: readonly EvidenceRow[]): NoWorkEvidence | null {
  // An append-only event stream; invalid or ambiguous events never become
  // operational authorization. Caller must have scoped the rows by Company,
  // entity type and the exact report UUID.
  const events = [...rows].sort((a,b) =>
    a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));
  const declarations = events.filter(r => r.action === NO_WORK_ACTION);
  if (!declarations.length) return null;
  if (declarations.length !== 1) throw new RangeError('Duplicate no-work declaration');
  const declared = declarations[0]!;
  const values = object(declared.newValues);
  const plan = object(values?.plannedDayEvidence);
  if (typeof values?.reason !== 'string' || !values.reason.trim() ||
    typeof plan?.calendarId !== 'string' || typeof plan?.timezoneName !== 'string' ||
    typeof plan?.calendarName !== 'string' || typeof plan?.reportDate !== 'string' ||
    plan?.plannedDayKind !== 'PLANNED_WORKDAY' ||
    typeof plan?.calendarFingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(plan.calendarFingerprint))
    throw new RangeError('Malformed no-work declaration');
  let reason = values.reason;
  let correctedByUserId: string | null = null;
  let correctedAt: string | null = null;
  let count = 0;
  for (const event of events) {
    if (event.action !== NO_WORK_CORRECTION_ACTION) continue;
    if (event.occurredAt < declared.occurredAt) throw new RangeError('Invalid no-work correction order');
    const next = object(event.newValues);
    if (typeof next?.reason !== 'string' || !next.reason.trim() || next?.oldReason !== reason)
      throw new RangeError('Malformed no-work correction');
    reason = next.reason;
    correctedByUserId = event.actorUserId;
    correctedAt = event.occurredAt.toISOString();
    count++;
  }
  return {
    reason,
    declarationId: declared.id,
    declaredByUserId: declared.actorUserId,
    declaredAt: declared.occurredAt.toISOString(),
    correctedByUserId, correctedAt, correctionCount: count,
    plannedDayEvidence: {
      calendarId: plan.calendarId,
      calendarName: plan.calendarName,
      timezoneName: plan.timezoneName,
      reportDate: plan.reportDate,
      plannedDayKind: 'PLANNED_WORKDAY',
      dueLocalDate: typeof plan.dueLocalDate === 'string' ? plan.dueLocalDate : null,
      dueLocalStartTime: typeof plan.dueLocalStartTime === 'string' ? plan.dueLocalStartTime : null,
      calendarFingerprint: plan.calendarFingerprint,
      historicTimeliness: 'NOT_ASSESSED',
    },
  };
}

export function weeklyReviewFingerprint(
  week: WeekSource,
  noWorkByReport: ReadonlyMap<string, NoWorkEvidence | null>,
): string {
  return sha256({
    projectId: week.projectId, from: week.from, to: week.to,
    days: week.days.map(day => ({
      date: day.date, status: day.status,
      source: day.report === null ? null : {
        id: day.report.id,
        author: day.report.createdBy.id,
        submittedAt: day.report.submittedAt,
        updatedAt: day.report.updatedAt,
        counts: day.report.counts,
        manpower: day.report.totalManpower,
        observations: day.report.progressObservations.map(p => ({
          activity: p.activityId, progress: p.percentComplete, note: p.note,
        })),
        noWork: noWorkByReport.get(day.report.id) ?? null,
      },
    })),
  });
}

export function mayAcknowledgeWeekly(
  auth: Pick<AuthenticatedUserContext, 'roleCodes' | 'permissions' | 'userId'>,
  week: WeekSource,
  correctionAuthors: readonly string[],
): boolean {
  // The MANAGEMENT persona (Ben) reviews but NEVER formally approves. Do not
  // silently make SYS_ADMIN or a project preparer an alternate reviewer.
  return auth.roleCodes.includes('MANAGEMENT') &&
    auth.permissions.includes('site.daily_report.view') &&
    week.days.some(day => day.status === 'SUBMITTED') &&
    week.days.every(day => day.report?.createdBy.id !== auth.userId) &&
    !correctionAuthors.includes(auth.userId);
}

export function validWeeklyHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash);
}
