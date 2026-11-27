// Verify the bounded 60/40 FM02 journey after caller-owned canonical API writes.
// No writes, permissions, plan activation, or human acceptance here.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_FM02_TERMINAL_'+c),{safeCode:'M6_FM02_TERMINAL_'+c});};
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x);
function fixed(x){need(typeof x==='string'&&/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(x),'DECIMAL');const [a,b='']=x.split('.');return BigInt(a)*10000n+BigInt(b.padEnd(4,'0'));}
export function verifyFm02TerminalReadback({binding:b,plan,quantity,milestone,current}){
 const ids=['companyId','projectId','planId','quantityActivityId','milestoneActivityId','budgetLineId','uomId','benUserId','foremanUserId'];
 need(b&&ids.every(k=>uuid(b[k]))&&new Set(ids.map(k=>b[k])).size===ids.length&&Number.isSafeInteger(b.versionNo)&&b.versionNo>0,'BINDING');
 const scope=r=>r?.companyId===b.companyId&&r.projectId===b.projectId;
 need(scope(plan)&&plan.id===b.planId&&plan.versionNo===b.versionNo&&plan.confirmedByUserId===b.benUserId&&Number.isFinite(Date.parse(plan.confirmedAt))&&Array.isArray(plan.lines)&&plan.lines.length===2,'CONFIRMED_PLAN');
 const q=plan.lines.find(l=>l.activityId===b.quantityActivityId),m=plan.lines.find(l=>l.activityId===b.milestoneActivityId);
 need(q&&m&&q.sourceKind==='QUANTITY'&&m.sourceKind==='MILESTONE'&&fixed(q.weightPercent)===600000n&&fixed(m.weightPercent)===400000n&&q.approvedBudgetRevisionLineId===b.budgetLineId&&q.uomId===b.uomId&&m.approvedBudgetRevisionLineId===null&&m.uomId===null&&m.plannedQuantity===null,'PLAN_LINES');
 need(scope(quantity)&&uuid(quantity.id)&&quantity.activityId===q.activityId&&quantity.recordedByUserId===b.foremanUserId&&quantity.sourceType==='BOQ_QUANTITY'&&quantity.sourceEntityId===b.planId&&quantity.sourceBudgetRevisionLineId===b.budgetLineId&&quantity.sourceUomId===b.uomId&&typeof quantity.note==='string'&&quantity.note.trim()&&fixed(quantity.percentComplete)===500000n,'QUANTITY_SOURCE');
 need(fixed(q.plannedQuantity)>0n&&2n*fixed(quantity.completedQuantity)===fixed(q.plannedQuantity),'QUANTITY_RATIO');
 need(scope(milestone)&&uuid(milestone.id)&&milestone.id!==quantity.id&&milestone.activityId===m.activityId&&milestone.recordedByUserId===b.foremanUserId&&milestone.sourceType==='MANUAL'&&milestone.completedQuantity===null&&milestone.sourceBudgetRevisionLineId===null&&milestone.sourceUomId===null&&typeof milestone.note==='string'&&milestone.note.trim()&&fixed(milestone.percentComplete)===250000n,'MILESTONE_SOURCE');
 need(current?.projectId===b.projectId&&current.planId===b.planId&&current.versionNo===b.versionNo&&current.confirmedBy?.id===b.benUserId&&Date.parse(current.confirmedAt)===Date.parse(plan.confirmedAt)&&current.status==='CALCULATED_TECHNICAL_ONLY'&&current.percentComplete==='40.00'&&Array.isArray(current.missingActivityIds)&&current.missingActivityIds.length===0&&Array.isArray(current.lines)&&current.lines.length===2,'ROLLUP');
 for(const [line,kind,weight,percent] of [[q,'QUANTITY','60.00','50.00'],[m,'MILESTONE','40.00','25.00']]){const a=current.lines.filter(x=>x.activityId===line.activityId);need(a.length===1&&a[0].planSourceKind===kind&&a[0].sourceKind===kind&&a[0].weightPercent===weight&&a[0].percentComplete===percent,'ROLLUP_LINE');}
 return {status:'M6_FM02_TERMINAL_READBACK_VERIFIED',weightedPercent:'40.00',planSourceBound:true,quantitySourceBound:true,milestoneSourceBound:true,humanUatCompleted:false};
}
