// FM01: deterministic review-of-source evidence, not a second weekly ledger.
// Existing audit events are append-only through this service. No schema migration
// or additional role grant is required; persisted actor/time and source snapshots
// remain separate from canonical Daily Site Reports and their corrections.
import { createHash } from 'node:crypto';

export const DECLARE_NO_WORK = 'DECLARE_NO_WORK';
export const CORRECT_NO_WORK = 'CORRECT_NO_WORK';
export const ACKNOWLEDGE_WEEK = 'ACKNOWLEDGE_WEEK';

export type NoWorkAuditRow = {
  id: string;
  action: string;
  actorUserId: string;
  occurredAt: Date;
  newValues: unknown;
};
export type CurrentNoWork = {
  eventId: string;
  reason: string;
  createdByUserId: string;
  createdAt: string;
  reportId: string;
  reportDate: string;
  projectId: string;
  calendarId: string;
  timezoneName: string;
  correctionCountWhenDeclared: number;
  historyCount: number;
};

const hasString = (v:unknown):v is string=>typeof v==='string'&&v.length>0;
const obj = (v:unknown):Record<string,unknown>=>{
  if(!v||typeof v!=='object'||Array.isArray(v))throw new RangeError('Invalid persisted FM01 event payload');
  return v as Record<string,unknown>;
};
export function checkedNoWorkReason(value:unknown) {
  if(typeof value!=='string')throw new RangeError('No-work reason required');
  const reason=value.trim();
  if(reason.length<8||reason.length>1000)throw new RangeError('No-work reason must be 8-1000 characters');
  return reason;
}

export function currentNoWork(
  events:readonly NoWorkAuditRow[],
  reportId:string,
  projectId:string,
  reportDate:string
):CurrentNoWork|null {
  let current:CurrentNoWork|null=null;
  let length=0;
  for(const event of events) {
    if(event.action!==DECLARE_NO_WORK&&event.action!==CORRECT_NO_WORK)
      throw new RangeError('Unexpected FM01 audit event');
    const v=obj(event.newValues);
    if(v.reportId!==reportId||v.projectId!==projectId||v.reportDate!==reportDate||
      !hasString(v.calendarId)||!hasString(v.timezoneName)||
      !Number.isSafeInteger(v.correctionCountWhenDeclared)||
      (v.correctionCountWhenDeclared as number)<0)
      throw new RangeError('FM01 event source or calendar mismatch');
    const reason=checkedNoWorkReason(v.reason);
    if(!current) {
      if(event.action!==DECLARE_NO_WORK||v.previousEventId!==null)
        throw new RangeError('FM01 history must start with declaration');
    } else {
      if(event.action!==CORRECT_NO_WORK||v.previousEventId!==current.eventId)
        throw new RangeError('FM01 correction must extend prior event');
    }
    if(!hasString(event.id)||!hasString(event.actorUserId)||
      !(event.occurredAt instanceof Date)||!Number.isFinite(event.occurredAt.getTime()))
      throw new RangeError('FM01 audit identity missing');
    length++;
    current={
      eventId:event.id,reason,createdByUserId:event.actorUserId,
      createdAt:event.occurredAt.toISOString(),reportId,projectId,reportDate,
      calendarId:v.calendarId,timezoneName:v.timezoneName,
      correctionCountWhenDeclared:v.correctionCountWhenDeclared as number,
      historyCount:length,
    };
  }
  return current;
}

// Hash only the exact Project/period, canonical report summary, selected
// calendar and no-work source event references, and linked attachment identities.
// Review becomes STALE (not revoked or silently rewritten) when any reviewed
// input changes; historical notes and source events remain intact.
export function weeklyReviewFingerprint(input:{
  projectId:string;from:string;to:string;
  days:readonly unknown[];
  calendar:unknown;
  noWork:readonly {reportId:string;eventId:string;reason:string;createdAt:string;historyCount:number}[];
  documentLinkIds:readonly string[];
}) {
  if(!hasString(input.projectId)||!/^\d{4}-\d{2}-\d{2}$/.test(input.from)||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.to)||input.days.length!==7)
    throw new RangeError('Invalid FM01 review source');
  const ordered=[...input.noWork].sort((a,b)=>a.reportId.localeCompare(b.reportId));
  const links=[...input.documentLinkIds].sort();
  const text=JSON.stringify({schemaVersion:1,projectId:input.projectId,
    from:input.from,to:input.to,days:input.days,calendar:input.calendar,
    noWork:ordered,documentLinkIds:links});
  return createHash('sha256').update(text).digest('hex');
}

export function weeklyReviewStatus(
  events:readonly NoWorkAuditRow[],
  from:string,
  to:string,
  fingerprint:string
) {
  const related=events.filter(e=>{
    const v=obj(e.newValues);
    return v.from===from&&v.to===to;
  });
  if(!related.length)return {status:'UNREVIEWED' as const,review:null};
  const latest=related.at(-1)!;
  const value=obj(latest.newValues);
  if(latest.action!==ACKNOWLEDGE_WEEK||!hasString(value.fingerprint)||
    !hasString(latest.actorUserId)||!hasString(latest.id)||
    !(latest.occurredAt instanceof Date))
    throw new RangeError('Invalid persisted weekly review');
  return {
    status:value.fingerprint===fingerprint?'ACKNOWLEDGED' as const:'STALE' as const,
    review:{eventId:latest.id,reviewedByUserId:latest.actorUserId,
      reviewedAt:latest.occurredAt.toISOString(),
      note:typeof value.note==='string'?value.note:'',
      fingerprint:value.fingerprint as string},
  };
}
