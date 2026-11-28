/** Approved HR03 request routing only. The application must resolve worker
 * classification, maker, approvers and scope from persisted authorized records.
 * No entitlements, wage calculation, or permission grant is implied. */
export type WorkerKind = 'SITE_WORKER'|'FOREMAN'|'SITE_LEADER'|'OFFICE';
export type RequestKind = 'LEAVE'|'OVERTIME';
export type HrActor = 'STORE'|'FOREMAN'|'PM'|'HR'|'BEN'|'SELF';
export type Route = Readonly<{maker:HrActor;checkers:readonly HrActor[]}>;
export function requestRoute(kind:RequestKind,worker:WorkerKind):Route {
  if(!['LEAVE','OVERTIME'].includes(kind)||!['SITE_WORKER','FOREMAN','SITE_LEADER','OFFICE'].includes(worker))throw new Error('HR_REQUEST_ROUTE_UNKNOWN');
  if(kind==='OVERTIME')return {maker:worker==='OFFICE'?'SELF':'PM',checkers:['HR','BEN']};
  switch(worker){
    case 'SITE_WORKER':return {maker:'STORE',checkers:['FOREMAN','HR']};
    case 'FOREMAN':return {maker:'SELF',checkers:['PM','HR','BEN']};
    case 'OFFICE':return {maker:'SELF',checkers:['HR','BEN']};
    // Maker for other site-leader cases is not unambiguously settled:
    // refuse rather than invent a creator role.
    default:throw new Error('HR_REQUEST_MAKER_UNRESOLVED');
  }
}
export type RequestStep=Readonly<{actorId:string;role:HrActor}>;
export type ReviewState=Readonly<{status:'PENDING'|'APPROVED'|'REJECTED'|'RETURNED';next:number;version:number}>;
/** Server-bound actor/route. Role alone is insufficient; actors must be
 * distinct and target-scoped. Returned/rejected revisions stay historical. */
export function reviewRequest(state:ReviewState,steps:readonly RequestStep[],makerId:string,actor:RequestStep,action:'APPROVE'|'REJECT'|'RETURN',expectedVersion:number):ReviewState {
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<1||expectedVersion!==state.version||state.status!=='PENDING')throw new Error('HR_REQUEST_STALE');
  if(!makerId||steps.length===0||steps.some(s=>!s.actorId||s.actorId===makerId)||new Set(steps.map(s=>s.actorId)).size!==steps.length)throw new Error('HR_REQUEST_CHECKER_INVALID');
  const next=steps[state.next];
  if(!next||next.actorId!==actor.actorId||next.role!==actor.role)throw new Error('HR_REQUEST_DENIED');
  if(action==='RETURN'||action==='REJECT')return {status:action==='RETURN'?'RETURNED':'REJECTED',next:state.next,version:state.version+1};
  if(action!=='APPROVE')throw new Error('HR_REQUEST_ACTION_INVALID');
  return {status:state.next+1===steps.length?'APPROVED':'PENDING',next:state.next+1,version:state.version+1};
}
export function assertActualOvertime(requestedMinutes:number,actualMinutes:number,excessReason:string|null) {
  if(!Number.isSafeInteger(requestedMinutes)||requestedMinutes<=0||requestedMinutes>1440||!Number.isSafeInteger(actualMinutes)||actualMinutes<0||actualMinutes>1440)throw new Error('HR_OVERTIME_EVIDENCE_INVALID');
  if(actualMinutes>requestedMinutes&&(!excessReason?.trim()||excessReason.length>1000))throw new Error('HR_OVERTIME_EXCESS_REASON_REQUIRED');
  return {requestedMinutes,actualMinutes,excessMinutes:Math.max(0,actualMinutes-requestedMinutes)};
}
