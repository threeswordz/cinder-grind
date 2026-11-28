// One-shot M7 native coordinator. No source mutation, deployment, or implicit authorization.
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,mkdir,open,realpath} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute,dirname} from 'node:path';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {blockedCapturePin,createM7PriorAttemptGuard,blockedRecoveryPin,createM7SealedRecoveryGuard} from './m7-blocked-capture-continuation.mjs';
const need=(ok,c)=>{if(!ok)throw Error('M7_OPERATOR_'+c);};
const hex=(x,n=64)=>typeof x==='string'&&x.length===n&&/^[a-f0-9]+$/.test(x);
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const safe=e=>/^M[67]_[A-Z0-9_]+$/.test(e?.message??'')?e.message:'M7_OPERATOR_PRIVATE_FAILURE';
const modes=['correct','missing','wrong'];
const nativeAuthority=Symbol('native-adapters-only');
const within=(a,b)=>{const r=relative(a,b);return r===''||(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'));};
const disjoint=(a,b)=>!within(a,b)&&!within(b,a);
const path=p=>typeof p==='string'&&isAbsolute(p)&&resolve(p)===p&&p!=='/';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
async function privateDir(p){const s=await lstat(p);need(path(p)&&await realpath(p)===p&&s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077),'DIRECTORY');return [s.dev,s.ino,s.uid,s.mode];}
async function seal(p,value){const bytes=Buffer.from(JSON.stringify(value)+'\n');const f=await open(p,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(bytes);await f.sync();}finally{await f.close();}const s=await lstat(p);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size===bytes.length&&await realpath(p)===p,'RECEIPT_CUSTODY');const r=await open(p,constants.O_RDONLY|constants.O_NOFOLLOW);try{const t=await r.stat();need(t.dev===s.dev&&t.ino===s.ino&&t.ctimeMs===s.ctimeMs&&Buffer.compare(await r.readFile(),bytes)===0,'RECEIPT_READBACK');}finally{await r.close();}}
export function makeM7Plan({operatorSha,operatorTree,anchor,priorBlockedProofSha256,reuseCapture}){
 need(hex(operatorSha,40)&&hex(operatorTree,40)&&hex(anchor?.applicationSha,40)&&hex(anchor?.applicationTree,40)&&hex(anchor?.buildSha256)&&hex(anchor?.finalProofSha256)&&hex(anchor?.terminalSnapshotSha256)&&anchor.database==='m6_successor_rehearsal','PIN');
 need(priorBlockedProofSha256===undefined||hex(priorBlockedProofSha256),'PRIOR_PIN');
 need(reuseCapture===undefined||hex(priorBlockedProofSha256)&&/^[a-f0-9]{12}$/.test(reuseCapture.captureRunId??'')&&hex(reuseCapture.manifestSha256)&&hex(reuseCapture.witnessSha256),'REUSE_PIN');
 const seed=priorBlockedProofSha256??anchor.finalProofSha256;
 const plan={operatorSha,operatorTree,...(priorBlockedProofSha256?{priorBlockedProofSha256}:{}),...(reuseCapture?{reusedCaptureManifestSha256:reuseCapture.manifestSha256,reusedCaptureWitnessSha256:reuseCapture.witnessSha256}:{}),applicationSha:anchor.applicationSha,applicationTree:anchor.applicationTree,buildSha256:anchor.buildSha256,predecessorProofSha256:anchor.finalProofSha256,terminalSnapshotSha256:anchor.terminalSnapshotSha256,sourceDatabase:anchor.database,captureRunId:reuseCapture?.captureRunId??digest([seed,'capture']).slice(0,12),targets:modes.map((mode,i)=>({mode,runId:digest([seed,mode]).slice(0,12),port:33073+i,dbPort:55472+i})),sourceMutationAuthorized:false,productionAuthorized:false,automaticRetryAllowed:false};
 return Object.freeze({...plan,planSha256:digest(plan)});
}
export function m7Confirmation(plan){return (plan.reusedCaptureManifestSha256?'RESUME M7 FROM SEALED CAPTURE ':plan.priorBlockedProofSha256?'CONTINUE M7 AFTER BLOCKED CAPTURE ':'EXECUTE M7 ISOLATED RECOVERY ')+plan.planSha256;}
export async function runM7Once({plan,confirmation,root,application,operator,executable,source,verifyCheckout,makeClient,inventory,checkout,prior},d,authority){
 need(path(root)&&path(application)&&path(operator)&&path(executable)&&[application,operator,source.root].every(p=>disjoint(root,p))&&typeof verifyCheckout==='function'&&typeof source?.close==='function','CONTEXT');
 const expected=makeM7Plan({operatorSha:plan.operatorSha,operatorTree:plan.operatorTree,anchor:source.anchor,priorBlockedProofSha256:prior?.proofSha256,reuseCapture:prior?.capturePin});need((!prior||path(prior.root)&&disjoint(root,prior.root)&&typeof prior.verify==='function'&&(!prior.capturePin||path(prior.firstRoot)&&disjoint(root,prior.firstRoot)&&typeof prior.capture==='function'))&&same(plan,expected)&&confirmation===m7Confirmation(expected),'AUTHORIZATION');
 let claimed=false,rootId,phase='PREFLIGHT',capture,observed,result,primary=null,cleanup=null,receipt;
 const verifyPrior=async()=>{if(prior)need(await prior.verify()===true,'PRIOR_DRIFT');};
 const verifyRoot=async()=>{need(same(rootId,await privateDir(root)),'ATTEMPT_DRIFT');await verifyPrior();};
 try{
   await verifyCheckout();await source.observe();await d.preflightPorts(plan.targets);await verifyPrior();
   // Constant source-specific attempt path: a failed or successful attempt cannot
   // be replayed with another operator SHA or by changing a random run ID.
   await mkdir(root,{mode:0o700});claimed=true;rootId=await privateDir(root);
   await seal(join(root,'attempt-private.json'),{status:'M7_NATIVE_ATTEMPT_CLAIMED',plan});
   const captureParent=join(root,'capture'),restoreParent=join(root,'restore');if(!prior?.capturePin)await mkdir(captureParent,{mode:0o700});await mkdir(restoreParent,{mode:0o700});await verifyRoot();
   phase=prior?.capturePin?'REUSE_CAPTURE':'CAPTURE';capture=prior?.capturePin?prior.capture():await d.createM7PairedCapture({parent:captureParent,runId:plan.captureRunId,sourceRoot:source.paths.stage,protectedRoots:[source.root,application,operator,...(prior?[prior.root]:[])],anchor:source.anchor,observe:source.observe,dump:source.dump})();
   need(capture.status==='M7_PAIRED_CAPTURE_SET_SEALED'&&hex(capture.witnessSha256)&&(!prior?.capturePin||capture.manifestArgs.manifestSha256===plan.reusedCaptureManifestSha256&&capture.witnessSha256===plan.reusedCaptureWitnessSha256),'CAPTURE');await verifyRoot();
   const binding=await d.bindM7Capture({...capture,verifyManifest:d.verifyM7PairedManifest});
   const observe=d.createM7CaptureObserver({source,binding});observed=await observe();
   await seal(join(root,'capture-private.json'),{manifestArgs:capture.manifestArgs,witness:capture.witness,witnessSha256:capture.witnessSha256});
   phase='SOURCE_EVIDENCE';const fixtures=await d.readM7NativeSourceFixtures({source,binding});const evidence=await d.createM7NativeEvidence({source,binding,observe});
   const claimOptions={parent:restoreParent,protectedRoots:{application,database:join(source.root,'db'),documents:source.paths.documents,uploads:source.paths.uploads,hrkeys:source.paths.hrkeys,capture:capture.manifestArgs.root},candidate:{sha:plan.applicationSha,tree:plan.applicationTree,clean:true},sourcePort:33072};
   phase='RECOVERY';await verifyCheckout();await verifyRoot();result=await (await d.createM7RecoveryRunner({source,binding,manifestArgs:capture.manifestArgs,claimOptions,targets:plan.targets,application,buildSha256:plan.buildSha256,executable,makeClient,inventory,checkout,fixtures,evidence}))();
   need(result.status==='M7_RECOVERY_COMPOSITION_PASS'&&result.primary===null&&result.cleanup===null&&same(result.completedModes,modes)&&result.revokedNewSessions===12&&result.newHrDownloadAudits===1,'RECOVERY');
   phase='FINAL_PRESERVATION';need(same(observed,await observe()),'SOURCE_DRIFT');await binding.reverify();await d.preflightPorts(plan.targets);await verifyCheckout();await verifyRoot();
 }catch(e){primary=safe(e);}
 finally{try{await source.close();}catch(e){cleanup=safe(e);}}
 if(!claimed)return {status:'M7_NATIVE_PRECHECK_BLOCKED',phase,primary,cleanup,automaticRetryAllowed:false,productionAuthorized:false,nativeRecoveryVerified:false};
 const proof={planSha256:plan.planSha256,...(prior?{priorBlockedProofSha256:prior.proofSha256,priorAttemptUnchanged:!primary&&!cleanup}:{}),...(prior?.capturePin?{reusedCapture:true}:{}),operatorSha:plan.operatorSha,operatorTree:plan.operatorTree,applicationSha:plan.applicationSha,applicationTree:plan.applicationTree,buildSha256:plan.buildSha256,predecessorProofSha256:plan.predecessorProofSha256,terminalSnapshotSha256:plan.terminalSnapshotSha256,manifestSha256:capture?.manifestArgs?.manifestSha256??null,witnessSha256:capture?.witnessSha256??null,phase,primary,cleanup,runnerPrimary:result?.primary??null,runnerCleanup:result?.cleanup??null,completedModes:result?.completedModes??[],revokedNewSessions:result?.revokedNewSessions??0,newHrDownloadAudits:result?.newHrDownloadAudits??0,sourcePreserved:!primary&&!cleanup,portsReleased:!primary&&!cleanup,sourceMutationAuthorized:false,automaticRetryAllowed:false,humanUatCompleted:false,milestone7Accepted:false,productionAuthorized:false,secretsPrinted:false};
 // Composition cannot self-certify native execution. The native CLI is the only
 // path that supplies the real adapters and seals its separately labelled receipt.
 receipt={status:primary||cleanup?'M7_RECOVERY_ATTEMPT_BLOCKED':'M7_RECOVERY_OPERATOR_CHECKS_COMPLETE',...proof,proofSha256:digest(proof),nativeRecoveryVerified:false};
 await verifyRoot();await seal(join(root,'result-private.json'),receipt);
 if(authority===nativeAuthority&&receipt.status==='M7_RECOVERY_OPERATOR_CHECKS_COMPLETE'){
   const finalProof={...proof,compositionProofSha256:receipt.proofSha256,nativeRecoveryVerified:true};const final={status:'M7_NATIVE_RECOVERY_RECEIPT_SEALED',...finalProof,finalProofSha256:digest(finalProof)};await verifyRoot();await seal(join(root,'ready-private.json'),final);await verifyRoot();return final;
 }
 return receipt;
}
async function native(args){
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&process.stdin.isTTY&&process.stdout.isTTY&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$|^GIT_|^CONTAINER_HOST$|^CONTAINER_CONNECTION$|^DOCKER_HOST$/.test(k)),'MAC');
 need(args.length===4&&['--execute-reviewed-m7','--continue-reviewed-m7-capture','--resume-reviewed-m7-recovery'].includes(args[0])&&hex(args[1],40),'USAGE');
 const [action,operatorSha,application,executable]=args,operator=dirname(dirname(dirname(fileURLToPath(import.meta.url))));
 need([application,operator,executable].every(path)&&await realpath(application)===application&&await realpath(operator)===operator&&await realpath(executable)===executable,'PATH');
 const resolved=execFileSync('/usr/bin/which',['podman'],{encoding:'utf8',timeout:10000}).trim();need(await realpath(resolved)===executable,'PODMAN');
 const [{terminalAnchor},{readCheckoutIdentity},{inventory},{createM7NativeCaptureContext},{createM7PairedCapture},{bindM7Capture},{verifyM7PairedManifest},{createM7CaptureObserver},{readM7NativeSourceFixtures},{createM7NativeEvidence},{createM7RecoveryRunner}]=await Promise.all([import('./m7-terminal-source.mjs'),import('./m6-post-m4-inspect.mjs'),import('./m6-runtime-evidence.mjs'),import('./m7-source-capture-adapter.mjs'),import('./m7-paired-capture.mjs'),import('./m7-capture-contract.mjs'),import('./m7-paired-backup.mjs'),import('./m7-target-database.mjs'),import('./m7-source-fixtures.mjs'),import('./m7-native-evidence.mjs'),import('./m7-recovery-runner.mjs')]);
 const op=await readCheckoutIdentity(operator);need(op.sha===operatorSha&&op.clean===true,'OPERATOR');
 const initialRoot=join(await realpath(homedir()),'Construction-ERP-M7-Recovery-'+terminalAnchor.finalProofSha256.slice(0,12));
 const first=action!=='--execute-reviewed-m7'?await createM7PriorAttemptGuard({root:initialRoot,pin:blockedCapturePin,anchor:terminalAnchor}):undefined;
 let prior=first;
 if(action==='--resume-reviewed-m7-recovery'){
   const [{readM7PrivateTerminalReceipt},{verifyM7TargetContainer}]=await Promise.all([import('./m7-terminal-source.mjs'),import('./m7-target-cluster.mjs')]);
   const sourceReceipt=await readM7PrivateTerminalReceipt(join(await realpath(homedir()),'Construction-ERP-Prototype-Runtime','container-owned.json'));
   const inspectStopped=async({target,runId})=>{
     const name='erp-m7-'+runId;let rows;try{rows=JSON.parse(execFileSync(executable,['inspect',name],{cwd:application,encoding:'utf8',timeout:30000,maxBuffer:1048576,stdio:['ignore','pipe','pipe']}));}catch{throw Error('M7_PRIOR_CONTAINER_INSPECT');}
     need(Array.isArray(rows)&&rows.length===1&&hex(rows[0].Id,64)&&rows[0].State?.ExitCode===0,'PRIOR_CONTAINER');const c=rows[0];
     verifyM7TargetContainer(c,{id:c.Id,sourceId:sourceReceipt.id,image:sourceReceipt.image,name,runId,data:join(target,'pgdata'),credentials:join(target,'pg-private'),adminRole:'m7_admin_'+runId},{running:false});
     return digest([c.Id,c.Image,c.Name,c.Created,c.State,c.Config,c.HostConfig,c.NetworkSettings,c.Mounts]);
   };
   prior=await createM7SealedRecoveryGuard({root:initialRoot+'-continuation-'+first.proofSha256.slice(0,12),pin:blockedRecoveryPin,anchor:terminalAnchor,first,inspectStopped,bindCapture:c=>bindM7Capture({...c,verifyManifest:verifyM7PairedManifest})});
 }
 const plan=makeM7Plan({operatorSha,operatorTree:op.tree,anchor:terminalAnchor,priorBlockedProofSha256:prior?.proofSha256,reuseCapture:prior?.capturePin});
 const verifyCheckout=async()=>{const [o,a]=await Promise.all([readCheckoutIdentity(operator),readCheckoutIdentity(application)]);need(o.sha===plan.operatorSha&&o.tree===plan.operatorTree&&o.clean===true&&a.sha===plan.applicationSha&&a.tree===plan.applicationTree&&a.clean===true&&digest(await inventory(join(application,'apps/api/dist'),{privateRoot:false}))===plan.buildSha256,'CHECKOUT');};
 await verifyCheckout();const root=prior?initialRoot+(prior.capturePin?'-recovery-':'-continuation-')+prior.proofSha256.slice(0,12):initialRoot;
 const preflightPorts=async targets=>{for(const port of targets.flatMap(t=>[t.port,t.dbPort])){try{execFileSync('/usr/sbin/lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-t'],{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});need(false,'PORT_OCCUPIED');}catch(e){need(e.status===1&&!e.signal&&!e.stdout&&!e.stderr,'PORT_OCCUPIED');}}};
 await preflightPorts(plan.targets);try{await lstat(root);need(false,'PRIOR_ATTEMPT');}catch(e){need(e.code==='ENOENT','PRIOR_ATTEMPT');}
 const {PrismaClient,Prisma}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');need(Prisma.prismaVersion.client==='6.19.3','PRISMA');
 const input=createInterface({input:process.stdin,output:process.stdout});let confirmation;try{console.log(JSON.stringify({status:'M7_NATIVE_PLAN',...plan}));confirmation=await input.question('Type exactly '+m7Confirmation(plan)+'\n> ');}finally{input.close();}need(confirmation===m7Confirmation(plan),'AUTHORIZATION');
 const source=await createM7NativeCaptureContext({application});let receipt;try{receipt=await runM7Once({plan,confirmation,root,application,operator,executable,source,verifyCheckout,makeClient:url=>new PrismaClient({datasources:{db:{url}},log:[]}),inventory,checkout:readCheckoutIdentity,prior},{preflightPorts,createM7PairedCapture,bindM7Capture,verifyM7PairedManifest,createM7CaptureObserver,readM7NativeSourceFixtures,createM7NativeEvidence,createM7RecoveryRunner},nativeAuthority);}catch(e){await source.close().catch(()=>{});throw e;}
 console.log(JSON.stringify(receipt));if(receipt.status!=='M7_NATIVE_RECOVERY_RECEIPT_SEALED')process.exitCode=1;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))native(process.argv.slice(2)).catch(e=>{console.log(JSON.stringify({status:'M7_NATIVE_OPERATOR_BLOCKED',code:safe(e),automaticRetryAllowed:false,productionAuthorized:false,nativeRecoveryVerified:false}));process.exitCode=1;});
