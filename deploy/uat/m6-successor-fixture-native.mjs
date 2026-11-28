// Event237 authorized fixture-only native entry. No sessions, launch or recovery replay.
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {open,lstat,realpath,mkdir} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectPostM4,readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {verifyRuntimePair,inventory} from './m6-runtime-evidence.mjs';
import {verifyCommonCandidate} from './m6-common-successor.mjs';
import {migrationSources} from './m6-historical-backup.mjs';
import {readSuccessorSources,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {assessSuccessorRoleCoverage} from './m6-successor-role-coverage.mjs';
import {writeSuccessorFixture,captureFixtureRows} from './m6-successor-fixture-writer.mjs';
import {captureSuccessorDatabase,verifySuccessorPreservation} from './m6-successor-upgrade-operator.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
const planSha256='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_ADMISSION_'+code),{safeCode:'M6_ADMISSION_'+code});};
const candidate=Object.freeze({sha:'70013b5139292ef33563447f8937c8f132feabd2',tree:'8152b5ac627325c91c36ed65875791966a1a8874',syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false});
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function directory(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'DIRECTORY');}
async function privateJson(path){
  need(await realpath(path)===path,'PRIVATE_PATH');
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=1048576,'PRIVATE_RECEIPT');
    const b=await f.readFile();try{need(b.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'RECEIPT_DRIFT');return JSON.parse(b.toString('utf8'));}finally{b.fill(0);}
  }finally{await f.close();}
}
async function main(){
  need(process.argv.length===6&&process.argv[2]==='--apply-authorized-fixture'&&/^[a-f0-9]{40}$/.test(process.argv[3])&&process.argv[5]===planSha256,'EXACT_ARGUMENTS');
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'MAC_REQUIRED');
  const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),app=await realpath(process.argv[4]);
  const id=await readCheckoutIdentity(source),applicationId=await readCheckoutIdentity(app);
  need(id.sha===process.argv[3]&&id.clean&&applicationId.sha===candidate.sha&&applicationId.tree===candidate.tree&&applicationId.clean&&app!==source,'CHECKOUT');
  const root=join(homedir(),'Construction-ERP-Prototype-Runtime'),historical=join(root,'m4-upgrade-9417f07c','rehearsal','application'),stage=join(root,'m6-successor-'+candidate.sha);
  await directory(root);await directory(stage);await directory(join(stage,'recovery'));
  const receipt=await privateJson(join(stage,'rehearsal-ready.json'));verifyCommonCandidate(candidate,receipt);need(receipt.historicalTablesPreserved===172,'SEALED_TABLE_COUNT');
  const cfg=await privateJson(join(root,'runtime-private.json')),containerReceipt=await privateJson(join(root,'container-owned.json')),manifest=await privateJson(join(root,'prototype-target.json'));
  need(validConfig(cfg)&&manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.postgresDbName==='proto_a_01'&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471,'SYNTHETIC_MANIFEST');
  await inspectPostM4(root);
  const expected=await loadM4ProcessReceipts(root,historical),observe=createMacObservation({root,application:historical,expected,containerReceipt,validContainer});
  const verify=async()=>{await inspectPostM4(root);verifyRuntimePair(expected,await observe(),historical,process.execPath,process.getuid());const a=await readCheckoutIdentity(app),o=await readCheckoutIdentity(source);need(a.sha===candidate.sha&&a.tree===candidate.tree&&a.clean&&o.sha===id.sha&&o.tree===id.tree&&o.clean,'CHECKOUT_DRIFT');};
  await verify();
  const privateActors=await privateJson(join(root,'actors-private.json')),actorReceipt=await privateJson(join(root,'actors-ready.json')),fixture=await privateJson(join(root,'actors-fixture-private.json'));
  need(validPrivateActors(privateActors)&&validActorReceipt(actorReceipt),'ACTOR_RECEIPT');
  const {PrismaClient}=createRequire(join(app,'apps/api/package.json'))('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/m6_successor_rehearsal?schema=public'}},log:[]});
  try{
    const proof=await observeSuccessorMigrations({db,expectedDatabase:'m6_successor_rehearsal',expectedRole:'proto_runtime',predecessor:await migrationSources(historical),sources:await readSuccessorSources(app)});
    const observeCoverage=async tx=>{
      const companies=await tx.company.findMany({select:{id:true,companyCode:true,isActive:true}});
      need(companies.length===2&&[[fixture.companyId,'PROTO_A'],[fixture.foreignCompanyId,'PROTO_B']].every(([id,code])=>companies.some(c=>c.id===id&&c.companyCode===code&&c.isActive)),'COMPANIES');
      const users=await tx.user.findMany({take:101,select:{id:true,employeeId:true,email:true,companyId:true,isActive:true,company:{select:{isActive:true}},employee:{select:{id:true,companyId:true,isActive:true}},userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
      const projects=await tx.project.findMany({where:{companyId:fixture.companyId,isActive:true},include:{members:true}});
      need(projects.length===2&&[[fixture.projectId,'SITE_A'],[fixture.unassignedProjectId,'SITE_B']].every(([id,code])=>projects.some(p=>p.id===id&&p.projectCode===code)),'PROJECTS');
      const workflow=await tx.approvalWorkflow.findUnique({where:{companyId_workflowCode:{companyId:fixture.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION'}},include:{steps:{include:{stepRoles:true}}}});
      return assessSuccessorRoleCoverage({actors:privateActors.actors,companyId:fixture.companyId,foreignCompanyId:fixture.foreignCompanyId,projectId:fixture.projectId,users,projects,workflow});
    };
    const census={status:'M6_SUCCESSOR_ROLE_COVERAGE_OBSERVED',applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:'4797928fbb06c156645dff821a1fbc3ec1fb4b11',coverageOnly:true,sealedReceiptMatched:true,retainedRuntimeIdentityChecked:true,appliedChecksumsMatched:proof.appliedChecksumsMatched,zeroActiveSessionsObserved:true,functionalActorsBound:8,requiredFunctionalActors:8,ss16ProjectsObserved:2,mayMutate:false,authenticatedReadbackPerformed:false,productionAuthorized:false,milestone6Accepted:false,recoveryReplayed:false,secretsPrinted:false,ss16:{canonicalStoreReady:false,canonicalPmReady:false,workflowReady:false,projectMembershipReady:false,ready:false},certification:{finance:2,certificationOnly:0,unassigned:0,foreign:0,ready:false}};
    const authorization={planSha256,applicationSha:candidate.sha,database:'m6_successor_rehearsal',ownerAuthorizedFixture:true,retainedMutationAuthorized:false,productionAuthorized:false};
    const recovery=join(stage,'recovery'),attempt=join(stage,'event237-fixture');
    const sourceDb=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
    try{
      // Establish that the recovered database still matches the sealed historical
      // source before allowing any fixture addition. No restore/migrate replay.
      const old=await captureSuccessorDatabase(sourceDb,'proto_a_01',177);
      verifySuccessorPreservation(old,old,await captureSuccessorDatabase(db,'m6_successor_rehearsal',184));
      const files=Object.fromEntries(await Promise.all(['documents','uploads','hrkeys'].map(async k=>[k,await inventory(join(root,k))])));
      const dumpPath=join(recovery,'postgresql.custom'),dumpHandle=await open(dumpPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      let dumpSha;
      try{const a=await dumpHandle.stat();need(a.isFile()&&a.uid===process.getuid()&&a.nlink===1&&!(a.mode&0o077)&&a.size>1024,'DUMP');const h=createHash('sha256');for await(const c of dumpHandle.createReadStream({autoClose:false}))h.update(c);need(stable(a,await dumpHandle.stat())&&stable(a,await lstat(dumpPath)),'DUMP_DRIFT');dumpSha=h.digest('hex');}finally{await dumpHandle.close();}
      const verifyPreserved=async()=>{await verify();need(same(old,await captureSuccessorDatabase(sourceDb,'proto_a_01',177)),'RETAINED_DB_DRIFT');for(const k of Object.keys(files))need(same(files[k],await inventory(join(root,k))),'RETAINED_FILE_DRIFT');await verifyM6RecoveryCopy({root:recovery,expected:files,expectedDumpSha:dumpSha,readInventory:inventory});};
      await verifyPreserved();
      const seal=async(name,value)=>{await directory(attempt);const f=await open(join(attempt,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify(value)+'\n');await f.sync();}finally{await f.close();}};
      const {PasswordService}=createRequire(join(app,'apps/api/package.json'))('./dist/auth/password.service.js');
      const result=await writeSuccessorFixture({db,census,authorization,fixture,actors:privateActors.actors,passwordService:new PasswordService(),verifyRuntime:verifyPreserved,observeCoverage,
        sealAttempt:async data=>{await mkdir(attempt,{mode:0o700});await seal('attempt-private.json',{applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,...data});},
        sealCommitted:async data=>{const current=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');await requireNoLiveSessions(tx);return captureFixtureRows(tx);},{isolationLevel:'RepeatableRead',timeout:120000});need(same(data.after,current),'COMMITTED_DELTA_DRIFT');await verifyPreserved();await seal('committed-private.json',{applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,...data});}});
      return {...result,applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,planSha256,retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,recoveryReplayed:false,authenticatedReadbackPerformed:false};
    }finally{await sourceDb.$disconnect();}
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.log(JSON.stringify({status:'M6_SUCCESSOR_FIXTURE_BLOCKED',safeCode:/^M6_[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_FIXTURE_PRIVATE_FAILURE',automaticRetryAllowed:false,mayHaveCommittedFixture:true,sessionsCreated:false,secretsPrinted:false,productionAuthorized:false}));process.exitCode=1;}
}
