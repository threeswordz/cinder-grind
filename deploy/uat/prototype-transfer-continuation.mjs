#!/usr/bin/env node
// One continuation of the observed97db9151 failure. No old launcher, migration,
// setup/configuration replay, spent-number reset, old process restart or rollback.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,mkdir,open,cp,lstat,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {inspectFailedTransfer} from './prototype-transfer-failure-readback.mjs';
import {verifyFailedTransferState} from './prototype-transfer-failure-state.mjs';
import {prepareTransferContinuationSource} from './prototype-transfer-continuation-core.mjs';
import {transferSnapshot,digest,transferBrowserBinding,verifyTransferJourneyPreservation,verifyTransferDocumentFiles} from './prototype-transfer-state.mjs';
import {executeTransferBrowser} from './transfer-browser.mjs';
import {prepareBrowser,discoverBrowser} from './prototype-browser-executable.mjs';
import {startBrowser} from './prototype-browser.mjs';
import {artifactInventory,compareArtifactInventories} from './prototype-material-artifacts.mjs';
import {privateInventory,verifyDocumentInventory,hasSoleListenerPid,command,directory,privateJson,absent,seal,fileHash,stage,databaseStream,
 priorInventory,freePort,environment,green,json} from './prototype-transfer-upgrade.mjs';
export const FAILED_SOURCE='97db9151b1059e5f134529deb25b78fc714fa683';
export const CORRECTED_APP='0c3182e19611533adf1f0df718aa459b63fed7d3';
export const REHEARSAL_DB='proto_a_01_transfer_continuation_rehearsal';
const API='http://127.0.0.1:33071/api/v1',WEB='http://127.0.0.1:44171',ORIGIN='https://github.com/threeswordz/cinder-grind.git';
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
export async function continueTransfer(operatorMain){
 demand(process.platform==='darwin'&&process.getuid()>0,'TR_CONTINUATION_NONROOT_MAC_REQUIRED');
 demand(process.versions.node==='24.21.0','TR_CONTINUATION_NODE_24_21_0_REQUIRED');
 demand(await command('pnpm',['--version'],homedir())==='12.6.0','TR_CONTINUATION_PNPM_12_6_0_REQUIRED');
 demand(/^[a-f0-9]{40}$/.test(operatorMain??''),'TR_CONTINUATION_PINNED_OPERATOR_REQUIRED');
 const own=fileURLToPath(new URL('../../',import.meta.url));
 await inspectFailedTransfer(operatorMain);await green(CORRECTED_APP);await green(operatorMain);
 const home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),failed=join(root,'transfer-upgrade'),
  target=join(root,'transfer-continuation'),repo=join(target,'application');
 demand(await absent(target),'TR_CONTINUATION_ALREADY_STARTED_PRESERVE_AND_DO_NOT_RETRY');
 const cfg=await privateJson(join(root,'runtime-private.json')),container=await privateJson(join(root,'container-owned.json')),
  before=await privateJson(join(failed,'database-before-private.json')),configuration=await privateJson(join(failed,'configuration-private.json')),
  a=await privateJson(join(root,'actors-private.json')),fixture=await privateJson(join(root,'actors-fixture-private.json')),
  material=await privateJson(join(root,'material-configuration-private.json')),materialJourney=await privateJson(join(root,'material-journey-private.json'));
 const binding={sourceSha:'6fe8c4c22b002f66f00593975d381a284581f058',actors:a.actors,fixture,configuration:material,journey:materialJourney};
 const failedInventory=await priorInventory(failed),inventories=await privateJson(join(failed,'file-inventories-private.json'));
 await mkdir(target,{mode:0o700});await mkdir(join(target,'logs'),{mode:0o700});
 await seal(join(target,'started.json'),{failedSource:FAILED_SOURCE,correctedApp:CORRECTED_APP,operatorMain,startedAt:new Date().toISOString()});
 let db,browser,executable,copyMayBeRemoved=true,phase='BUILD',active=[],sourceStarted=false;
 const sql=(name,text)=>command('podman',['exec',container.id,'psql','--no-psqlrc','-U','proto_runtime','-d',name,'-At','-v','ON_ERROR_STOP=1','-c',text],own);
 const quiet=()=>sql('proto_a_01',"SELECT count(*) FROM pg_stat_activity WHERE datname='proto_a_01' AND pid<>pg_backend_pid()");
 async function ownProcess(p){
  const args=await command('/bin/ps',['-ww','-p',String(p.child.pid),'-o','command='],repo),uid=await command('/bin/ps',['-p',String(p.child.pid),'-o','uid='],repo),
   born=await command('/bin/ps',['-p',String(p.child.pid),'-o','lstart='],repo);
  demand(args===process.execPath+' '+p.entry&&uid===String(process.getuid())&&born===p.born,'TR_CONTINUATION_PROCESS_OWNERSHIP_DRIFT');
 }
 async function stopProcesses(){
  for(const p of [...active].reverse()){
   if(p.child.exitCode!==null||p.child.signalCode!==null)continue;
   await ownProcess(p);p.child.kill('SIGTERM');const until=Date.now()+30000;
   while(p.child.exitCode===null&&p.child.signalCode===null&&Date.now()<until)await pause(100);
   demand(p.child.exitCode!==null||p.child.signalCode!==null,'TR_CONTINUATION_OWNED_PROCESS_EXIT_UNCONFIRMED');
  }
  active=[];await freePort(33071,own);await freePort(44171,own);
 }
 try{
  await stage(target,'CLONE','git',['clone','--no-checkout',ORIGIN,repo],target);
  await stage(target,'PIN','git',['checkout','--detach',CORRECTED_APP],repo);
  demand(await command('git',['rev-parse','HEAD'],repo)===CORRECTED_APP&&await command('git',['status','--porcelain'],repo)==='','TR_CONTINUATION_CORRECTED_SOURCE_DRIFT');
  await stage(target,'INSTALL','pnpm',['install','--frozen-lockfile'],repo);
  await stage(target,'GENERATE','pnpm',['prisma:generate'],repo);
  await stage(target,'BUILD','pnpm',['build'],repo,{...environment(),NODE_ENV:'production',VITE_API_BASE_URL:API});
  const built={api:await artifactInventory(join(repo,'apps/api/dist')),web:await artifactInventory(join(repo,'apps/web/dist'))};
  await seal(join(target,'compiled-artifacts-private.json'),{applicationSha:CORRECTED_APP,operatorMain,...built});
  const require=createRequire(join(repo,'apps/api/package.json')),{PrismaClient}=require('@prisma/client');
  const url=name=>'postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/'+name+'?schema=public';
  const database=name=>new PrismaClient({datasources:{db:{url:url(name)}},log:[]});
  const snapshot=client=>client.$transaction(tx=>transferSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
  phase='CAPTURE_FAILED_STATE';await inspectFailedTransfer(operatorMain);
  demand(await quiet()==='0','TR_CONTINUATION_SOURCE_NOT_DRAINED');
  db=database('proto_a_01');const failedState=await snapshot(db);
  verifyFailedTransferState(before,failedState,configuration,binding);
  await db.$disconnect();db=undefined;
  await seal(join(target,'failed-state-private.json'),failedState);
  const preserved=join(target,'preserved'),rehearsal=join(target,'rehearsal');await mkdir(preserved,{mode:0o700});await mkdir(rehearsal,{mode:0o700});
  const dataInventories={};
  for(const name of ['documents','uploads','hrkeys']){
   dataInventories[name]=await privateInventory(join(root,name));
   for(const parent of [preserved,rehearsal]){
    await cp(join(root,name),join(parent,name),{recursive:true,force:false,errorOnExist:true});
    demand(digest(await privateInventory(join(parent,name)))===digest(dataInventories[name]),'TR_CONTINUATION_FILE_COPY_CHANGED');
   }
  }
  verifyDocumentInventory(failedState.documents,dataInventories.documents);
  await seal(join(target,'failed-stage-inventory-private.json'),failedInventory);
  await seal(join(target,'data-inventories-private.json'),dataInventories);
  demand(digest(await priorInventory(failed))===digest(failedInventory)&&await quiet()==='0','TR_CONTINUATION_FAILED_SOURCE_CHANGED_DURING_CAPTURE');
  const dump=join(preserved,'failed-source-postgresql.custom');
  await databaseStream(container.id,['pg_dump','-U','proto_runtime','-d','proto_a_01','--format=custom','--no-owner','--no-acl'],own,dump);
  demand((await lstat(dump)).size>1024,'TR_CONTINUATION_POPULATED_DUMP_REQUIRED');
  const dumpSha256=await fileHash(dump);
  await seal(join(target,'preservation-private.json'),{dumpSha256,dataInventories});
  async function verifyPreservedBackup(){
   demand(await fileHash(dump)===dumpSha256,'TR_CONTINUATION_PRESERVED_DUMP_CHANGED');
   for(const name of ['documents','uploads','hrkeys'])demand(digest(await privateInventory(join(preserved,name)))===digest(dataInventories[name]),'TR_CONTINUATION_PRESERVED_COPY_CHANGED');
  }
  phase='SEPARATE_REHEARSAL_RESTORE';
  demand(await sql('proto_a_01',"SELECT count(*) FROM pg_database WHERE datname='"+REHEARSAL_DB+"'")==='0','TR_CONTINUATION_REHEARSAL_TARGET_EXISTS_NO_OVERWRITE');
  await command('podman',['exec',container.id,'createdb','-U','proto_runtime','--owner=proto_runtime','--template=template0',REHEARSAL_DB],own);
  await databaseStream(container.id,['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','proto_runtime','-d',REHEARSAL_DB],own,dump,true);
  const runtime=async(name,store)=>({...environment(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33071',WEB_ORIGIN:WEB,DATABASE_URL:url(name),
   STORAGE_ROOT:join(store,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(store,'uploads'),
   HR_PRIVATE_KEYS:JSON.stringify(await privateJson(join(store,'hrkeys/keyring.json'))),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'});
  async function startProcesses(name,store,label){
   compareArtifactInventories(await artifactInventory(join(repo,'apps/api/dist')),built.api);
   compareArtifactInventories(await artifactInventory(join(repo,'apps/web/dist')),built.web);
   demand(await command('git',['rev-parse','HEAD'],repo)===CORRECTED_APP&&await command('git',['status','--porcelain'],repo)==='','TR_CONTINUATION_SOURCE_CHANGED_BEFORE_START');
   const apiEnvironment=await runtime(name,store);
   for(const [kind,port,entry,cwd,env]of [
    ['api',33071,join(repo,'apps/api/dist/main.js'),join(repo,'apps/api'),apiEnvironment],
    ['web',44171,join(repo,'deploy/uat/serve-web.mjs'),repo,{...environment(),WEB_HOST:'127.0.0.1',WEB_PORT:'44171'}]]){
    await freePort(port,own);const log=await open(join(target,'logs',label+'-'+kind+'-runtime.log'),'wx',0o600);
    const child=spawn(process.execPath,[entry],{cwd,env,detached:true,stdio:['ignore',log.fd,log.fd]});
    await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});await log.close();child.unref();
    const p={child,kind,port,entry,born:await command('/bin/ps',['-p',String(child.pid),'-o','lstart='],repo)};active.push(p);
    await seal(join(target,label+'-'+kind+'-owned.json'),{applicationSha:CORRECTED_APP,operatorMain,databaseName:name,pid:child.pid,entry,port,born:p.born});
   }
   let ready=false;const deadline=Date.now()+60000;
   while(Date.now()<deadline){
    demand(active.every(p=>p.child.exitCode===null&&p.child.signalCode===null),'TR_CONTINUATION_NEW_APPLICATION_EXITED');
    try{const h=await json(API+'/health/ready',2000),r=await fetch(WEB,{redirect:'error',signal:AbortSignal.timeout(2000)});
     if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'&&r.ok&&hash(await r.text())===hash(await readFile(join(repo,'apps/web/dist/index.html')))){ready=true;break;}
    }catch{}await pause(500);
   }
   demand(ready,'TR_CONTINUATION_NEW_APPLICATION_NOT_READY');
   for(const p of active){await ownProcess(p);
    const all=await command('lsof',['-nP','-iTCP:'+p.port,'-sTCP:LISTEN','-Fpf'],repo),one=await command('lsof',['-nP','-a','-p',String(p.child.pid),'-iTCP:'+p.port,'-sTCP:LISTEN'],repo);
    demand(hasSoleListenerPid(all,p.child.pid)&&one.includes('127.0.0.1:'+p.port)&&!one.includes('*:'+p.port),'TR_CONTINUATION_LISTENER_DRIFT');
   }
  }
  async function runJourney(client,label){
   const initial=await snapshot(client);demand(digest(initial)===digest(failedState),'TR_CONTINUATION_RESTORED_OR_SOURCE_ROWS_DIFFER');
   const source=await prepareTransferContinuationSource(client,binding,configuration,{before,stateSha256:digest(initial)},{api:API,web:WEB});
   await seal(join(target,label+'-source-private.json'),{id:source.id,number:source.number,spentNumberPreserved:source.spentNumberPreserved,policyReplayed:source.policyReplayed});
   copyMayBeRemoved=false;
   try{browser=await startBrowser(executable.executable,label==='rehearsal'?rehearsal:target);}catch(e){copyMayBeRemoved=e.browserProcessExited===true;throw e;}
   const result=await executeTransferBrowser(browser.protocol,await transferBrowserBinding(client,binding,configuration,source,{api:API,web:WEB}),client);
   await browser.stop();browser=undefined;copyMayBeRemoved=true;
   const after=await snapshot(client);
   verifyTransferJourneyPreservation(source.baseline,after,configuration,binding,source,result);
   verifyDocumentInventory(after.documents,await privateInventory(join(label==='rehearsal'?rehearsal:root,'documents')));
   await seal(join(target,label+'-database-after-private.json'),after);await seal(join(target,label+'-journey-private.json'),result);
   return {source,result,after};
  }
  executable=await prepareBrowser(await discoverBrowser(),target);
  db=database(REHEARSAL_DB);demand(digest(await snapshot(db))===digest(failedState),'TR_CONTINUATION_RESTORED_ROWS_DIFFER');
  phase='REHEARSAL_RUNTIME';await startProcesses(REHEARSAL_DB,rehearsal,'rehearsal');
  phase='REHEARSAL_JOURNEY';await runJourney(db,'rehearsal');await db.$disconnect();db=undefined;
  await stopProcesses();
  // The populated source must still be the exact observed failure, including
  // its original dump/files/keys/receipts and consumed number. No migration runs.
  phase='SOURCE_RECHECK';await inspectFailedTransfer(operatorMain);
  await verifyPreservedBackup();
  demand(await quiet()==='0'&&digest(await priorInventory(failed))===digest(failedInventory),'TR_CONTINUATION_SOURCE_CHANGED_AFTER_REHEARSAL');
  db=database('proto_a_01');demand(digest(await snapshot(db))===digest(failedState),'TR_CONTINUATION_SOURCE_CHANGED_AFTER_REHEARSAL');
  phase='SOURCE_RUNTIME';sourceStarted=true;await startProcesses('proto_a_01',root,'source');
  phase='SOURCE_JOURNEY';const completed=await runJourney(db,'source');
  phase='FINAL_PRESERVATION';
  await verifyPreservedBackup();
  for(const [name,saved]of Object.entries(inventories)){
   const value=Array.isArray(saved)?(['fm03-upgrade','receiving-upgrade'].includes(name)?await priorInventory(join(root,name)):await privateInventory(join(root,name))):await fileHash(join(root,name));
   if(name==='documents')verifyTransferDocumentFiles(saved,value,completed.after.documents.filter(d=>completed.result.documentIds.includes(d.id)));
   else demand(digest(value)===digest(saved),'TR_CONTINUATION_PRIOR_FILES_CHANGED');
  }
  demand(digest(await priorInventory(failed))===digest(failedInventory),'TR_CONTINUATION_FAILED_STAGE_CHANGED');
  for(const name of ['uploads','hrkeys'])demand(digest(await privateInventory(join(root,name)))===digest(dataInventories[name]),'TR_CONTINUATION_KEYS_OR_UPLOADS_CHANGED');
  const receipt={status:'TRANSFER_PRESERVED_STATE_CONTINUATION_AND_BROWSER_VERIFIED',failedSource:FAILED_SOURCE,applicationSha:CORRECTED_APP,operatorMainSha:operatorMain,
   sourceHistoryPreserved:true,originalFailedStagePreserved:true,spentNumberPreserved:true,policyNotReplayed:true,schemaAndConfigurationUnchanged:true,
   populatedFailureDumpSha256:dumpSha256,separatePopulatedContinuationRehearsalVerified:true,
   documentsUploadsKeysAndPriorReceiptsPreserved:true,approvalHasNoStockEffect:true,originDispatchDeductedOnce:true,actualDestinationReceiptCredited:true,
   explicitReceiverAssignmentVerified:true,partialOutstandingPreserved:true,sameReceiptEvidenceUploaded:true,threeLocalesVerified:true,
   wrongActorDenialVerified:true,sessionsRevoked:true,fullBusinessJourneysVerified:false,milestone7Complete:false,prototypeFrozen:false,
   humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
  await seal(join(target,'ready.json'),receipt);return receipt;
 }catch(e){
  try{await stopProcesses();}catch{}
  await seal(join(target,'failure-private.json'),{phase,code:e.safeCode??'TR_CONTINUATION_PRIVATE_FAILURE',sourceStarted,
   automaticRetryAllowed:false,originalFailedStageMustBePreserved:true});throw e;
 }finally{
  try{if(browser){await browser.stop();browser=undefined;copyMayBeRemoved=true;}}finally{try{if(executable&&copyMayBeRemoved)await executable.cleanup();}finally{if(db)await db.$disconnect();}}
 }
}
const entry=process.argv[1]&&await realpath(resolve(process.argv[1])).catch(()=>null);
if(entry&&entry===await realpath(new URL(import.meta.url))){
 try{demand(process.argv.length===4&&process.argv[2]==='--execute','TR_CONTINUATION_EXECUTE_AND_SHA_REQUIRED');console.log(JSON.stringify(await continueTransfer(process.argv[3])));}
 catch(e){console.log(JSON.stringify({status:'TRANSFER_CONTINUATION_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'TR_CONTINUATION_PRIVATE_FAILURE',
  doNotRetryOrReplayCompletedOperators:true,productionAuthorized:false,secretsPrinted:false}));process.exitCode=1;}
}
