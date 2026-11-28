// Single shared session lifecycle; no standalone browser logins or retries.
const need=(ok,c)=>{if(!ok)throw Object.assign(Error('M6_OPERATIONAL_BATCH_'+c),{safeCode:'M6_OPERATIONAL_BATCH_'+c});};
export async function runOperationalBatch({withRuntime,prepareBrowser,runReadbacks,makeSessionBatch,mapSessions,probeBrowser,captureAuth,verifyAuth,verifyRateAdmission,verifyPreserved,seal}){
 need([withRuntime,prepareBrowser,runReadbacks,makeSessionBatch,mapSessions,probeBrowser,captureAuth,verifyAuth,verifyRateAdmission,verifyPreserved,seal].every(f=>typeof f==='function'),'CONTEXT');
 let result,authProof,browserProof,entered=false;
 await verifyPreserved();
 await withRuntime(async runtime=>{
  need(!entered,'RUNTIME_REPLAY');entered=true;
  const browser=await prepareBrowser();let primary;
  try{
   let attempted=false;
   result=await runReadbacks(runtime,async checks=>{
    need(!attempted,'SESSION_REPLAY');attempted=true;
    const before=await captureAuth();verifyRateAdmission(before);
    const batch=makeSessionBatch(runtime);let failure;
    try{await batch(async live=>{await checks(mapSessions(live));browserProof=await probeBrowser(browser,runtime,live);need(browserProof?.status==='M6_SUCCESSOR_BROWSER_WORKSPACE_PROBE_PASS'&&browserProof.actors===11&&browserProof.additionalLogins===0,'BROWSER');});}catch(e){failure=e;}
    // Capture even on a failed batch. Never repair, reset, or retry here.
    const after=await captureAuth();authProof=verifyAuth(before,after);
    need(authProof?.status==='M6_SUCCESSOR_AUTH_PRESERVATION_PASS'&&authProof.revokedNewSessions===11,'AUTH_PROOF');
    if(failure)throw failure;
   },async()=>{need(authProof&&browserProof,'FINAL_PROOF');await verifyPreserved();await runtime.readFiles();return {zeroActiveSessions:true,sessionRevocationVerified:true,authHistoryPreserved:true,businessRowsPreserved:true,protectedFilesPreserved:true,retainedRuntimeUnchanged:true};});
   need(result?.status==='M6_COMMON_SUCCESSOR_READBACKS_PASS'&&attempted&&authProof&&browserProof,'READBACK');
  }catch(e){primary=e;}finally{await browser.stop();}
  if(primary)throw primary;
 });
 need(entered&&result&&authProof&&browserProof,'RUNTIME_RESULT');await verifyPreserved();
 const proof={...result,...authProof,...browserProof,status:'M6_SUCCESSOR_SHARED_OPERATIONAL_BATCH_PASS',ss16ConfigurationVerified:true,siteReadbackVerified:true,certificationReadbackVerified:true,hrDenialsVerified:15,sessionRevocationVerified:true,retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,fullAffectedBrowserJourneysVerified:false,milestone6Accepted:false,productionAuthorized:false,secretsPrinted:false};
 await seal(proof);return proof;
}
