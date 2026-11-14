#!/usr/bin/env node
// #338 post-run real UI: preserve completed material API history; revise its note only.
import {homedir} from 'node:os';
import {join} from 'node:path';
import {lstat,realpath,readFile,readdir,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SOURCE,API,WEB,validReady,validConfig,validContainer,privateFile,safeEnvironment,isEntry} from './prototype-actors.mjs';
import {validActorReceipt,validPrivateActors} from './prototype-browser-operator.mjs';
import {toolingOnly as materialToolingOnly,validBrowserProof} from './prototype-material-operator.mjs';
import {verifyMaterialArtifacts} from './prototype-material-artifacts.mjs';
import {materialUiSnapshot,verifyMaterialUiPreservation,validMaterialRunReceipt,MATERIAL_MAIN} from './prototype-material-ui-state.mjs';
import {materialUiRevision} from './prototype-material-ui.mjs';
import {startBrowser} from './prototype-browser.mjs';
import {discoverBrowser,prepareBrowser} from './prototype-browser-executable.mjs';
const modules=['prototype-material-ui-operator.mjs','prototype-material-ui.mjs','prototype-material-ui-state.mjs',
  'prototype-material-operator.mjs','prototype-material-preconditions.mjs','prototype-material-configuration.mjs',
  'prototype-material-artifacts.mjs','prototype-material-configure.mjs','prototype-material-source.mjs',
  'prototype-material-journey.mjs','prototype-material-run.mjs','prototype-material-http.mjs',
  'prototype-actors.mjs','prototype-browser-operator.mjs','prototype-browser.mjs','prototype-browser-executable.mjs']
  .map(x=>'deploy/uat/'+x);
const extra=new Set(['deploy/uat/prototype-material-ui-operator.mjs','deploy/uat/prototype-material-ui.mjs',
  'deploy/uat/prototype-material-ui-state.mjs','deploy/release-candidate/prototype-material-ui.test.mjs']);
// Only the three Owner-requested governance blobs from #342 may coexist with
// the pinned app; arbitrary governance/application changes remain refused.
const governance={
  'AGENTS.md':'3ddba391916ee2a9b04b44c5357240c7cb66f03d',
  'docs/DEVELOPMENT-OPERATING-MODEL.md':'7ca1eea47829a18f25930afeda8abd8aee0554bb',
  'docs/DECISION-LOG.md':'154b32f7f9f05b17961cafd75a9a585dd8255ec4',
};
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const execute=promisify(execFile);
async function command(exe,args,cwd){
  try{return (await execute(exe,args,{cwd,env:safeEnvironment(),timeout:20000,maxBuffer:2097152})).stdout.trim();}
  catch{throw Object.assign(new Error(),{safeCode:'MATERIAL_TARGET_IDENTITY_COMMAND_FAILED'});}
}
async function jsonFetch(url){
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ERP-Prototype-Material-Plan'}});
  demand(r.ok,'MATERIAL_SOURCE_OR_HEALTH_CHECK_FAILED');return r.json();
}
async function directory(path,privateOnly=false){
  const s=await lstat(path);
  demand(s.isDirectory()&&!s.isSymbolicLink()&&await realpath(path)===path&&s.uid===process.getuid()&&
    !(s.mode&(privateOnly?0o077:0o022)),'MATERIAL_UNSAFE_DIRECTORY');
}
export function toolingOnly(compare){
  if(compare?.status!=='ahead'||!Array.isArray(compare.files)||!compare.files.length||compare.files.length>100)return false;
  const remaining=[];
  for(const file of compare.files){
    if(!['added','modified'].includes(file.status)||file.previous_filename)return false;
    if(extra.has(file.filename))continue;
    if(governance[file.filename]){if(file.status!=='modified'||file.sha!==governance[file.filename])return false;continue;}
    remaining.push(file);
  }
  return materialToolingOnly({...compare,files:remaining});
}
async function exclusive(path,value){
  const file=await open(path,'wx',0o600);
  try{await file.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await file.close();}
}
async function preflight(){
  demand(process.platform==='darwin'&&process.getuid()>0,'NONROOT_MAC_OPERATOR_REQUIRED');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(!Object.keys(process.env).some(k=>/^PRISMA_|^NODE_OPTIONS$|^NODE_PATH$/.test(k)),'INHERITED_RUNTIME_OVERRIDE_REFUSED');
  const home=homedir(),checkout=join(home,'Construction-ERP-Prototype-Checkout'),root=join(home,'Construction-ERP-Prototype-Runtime');
  await directory(home);await directory(checkout);await directory(root,true);
  for(const sub of ['db','documents','hrkeys','logs','uploads'])await directory(join(root,sub),true);
  for(const file of ['material-ui-started.json','material-ui-ready.json','material-ui-evidence-private.json','material-ui-failure-private.json']){
    try{await lstat(join(root,file));demand(false,'MATERIAL_UI_ALREADY_STARTED_NO_OVERWRITE');}
    catch(e){if(e.code!=='ENOENT')throw e;}
  }
  const ready=await privateFile(join(root,'runtime-ready.json')),config=await privateFile(join(root,'runtime-private.json'));
  demand(validReady(ready)&&validConfig(config),'WRONG_RUNNING_PROTOTYPE');
  const actorReceipt=await privateFile(join(root,'actors-ready.json')),privateActors=await privateFile(join(root,'actors-private.json'));
  demand(validActorReceipt(actorReceipt)&&validPrivateActors(privateActors),'BROWSER_ACTOR_RECEIPT_OR_PRIVATE_BINDING_INVALID');
  const fixture=await privateFile(join(root,'actors-fixture-private.json')),
    evidence=await privateFile(join(root,'actors-http-evidence-private.json'));
  demand(fixture.sourceSha===SOURCE&&evidence.sourceSha===SOURCE&&JSON.stringify(evidence.fixture)===JSON.stringify(
    Object.fromEntries(Object.entries(fixture).filter(([k])=>k!=='sourceSha')))&&evidence.results?.initialHttpChecks===114&&
    evidence.observations?.length===123,'BROWSER_INITIAL_EVIDENCE_BINDING_MISMATCH');
  const browserReceipt=await privateFile(join(root,'browser-ready.json')),
    browserEvidence=await privateFile(join(root,'browser-evidence-private.json'));
  demand(validBrowserProof(browserReceipt,browserEvidence),'MATERIAL_PRIOR_BROWSER_PROOF_INVALID');
  const manifest=await privateFile(join(root,'prototype-target.json'));
  demand(manifest.expectedMainSha===SOURCE&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&
    manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&manifest.runtime?.checkoutRoot===checkout&&
    manifest.runtime.databaseRoot===join(root,'db')&&manifest.runtime.documentsRoot===join(root,'documents')&&
    manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&manifest.runtime.isolationRoot===root&&
    manifest.runtime.apiOrigin===config.apiOrigin&&manifest.runtime.webOrigin===WEB&&
    manifest.runtime.postgresHost==='127.0.0.1'&&manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01',
    'WRONG_TARGET_MANIFEST');
  demand(await command('git',['rev-parse','HEAD'],checkout)===SOURCE&&await command('git',['status','--porcelain'],checkout)==='',
    'SOURCE_CHANGED_STOP');
  demand(['https://github.com/threeswordz/cinder-grind.git','https://github.com/threeswordz/cinder-grind']
    .includes(await command('git',['remote','get-url','origin'],checkout)),'WRONG_SOURCE_ORIGIN');
  const main=(await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/branches/main')).commit?.sha;
  demand(/^[a-f0-9]{40}$/.test(main??''),'MAIN_SHA_REQUIRED');
  demand(toolingOnly(await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+SOURCE+'...'+main)),
    'APPLICATION_CHANGED_RECONCILIATION_REQUIRED');
  const runs=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/actions/runs?head_sha='+main+'&event=push&per_page=20');
  demand(runs.workflow_runs?.some(r=>r.head_sha===main&&r.path==='.github/workflows/validate.yml'&&r.event==='push'&&
    r.status==='completed'&&r.conclusion==='success'),'EXACT_OPERATOR_MAIN_CI_REQUIRED');
  for(const path of modules){
    const published=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/contents/'+path+'?ref='+main);
    const local=new URL('./'+path.split('/').at(-1),import.meta.url);
    demand(published.sha===blob(await readFile(local)),'BROWSER_MODULE_BYTES_NOT_GREEN_MAIN');
  }
  const connections=JSON.parse(await command('podman',['system','connection','list','--format','json'],checkout));
  const defaults=connections.filter(c=>c.Default===true),connection=defaults[0];
  demand(defaults.length===1&&connection.Name==='podman-machine-default'&&
    /^ssh:\/\/core@127\.0\.0\.1:\d+\/run\/user\/\d+\/podman\/podman.sock$/.test(connection.URI??''),'WRONG_LOCAL_PODMAN_CONNECTION');
  demand(await command('podman',['info','--format','{{.Host.Security.Rootless}}'],checkout)==='true','ROOTLESS_PODMAN_REQUIRED');
  const receipt=await privateFile(join(root,'container-owned.json')),
    inspected=JSON.parse(await command('podman',['inspect',receipt.id],checkout));
  demand(inspected.length===1&&validContainer(inspected[0],receipt,join(root,'db'))&&receipt.image===ready.imageId,
    'RUNNING_DATABASE_IDENTITY_MISMATCH');
  for(const [kind,port,entry] of [['api',33071,join(checkout,'apps/api/dist/main.js')],['web',44171,join(checkout,'deploy/uat/serve-web.mjs')]]){
    const p=await privateFile(join(root,kind+'-owned.json'));
    demand(p.sourceSha===SOURCE&&p.entry===entry&&Number.isSafeInteger(p.pid)&&p.pid>1,'WRONG_OWNED_PROCESS');
    demand(await command('/bin/ps',['-ww','-p',String(p.pid),'-o','command='],checkout)===process.execPath+' '+entry,'PROCESS_COMMAND_CHANGED');
    const listener=await command('lsof',['-nP','-a','-p',String(p.pid),'-iTCP:'+port,'-sTCP:LISTEN'],checkout);
    demand(listener.includes('127.0.0.1:'+port)&&!listener.includes('*:'+port),'WRONG_OWNED_LISTENER');
  }
  demand(sha(await readFile(join(checkout,'apps/web/dist/index.html')))===ready.webIndexSha256,'WEB_BUILD_CHANGED');
  const health=await jsonFetch(API+'/health/ready');
  demand(health.status==='ok'&&health.database==='ok'&&health.documentStorage==='ok','RUNTIME_NOT_READY');
  const runReady=await privateFile(join(root,'material-ready.json')),
    started=await privateFile(join(root,'material-started.json')),
    configuration=await privateFile(join(root,'material-configuration-private.json')),
    journey=await privateFile(join(root,'material-journey-private.json')),
    sessions=await privateFile(join(root,'material-sessions-private.json'));
  demand(validMaterialRunReceipt(runReady)&&started.sourceSha===SOURCE&&started.operatorMainSha===MATERIAL_MAIN&&sessions.revoked===true,
    'MATERIAL_UI_COMPLETED_API_RECEIPT_REQUIRED');
  const artifacts=await verifyMaterialArtifacts(checkout);
  const req=createRequire(join(checkout,'apps/api/package.json')),{PrismaClient}=req('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:'postgresql://proto_runtime:'+config.databasePassword+'@127.0.0.1:55471/proto_a_01?schema=public'}},log:[]});
  try{
    const identity=await db.$queryRawUnsafe('SELECT current_database() AS name,current_user AS username');
    demand(identity.length===1&&identity[0].name==='proto_a_01'&&identity[0].username==='proto_runtime','DATABASE_CONNECTION_MISMATCH');
    const applied=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
    const migrations=await readdir(join(checkout,'apps/api/prisma/migrations'),{withFileTypes:true}),expected=[];
    for(const m of migrations.filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))expected.push({name:m.name,
      checksum:sha(await readFile(join(checkout,'apps/api/prisma/migrations',m.name,'migration.sql')))});
    demand(applied.length===expected.length&&applied.every((m,i)=>m.migration_name===expected[i].name&&
      m.checksum===expected[i].checksum&&m.finished_at&&!m.rolled_back_at),'SCHEMA_PROVENANCE_MISMATCH');
    const binding={sourceSha:SOURCE,actors:privateActors.actors,fixture,configuration,journey};
    const snapshot=await materialUiSnapshot(db,binding);
    return {root,checkout,db,binding,snapshot,operatorMainSha:main,artifacts};
  }catch(e){await db.$disconnect();throw e;}
}
export async function operator(mode){
  demand(mode==='--execute','MATERIAL_UI_EXECUTE_ONLY');
  const context=await preflight();let browser,executable,mayRemoveCopy=true;
  try{
    const selection=await discoverBrowser();executable=await prepareBrowser(selection,context.root);
    await exclusive(join(context.root,'material-ui-started.json'),{sourceSha:SOURCE,operatorMainSha:context.operatorMainSha,
      originalMaterialMainSha:MATERIAL_MAIN,startedAt:new Date().toISOString(),requestId:context.binding.journey.requestId});
    mayRemoveCopy=false;
    try{browser=await startBrowser(executable.executable,context.root);}catch(e){mayRemoveCopy=e.browserProcessExited===true;throw e;}
    const b=context.binding,f=b.fixture,j=b.journey;
    const result=await materialUiRevision(browser.protocol,{sourceSha:SOURCE,api:API,web:WEB,companyId:f.companyId,
      projectId:f.projectId,warehouseId:f.warehouseId,requestId:j.requestId,documentId:j.documentId,
      actors:Object.fromEntries(['STORE_SITE','FOREMAN'].map(key=>[key,{...b.actors[key],permissions:context.snapshot.permissions[key]}]))});
    await browser.stop();mayRemoveCopy=true;browser=undefined;
    await executable.cleanup();executable=undefined;
    const after=await materialUiSnapshot(context.db,b);verifyMaterialUiPreservation(context.snapshot,after);
    await exclusive(join(context.root,'material-ui-evidence-private.json'),{...result,sourceSha:SOURCE,
      operatorMainSha:context.operatorMainSha,unrelatedBusinessStateSha256:after.preservedSha256});
    const receipt={status:'MATERIAL_RETAINED_REQUEST_UI_REVISION_VERIFIED',sourceSha:SOURCE,
      operatorMainSha:context.operatorMainSha,originalMaterialMainSha:MATERIAL_MAIN,
      materialRequestUiRevisionVerified:true,signedHistoryPreserved:true,unrelatedBusinessStateUnchanged:true,
      stockAndFinanceUnchanged:true,uiSessionsRevoked:true,priorVersion:result.priorVersion,version:result.version,
      fullAuthenticatedBrowserJourneysVerified:false,populatedRecoveryVerified:false,prototypeFrozen:false,
      humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
    await exclusive(join(context.root,'material-ui-ready.json'),receipt);return receipt;
  }catch(e){
    try{await exclusive(join(context.root,'material-ui-failure-private.json'),{sourceSha:SOURCE,
      code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'MATERIAL_UI_OPERATOR_FAILED',partialStateMayExist:true});}catch{}
    throw e;
  }finally{
    try{if(browser){await browser.stop();mayRemoveCopy=true;}}
    finally{try{if(executable&&mayRemoveCopy)await executable.cleanup();}finally{await context.db.$disconnect();}}
  }
}
if(await isEntry(process.argv[1],import.meta.url)){
  try{demand(process.argv.length===3,'MATERIAL_UI_EXECUTE_ONLY');console.log(JSON.stringify(await operator(process.argv[2]),null,2));}
  catch(e){console.log(JSON.stringify({status:'MATERIAL_UI_OPERATOR_BLOCKED',code:e.safeCode??'MATERIAL_UI_OPERATOR_FAILED',
    partialStateMayExist:true,productionAuthorized:false,secretsPrinted:false},null,2));process.exitCode=1;}
}
