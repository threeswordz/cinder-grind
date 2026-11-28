// Exact-Mac operator for synthetic metadata readback. Explicit session scope;
// no protected HR downloads, reveals, business writes, migrations or release.
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectPostM4,readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {verifyRuntimePair,inventory} from './m6-runtime-evidence.mjs';
import {readAdmissionDatabase} from './m6-native-inspect.mjs';
import {bindRetainedCD} from './m6-retained-cd-bind.mjs';
import {runRetainedCDMetadata} from './m6-retained-cd-http.mjs';
import {captureCDPreservation,compareCDPreservation} from './m6-retained-cd-preservation.mjs';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function privateDir(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_CD_OPERATOR_PRIVATE_DIRECTORY');}
async function privateJson(path){
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=1048576,'M6_CD_OPERATOR_PRIVATE_FILE');
  const b=await f.readFile();try{need(b.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_CD_OPERATOR_FILE_DRIFT');return JSON.parse(b.toString('utf8'));}finally{b.fill(0);}
 }finally{await f.close();}
}
async function main(){
 need(process.argv.length===4&&process.argv[2]==='--authorize-four-synthetic-sessions'&&/^[a-f0-9]{40}$/.test(process.argv[3]),'M6_CD_OPERATOR_EXPLICIT_SCOPE_REQUIRED');
 need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'M6_CD_OPERATOR_EXACT_MAC_REQUIRED');
 const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),identity=await readCheckoutIdentity(source);
 need(identity.sha===process.argv[3]&&identity.clean,'M6_CD_OPERATOR_SOURCE_DRIFT');
 const root=join(homedir(),'Construction-ERP-Prototype-Runtime'),prior=join(root,'subcontract-upgrade'),application=join(root,'m4-upgrade-9417f07c','rehearsal','application');
 await privateDir(root);await privateDir(prior);await inspectPostM4(root);
 const cfg=await privateJson(join(root,'runtime-private.json')),containerReceipt=await privateJson(join(root,'container-owned.json')),manifest=await privateJson(join(root,'prototype-target.json'));
 need(validConfig(cfg)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.apiOrigin===cfg.apiOrigin&&manifest.runtime.webOrigin==='http://127.0.0.1:44171'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01','M6_CD_OPERATOR_SYNTHETIC_MANIFEST');
 const historical=await privateJson(join(prior,'ready.json'));
 need(historical.status==='SUBCONTRACT_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED'&&historical.applicationSha==='f37867c9dd34d535e5d62bfdd01934773c6f5e8a'&&historical.operatorMainSha==='bf3413caa26af4357bd57a38311f26dec86917c2'&&historical.sessionsRevoked===true&&historical.canonicalCertificationApprovalVerified===true&&historical.protectedDownloadBytesVerified===true&&historical.productionAuthorized===false,'M6_CD_OPERATOR_HISTORICAL_RECEIPT');
 const expected=await loadM4ProcessReceipts(root,application),observe=createMacObservation({root,application,expected,containerReceipt,validContainer});
 const verify=async()=>verifyRuntimePair(expected,await observe(),application,process.execPath,process.getuid());
 await verify();
 const {PrismaClient}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');
 const db=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
 try{
  const binding=await bindRetainedCD(db,{actorReceipt:await privateJson(join(root,'actors-ready.json')),privateActors:await privateJson(join(root,'actors-private.json')),fixture:await privateJson(join(root,'actors-fixture-private.json')),source:await privateJson(join(prior,'source-source-private.json')),journey:await privateJson(join(prior,'source-journey-private.json'))});
  const files=async()=>{const out={};for(const k of ['documents','uploads','hrkeys'])out[k]=await inventory(join(root,k));for(const k of ['api','web'])out[k]=await inventory(join(application,'apps',k,'dist'),{privateRoot:false});return out;};
  const ledger=await readAdmissionDatabase(db),before=await captureCDPreservation(db),beforeFiles=await files();
  await verify();
  need(same(ledger,await readAdmissionDatabase(db)),'M6_CD_OPERATOR_ADMISSION_DRIFT');
  let result,primary;
  try{result=await runRetainedCDMetadata(binding);}catch(e){primary=e;}
  // Do not retry or repair automatically on uncertain login/cleanup. The
  // after-capture fails closed if any live session remains.
  const after=await captureCDPreservation(db);
  const preservation=compareCDPreservation(before,after,Object.values(binding.actors).map(a=>a.userId));
  need(same(ledger,await readAdmissionDatabase(db))&&same(beforeFiles,await files()),'M6_CD_OPERATOR_PROTECTED_DRIFT');
  await verify();
  if(primary)throw primary;
  return {...result,...preservation,status:'M6_CD_AUTHENTICATED_METADATA_READBACK_PASS',inspectorSha:identity.sha,protectedFileInventoriesUnchanged:true,protectedBytesVerified:false,milestone6Accepted:false,productionAuthorized:false,secretsPrinted:false};
 }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{console.log(JSON.stringify(await main()));}catch(e){console.log(JSON.stringify({status:'M6_CD_AUTHENTICATED_METADATA_READBACK_BLOCKED',safeCode:/^M6_[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_CD_PRIVATE_FAILURE',milestone6Accepted:false,productionAuthorized:false,secretsPrinted:false}));process.exitCode=1;}
}
