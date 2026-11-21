#!/usr/bin/env node
// Non-mutating M6 entry inspection only. NEVER starts/migrates/stops a runtime,
// adds role grants, creates workflows, or retries any UOM/subcontract journey.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {readFile,lstat,realpath} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {validConfig,validReady,validContainer,SOURCE} from './prototype-actors.mjs';
import {validActorReceipt,validPrivateActors} from './prototype-browser-operator.mjs';
import {uomSnapshot,digest} from './prototype-uom-state.mjs';
import {validCompletedUomReceipt,sourceM6PreBusinessGrants} from './prototype-m6-finance-configuration.mjs';

const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const need=(ok,code)=>{if(!ok)fail(code);};
const sha40=s=>typeof s==='string'&&/^[a-f0-9]{40}$/.test(s);
const env=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL']
  .filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
const quiet=(bin,args,cwd)=>execFileSync(bin,args,{cwd,env:env(),encoding:'utf8',timeout:20000,
  maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
async function dir(path,privateOnly=true){
 const stat=await lstat(path);
 need(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&
   (!privateOnly||(stat.mode&0o077)===0)&&await realpath(path)===path,'M6_NONPRIVATE_RUNTIME_DIRECTORY');
}
async function privateState(path,max=33554432){
 const stat=await lstat(path);
 need(stat.isFile()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&
   stat.nlink===1&&(stat.mode&0o077)===0&&stat.size<=max,'M6_NONPRIVATE_RECEIPT');
 return JSON.parse(await readFile(path,'utf8'));
}
function manifestSynthetic(m,root,cfg){
 need(m?.mode==='isolated-synthetic'&&m.productionConnected===false&&
  m.retainedDataUsed===false&&m.realCompanyGrantsModified===false&&
  m.expectedMainSha===SOURCE&&m.runtime?.isolationRoot===root&&
  m.runtime?.databaseRoot===join(root,'db')&&m.runtime?.documentsRoot===join(root,'documents')&&
  m.runtime?.hrKeysRoot===join(root,'hrkeys')&&
  m.runtime?.postgresHost==='127.0.0.1'&&m.runtime?.postgresPort===55471&&
  m.runtime?.postgresDbName==='proto_a_01'&&
  m.runtime?.apiOrigin===cfg.apiOrigin,'M6_WRONG_SYNTHETIC_TARGET');
}
export async function inspectPreservedM6({sourceRoot,root,PrismaClient,cfg,binding,expectedSnapshot}){
 need(typeof PrismaClient==='function'&&cfg&&binding&&expectedSnapshot,
  'M6_READONLY_INSPECTION_INPUT_INVALID');
 const password=encodeURIComponent(cfg.databasePassword);
 const databaseUrl='postgresql://proto_runtime:'+password+'@127.0.0.1:55471/proto_a_01?schema=public';
 const db=new PrismaClient({datasources:{db:{url:databaseUrl}},log:[]});
 try{
  // Actual transaction isolation is READ ONLY even if the ORM is misused.
  const current=await db.$transaction(async tx=>{
   await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   const identity=await tx.$queryRawUnsafe('SELECT current_database() AS db, current_user AS role');
   need(identity.length===1&&identity[0].db==='proto_a_01'&&identity[0].role==='proto_runtime',
     'M6_DATABASE_OR_ROLE_IDENTITY_INVALID');
   const sessions=await tx.userSession.count({where:{revokedAt:null}});
   need(sessions===0,'M6_EXISTING_ACTIVE_USER_SESSIONS');
   return uomSnapshot(tx);
  },{isolationLevel:'RepeatableRead',timeout:30000});
  need(digest(current)===digest(expectedSnapshot),'M6_POPULATED_SOURCE_DB_DRIFT');
  // This is an information-only verdict, never an authority to configure.
  return {status:'M6_READ_ONLY_PRESERVED_SOURCE_VERIFIED',
   priorPrivateSourceSnapshotMatched:true,
   sourceDbSnapshotUnchanged:true,businessWrites:false,configurationWrites:false,
   macDeploymentVerified:false,fullBusinessJourneysVerified:false,
   productionAuthorized:false};
 }finally{await db.$disconnect();}
}
async function main(){
 need(process.argv.length===4&&process.argv[2]==='--inspect'&&sha40(process.argv[3]),
  'M6_READ_ONLY_INSPECT_AND_PINNED_SHA_REQUIRED');
 need(process.platform==='darwin'&&process.getuid()>0,
  'M6_MAC_NONROOT_INSPECTION_ONLY');
 need(process.versions.node==='24.21.0','M6_NODE_VERSION_MISMATCH');
 need(!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),
  'M6_NODE_OVERRIDE_REFUSED');
 const sourceRoot=fileURLToPath(new URL('../../',import.meta.url));
 need(quiet('git',['rev-parse','HEAD'],sourceRoot)===process.argv[3]&&
  quiet('git',['status','--porcelain'],sourceRoot)===''&&
  ['https://github.com/threeswordz/cinder-grind.git','https://github.com/threeswordz/cinder-grind']
   .includes(quiet('git',['remote','get-url','origin'],sourceRoot)),
  'M6_OPERATOR_GIT_SOURCE_DRIFT');
 const home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),
  stage=join(root,'uom-upgrade'),previousApp=join(stage,'application');
 need(resolve(home)===home,'M6_HOME_INVALID');
 await dir(home,false);
 for(const path of [root,stage,join(root,'db'),join(root,'documents'),
  join(root,'hrkeys'),join(root,'uploads')])await dir(path);
 const cfg=await privateState(join(root,'runtime-private.json'),1048576),
  ready=await privateState(join(root,'runtime-ready.json'),1048576),
  manifest=await privateState(join(root,'prototype-target.json'),1048576),
  container=await privateState(join(root,'container-owned.json'),1048576),
  prior=await privateState(join(stage,'ready.json'),1048576),
  actorsReady=await privateState(join(root,'actors-ready.json'),1048576),
  actors=await privateState(join(root,'actors-private.json'),1048576),
  fixture=await privateState(join(root,'actors-fixture-private.json'),1048576),
  configuration=await privateState(join(root,'material-configuration-private.json'),1048576),
  expectedSnapshot=await privateState(join(stage,'source-database-after-private.json'));
 need(validConfig(cfg)&&validReady(ready)&&ready.imageId===container.image&&
  validActorReceipt(actorsReady)&&validPrivateActors(actors)&&validCompletedUomReceipt(prior),
  'M6_PREDECESSOR_RECEIPTS_INVALID');
 manifestSynthetic(manifest,root,cfg);
 const binding={sourceSha:SOURCE,actors:actors.actors,fixture,configuration};
 sourceM6PreBusinessGrants(binding);
 need(quiet('git',['rev-parse','HEAD'],previousApp)===prior.applicationSha&&
  quiet('git',['status','--porcelain'],previousApp)==='',
  'M6_PRESERVED_APPLICATION_CHANGED');
 const podman=JSON.parse(quiet('podman',['inspect',container.id],sourceRoot));
 need(podman.length===1&&validContainer(podman[0],container,join(root,'db')),
  'M6_WRONG_DATABASE_CONTAINER');
 const require=createRequire(join(previousApp,'apps/api/package.json'));
 const {PrismaClient}=require('@prisma/client');
 const result=await inspectPreservedM6({sourceRoot,root,PrismaClient,cfg,binding,expectedSnapshot});
 console.log(JSON.stringify({...result,operatorSha:process.argv[3],
  sourcePrivateBytesUnchanged:true,readyForFutureGuardedReleasePreparation:true}));
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===
  await realpath(new URL(import.meta.url))){
 try{await main();}catch(e){console.log(JSON.stringify({status:'M6_READ_ONLY_INSPECTION_BLOCKED',
  code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_PRIVATE_PREFLIGHT_FAILURE',
  businessWrites:false,configurationWrites:false,
  macDeploymentVerified:false,productionAuthorized:false}));process.exitCode=1;}
}
