// FM01-B technical slice: read-only PREVIEW from the CURRENT configured
// Project/Company WorkingCalendar. This is NOT a historical calendar snapshot,
// deadline enforcement, late determination, no-work declaration or Ben approval.
export type SiteCalendar = {
  id: string;
  projectId: string | null;
  isActive: boolean;
  isDefault: boolean;
  timezoneName: string;
  calendarName: string;
  weekdays: ReadonlyArray<{
    weekdayNo: number;
    isWorking: boolean;
    startTime: Date | null;
  }>;
  exceptions: ReadonlyArray<{
    exceptionDate: Date;
    isWorkingOverride: boolean;
    startTime: Date | null;
    reason: string | null;
  }>;
};

type ReportDay = { date: string; status: 'SUBMITTED' | 'DRAFT' | 'MISSING' };
type DayKind = 'PLANNED_WORKDAY' | 'PLANNED_OFF_DAY' | 'UNKNOWN';
type CalendarStatus = 'CONFIGURED' | 'NOT_CONFIGURED' | 'AMBIGUOUS' | 'INVALID_CONFIGURATION';

const DAY_MS = 86_400_000;
function validDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(date + 'T00:00:00.000Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date;
}
function shift(date: string, amount: number): string {
  return new Date(Date.parse(date + 'T00:00:00.000Z') + amount * DAY_MS).toISOString().slice(0, 10);
}
function weekday(date: string): number {
  // Canonical Scheduling uses 1=Monday ... 7=Sunday, not JavaScript's 0=Sunday.
  return ((new Date(date + 'T00:00:00.000Z').getUTCDay() + 6) % 7) + 1;
}
function clock(time: Date | null): string | null {
  return time instanceof Date && Number.isFinite(time.getTime())
    ? time.toISOString().slice(11, 16) : null;
}

export function previewWeeklyWorkdays(
  projectId: string,
  days: readonly ReportDay[],
  calendars: readonly SiteCalendar[],
) {
  if(days.length!==7 || new Set(days.map(d=>d.date)).size!==7 ||
      days.some(d=>!validDate(d.date) || !['SUBMITTED','DRAFT','MISSING'].includes(d.status)))
    throw new RangeError('FM01 preview requires seven unique canonical daily status rows');

  const candidates=calendars.filter(c=>c.isActive&&c.isDefault &&
    (c.projectId===projectId||c.projectId===null));
  const projectCalendars=candidates.filter(c=>c.projectId===projectId);
  const companyCalendars=candidates.filter(c=>c.projectId===null);
  const scope=projectCalendars.length>0?projectCalendars:companyCalendars;
  let state: CalendarStatus=scope.length===0?'NOT_CONFIGURED':scope.length===1?'CONFIGURED':'AMBIGUOUS';
  const chosen=state==='CONFIGURED'?scope[0]!:null;

  let weekdays=new Map<number,SiteCalendar['weekdays'][number]>();
  let exceptions=new Map<string,SiteCalendar['exceptions'][number]>();
  if(chosen){
    try{
      new Intl.DateTimeFormat('en-US',{timeZone:chosen.timezoneName});
      for(const row of chosen.weekdays){
        if(!Number.isInteger(row.weekdayNo)||row.weekdayNo<1||row.weekdayNo>7||
            typeof row.isWorking!=='boolean'||weekdays.has(row.weekdayNo))
          throw new RangeError('Invalid default calendar weekday');
        weekdays.set(row.weekdayNo,row);
      }
      if(weekdays.size!==7)throw new RangeError('Incomplete default calendar weekdays');
      for(const row of chosen.exceptions){
        const date=row.exceptionDate instanceof Date && Number.isFinite(row.exceptionDate.getTime())
          ? row.exceptionDate.toISOString().slice(0,10):'';
        if(!validDate(date)||exceptions.has(date)||typeof row.isWorkingOverride!=='boolean')
          throw new RangeError('Invalid WorkingCalendar dated exception');
        exceptions.set(date,row);
      }
    }catch{
      state='INVALID_CONFIGURATION';
      weekdays=new Map();
      exceptions=new Map();
    }
  }
  const schedule=(date:string)=>{
    const week=weekdays.get(weekday(date));
    const exception=exceptions.get(date);
    if(!week)return null;
    return {working:exception?exception.isWorkingOverride:week.isWorking,
      startLocalTime:clock(exception?.startTime??week.startTime),
      exceptionReason:exception?.reason??null};
  };

  const decorated=days.map(day=>{
    const rule=state==='CONFIGURED'?schedule(day.date):null;
    const kind:DayKind=!rule?'UNKNOWN':rule.working?'PLANNED_WORKDAY':'PLANNED_OFF_DAY';
    let dueDate:string|null=null,dueLocalTime:string|null=null;
    if(kind==='PLANNED_WORKDAY'){
      // Search the persisted config, NOT assumed Mon-Fri or a Thai holiday list.
      // When no future configured workday is found, leave the deadline unknown.
      for(let offset=1;offset<=56;offset++){
        const later=shift(day.date,offset);
        const next=schedule(later);
        if(next?.working){dueDate=later;dueLocalTime=next.startLocalTime;break;}
      }
    }
    return {
      date:day.date,
      plannedDayKind:kind,
      reportingExpectation:kind==='UNKNOWN'?'UNDETERMINED' as const:
        kind==='PLANNED_OFF_DAY'?'NO_REPORT_REQUIRED' as const:
        day.status==='MISSING'?'PLANNED_DAY_REPORT_MISSING' as const:
        day.status==='DRAFT'?'PLANNED_DAY_DRAFT' as const:'PLANNED_DAY_SUBMITTED' as const,
      dueLocalDate:dueDate,
      dueLocalStartTime:dueLocalTime,
      // No late/overdue judgment: calendar configuration is mutable, not an
      // immutable historical schedule or original witnessed submission cutoff.
      timeliness:'NOT_ASSESSED' as const,
      exceptionReason:rule?.exceptionReason??null,
    };
  });
  return {
    status:state,
    calendarId:state==='CONFIGURED'?chosen!.id:null,
    calendarName:state==='CONFIGURED'?chosen!.calendarName:null,
    timezoneName:state==='CONFIGURED'?chosen!.timezoneName:null,
    basis:'CURRENT_CONFIGURATION_PREVIEW_NOT_HISTORICAL_COMPLIANCE' as const,
    days:decorated,
    totals:state==='CONFIGURED'?{
      plannedWorkdays:decorated.filter(d=>d.plannedDayKind==='PLANNED_WORKDAY').length,
      plannedOffDays:decorated.filter(d=>d.plannedDayKind==='PLANNED_OFF_DAY').length,
      missingPlannedWorkdayReports:decorated.filter(d=>d.reportingExpectation==='PLANNED_DAY_REPORT_MISSING').length,
    }:null,
  };
}
