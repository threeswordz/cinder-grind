// DEC-050 bounded migrated prototype: a genuinely approved synthetic Cost source
// followed by the canonical plan-policy within-plan converted material issue.
// The old configured Ben→Khaimook Cost route is TECHNICAL ONLY until DEC-054
// owner-selected Ben Cost self-approval, disclosure and buffer runtime ships.
// Do not treat this isolated acceptance fixture as new Cost BOQ business UAT.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {SOURCE,httpClient} from './prototype-actors.mjs';
import {validUomOrigins} from './prototype-uom-state.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const n4=x=>Number(x).toFixed(4);
export async function convertedPlanIssue(db,binding,source,{api,web}){
 const b=structuredClone(binding),f=b.fixture,materialId=source?.material?.id;
 demand(b.sourceSha===SOURCE&&validUomOrigins(api,web)&&
  source?.company?.id===f.companyId&&source?.material?.code==='PROTO_UOM_NEW',
  'UOM_PLAN_SYNTHETIC_BINDING_REFUSED');
 const boq=await db.boq.findFirst({where:{companyId:f.companyId,projectId:f.projectId},
  include:{sections:true,items:true}});
 const section=boq?.sections.find(z=>z.sectionCode==='PROTO_MATERIAL'&&z.isActive);
 const oldItem=boq?.items.find(z=>z.itemCode==='PROTO_STEEL_10'&&z.isActive);
 const earlier=await db.budgetRevision.findMany({where:{companyId:f.companyId,projectId:f.projectId,
  approvalInstance:{approvalState:'APPROVED'}}});
 const workflows=await db.approvalWorkflow.findMany({where:{companyId:f.companyId,entityType:'BUDGET_REVISION',
  workflowCode:'PROTO_MATERIAL_SOURCE_01',isActive:true},
  include:{steps:{include:{stepRoles:true}}}});
 const w=workflows[0];
 const policy=await db.materialPlanProjectPolicy.findUnique({where:{projectId:f.projectId}});
 const oldStock=await db.stockTransaction.findMany({where:{companyId:f.companyId}});
 demand(boq&&section&&oldItem&&boq.items.length===1&&earlier.length===1&&
  w&&w.steps.length===1&&w.steps[0].stepNo===1&&w.steps[0].requiredApprovals===1&&
  w.steps[0].stepRoles.length===1&&w.steps[0].stepRoles[0].roleId===b.actors.KHAIMOOK.roleId&&
  policy?.companyId===f.companyId&&await db.materialUsagePlanLine.count({where:{materialId}})===0&&
  oldStock.filter(row=>row.materialId===materialId).length===1,
  'UOM_PLAN_APPROVED_PREDECESSOR_OR_EXISTING_SOURCE_INVALID');
 const sessions={},client=httpClient(api,web,async(url,options)=>{
  const path=url.slice(api.length);
  demand(url.startsWith(api+'/')&&options.redirect==='error'&&options.headers.Origin===web&&
   ['GET','POST'].includes(options.method)&&
   (['/auth/login','/auth/logout','/auth/me'].includes(path)||
    path==='/budget/boqs/'+boq.id+'/items'||path==='/budget/projects/'+f.projectId+'/revisions'||
    path.startsWith('/budget/revisions/')||path==='/inventory/material-plans'||
    path.startsWith('/inventory/material-plans/')||
    path==='/inventory/material-issues'||path.startsWith('/inventory/material-issues/')||
    path==='/inventory/material-returns'||path.startsWith('/inventory/material-returns/')||
    path.startsWith('/inventory/material-plan-issues/')||
    path.startsWith('/inventory/reports/movements?')),
   'UOM_PLAN_UNDECLARED_HTTP_REQUEST');
  return fetch(url,options);
 });
 const call=async(key,label,path,body,expected=201)=>
  (await client.call(sessions[key],label,path,expected,body)).value?.data;
 const requestKey=()=>randomUUID(),plans=()=>db.materialUsagePlanLine.findMany({where:{materialId}});
 const balance=async()=>n4((await db.stockTransaction.aggregate({
  where:{companyId:f.companyId,materialId,uomId:source.each.id},_sum:{quantity:true}}))._sum.quantity??0);
 let primary,result,phase='LOGIN';
 try{
  for(const key of ['BEN','KHAIMOOK','STORE_SITE','FOREMAN'])
   sessions[key]=await client.login('UOM_PLAN_'+key,b.actors[key],f.companyId);
  phase='COST_SOURCE';
  // A new line on the existing canonical Cost BOQ, never a second BOQ or a
  // mutation of the earlier approved 10-piece legacy source revision.
  const item=await call('BEN','UOM_PLAN_COST_LINE','/budget/boqs/'+boq.id+'/items',{
   sectionId:section.id,itemCode:'PROTO_UOM_CTN_03',
   description:'TECHNICAL synthetic three-carton source; not business Cost approval',
   quantity:'3.0000',uomId:source.carton.id,rate:'1.0000',
   wbsId:null,costCodeId:null,sortOrder:2});
  demand(item?.boqId===boq.id&&item.uomId===source.carton.id,'UOM_PLAN_SOURCE_LINE_INVALID');
  const revision=await call('BEN','UOM_PLAN_COST_REVISION','/budget/projects/'+f.projectId+'/revisions',{
   revisionNote:'TECHNICAL synthetic UOM source using only currently deployed Cost workflow'});
  await call('BEN','UOM_PLAN_COST_SUBMIT','/budget/revisions/'+revision.id+'/submit',{
   workflowCode:w.workflowCode});
  await call('KHAIMOOK','UOM_PLAN_COST_CHECK','/budget/revisions/'+revision.id+'/approve',{
   comment:'Technical-only independent synthetic snapshot; DEC-054 owner Cost approval remains pending'});
  const approved=await call('BEN','UOM_PLAN_COST_READ','/budget/revisions/'+revision.id,undefined,200);
  const line=approved?.lines?.find(x=>x.boqItemId===item.id);
  demand(approved?.approvalInstance?.approvalState==='APPROVED'&&
   approved.createdByUserId===b.actors.BEN.userId&&
   approved.submittedByUserId===b.actors.BEN.userId&&
   approved.approvalInstance.actions.length===1&&
   approved.approvalInstance.actions[0].actionByUserId===b.actors.KHAIMOOK.userId&&
   line&&line.uomId===source.carton.id&&n4(line.quantity)==='3.0000',
   'UOM_PLAN_COST_SOURCE_NOT_CANONICALLY_APPROVED');
  for(const old of earlier){
   assert.deepEqual(await db.budgetRevision.findUnique({where:{id:old.id}}),old,
    'Earlier approved Cost revision was altered');
  }
  phase='PLAN_APPROVAL';
  const planBody={requestKey:requestKey(),projectId:f.projectId,warehouseId:f.warehouseId,
   budgetRevisionId:revision.id,workPackageCode:'PROTO_UOM_CONVERTED',
   validFrom:'2026-11-19',validTo:'2027-12-31',
   reason:'TECHNICAL existing Cost snapshot for pinned UOM plan allowance',
   lines:[{budgetRevisionLineId:line.id,materialId,uomId:source.carton.id,quantity:'2.0000'}]};
  await call('FOREMAN','UOM_PLAN_FOREMAN_DENIED','/inventory/material-plans',planBody,403);
  const plan=await call('STORE_SITE','UOM_PLAN_CREATE','/inventory/material-plans',planBody);
  let detail=await call('STORE_SITE','UOM_PLAN_READ_DRAFT','/inventory/material-plans/'+plan.id,undefined,200);
  demand(detail?.latestRevision?.lines?.length===1&&
   detail.latestRevision.lines[0]?.materialUomPlanLinePin?.stockQuantity==='40.0000'&&
   detail.latestRevision.lines[0]?.materialUomPlanLinePin?.numerator==='20',
   'UOM_PLAN_FROZEN_ALLOWANCE_INVALID');
  const submitted=await call('STORE_SITE','UOM_PLAN_SUBMIT','/inventory/material-plans/'+plan.id+'/submit',{
   requestKey:requestKey(),expectedVersion:detail.version});
  await call('KHAIMOOK','UOM_PLAN_INDEPENDENT_APPROVE','/inventory/material-plans/'+plan.id+'/decision',{
   requestKey:requestKey(),expectedVersion:submitted.version,decision:'APPROVE',
   comment:'Independent synthetic approved physical quantity plan'});
  detail=await call('STORE_SITE','UOM_PLAN_READ_APPROVED','/inventory/material-plans/'+plan.id,undefined,200);
  const planLine=detail?.approvedRevision?.lines?.[0];
  demand(planLine?.materialId===materialId&&
   planLine.materialUomPlanLinePin?.stockQuantity==='40.0000'&&
   planLine.materialUomPlanLinePin?.businessDate==='2026-11-19'&&
   planLine.usageBasis==='FROZEN_STOCK_CANONICAL'&&
   planLine.usedQuantity==='0.0000'&&planLine.remainingQuantity==='40.0000',
   'UOM_PLAN_NOT_APPROVED_IN_CANONICAL_STOCK_BASIS');
  assert.equal(await balance(),'60.0000','Plan creation must not post stock');
  phase='WITHIN_PLAN_ISSUE';
  const issueBody={projectId:f.projectId,warehouseId:f.warehouseId,
   issueDate:'2026-11-19',issuedToEmployeeId:b.actors.FOREMAN.employeeId,
   lines:[{materialId,uomId:source.carton.id,quantity:'1.0000'}],
   remarks:'Original20-to-1 UOM within valid approved source'};
  await call('FOREMAN','UOM_PLAN_FOREMAN_ISSUE_DENIED','/inventory/material-issues',issueBody,403);
  const issue=await call('STORE_SITE','UOM_PLAN_ISSUE_CREATE','/inventory/material-issues',issueBody);
  const issued=await call('STORE_SITE','UOM_PLAN_ISSUE_READ','/inventory/material-issues/'+issue.id,undefined,200);
  const itemId=issued?.items?.[0]?.id;
  demand(itemId&&await db.materialPlanIssueBinding.count({where:{issueId:issue.id,policyId:policy.id}})===1,
   'UOM_PLAN_AUTO_BOUND_POLICY_REQUIRED');
  // Explicitly prove that the legacy independent approval path cannot be used
  // for the already-enabled project; the canonical plan operation posts instead.
  const bindings={requestKey:requestKey(),bindings:[{issueItemId:itemId,
   planLineId:planLine.id,expectedPlanVersion:detail.version}]};
  const preview=await call('STORE_SITE','UOM_PLAN_ISSUE_PREVIEW',
   '/inventory/material-plan-issues/issues/'+issue.id+'/preview',bindings);
  demand(preview?.result==='WITHIN_PLAN','UOM_PLAN_ISSUE_NOT_WITHIN_FROZEN_ALLOWANCE');
  const posted=await call('STORE_SITE','UOM_PLAN_WITHIN_POST',
   '/inventory/material-plan-issues/issues/'+issue.id+'/within-plan',bindings);
  demand(posted?.status==='POSTED','UOM_PLAN_WITHIN_POST_FAILED');
  const replay=await call('STORE_SITE','UOM_PLAN_WITHIN_POST_REPLAY',
   '/inventory/material-plan-issues/issues/'+issue.id+'/within-plan',bindings);
  assert.deepEqual(replay,posted,'Plan operation replay changed canonical outcome');
  assert.equal(await balance(),'40.0000','One carton must debit exactly20 pieces');
  const effect=await db.stockTransaction.findFirstOrThrow({where:{materialIssueId:issue.id,movementType:'MATERIAL_ISSUE'},
   include:{materialUomEffectPin:true}});
  demand(n4(effect.quantity)==='-20.0000'&&effect.uomId===source.each.id&&
   effect.materialUomEffectPin?.numerator==='20'&&
   effect.materialUomEffectPin?.businessDate.toISOString().slice(0,10)==='2026-11-19',
   'UOM_PLAN_ISSUE_EFFECT_NOT_CANONICAL');
  const after=await call('STORE_SITE','UOM_PLAN_USED_READ','/inventory/material-plans/'+plan.id,undefined,200);
  demand(after.approvedRevision.lines[0].usedQuantity==='20.0000'&&
   after.approvedRevision.lines[0].remainingQuantity==='20.0000',
   'UOM_PLAN_USAGE_INCORRECT');
  const report=await call('STORE_SITE','UOM_PLAN_MOVEMENT',
   '/inventory/reports/movements?projectId='+f.projectId+'&materialId='+materialId,undefined,200);
  demand(report.some(row=>row.sourceType==='MATERIAL_ISSUE'&&row.quantity==='-20.0000'&&
   row.conversion?.numerator==='20'),'UOM_PLAN_ISSUE_NOT_REPORTED');
  // Return is a separate independent Khaimook-approved canonical movement.
  // Its exact original source pin, not a future definition, credits half the
  // originally issued carton. Existing project plan bindings remain in force.
  phase='RETURN_CONFIGURATION';
  const returnWorkflow=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-uom-planned-return-v1'))");
   demand(await tx.materialReturnItem.count({where:{materialId}})===0,
    'UOM_PLAN_RETURN_PREVIOUS_SOURCE_EXISTS');
   const expected={
    STORE_SITE:['inventory.return.view','inventory.return.create','inventory.return.submit','inventory.return.reverse'],
    KHAIMOOK:['inventory.return.view','inventory.return.approve']
   };
   const list=[...new Set(Object.values(expected).flat())],
    catalog=await tx.permission.findMany({where:{permissionCode:{in:list}}});
   demand(catalog.length===list.length,'UOM_PLAN_RETURN_PERMISSION_CATALOG');
   for(const [key,codes]of Object.entries(expected)){
    const role=await tx.role.findUnique({where:{id:b.actors[key].roleId},
     include:{rolePermissions:{select:{permissionId:true}}}});
    demand(role?.companyId===f.companyId&&role.roleCode==='PROTO_'+key&&
     codes.every(c=>role.rolePermissions.some(p=>p.permissionId===catalog.find(q=>q.permissionCode===c)?.id)),
     'UOM_PLAN_RETURN_ROLE_NOT_EXPLICITLY_GRANTED');
   }
   const sequence=await tx.numberSequence.findUnique({
    where:{companyId_sequenceCode:{companyId:f.companyId,sequenceCode:'MATERIAL_RETURN'}}});
   if(sequence){
    demand(sequence.entityType==='MATERIAL_RETURN'&&sequence.formatTemplate==='MRTYYMM-###'&&
     sequence.resetRule==='MONTHLY','UOM_PLAN_RETURN_OLD_SEQUENCE_CONFLICT');
   }else await tx.numberSequence.create({data:{companyId:f.companyId,entityType:'MATERIAL_RETURN',
    sequenceCode:'MATERIAL_RETURN',formatTemplate:'MRTYYMM-###',resetRule:'MONTHLY'}});
   const candidates=await tx.approvalWorkflow.findMany({where:{companyId:f.companyId,entityType:'MATERIAL_RETURN'},
    include:{steps:{orderBy:{stepNo:'asc'},include:{stepRoles:true}}}});
   demand(candidates.length<=1,'UOM_PLAN_RETURN_WORKFLOW_AMBIGUOUS');
   const prior=candidates[0];
   if(prior){
    demand(prior.isActive&&prior.steps.length===1&&prior.steps[0].stepNo===1&&
     prior.steps[0].requiredApprovals===1&&prior.steps[0].stepRoles.length===1&&
     prior.steps[0].stepRoles[0].roleId===b.actors.KHAIMOOK.roleId,
     'UOM_PLAN_RETURN_PREEXISTING_WORKFLOW_WRONG');
    return prior.workflowCode;
   }
   const created=await tx.approvalWorkflow.create({data:{companyId:f.companyId,
    entityType:'MATERIAL_RETURN',workflowCode:'PROTO_UOM_PLANNED_RETURN',
    workflowName:'Technical converted synthetic return approval',
    steps:{create:[{stepNo:1,stepName:'Khaimook independent physical return',
     requiredApprovals:1,stepRoles:{create:[{roleId:b.actors.KHAIMOOK.roleId}]}}]}}});
   return created.workflowCode;
  },{isolationLevel:'Serializable',timeout:30000});
  phase='RETURN_SOURCE';
  const returned=await call('STORE_SITE','UOM_PLAN_RETURN_CREATE','/inventory/material-returns',{
   projectId:f.projectId,warehouseId:f.warehouseId,returnDate:'2026-11-20',
   remarks:'Isolated synthetic half carton; original20-to-1 issue factor retained',
   lines:[{materialIssueItemId:itemId,quantity:'0.5000',remarks:'Original issued carton half returned'}]});
  const returnPath='/inventory/material-returns/'+returned.id;
  await call('STORE_SITE','UOM_PLAN_RETURN_SUBMIT',returnPath+'/submit',{workflowCode:returnWorkflow});
  await call('STORE_SITE','UOM_PLAN_MAKER_RETURN_APPROVE_DENIED',returnPath+'/approve',
   {postKey:requestKey()},403);
  phase='RETURN_APPROVE';
  const returnPost={postKey:requestKey(),comment:'Independent synthetic return against original posted issue'};
  await call('KHAIMOOK','UOM_PLAN_RETURN_APPROVE',returnPath+'/approve',returnPost);
  await call('KHAIMOOK','UOM_PLAN_RETURN_REPLAY',returnPath+'/approve',returnPost);
  assert.equal(await balance(),'50.0000','Half returned carton must credit10 stock pieces');
  const postedReturn=await db.stockTransaction.findFirstOrThrow({
   where:{materialReturnId:returned.id,movementType:'MATERIAL_RETURN'},
   include:{materialUomEffectPin:true}});
  demand(n4(postedReturn.quantity)==='10.0000'&&postedReturn.uomId===source.each.id&&
   postedReturn.materialUomEffectPin?.numerator==='20'&&
   postedReturn.materialUomEffectPin?.businessDate.toISOString().slice(0,10)==='2026-11-19'&&
   n4(postedReturn.materialUomEffectPin?.sourceQuantity)==='0.5000',
   'UOM_PLAN_RETURN_ORIGINAL_RATE_NOT_PRESERVED');
  const afterReturn=await call('STORE_SITE','UOM_PLAN_USAGE_AFTER_RETURN',
   '/inventory/material-plans/'+plan.id,undefined,200);
  demand(afterReturn.approvedRevision.lines[0].usedQuantity==='10.0000'&&
   afterReturn.approvedRevision.lines[0].remainingQuantity==='30.0000',
   'UOM_PLAN_RETURN_USAGE_CREDIT_INCORRECT');
  // Reversing a posted Issue with a live posted Return is prohibited. Reverse
  // the Return first, then the Issue, preserving all four immutable movements.
  phase='RETURN_REVERSE';
  const returnReverse={reversalKey:requestKey(),
   reason:'Synthetic credited return reversed before original plan issue'};
  await call('STORE_SITE','UOM_PLAN_RETURN_REVERSE',returnPath+'/reverse',returnReverse);
  await call('STORE_SITE','UOM_PLAN_RETURN_REVERSE_REPLAY',returnPath+'/reverse',returnReverse);
  assert.equal(await balance(),'40.0000','Return reversal must remove10 credited stock pieces');
  phase='ISSUE_REVERSE';
  const reverse={reversalKey:requestKey(),reason:'Synthetic within-plan reversal with immutable history'};
  await call('STORE_SITE','UOM_PLAN_ISSUE_REVERSE','/inventory/material-issues/'+issue.id+'/reverse',reverse);
  await call('STORE_SITE','UOM_PLAN_ISSUE_REVERSE_REPLAY','/inventory/material-issues/'+issue.id+'/reverse',reverse);
  assert.equal(await balance(),'60.0000','Canonical issue reversal must restore60 pieces');
  const original=await db.stockTransaction.findMany({where:{companyId:f.companyId}});
  for(const old of oldStock)assert.deepEqual(original.find(row=>row.id===old.id),old,'Pre-UOM stock mutated');
  demand(original.length===oldStock.length+4,'UOM_PLAN_UNEXPECTED_STOCK_WRITES');
  const finalPlan=await call('STORE_SITE','UOM_PLAN_FINAL_USAGE','/inventory/material-plans/'+plan.id,undefined,200);
  demand(finalPlan.approvedRevision.lines[0].usedQuantity==='0.0000'&&
   finalPlan.approvedRevision.lines[0].remainingQuantity==='40.0000',
   'UOM_PLAN_RETURNED_STOCK_ALLOWANCE_NOT_RESTORED');
  result={convertedApprovedSourcePlanAndIssueVerified:true,
   convertedPlannedReturnVerified:true,originalIssuedConversionPreservedOnReturn:true,
   syntheticLegacyCostWorkflowOnly:true,currentOwnerCostSelfApprovalNotVerified:true,
   costSourceRevisionId:revision.id,planId:plan.id,issueId:issue.id,
   frozenPlanStockQuantity:'40.0000',convertedIssueQuantity:'20.0000',
   sourceHistoryPreserved:true,finalStockBalance:'60.0000'};
 }catch(e){primary=e;if(!e.safeCode)e.safeCode='UOM_PLAN_'+phase+'_FAILED';}
 finally{for(const [key,session]of Object.entries(sessions))try{
  await client.logout('UOM_PLAN_'+key,session);
  await client.call(session,'UOM_PLAN_'+key+'_REVOKED','/auth/me',401);
 }catch(e){primary??=e;}}
 if(primary)throw primary;
 return result;
}
