// Concrete M6 original-Mac populated upgrade; no previous business journeys rerun.
// No import side effects, CI triggers, or production/system wide operations.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {readFile,readdir,lstat,realpath,mkdir,cp,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {SOURCE,API,WEB,validConfig,validContainer,validReady} from './prototype-actors.mjs';
import {validCompletedUomReceipt} from './prototype-m6-finance-configuration.mjs';
import {uomSnapshot,digest} from './prototype-uom-state.mjs';
import {privateInventory,privateJson,seal,fileHash,stage,databaseStream,freePort,environment,command,hasSoleListenerPid,verifyDocumentInventory} from './prototype-transfer-upgrade.mjs';
import {validActorReceipt,validPrivateActors} from './prototype-browser-operator.mjs';
const ORIGIN='https://github.com/threeswordz/cinder-grind.git';
const PREVIOUS_APP='9fa0506e9a50fd556f1c4404e4db2e3d88093b85',REHEARSAL='proto_a_01_m6_rehearsal';
const sha=/^[a-f0-9]{40}$/;
const fail=c=>{throw Object.assign(new Error(c),{safeCode:c});};
const need=(b,c)=>{if(!b)fail(c);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function privateDir(path){const s=await lstat(path);need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o077)&&await realpath(path)===path,'M6_PRIVATE_DIRECTORY_DRIFT');}
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function boundedJSON(path,max=33554432){const s=await lstat(path);need(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&s.nlink===1&&!(s.mode&0o077)&&s.size<=max,'M6_PRIVATE_FILE_UNSAFE');return JSON.parse(await readFile(path,'utf8'));}
export function exactRowsPreserved(before,after){
 need(before&&after&&Object.keys(before).every(t=>Array.isArray(after[t])),'M6_PRESERVED_TABLE_REMOVED');
 for(const [table,rows] of Object.entries(before)){
   const available=new Map(),oldCols=Object.keys(rows[0]??{}).filter(x=>x!=='__fm03_exact_row_json');
   for(const item of after[table]){
     const projection=Object.fromEntries(oldCols.map(k=>[k,item[k]]));
     const k=digest(projection);available.set(k,(available.get(k)??0)+1);
   }
   for(const item of rows){const old={...item};delete old.__fm03_exact_row_json;const k=digest(old);
     need((available.get(k)??0)>0,'M6_HISTORIC_ROW_CHANGED_'+table.toUpperCase());available.set(k,available.get(k)-1);}
 }
 return true;
}
export function originalInventoryPreserved(before,after,allowedNew=[]){
 const prior=new Map(before.map(x=>[x[0],x])),current=new Map(after.map(x=>[x[0],x]));
 need(prior.size===before.length&&current.size===after.length,'M6_DUPLICATE_STORAGE_PATH');
 for(const [name,row] of prior)need(digest(row)===digest(current.get(name)),'M6_PREVIOUS_PROTECTED_FILE_CHANGED');
 for(const row of after.filter(x=>!prior.has(x[0])))need(allowedNew.includes(row[0])||
   row[1]==='directory'&&allowedNew.some(x=>x.startsWith(row[0]+'/')),'M6_UNEXPLAINED_PROTECTED_FILE');
 return true;
}
// Exact forward-only migrations: historical SQL and ledger rows stay intact.
export function verifyM6MigrationLedger(previous,current,previousSources,releaseSources){
 need(Array.isArray(previous)&&Array.isArray(current)&&Array.isArray(previousSources)&&Array.isArray(releaseSources),
   'M6_MIGRATION_LEDGER_INPUT_INVALID');
 const unique=rows=>new Set(rows.map(x=>x.name)).size===rows.length;
 need(unique(previousSources)&&unique(releaseSources)&&
   previousSources.every(x=>releaseSources.some(y=>x.name===y.name&&x.checksum===y.checksum)),
   'M6_PREDECESSOR_MIGRATION_FILE_DRIFT');
 const matched=(rows,sources)=>rows.length===sources.length&&rows.every((x,i)=>
   x.migration_name===sources[i].name&&x.checksum===sources[i].checksum&&
   x.finished_at&&!x.rolled_back_at);
 need(matched(previous,previousSources)&&matched(current,releaseSources),
   'M6_MIGRATION_LEDGER_NOT_EXACT');
 for(const old of previous)need(current.some(x=>x.migration_name===old.migration_name&&
   x.checksum===old.checksum&&String(x.finished_at)===String(old.finished_at)&&
   !x.rolled_back_at),'M6_HISTORIC_MIGRATION_CHANGED');
 return {newMigrationCount:current.length-previous.length,forwardOnly:true};
}
async function migrationFiles(repo){
 const dir=join(repo,'apps/api/prisma/migrations');
 const folders=(await readdir(dir,{withFileTypes:true})).filter(e=>e.isDirectory()).map(e=>e.name).sort();
 return Promise.all(folders.map(async name=>({name,checksum:hash(await readFile(join(dir,name,'migration.sql')))})));
}
async function migrationLedger(db){
 return db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
}
const env=()=>environment();
async function health(){const r=await fetch(API+'/health/ready',{redirect:'error',signal:AbortSignal.timeout(4000)});need(r.ok,'M6_HEALTH_HTTP_ERROR');return r.json();}
async function procIdentity(entry,old,repo){
 const p=await privateJson(entry),expected=join(old,p.port===33071?'apps/api/dist/main.js':'deploy/uat/serve-web.mjs');
 need(p.applicationSha===PREVIOUS_APP&&p.entry===expected&&p.databaseName==='proto_a_01'&&
  Number.isSafeInteger(p.pid)&&p.pid>1&&[33071,44171].includes(p.port),'M6_PREVIOUS_PROCESS_RECEIPT_INVALID');
 need(await command('/bin/ps',['-ww','-p',String(p.pid),'-o','command='],repo)===process.execPath+' '+expected&&
  await command('/bin/ps',['-p',String(p.pid),'-o','uid='],repo)===String(process.getuid())&&
  await command('/bin/ps',['-p',String(p.pid),'-o','lstart='],repo)===p.born,'M6_PREVIOUS_PROCESS_DRIFT');
 need(hasSoleListenerPid(await command('lsof',['-nP','-iTCP:'+p.port,'-sTCP:LISTEN','-Fpf'],repo),p.pid),
  'M6_PREVIOUS_LISTENER_CHANGED');return p;
}
export function createM6MacRuntime({releaseSha,sourceRoot,root=join(homedir(),'Construction-ERP-Prototype-Runtime')}={}){
 need(sha.test(releaseSha??'')&&typeof sourceRoot==='string'&&resolve(sourceRoot)===sourceRoot&&resolve(root)===root,'M6_MAC_RUNTIME_INPUT_INVALID');
 const prior=join(root,'uom-upgrade'),old=join(prior,'application'),newStage=join(root,'m6-upgrade'),app=join(newStage,'application');
 const snapshots={};let cfg,container,receipt,actorBinding,db,client,processes=[],encryptedDocumentKey=null;
 const url=(name='proto_a_01')=>'postgresql://proto_runtime:'+encodeURIComponent(cfg.databasePassword)+'@127.0.0.1:55471/'+name+'?schema=public';
 const database=name=>new client({datasources:{db:{url:url(name)}},log:[]});
 const runtimeEnv=async(name='proto_a_01',store=root)=>({...env(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33071',WEB_ORIGIN:WEB,DATABASE_URL:url(name),
  STORAGE_ROOT:join(store,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(store,'uploads'),
  HR_PRIVATE_KEYS:JSON.stringify(await boundedJSON(join(store,'hrkeys/keyring.json'),1048576)),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'});
 async function load(){
  cfg=await privateJson(join(root,'runtime-private.json'));container=await privateJson(join(root,'container-owned.json'));
  receipt=await privateJson(join(prior,'ready.json'));
  const ready=await privateJson(join(root,'runtime-ready.json'));
  const actors=await privateJson(join(root,'actors-private.json'));
  const fixture=await privateJson(join(root,'actors-fixture-private.json'));
  const configuration=await privateJson(join(root,'material-configuration-private.json'));
  need(validConfig(cfg)&&validReady(ready)&&ready.imageId===container.image&&validCompletedUomReceipt(receipt)&&
   validPrivateActors(actors)&&validActorReceipt(await privateJson(join(root,'actors-ready.json'))),'M6_PREVIOUS_MAC_RECEIPTS_MISSING');
  actorBinding={sourceSha:SOURCE,actors:actors.actors,fixture,configuration};return actorBinding;
 }
 async function identity(){
  await privateDir(root);await privateDir(prior);for(const key of ['documents','uploads','hrkeys','db'])await privateDir(join(root,key));
  need(await command('git',['rev-parse','HEAD'],old)===PREVIOUS_APP&&await command('git',['status','--porcelain'],old)==='',
   'M6_COMPLETED_UOM_APP_CHANGED');
  const pod=JSON.parse(await command('podman',['inspect',container.id],sourceRoot));
  need(pod.length===1&&validContainer(pod[0],container,join(root,'db')),'M6_POSTGRES_OWNERSHIP_UNVERIFIED');
  const api=await procIdentity(join(prior,'source-api-owned.json'),old,sourceRoot);
  const web=await procIdentity(join(prior,'source-web-owned.json'),old,sourceRoot);
  need(api.port===33071&&web.port===44171,'M6_PREVIOUS_PORTS_INVALID');
  const h=await health();need(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok','M6_OLD_RUNTIME_NOT_HEALTHY');return {api,web};
 }
 async function connected(){if(!client){const require=createRequire(join(old,'apps/api/package.json'));client=require('@prisma/client').PrismaClient;}return database('proto_a_01');}
 async function verifySnapshot(){const live=await connected();try{
  const priorSnapshot=await boundedJSON(join(prior,'source-database-after-private.json'));
  const snapshot=await live.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
   need(await tx.userSession.count({where:{revokedAt:null}})===0,'M6_PREVIOUS_ACTIVE_SESSIONS');return uomSnapshot(tx);
  },{isolationLevel:'RepeatableRead',timeout:30000});
  need(digest(snapshot)===digest(priorSnapshot),'M6_PREVIOUS_DB_CHANGED');return snapshot;
 }finally{await live.$disconnect();}}
 async function inspected(){
  need(process.platform==='darwin'&&process.getuid()>0&&process.versions.node==='24.21.0','M6_EXACT_NONROOT_MAC_NODE_REQUIRED');
  need(await absent(newStage),'M6_ALREADY_STARTED_NO_REPLAY');
  // Inspection cannot silently attest a different local source checkout.
  need(await command('git',['rev-parse','HEAD'],sourceRoot)===releaseSha&&
    await command('git',['status','--porcelain'],sourceRoot)==='',
    'M6_READ_ONLY_INSPECTION_SOURCE_NOT_PINNED');
  await load();await identity();snapshots.before=await verifySnapshot();
  snapshots.files={};for(const kind of ['documents','uploads','hrkeys'])snapshots.files[kind]=await privateInventory(join(root,kind));
  return {sourceSha:PREVIOUS_APP,releaseSha,snapshotDigestMatched:true,historicalReceiptsPreserved:true,runtimeOwned:true};
 }
 async function upgrade({authority}){
  need(authority.releaseSha===releaseSha,'M6_UPGRADE_RELEASE_DRIFT');
  await privateDir(newStage);await mkdir(join(newStage,'logs'),{mode:0o700});
  await mkdir(join(newStage,'preserved'),{mode:0o700});
  for(const kind of ['documents','uploads','hrkeys']){
    await cp(join(root,kind),join(newStage,'preserved',kind),{recursive:true,force:false,errorOnExist:true});
    need(digest(await privateInventory(join(newStage,'preserved',kind)))===digest(snapshots.files[kind]),
      'M6_PRESERVATION_COPY_CHANGED');
  }
  await seal(join(newStage,'original-snapshot-private.json'),snapshots.before);
  await seal(join(newStage,'original-inventory-private.json'),snapshots.files);
  const dump=join(newStage,'preserved','postgresql.custom');
  await databaseStream(container.id,['pg_dump','-U','proto_runtime','-d','proto_a_01','--format=custom','--no-owner','--no-acl'],sourceRoot,dump);
  need((await lstat(dump)).size>1024,'M6_MISSING_POPULATED_DUMP');snapshots.dumpSha=await fileHash(dump);
  await seal(join(newStage,'dump-sha-private.json'),{sha256:snapshots.dumpSha,releaseSha});
  await stage(newStage,'CLONE','git',['clone','--no-checkout',ORIGIN,app],newStage);
  await stage(newStage,'PIN','git',['checkout','--detach',releaseSha],app);
  need(await command('git',['rev-parse','HEAD'],app)===releaseSha&&await command('git',['status','--porcelain'],app)==='',
   'M6_BUILD_SOURCE_NOT_PINNED');
  await stage(newStage,'INSTALL','pnpm',['install','--frozen-lockfile'],app);
  await stage(newStage,'GENERATE','pnpm',['prisma:generate'],app);
  await stage(newStage,'BUILD','pnpm',['build'],app,{...env(),NODE_ENV:'production',VITE_API_BASE_URL:API});
  const require=createRequire(join(app,'apps/api/package.json'));client=require('@prisma/client').PrismaClient;
  need(await command('podman',['exec',container.id,'psql','--no-psqlrc','-U','proto_runtime','-d','proto_a_01','-At','-c',
   "SELECT count(*) FROM pg_database WHERE datname='"+REHEARSAL+"'"],sourceRoot)==='0','M6_REHEARSAL_DB_ALREADY_EXISTS');
  await command('podman',['exec',container.id,'createdb','-U','proto_runtime','--owner=proto_runtime','--template=template0',REHEARSAL],sourceRoot);
  await databaseStream(container.id,['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','proto_runtime','-d',REHEARSAL],sourceRoot,dump,true);
  let rehearsal=database(REHEARSAL);
  try{const before=await rehearsal.$transaction(tx=>uomSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
   need(digest(before)===digest(snapshots.before),'M6_REHEARSAL_RESTORE_NOT_IDENTICAL');
  }finally{await rehearsal.$disconnect();}
  const previousSources=await migrationFiles(old),releaseSources=await migrationFiles(app);
  let oldDb=await connected();
  try{snapshots.priorLedger=await migrationLedger(oldDb);
   verifyM6MigrationLedger(snapshots.priorLedger,snapshots.priorLedger,previousSources,previousSources);
  }finally{await oldDb.$disconnect();}
  await stage(newStage,'REHEARSAL_MIGRATION','pnpm',['prisma:migrate:deploy'],app,await runtimeEnv(REHEARSAL,join(newStage,'preserved')));
  rehearsal=database(REHEARSAL);
  try{const after=await rehearsal.$transaction(tx=>uomSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
   exactRowsPreserved(snapshots.before,after);
   verifyM6MigrationLedger(snapshots.priorLedger,await migrationLedger(rehearsal),previousSources,releaseSources);
  }finally{await rehearsal.$disconnect();}
  // Never replay the already completed UOM/receiving/subcontract business operators.
  await identity();const beforeDrain=await verifySnapshot();
  need(digest(beforeDrain)===digest(snapshots.before),'M6_DRIFT_BEFORE_CUTOVER');
  const oldApi=await procIdentity(join(prior,'source-api-owned.json'),old,sourceRoot),
   oldWeb=await procIdentity(join(prior,'source-web-owned.json'),old,sourceRoot);
  for(const p of [oldWeb,oldApi]){
    process.kill(p.pid,'SIGTERM');let exited=false;
    for(let i=0;i<60;i++){try{process.kill(p.pid,0);}catch(e){if(e.code==='ESRCH'){exited=true;break;}throw e;}await sleep(500);}
    need(exited,'M6_OLD_PROCESS_NOT_STOPPED');
  }
  await freePort(33071,sourceRoot);await freePort(44171,sourceRoot);
  db=database('proto_a_01');
  const drained=await db.$transaction(async tx=>{await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');return uomSnapshot(tx);},
   {isolationLevel:'RepeatableRead',timeout:30000});
  need(digest(drained)===digest(snapshots.before),'M6_DB_CHANGED_WHILE_DRAINING');
  await db.$disconnect();db=undefined;
  await stage(newStage,'SOURCE_MIGRATION','pnpm',['prisma:migrate:deploy'],app,await runtimeEnv());
  db=database('proto_a_01');
  const migrated=await db.$transaction(tx=>uomSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
  exactRowsPreserved(snapshots.before,migrated);
  verifyM6MigrationLedger(snapshots.priorLedger,await migrationLedger(db),previousSources,releaseSources);
  for(const [kind,port,entry,cwd,vars] of [
    ['api',33071,join(app,'apps/api/dist/main.js'),join(app,'apps/api'),await runtimeEnv()],
    ['web',44171,join(app,'deploy/uat/serve-web.mjs'),app,{...env(),WEB_HOST:'127.0.0.1',WEB_PORT:'44171'}]]){
    await freePort(port,sourceRoot);
    const log=await open(join(newStage,'logs','source-'+kind+'.log'),'wx',0o600);
    const child=spawn(process.execPath,[entry],{cwd,env:vars,detached:true,stdio:['ignore',log.fd,log.fd]});
    await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});await log.close();child.unref();
    const born=await command('/bin/ps',['-p',String(child.pid),'-o','lstart='],sourceRoot);
    const record={pid:child.pid,born,entry,port,releaseSha,databaseName:'proto_a_01'};
    await seal(join(newStage,'source-'+kind+'-owned.json'),record);processes.push(record);
  }
  let ready=false;
  for(let i=0;i<90;i++){try{const h=await health(),web=await fetch(WEB,{redirect:'error',signal:AbortSignal.timeout(3000)});
   if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'&&web.ok){ready=true;break;}
  }catch{}await sleep(500);}
  need(ready,'M6_NEW_APPLICATION_NOT_READY');
  for(const p of processes){
    need(await command('/bin/ps',['-ww','-p',String(p.pid),'-o','command='],sourceRoot)===process.execPath+' '+p.entry&&
      hasSoleListenerPid(await command('lsof',['-nP','-iTCP:'+p.port,'-sTCP:LISTEN','-Fpf'],sourceRoot),p.pid),
      'M6_NEW_PROCESS_LISTENER_DRIFT');
  }
  return {ok:true,releaseSha,forwardOnlyMigration:true,separatePopulatedRestoreVerified:true,
    previousUomJourneyNotReplayed:true,originalDocumentFilesCopied:true};
 }
 async function verifyEncryptedHrAttachment({attachmentId,employeeId}){
  need(db&&actorBinding&&typeof attachmentId==='string','M6_HR_PRIVATE_SOURCE_MISSING');
  const row=await db.hrDocumentAttachment.findUnique({where:{id:attachmentId},include:{document:true}});
  need(row?.companyId===actorBinding.fixture.companyId&&row.employeeId===employeeId&&
    row.actorUserId===actorBinding.actors.KOH.userId&&row.document?.companyId===row.companyId,
   'M6_HR_PRIVATE_ATTACHMENT_NOT_SCOPED');
  const doc=row.document,key=doc.storageKey;
  need(typeof key==='string'&&key.length>0&&!key.startsWith('/')&&
    !key.includes('..')&&!key.includes('\\')&&!key.includes('\u0000'),'M6_HR_STORAGE_KEY_INVALID');
  const full=resolve(join(root,'documents',key));need(full.startsWith(join(root,'documents')+'/'),'M6_HR_STORAGE_PATH_ESCAPE');
  const s=await lstat(full);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&!(s.mode&0o022),
   'M6_HR_CIPHERTEXT_FILE_UNSAFE');
  const actual=await readFile(full);
  const plaintext=Buffer.from('CONSTRUCTION_ERP_SYNTHETIC_M6_ENCRYPTED_HR_FILE_PROOF_20261122\n','utf8');
  const matches=doc.checksum===hash(actual)&&doc.fileSizeBytes===actual.length&&
    !actual.equals(plaintext)&&!actual.includes(plaintext)&&typeof row.encryptedMetadata==='string'&&row.encryptedMetadata.length>0;
  actual.fill(0);plaintext.fill(0);need(matches,'M6_HR_PLAINTEXT_OR_CHECKSUM_STORAGE_FAIL');
  encryptedDocumentKey=key;
  need(digest(await privateInventory(join(root,'hrkeys')))===digest(snapshots.files.hrkeys),'M6_HR_KEYS_CHANGED');
  return {attachmentId,ciphertextAtRestVerified:true,plaintextNotStored:true,sourceFilesAndKeysPreserved:true};
 }
 async function preserve({authority}){
  need(authority.releaseSha===releaseSha&&db&&encryptedDocumentKey,'M6_FINAL_PRESERVATION_SEQUENCE_INVALID');
  const latest=await db.$transaction(tx=>uomSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
  need(digest(await privateInventory(join(root,'uploads')))===digest(snapshots.files.uploads)&&
    digest(await privateInventory(join(root,'hrkeys')))===digest(snapshots.files.hrkeys),'M6_FINAL_UPLOADS_OR_HR_KEYS_CHANGED');
  originalInventoryPreserved(snapshots.files.documents,await privateInventory(join(root,'documents')),[encryptedDocumentKey]);
  verifyDocumentInventory(latest.documents,await privateInventory(join(root,'documents')));
  need(await fileHash(join(newStage,'preserved','postgresql.custom'))===snapshots.dumpSha,'M6_FINAL_PRESERVED_DUMP_CHANGED');
  need(digest(await boundedJSON(join(prior,'source-database-after-private.json')))===digest(snapshots.before),
   'M6_UOM_SOURCE_SNAPSHOT_TAMPERED');
  await seal(join(newStage,'source-database-after-private.json'),latest);
  return {ok:true,releaseSha,originalPopulatedDumpPreserved:true,previousHrKeysAndUploadsIntact:true,
    protectedHrEncryptedFileVerified:true,oldHistoricalSnapshotPreserved:true};
 }
 async function close(){if(db)await db.$disconnect();db=undefined;}
 return {inspected,upgrade,preserve,close,verifyEncryptedHrAttachment,load,
  get db(){return db;},get binding(){return actorBinding;},get priorUomReceipt(){return receipt;}};
}
export const M6_MAC_SOURCE=PREVIOUS_APP;
