/** HR-02 raw attendance domain: no payroll, rounding, deductions or grants. */
export type AttendanceState = 'DRAFT' | 'SUBMITTED' | 'RETURNED';
export type AttendanceAction = 'EDIT' | 'SUBMIT' | 'RETURN' | 'RESUBMIT' | 'HR_CORRECT';
export type ActorKind = 'SITE_RECORDER' | 'HR_REVIEWER';
export type TimeInterval = Readonly<{ employeeId: string; projectId: string; workDate: string; startMinute: number; endMinute: number }>;

export function attendanceDay(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '0001-01-01' || value > '9999-12-31') throw new Error('ATTENDANCE_DAY_INVALID');
  const date = new Date(value + 'T00:00:00.000Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('ATTENDANCE_DAY_INVALID');
  return date;
}

/** Calendar half-month, not a payroll deadline or payment calculation. */
export function attendancePeriod(workDate: string): { start: string; end: string } {
  const date = attendanceDay(workDate), prefix = workDate.slice(0, 7);
  if (date.getUTCDate() <= 15) return { start: prefix + '-01', end: prefix + '-15' };
  const last = new Date(date.getTime());
  last.setUTCDate(1); last.setUTCMonth(last.getUTCMonth() + 1); last.setUTCDate(0);
  return { start: prefix + '-16', end: prefix + '-' + String(last.getUTCDate()).padStart(2, '0') };
}

/** Raw civil clock minutes; no inferred break/OT or wage computation. */
export function clockMinute(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error('ATTENDANCE_CLOCK_INVALID');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}

export function validateInterval(row: TimeInterval): void {
  attendanceDay(row.workDate);
  if (!row.employeeId || !row.projectId || !Number.isInteger(row.startMinute) || !Number.isInteger(row.endMinute) ||
      row.startMinute < 0 || row.endMinute > 1440 || row.startMinute >= row.endMinute) throw new Error('ATTENDANCE_INTERVAL_INVALID');
}

/** Touching intervals are legal. Conflicts are evidence for HR resolution, never silently trimmed. */
export function intervalsOverlap(a: TimeInterval, b: TimeInterval): boolean {
  validateInterval(a); validateInterval(b);
  return a.employeeId === b.employeeId && a.workDate === b.workDate && a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

/** Input uses already-resolved canonical employment identity, not a user-supplied authorization assertion. */
export function assertEmploymentDay(workDate: string, startDate: string, endDate: string | null): void {
  attendanceDay(workDate); attendanceDay(startDate);
  if (endDate !== null) attendanceDay(endDate);
  if (endDate !== null && endDate < startDate || workDate < startDate || endDate !== null && workDate > endDate) throw new Error('ATTENDANCE_OUTSIDE_EMPLOYMENT');
}

/** Transition validation only. ActorKind must be derived from live scoped permissions by the caller. */
export function attendanceTransition(state: AttendanceState, action: AttendanceAction, actor: ActorKind, expectedVersion: number, currentVersion: number): AttendanceState {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || expectedVersion !== currentVersion) throw new Error('ATTENDANCE_STALE_VERSION');
  if (actor === 'SITE_RECORDER') {
    if (action === 'EDIT' && (state === 'DRAFT' || state === 'RETURNED')) return state;
    if (action === 'SUBMIT' && state === 'DRAFT') return 'SUBMITTED';
    if (action === 'RESUBMIT' && state === 'RETURNED') return 'SUBMITTED';
  }
  if (actor === 'HR_REVIEWER' && state === 'SUBMITTED') {
    if (action === 'RETURN') return 'RETURNED';
    if (action === 'HR_CORRECT') return 'SUBMITTED';
  }
  throw new Error('ATTENDANCE_TRANSITION_DENIED');
}
