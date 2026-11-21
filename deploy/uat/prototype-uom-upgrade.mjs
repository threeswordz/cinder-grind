#!/usr/bin/env node
// Create-once preserved-data UOM upgrade after the completed subcontract runtime.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,readdir,mkdir,open,cp,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {SOURCE,validConfig,validReady,validContainer} from './prototype-actors.mjs';
import {validActorReceipt,validPrivateActors} from './prototype-browser-operator.mjs';
import {artifactInventory,compareArtifactInventories} from './prototype-material-artifacts.mjs';
import {privateInventory,verifyDocumentInventory,hasSoleListenerPid,command,directory,privateJson,absent,seal,fileHash,stage,databaseStream,
 freePort,environment,green,json} from './prototype-transfer-upgrade.mjs';
import {verifyTransferDocumentFiles} from './prototype-transfer-state.mjs';
import {uomSnapshot,digest,verifyUomMigration,configureUom,prepareUomSource,uomBrowserBinding,verifyUomActivationDenial,verifyUomPreservation} from './prototype-uom-state.mjs';
import {executeMaterialUomBrowser} from './material-uom-browser.mjs';
import {verifyUomPriorProtectedReadback} from './prototype-uom-protected-readback.mjs';
import {convertedReceiving} from './prototype-uom-converted-receiving.mjs';
import {convertedRequestReport} from './prototype-uom-request-report.mjs';
import {convertedReservation} from './prototype-uom-converted-reservation.mjs';
import {convertedPlanIssue} from './prototype-uom-plan-source.mjs';
import {prepareBrowser,discoverBrowser} from './prototype-browser-executable.mjs';
import {startBrowser} from './prototype-browser.mjs';
export const PREVIOUS_APP='f37867c9dd34d535e5d62bfdd01934773c6f5e8a';
export const PREVIOUS_OPERATOR='bf3413caa26af4357bd57a38311f26dec86917c2';
export const APPLICATION_BASE='aa233e7843b26863a96c77dda5e164b8a326498a';
export const REHEARSAL_DB='proto_a_01_uom_preupgrade';
const API='http://127.0.0.1:33071/api/v1',WEB='http://127.0.0.1:44171',ORIGIN='https://github.com/threeswordz/cinder-grind.git';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex'),pause=ms=>new Promise(r=>setTimeout(r,ms));
export function validSubcontractReceipt(r){
 return r?.status==='SUBCONTRACT_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED'&&r.applicationSha===PREVIOUS_APP&&r.operatorMainSha===PREVIOUS_OPERATOR&&/^[a-f0-9]{64}$/.test(r.populatedDumpSha256??'')&&
  ['forwardOnlyMigration','sourceHistoryPreserved','completedPartialTransferPreserved','documentsUploadsKeysAndPriorReceiptsPreserved',
   'preUpgradeSeparatePopulatedRestoreAndJourneyVerified','stockAndPaymentRowsUnchanged','physicalCaptureAndIndependentPartialAcceptanceVerified',
   'explicitAcceptedAmountVerified','canonicalCertificationApprovalVerified','threeLocalesVerified','mobileVerified','protectedDownloadBytesVerified',
   'wrongActorDenialVerified','uncertainResponseReplayVerified','sessionsRevoked'].every(k=>r[k]===true)&&
  ['fullBusinessJourneysVerified','milestone7Complete','prototypeFrozen','humanUatCompleted','productionAuthorized','secretsPrinted'].every(k=>r[k]===false);
}
// Complete private SQL snapshots exceed the small receipt limit. Retain the
// same ownership/link/mode checks with an explicit bounded 32MiB state size.
async function privateState(path){
 const s=await lstat(path);demand(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.size<=33554432,'UOM_UPGRADE_UNSAFE_PRIVATE_STATE');
 return JSON.parse(await readFile(path,'utf8'));
}
// Prior stages can include a populated rehearsal. Exclude only their one
// immutable source checkout; preserve every other directory, name and byte.
export async function uomStageInventory(path){
 await directory(path,true);const rows=[];
 for(const name of (await readdir(path)).sort()){
  if(name==='application')continue;
  const full=join(path,name),s=await lstat(full);
  demand(!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'UOM_UPGRADE_UNSAFE_PRIOR_STAGE');
  if(s.isDirectory())for(const item of await privateInventory(full))rows.push([name+(item[0]?'/'+item[0]:''),...item.slice(1)]);
  else {demand(s.isFile()&&s.nlink===1,'UOM_UPGRADE_UNSAFE_PRIOR_FILE');rows.push([name,s.size,await fileHash(full)]);}
 }
 return rows;
}
export async function upgradeUom(operatorMain){
 const applicationSha=operatorMain;
 demand(process.platform==='darwin'&&process.getuid()>0,'UOM_UPGRADE_NONROOT_MAC_REQUIRED');
 demand(process.versions.node==='24.21.0','UOM_UPGRADE_NODE_24_21_0_REQUIRED');
 demand(!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),'UOM_UPGRADE_EXECUTION_OVERRIDE_REFUSED');
 demand(await command('pnpm',['--version'],homedir())==='12.6.0','UOM_UPGRADE_PNPM_12_6_0_REQUIRED');
 demand(/^[a-f0-9]{40}$/.test(operatorMain??''),'UOM_UPGRADE_PINNED_OPERATOR_REQUIRED');process.umask(0o077);
 const own=fileURLToPath(new URL('../../',import.meta.url)),home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),
  prior=join(root,'subcontract-upgrade'),oldRepo=join(prior,'application'),target=join(root,'uom-upgrade'),repo=join(target,'application');
 demand(resolve(home)===home&&!/[\n\r,]/.test(home),'UOM_UPGRADE_HOME_INVALID');
 await directory(home);await directory(root,true);await directory(prior,true);await directory(oldRepo);
 for(const n of ['documents','hrkeys','uploads','logs','db'])await directory(join(root,n),true);
 demand(await absent(target),'UOM_UPGRADE_ALREADY_STARTED_PRESERVE_AND_DO_NOT_RETRY');
 demand(await command('git',['rev-parse','HEAD'],own)===operatorMain&&await command('git',['status','--porcelain'],own)===''&&
  [ORIGIN,ORIGIN.slice(0,-4)].includes(await command('git',['remote','get-url','origin'],own)),'UOM_UPGRADE_OPERATOR_SOURCE_DRIFT');
 // One actual full-main deployment receipt for the final combined candidate.
 // The same candidate builds the application; no second predecessor-main run.
 await green(operatorMain);await green(PREVIOUS_OPERATOR);
 demand(await command('git',['diff',APPLICATION_BASE,operatorMain,'--','apps/api','apps/web','package.json','pnpm-lock.yaml','pnpm-workspace.yaml'],own)==='', 'UOM_UPGRADE_APPLICATION_BASE_DRIFT');
 const main=(await json('https://api.github.com/repos/threeswordz/cinder-grind/branches/main')).commit?.sha;
 demand(/^[a-f0-9]{40}$/.test(main??'')&&['ahead','identical'].includes((await json('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+operatorMain+'...'+main)).status),'UOM_UPGRADE_OPERATOR_MUST_BE_MAIN_ANCESTOR');
 const cfg=await privateJson(join(root,'runtime-private.json')),container=await privateJson(join(root,'container-owned.json')),manifest=await privateJson(join(root,'prototype-target.json')),
  ready=await privateJson(join(prior,'ready.json')),originalReady=await privateJson(join(root,'runtime-ready.json'));
 demand(validConfig(cfg)&&validReady(originalReady)&&originalReady.imageId===container.image&&validActorReceipt(await privateJson(join(root,'actors-ready.json'))),'UOM_UPGRADE_ORIGINAL_SYNTHETIC_RECEIPTS_REQUIRED');
 demand(manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&
  manifest.runtime?.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&
  manifest.runtime.apiOrigin===cfg.apiOrigin&&manifest.runtime.webOrigin===WEB&&manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01','UOM_UPGRADE_WRONG_SYNTHETIC_MANIFEST');
 demand(validSubcontractReceipt(ready),'UOM_UPGRADE_COMPLETED_SUBCONTRACT_REQUIRED');
 const a=await privateJson(join(root,'actors-private.json')),fixture=await privateJson(join(root,'actors-fixture-private.json'));
 demand(validPrivateActors(a),'UOM_UPGRADE_PRIVATE_ACTORS_INVALID');
 const binding={sourceSha:SOURCE,actors:a.actors,fixture,configuration:await privateJson(join(root,'material-configuration-private.json')),journey:await privateJson(join(root,'material-journey-private.json'))};
 const technical={userId:fixture.adminUserId,email:cfg.adminEmail,password:cfg.adminPassword};
 demand(await command('git',['rev-parse','HEAD'],oldRepo)===PREVIOUS_APP&&await command('git',['status','--porcelain'],oldRepo)===''&&
  [ORIGIN,ORIGIN.slice(0,-4)].includes(await command('git',['remote','get-url','origin'],oldRepo)),'UOM_UPGRADE_PRIOR_SOURCE_DRIFT');
 const oldBuilt=await privateJson(join(prior,'compiled-artifacts-private.json'));
 demand(oldBuilt.applicationSha===PREVIOUS_APP&&oldBuilt.operatorMain===PREVIOUS_OPERATOR,'UOM_UPGRADE_PRIOR_ARTIFACT_RECEIPT_INVALID');
 compareArtifactInventories(await artifactInventory(join(oldRepo,'apps/api/dist')),oldBuilt.api);compareArtifactInventories(await artifactInventory(join(oldRepo,'apps/web/dist')),oldBuilt.web);
 // Reuse the completed subcontract runtime's pinned build proof and compare every
 // current emitted byte to its sealed inventory; do not rebuild the old App.
 const connections=JSON.parse(await command('podman',['system','connection','list','--format','json'],own)),defaults=connections.filter(c=>c.Default===true);
 demand(defaults.length===1&&defaults[0].Name==='podman-machine-default'&&/^ssh:\/\/core@127\.0\.0\.1:\d+\/run\/user\/\d+\/podman\/podman.sock$/.test(defaults[0].URI??'')&&
  await command('podman',['info','--format','{{.Host.Security.Rootless}}'],own)==='true','UOM_UPGRADE_LOCAL_ROOTLESS_PODMAN_REQUIRED');
 const inspected=JSON.parse(await command('podman',['inspect',container.id],own));
 demand(inspected.length===1&&validContainer(inspected[0],container,join(root,'db')),'UOM_UPGRADE_OWNED_CONTAINER_REQUIRED');
 const sql=(name,text)=>command('podman',['exec',container.id,'psql','--no-psqlrc','-U','proto_runtime','-d',name,'-At','-v','ON_ERROR_STOP=1','-c',text],own);
 demand(await sql('proto_a_01','SELECT current_database()')==='proto_a_01'&&/^17\.11(?:\D|$)/.test(await sql('proto_a_01','SHOW server_version'))&&
  await sql('proto_a_01',"SELECT count(*) FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='proto_a_01' AND r.rolname='proto_runtime' AND d.datallowconn AND NOT d.datistemplate")==='1','UOM_UPGRADE_POSTGRES_IDENTITY_REQUIRED');
 demand(await sql('proto_a_01',"SELECT count(*) FROM pg_database WHERE datname='"+REHEARSAL_DB+"'")==='0','UOM_UPGRADE_REHEARSAL_TARGET_EXISTS_NO_OVERWRITE');
 const quiet=()=>sql('proto_a_01',"SELECT count(*) FROM pg_stat_activity WHERE datname='proto_a_01' AND pid<>pg_backend_pid()");
 async function oldIdentity(kind,port){
  const p=await privateJson(join(prior,'source-'+kind+'-owned.json')),entry=kind==='api'?join(oldRepo,'apps/api/dist/main.js'):join(oldRepo,'deploy/uat/serve-web.mjs');
  demand(p.applicationSha===PREVIOUS_APP&&p.operatorMain===PREVIOUS_OPERATOR&&p.databaseName==='proto_a_01'&&p.entry===entry&&p.port===port&&Number.isSafeInteger(p.pid)&&p.pid>1,'UOM_UPGRADE_PRIOR_PROCESS_RECEIPT_INVALID');
  demand(await command('/bin/ps',['-ww','-p',String(p.pid),'-o','command='],own)===process.execPath+' '+entry&&
   await command('/bin/ps',['-p',String(p.pid),'-o','uid='],own)===String(process.getuid())&&await command('/bin/ps',['-p',String(p.pid),'-o','lstart='],own)===p.born&&
   hasSoleListenerPid(await command('lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-Fpf'],own),p.pid),'UOM_UPGRADE_PRIOR_PROCESS_OWNERSHIP_DRIFT');
  const one=await command('lsof',['-nP','-a','-p',String(p.pid),'-iTCP:'+port,'-sTCP:LISTEN'],own);
  demand(one.includes('127.0.0.1:'+port)&&!one.includes('*:'+port),'UOM_UPGRADE_PRIOR_LISTENER_DRIFT');return p;
 }
 const oldApi=await oldIdentity('api',33071),oldWeb=await oldIdentity('web',44171);
 const health=await json(API+'/health/ready',5000);demand(health.status==='ok'&&health.database==='ok'&&health.documentStorage==='ok','UOM_UPGRADE_PRIOR_RUNTIME_NOT_READY');
 await mkdir(target,{mode:0o700});await mkdir(join(target,'logs'),{mode:0o700});
 await seal(join(target,'started.json'),{previousApplication:PREVIOUS_APP,previousOperator:PREVIOUS_OPERATOR,reviewedApp:applicationSha,operatorMain,startedAt:new Date().toISOString()});
 let db,browser,executable,copyMayBeRemoved=true,phase='BUILD',active=[],cutover=false,sourceMigrated=false;
 try{
  await stage(target,'CLONE','git',['clone','--no-checkout',ORIGIN,repo],target);
  await stage(target,'PIN','git',['checkout','--detach',applicationSha],repo);
  demand(await command('git',['rev-parse','HEAD'],repo)===applicationSha&&await command('git',['status','--porcelain'],repo)==='','UOM_UPGRADE_APPLICATION_SOURCE_DRIFT');
  await stage(target,'INSTALL','pnpm',['install','--frozen-lockfile'],repo);await stage(target,'GENERATE','pnpm',['prisma:generate'],repo);
  await stage(target,'BUILD','pnpm',['build'],repo,{...environment(),NODE_ENV:'production',VITE_API_BASE_URL:API});
  const built={api:await artifactInventory(join(repo,'apps/api/dist')),web:await artifactInventory(join(repo,'apps/web/dist'))};
  await seal(join(target,'compiled-artifacts-private.json'),{applicationSha:applicationSha,operatorMain,...built});
  const require=createRequire(join(repo,'apps/api/package.json')),{PrismaClient}=require('@prisma/client');
  const url=name=>'postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/'+name+'?schema=public',database=name=>new PrismaClient({datasources:{db:{url:url(name)}},log:[]});
  const snapshot=client=>client.$transaction(tx=>uomSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
  async function migrations(client,source){
   const expected=[];
   for(const d of (await readdir(join(source,'apps/api/prisma/migrations'),{withFileTypes:true})).filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))
    expected.push({name:d.name,checksum:hash(await readFile(join(source,'apps/api/prisma/migrations',d.name,'migration.sql')))});
   const rows=await client.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
   demand(rows.length===expected.length&&rows.every((r,i)=>r.migration_name===expected[i].name&&r.checksum===expected[i].checksum&&r.finished_at&&!r.rolled_back_at),'UOM_UPGRADE_EXACT_SCHEMA_PROVENANCE_REQUIRED');
  }
  db=database('proto_a_01');await migrations(db,oldRepo);
  demand(await db.userSession.count({where:{revokedAt:null}})===0&&digest(await snapshot(db))===digest(await privateState(join(prior,'source-database-after-private.json'))),'UOM_UPGRADE_COMPLETED_SUBCONTRACT_SOURCE_DRIFT');
  await db.$disconnect();db=undefined;
  executable=await prepareBrowser(await discoverBrowser(),target);
  phase='DRAIN';cutover=true;
  for(const [kind,port,saved]of [['web',44171,oldWeb],['api',33071,oldApi]]){
   const p=await oldIdentity(kind,port);demand(p.pid===saved.pid&&p.born===saved.born,'UOM_UPGRADE_PRIOR_PROCESS_CHANGED_BEFORE_STOP');process.kill(p.pid,'SIGTERM');
   let exited=false;for(let i=0;i<60;i++){try{process.kill(p.pid,0);}catch(e){if(e.code==='ESRCH'){exited=true;break;}throw e;}await pause(500);}
   demand(exited,'UOM_UPGRADE_PRIOR_PROCESS_EXIT_UNCONFIRMED');
  }
  await freePort(33071,own);await freePort(44171,own);demand(await quiet()==='0','UOM_UPGRADE_SOURCE_NOT_DRAINED');
  db=database('proto_a_01');const before=await snapshot(db);await migrations(db,oldRepo);
  demand(digest(before)===digest(await privateState(join(prior,'source-database-after-private.json'))),'UOM_UPGRADE_SOURCE_CHANGED_DURING_DRAIN');
  await db.$disconnect();db=undefined;await seal(join(target,'database-before-private.json'),before);
  phase='PRESERVE';const preserved=join(target,'preserved'),rehearsal=join(target,'rehearsal');await mkdir(preserved,{mode:0o700});await mkdir(rehearsal,{mode:0o700});
  const stages=['fm03-upgrade','receiving-upgrade','transfer-upgrade','transfer-continuation','subcontract-upgrade'],dataNames=['documents','uploads','hrkeys'];
  const names=(await readdir(root)).filter(n=>!['db','uom-upgrade'].includes(n)),inventories={};
  const inventory=async(name,parent)=>{
   const path=join(parent,name),s=await lstat(path);demand(!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'UOM_UPGRADE_UNSAFE_RUNTIME_HISTORY');
   if(s.isDirectory()){demand([...stages,...dataNames,'logs'].includes(name),'UOM_UPGRADE_UNKNOWN_RUNTIME_DIRECTORY');return stages.includes(name)?uomStageInventory(path):privateInventory(path);}
   demand(s.isFile()&&s.nlink===1,'UOM_UPGRADE_UNSAFE_RUNTIME_FILE');return fileHash(path);
  };
  for(const name of names){
   inventories[name]=await inventory(name,root);const from=join(root,name);
   await cp(from,join(preserved,name),{recursive:true,force:false,errorOnExist:true,...(stages.includes(name)?{filter:path=>path!==join(from,'application')}: {})});
   demand(digest(await inventory(name,preserved))===digest(inventories[name]),'UOM_UPGRADE_PRESERVED_COPY_CHANGED');
  }
  for(const name of dataNames){await cp(join(root,name),join(rehearsal,name),{recursive:true,force:false,errorOnExist:true});demand(digest(await privateInventory(join(rehearsal,name)))===digest(inventories[name]),'UOM_UPGRADE_REHEARSAL_COPY_CHANGED');}
  verifyDocumentInventory(before.documents,inventories.documents);await seal(join(target,'file-inventories-private.json'),inventories);
  demand(await quiet()==='0','UOM_UPGRADE_SOURCE_TRAFFIC_RESUMED');const dump=join(preserved,'postgresql.custom');
  await databaseStream(container.id,['pg_dump','-U','proto_runtime','-d','proto_a_01','--format=custom','--no-owner','--no-acl'],own,dump);
  demand((await lstat(dump)).size>1024,'UOM_UPGRADE_POPULATED_DUMP_REQUIRED');const dumpSha256=await fileHash(dump);
  await seal(join(target,'preservation-private.json'),{dumpSha256,inventories});
  async function preservedUnchanged(){
   demand(await fileHash(dump)===dumpSha256,'UOM_UPGRADE_PRESERVED_DUMP_CHANGED');
   for(const name of names)demand(digest(await inventory(name,preserved))===digest(inventories[name]),'UOM_UPGRADE_PRESERVED_HISTORY_CHANGED');
  }
  phase='SEPARATE_REHEARSAL_RESTORE';
  demand(await sql('proto_a_01',"SELECT count(*) FROM pg_database WHERE datname='"+REHEARSAL_DB+"'")==='0','UOM_UPGRADE_REHEARSAL_TARGET_EXISTS_NO_OVERWRITE');
  await command('podman',['exec',container.id,'createdb','-U','proto_runtime','--owner=proto_runtime','--template=template0',REHEARSAL_DB],own);
  await databaseStream(container.id,['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','proto_runtime','-d',REHEARSAL_DB],own,dump,true);
  const runtime=async(name,store)=>({...environment(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33071',WEB_ORIGIN:WEB,DATABASE_URL:url(name),
   STORAGE_ROOT:join(store,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(store,'uploads'),HR_PRIVATE_KEYS:JSON.stringify(await privateJson(join(store,'hrkeys/keyring.json'))),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'});
  async function processIdentity(p){
   demand(await command('/bin/ps',['-ww','-p',String(p.child.pid),'-o','command='],repo)===process.execPath+' '+p.entry&&
    await command('/bin/ps',['-p',String(p.child.pid),'-o','uid='],repo)===String(process.getuid())&&await command('/bin/ps',['-p',String(p.child.pid),'-o','lstart='],repo)===p.born,'UOM_UPGRADE_NEW_PROCESS_OWNERSHIP_DRIFT');
  }
  async function stopProcesses(){
   for(const p of [...active].reverse())if(p.child.exitCode===null&&p.child.signalCode===null){
    await processIdentity(p);p.child.kill('SIGTERM');const end=Date.now()+30000;
    while(p.child.exitCode===null&&p.child.signalCode===null&&Date.now()<end)await pause(100);
    demand(p.child.exitCode!==null||p.child.signalCode!==null,'UOM_UPGRADE_NEW_PROCESS_EXIT_UNCONFIRMED');
   }
   active=[];await freePort(33071,own);await freePort(44171,own);
  }
  async function startProcesses(name,store,label){
   compareArtifactInventories(await artifactInventory(join(repo,'apps/api/dist')),built.api);compareArtifactInventories(await artifactInventory(join(repo,'apps/web/dist')),built.web);
   demand(await command('git',['rev-parse','HEAD'],repo)===applicationSha&&await command('git',['status','--porcelain'],repo)==='','UOM_UPGRADE_APP_CHANGED_BEFORE_START');
   for(const [kind,port,entry,cwd,env]of [
    ['api',33071,join(repo,'apps/api/dist/main.js'),join(repo,'apps/api'),await runtime(name,store)],
    ['web',44171,join(repo,'deploy/uat/serve-web.mjs'),repo,{...environment(),WEB_HOST:'127.0.0.1',WEB_PORT:'44171'}]]){
    await freePort(port,own);const log=await open(join(target,'logs',label+'-'+kind+'-runtime.log'),'wx',0o600);
    const child=spawn(process.execPath,[entry],{cwd,env,detached:true,stdio:['ignore',log.fd,log.fd]});
    await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});await log.close();child.unref();
    const p={child,kind,port,entry,born:await command('/bin/ps',['-p',String(child.pid),'-o','lstart='],repo)};active.push(p);
    await seal(join(target,label+'-'+kind+'-owned.json'),{applicationSha:applicationSha,operatorMain,databaseName:name,pid:child.pid,entry,port,born:p.born});
   }
   let started=false;const end=Date.now()+60000;
   while(Date.now()<end){
    demand(active.every(p=>p.child.exitCode===null&&p.child.signalCode===null),'UOM_UPGRADE_NEW_APP_EXITED');
    try{const h=await json(API+'/health/ready',2000),w=await fetch(WEB,{redirect:'error',signal:AbortSignal.timeout(2000)});
     if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'&&w.ok&&hash(await w.text())===hash(await readFile(join(repo,'apps/web/dist/index.html')))){started=true;break;}
    }catch{}await pause(500);
   }
   demand(started,'UOM_UPGRADE_NEW_APP_NOT_READY');
   for(const p of active){await processIdentity(p);const one=await command('lsof',['-nP','-a','-p',String(p.child.pid),'-iTCP:'+p.port,'-sTCP:LISTEN'],repo);
    demand(hasSoleListenerPid(await command('lsof',['-nP','-iTCP:'+p.port,'-sTCP:LISTEN','-Fpf'],repo),p.child.pid)&&one.includes('127.0.0.1:'+p.port)&&!one.includes('*:'+p.port),'UOM_UPGRADE_NEW_LISTENER_DRIFT');}
  }
  async function runJourney(client,store,label,migrated){
   const configuration=await configureUom(client,binding,digest(migrated));await seal(join(target,label+'-configuration-private.json'),configuration);
   const source=await prepareUomSource(client,binding,{api:API,web:WEB});await seal(join(target,label+'-source-private.json'),source);
   copyMayBeRemoved=false;try{browser=await startBrowser(executable.executable,label==='rehearsal'?rehearsal:target);}catch(e){copyMayBeRemoved=e.browserProcessExited===true;throw e;}
   await executeMaterialUomBrowser(browser.protocol,uomBrowserBinding(binding,source,{api:API,web:WEB},technical),client);
   await browser.stop();browser=undefined;copyMayBeRemoved=true;
   demand((await verifyUomActivationDenial(client,binding,source,{api:API,web:WEB})).activationDenied,'UOM_ACTIVATION_DENIAL_NOT_VERIFIED');
    const protectedReadback=await verifyUomPriorProtectedReadback(client,binding,{api:API,web:WEB},technical);
   const after=await snapshot(client);verifyUomPreservation(migrated,after,configuration,binding,source);
   verifyDocumentInventory(after.documents,await privateInventory(join(store,'documents')));
   const converted=await convertedReceiving(client,binding,source,{api:API,web:WEB});
   const reservation=await convertedReservation(client,binding,source,{api:API,web:WEB});
   const requestReport=await convertedRequestReport(client,binding,source,{api:API,web:WEB});
   const planned=await convertedPlanIssue(client,binding,source,{api:API,web:WEB});
   const final=await snapshot(client);verifyDocumentInventory(final.documents,await privateInventory(join(store,'documents')));
   const result={definitionBrowserVerified:true,threeLocalesVerified:true,mobileVerified:true,wrongActorDenialVerified:true,
    uncertainResponseReplayVerified:true,sessionsRevoked:true,...protectedReadback,historicalStockAndFinancialRowsPreserved:true,
    legacyMaterialsNotActivated:true,convertedReceivingVerified:converted.convertedReceivingVerified,
    convertedReservationVerified:reservation.convertedReservationVerified,
    reservationReleasedWithoutStockEffect:reservation.reservationReleasedWithoutStockEffect,
    convertedRequestSourceVerified:requestReport.convertedRequestSourceVerified,
    convertedMovementReportVerified:requestReport.convertedMovementReportVerified,
    convertedApprovedSourcePlanAndIssueVerified:planned.convertedApprovedSourcePlanAndIssueVerified,
    convertedPlannedReturnVerified:planned.convertedPlannedReturnVerified,
    ownerCostSelfApprovalUnverified:true,
    requestAndReportSessionsRevoked:requestReport.requestAndReportSessionsRevoked,
    newConvertedStockJourneyVerified:false,documentIds:converted.documentIds};
   await seal(join(target,label+'-database-after-private.json'),final);await seal(join(target,label+'-journey-private.json'),result);return {after,result};
  }
  db=database(REHEARSAL_DB);demand(digest(await snapshot(db))===digest(before),'UOM_UPGRADE_RESTORED_ROWS_DIFFER');await db.$disconnect();db=undefined;
  phase='REHEARSAL_MIGRATION';await stage(target,'MIGRATE_REHEARSAL','pnpm',['prisma:migrate:deploy'],repo,await runtime(REHEARSAL_DB,rehearsal));
  db=database(REHEARSAL_DB);await migrations(db,repo);const rehearsalMigrated=await snapshot(db);verifyUomMigration(before,rehearsalMigrated);
  phase='REHEARSAL_JOURNEY';await startProcesses(REHEARSAL_DB,rehearsal,'rehearsal');await runJourney(db,rehearsal,'rehearsal',rehearsalMigrated);
  await db.$disconnect();db=undefined;await stopProcesses();
  phase='SOURCE_RECHECK';await preservedUnchanged();
  for(const name of names)demand(digest(await inventory(name,root))===digest(inventories[name]),'UOM_UPGRADE_SOURCE_FILES_CHANGED_AFTER_REHEARSAL');
  demand(await quiet()==='0','UOM_UPGRADE_SOURCE_TRAFFIC_RESUMED');db=database('proto_a_01');
  demand(digest(await snapshot(db))===digest(before),'UOM_UPGRADE_SOURCE_CHANGED_AFTER_REHEARSAL');await db.$disconnect();db=undefined;
  phase='SOURCE_MIGRATION';sourceMigrated=true;await stage(target,'MIGRATE_SOURCE','pnpm',['prisma:migrate:deploy'],repo,await runtime('proto_a_01',root));
  db=database('proto_a_01');await migrations(db,repo);const migrated=await snapshot(db);verifyUomMigration(before,migrated);
  phase='SOURCE_JOURNEY';await startProcesses('proto_a_01',root,'source');const completed=await runJourney(db,root,'source',migrated);
  phase='FINAL_PRESERVATION';await preservedUnchanged();
  for(const name of names){const current=await inventory(name,root);
   if(name==='documents')verifyTransferDocumentFiles(inventories[name],current,completed.after.documents.filter(d=>completed.result.documentIds.includes(d.id)));
   else demand(digest(current)===digest(inventories[name]),'UOM_UPGRADE_PRIOR_FILES_KEYS_OR_RECEIPTS_CHANGED');}
  const receipt={previousApplication:PREVIOUS_APP,previousOperator:PREVIOUS_OPERATOR,
   applicationSha:applicationSha,operatorMainSha:operatorMain,forwardOnlyMigration:true,sourceHistoryPreserved:true,completedPartialTransferPreserved:true,
   documentsUploadsKeysAndPriorReceiptsPreserved:true,preUpgradeSeparatePopulatedRestoreAndJourneyVerified:true,populatedDumpSha256:dumpSha256,
   ...completed.result,status:'UOM_POPULATED_MAC_UPGRADE_AND_CONVERTED_RECEIVING_VERIFIED',stockAndPaymentRowsUnchanged:false,
   fullBusinessJourneysVerified:false,milestone7Complete:false,prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
  // Do not expose private Document/Certification identities in public output.
  delete receipt.documentIds;delete receipt.certificationId;await seal(join(target,'ready.json'),receipt);return receipt;
 }catch(e){
  for(const p of [...active].reverse())try{if(p.child.exitCode===null&&p.child.signalCode===null&&
   await command('/bin/ps',['-ww','-p',String(p.child.pid),'-o','command='],repo)===process.execPath+' '+p.entry&&
   await command('/bin/ps',['-p',String(p.child.pid),'-o','uid='],repo)===String(process.getuid())&&await command('/bin/ps',['-p',String(p.child.pid),'-o','lstart='],repo)===p.born)p.child.kill('SIGTERM');}catch{}
  await seal(join(target,'failure-private.json'),{phase,code:e.safeCode??'UOM_UPGRADE_PRIVATE_FAILURE',sourceMayBeStopped:cutover,sourceMayBeMigrated:sourceMigrated,automaticRetryAllowed:false});throw e;
 }finally{try{if(browser){await browser.stop();copyMayBeRemoved=true;}}finally{try{if(executable&&copyMayBeRemoved)await executable.cleanup();}finally{if(db)await db.$disconnect();}}}
}
const entry=process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null);
if(entry&&entry===await realpath(new URL(import.meta.url))){
 try{demand(process.argv.length===4&&process.argv[2]==='--execute','UOM_UPGRADE_EXECUTE_AND_SHA_REQUIRED');console.log(JSON.stringify(await upgradeUom(process.argv[3])));}
 catch(e){console.log(JSON.stringify({status:'UOM_UPGRADE_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'UOM_UPGRADE_PRIVATE_FAILURE',doNotRetryOrReplayCompletedOperators:true,productionAuthorized:false,secretsPrinted:false}));process.exitCode=1;}
}
