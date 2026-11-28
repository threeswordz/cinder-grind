// Compose all three independent populated restore modes. No CLI or native authorization.
import {createHash} from 'node:crypto';
import {readdir} from 'node:fs/promises';
import {join} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Error('M7_RUNNER_'+c);};
const hex=(v,n=64)=>typeof v==='string'&&v.length===n&&/^[a-f0-9]+$/.test(v);
const sameDb=(a,b)=>['cluster','oid','database','role'].every(k=>a?.[k]===b?.[k]);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const stateDigest=s=>{const {clock,...state}=s;return createHash('sha256').update(JSON.stringify(canonical(state))).digest('hex');};
const safe=e=>/^M7_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'M7_RUNNER_PRIVATE_FAILURE';
const modes=['correct','missing','wrong'];
const contentFields=['schemaSha','rowsSha','documentsSha','uploadsSha','hrkeysSha'];
export async function createM7RecoveryRunner({source,binding,manifestArgs,claimOptions,targets,application,buildSha256,executable,makeClient,inventory,checkout,fixtures,evidence},deps){
 const c=binding?.capture();need(c&&hex(c.sha,40)&&hex(c.tree,40)&&hex(buildSha256)&&hex(binding.manifestSha)&&manifestArgs?.manifestSha256===binding.manifestSha&&Array.isArray(targets)&&targets.length===3&&targets.every((t,i)=>t.mode===modes[i]&&hex(t.runId,12)&&Number.isInteger(t.port)&&Number.isInteger(t.dbPort))&&['runId','port','dbPort'].every(k=>new Set(targets.map(t=>t[k])).size===3)&&typeof inventory==='function'&&typeof makeClient==='function'&&typeof checkout==='function'&&fixtures?.fixture&&fixtures?.actors&&Array.isArray(fixtures.expectedAudits)&&fixtures.expectedAudits.length===1&&evidence?.sourceSnapshot&&typeof evidence.forTarget==='function','CONTEXT');
 const d=deps??Object.assign({},...await Promise.all([import('./m7-isolated-restore.mjs'),import('./m7-target-database.mjs'),import('./m7-storage-restore.mjs'),import('./m7-variant-keyring.mjs'),import('./m7-restored-api.mjs'),import('./m7-authenticated-evidence.mjs'),import('./m7-restored-verification.mjs')]));
 const observe=d.createM7CaptureObserver({source,binding});let attempted=false;
 const runTarget=async spec=>{
   let database,api,claim,executionClaim,handle,launchAttempted=false,stopped=false,success=false,primary=null,cleanup=null;
   try{
     await observe();claim=await d.claimRestoreTarget({...claimOptions,runId:spec.runId,port:spec.port});const plan=claim.plan;
     need(plan.sha===c.sha&&plan.tree===c.tree&&plan.port===spec.port&&plan.database==='m7_restore_'+spec.runId&&plan.role==='m7_restore_role_'+spec.runId,'CLAIM');
     need(await d.m7ApiPortFree(plan.port)===true,'PORT');for(const k of ['documents','uploads','hrkeys'])need((await readdir(plan.storage[k])).length===0,'STORAGE_NOT_EMPTY');
     database=await d.createM7TargetDatabase({claim,binding,source,captureRoot:manifestArgs.root,executable,application,dbPort:spec.dbPort,makeClient,inventory,verifyOwnedSessions:s=>api?api.verifyOwnedSessions(s):Promise.resolve(s.length)});
     const absent=await database.inspectTargetAbsence(plan);need(absent.databaseAbsent===true&&absent.roleAbsent===true,'PRIOR_TARGET');await database.provisionFreshTarget(plan);
     const initial=await database.inspectDatabase(plan);d.verifyRestoreDatabase(c.sourceDatabase,initial,plan,true);need(initial.cluster!==c.sourceDatabase.cluster,'CLUSTER_ALIAS');await observe();
     await database.restoreDatabase(plan,d.restoreArguments(plan),c.dumpSha);const restored=await database.inspectDatabase(plan);need(sameDb(initial,restored),'TARGET_DRIFT');d.verifyRestoreDatabase(c.sourceDatabase,restored,plan,false);await observe();
     const storage=await d.createM7StorageRestore({claim,captureRoot:manifestArgs.root,expectedInventories:manifestArgs.expectedInventories,reverifyCapture:binding.reverify})();need(storage.status==='M7_STORAGE_RESTORE_BYTES_VERIFIED'&&storage.rootsVerified===3,'STORAGE');
     const content=await database.inspectRestoredContent(plan);need(contentFields.every(k=>content[k]===c[k]),'CONTENT');
     const variant=spec.mode==='correct'?{claim,expectedKeySha:c.hrkeysSha}:await d.prepareM7VariantKeyring({claim,binding,mode:spec.mode,inventory});executionClaim=variant.claim;const p=executionClaim.plan;
     need(['sha','tree','database','role','port','root'].every(k=>p[k]===plan[k])&&p.storage.documents===plan.storage.documents&&p.storage.uploads===plan.storage.uploads&&p.storage.hrkeys===join(plan.root,spec.mode==='correct'?'hrkeys':'hrkeys-'+spec.mode)&&hex(variant.expectedKeySha)&&(spec.mode==='correct'?variant.expectedKeySha===c.hrkeysSha:variant.expectedKeySha!==c.hrkeysSha),'KEY_BINDING');
     const boundDb={inspectDatabase:()=>database.inspectDatabase(plan),targetConnection:()=>database.targetConnection()};
     const ev=await evidence.forTarget({claim:executionClaim,database:boundDb,makeClient,inventory,expectedKeySha:variant.expectedKeySha});need(sameDb(ev.target,initial),'EVIDENCE_DB');
     api=d.createM7RestoredApi({claim:executionClaim,binding,application,buildSha256,dbPort:spec.dbPort,mode:spec.mode,expectedKeySha:variant.expectedKeySha,targetConnection:database.targetConnection,inventory,checkout});
     const target=binding.verificationTarget(p,spec.mode);launchAttempted=true;handle=await api.launchPinnedApi(p);
     const inspectTarget=async()=>{await executionClaim.verifyPaths();await observe();const db=await database.inspectDatabase(plan);need(sameDb(db,initial),'TARGET_DRIFT');d.verifyRestoreDatabase(c.sourceDatabase,db,plan,false);const actual=await api.inspectApi(p);d.verifyRestoredApi(p,handle,actual,c.sourceProcess);need(actual.keyMode===spec.mode&&actual.manifestSha===binding.manifestSha,'API_BINDING');return {...target,isolated:true};};
     const fixture={...structuredClone(fixtures.fixture),preservation:ev.preservation};const expectedAudits=spec.mode==='correct'?fixtures.expectedAudits:[];
     const probe=d.createM7AuthenticatedEvidenceProbe({sourceSnapshot:evidence.sourceSnapshot,expectedAudits,actors:fixtures.actors,readSnapshot:ev.readSnapshot,verifyHttp:d.verifyM7Restored});
     const result=await probe({target,fixture,actors:fixtures.actors,inspectTarget,readPreservation:ev.readPreservation,mode:spec.mode});
     if(result.status==='M7_AUTHENTICATED_EVIDENCE_BLOCKED'){
       const detail=[result.httpCode,result.code].find(x=>typeof x==='string'&&/^M7_(?:VERIFY|AUTH_PROBE|PERSISTED|SNAPSHOT|NATIVE_EVIDENCE)_[A-Z0-9_]+$/.test(x));
       if(detail)throw Error(detail);
     }
     need(result.status==='M7_AUTHENTICATED_EVIDENCE_PASS'&&result.sessionProof?.newRevokedSessions===4&&result.sessionProof.activeSessions===0&&result.sessionProof.newAudits===expectedAudits.length,'AUTHENTICATED');await inspectTarget();
     need(await api.stopOwnedApi(p,handle)===true,'API_CLEANUP');stopped=true;const post=await ev.readSnapshot();need(post.sessions.length===148&&post.sessions.every(s=>s.revokedAt!==null||Date.parse(s.expiresAt)<=Date.parse(post.clock)),'SESSION_CLEANUP');const postSha=stateDigest(post);await ev.readPreservation();
     const verifyPreserved=async()=>{await executionClaim.verifyPaths();await observe();need(await d.m7ApiPortFree(p.port)===true&&stateDigest(await ev.readSnapshot())===postSha,'TARGET_PRESERVATION');await ev.readPreservation();return true;};
     await verifyPreserved();success=true;return {mode:spec.mode,identity:initial,keyInventorySha:variant.expectedKeySha,sessionProof:result.sessionProof,verifyPreserved,close:database.close};
   }catch(e){primary=safe(e);if(/^M7_[A-Z0-9_]+$/.test(e?.cleanupCode??''))cleanup=e.cleanupCode;}
   finally{if(!success){if(launchAttempted&&!stopped)try{need(await api.stopOwnedApi(executionClaim.plan,handle)===true,'API_CLEANUP');}catch(e){cleanup??=safe(e);}try{await database?.close();}catch(e){cleanup??=safe(e);}try{await observe();}catch(e){cleanup??=safe(e);}}}
   throw Object.assign(Error(primary??cleanup??'M7_RUNNER_PRIVATE_FAILURE'),{cleanupCode:cleanup});
 };
 return async function runOnce(){need(!attempted,'ALREADY_ATTEMPTED');attempted=true;const completed=[];let primary=null,cleanup=null;
   try{for(const spec of targets){for(const r of completed)need(await r.verifyPreserved()===true,'PREVIOUS_TARGET_DRIFT');const r=await runTarget(spec);completed.push(r);need(completed.every((a,i)=>completed.every((b,j)=>i===j||a.identity.cluster!==b.identity.cluster&&a.identity.database!==b.identity.database&&a.identity.role!==b.identity.role&&a.keyInventorySha!==b.keyInventorySha)),'TARGET_ALIAS');for(const r of completed)need(await r.verifyPreserved()===true,'PREVIOUS_TARGET_DRIFT');}await observe();}
   catch(e){primary=safe(e);if(/^M7_[A-Z0-9_]+$/.test(e?.cleanupCode??''))cleanup=e.cleanupCode;}finally{for(const r of completed.slice().reverse()){try{await r.close();}catch(e){cleanup??=safe(e);}}try{await observe();}catch(e){cleanup??=safe(e);}}
   return Object.freeze({status:primary||cleanup?'M7_RECOVERY_COMPOSITION_BLOCKED':'M7_RECOVERY_COMPOSITION_PASS',primary,cleanup,completedModes:completed.map(r=>r.mode),revokedNewSessions:completed.reduce((n,r)=>n+r.sessionProof.newRevokedSessions,0),newHrDownloadAudits:completed.reduce((n,r)=>n+r.sessionProof.newAudits,0),nativeRecoveryVerified:false,milestone7Accepted:false,productionAuthorized:false});
 };
}
