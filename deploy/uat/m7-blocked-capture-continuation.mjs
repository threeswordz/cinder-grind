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
async function receipt(p){const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=65536&&await realpath(p)===p,'RECEIPT');const f=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{need(same(identity(s),identity(await f.stat())),'DRIFT');const b=await f.readFile();need(b.length===s.size&&same(identity(s),identity(await f.stat()))&&same(identity(s),identity(await lstat(p))),'DRIFT');return {value:JSON.parse(b.toString('utf8')),identity:identity(s),sha:createHash('sha256').update(b).digest('hex')};}finally{await f.close();}}
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
