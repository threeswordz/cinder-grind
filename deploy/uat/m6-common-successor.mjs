// Coordinator-owned sequencing. Native runtime/session custody is supplied by the
// authorized isolated adapter, never inferred from a successful lane fixture.
import {requireSuccessorOrigins} from './m6-successor-session-batch.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_COMMON_'+code),{safeCode:'M6_COMMON_'+code});};
const sha=/^[a-f0-9]{40}$/;
export function verifyCommonCandidate(candidate,receipt){
  need(sha.test(candidate?.sha??'')&&sha.test(candidate?.tree??'')&&candidate.syntheticOnly===true&&candidate.rehearsalOnly===true&&candidate.productionAuthorized===false,'CANDIDATE');
  need(receipt?.status==='M6_SUCCESSOR_ISOLATED_REHEARSAL_SEALED'&&receipt.candidateSha===candidate.sha&&receipt.candidateTree===candidate.tree&&receipt.predecessorChecksumsMatched===177&&receipt.additionsMatched===7&&receipt.appliedChecksumsMatched===184&&receipt.restoredRowsMatched===true&&receipt.recoveryCopyUnchanged===true&&receipt.retainedDatabaseAndFilesUnchanged===true&&receipt.cutoverPerformed===false&&receipt.milestone6Accepted===false&&receipt.productionAuthorized===false,'REHEARSAL');
}
export async function sequenceCommonReadbacks({candidate,receipt,verifyRuntime,prepare,withSessions,verifyFinal}){
  verifyCommonCandidate(candidate,receipt);
  need([verifyRuntime,prepare,withSessions,verifyFinal].every(f=>typeof f==='function'),'ADAPTER');
  await verifyRuntime();
  const checks=await prepare();
  need(checks&&['site','certification','hrDenials','hrFinish'].every(k=>typeof checks[k]==='function')&&checks.config?.status==='M6_SS16_CONFIGURATION_OBSERVED'&&checks.config.mayMutate===false,'PREPARE');
  let invoked=false,completed=false;
  await withSessions(async sessions=>{
    need(!invoked,'SESSION_REPLAY');invoked=true;
    const site=await checks.site(sessions);
    need(site?.status==='M6_02_SITE_MATERIAL_ROLE_READBACK_VERIFIED'&&site.mutationsPerformed===false,'SITE');
    const cert=await checks.certification(sessions);
    need(cert?.status==='M6_04_CERTIFICATION_SCOPE_ASSERTIONS_PASS'&&cert.scopedDenialAssertions===5&&cert.mayMutate===false,'CERTIFICATION');
    const hr=await checks.hrDenials(sessions);
    need(hr?.status==='M6_HR_SUCCESSOR_DENIAL_ASSERTIONS_PASS'&&hr.denials===15&&hr.positiveControls===2,'HR_DENIALS');
    completed=true;
  });
  need(invoked&&completed,'SESSION_BATCH');
  await verifyRuntime();
  const hr=await checks.hrFinish();
  need(hr?.status==='M6_HR_SUCCESSOR_EXIT_ASSERTIONS_PASS'&&hr.zeroActiveSessionsObserved===true&&hr.denials===15&&hr.positiveControls===2,'HR_FINISH');
  const final=await verifyFinal();
  need(final?.zeroActiveSessions===true&&final.sessionRevocationVerified===true&&final.authHistoryPreserved===true&&final.businessRowsPreserved===true&&final.protectedFilesPreserved===true&&final.retainedRuntimeUnchanged===true,'FINAL');
  await verifyRuntime();
  return {status:'M6_COMMON_SUCCESSOR_READBACKS_PASS',candidateSha:candidate.sha,candidateTree:candidate.tree,isolatedRecoveryVerified:true,siteReadbackVerified:true,ss16ConfigurationVerified:true,certificationReadbackVerified:true,hrDenialsVerified:15,sessionRevocationVerified:true,affectedNativeAndBrowserTestsRequired:true,milestone6Accepted:false,productionAuthorized:false};
}
// Concrete lane composition, deliberately restricted to the separate rehearsal.
// The caller must bind the private receipt, source IDs, loopback runtime and
// one authorized session batch. No retained API session is created here.
export async function runCommonSuccessorReadbacks({candidate,receipt,context}){
  verifyCommonCandidate(candidate,receipt);
  need(context?.database==='m6_successor_rehearsal'&&context.db&&typeof context.verifyRuntime==='function'&&typeof context.withSessions==='function'&&typeof context.verifyFinal==='function'&&typeof context.siteTransport==='function'&&context.siteBinding&&context.ss16Binding&&context.certificationBinding&&context.hr,'CONTEXT');
  requireSuccessorOrigins(context.origin,context.webOrigin);
  const {verifyM6SiteReadback}=await import('./m6-parallel-02-site-readback.mjs');
  const {verifyRemainingBoqReadback}=await import('./m6-boq-readback-continuation.mjs');
  const {observeSuccessorSS16Config}=await import('./m6-parallel-03-ss16-config.mjs');
  const {bindM604Certification,runM604CertificationReadback}=await import('./m6-parallel-04-certification-adapter.mjs');
  const {prepareHrSuccessorExit}=await import('./m6-hr-successor-exit.mjs');
  const verifyRuntime=async()=>{await context.verifyRuntime();await context.db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const rows=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(rows?.length===1&&rows[0].db==='m6_successor_rehearsal'&&rows[0].role==='proto_runtime'&&rows[0].ro==='on'&&rows[0].isolation==='repeatable read','DATABASE');
  },{isolationLevel:'RepeatableRead',timeout:30000});};
  return sequenceCommonReadbacks({candidate,receipt,verifyRuntime,withSessions:fn=>context.withSessions(fn),verifyFinal:()=>context.verifyFinal(),prepare:async()=>{
    const config=await observeSuccessorSS16Config(context.db,context.ss16Binding);
    const cert=await bindM604Certification(context.db,context.certificationBinding);
    const hr=await prepareHrSuccessorExit({...context.hr,db:context.db,database:'m6_successor_rehearsal',verifyRuntime});
    return {config,site:s=>context.siteContinuation?verifyRemainingBoqReadback(context.siteBinding,context.siteTransport(s),context.siteContinuation.raw,context.siteContinuation.prior):verifyM6SiteReadback(context.siteBinding,context.siteTransport(s)),certification:s=>runM604CertificationReadback(cert,{origin:context.origin,cookies:s.certification}),hrDenials:s=>hr.verifyDenials(s.hr,undefined,{origin:context.origin,webOrigin:context.webOrigin}),hrFinish:()=>hr.finish()};
  }});
}
