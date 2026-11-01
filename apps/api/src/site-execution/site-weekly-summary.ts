// FM01-A: derived, read-only seven-day summary. No persisted weekly state or approval.
export type WeeklySiteReportSource = {
  id: string;
  reportDate: Date;
  status: string;
  submittedAt: Date | null;
  createdBy: { id: string; displayName: string };
  totalManpower: number;
  weatherObservation: string | null;
  generalRemarks: string | null;
  _count: {
    materialUsage: number;
    equipmentUsage: number;
    progressLines: number;
    issues: number;
    delays: number;
    inspections: number;
    corrections: number;
  };
};

export type WeeklyProgressObservation = {
  reportId: string;
  activityId: string;
  activityCode: string;
  activityName: string;
  percentComplete: string;
  note: string | null;
};

const DAY_MS = 86_400_000;

export function isSevenCalendarDays(from: Date, to: Date): boolean {
  return Number.isFinite(from.getTime()) && Number.isFinite(to.getTime())
    && to.getTime() - from.getTime() === 6 * DAY_MS
    && from.toISOString().endsWith('T00:00:00.000Z')
    && to.toISOString().endsWith('T00:00:00.000Z');
}

export function buildWeeklySiteSummary(
  projectId: string,
  from: Date,
  to: Date,
  sources: readonly WeeklySiteReportSource[],
  progress: readonly WeeklyProgressObservation[],
) {
  if (!isSevenCalendarDays(from, to)) {
    throw new RangeError('FM01-A requires an exact seven-calendar-day window.');
  }

  const byDate = new Map<string, WeeklySiteReportSource>();
  for (const report of sources) {
    const day = report.reportDate.toISOString().slice(0, 10);
    if (report.reportDate < from || report.reportDate > to) continue;
    if (byDate.has(day)) throw new RangeError('Duplicate daily site report for calendar date.');
    byDate.set(day, report);
  }
  const progressByReport = new Map<string, WeeklyProgressObservation[]>();
  for (const observation of progress) {
    const dayReport = sources.find(source => source.id === observation.reportId);
    if (!dayReport || !byDate.has(dayReport.reportDate.toISOString().slice(0, 10))) continue;
    const items = progressByReport.get(observation.reportId) ?? [];
    items.push(observation);
    progressByReport.set(observation.reportId, items);
  }

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(from.getTime() + DAY_MS * offset).toISOString().slice(0, 10);
    const report = byDate.get(date);
    if (!report) return { date, status: 'MISSING' as const, report: null };
    return {
      date,
      status: report.status === 'SUBMITTED' ? 'SUBMITTED' as const : 'DRAFT' as const,
      report: {
        id: report.id,
        createdBy: report.createdBy,
        submittedAt: report.submittedAt,
        weatherObservation: report.weatherObservation,
        generalRemarks: report.generalRemarks,
        totalManpower: report.totalManpower,
        counts: report._count,
        progressObservations: progressByReport.get(report.id) ?? [],
        detailPath: '/site-execution/reports/' + report.id,
      },
    };
  });
  const recorded = days.filter(day => day.report !== null);
  return {
    projectId,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    reviewState: 'READ_ONLY_NO_APPROVAL' as const,
    missingDayMeaning: 'UNKNOWN_WORKDAY_OR_HOLIDAY' as const,
    days,
    totals: {
      submittedDays: days.filter(day => day.status === 'SUBMITTED').length,
      draftDays: days.filter(day => day.status === 'DRAFT').length,
      missingDays: days.filter(day => day.status === 'MISSING').length,
      recordedDays: recorded.length,
      issues: recorded.reduce((sum, day) => sum + (day.report?.counts.issues ?? 0), 0),
      delays: recorded.reduce((sum, day) => sum + (day.report?.counts.delays ?? 0), 0),
      inspections: recorded.reduce((sum, day) => sum + (day.report?.counts.inspections ?? 0), 0),
    },
  };
}
