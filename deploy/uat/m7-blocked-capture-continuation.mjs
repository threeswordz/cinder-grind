// Admit exactly one previously consumed capture failure. No cleanup or replay.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,open,readdir,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const need=(ok,c)=>{if(!ok)throw Error('M7_PRIOR_'+c);};
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const hex=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const identity=s=>[s.dev,s.ino,s.uid,s.mode,s.size,s.mtimeMs,s.ctimeMs,s.nlink];
export const blockedCapturePin=Object.freeze({planSha256:'5c77aa4bd42a688e5e7d31244873f70d496b1365655d4fadc3e54abd21a699e3',proofSha256:'891d5f4aeaaa26aea6c93cfe5b3e9569c4f1d6640322b51c16965d37afa9260b'});
async function directory(p,names){const s=await lstat(p);need(s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(p)===p,'DIRECTORY');need(same((await readdir(p)).sort(),names.slice().sort())&&same(identity(s),identity(await lstat(p))),'CONTENTS');return identity(s);}
async function receipt(p,parse=true){const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=65536&&await realpath(p)===p,'RECEIPT');const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{need(same(identity(s),identity(await f.stat())),'DRIFT');const b=await f.readFile();need(b.length===s.size&&same(identity(s),identity(await f.stat()))&&same(identity(s),identity(await lstat(p))),'DRIFT');return {value:parse?JSON.parse(b.toString('utf8')):undefined,identity:identity(s),sha:createHash('sha256').update(b).digest('hex')};}finally{await f.close();}}
export async function createM7PriorAttemptGuard({root,pin,anchor}){
 need(typeof root==='string'&&resolve(root)===root&&root!=='/'&&hex(pin?.planSha256)&&hex(pin?.proofSha256)&&hex(anchor?.finalProofSha256),'CONTEXT');
 async function observe(){
  const rootId=await directory(root,['attempt-private.json','result-private.json','capture','restore']);
  const a=await receipt(join(root,'attempt-private.json')),r=await receipt(join(root,'result-private.json'));
  const {planSha256,...plan}=a.value.plan??{}, {status,proofSha256,nativeRecoveryVerified,...proof}=r.value;
  need(a.value.status==='M7_NATIVE_ATTEMPT_CLAIMED'&&planSha256===pin.planSha256&&digest(plan)===planSha256&&status==='M7_RECOVERY_ATTEMPT_BLOCKED'&&proofSha256===pin.proofSha256&&digest(proof)===proofSha256&&nativeRecoveryVerified===false,'PIN');
  need(['operatorSha','operatorTree','applicationSha','applicationTree','buildSha256','predecessorProofSha256','terminalSnapshotSha256'].every(k=>proof[k]===plan[k])&&proof.planSha256===planSha256&&plan.applicationSha===anchor.applicationSha&&plan.applicationTree===anchor.applicationTree&&plan.buildSha256===anchor.buildSha256&&plan.predecessorProofSha256===anchor.finalProofSha256&&plan.terminalSnapshotSha256===anchor.terminalSnapshotSha256&&plan.sourceDatabase===anchor.database,'SOURCE');
  need(proof.phase==='CAPTURE'&&proof.primary==='M7_STORAGE_PRIVATE'&&['cleanup','runnerPrimary','runnerCleanup','manifestSha256','witnessSha256'].every(k=>proof[k]===null)&&same(proof.completedModes,[])&&proof.revokedNewSessions===0&&proof.newHrDownloadAudits===0&&['sourceMutationAuthorized','automaticRetryAllowed','productionAuthorized','milestone7Accepted','humanUatCompleted','secretsPrinted'].every(k=>proof[k]===false)&&/^[a-f0-9]{12}$/.test(plan.captureRunId),'BLOCKED');
  const cap=join(root,'capture'),set=join(cap,'m7-capture-'+plan.captureRunId),ids=[await directory(cap,['m7-capture-'+plan.captureRunId]),await directory(set,['documents','uploads','hrkeys']),await directory(join(root,'restore'),[])];for(const k of ['documents','uploads','hrkeys'])ids.push(await directory(join(set,k),[]));
  need(same(rootId,await directory(root,['attempt-private.json','result-private.json','capture','restore'])),'DRIFT');
  return digest([rootId,a.identity,a.sha,r.identity,r.sha,ids]);
 }
 const baseline=await observe();return Object.freeze({root,proofSha256:pin.proofSha256,async verify(){need(await observe()===baseline,'DRIFT');return true;}});
}

// The second consumed attempt sealed a complete capture but failed before the
// first cluster started. Admit only that pinned state; never recapture or mutate it.
export const blockedRecoveryPin=Object.freeze({planSha256:'233a6148f7563434d5290b511def75dbc591a1176cd499fcee19a4c4054795df',proofSha256:'cc8aa9912b5ec16702f17639d6ec70cebb2758fe0ec2297e936290e18224409b',manifestSha256:'e522d3672e4d628749e9edb6c363ba13d0aae123b2949b27a1929be094f9b56b',witnessSha256:'8bb90c9d80fa96451073a9f45e1bfe730fe3d78c1d2533966f96f20e62f26cb8'});
export async function createM7SealedRecoveryGuard({root,pin,anchor,first,bindCapture,inspectStopped}){
 need(typeof root==='string'&&root===first?.root+'-continuation-'+first.proofSha256.slice(0,12)&&Object.values(pin??{}).length===4&&Object.values(pin).every(hex)&&typeof first.verify==='function'&&typeof bindCapture==='function'&&typeof inspectStopped==='function','RECOVERY_CONTEXT');
 let capture,capPin;
 async function observe(){
  need(await first.verify()===true,'FIRST_DRIFT');
  const names=['attempt-private.json','result-private.json','capture-private.json','capture','restore'];
  const rootId=await directory(root,names),a=await receipt(join(root,'attempt-private.json')),r=await receipt(join(root,'result-private.json')),c=await receipt(join(root,'capture-private.json'));
  const {planSha256,...plan}=a.value.plan??{}, {status,proofSha256,nativeRecoveryVerified,...proof}=r.value;
  need(a.value.status==='M7_NATIVE_ATTEMPT_CLAIMED'&&planSha256===pin.planSha256&&digest(plan)===planSha256&&status==='M7_RECOVERY_ATTEMPT_BLOCKED'&&proofSha256===pin.proofSha256&&digest(proof)===proofSha256&&nativeRecoveryVerified===false,'RECOVERY_PIN');
  need(['operatorSha','operatorTree','applicationSha','applicationTree','buildSha256','predecessorProofSha256','terminalSnapshotSha256','priorBlockedProofSha256'].every(k=>proof[k]===plan[k])&&proof.planSha256===planSha256&&plan.priorBlockedProofSha256===first.proofSha256&&plan.applicationSha===anchor.applicationSha&&plan.applicationTree===anchor.applicationTree&&plan.buildSha256===anchor.buildSha256&&plan.predecessorProofSha256===anchor.finalProofSha256&&plan.terminalSnapshotSha256===anchor.terminalSnapshotSha256&&plan.sourceDatabase===anchor.database,'RECOVERY_SOURCE');
  need(proof.phase==='RECOVERY'&&proof.primary==='M7_OPERATOR_RECOVERY'&&proof.runnerPrimary==='M7_CLUSTER_PARTIAL_CLEANUP'&&proof.cleanup===null&&proof.runnerCleanup===null&&proof.manifestSha256===pin.manifestSha256&&proof.witnessSha256===pin.witnessSha256&&same(proof.completedModes,[])&&proof.revokedNewSessions===0&&proof.newHrDownloadAudits===0&&['sourceMutationAuthorized','automaticRetryAllowed','productionAuthorized','milestone7Accepted','humanUatCompleted','secretsPrinted'].every(k=>proof[k]===false),'RECOVERY_BLOCKED');
  const runId=plan.targets?.[0]?.runId;need(/^[a-f0-9]{12}$/.test(plan.captureRunId)&&/^[a-f0-9]{12}$/.test(runId??'')&&plan.targets?.[0]?.mode==='correct','RECOVERY_IDS');
  const cap=join(root,'capture'),set=join(cap,'m7-capture-'+plan.captureRunId),restore=join(root,'restore'),target=join(restore,'m7-restore-'+runId),creds=join(target,'pg-private');
  need(c.value.manifestArgs?.root===set&&c.value.manifestArgs.manifestSha256===pin.manifestSha256&&c.value.witnessSha256===pin.witnessSha256&&c.value.witness?.applicationSha===anchor.applicationSha&&c.value.witness?.tree===anchor.applicationTree&&c.value.witness?.rowsSha===anchor.terminalSnapshotSha256,'RECOVERY_CAPTURE');
  const binding=await bindCapture(c.value);need(binding.manifestSha===pin.manifestSha256,'RECOVERY_MANIFEST');await binding.reverify();
  const ids=[await directory(cap,['m7-capture-'+plan.captureRunId]),await directory(set,['documents','uploads','hrkeys','postgresql.custom','m7-paired-manifest.json']),await directory(restore,['m7-restore-'+runId]),await directory(target,['documents','uploads','hrkeys','pgdata','pg-private']),await directory(creds,['admin-password','pgpass'])];
  for(const k of ['documents','uploads','hrkeys','pgdata'])ids.push(await directory(join(target,k),[]));
  for(const k of ['admin-password','pgpass']){const f=await receipt(join(creds,k),false);ids.push([f.identity,f.sha]);}
  const stopped=await inspectStopped({target,runId});need(typeof stopped==='string'&&hex(stopped),'RECOVERY_CONTAINER');
  need(same(rootId,await directory(root,names))&&await first.verify()===true,'RECOVERY_DRIFT');
  capture={status:'M7_PAIRED_CAPTURE_SET_SEALED',...c.value};capPin={captureRunId:plan.captureRunId,manifestSha256:pin.manifestSha256,witnessSha256:pin.witnessSha256};
  return digest([rootId,a.identity,a.sha,r.identity,r.sha,c.identity,c.sha,ids,stopped]);
 }
 const baseline=await observe();return Object.freeze({root,firstRoot:first.root,proofSha256:pin.proofSha256,capturePin:Object.freeze(capPin),capture:()=>structuredClone(capture),async verify(){need(await observe()===baseline,'RECOVERY_DRIFT');return true;}});
}

// Third consumed attempt reached database custody after creating the target DB.
// Keep its stopped cluster and populated PGDATA intact; never restart it.
export const blockedCustodyPin=Object.freeze({planSha256:'4c1625b46fd1b1304ac24809c8f792c507f559c5c287f394945976985fd437cf',proofSha256:'60bdcdde74ab1083ce1eb2724c212f70d3ea8f64a85bf68d237cb1f2f16894b4'});
export async function createM7CustodyRecoveryGuard({root,pin,anchor,second,inspectStopped,inventory}){
 need(root===second?.firstRoot+'-recovery-'+second.proofSha256.slice(0,12)&&hex(pin?.planSha256)&&hex(pin?.proofSha256)&&typeof second.verify==='function'&&typeof second.capture==='function'&&typeof inspectStopped==='function'&&typeof inventory==='function','CUSTODY_CONTEXT');
 const cap=second.capture(),capPin=second.capturePin;
 async function observe(){
  need(await second.verify()===true,'SECOND_DRIFT');
  const names=['attempt-private.json','result-private.json','capture-private.json','restore'],rootId=await directory(root,names),a=await receipt(join(root,'attempt-private.json')),r=await receipt(join(root,'result-private.json')),c=await receipt(join(root,'capture-private.json'));
  const {planSha256,...plan}=a.value.plan??{}, {status,proofSha256,nativeRecoveryVerified,...proof}=r.value;
  need(a.value.status==='M7_NATIVE_ATTEMPT_CLAIMED'&&planSha256===pin.planSha256&&digest(plan)===planSha256&&status==='M7_RECOVERY_ATTEMPT_BLOCKED'&&proofSha256===pin.proofSha256&&digest(proof)===proofSha256&&nativeRecoveryVerified===false,'CUSTODY_PIN');
  need(['operatorSha','operatorTree','applicationSha','applicationTree','buildSha256','predecessorProofSha256','terminalSnapshotSha256','priorBlockedProofSha256'].every(k=>proof[k]===plan[k])&&proof.planSha256===planSha256&&plan.priorBlockedProofSha256===second.proofSha256&&plan.applicationSha===anchor.applicationSha&&plan.applicationTree===anchor.applicationTree&&plan.buildSha256===anchor.buildSha256&&plan.predecessorProofSha256===anchor.finalProofSha256&&plan.terminalSnapshotSha256===anchor.terminalSnapshotSha256&&plan.sourceDatabase===anchor.database,'CUSTODY_SOURCE');
  need(proof.phase==='RECOVERY'&&proof.primary==='M7_OPERATOR_RECOVERY'&&proof.runnerPrimary==='M7_PG_DATABASE_CUSTODY'&&proof.cleanup===null&&proof.runnerCleanup===null&&proof.reusedCapture===true&&same(proof.completedModes,[])&&proof.revokedNewSessions===0&&proof.newHrDownloadAudits===0&&['sourceMutationAuthorized','automaticRetryAllowed','productionAuthorized','milestone7Accepted','humanUatCompleted','secretsPrinted'].every(k=>proof[k]===false),'CUSTODY_BLOCKED');
  need(plan.captureRunId===capPin.captureRunId&&plan.reusedCaptureManifestSha256===capPin.manifestSha256&&plan.reusedCaptureWitnessSha256===capPin.witnessSha256&&proof.manifestSha256===capPin.manifestSha256&&proof.witnessSha256===capPin.witnessSha256&&same(c.value,{manifestArgs:cap.manifestArgs,witness:cap.witness,witnessSha256:cap.witnessSha256}),'CUSTODY_CAPTURE');
  const runId=plan.targets?.[0]?.runId;need(/^[a-f0-9]{12}$/.test(runId??'')&&plan.targets[0].mode==='correct','CUSTODY_ID');
  const restore=join(root,'restore'),target=join(restore,'m7-restore-'+runId),creds=join(target,'pg-private'),data=join(target,'pgdata');
  const stopped=await inspectStopped({target,runId});need(hex(stopped),'CUSTODY_CONTAINER');
  const ids=[await directory(restore,['m7-restore-'+runId]),await directory(target,['documents','uploads','hrkeys','pgdata','pg-private']),await directory(creds,['admin-password','pgpass']),await directory(data,['pgdata'])];
  for(const k of ['documents','uploads','hrkeys'])ids.push(await directory(join(target,k),[]));
  for(const k of ['admin-password','pgpass']){const f=await receipt(join(creds,k),false);ids.push([f.identity,f.sha]);}
  const rows=await inventory(data);need(Array.isArray(rows)&&rows.some(r=>r[0]==='pgdata/PG_VERSION'&&r.length===3)&&rows.some(r=>r[0]==='pgdata/global/pg_control'&&r.length===3)&&!rows.some(r=>r[0]==='pgdata/postmaster.pid'),'CUSTODY_PGDATA');
  need(await inspectStopped({target,runId})===stopped&&same(rootId,await directory(root,names))&&await second.verify()===true,'CUSTODY_DRIFT');
  return digest([rootId,a.identity,a.sha,r.identity,r.sha,c.identity,c.sha,ids,stopped,rows]);
 }
 const baseline=await observe();return Object.freeze({root,firstRoot:second.firstRoot,secondRoot:second.root,proofSha256:pin.proofSha256,capturePin:capPin,capture:()=>structuredClone(cap),async verify(){need(await observe()===baseline,'CUSTODY_DRIFT');return true;}});
}
