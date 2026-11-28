// Read-only admission for the sealed 70013b51 rehearsal. No launch, login,
// migration, grant mutation, database creation or replacement of the recovery.
import {constants} from 'node:fs';
import {open,lstat,realpath} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {inspectPostM4,readCheckoutIdentity} from './m6-post-m4-inspect.mjs';
import {validConfig,validContainer,SOURCE} from './prototype-actors.mjs';
import {validPrivateActors,validActorReceipt} from './prototype-browser-operator.mjs';
import {loadM4ProcessReceipts,createMacObservation} from './m6-mac-observation.mjs';
import {verifyRuntimePair} from './m6-runtime-evidence.mjs';
import {verifyCommonCandidate} from './m6-common-successor.mjs';
import {migrationSources} from './m6-historical-backup.mjs';
import {readSuccessorSources,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {assessSuccessorRoleCoverage} from './m6-successor-role-coverage.mjs';
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
  need(process.argv.length===5&&process.argv[2]==='--inspect-role-coverage'&&/^[a-f0-9]{40}$/.test(process.argv[3]),'EXACT_ARGUMENTS');
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
    const result=await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const ids=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
      need(ids.length===1&&ids[0].db==='m6_successor_rehearsal'&&ids[0].role==='proto_runtime'&&ids[0].ro==='on'&&ids[0].isolation==='repeatable read','DATABASE');
      await requireNoLiveSessions(tx);
      const companies=await tx.company.findMany({select:{id:true,companyCode:true,isActive:true}});
      need(companies.length===2&&[[fixture.companyId,'PROTO_A'],[fixture.foreignCompanyId,'PROTO_B']].every(([id,code])=>companies.some(c=>c.id===id&&c.companyCode===code&&c.isActive)),'COMPANIES');
      const users=await tx.user.findMany({take:101,select:{id:true,employeeId:true,email:true,companyId:true,isActive:true,company:{select:{isActive:true}},employee:{select:{id:true,companyId:true,isActive:true}},userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
      const projects=await tx.project.findMany({where:{companyId:fixture.companyId,isActive:true},include:{members:true}});
      need(projects.length===2&&[[fixture.projectId,'SITE_A'],[fixture.unassignedProjectId,'SITE_B']].every(([id,code])=>projects.some(p=>p.id===id&&p.projectCode===code)),'PROJECTS');
      const workflow=await tx.approvalWorkflow.findUnique({where:{companyId_workflowCode:{companyId:fixture.companyId,workflowCode:'SS16_MOVEMENT_CORRECTION'}},include:{steps:{include:{stepRoles:true}}}});
      return assessSuccessorRoleCoverage({actors:privateActors.actors,companyId:fixture.companyId,foreignCompanyId:fixture.foreignCompanyId,projectId:fixture.projectId,users,projects,workflow});
    },{isolationLevel:'RepeatableRead',timeout:30000});
    await verify();
    return {...result,applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,appliedChecksumsMatched:proof.appliedChecksumsMatched,zeroActiveSessionsObserved:true,ss16ProjectsObserved:2,coverageOnly:true,sealedReceiptMatched:true,retainedRuntimeIdentityChecked:true,recoveryReplayed:false,secretsPrinted:false};
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
  try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.log(JSON.stringify({status:'M6_SUCCESSOR_ROLE_COVERAGE_BLOCKED',safeCode:/^M6_[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_ADMISSION_PRIVATE_FAILURE',mayMutate:false,secretsPrinted:false,productionAuthorized:false}));process.exitCode=1;}
}
