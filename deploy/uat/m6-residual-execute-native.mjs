// Single Mac entry for the reviewed residual operator. No automatic replay.
import {createHash,randomUUID} from 'node:crypto';
import {realpath,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createRequire} from 'node:module';
import {createInterface} from 'node:readline/promises';
import {withResidualNativeAdmission} from './m6-residual-readiness-native.mjs';
import {observeResidualSourcePlans,projectResidualRoster} from './m6-residual-source-observer.mjs';
import {writeResidualRoles} from './m6-residual-role-writer.mjs';
import {bindResidualExecutionPlan,syntheticResidualPdf} from './m6-residual-executable-contract.mjs';
import {beginResidualAttempt} from './m6-residual-attempt-receipt.mjs';
import {createResidualCanonicalPhases} from './m6-residual-canonical-phases.mjs';
import {runResidualRuntimeBatch} from './m6-residual-runtime-batch.mjs';
import {discoverResidualBrowser,runResidualBrowser} from './m6-residual-browser.mjs';
const APP='70013b5139292ef33563447f8937c8f132feabd2',DISCOVERY='840477f8c18665953ed3285635adc81f5091fadb';
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_RESIDUAL_ENTRY_'+c),{safeCode:'M6_RESIDUAL_ENTRY_'+c});};
const sha=x=>typeof x==='string'&&/^[a-f0-9]{40}$/.test(x),digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),fileHash=x=>createHash('sha256').update(x).digest('hex');
const names=['BEN','FOREMAN','JAI','KHAIMOOK','STORE_SITE'],artifactKeys=['dispatch','ack','transit','delay','handover'];
const metadata=bytes=>({sha256:fileHash(bytes),size:bytes.length});
function addDays(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function keys(names){return Object.fromEntries(names.map(k=>[k,randomUUID()]));}
async function requireUnusedStages(parent){for(const n of ['event266-residual-execution','event266-residual-runtime']){try{await lstat(join(parent,n));need(false,'PRIOR_ATTEMPT');}catch(e){if(e.code!=='ENOENT')throw e;}}}
async function confirmPlan(bound,sourcePlans){
 need(process.stdin.isTTY===true&&process.stdout.isTTY===true,'INTERACTIVE_OWNER_REQUIRED');
 console.log(JSON.stringify({status:'M6_RESIDUAL_EXACT_PLAN_AWAITING_OWNER',applicationSha:APP,operatorSha:bound.plan.operatorSha,planSha256:bound.planSha256,baselineSha256:bound.baselineSha256,rolesCreated:2,roleAssignments:2,permissionEdges:7,actors:5,actorRoles:['BEN','KHAIMOOK','FOREMAN','JAI','STORE_SITE'],roleConfiguration:['BEN: MANAGEMENT + programme.view/work_plan.confirm','JAI: PROCUREMENT_OFFICER + po.view','KHAIMOOK: programme.view/work_plan.prepare','FOREMAN: programme.view/progress.record'],project:'SITE_A',issueDate:sourcePlans.sitePlan.issueDate,validTo:sourcePlans.sitePlan.validTo,supplierReturnQuantity:sourcePlans.supplierPlan.returnQuantity,newWbsLevels:3,newActivities:2,newActivityType:!sourcePlans.sitePlan.activityTypeId,newZeroRateBoqItems:1,newMaterialPlans:1,plannedIssueQuantity:'1.0000',expectedDocumentFiles:sourcePlans.supplierPlan.uploads.length+1,newDispatchEvents:sourcePlans.supplierPlan.expectedNewDispatchEvents,supplierLifecycleEvents:7,syntheticOnly:true,retainedMutationAuthorized:false,productionAuthorized:false,automaticRetryAllowed:false,secretsPrinted:false},null,2));
 const rl=createInterface({input:process.stdin,output:process.stdout});try{const answer=await rl.question('To authorize this exact isolated synthetic plan, type EXECUTE '+bound.planSha256+' : ');need(answer==='EXECUTE '+bound.planSha256,'OWNER_DECLINED');}finally{rl.close();}
}
export async function executeReviewedResidual({operatorSha,application,reviewedOperatorSha}){
 // The Release Coordinator independently verifies the GitHub review before
 // issuing this exact command. The local operator only binds the supplied SHA;
 // a CLI argument alone is not independent review evidence.
 need(sha(operatorSha)&&operatorSha===reviewedOperatorSha&&typeof application==='string'&&resolve(application)===application,'REVIEWED_HEAD');
 return withResidualNativeAdmission({operatorSha,application},async ctx=>{
  await requireUnusedStages(ctx.parentStage);const prisma=createRequire(join(ctx.application,'apps/api/package.json'))('@prisma/client').Prisma;need(prisma?.prismaVersion?.client==='6.19.3'&&(await lstat(join(ctx.application,'apps/api/dist/main.js'))).isFile(),'APPLICATION_ARTIFACT');
  const issueDate=new Date().toISOString().slice(0,10),validTo=addDays(issueDate,7),revisedDate=addDays(issueDate,7),siteKeys=keys(['create','submit','approve','denial']),journeyKeys=keys(['createKey','postKey','linkKey','receiptKey']);
  const receiptBytes=syntheticResidualPdf('M6 SS08 SIGNED RECEIPT REHEARSAL'),supplierArtifacts=new Map(artifactKeys.map(k=>[k,syntheticResidualPdf('M6 SUPPLIER '+k.toUpperCase()+' REHEARSAL')]));
  const receiptArtifact=metadata(receiptBytes),artifacts=Object.fromEntries([...supplierArtifacts].map(([k,v])=>[k,metadata(v)]));let attempt,phases;
  try{
   const sourcePlans=await observeResidualSourcePlans(ctx,{keys:siteKeys,issueDate,validTo,artifacts});const roster=projectResidualRoster(ctx.binding.roster,ctx.rolePlan);
   need(names.every(k=>roster[k])&&JSON.stringify(names.map(k=>roster[k].userId).sort())===JSON.stringify(sourcePlans.expectedActors),'ROSTER');
   const selection=await discoverResidualBrowser(),bound=bindResidualExecutionPlan({ctx,sourcePlans,receiptArtifact,journeyKeys,revisedDate});
   await confirmPlan(bound,sourcePlans);need(new Date().toISOString().slice(0,10)===issueDate,'DATE_CHANGED');
   await ctx.verifyBeforeMutation();await ctx.verifyCustody();await requireUnusedStages(ctx.parentStage);
   // These capabilities are derived only after the Owner accepts the bound
   // exact plan, never from readiness or code review alone.
   const authorization={operatorSha,applicationSha:APP,discoverySha:DISCOVERY,database:'m6_successor_rehearsal',planSha256:bound.planSha256,baselineSha256:bound.baselineSha256,ownerAuthorizedResidualExecution:true,ownerAuthorizedSyntheticRoleDelta:true,ownerAuthorizedSiteFixtures:true,ownerAuthorizedSs08Journey:true,ownerAuthorizedFm02Journey:true,ownerAuthorizedSupplierSources:true,ownerAuthorizedSupplierJourney:true,retainedMutationAuthorized:false,productionAuthorized:false};
   phases=createResidualCanonicalPhases({ctx,sourcePlans,roster,authorization,receiptBytes,supplierArtifacts,journeyKeys,revisedDate,runBrowser:args=>runResidualBrowser({ctx,selection,...args})});
   attempt=await beginResidualAttempt({parent:ctx.parentStage,operatorSha,planSha256:bound.planSha256,baselineSha256:bound.baselineSha256,authorization});
   let roleSnapshot;const roleProof=await writeResidualRoles({db:ctx.db,context:ctx.roleContext,plan:ctx.rolePlan,baseline:ctx.initial,operatorSha,authorization:{...authorization,planSha256:bound.plan.rolePlanSha256},capture:ctx.captureFixtureRows,verifyCustody:ctx.verifyCustody,sealAttempt:()=>attempt.startPhase('roles'),sealCommitted:async committed=>{roleSnapshot=structuredClone(committed.after);await attempt.sealPhase('roles',{rolesCreated:2,assignmentsCreated:2,permissionEdgesCreated:7,auditRowsAdded:1,rolePlanSha256:committed.planSha256,afterSha256:digest(roleSnapshot)});}});
   need(roleProof.status==='M6_RESIDUAL_SYNTHETIC_ROLES_COMMITTED'&&roleSnapshot?.user_sessions?.length===129,'ROLE_COMMIT');
   return await runResidualRuntimeBatch({ctx,attempt,authorization,sourcePlans,receiptArtifact,roster,roleSnapshot,phases});
  }catch(e){if(attempt)await attempt.fail(e.safeCode??'M6_RESIDUAL_ENTRY_PRIVATE_FAILURE');throw e;}
  finally{phases?.close();receiptBytes.fill(0);for(const b of supplierArtifacts.values())b.fill(0);}
 });
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{need(process.argv.length===7&&process.argv[2]==='--execute-reviewed-residual'&&process.argv[5]==='--reviewed-operator-sha','ARGS');console.log(JSON.stringify(await executeReviewedResidual({operatorSha:process.argv[3],application:process.argv[4],reviewedOperatorSha:process.argv[6]}),null,2));}
 catch(e){const code=typeof e?.safeCode==='string'&&/^(M6_|BROWSER_)[A-Z0-9_]{1,100}$/.test(e.safeCode)?e.safeCode:'M6_RESIDUAL_ENTRY_PRIVATE_FAILURE';console.log(JSON.stringify({status:'M6_RESIDUAL_EXECUTION_BLOCKED',safeCode:code,automaticRetryAllowed:false,mutationState:'CHECK_DURABLE_ATTEMPT',productionAuthorized:false,milestone6Accepted:false,secretsPrinted:false},null,2));process.exitCode=1;}
}
