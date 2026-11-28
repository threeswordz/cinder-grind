// M6-01 lane-native composition; not a shared runner, CLI, cutover or release gate.
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=/^[a-f0-9]{40}$/;
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function privateDir(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_SUCCESSOR_ENTRY_DIRECTORY');return s;}
async function privateJson(path){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=1048576,'M6_SUCCESSOR_ENTRY_PRIVATE_RECEIPT');
    const bytes=await f.readFile();try{need(bytes.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_SUCCESSOR_ENTRY_RECEIPT_DRIFT');return JSON.parse(bytes.toString('utf8'));}finally{bytes.fill(0);}
  }finally{await f.close();}
}
export function validateSuccessorRehearsalRequest(candidate,authorization){
  need(sha.test(candidate?.sha??'')&&sha.test(candidate?.tree??'')&&candidate.syntheticOnly===true&&candidate.rehearsalOnly===true&&candidate.productionAuthorized===false,'M6_SUCCESSOR_ENTRY_PIN');
  // This is a scope binding, not independent verification of Owner authority.
  // The coordinator must establish actual authorization before invoking this entry.
  need(authorization?.candidateSha===candidate.sha&&authorization.candidateTree===candidate.tree&&authorization.isolatedRecoveryOnly===true&&authorization.ownerAuthorizedRehearsal===true&&authorization.productionAuthorized===false&&authorization.retainedMutationAuthorized===false,'M6_SUCCESSOR_ENTRY_AUTHORIZATION');
}
export function normalizeSuccessorRehearsalReceipt(candidate,result){
  const p=result?.migrationProof;
  need(result?.status==='M6_SUCCESSOR_ISOLATED_REHEARSAL_PASS'&&result.candidateSha===candidate.sha&&result.candidateTree===candidate.tree&&result.restoredRowsMatched===true&&result.recoveryCopyUnchanged===true&&result.retainedDatabaseAndFilesUnchanged===true&&Number.isSafeInteger(result.historicalTablesPreserved)&&result.historicalTablesPreserved>2&&result.cutoverPerformed===false&&result.milestone6Accepted===false&&result.productionAuthorized===false,'M6_SUCCESSOR_ENTRY_RESULT');
  need(p?.status==='M6_SUCCESSOR_MIGRATION_PROOF_PASS'&&p.predecessorChecksumsMatched===177&&p.additionsMatched===7&&p.appliedChecksumsMatched===184&&p.mayMutate===false&&p.releaseAccepted===false&&p.productionAuthorized===false,'M6_SUCCESSOR_ENTRY_MIGRATION_PROOF');
  return {status:'M6_SUCCESSOR_ISOLATED_REHEARSAL_SEALED',candidateSha:candidate.sha,candidateTree:candidate.tree,predecessorChecksumsMatched:177,additionsMatched:7,appliedChecksumsMatched:184,historicalTablesPreserved:result.historicalTablesPreserved,restoredRowsMatched:true,recoveryCopyUnchanged:true,retainedDatabaseAndFilesUnchanged:true,cutoverPerformed:false,milestone6Accepted:false,productionAuthorized:false};
}
// Close both connections before reporting success. A failed operation or cleanup
// never produces a ready receipt; leave partial artifacts for explicit diagnosis.
export async function completeSuccessorRehearsal({candidate,authorization,run,closeRecovery,closeSource,verifyFinal,seal}){
  validateSuccessorRehearsalRequest(candidate,authorization);
  let receipt,primary;
  try{receipt=normalizeSuccessorRehearsalReceipt(candidate,await run());}catch(e){primary=e;}
  for(const close of [closeRecovery,closeSource]){try{await close();}catch(e){primary??=e;}}
  if(primary)throw primary;
  await verifyFinal();await seal(receipt);return receipt;
}
export async function sealSuccessorRehearsalReceipt(stage,receipt){
  const before=await privateDir(stage),path=join(stage,'rehearsal-ready.json');
  const f=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await f.writeFile(JSON.stringify(receipt,null,2)+'\n');await f.sync();}finally{await f.close();}
  const after=await privateDir(stage);need(before.dev===after.dev&&before.ino===after.ino,'M6_SUCCESSOR_ENTRY_STAGE_DRIFT');
  need(JSON.stringify(await privateJson(path))===JSON.stringify(receipt),'M6_SUCCESSOR_ENTRY_SEAL_DRIFT');
}
// Invoke only from the coordinator's approved exact-head native batch. This does
// not start/stop services, create sessions, modify grants, or migrate the live DB.
export async function runNativePinnedSuccessorRehearsal({candidate,authorization,sourceRoot}){
  validateSuccessorRehearsalRequest(candidate,authorization);
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'M6_SUCCESSOR_ENTRY_MAC_REQUIRED');
  const root=join(homedir(),'Construction-ERP-Prototype-Runtime');
  need(typeof sourceRoot==='string'&&resolve(sourceRoot)===sourceRoot&&await realpath(sourceRoot)===sourceRoot,'M6_SUCCESSOR_ENTRY_SOURCE_PATH');
  await privateDir(root);
  const {inspectPostM4,readCheckoutIdentity}=await import('./m6-post-m4-inspect.mjs');
  const {validConfig,validContainer,SOURCE}=await import('./prototype-actors.mjs');
  const {loadM4ProcessReceipts,createMacObservation}=await import('./m6-mac-observation.mjs');
  const {verifyRuntimePair}=await import('./m6-runtime-evidence.mjs');
  const {createNativeSuccessorRecoveryAdapter}=await import('./m6-successor-recovery-adapter.mjs');
  const {runPinnedSuccessorUpgrade}=await import('./m6-successor-upgrade-operator.mjs');
  const {createRequire}=await import('node:module');
  await inspectPostM4(root);
  const application=join(root,'m4-upgrade-9417f07c','rehearsal','application');
  const config=await privateJson(join(root,'runtime-private.json')),containerReceipt=await privateJson(join(root,'container-owned.json')),manifest=await privateJson(join(root,'prototype-target.json'));
  need(validConfig(config)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.apiOrigin===config.apiOrigin&&manifest.runtime.webOrigin==='http://127.0.0.1:44171'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01','M6_SUCCESSOR_ENTRY_SYNTHETIC_MANIFEST');
  const expected=await loadM4ProcessReceipts(root,application),observe=createMacObservation({root,application,expected,containerReceipt,validContainer});
  const verifyRetained=async()=>{await inspectPostM4(root);const id=await readCheckoutIdentity(sourceRoot);need(id.sha===candidate.sha&&id.tree===candidate.tree&&id.clean,'M6_SUCCESSOR_ENTRY_SOURCE_DRIFT');verifyRuntimePair(expected,await observe(),application,process.execPath,process.getuid());};
  await verifyRetained();
  const {PrismaClient}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');
  const sourceDatabase=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(config.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
  let adapter;
  try{adapter=await createNativeSuccessorRecoveryAdapter({candidate,sourceRoot,retainedRoot:root,sourceDatabase,containerReceipt,config,verifyRetained});}catch(e){await sourceDatabase.$disconnect().catch(()=>{});throw e;}
  const stage=join(root,'m6-successor-'+candidate.sha);
  return completeSuccessorRehearsal({candidate,authorization,run:()=>runPinnedSuccessorUpgrade({candidate,sourceRoot,retainedRoot:root,sourceDatabase,adapter}),closeRecovery:()=>adapter.close(),closeSource:()=>sourceDatabase.$disconnect(),verifyFinal:verifyRetained,seal:receipt=>sealSuccessorRehearsalReceipt(stage,receipt)});
}
