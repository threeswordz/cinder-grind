// Caller-owned, isolated canonical HTTP journey. No session creation or DB writes here.
import {createHash} from 'node:crypto';
import {verifyFm02TerminalReadback} from './m6-fm02-terminal-readback.mjs';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_FM02_JOURNEY_'+c),{safeCode:'M6_FM02_JOURNEY_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const fm02BindingDigest=digest;
function fixed(x){need(typeof x==='string'&&/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(x),'QUANTITY');const [a,b='']=x.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));}
function half(x){const q=fixed(x);need(q>0n&&q%2n===0n,'HALF_NOT_EXACT');const n=q/2n;return String(n/10000n)+'.'+String(n%10000n).padStart(4,'0');}
export function createFm02CanonicalJourney({binding:b,authorization:a,operatorSha,request,verifyRuntime,verifyDelta}){
 const keys=['companyId','projectId','foreignProjectId','quantityActivityId','milestoneActivityId','budgetLineId','uomId','benUserId','pmUserId','foremanUserId'];
 need(b&&keys.every(k=>uuid(b[k]))&&new Set(keys.map(k=>b[k])).size===keys.length&&/^\d{4}-\d{2}-\d{2}$/.test(b.progressDate)&&Number.isFinite(Date.parse(b.progressDate))&&new Date(b.progressDate).toISOString().slice(0,10)===b.progressDate,'BINDING');
 need(a?.applicationSha==='70013b5139292ef33563447f8937c8f132feabd2'&&a.database==='m6_successor_rehearsal'&&/^[a-f0-9]{40}$/.test(operatorSha??'')&&a.operatorSha===operatorSha&&a.bindingSha256===digest(b)&&a.ownerAuthorizedFm02Journey===true&&a.retainedMutationAuthorized===false&&a.productionAuthorized===false,'AUTHORITY');
 need([request,verifyRuntime,verifyDelta].every(f=>typeof f==='function'),'ADAPTER');
 const binding=structuredClone(b),completed=half(binding.plannedQuantity),query='?projectId='+binding.projectId,scope=r=>r?.companyId===binding.companyId&&r.projectId===binding.projectId;
 let attempted=false;
 async function call(actor,method,path,body,status){await verifyRuntime();const r=await request({actor,method,path,body});need(r?.status===status,'HTTP_'+status);return r.data;}
 return async()=>{
  need(!attempted,'NO_REPLAY');attempted=true;
  const initial=await call('BEN','GET','/project-progress-plans/current'+query,undefined,200);need(initial?.projectId===binding.projectId&&initial.status==='NO_CONFIRMED_WORK_PLAN'&&initial.percentComplete===null,'INITIAL_CURRENT');
  const history=await call('BEN','GET','/project-progress-plans'+query,undefined,200);need(Array.isArray(history)&&history.length===0,'INITIAL_PLAN_HISTORY');
  await call('BEN','GET','/project-progress-plans/current?projectId='+binding.foreignProjectId,undefined,404);
  const options=await call('KHAIMOOK','GET','/project-progress-plans/options'+query,undefined,200);
  const q=options?.activities?.find(x=>x.id===binding.quantityActivityId),m=options?.activities?.find(x=>x.id===binding.milestoneActivityId),line=options?.quantityLines?.find(x=>x.id===binding.budgetLineId);
  need(q&&m&&q.isMilestone===false&&m.isMilestone===true&&line&&line.wbsId===q.wbsId&&line.uomId===binding.uomId&&fixed(line.quantity)===fixed(binding.plannedQuantity),'OPTIONS');
  const prepared=await call('KHAIMOOK','POST','/project-progress-plans/prepare',{projectId:binding.projectId,reason:'Synthetic M6 FM02 work plan',lines:[{activityId:q.id,weightPercent:'60.00',sourceKind:'QUANTITY',approvedBudgetRevisionLineId:line.id},{activityId:m.id,weightPercent:'40.00',sourceKind:'MILESTONE'}]},201);
  need(scope(prepared)&&uuid(prepared.id)&&prepared.versionNo===1&&prepared.preparedByUserId===binding.pmUserId&&prepared.confirmedAt===null,'PREPARED');
  const confirm='/project-progress-plans/'+prepared.id+'/confirm';
  await call('KHAIMOOK','POST',confirm,{expectedVersion:1},403);
  const plan=await call('BEN','POST',confirm,{expectedVersion:1},201);need(scope(plan)&&plan.id===prepared.id&&plan.versionNo===1&&plan.preparedByUserId===binding.pmUserId&&plan.confirmedByUserId===binding.benUserId,'CONFIRMED');
  const missing=await call('BEN','GET','/project-progress-plans/current'+query,undefined,200);need(missing?.planId===plan.id&&missing.status==='BLOCKED_MISSING_SOURCE'&&missing.percentComplete===null&&missing.missingActivityIds?.length===2&&[q.id,m.id].every(id=>missing.missingActivityIds.includes(id)),'MISSING_SOURCE');
  const quantityPath='/project-progress-plans/activity/'+q.id+'/quantity',measurement={progressDate:binding.progressDate,completedQuantity:completed,note:'Synthetic measured half quantity',expectedPlanId:plan.id,expectedPlanVersion:1};
  await call('FOREMAN','POST',quantityPath,{...measurement,expectedPlanVersion:2},409);
  const quantity=await call('FOREMAN','POST',quantityPath,measurement,201);
  const milestone=await call('FOREMAN','POST','/activity-progress/'+m.id,{progressDate:binding.progressDate,percentComplete:'25.00',note:'Synthetic milestone assessment'},201);
  const current=await call('BEN','GET','/project-progress-plans/current'+query,undefined,200);
  const proof=verifyFm02TerminalReadback({binding:{...binding,planId:plan.id,versionNo:1},plan,quantity,milestone,current});
  await verifyDelta({planId:plan.id,quantityId:quantity.id,milestoneId:milestone.id,expected:{project_progress_plans:1,project_progress_plan_lines:2,activity_progress:2,audit_logs:4}});
  return {...proof,independentConfirmationVerified:true,missingSourceBlocked:true,staleMeasurementDenied:true,foreignProjectDenied:true,canonicalApiVerified:true,browserVerified:false,productionAuthorized:false,automaticRetryAllowed:false};
 };
}
