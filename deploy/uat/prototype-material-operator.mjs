#!/usr/bin/env node
// #338 guarded Mac material follow-up. Preserves initial runtime/actor/browser receipts.
import {homedir} from 'node:os';
import {join} from 'node:path';
import {lstat,realpath,readFile,readdir,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SOURCE,API,WEB,validReady,validConfig,validContainer,privateFile,safeEnvironment,isEntry} from './prototype-actors.mjs';
import {validActorReceipt,validPrivateActors,businessFingerprint} from './prototype-browser-operator.mjs';
import {inspectMaterialConfiguration} from './prototype-material-configuration.mjs';
import {inspectMaterialPreconditions} from './prototype-material-preconditions.mjs';
import {verifyMaterialArtifacts} from './prototype-material-artifacts.mjs';
import {planMaterialConfiguration,applyMaterialConfiguration} from './prototype-material-configure.mjs';
import {executeMaterialRun} from './prototype-material-run.mjs';

const PREDECESSOR='76295ef9ecc3ada2dca2549cf514f3fbdc6a634b';
const modules=['prototype-material-operator.mjs','prototype-material-preconditions.mjs',
  'prototype-material-configuration.mjs','prototype-material-artifacts.mjs','prototype-material-configure.mjs',
  'prototype-material-source.mjs','prototype-material-journey.mjs','prototype-material-run.mjs','prototype-material-http.mjs','prototype-actors.mjs','prototype-browser-operator.mjs',
  'prototype-browser.mjs','prototype-browser-executable.mjs'].map(x=>'deploy/uat/'+x);
const allowed=new Set([
  '.github/workflows/validate.yml','docs/CURRENT-STATE.md',
  'deploy/uat/prototype-runtime-operator.mjs','deploy/uat/prototype-actors.mjs',
  'deploy/uat/prototype-actors-native.mjs','deploy/uat/prototype-browser.mjs',
  'deploy/uat/prototype-browser-operator.mjs','deploy/uat/prototype-browser-executable.mjs',
  'deploy/uat/prototype-material-http.mjs','deploy/uat/prototype-material-http-native.mjs','deploy/uat/prototype-material-run-native.mjs','deploy/uat/prototype-material-artifacts-native.mjs',
  'deploy/uat/prototype-material-configuration.mjs','deploy/uat/prototype-material-preconditions.mjs',
  ...['operator','artifacts','configure','source','journey','run'].map(x=>'deploy/uat/prototype-material-'+x+'.mjs'),
  ...['prototype-runtime-operator','prototype-actors','prototype-browser','prototype-browser-executable',
    'prototype-material-artifacts','prototype-material-configure','prototype-material-source','prototype-material-journey','prototype-material-run','prototype-material-http','prototype-material-configuration','prototype-material-preconditions','prototype-material-operator']
    .map(x=>'deploy/release-candidate/'+x+'.test.mjs'),
  ...['PROTOTYPE-RUNTIME-OPERATOR','PROTOTYPE-ACTOR-OPERATOR','PROTOTYPE-BROWSER-OPERATOR',
    'PROTOTYPE-MATERIAL-HTTP-BOUNDARY'].map(x=>'docs/'+x+'.md'),
  'docs/ROLE-REQUIREMENTS-2026-10-30/14-preproduction-reconciliation.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/README.md',
]);
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
  return compare?.status==='ahead'&&compare.files?.length>0&&compare.files.length<=allowed.size+1&&
    compare.files.every(f=>['added','modified'].includes(f.status)&&!f.previous_filename&&
      (allowed.has(f.filename)||(f.filename==='apps/api/src/inventory/prototype-material-journey.integration.spec.ts'&&
        f.status==='modified'&&f.sha==='f77c9503a39a2dea6a9047599802a19097a5e026')));
}
export function validBrowserProof(r,e){
  return r?.status==='SYNTHETIC_BROWSER_INITIAL_READBACK_VERIFIED'&&r.sourceSha===SOURCE&&r.operatorMainSha===PREDECESSOR&&
    r.functionalActors===8&&r.technicalAdminProbed===true&&r.browserChecks===126&&
    r.initialAuthenticatedBrowserVerified===true&&r.businessStateUnchanged===true&&r.browserSessionsRevoked===true&&
    ['productionAuthorized','retainedResourcesUsed','humanUatCompleted','prototypeFrozen','fullBusinessRoleMatrixVerified',
      'fullAuthenticatedBrowserJourneysVerified','populatedRecoveryVerified','secretsPrinted'].every(k=>r[k]===false)&&
    e?.sourceSha===SOURCE&&e.operatorMainSha===r.operatorMainSha&&e.functionalActors===8&&e.technicalAdminProbed===true&&
    e.browserChecks===126&&e.observations?.length===126&&e.observations.every(o=>o.passed===true)&&
    /^[a-f0-9]{64}$/.test(e.businessFingerprint??'');
}
async function exclusive(path,value){
  const file=await open(path,'wx',0o600);
  try{await file.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await file.close();}
}
async function preflight(mode){
  demand(process.platform==='darwin'&&process.getuid()>0,'NONROOT_MAC_OPERATOR_REQUIRED');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(!Object.keys(process.env).some(k=>/^PRISMA_|^NODE_OPTIONS$|^NODE_PATH$/.test(k)),'INHERITED_RUNTIME_OVERRIDE_REFUSED');
  const home=homedir(),checkout=join(home,'Construction-ERP-Prototype-Checkout'),root=join(home,'Construction-ERP-Prototype-Runtime');
  await directory(home);await directory(checkout);await directory(root,true);
  for(const sub of ['db','documents','hrkeys','logs','uploads'])await directory(join(root,sub),true);
  for(const file of ['material-started.json','material-ready.json','material-evidence-private.json','material-configuration-started.json','material-configuration-private.json',
    'material-journey-private.json','material-sessions-private.json','material-failure-private.json']){
    try{await lstat(join(root,file));demand(false,'MATERIAL_PRIOR_FOLLOWUP_REFUSED');}
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
    const binding={sourceSha:SOURCE,actors:privateActors.actors,fixture,initial:evidence.results};
    demand(await businessFingerprint(db)===browserEvidence.businessFingerprint,'MATERIAL_INITIAL_BUSINESS_STATE_CHANGED');
    const request=await db.materialRequest.findUnique({where:{id:evidence.results.requestId}});
    demand(request?.companyId===fixture.companyId&&request.projectId===fixture.projectId&&
      request.warehouseId===fixture.warehouseId,'MATERIAL_ORIGINAL_REQUEST_CHANGED');
    try{binding.sourceMapping=await privateFile(join(root,'material-source-mapping-private.json'));}
    catch(e){if(e.code!=='ENOENT')throw e;}
    try{
      const selected=await privateFile(join(root,'material-document-type-private.json'));
      demand(Object.keys(selected).sort().join(',')==='documentTypeId,sourceSha'&&selected.sourceSha===SOURCE&&
        /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(selected.documentTypeId??''),'MATERIAL_DOCUMENT_TYPE_SELECTION_INVALID');
      binding.documentTypeId=selected.documentTypeId;
    }catch(e){if(e.code!=='ENOENT')throw e;}
    const configuration=await inspectMaterialConfiguration(db,binding),
      preconditions=await inspectMaterialPreconditions(db,binding);
    const delta=await planMaterialConfiguration(db,binding);
    if(mode==='--execute'){
      // Same invocation re-establishes target/build/process/schema and the
      // original receipt state. A previous --plan receipt never authorizes this.
      await exclusive(join(root,'material-started.json'),{sourceSha:SOURCE,operatorMainSha:main,
        startedAt:new Date().toISOString(),expectedStateSha256:delta.stateSha256});
      const applied=await applyMaterialConfiguration(db,binding,delta.stateSha256);
      await exclusive(join(root,'material-configuration-private.json'),applied);
      const result=await executeMaterialRun(db,binding,applied,{api:API,web:WEB},
        (kind,value)=>exclusive(join(root,'material-'+kind+'-private.json'),value));
      const ready={...result,operatorMainSha:main,compiledArtifactBytesVerified:true,
        actualUiJourneyVerified:false,prototypeFrozen:false};
      await exclusive(join(root,'material-ready.json'),ready);return ready;
    }
    // This is observation only. A future write operation must repeat every
    // check and compare exact state inside its locked configuration transaction.
    return {status:'MATERIAL_READ_ONLY_PLAN_OBSERVED',sourceSha:SOURCE,operatorMainSha:main,
      runtimeReceiptsProcessesContainerAndSchemaVerified:true,
      runtimeArtifactComparisonRequired:false,compiledArtifactBytesVerified:true,artifacts,targetCustodyVerified:true,
      configuration,preconditions,configurationStateSha256:delta.stateSha256,persistentFilesCreated:0,configurationApplied:false,
      writeJourneyAuthorized:false,fullAuthenticatedBrowserJourneysVerified:false,
      populatedRecoveryVerified:false,prototypeFrozen:false,humanUatCompleted:false,
      productionAuthorized:false,secretsPrinted:false};
  }finally{await db.$disconnect();}
}

export async function operator(mode){
  demand(['--plan','--execute'].includes(mode),'MATERIAL_USE_PLAN_OR_EXECUTE');
  return preflight(mode);
}
if(await isEntry(process.argv[1],import.meta.url)){
  try{demand(process.argv.length===3,'MATERIAL_USE_PLAN_OR_EXECUTE');console.log(JSON.stringify(await operator(process.argv[2]),null,2));}
  catch(e){console.log(JSON.stringify({status:'MATERIAL_OPERATOR_BLOCKED',
    code:e.safeCode??'MATERIAL_OPERATOR_FAILED',configurationMayHaveBeenApplied:process.argv[2]==='--execute',writeJourneyAuthorized:false,
    productionAuthorized:false,secretsPrinted:false},null,2));process.exitCode=1;}
}
