// Shared API execution core. Used by the guarded Mac coordinator and unique CI
// DB harness; never creates actors, resets data or invokes fixture setup.
import {SOURCE} from './prototype-actors.mjs';
import {materialSourceHttp} from './prototype-material-source.mjs';
import {runMaterialApiJourney} from './prototype-material-journey.mjs';
import {inspectMaterialPreconditions} from './prototype-material-preconditions.mjs';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
export async function executeMaterialRun(db,binding,configuration,origins,saveEvidence){
  const b=structuredClone(binding),f=b.fixture;
  demand(configuration?.status==='MATERIAL_SYNTHETIC_CONFIGURATION_APPLIED'&&configuration.sourceSha===SOURCE&&
    configuration.projectId===f.projectId&&configuration.productionAuthorized===false&&
    typeof saveEvidence==='function','MATERIAL_RUN_CONFIGURATION_REQUIRED');
  const base={...origins,sourceSha:SOURCE,companyId:f.companyId,projectId:f.projectId,
    warehouseId:f.warehouseId,materialId:f.materialId,uomId:f.uomId,
    storeEmployeeId:b.actors.STORE_SITE.employeeId,foremanEmployeeId:b.actors.FOREMAN.employeeId,
    sourceWorkflowCode:configuration.sourceWorkflowCode,overageWorkflowCode:configuration.overageWorkflowCode,
    documentTypeId:configuration.documentTypeId};
  const auth=materialSourceHttp(base),sessions={};
  const financial=async()=>({payments:await db.payment.count(),directCosts:await db.directCostPosting.count(),
    supplierInvoices:await db.supplierInvoice.count(),clientInvoices:await db.clientInvoice.count(),
    purchaseOrders:await db.purchaseOrder.count()});
  const before=await financial();let result,primary;
  try{
    for(const key of ['BEN','KHAIMOOK','STORE_SITE','FOREMAN'])sessions[key]=await auth.login(key,b.actors[key],f.companyId);
    const mapping=b.sourceMapping??await auth.prepare(sessions.BEN,sessions.KHAIMOOK);
    // The actual persisted maker/submitter/independent-approval provenance and
    // original ledger are checked after HTTP preparation, before first issue.
    const preconditions=await inspectMaterialPreconditions(db,{...b,sourceMapping:mapping});
    demand(preconditions.sourceMappingVerified,'MATERIAL_RUN_SOURCE_PROVENANCE_REQUIRED');
    result=await runMaterialApiJourney({...base,budgetRevisionId:mapping.budgetRevisionId,
      budgetRevisionLineId:mapping.budgetRevisionLineId},sessions);
    demand(JSON.stringify(await financial())===JSON.stringify(before),'MATERIAL_RUN_FINANCE_CHANGED');
    demand(await db.stockTransaction.count()===5&&await db.materialIssue.count()===2&&
      await db.materialReservation.count()===0,'MATERIAL_RUN_CANONICAL_HISTORY_CHANGED');
    const originals=await db.stockTransaction.findMany({where:{stockCountId:b.initial.stockCountId}});
    demand(originals.length===1&&String(originals[0].quantity)==='20','MATERIAL_RUN_ORIGINAL_STOCK_CHANGED');
    const doc=await db.document.findUnique({where:{id:result.documentId}});
    demand(doc?.checksum===result.documentSha256&&doc.companyId===f.companyId,'MATERIAL_RUN_DOCUMENT_CUSTODY_FAILED');
    await saveEvidence('journey',{...result,sourceMapping:mapping,financeUnchanged:true,
      sourceObservations:auth.observations});
  }catch(e){primary=e;
    await saveEvidence('failure',{status:'MATERIAL_RUN_FAILED',code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'MATERIAL_RUN_FAILED',
      sourceObservations:auth.observations,partialJourneyObservations:e.privateObservations??[],configurationMayHaveBeenApplied:true});
  }
  finally{
    let failed=false;
    for(const [key,session] of Object.entries(sessions))try{await auth.logout(key,session);}catch{failed=true;}
    await saveEvidence('sessions',{revoked:!failed,observations:auth.observations});
    if(failed&&!primary)primary=Object.assign(new Error(),{safeCode:'MATERIAL_RUN_SESSION_REVOCATION_FAILED'});
  }
  if(primary)throw primary;
  return {status:'MATERIAL_AUTHENTICATED_API_JOURNEY_VERIFIED',sourceSha:SOURCE,
    stockHistory:result.stockHistory,financeUnchanged:true,apiSessionsRevoked:true,
    actualUiJourneyVerified:false,fullBusinessRoleMatrixVerified:false,populatedRecoveryVerified:false,
    prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
}
