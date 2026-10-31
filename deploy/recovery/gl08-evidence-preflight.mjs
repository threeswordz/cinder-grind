// GL08: offline assessment of caller-supplied backup/restore receipts. No Production API or network access.
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const RPO_MS=24*60*60*1000;
const RTO_MS=8*60*60*1000;
const MAX_SNAPSHOT_AGE_MS=60*60*1000;
const MAX_FUTURE_SKEW_MS=5*60*1000;
const SHA=/^[a-f0-9]{64}$/i;
const COMMIT=/^[a-f0-9]{40}$/i;
const ISO=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

function timestamp(value){
 if(typeof value!=='string'||!ISO.test(value))return null;
 const ms=Date.parse(value);
 return Number.isFinite(ms)&&new Date(ms).toISOString().replace('.000Z','Z')===value?ms:null;
}
const hash=v=>typeof v==='string'&&SHA.test(v);
const bool=v=>v===true;

export function evaluateRecoveryEvidence(input,{now=Date.now()}={}){
 if(!input||typeof input!=='object'||Array.isArray(input)||!Number.isFinite(now))
  throw new Error('INVALID_EVIDENCE_OBJECT');
 const errors=new Set(),add=k=>errors.add(k);
 const m=input.manifest||{},checks=input.checks||{},remote=input.offHost||{},restore=input.restore||{};
 const observed=timestamp(input.observedAt),created=timestamp(m.createdAt);
 if(observed===null||observed>now+MAX_FUTURE_SKEW_MS||now-observed>MAX_SNAPSHOT_AGE_MS)
  add('SNAPSHOT_TIME_MISSING_OR_STALE');
 if(m.version!==1||!COMMIT.test(m.releaseCommit??'')||
    typeof m.recoverySetId!=='string'||!/^[A-Za-z0-9._-]{6,128}$/.test(m.recoverySetId)||
    typeof m.storageDeploymentId!=='string'||!/^[A-Za-z0-9._-]{3,64}$/.test(m.storageDeploymentId))
  add('MANIFEST_IDENTITY_INVALID');
 if(created===null||observed===null||created>observed||observed-created>RPO_MS)
  add('RECOVERY_POINT_RPO_UNVERIFIED');
 if(!Number.isSafeInteger(m.documentFileCount)||m.documentFileCount<=0)
  add('POPULATED_DOCUMENT_SET_NOT_PROVEN');
 const arts=m.artifacts||{};
 for(const [key,name] of [['database','database.dump'],['documents','documents.tar.gz']]){
   const v=arts[key];
   if(!v||v.file!==name||!Number.isSafeInteger(v.bytes)||v.bytes<=0||!hash(v.sha256))
     add('PAIRED_ARTIFACT_METADATA_INVALID');
 }
 for(const key of ['manifestVerified','documentArchivePathsVerified','readyMarkerMatches','databaseDumpReadable']){
   if(!bool(checks[key]))add('BACKUP_VERIFICATION_INCOMPLETE');
 }
 const remoteTime=timestamp(remote.verifiedAt);
 if(!bool(remote.independentFailureDomain)||!bool(remote.encryptedAtRest)||
    created===null||remoteTime===null||remoteTime<created||observed===null||remoteTime>observed)
  add('OFFHOST_RECOVERY_COPY_UNVERIFIED');
 for(const key of ['database','documents']){
   if(!hash(remote.artifactHashes?.[key])||remote.artifactHashes[key]!==arts[key]?.sha256)
     add('OFFHOST_HASH_PAIR_UNVERIFIED');
 }
 const start=timestamp(restore.startedAt),finish=timestamp(restore.completedAt);
 let measuredRestoreMinutes=null;
 if(start===null||finish===null||finish<start||created===null||start<created||observed===null||finish>observed){
   add('RESTORE_TIMING_INVALID');
 }else{
   measuredRestoreMinutes=(finish-start)/60000;
   if(finish-start>RTO_MS)add('RESTORE_RTO_TARGET_NOT_MET');
 }
 if(!bool(restore.isolatedDestination)||!bool(restore.databaseRestored)||
    !bool(restore.documentBytesEqual)||!bool(restore.applicationReadinessVerified)||
    !bool(restore.sourceNotMutated)||!COMMIT.test(restore.releaseCommit??'')||
    restore.releaseCommit!==m.releaseCommit||
    restore.sourceStorageDeploymentId!==m.storageDeploymentId)
   add('POPULATED_ISOLATED_RESTORE_UNVERIFIED');
 if(restore.recoverySetId!==m.recoverySetId)add('RESTORE_SET_ID_MISMATCH');
 const gaps=[...errors].sort();
 return {
  purpose:'GL08_RECOVERY_EVIDENCE_OFFLINE_PREFLIGHT',
  status:gaps.length?'RECEIPTS_INCOMPLETE_OR_INCONSISTENT':'RECEIPT_FIELDS_CONSISTENT_INDEPENDENT_VERIFICATION_PENDING',
  gatesClosed:0,productionAuthorized:false,readOnly:true,networkRequests:0,backupStarted:false,
  restoreStarted:false,verifiedByIndependentOperator:false,
  inputAttestation:'CALLER_SUPPLIED_RECEIPTS_NOT_INDEPENDENTLY_VERIFIED',
  sourceIdentity:gaps.includes('MANIFEST_IDENTITY_INVALID')?'INVALID':'CLAIMED_ONLY',
  rpoTargetHours:24,rtoTargetHours:8,
  observedBackupAgeMinutes:observed!==null&&created!==null&&created<=observed?(observed-created)/60000:null,
  observedRestoreMinutes:measuredRestoreMinutes,
  gaps,
 };
}
export function exampleShape(){
 return {
  observedAt:'YYYY-MM-DDTHH:MM:SSZ',
  manifest:{version:1,recoverySetId:'REPLACE_WITH_REAL_SET_ID',createdAt:'YYYY-MM-DDTHH:MM:SSZ',
   releaseCommit:'40-character-approved-sha',storageDeploymentId:'actual-deployment-id',
   documentFileCount:null,artifacts:{database:{file:'database.dump',bytes:null,sha256:'64-digit-digest'},
    documents:{file:'documents.tar.gz',bytes:null,sha256:'64-digit-digest'}}},
  checks:{manifestVerified:false,documentArchivePathsVerified:false,readyMarkerMatches:false,databaseDumpReadable:false},
  offHost:{verifiedAt:'YYYY-MM-DDTHH:MM:SSZ',independentFailureDomain:false,encryptedAtRest:false,
    artifactHashes:{database:'64-digit-digest',documents:'64-digit-digest'}},
  restore:{recoverySetId:'REPLACE_WITH_REAL_SET_ID',startedAt:'YYYY-MM-DDTHH:MM:SSZ',
   completedAt:'YYYY-MM-DDTHH:MM:SSZ',releaseCommit:'40-character-approved-sha',
   sourceStorageDeploymentId:'actual-deployment-id',isolatedDestination:false,databaseRestored:false,
   documentBytesEqual:false,applicationReadinessVerified:false,sourceNotMutated:false},
 };
}
async function main(args){
 if(args.length===1&&args[0]==='--plan'){
  process.stdout.write(JSON.stringify({template:exampleShape(),message:'No real evidence has been obtained.'},null,2)+'\n');return;
 }
 if(args.length!==2||args[0]!=='--evaluate')throw Error('USAGE_PLAN_OR_EVALUATE');
 const raw=await readFile(resolve(args[1]));
 if(raw.length>128*1024)throw Error('INPUT_TOO_LARGE');
 let value;try{value=JSON.parse(raw.toString('utf8'));}catch{throw Error('INVALID_JSON');}
 const result=evaluateRecoveryEvidence(value);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(result.gaps.length)process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main(process.argv.slice(2)).catch(e=>{process.stderr.write('GL08_READONLY_PREFLIGHT_BLOCKED:'+e.message+'\n');process.exitCode=2;});
}
