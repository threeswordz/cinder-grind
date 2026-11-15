// #338 synthetic follow-up configuration. No CLI or business approvals.
// Called only after the coordinator verifies source/build/process/target and
// creates a private no-overwrite start marker. A plan is never write authority.
import {createHash} from 'node:crypto';
import {SOURCE} from './prototype-actors.mjs';
import {inspectMaterialConfigurationState} from './prototype-material-configuration.mjs';
import {inspectMaterialPreconditionsState} from './prototype-material-preconditions.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const MARKER='PROTOTYPE_MATERIAL_CONFIGURATION';
const models=['company','project','employee','projectMember','userRole','role','rolePermission','hrCompanyAccess',
  'approvalWorkflow','approvalStep','approvalStepRole','numberSequence','documentType','boq','boqSection','boqItem',
  'budgetRevision','budgetRevisionLine','stockCount','stockTransaction','materialReservation','materialUsagePlan',
  'materialPlanProjectPolicy','materialIssue','materialReturn','stockTransfer'];
async function stateDigest(tx){
  const rows={};for(const m of models)rows[m]=(await tx[m].findMany()).map(r=>JSON.stringify(r)).sort();
  return hash(rows);
}
async function state(tx,b){
  demand(await tx.auditLog.count({where:{companyId:b.fixture.companyId,entityType:MARKER,entityId:b.fixture.projectId}})===0,
    'MATERIAL_CONFIGURATION_ALREADY_STARTED');
  const configuration=await inspectMaterialConfigurationState(tx,b),preconditions=await inspectMaterialPreconditionsState(tx,b);
  if(configuration.approvedSourceRevisions===0){
    demand(await tx.boq.count({where:{companyId:b.fixture.companyId,projectId:b.fixture.projectId}})===0&&
      await tx.budgetRevision.count({where:{companyId:b.fixture.companyId,projectId:b.fixture.projectId}})===0,
      'MATERIAL_EXISTING_SOURCE_DRAFT_REQUIRES_RECONCILIATION');
  }else demand(preconditions.sourceMappingVerified,'MATERIAL_EXPLICIT_SOURCE_MAPPING_REQUIRED');
  return {configuration,preconditions,stateSha256:await stateDigest(tx)};
}
export async function planMaterialConfiguration(db,binding){
  const b=structuredClone(binding);
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const mode=await tx.$queryRawUnsafe("SELECT current_setting('transaction_read_only') AS mode");
    demand(mode.length===1&&mode[0].mode==='on','MATERIAL_CONFIG_READ_ONLY_REQUIRED');
    const observed=await state(tx,b);
    return {...observed,status:'MATERIAL_CONFIGURATION_DELTA_PLANNED',configurationApplied:false,writeJourneyAuthorized:false};
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
async function workflow(tx,b,entityType,roles,code){
  const rows=await tx.approvalWorkflow.findMany({where:{companyId:b.fixture.companyId,entityType},
    include:{steps:{orderBy:{stepNo:'asc'},include:{stepRoles:true}}}});
  const matches=rows.filter(w=>w.isActive&&w.steps.length===roles.length&&w.steps.every((s,i)=>
    s.stepNo===i+1&&s.requiredApprovals===1&&s.stepRoles.length===1&&s.stepRoles[0].roleId===roles[i]));
  demand(matches.length<=1,'MATERIAL_CONFIGURATION_AMBIGUOUS_WORKFLOW');
  if(matches.length===1)return matches[0];
  demand(rows.length===0,'MATERIAL_CONFIGURATION_CONFLICTING_WORKFLOW');
  return tx.approvalWorkflow.create({data:{companyId:b.fixture.companyId,entityType,workflowCode:code,
    workflowName:'Synthetic material journey '+entityType,steps:{create:roles.map((roleId,i)=>({stepNo:i+1,
      stepName:i===0?'Independent reviewer':'Independent final authority',requiredApprovals:1,
      stepRoles:{create:[{roleId}]}}))}}});
}
async function sequence(tx,b,code,format,reset){
  const existing=await tx.numberSequence.findUnique({where:{companyId_sequenceCode:{companyId:b.fixture.companyId,sequenceCode:code}}});
  if(existing){demand(existing.entityType===code&&existing.formatTemplate===format&&existing.resetRule===reset,
    'MATERIAL_CONFIGURATION_SEQUENCE_CONFLICT');return;}
  await tx.numberSequence.create({data:{companyId:b.fixture.companyId,entityType:code,sequenceCode:code,
    formatTemplate:format,resetRule:reset}});
}
export async function applyMaterialConfiguration(db,binding,expectedStateSha256){
  const b=structuredClone(binding);
  demand(b?.sourceSha===SOURCE&&/^[a-f0-9]{64}$/.test(expectedStateSha256??''),'MATERIAL_CONFIGURATION_EXPECTED_STATE_REQUIRED');
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext('prototype-material-configuration-v1'))");
    // Repeat original identities, grant matrix and original stock history in the
    // SAME serializable write transaction. No inspection/write gap is accepted.
    const observed=await state(tx,b);
    demand(observed.stateSha256===expectedStateSha256,'MATERIAL_CONFIGURATION_STATE_DRIFT');
    const changes=[];
    for(const [key,delta] of Object.entries(observed.configuration.roleDeltas)){
      const codes=[...new Set([...delta.journeyMissing,...delta.conditionalSourceMissing])];
      if(!codes.length)continue;
      const permissions=await tx.permission.findMany({where:{permissionCode:{in:codes}}});
      demand(permissions.length===codes.length,'MATERIAL_CONFIG_PERMISSION_CATALOG_MISSING');
      // Exact initial matrix was read above; no skipDuplicates/upsert/role union.
      await tx.rolePermission.createMany({data:permissions.map(p=>({roleId:b.actors[key].roleId,permissionId:p.id}))});
      changes.push({roleCode:'PROTO_'+key,addedCapabilities:codes.sort()});
    }
    const overage=await workflow(tx,b,'MATERIAL_PLAN_OVERAGE',[b.actors.KHAIMOOK.roleId,b.actors.BEN.roleId],'PROTO_MATERIAL_OVERAGE_01');
    let source=null;
    if(observed.configuration.approvedSourceRevisions===0){
      source=await workflow(tx,b,'BUDGET_REVISION',[b.actors.KHAIMOOK.roleId],'PROTO_MATERIAL_SOURCE_01');
      await sequence(tx,b,'BUDGET_REVISION','BRYY-###','YEARLY');
    }
    await sequence(tx,b,'MATERIAL_ISSUE','MIYYMM-###','MONTHLY');
    // Never choose an existing type by count or position. Reuse requires an
    // explicit private selection, bound to this Company and ordinary Documents.
    const types=await tx.documentType.findMany({where:{companyId:b.fixture.companyId}});
    let type;
    if(types.length){
      demand(typeof b.documentTypeId==='string','MATERIAL_EXPLICIT_DOCUMENT_TYPE_REQUIRED');
      type=types.find(t=>t.id===b.documentTypeId&&t.isActive&&!t.documentTypeCode.startsWith('HR_'));
      demand(type,'MATERIAL_DOCUMENT_TYPE_SELECTION_INVALID');
      demand(await tx.hrDocumentAttachment.count({where:{document:{documentTypeId:type.id}}})===0,
        'MATERIAL_PRIVATE_DOCUMENT_TYPE_REFUSED');
    }else{
      demand(b.documentTypeId===undefined,'MATERIAL_DOCUMENT_TYPE_SELECTION_INVALID');
      type=await tx.documentType.create({data:{companyId:b.fixture.companyId,documentTypeCode:'PROTO_MATERIAL_SIGNED_01',
        documentTypeName:'Synthetic material handover evidence'}});
    }
    const afterStateSha256=await stateDigest(tx);
    const receipt={sourceSha:SOURCE,projectId:b.fixture.projectId,syntheticOnly:true,
      beforeStateSha256:expectedStateSha256,afterStateSha256,changes,
      overageWorkflowCode:overage.workflowCode,sourceWorkflowCode:source?.workflowCode??null,documentTypeId:type.id};
    await tx.auditLog.create({data:{companyId:b.fixture.companyId,entityType:MARKER,entityId:b.fixture.projectId,
      action:'CONFIGURE',actorUserId:b.fixture.adminUserId,newValues:receipt}});
    return {...receipt,status:'MATERIAL_SYNTHETIC_CONFIGURATION_APPLIED',configurationApplied:true,
      sourceApproved:false,policyEnabled:false,stockPosted:false,productionAuthorized:false};
  },{isolationLevel:'Serializable',timeout:30000});
}
