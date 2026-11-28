// Exact Event244 remediation, no sessions, recovery, retained writes or replay.
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
import {captureFixtureRows} from './m6-successor-fixture-writer.mjs';
import {captureSuccessorDatabase} from './m6-successor-upgrade-operator.mjs';
import {verifyM6RecoveryCopy} from './m6-recovery-copy.mjs';
import {bindSuccessorRoster} from './m6-successor-roster.mjs';
import {verifyFailedBatchLog,verifyFailedBatchBaseline,planQuantityCorrection,writeQuantityCorrection,permission} from './m6-boq-quantity-correction.mjs';
const planSha256='29dc83568b79bdb7d0b08fbd37bf8b5c8d7b1a4a8cc55549edf3ec2c67a02322';
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error('M6_ADMISSION_'+code),{safeCode:'M6_ADMISSION_'+code});};
const candidate=Object.freeze({sha:'70013b5139292ef33563447f8937c8f132feabd2',tree:'8152b5ac627325c91c36ed65875791966a1a8874',syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false});
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function directory(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'DIRECTORY');}
async function privateJson(path,max=1048576){
  need(await realpath(path)===path,'PRIVATE_PATH');
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=max,'PRIVATE_RECEIPT');
    const b=await f.readFile();try{need(b.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'RECEIPT_DRIFT');return JSON.parse(b.toString('utf8'));}finally{b.fill(0);}
  }finally{await f.close();}
}
async function main(){
  need(process.argv.length===5&&process.argv[2]==='--apply-authorized-quantity-correction'&&/^[a-f0-9]{40}$/.test(process.argv[3]),'EXACT_ARGUMENTS');
  const authority={operatorSha:process.argv[3],application:process.argv[4]};
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_|^NODE_TLS_REJECT_UNAUTHORIZED$/.test(k)),'MAC_REQUIRED');
  const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),app=await realpath(authority.application);
  const id=await readCheckoutIdentity(source),applicationId=await readCheckoutIdentity(app);
  need(id.sha===authority.operatorSha&&id.clean&&applicationId.sha===candidate.sha&&applicationId.tree===candidate.tree&&applicationId.clean&&app!==source,'CHECKOUT');
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
    need(proof.appliedChecksumsMatched===184,'MIGRATIONS');
    const recovery=join(stage,'recovery'),fixtureStage=join(stage,'event237-fixture');
    await directory(fixtureStage);
    const committed=await privateJson(join(fixtureStage,'committed-private.json'),33554432),attempt=await privateJson(join(fixtureStage,'attempt-private.json'));
    need(committed.planSha256===planSha256,'FIXTURE_PLAN');
    const sourceDb=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
    try{
      const readOnly=async(client,database,fn)=>client.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');const a=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");need(a.length===1&&a[0].db===database&&a[0].role==='proto_runtime'&&a[0].ro==='on'&&a[0].isolation==='repeatable read','DATABASE');await requireNoLiveSessions(tx);return fn(tx);},{isolationLevel:'RepeatableRead',timeout:120000});
      const successorRead=fn=>readOnly(db,'m6_successor_rehearsal',fn);
      const retainedRows=await readOnly(sourceDb,'proto_a_01',async tx=>{const tables=(await tx.$queryRawUnsafe("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename")).map(r=>r.tablename);need(tables.length===173&&new Set(tables).size===173&&tables.every(t=>/^[a-z_][a-z0-9_]*$/.test(t)),'RETAINED_TABLES');const rows={};for(const t of tables){const r=await tx.$queryRawUnsafe('SELECT encode(sha256(convert_to(to_jsonb(t)::text,\'UTF8\')),\'hex\') AS hash FROM public."'+t+'" t LIMIT 10001');need(r.length<=10000,'ROW_LIMIT');rows[t]=r.map(x=>x.hash).sort();}return rows;});
      const failedStage=join(stage,'operational-batch'),correctionStage=join(stage,'event245-boq-quantity');await directory(failedStage);
      const failed=await privateJson(join(failedStage,'batch-started-private.json'));
      need(failed.applicationSha===candidate.sha&&failed.applicationTree===candidate.tree&&failed.operatorSha==='e4f61df48a876560dcd8ef46ccaf5c638f4562e6'&&failed.productionAuthorized===false&&failed.automaticRetryAllowed===false,'FAILED_ATTEMPT');
      const absent=async p=>{try{await lstat(p);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}};
      need(await absent(join(failedStage,'batch-ready.json'))&&await absent(correctionStage),'PRIOR_ATTEMPT');
      const logPath=join(failedStage,'api.log');
      const readLog=async()=>{need(await realpath(logPath)===logPath,'LOG_PATH');const f=await open(logPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=16777216,'LOG_FILE');const bytes=await f.readFile();try{need(bytes.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(logPath)),'LOG_DRIFT');return verifyFailedBatchLog(bytes.toString('utf8'));}finally{bytes.fill(0);}}finally{await f.close();}};
      const log=await readLog();
      // Preserve the historical source baseline and all 171 non-auth tables; only
      // the already observed and revoked first-batch auth lifecycle may differ.
      need(Object.keys(retainedRows).filter(t=>t!=='_prisma_migrations').every(t=>same(retainedRows[t],committed.before[t])),'RETAINED_FIXTURE_BASELINE');
      const rawHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')",stableHash="encode(sha256(convert_to((to_jsonb(t)-ARRAY['last_login_at','updated_at']::text[])::text,'UTF8')),'hex')";
      const priorUsers=await readOnly(sourceDb,'proto_a_01',tx=>tx.$queryRawUnsafe('SELECT id::text AS id,'+rawHash+' AS hash,'+stableHash+' AS stable FROM public.users t ORDER BY id'));
      need(priorUsers.length===9&&priorUsers.some(u=>u.id===fixture.adminUserId),'RETAINED_USERS');
      const originalAdminHash=priorUsers.find(u=>u.id===fixture.adminUserId).hash;
      const observePlan=async tx=>{
        await requireNoLiveSessions(tx);
        const users=await tx.user.findMany({take:101,include:{company:true,employee:true,userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}}),projects=await tx.project.findMany({include:{members:true}});
        const binding=bindSuccessorRoster({fixture,original:privateActors.actors,attempt,committed,users,projects});
        need(binding.rosterSha256===failed.rosterSha256&&same(binding.actorIds,failed.actorIds),'FAILED_ROSTER');
        const now=await tx.$queryRawUnsafe('SELECT id::text AS id,'+rawHash+' AS hash,'+stableHash+' AS stable FROM public.users t ORDER BY id');
        need(priorUsers.every(u=>now.some(v=>v.id===u.id&&v.stable===u.stable)),'USER_STABLE_DRIFT');
        for(const [k,a] of Object.entries(attempt.actors)){const u=users.find(u=>u.id===a.userId);need(u?.passwordHash===a.passwordHash&&u.displayName==='Synthetic M6 '+k&&u.lastLoginAt instanceof Date,'NEW_USER_DRIFT');}
        const current=await captureFixtureRows(tx),sessionRows=await tx.$queryRawUnsafe('SELECT user_id::text AS actor,(revoked_at IS NOT NULL) AS revoked,'+rawHash+' AS hash FROM public.user_sessions t');
        verifyFailedBatchBaseline({committed,current,sessionRows,actorIds:binding.actorIds,adminHash:now.find(u=>u.id===fixture.adminUserId)?.hash,originalAdminHash});
        const permissionRow=await tx.permission.findUnique({where:{permissionCode:permission}});
        const plan=planQuantityCorrection({binding,original:privateActors.actors,fixture,users,projects,permissionRow});return {plan,current};
      };
      const {plan,current}=await successorRead(observePlan);
      const old=await captureSuccessorDatabase(sourceDb,'proto_a_01',177),files=Object.fromEntries(await Promise.all(['documents','uploads','hrkeys'].map(async k=>[k,await inventory(join(root,k))])));
      const dumpPath=join(recovery,'postgresql.custom'),dumpHandle=await open(dumpPath,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);let dumpSha;
      try{const a=await dumpHandle.stat();need(a.isFile()&&a.uid===process.getuid()&&a.nlink===1&&!(a.mode&0o077)&&a.size>1024,'DUMP');const h=createHash('sha256');for await(const c of dumpHandle.createReadStream({autoClose:false}))h.update(c);need(stable(a,await dumpHandle.stat())&&stable(a,await lstat(dumpPath)),'DUMP_DRIFT');dumpSha=h.digest('hex');}finally{await dumpHandle.close();}
      const verifyPreserved=async()=>{await verify();need(same(old,await captureSuccessorDatabase(sourceDb,'proto_a_01',177))&&same(log,await readLog()),'RETAINED_OR_LOG_DRIFT');for(const k of Object.keys(files))need(same(files[k],await inventory(join(root,k)))&&same(files[k],await inventory(join(failedStage,k))),'FILE_DRIFT');await verifyM6RecoveryCopy({root:recovery,expected:files,expectedDumpSha:dumpSha,readInventory:inventory});};
      await verifyPreserved();
      const seal=async(name,value)=>{await directory(correctionStage);const f=await open(join(correctionStage,name),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify({applicationSha:candidate.sha,applicationTree:candidate.tree,operatorSha:id.sha,failedOperatorSha:failed.operatorSha,fixturePlanSha256:planSha256,log,...value})+'\n');await f.sync();}finally{await f.close();}};
      const result=await writeQuantityCorrection({db,authorization:{database:'m6_successor_rehearsal',ownerAuthorizedQuantityCorrection:true,retainedMutationAuthorized:false,productionAuthorized:false},expectedBefore:current,plan,fixture,capture:captureFixtureRows,verifyRuntime:verifyPreserved,observePlan:async tx=>(await observePlan(tx)).plan,
        sealAttempt:async data=>{await mkdir(correctionStage,{mode:0o700});await seal('attempt-private.json',data);},sealCommitted:async data=>{need(same(data.after,await successorRead(captureFixtureRows)),'POST_COMMIT_DRIFT');await verifyPreserved();await seal('committed-private.json',{...data,plan});}});
      return {...result,applicationSha:candidate.sha,operatorSha:id.sha,firstBatchRevokedSessions:11,priorReadbacksPreserved:13,retainedDatabaseAndFilesUnchanged:true,recoveryCopyUnchanged:true,automaticRetryAllowed:false,milestone6Accepted:false,secretsPrinted:false};
    }finally{await sourceDb.$disconnect();}
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
 try{console.log(JSON.stringify(await main(),null,2));}catch(e){console.log(JSON.stringify({status:'M6_SUCCESSOR_BOQ_QUANTITY_CORRECTION_BLOCKED',safeCode:/^M6_[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'M6_BOQ_FIX_PRIVATE_FAILURE',automaticRetryAllowed:false,mayHaveCommittedCorrection:true,sessionsCreated:false,secretsPrinted:false,productionAuthorized:false,milestone6Accepted:false}));process.exitCode=1;}
}
