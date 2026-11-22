import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SiteExecutionService } from './site-execution.service';
import {
  ACKNOWLEDGE_WEEK, CORRECT_NO_WORK, DECLARE_NO_WORK,
  checkedNoWorkReason, currentNoWork, weeklyReviewFingerprint, weeklyReviewStatus,
} from './site-weekly-evidence';

type AuditContext = {auth:AuthenticatedUserContext;correlationId?:string};
type Db = Prisma.TransactionClient;

const sourceActions = [DECLARE_NO_WORK,CORRECT_NO_WORK];
const dateKey = (date:Date) => date.toISOString().slice(0,10);
const error = (code:string,detail:string) => ({code,detail});
function mayRecordNoWork(auth:AuthenticatedUserContext) {
  return auth.roleCodes.includes('PROJECT_ENGINEER') &&
    auth.permissions.includes('site.daily_report.submit');
}
function mayReviewWeek(auth:AuthenticatedUserContext) {
  return auth.roleCodes.includes('MANAGEMENT') &&
    auth.permissions.includes('site.daily_report.view');
}
function noteValue(note:unknown) {
  if(typeof note!=='string'||note.length>2000)
    throw new UnprocessableEntityException(error('SITE_WEEK_REVIEW_NOTE_INVALID','A review note up to 2000 characters is required.'));
  return note.trim();
}

@Injectable()
export class SiteWeeklyEventsService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly access:ProjectAccessService,
    private readonly audit:AuditService,
    private readonly site:SiteExecutionService,
  ) {}

  async weekly(auth:AuthenticatedUserContext,projectId:string,from:Date,to:Date) {
    const summary=await this.site.weekly(auth,projectId,from,to);
    return this.decorate(auth,projectId,summary,this.prisma);
  }

  private async decorate(
    auth:AuthenticatedUserContext,
    projectId:string,
    summary:Awaited<ReturnType<SiteExecutionService['weekly']>>,
    db:Db,
  ) {
    const reportIds=summary.days.flatMap(day=>day.report?[day.report.id]:[]);
    const [noWorkRows,reviewRows,links]=await Promise.all([
      reportIds.length?db.auditLog.findMany({
        where:{companyId:auth.companyId,entityType:'DAILY_SITE_REPORT',
          entityId:{in:reportIds},action:{in:sourceActions}},
        orderBy:[{occurredAt:'asc'},{id:'asc'}],
      }):Promise.resolve([]),
      db.auditLog.findMany({
        where:{companyId:auth.companyId,entityType:'PROJECT_SITE_WEEKLY_REVIEW',
          entityId:projectId,action:ACKNOWLEDGE_WEEK},
        orderBy:[{occurredAt:'asc'},{id:'asc'}],
      }),
      reportIds.length?db.documentLink.findMany({
        where:{entityType:'DAILY_SITE_REPORT',entityId:{in:reportIds}},
        select:{id:true},orderBy:{id:'asc'},
      }):Promise.resolve([]),
    ]);
    const noWorkByReportId:Record<string,{
      eventId:string;reason:string;createdAt:string;createdByUserId:string;
      historyCount:number;status:'DECLARED'|'REQUIRES_RECONCILIATION';
    }>={};
    const proofSource:Array<{
      reportId:string;eventId:string;reason:string;createdAt:string;historyCount:number;
    }>=[];
    for(const day of summary.days) {
      if(!day.report)continue;
      const entries=noWorkRows.filter(row=>row.entityId===day.report!.id);
      const current=currentNoWork(entries,day.report.id,projectId,day.date);
      if(!current)continue;
      const staleCorrections=current.correctionCountWhenDeclared!==day.report.counts.corrections;
      noWorkByReportId[day.report.id]={
        eventId:current.eventId,reason:current.reason,createdAt:current.createdAt,
        createdByUserId:current.createdByUserId,historyCount:current.historyCount,
        status:staleCorrections?'REQUIRES_RECONCILIATION':'DECLARED',
      };
      proofSource.push({reportId:day.report.id,eventId:current.eventId,
        reason:current.reason,createdAt:current.createdAt,historyCount:current.historyCount});
    }
    const fingerprint=weeklyReviewFingerprint({
      projectId,from:summary.from,to:summary.to,days:summary.days,
      calendar:summary.workCalendarPreview,noWork:proofSource,
      documentLinkIds:links.map(link=>link.id),
    });
    const review=weeklyReviewStatus(reviewRows,summary.from,summary.to,fingerprint);
    return {
      ...summary,
      noWorkByReportId,
      weeklyReview:{
        ...review,fingerprint,
        canAcknowledge:mayReviewWeek(auth),
        canDeclareNoWork:mayRecordNoWork(auth),
        semantics:'REVIEW_ACKNOWLEDGMENT_NOT_APPROVAL' as const,
      },
    };
  }

  async declareNoWork(
    context:AuditContext, reportId:string, reasonInput:unknown,
    previousEventId:string|null,
  ) {
    if(!mayRecordNoWork(context.auth))
      throw new ForbiddenException(error('SITE_NO_WORK_FOREMAN_REQUIRED','Only an authorized Foreman may declare a planned no-work day.'));
    let reason:string;
    try {reason=checkedNoWorkReason(reasonInput);}
    catch {throw new UnprocessableEntityException(error('SITE_NO_WORK_REASON_REQUIRED','Provide a reason of 8-1000 characters.'));}
    await this.prisma.$transaction(async tx=>{
      const report=await tx.dailySiteReport.findFirst({
        where:{id:reportId,companyId:context.auth.companyId},
        include:{_count:{select:{
          manpowerLines:true,materialUsage:true,equipmentUsage:true,
          progressLines:true,inspections:true,corrections:true,
        }}},
      });
      if(!report)throw new NotFoundException(error('SITE_REPORT_NOT_FOUND','Daily Site Report not found.'));
      await this.access.assertAccess(context.auth,report.projectId,tx);
      if(report.createdByUserId!==context.auth.userId||report.status!=='SUBMITTED'||!report.submittedAt)
        throw new ConflictException(error('SITE_NO_WORK_SOURCE_INVALID','Use your own submitted Daily Site Report.'));
      // Serialize declarations/corrections for the canonical report even when
      // separate HTTP requests race. This SELECT never mutates source rows.
      await tx.$queryRaw`SELECT id FROM daily_site_reports WHERE id = ${report.id}::uuid FOR UPDATE`;
      const counts=report._count;
      if(counts.manpowerLines||counts.materialUsage||counts.equipmentUsage||
        counts.progressLines||counts.inspections||counts.corrections)
        throw new ConflictException(error('SITE_NO_WORK_HAS_WORK','Actual work or corrected source rows exist; cannot declare no work.'));
      const existing=await tx.auditLog.findMany({
        where:{companyId:context.auth.companyId,entityType:'DAILY_SITE_REPORT',
          entityId:report.id,action:{in:sourceActions}},
        orderBy:[{occurredAt:'asc'},{id:'asc'}],
      });
      const previous=currentNoWork(existing,report.id,report.projectId,dateKey(report.reportDate));
      if(!previous && previousEventId!==null)
        throw new ConflictException(error('SITE_NO_WORK_STALE_EVENT','No declaration exists for that correction.'));
      if(previous && previous.eventId!==previousEventId)
        throw new ConflictException(error('SITE_NO_WORK_STALE_EVENT','Reload the latest no-work declaration.'));
      if(previous?.reason===reason)
        throw new ConflictException(error('SITE_NO_WORK_UNCHANGED','Reason unchanged; no duplicate correction allowed.'));
      const to=new Date(report.reportDate.getTime()+6*86_400_000);
      const week=await this.site.weekly(context.auth,report.projectId,report.reportDate,to,tx);
      const calendar=week.workCalendarPreview;
      if(calendar.status!=='CONFIGURED'||calendar.days[0]?.plannedDayKind!=='PLANNED_WORKDAY'||
        !calendar.calendarId||!calendar.timezoneName)
        throw new UnprocessableEntityException(error('SITE_NO_WORK_CALENDAR_REQUIRED',
          'No-work evidence requires an unambiguous configured planned workday, not an ordinary holiday or unknown day.'));
      await this.audit.record({
        ...context,entityType:'DAILY_SITE_REPORT',entityId:report.id,
        action:previous?CORRECT_NO_WORK:DECLARE_NO_WORK,
        newValues:{
          reportId:report.id,projectId:report.projectId,
          reportDate:dateKey(report.reportDate),reason,
          previousEventId:previous?.eventId??null,
          calendarId:calendar.calendarId,timezoneName:calendar.timezoneName,
          sourceSubmittedAt:report.submittedAt.toISOString(),
          correctionCountWhenDeclared:counts.corrections,
          sourceDisposition:'PLANNED_WORKDAY_NO_WORK',
        },
      },tx);
    });
    // Return scoped source; the subsequent weekly query reads the audit event.
    return this.site.get(context.auth,reportId);
  }

  async acknowledge(
    context:AuditContext,projectId:string,from:Date,to:Date,
    expectedFingerprint:string,noteInput:unknown,
  ) {
    if(!mayReviewWeek(context.auth))
      throw new ForbiddenException(error('SITE_WEEK_BEN_REVIEW_REQUIRED',
        'Only the configured General Management role may acknowledge a weekly review.'));
    if(!/^[a-f0-9]{64}$/.test(expectedFingerprint))
      throw new UnprocessableEntityException(error('SITE_WEEK_REVIEW_FINGERPRINT_INVALID','Use the latest weekly evidence fingerprint.'));
    const note=noteValue(noteInput);
    await this.prisma.$transaction(async tx=>{
      await this.access.assertAccess(context.auth,projectId,tx);
      // Serialize two Ben review attempts and preserve one event per
      // fingerprint; a later source revision creates a new audit event.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const summary=await this.site.weekly(context.auth,projectId,from,to,tx);
      const decorated=await this.decorate(context.auth,projectId,summary,tx);
      if(decorated.weeklyReview.fingerprint!==expectedFingerprint)
        throw new ConflictException(error('SITE_WEEK_SOURCE_STALE','Weekly reports/calendar/no-work evidence changed. Refresh before review.'));
      const missing=decorated.workCalendarPreview.days.some((day,i)=>
        day.plannedDayKind==='PLANNED_WORKDAY'&&decorated.days[i]?.status!=='SUBMITTED');
      if(missing&&note.length<8)
        throw new UnprocessableEntityException(error('SITE_WEEK_REVIEW_EXCEPTION_NOTE_REQUIRED',
          'An incomplete planned workweek requires an explicit review note.'));
      if(decorated.weeklyReview.status==='ACKNOWLEDGED')return;
      await this.audit.record({
        ...context,entityType:'PROJECT_SITE_WEEKLY_REVIEW',entityId:projectId,
        action:ACKNOWLEDGE_WEEK,
        newValues:{
          projectId,from:summary.from,to:summary.to,
          fingerprint:expectedFingerprint,note,
          sourceReportIds:summary.days.flatMap(day=>day.report?[day.report.id]:[]),
          calendarId:summary.workCalendarPreview.calendarId,
          reviewMeaning:'OBSERVED_NOT_APPROVED',
          exceptionNoted:missing,
        },
      },tx);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return this.weekly(context.auth,projectId,from,to);
  }
}
