// #338 read-only configuration inspection core; no CLI, grants or provisioning.
// A Mac caller must separately prove source/receipts/process/container/schema
// custody before opening its DB connection. This core is not that operator.
import {SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,populatedIdentity} from './prototype-browser-operator.mjs';

const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
const journey={
  STORE_SITE:['inventory.material_plan.view','inventory.material_plan.create','inventory.material_plan.submit',
    'budget.quantity.view','inventory.issue.view','inventory.issue.create','inventory.issue.reverse',
    'inventory.material_plan.issue.post','inventory.material_request.view','inventory.material_request.create',
    'inventory.material_request.link','inventory.material_request.acknowledge','documents.document.view',
    'documents.document.upload','documents.document.link','inventory.stock.view','inventory.report.view'],
  KHAIMOOK:['inventory.material_plan.view','inventory.material_plan.approve','budget.quantity.view',
    'inventory.issue.view','inventory.material_plan.overage.review'],
  BEN:['inventory.material_plan.view','budget.quantity.view','inventory.issue.view',
    'inventory.material_plan.overage.approve','inventory.material_plan.prototype.enable'],
};
const sourcePreparation={
  BEN:['budget.boq.view','budget.boq.manage','budget.revision.view','budget.revision.submit'],
  KHAIMOOK:['budget.revision.view','budget.revision.approve'],
};
// Candidate deltas only. The guarded follow-up must re-read exact before-state
// inside its own transaction; this function never authorizes or applies grants.
export function materialCapabilityDelta(observed,needsSourcePreparation){
  demand(typeof needsSourcePreparation==='boolean','MATERIAL_CONFIG_SOURCE_STATE_REQUIRED');
  return Object.fromEntries(Object.entries(journey).map(([key,required])=>{
    demand(Array.isArray(observed?.[key])&&observed[key].every(p=>typeof p==='string')&&
      new Set(observed[key]).size===observed[key].length,'MATERIAL_CONFIG_ROLE_INPUT_INVALID');
    const missing=codes=>codes.filter(p=>!observed[key].includes(p)).sort();
    return [key,{journeyMissing:missing(required),
      conditionalSourceMissing:needsSourcePreparation?missing(sourcePreparation[key]??[]):[]}];
  }));
}
const workflowMatches=(workflow,roles)=>workflow.steps.length===roles.length&&workflow.steps.every((step,i)=>
  step.stepNo===i+1&&step.requiredApprovals===1&&step.stepRoles.length===1&&step.stepRoles[0].roleId===roles[i]);

export async function inspectMaterialConfiguration(db,binding){
  // Snapshot caller-owned data before the first await. Extra roles, changed
  // grants and partial prior follow-up state are refused, never normalized.
  const b=structuredClone(binding),f=b?.fixture,a=b?.actors;
  demand(b?.sourceSha===SOURCE&&validPrivateActors({sourceSha:b.sourceSha,actors:a})&&
    ['companyId','adminUserId','foreignCompanyId','projectId','unassignedProjectId','foreignProjectId',
      'uomId','materialId','warehouseId'].every(k=>uuid(f?.[k])),'MATERIAL_CONFIG_BINDING_INVALID');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const settings=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    demand(settings.length===1&&settings[0].mode==='on','MATERIAL_CONFIG_READ_ONLY_REQUIRED');
    await populatedIdentity(tx,a,f);
    const employees=await tx.employee.findMany({select:{id:true,companyId:true,isActive:true}}),
      members=await tx.projectMember.findMany({select:{employeeId:true,projectId:true,isActive:true}});
    demand(employees.length===8&&members.length===8&&Object.values(a).every(actor=>
      employees.some(e=>e.id===actor.employeeId&&e.companyId===f.companyId&&e.isActive)&&
      members.filter(m=>m.employeeId===actor.employeeId&&m.projectId===f.projectId&&m.isActive).length===1),
      'MATERIAL_CONFIG_EMPLOYEE_OR_PROJECT_SCOPE_CHANGED');
    const [warehouse,material,uom]=await Promise.all([
      tx.warehouse.findFirst({where:{id:f.warehouseId,companyId:f.companyId,projectId:f.projectId,isActive:true,isSiteWarehouse:true},select:{id:true}}),
      tx.material.findFirst({where:{id:f.materialId,companyId:f.companyId,defaultUomId:f.uomId,isActive:true},select:{id:true}}),
      tx.unitOfMeasure.findFirst({where:{id:f.uomId,companyId:f.companyId,isActive:true},select:{id:true}}),
    ]);
    demand(warehouse&&material&&uom,'MATERIAL_CONFIG_DIMENSIONS_CHANGED');
    demand(await tx.materialPlanProjectPolicy.count({where:{companyId:f.companyId,projectId:f.projectId}})===0&&
      await tx.materialUsagePlan.count({where:{companyId:f.companyId,projectId:f.projectId}})===0,
      'MATERIAL_CONFIG_EXISTING_FOLLOWUP_RECONCILE');
    const roles=await tx.role.findMany({where:{companyId:f.companyId,isActive:true,roleCode:{in:Object.keys(journey).map(k=>'PROTO_'+k)}},
      select:{roleCode:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}});
    demand(roles.length===3,'MATERIAL_CONFIG_ROLE_INPUT_INVALID');
    const observed=Object.fromEntries(roles.map(r=>[r.roleCode.slice(6),r.rolePermissions.map(p=>p.permission.permissionCode)]));
    const approvedSources=await tx.budgetRevision.count({where:{companyId:f.companyId,projectId:f.projectId,
      approvalInstance:{approvalState:'APPROVED'}}});
    const deltas=materialCapabilityDelta(observed,approvedSources===0);
    const codes=[...new Set(Object.values(deltas).flatMap(d=>[...d.journeyMissing,...d.conditionalSourceMissing]))];
    const catalog=await tx.permission.findMany({where:{permissionCode:{in:codes}},select:{permissionCode:true}});
    demand(catalog.length===codes.length&&codes.every(p=>catalog.some(c=>c.permissionCode===p)),
      'MATERIAL_CONFIG_PERMISSION_CATALOG_MISSING');
    const workflows=await tx.approvalWorkflow.findMany({where:{companyId:f.companyId,isActive:true,
      entityType:{in:['MATERIAL_PLAN_OVERAGE','BUDGET_REVISION']}},select:{entityType:true,
      steps:{orderBy:{stepNo:'asc'},select:{stepNo:true,requiredApprovals:true,stepRoles:{select:{roleId:true}}}}}});
    const overage=workflows.filter(w=>w.entityType==='MATERIAL_PLAN_OVERAGE'&&workflowMatches(w,[a.KHAIMOOK.roleId,a.BEN.roleId])).length;
    const source=workflows.filter(w=>w.entityType==='BUDGET_REVISION'&&workflowMatches(w,[a.KHAIMOOK.roleId])).length;
    const documentTypes=await tx.documentType.count({where:{companyId:f.companyId,isActive:true}});
    const sequence=await tx.numberSequence.findUnique({where:{companyId_sequenceCode:{companyId:f.companyId,sequenceCode:'MATERIAL_ISSUE'}},
      select:{entityType:true,formatTemplate:true,resetRule:true}});
    demand(!sequence||(sequence.entityType==='MATERIAL_ISSUE'&&sequence.formatTemplate==='MIYYMM-###'&&sequence.resetRule==='MONTHLY'),
      'MATERIAL_CONFIG_NUMBER_SEQUENCE_CONFLICT');
    return {purpose:'SYNTHETIC_MATERIAL_CONFIGURATION_SNAPSHOT_ONLY',sourceSha:SOURCE,
      status:'MATERIAL_CONFIGURATION_INSPECTED',readOnlyTransactionVerified:true,configurationApplied:false,
      roleDeltas:deltas,approvedSourceRevisions:approvedSources,
      sourceMapping:approvedSources?'EXPLICIT_MAPPING_AND_APPROVAL_PROVENANCE_REQUIRED':'SOURCE_PREPARATION_REQUIRED',
      matchingOverageWorkflows:overage,matchingSourceWorkflows:source,activeDocumentTypes:documentTypes,
      documentTypeSelectionRequired:documentTypes>0,materialIssueSequence:sequence?'REUSE_EXISTING':'CREATE_REQUIRED',
      // Resources/quantities must be explicitly bound by the reviewed operator;
      // a count, matching UOM or commercial BOQ rate never selects an allowance.
      sourceMappingVerified:false,stockPreconditionVerified:false,targetCustodyVerified:false,
      fullBusinessRoleMatrixVerified:false,fullAuthenticatedBrowserJourneysVerified:false,
      populatedRecoveryVerified:false,prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false,
      secretsPrinted:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
