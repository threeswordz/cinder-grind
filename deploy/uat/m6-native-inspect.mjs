// Read-only native admission; never establishes a new historical baseline or permits writes.
import {constants} from 'node:fs';
import {requireNoLiveSessions} from './m6-read-only-sessions.mjs';
import {observeStage,safeFailure} from './m6-native-diagnostics.mjs';
import {lstat,open,realpath,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=/^[a-f0-9]{40}$/;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const stable=(a,b)=>['dev','ino','size','mtimeMs','ctimeMs','mode','uid','nlink'].every(k=>a[k]===b[k]);
async function privateDir(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_NATIVE_PRIVATE_DIRECTORY_INVALID');}
async function readPrivate(path,max=1048576){
  const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try{const s=await f.stat();need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size>0&&s.size<=max,'M6_NATIVE_PRIVATE_FILE_INVALID');
    const b=await f.readFile();need(b.length===s.size&&stable(s,await f.stat())&&stable(s,await lstat(path)),'M6_NATIVE_PRIVATE_FILE_DRIFT');return JSON.parse(b.toString('utf8'));
  }finally{await f.close();}
}
// Only filenames and shape counts, never receipt values, rows, hashes or HR keys.
export async function discoverBaselineFiles(root){
  const stage=join(root,'m4-upgrade-9417f07c');await privateDir(root);await privateDir(stage);
  const files=[];
  for(const dir of ['', 'backup','rehearsal','cutover','role-readback']){
    const path=join(stage,dir);try{await privateDir(path);}catch(e){if(e.code==='ENOENT')continue;throw e;}
    for(const name of (await readdir(path)).sort()){
      if(!/^[a-z0-9-]{1,100}\.json$/.test(name)||!/(baseline|snapshot|inventory|inventories|fingerprint|artifact|migration|ready|owned|preservation)/.test(name))continue;
      const file=join(path,name),s=await lstat(file);need(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077),'M6_NATIVE_SCHEMA_FILE_INVALID');
      let shape='unread-size-limit',fields=[];
      if(s.size>0&&s.size<=33554432){const v=await readPrivate(file,33554432);shape=Array.isArray(v)?'array':v&&typeof v==='object'?'object':typeof v;
        const obj=Array.isArray(v)?v[0]:v;
        if(obj&&typeof obj==='object'&&!Array.isArray(obj))fields=Object.keys(obj).filter(k=>/^[a-zA-Z_][a-zA-Z0-9_]{0,79}$/.test(k)).sort().slice(0,250);
      }
      files.push({path:dir?dir+'/'+name:name,shape,fields});need(files.length<=100,'M6_NATIVE_SCHEMA_LIMIT');
    }
  }
  return files;
}
export async function readAdmissionDatabase(db){
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const id=await tx.$queryRawUnsafe("SELECT current_database() AS db,current_user AS role,current_setting('transaction_read_only') AS ro,current_setting('transaction_isolation') AS isolation");
    need(id.length===1&&id[0].db==='proto_a_01'&&id[0].role==='proto_runtime'&&id[0].ro==='on'&&id[0].isolation==='repeatable read','M6_NATIVE_DB_IDENTITY_INVALID');
    await requireNoLiveSessions(tx);
    const rows=await tx.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM public._prisma_migrations ORDER BY migration_name');
    need(rows.length===177&&new Set(rows.map(r=>r.migration_name)).size===177&&rows.every(r=>typeof r.migration_name==='string'&&/^[a-f0-9]{64}$/.test(r.checksum)&&r.finished_at&&!r.rolled_back_at),'M6_NATIVE_MIGRATION_LEDGER_INVALID');
    return rows.map(r=>[r.migration_name,r.checksum,String(r.finished_at)]);
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
export async function inspectAdmission({observeRuntime,verifyRuntime,db,readInventory,root,application}){
  verifyRuntime(await observeRuntime());
  const capture=async()=>{const ledger=await readAdmissionDatabase(db),files={};
    for(const k of ['documents','uploads','hrkeys'])files[k]=await readInventory(join(root,k));
    for(const k of ['api','web'])files[k]=await readInventory(join(application,'apps',k,'dist'),{privateRoot:false});
    return {ledger,files};};
  const before=await capture(),after=await capture();need(same(before,after),'M6_NATIVE_OBSERVATION_DRIFT');
  verifyRuntime(await observeRuntime());
  return {status:'M6_NATIVE_READ_ONLY_ADMISSION_CHECKS_PASS',processChecksPassed:true,zeroActiveSessionsObserved:true,migrationRowsObserved:177,currentInventoryStableAcrossTwoCaptures:true,historicalBaselineVerified:false,milestone6Accepted:false,mayMutate:false,productionAuthorized:false};
}
async function main(){
  need(((process.argv.length===4&&['--inspect-runtime','--inspect-schema','--inspect-preservation','--inspect-rows','--inspect-auth-history','--inspect-retained-cd'].includes(process.argv[2]))||(process.argv.length===5&&['--inspect-integrated','--inspect-artifacts'].includes(process.argv[2])))&&sha.test(process.argv[3]),'M6_NATIVE_PINNED_INSPECTION_REQUIRED');
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0'&&!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),'M6_NATIVE_EXACT_MAC_REQUIRED');
  const {readCheckoutIdentity,inspectPostM4}=await import('./m6-post-m4-inspect.mjs');
  const source=resolve(fileURLToPath(new URL('../../',import.meta.url))),identity=await readCheckoutIdentity(source);
  need(identity.sha===process.argv[3]&&identity.clean,'M6_NATIVE_SOURCE_NOT_EXACT');
  const root=join(homedir(),'Construction-ERP-Prototype-Runtime');
  if(process.argv[2]==='--inspect-schema')return {status:'M6_NATIVE_BASELINE_SCHEMA_DISCOVERED',inspectorSha:identity.sha,files:await discoverBaselineFiles(root),historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false};
  await inspectPostM4(root);
  const application=join(root,'m4-upgrade-9417f07c','rehearsal','application');
  const {loadM4ProcessReceipts,createMacObservation}=await import('./m6-mac-observation.mjs');
  const {validConfig,validContainer}=await import('./prototype-actors.mjs');
  const {verifyRuntimePair,inventory}=await import('./m6-runtime-evidence.mjs');
  const cfg=await readPrivate(join(root,'runtime-private.json')),containerReceipt=await readPrivate(join(root,'container-owned.json'));
  need(validConfig(cfg),'M6_NATIVE_CONFIG_INVALID');
  const expected=await loadM4ProcessReceipts(root,application),observeRuntime=createMacObservation({root,application,expected,containerReceipt,validContainer});
  const verifyRuntime=current=>verifyRuntimePair(expected,current,application,process.execPath,process.getuid());
  // Verify container/process identity before opening a database connection.
  verifyRuntime(await observeRuntime());
  const {PrismaClient}=createRequire(join(application,'apps/api/package.json'))('@prisma/client');
  const url='postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/proto_a_01?schema=public';
  const db=new PrismaClient({datasources:{db:{url}},log:[]});
  try{
    if(process.argv[2]==='--inspect-retained-cd'){
      const {observeRetainedCD}=await import('./m6-retained-cd-integrity.mjs');
      const before=await readAdmissionDatabase(db);
      const result=await observeRetainedCD(db);
      need(same(before,await readAdmissionDatabase(db)),'M6_CD_MIGRATION_OBSERVATION_DRIFT');
      verifyRuntime(await observeRuntime());
      if(result.status!=='M6_CD_RETAINED_INTEGRITY_OBSERVED')process.exitCode=1;
      return {...result,inspectorSha:identity.sha};
    }
    if(process.argv[2]==='--inspect-auth-history'){
      const {execFile}=await import('node:child_process');
      const {promisify}=await import('node:util');
      const {snapshotSql,compareAuthHistory}=await import('./m6-auth-history.mjs');
      const {verifyBackupReceipts}=await import('./m6-backup-receipts.mjs');
      const stage=join(root,'m4-upgrade-9417f07c');
      const baseline=await readPrivate(join(stage,'database-baseline-private.json'),33554432);
      const receipt=await readPrivate(join(stage,'backup-ready.json'));
      const rehearsal=await readPrivate(join(stage,'rehearsal','rehearsal-ready.json'));
      verifyBackupReceipts(receipt,rehearsal);
      const env=Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'].filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
      const run=async(args,code)=>{try{return (await promisify(execFile)('podman',args,{cwd:application,env,timeout:30000,maxBuffer:8388608})).stdout.trim();}catch{throw Object.assign(new Error(code),{safeCode:code});}};
      const originalName='construction-erp-m4-rehearsal-9417f07c';
      const observed=JSON.parse(await run(['inspect',originalName],'M6_AUTH_REHEARSAL_UNAVAILABLE'));
      need(Array.isArray(observed)&&observed.length===1&&observed[0].Name.replace(/^\//,'')===originalName&&/^[a-f0-9]{64}$/.test(observed[0].Id??'')&&observed[0].Id!==containerReceipt.id&&observed[0].State?.Running===true,'M6_AUTH_REHEARSAL_UNAVAILABLE');
      const original=JSON.parse(await run(['exec',observed[0].Id,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','proto_runtime','-d','m4_rehearsal_9417f07c','-c','BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY; '+snapshotSql+'; COMMIT;'],'M6_AUTH_REHEARSAL_QUERY_FAILED'));
      const current=await db.$transaction(async tx=>{
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await requireNoLiveSessions(tx);
        const rows=await tx.$queryRawUnsafe(snapshotSql);
        need(Array.isArray(rows)&&rows.length===1&&typeof rows[0]?.payload==='string','M6_AUTH_CURRENT_SNAPSHOT_INVALID');
        return JSON.parse(rows[0].payload);
      },{isolationLevel:'RepeatableRead',timeout:30000});
      const result=compareAuthHistory({baseline,original,current,capturedAt:receipt.createdAt});
      verifyRuntime(await observeRuntime());
      return {...result,historicalBaselineVerified:false,productionAuthorized:false,inspectorSha:identity.sha};
    }
    if(process.argv[2]==='--inspect-artifacts'){
      const {inspectCompiledRebuild}=await import('./m6-integrated-evidence.mjs');
      const before=await readAdmissionDatabase(db);
      const artifacts=await inspectCompiledRebuild({application,rebuild:process.argv[4],root,readCheckout:readCheckoutIdentity,readInventory:inventory});
      need(same(before,await readAdmissionDatabase(db)),'M6_ARTIFACT_MIGRATION_OBSERVATION_DRIFT');
      verifyRuntime(await observeRuntime());
      return {status:'M6_COMPILED_REBUILD_OBSERVATIONS_COMPLETE',...artifacts,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false,inspectorSha:identity.sha};
    }
    if(['--inspect-rows','--inspect-integrated'].includes(process.argv[2])){
      const stage=join(root,'m4-upgrade-9417f07c');
      const baseline=await readPrivate(join(stage,'database-baseline-private.json'),33554432);
      const plan=await readPrivate(join(stage,'rehearsal','migration-plan-private.json'),33554432);
      const {verifyMigrationChecksums,migrationSources}=await import('./m6-historical-backup.mjs');
      const {readHistoricalRowEvidence,inspectCompiledRebuild}=await import('./m6-integrated-evidence.mjs');
      const before=await readAdmissionDatabase(db);
      verifyMigrationChecksums(plan,before,await migrationSources(application));
      const historicalRows=await observeStage('M6_HISTORICAL_ROWS',()=>readHistoricalRowEvidence({db,baseline,oldMigrationNames:plan.oldLedger.map(r=>r.migration_name),requireNoLiveSessions}));
      const lanes=[];
      for(const [key,observe] of [['A',(await import('./m6-lane-a-observe.mjs')).observeLane],['B',(await import('./m6-lane-b-observe.mjs')).observeLane],['C',(await import('./m6-lane-c-observe.mjs')).observeLane],['D',(await import('./m6-lane-d-observe.mjs')).observeLane]]){
        lanes.push(await observeStage('M6_LANE_'+key,()=>observe(db)));
      }
      const artifacts=process.argv[2]==='--inspect-integrated'
        ?await observeStage('M6_COMPILED_REBUILD',()=>inspectCompiledRebuild({application,rebuild:process.argv[4],root,readCheckout:readCheckoutIdentity,readInventory:inventory}))
        :{stage:'M6_COMPILED_REBUILD',status:'NOT_RUN'};
      need(same(before,await readAdmissionDatabase(db)),'M6_HISTORICAL_MIGRATION_OBSERVATION_DRIFT');
      verifyRuntime(await observeRuntime());
      const blocked=[historicalRows,...lanes,artifacts].some(x=>x.status==='BLOCKED');
      if(blocked)process.exitCode=1;
      return {status:blocked?'M6_HISTORICAL_OBSERVATIONS_PARTIAL':'M6_HISTORICAL_ROW_AND_ARTIFACT_OBSERVATIONS_COMPLETE',historicalRows,artifacts,lanes,historicalDatabaseRowsVerified:historicalRows.result?.historicalDatabaseRowsVerified===true,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false,inspectorSha:identity.sha};
    }
    if(process.argv[2]==='--inspect-preservation'){
      const {verifyMigrationChecksums,migrationSources,verifyProtectedBackup}=await import('./m6-historical-backup.mjs');
      const stage=join(root,'m4-upgrade-9417f07c');
      const receipt=await readPrivate(join(stage,'backup-ready.json'));
      const rehearsal=await readPrivate(join(stage,'rehearsal','rehearsal-ready.json'));
      const baseline=await readPrivate(join(stage,'file-baseline-private.json'),33554432);
      const plan=await readPrivate(join(stage,'rehearsal','migration-plan-private.json'),33554432);
      const before=await readAdmissionDatabase(db),sources=await migrationSources(application);
      const migration=verifyMigrationChecksums(plan,before,sources);
      const backup=await verifyProtectedBackup({root,stage,receipt,rehearsal,baseline,readInventory:inventory});
      need(same(before,await readAdmissionDatabase(db)),'M6_HISTORICAL_MIGRATION_OBSERVATION_DRIFT');
      verifyRuntime(await observeRuntime());
      return {status:'M6_HISTORICAL_BACKUP_CHECKS_PASS',...migration,...backup,historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false,inspectorSha:identity.sha};
    }
    return {...await inspectAdmission({observeRuntime,verifyRuntime,db,readInventory:inventory,root,application}),inspectorSha:identity.sha};
  }finally{await db.$disconnect();}
}
if(process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null)===await realpath(new URL(import.meta.url))){
  try{console.log(JSON.stringify(await main()));}catch(e){console.log(JSON.stringify({status:'M6_NATIVE_INSPECTION_BLOCKED',...safeFailure(e),historicalBaselineVerified:false,mayMutate:false,productionAuthorized:false}));process.exitCode=1;}
}
