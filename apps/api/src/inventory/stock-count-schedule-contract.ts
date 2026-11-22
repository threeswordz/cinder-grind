/**
 * NANCY-07 / SS12 — site-by-category physical stock-count cadence.
 * These are calendar-date scheduling facts, NOT a physical count, stock effect,
 * financial write-off or proof that a Storekeeper performed a count.
 */
export const STOCK_COUNT_SCHEDULE_ENTITY='STOCK_COUNT_SCHEDULE';
export const STOCK_COUNT_SCHEDULE_SET='SET';
export const STOCK_COUNT_SCHEDULE_MAX_DAYS=3650;
export type CountScheduleEvent={
  id:string;actorUserId:string;action:string;occurredAt:Date;newValues:unknown;
};
export type CountScheduleState={
  materialCategory:string|null;
  projectId:string;
  warehouseId:string;
  intervalDays:number;
  firstDueDate:string;
  status:'ACTIVE'|'PAUSED';
  reason:string;
  version:number;
  lastEventId:string;
  changedAt:string;
  changedByUserId:string;
};
const object=(v:unknown):Record<string,unknown>|null=>
  v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const uuid=(s:unknown):s is string=>typeof s==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const validText=(s:unknown,max:number):s is string=>
  typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=max;
export function countScheduleDay(date:unknown):date is string{
  if(typeof date!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date))return false;
  const parsed=new Date(date+'T00:00:00.000Z');
  return !Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===date;
}
export function countScheduleContract(input:unknown){
  const x=object(input);
  if(!x||Object.keys(x).some(k=>!['materialCategory','firstDueDate','intervalDays','status','reason'].includes(k)))
    throw new RangeError('COUNT_SCHEDULE_FIELDS_INVALID');
  if(x.materialCategory!==null&&
    (!validText(x.materialCategory,150)||x.materialCategory==='*'))
    throw new RangeError('COUNT_SCHEDULE_CATEGORY_INVALID');
  if(!countScheduleDay(x.firstDueDate)||
    !Number.isSafeInteger(x.intervalDays)||Number(x.intervalDays)<1||
    Number(x.intervalDays)>STOCK_COUNT_SCHEDULE_MAX_DAYS||
    !['ACTIVE','PAUSED'].includes(String(x.status))||
    !validText(x.reason,2000))
    throw new RangeError('COUNT_SCHEDULE_CADENCE_INVALID');
  return {
    materialCategory:x.materialCategory as string|null,
    firstDueDate:x.firstDueDate as string,
    intervalDays:x.intervalDays as number,
    status:x.status as 'ACTIVE'|'PAUSED',
    reason:x.reason as string,
  };
}
function epochDay(date:string):number{
  return Date.parse(date+'T00:00:00.000Z')/86400000;
}
export function nextScheduledCountDate(
  firstDueDate:string,intervalDays:number,asOfDate:string,
):string{
  if(!countScheduleDay(firstDueDate)||!countScheduleDay(asOfDate)||
    !Number.isSafeInteger(intervalDays)||intervalDays<1||
    intervalDays>STOCK_COUNT_SCHEDULE_MAX_DAYS)
    throw new RangeError('COUNT_SCHEDULE_DATE_INVALID');
  const start=epochDay(firstDueDate),asOf=epochDay(asOfDate);
  const advance=Math.max(0,Math.ceil((asOf-start)/intervalDays));
  const utc=new Date((start+advance*intervalDays)*86400000);
  if(!Number.isFinite(utc.getTime()))throw new RangeError('COUNT_SCHEDULE_OUT_OF_RANGE');
  return utc.toISOString().slice(0,10);
}
export function replayCountSchedules(rows:readonly CountScheduleEvent[]):CountScheduleState[]{
  const groups=new Map<string,CountScheduleEvent[]>();
  const allIds=new Set<string>();
  for(const event of rows){
    if(event.action!==STOCK_COUNT_SCHEDULE_SET||!uuid(event.id)||allIds.has(event.id)||
      !uuid(event.actorUserId)||!(event.occurredAt instanceof Date)||
      Number.isNaN(event.occurredAt.getTime()))
      throw new RangeError('COUNT_SCHEDULE_EVENT_INVALID');
    allIds.add(event.id);
    const v=object(event.newValues);
    if(!v||!uuid(v.projectId)||!uuid(v.warehouseId)||
      !Number.isSafeInteger(v.version)||Number(v.version)<1||
      !(v.previousEventId===null||uuid(v.previousEventId)))
      throw new RangeError('COUNT_SCHEDULE_CHAIN_INVALID');
    const body=countScheduleContract({
      materialCategory:v.materialCategory,
      firstDueDate:v.firstDueDate,intervalDays:v.intervalDays,
      status:v.status,reason:v.reason,
    });
    const groupKey=body.materialCategory===null?'__UNCATEGORIZED__':'category:'+body.materialCategory;
    groups.set(groupKey,[...(groups.get(groupKey)??[]),event]);
  }
  const states:CountScheduleState[]=[];
  for(const events of groups.values()){
    const byVersion=new Map<number,CountScheduleEvent>();
    for(const event of events){
      const v=object(event.newValues)!;
      const ver=v.version as number;
      if(byVersion.has(ver))throw new RangeError('COUNT_SCHEDULE_FORK');
      byVersion.set(ver,event);
    }
    let before:CountScheduleEvent|null=null;
    let state:CountScheduleState|null=null;
    for(let version=1;version<=events.length;version++){
      const event=byVersion.get(version);
      if(!event)throw new RangeError('COUNT_SCHEDULE_VERSION_GAP');
      const v=object(event.newValues)!;
      if(v.previousEventId!==(before?.id??null) ||
        (before!==null&&event.occurredAt.getTime()<before.occurredAt.getTime()))
        throw new RangeError('COUNT_SCHEDULE_BROKEN_LINK');
      const body=countScheduleContract({
        materialCategory:v.materialCategory,firstDueDate:v.firstDueDate,
        intervalDays:v.intervalDays,status:v.status,reason:v.reason,
      });
      if(state&&(state.projectId!==v.projectId||state.warehouseId!==v.warehouseId||
        state.materialCategory!==body.materialCategory))
        throw new RangeError('COUNT_SCHEDULE_SCOPE_MUTATION');
      state={...body,projectId:v.projectId as string,
        warehouseId:v.warehouseId as string,version,
        lastEventId:event.id,changedAt:event.occurredAt.toISOString(),
        changedByUserId:event.actorUserId};
      before=event;
    }
    if(state)states.push(state);
  }
  return states.sort((a,b)=>(a.materialCategory??'').localeCompare(b.materialCategory??''));
}
