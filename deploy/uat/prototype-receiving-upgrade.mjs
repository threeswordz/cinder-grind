#!/usr/bin/env node
// One bounded populated Mac upgrade. No fixture/bootstrap/reset/rollback/retry.
// Builtins only until a green governed source tree has been cloned and pinned.
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {lstat,realpath,readdir,readFile,mkdir,open,cp} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pipeline} from 'node:stream/promises';
export const ORIGINAL='6fe8c4c22b002f66f00593975d381a284581f058';
export const PREVIOUS_OPERATOR='d2b790801119fb1b5b4176ad416086ee7363d091';
export const PREVIOUS_APP='c48447566f56302e561b86a07380fdab6f68f97c';
// PR #356 was independently reviewed, merged with exact-tree equality, and is the
// only receiving application baseline accepted before Owner documentation updates.
export const REVIEWED_APP='211df5425c182cf8c79bfbd1e69556371b6b1fce';
export const RESTORE_DB='proto_a_01_receiving_preupgrade';
const ORIGIN='https://github.com/threeswordz/cinder-grind.git';
const API='http://127.0.0.1:33071/api/v1',WEB='http://127.0.0.1:44171';
const SELF='deploy/uat/prototype-receiving-upgrade.mjs';
const PACKAGE=new Set([SELF,'deploy/release-candidate/prototype-receiving-upgrade.test.mjs',
  // Only PR #357 approved Owner documentation paths. Never expand this to
  // application code, schema, executable tests or arbitrary documents.
  'docs/BOQ-COMMERCIAL-SCOPE.md',
  'docs/CURRENT-STATE.md',
  'docs/DECISION-LOG.md',
  'docs/DEVELOPMENT-ROADMAP.md',
  'docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md',
  'docs/REQUIREMENTS.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/00-shared-workflows.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/01-ben.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/02-nancy.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/03-khaimook.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/04-jai.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/05-store-site.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/06-foreman.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/07-porn.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/08-koh.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/11-launch-scope-and-next-package.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/12-decisions-and-sources.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/14-preproduction-reconciliation.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/15-owner-decisions-2026-11-16.md',
  'docs/ROLE-REQUIREMENTS-2026-10-30/README.md',
  'docs/ROLES-PERMISSIONS.md'
]);
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const hash=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const run=promisify(execFile),pause=ms=>new Promise(r=>setTimeout(r,ms));
const environment=()=>Object.fromEntries(['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL']
  .filter(k=>typeof process.env[k]==='string').map(k=>[k,process.env[k]]));
export function validUpgradeDelta(c){return c?.status==='ahead'&&Array.isArray(c.files)&&c.files.length>0&&
  c.files.length<=PACKAGE.size&&c.files.every(f=>PACKAGE.has(f.filename)&&['added','modified'].includes(f.status)&&!f.previous_filename);}
// lsof versions differ in whether -Fp also emits descriptor fields. Request
// both fields explicitly and accept one exact PID followed only by descriptors.
// Never accept a second process, unknown fields or raw output in an error.
export function hasSoleListenerPid(output,pid){
  if(typeof output!=='string'||!Number.isSafeInteger(pid)||pid<=1)return false;
  const fields=output.split('\n');if(fields.at(-1)==='')fields.pop();
  const descriptors=fields.slice(1);
  return fields[0]==='p'+pid&&descriptors.length>0&&
    descriptors.every(f=>/^f[0-9]+$/.test(f))&&new Set(descriptors).size===descriptors.length;
}
async function command(exe,args,cwd,env=environment(),timeout=30000){
  try{return (await run(exe,args,{cwd,env,timeout,maxBuffer:2097152})).stdout.trim();}
  catch{demand(false,'RC_UPGRADE_COMMAND_FAILED');}
}
async function directory(path,privateOnly=false){
  const s=await lstat(path);demand(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&
    !(s.mode&(privateOnly?0o077:0o022))&&await realpath(path)===path,'RC_UPGRADE_UNSAFE_DIRECTORY');
}
async function privateJson(path){
  const s=await lstat(path);demand(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===process.getuid()&&
    !(s.mode&0o077)&&s.size<=1048576,'RC_UPGRADE_UNSAFE_PRIVATE_RECEIPT');return JSON.parse(await readFile(path,'utf8'));
}
async function absent(path){try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function seal(path,value){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await f.close();}}
async function json(url,timeout=20000){const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(timeout),
  headers:{'User-Agent':'Construction-ERP-RC_UPGRADE-Upgrade'}});demand(r.ok,'RC_UPGRADE_RELEASE_OR_HEALTH_FETCH_FAILED');return r.json();}
async function green(sha){const r=await json('https://api.github.com/repos/threeswordz/cinder-grind/actions/runs?head_sha='+sha+'&event=push&per_page=20');
  demand(r.workflow_runs?.some(w=>w.head_sha===sha&&w.head_branch==='main'&&w.event==='push'&&w.path==='.github/workflows/validate.yml'&&
    w.status==='completed'&&w.conclusion==='success'),'RC_UPGRADE_EXACT_MAIN_CI_REQUIRED');}
// Includes directory names and every byte; rejects links, shared writable files,
// changed-during-read files and special files. Empty directories are retained.
export async function privateInventory(root){
  await directory(root,true);const entries=[];
  async function visit(path,name){
    const s=await lstat(path);demand(!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022)&&
      (s.isDirectory()||s.isFile()),'RC_UPGRADE_UNSAFE_PRESERVATION_ENTRY');
    if(s.isDirectory()){
      demand(await realpath(path)===path,'RC_UPGRADE_PRESERVATION_DIRECTORY_DRIFT');entries.push([name,'directory']);
      for(const n of (await readdir(path)).sort())await visit(join(path,n),name?name+'/'+n:n);
    }else{
      demand(s.nlink===1,'RC_UPGRADE_PRESERVATION_HARDLINK_REFUSED');const h=createHash('sha256');
      for await(const b of createReadStream(path))h.update(b);
      const after=await lstat(path);demand(s.dev===after.dev&&s.ino===after.ino&&s.size===after.size&&s.mtimeMs===after.mtimeMs&&
        s.ctimeMs===after.ctimeMs&&s.mode===after.mode,'RC_UPGRADE_PRESERVATION_FILE_CHANGED');
      entries.push([name,s.size,h.digest('hex')]);
    }
    demand(entries.length<=10000,'RC_UPGRADE_PRESERVATION_BOUND_EXCEEDED');
  }
  await visit(root,'');return entries;
}
// Pair database references with preserved bytes. HR Document checksums cover
// encrypted envelopes, so verification does not need or expose HR plaintext.
export function verifyDocumentInventory(documents,inventory){
  demand(Array.isArray(documents)&&Array.isArray(inventory),'RC_UPGRADE_DOCUMENT_INVENTORY_REQUIRED');
  const files=new Map(inventory.filter(e=>typeof e[1]==='number').map(e=>[e[0],e]));
  for(const d of documents){
    const entry=files.get(d.storage_key);
    demand(d.storage_provider==='LOCAL'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.storage_key)&&
      Number.isSafeInteger(d.file_size_bytes)&&d.file_size_bytes>=0&&/^[a-f0-9]{64}$/.test(d.checksum??'')&&
      entry?.[1]===d.file_size_bytes&&entry?.[2]===d.checksum,'RC_UPGRADE_DOCUMENT_BYTES_NOT_RECOVERABLE');
  }
}
async function fileHash(path){const h=createHash('sha256');for await(const b of createReadStream(path))h.update(b);return h.digest('hex');}
async function stage(target,label,exe,args,cwd,env=environment(),timeout=300000){
  await seal(join(target,label+'-started.json'),{stage:label,at:new Date().toISOString()});
  const log=await open(join(target,'logs',label+'.log'),'wx',0o600);
  let child,timer,forceTimer;
  try{
    child=spawn(exe,args,{cwd,env,stdio:['ignore',log.fd,log.fd]});
    timer=setTimeout(()=>{child.kill('SIGTERM');forceTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},timeout);
    const code=await new Promise((ok,no)=>{child.once('error',no);child.once('close',code=>ok(code));});
    demand(code===0,'RC_UPGRADE_'+label+'_FAILED');
  }finally{clearTimeout(timer);clearTimeout(forceTimer);await log.close();}
}
async function databaseStream(container,args,cwd,file,input=false){
  const stream=input?createReadStream(file):createWriteStream(file,{flags:'wx',mode:0o600});
  const child=spawn('podman',['exec',...(input?['-i']:[]),container,...args],{cwd,env:environment(),
    stdio:[input?'pipe':'ignore',input?'ignore':'pipe','ignore']});
  const ended=new Promise((ok,no)=>{child.once('error',no);child.once('close',code=>code===0?ok():no(new Error()));});
  let forceTimer;const timer=setTimeout(()=>{child.kill('SIGTERM');forceTimer=setTimeout(()=>child.kill('SIGKILL'),5000);},300000);
  try{await Promise.all([ended,input?pipeline(stream,child.stdin):pipeline(child.stdout,stream)]);}
  catch{child.kill('SIGTERM');demand(false,'RC_UPGRADE_DATABASE_CAPTURE_OR_RESTORE_FAILED');}
  finally{clearTimeout(timer);clearTimeout(forceTimer);}
}
async function priorInventory(path){
  await directory(path,true);const rows=[];
  for(const name of (await readdir(path)).sort()){
    if(name==='application')continue;
    const full=join(path,name),st=await lstat(full);
    demand(!st.isSymbolicLink()&&st.uid===process.getuid()&&!(st.mode&0o022),'RC_UPGRADE_PRIOR_STAGE_ENTRY_UNSAFE');
    if(st.isDirectory()){
      demand(['logs','preserved'].includes(name),'RC_UPGRADE_UNKNOWN_PRIOR_STAGE_DIRECTORY');
      rows.push([name,'directory']);for(const item of await privateInventory(full))rows.push([name+(item[0]?'/'+item[0]:''),...item.slice(1)]);
    }else{demand(st.isFile()&&st.nlink===1,'RC_UPGRADE_PRIOR_STAGE_FILE_UNSAFE');rows.push([name,st.size,await fileHash(full)]);}
  }
  return rows;
}
async function processIdentity(root,checkout,kind,port){
  const p=await privateJson(join(root,kind+'-owned.json'));
  const entry=kind==='api'?join(checkout,'apps/api/dist/main.js'):join(checkout,'deploy/uat/serve-web.mjs');
  demand(p.sourceSha===PREVIOUS_OPERATOR&&p.reviewedApp===PREVIOUS_APP&&p.port===port&&p.entry===entry&&Number.isSafeInteger(p.pid)&&p.pid>1,'RC_UPGRADE_ORIGINAL_PROCESS_RECEIPT_INVALID');
  const args=await command('/bin/ps',['-ww','-p',String(p.pid),'-o','command='],checkout);
  const uid=await command('/bin/ps',['-p',String(p.pid),'-o','uid='],checkout);
  const born=await command('/bin/ps',['-p',String(p.pid),'-o','lstart='],checkout);
  const listeners=await command('lsof',['-nP','-iTCP:'+port,'-sTCP:LISTEN','-Fpf'],checkout);
  const own=await command('lsof',['-nP','-a','-p',String(p.pid),'-iTCP:'+port,'-sTCP:LISTEN'],checkout);
  demand(args===process.execPath+' '+entry&&uid===String(process.getuid())&&born===p.born&&hasSoleListenerPid(listeners,p.pid)&&
    own.includes('127.0.0.1:'+port)&&!own.includes('*:'+port),'RC_UPGRADE_PROCESS_OR_PORT_OWNERSHIP_DRIFT');
  return {...p,born,kind,port};
}
async function stopOriginal(prior,checkout,p){
  const now=await processIdentity(prior,checkout,p.kind,p.port);
  demand(now.pid===p.pid&&now.born===p.born,'RC_UPGRADE_PROCESS_IDENTITY_CHANGED_BEFORE_STOP');
  process.kill(p.pid,'SIGTERM');
  for(let i=0;i<60;i++){
    try{process.kill(p.pid,0);}catch(e){if(e.code==='ESRCH')return;throw e;}
    await pause(500);
  }
  demand(false,'RC_UPGRADE_ORIGINAL_PROCESS_DID_NOT_EXIT_NO_FORCE');
}
async function freePort(port,cwd){
  // Node owns this temporary socket only; EADDRINUSE fails before startup.
  const {createServer}=await import('node:net'),s=createServer();
  try{await new Promise((ok,no)=>{s.once('error',no);s.listen(port,'127.0.0.1',ok);});}
  catch{demand(false,'RC_UPGRADE_CUTOVER_PORT_NOT_FREE');}
  finally{if(s.listening)await new Promise(ok=>s.close(ok));}
}
export async function upgrade(operatorMainSha){
  demand(process.platform==='darwin'&&process.getuid()>0,'RC_UPGRADE_NONROOT_MAC_REQUIRED');
  demand(process.versions.node==='24.21.0','RC_UPGRADE_NODE_24_21_0_REQUIRED');
  demand(await command('pnpm',['--version'],homedir())==='12.6.0','RC_UPGRADE_PNPM_12_6_0_REQUIRED');
  demand(!Object.keys(process.env).some(k=>/^NODE_OPTIONS$|^NODE_PATH$|^PRISMA_/.test(k)),'RC_UPGRADE_EXECUTION_OVERRIDE_REFUSED');
  demand(/^[a-f0-9]{40}$/.test(REVIEWED_APP)&&REVIEWED_APP!==ORIGINAL,'RC_UPGRADE_REVIEWED_INTEGRATED_APP_BINDING_REQUIRED');
  demand(/^[a-f0-9]{40}$/.test(operatorMainSha??''),'RC_UPGRADE_PINNED_OPERATOR_MAIN_REQUIRED');
  process.umask(0o077);
  const home=homedir(),root=join(home,'Construction-ERP-Prototype-Runtime'),originalCheckout=join(home,'Construction-ERP-Prototype-Checkout'),
    prior=join(root,'fm03-upgrade'),checkout=join(prior,'application'),target=join(root,'receiving-upgrade'),repo=join(target,'application');
  demand(resolve(home)===home&&!/[\n\r,]/.test(home),'RC_UPGRADE_HOME_INVALID');
  await directory(home);await directory(root,true);await directory(originalCheckout);await directory(prior,true);await directory(checkout);
  for(const n of ['db','documents','hrkeys','uploads','logs'])await directory(join(root,n),true);
  demand(await absent(target),'RC_UPGRADE_ALREADY_STARTED_PRESERVE_AND_DO_NOT_RETRY');
  const cfg=await privateJson(join(root,'runtime-private.json')),container=await privateJson(join(root,'container-owned.json')),
    manifest=await privateJson(join(root,'prototype-target.json'));
  demand(cfg.sourceSha===ORIGINAL&&cfg.databaseName==='proto_a_01'&&cfg.databaseUser==='proto_runtime'&&
    /^[a-f0-9]{64}$/.test(cfg.databasePassword??'')&&cfg.apiOrigin===API.slice(0,-7)&&cfg.webOrigin===WEB,
    'RC_UPGRADE_WRONG_SOURCE_RUNTIME');
  demand(manifest.expectedMainSha===ORIGINAL&&manifest.mode==='isolated-synthetic'&&manifest.productionConnected===false&&
    manifest.retainedDataUsed===false&&manifest.realCompanyGrantsModified===false&&
    manifest.runtime?.checkoutRoot===originalCheckout&&manifest.runtime.isolationRoot===root&&manifest.runtime.databaseRoot===join(root,'db')&&
    manifest.runtime.documentsRoot===join(root,'documents')&&manifest.runtime.hrKeysRoot===join(root,'hrkeys')&&
    manifest.runtime.apiOrigin===cfg.apiOrigin&&manifest.runtime.webOrigin===WEB&&manifest.runtime.postgresHost==='127.0.0.1'&&
    manifest.runtime.postgresPort===55471&&manifest.runtime.postgresDbName==='proto_a_01','RC_UPGRADE_WRONG_SYNTHETIC_MANIFEST');
  demand(await command('git',['rev-parse','HEAD'],checkout)===PREVIOUS_OPERATOR&&await command('git',['status','--porcelain'],checkout)===''&&
    [ORIGIN,ORIGIN.slice(0,-4)].includes(await command('git',['remote','get-url','origin'],checkout)),'RC_UPGRADE_ORIGINAL_SOURCE_DRIFT');
  const priorReady=await privateJson(join(prior,'ready.json'));
  demand(priorReady.status==='FM03_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED'&&priorReady.sourceSha===PREVIOUS_OPERATOR&&
    priorReady.reviewedApp===PREVIOUS_APP&&priorReady.originalSource===ORIGINAL&&priorReady.forwardOnlyMigration===true&&
    priorReady.sourceHistoryPreserved===true&&priorReady.documentsUploadsKeysAndReceiptsPreserved===true&&
    priorReady.fm03BrowserLifecycleVerified===true&&priorReady.sessionsRevoked===true&&priorReady.productionAuthorized===false,
    'RC_UPGRADE_COMPLETED_FM03_RECEIPT_REQUIRED');
  const oldApi=await processIdentity(prior,checkout,'api',33071),oldWeb=await processIdentity(prior,checkout,'web',44171);
  const currentMain=(await json('https://api.github.com/repos/threeswordz/cinder-grind/branches/main')).commit?.sha,main=operatorMainSha;
  demand(/^[a-f0-9]{40}$/.test(currentMain??''),'RC_UPGRADE_OPERATOR_MAIN_REQUIRED');
  const ancestry=await json('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+main+'...'+currentMain);
  demand(['ahead','identical'].includes(ancestry.status),'RC_UPGRADE_OPERATOR_MUST_BE_INTEGRATED_MAIN_ANCESTOR');
  await green(REVIEWED_APP);await green(main);
  demand(validUpgradeDelta(await json('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+REVIEWED_APP+'...'+main)),
    'RC_UPGRADE_UNREVIEWED_APPLICATION_OR_OPERATOR_DELTA');
  const published=await json('https://api.github.com/repos/threeswordz/cinder-grind/contents/'+SELF+'?ref='+main);
  demand(published.sha===blob(await readFile(new URL(import.meta.url))),'RC_UPGRADE_OPERATOR_BYTES_NOT_GREEN_MAIN');
  // Exclusive mkdir is the no-replay lock and permanent private failure record.
  await mkdir(target,{mode:0o700});await mkdir(join(target,'logs'),{mode:0o700});
  await seal(join(target,'started.json'),{originalSource:ORIGINAL,reviewedApp:REVIEWED_APP,operatorMain:main,startedAt:new Date().toISOString()});
  let db,browser,executable,phase='CLONE',cutover=false,copyMayBeRemoved=true;
  const newProcesses=[];
  try{
    await stage(target,'CLONE','git',['clone','--no-checkout',ORIGIN,repo],target);
    await stage(target,'PIN','git',['checkout','--detach',main],repo);
    demand(await command('git',['rev-parse','HEAD'],repo)===main&&await command('git',['status','--porcelain'],repo)==='',
      'RC_UPGRADE_PINNED_RELEASE_SOURCE_DRIFT');
    const mod=n=>import(pathToFileURL(join(repo,'deploy/uat',n+'.mjs')).href);
    const actors=await mod('prototype-actors'),browserOperator=await mod('prototype-browser-operator'),
      uiState=await mod('prototype-material-ui-state'),state=await mod('prototype-receiving-state'),
      artifacts=await mod('prototype-material-artifacts'),browserCode=await mod('prototype-browser'),
      browserExecutable=await mod('prototype-browser-executable'),journey=await mod('prototype-receiving-browser');
    const originalReady=await privateJson(join(root,'runtime-ready.json'));
    demand(actors.validConfig(cfg)&&actors.validReady(originalReady)&&originalReady.imageId===container.image&&
      browserOperator.validActorReceipt(await privateJson(join(root,'actors-ready.json')))&&
      uiState.validMaterialRunReceipt(await privateJson(join(root,'material-ready.json'))),'RC_UPGRADE_PRIOR_RECEIPTS_INVALID');
    const a=await privateJson(join(root,'actors-private.json')),f=await privateJson(join(root,'actors-fixture-private.json')),
      material=await privateJson(join(root,'material-configuration-private.json')),materialJourney=await privateJson(join(root,'material-journey-private.json')),
      ui=await privateJson(join(root,'material-ui-ready.json'));
    demand(browserOperator.validPrivateActors(a)&&ui.sourceSha===ORIGINAL&&ui.operatorMainSha==='480fd4c7ee5e1aeab3fecf9670607a32a8f23d8b'&&
      ui.status==='MATERIAL_RETAINED_REQUEST_UI_REVISION_VERIFIED'&&ui.priorVersion===3&&ui.version===4&&
      ui.signedHistoryPreserved&&ui.stockAndFinanceUnchanged&&ui.uiSessionsRevoked,'RC_UPGRADE_COMPLETED_MATERIAL_UI_RECEIPT_REQUIRED');
    const binding={sourceSha:ORIGINAL,actors:a.actors,fixture:f,configuration:material,journey:materialJourney};
    const connections=JSON.parse(await command('podman',['system','connection','list','--format','json'],checkout)),defaults=connections.filter(c=>c.Default===true);
    demand(defaults.length===1&&defaults[0].Name==='podman-machine-default'&&
      /^ssh:\/\/core@127\.0\.0\.1:\d+\/run\/user\/\d+\/podman\/podman.sock$/.test(defaults[0].URI??'')&&
      await command('podman',['info','--format','{{.Host.Security.Rootless}}'],checkout)==='true','RC_UPGRADE_LOCAL_ROOTLESS_PODMAN_REQUIRED');
    const inspected=JSON.parse(await command('podman',['inspect',container.id],checkout));
    demand(inspected.length===1&&actors.validContainer(inspected[0],container,join(root,'db')),'RC_UPGRADE_OWNED_CONTAINER_REQUIRED');
    const sql=(name,query)=>command('podman',['exec',container.id,'psql','--no-psqlrc','-U','proto_runtime','-d',name,'-At','-v','ON_ERROR_STOP=1','-c',query],checkout);
    demand(await sql('proto_a_01','SELECT current_database()')==='proto_a_01'&&
      await sql('proto_a_01',"SELECT count(*) FROM pg_database d JOIN pg_roles r ON r.oid=d.datdba WHERE d.datname='proto_a_01' AND r.rolname='proto_runtime' AND d.datallowconn AND NOT d.datistemplate")==='1'&&
      /^17\.11(?:\D|$)/.test(await sql('proto_a_01','SHOW server_version')),'RC_UPGRADE_POSTGRES_IDENTITY_REQUIRED');
    demand(await sql('proto_a_01',"SELECT count(*) FROM pg_database WHERE datname='"+RESTORE_DB+"'")==='0','RC_UPGRADE_RESTORE_TARGET_EXISTS_NO_OVERWRITE');
    const initialHealth=await json(API+'/health/ready',5000);
    demand(initialHealth.status==='ok'&&initialHealth.database==='ok'&&initialHealth.documentStorage==='ok','RC_UPGRADE_ORIGINAL_RUNTIME_NOT_READY');
    phase='BUILD';const priorBuilt=await privateJson(join(prior,'compiled-artifacts-private.json'));
    demand(priorBuilt.sourceSha===PREVIOUS_OPERATOR&&priorBuilt.reviewedApp===PREVIOUS_APP,'RC_UPGRADE_PRIOR_ARTIFACT_RECEIPT_INVALID');
    artifacts.compareArtifactInventories(await artifacts.artifactInventory(join(checkout,'apps/api/dist')),priorBuilt.api);
    artifacts.compareArtifactInventories(await artifacts.artifactInventory(join(checkout,'apps/web/dist')),priorBuilt.web);
    await artifacts.verifyMaterialArtifacts(checkout,PREVIOUS_OPERATOR);
    await stage(target,'INSTALL','pnpm',['install','--frozen-lockfile'],repo);
    await stage(target,'GENERATE','pnpm',['prisma:generate'],repo);
    await stage(target,'BUILD','pnpm',['build'],repo,{...environment(),NODE_ENV:'production',VITE_API_BASE_URL:API});
    const built={api:await artifacts.artifactInventory(join(repo,'apps/api/dist')),web:await artifacts.artifactInventory(join(repo,'apps/web/dist'))};
    await seal(join(target,'compiled-artifacts-private.json'),{sourceSha:main,reviewedApp:REVIEWED_APP,...built});
    const req=createRequire(join(repo,'apps/api/package.json')),{PrismaClient}=req('@prisma/client');
    const url=name=>'postgresql://proto_runtime:'+cfg.databasePassword+'@127.0.0.1:55471/'+name+'?schema=public';
    const database=name=>new PrismaClient({datasources:{db:{url:url(name)}},log:[]});
    async function verifyMigrations(db,source){
      const expected=[];
      for(const d of (await readdir(join(source,'apps/api/prisma/migrations'),{withFileTypes:true})).filter(d=>d.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name)))
        expected.push({name:d.name,checksum:hash(await readFile(join(source,'apps/api/prisma/migrations',d.name,'migration.sql')))});
      const rows=await db.$queryRawUnsafe('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name');
      demand(rows.length===expected.length&&rows.every((r,i)=>r.migration_name===expected[i].name&&r.checksum===expected[i].checksum&&r.finished_at&&!r.rolled_back_at),'RC_UPGRADE_EXACT_SCHEMA_PROVENANCE_REQUIRED');
    }
    db=database('proto_a_01');await verifyMigrations(db,checkout);
    demand(await db.materialRequest.count({where:{id:materialJourney.requestId,companyId:f.companyId,version:4}})===1,'RC_UPGRADE_RETAINED_UI_HISTORY_DRIFT');
    demand(await db.userSession.count({where:{revokedAt:null}})===0,'RC_UPGRADE_EXISTING_SESSION_MUST_BE_SIGNED_OUT');
    demand(state.digest(await state.receivingSnapshot(db))===state.digest(await privateJson(join(prior,'database-after-private.json'))),'RC_UPGRADE_POPULATED_FM03_STATE_DRIFT');
    await db.$disconnect();db=undefined;
    // Authenticate and prepare owned Chrome before interrupting the application.
    executable=await browserExecutable.prepareBrowser(await browserExecutable.discoverBrowser(),target);
    phase='DRAIN';cutover=true;await stopOriginal(prior,checkout,oldWeb);await stopOriginal(prior,checkout,oldApi);
    await freePort(33071,checkout);await freePort(44171,checkout);
    const quiet=()=>sql('proto_a_01',"SELECT count(*) FROM pg_stat_activity WHERE datname='proto_a_01' AND pid<>pg_backend_pid()");
    demand(await quiet()==='0','RC_UPGRADE_SOURCE_DATABASE_NOT_DRAINED');
    db=database('proto_a_01');const before=await db.$transaction(tx=>state.receivingSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
    await db.$disconnect();db=undefined;await seal(join(target,'database-before-private.json'),before);
    phase='PRESERVE';const preservation=join(target,'preserved');await mkdir(preservation,{mode:0o700});
    const names=(await readdir(root)).filter(n=>!['db','receiving-upgrade'].includes(n)),inventories={};
    for(const name of names){
      const from=join(root,name),s=await lstat(from);demand(!s.isSymbolicLink()&&s.uid===process.getuid()&&!(s.mode&0o022),'RC_UPGRADE_UNSAFE_RUNTIME_HISTORY');
      if(s.isDirectory()){
        demand(['documents','hrkeys','uploads','logs','fm03-upgrade'].includes(name),'RC_UPGRADE_UNKNOWN_RUNTIME_DIRECTORY');
        inventories[name]=name==='fm03-upgrade'?await priorInventory(from):await privateInventory(from);
        await cp(from,join(preservation,name),{recursive:true,force:false,errorOnExist:true,
          ...(name==='fm03-upgrade'?{filter:path=>path!==join(from,'application')}: {})});
        const copied=name==='fm03-upgrade'?await priorInventory(join(preservation,name)):await privateInventory(join(preservation,name));
        demand(hash(JSON.stringify(copied))===hash(JSON.stringify(inventories[name])),'RC_UPGRADE_PRESERVED_TREE_BYTES_CHANGED');
      }else{demand(s.isFile()&&s.nlink===1,'RC_UPGRADE_UNSAFE_RUNTIME_FILE');inventories[name]=await fileHash(from);
        await cp(from,join(preservation,name),{force:false,errorOnExist:true});demand(await fileHash(join(preservation,name))===inventories[name],'RC_UPGRADE_PRESERVED_RECEIPT_BYTES_CHANGED');}
    }
    verifyDocumentInventory(before.documents,inventories.documents);
    await seal(join(target,'file-inventories-private.json'),inventories);demand(await quiet()==='0','RC_UPGRADE_SOURCE_TRAFFIC_RESUMED');
    const dump=join(preservation,'postgresql.custom');
    await databaseStream(container.id,['pg_dump','-U','proto_runtime','-d','proto_a_01','--format=custom','--no-owner','--no-acl'],checkout,dump);
    demand((await lstat(dump)).size>1024,'RC_UPGRADE_POPULATED_DUMP_REQUIRED');
    phase='RESTORE_PROOF';await command('podman',['exec',container.id,'createdb','-U','proto_runtime','--owner=proto_runtime','--template=template0',RESTORE_DB],checkout);
    await databaseStream(container.id,['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','proto_runtime','-d',RESTORE_DB],checkout,dump,true);
    const restored=database(RESTORE_DB);try{demand(state.digest(await state.receivingSnapshot(restored))===state.digest(before),'RC_UPGRADE_POPULATED_RESTORE_ROWS_DIFFER');}finally{await restored.$disconnect();}
    const keys=await privateJson(join(root,'hrkeys/keyring.json'));
    const runtime=name=>({...environment(),NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33071',WEB_ORIGIN:WEB,
      DATABASE_URL:url(name),STORAGE_ROOT:join(root,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(root,'uploads'),
      HR_PRIVATE_KEYS:JSON.stringify(keys),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'});
    await stage(target,'MIGRATE_RESTORED_COPY','pnpm',['prisma:migrate:deploy'],repo,runtime(RESTORE_DB));
    const rehearsal=database(RESTORE_DB);try{await verifyMigrations(rehearsal,repo);state.verifyReceivingMigration(before,await state.receivingSnapshot(rehearsal));}finally{await rehearsal.$disconnect();}
    // Only after the paired dump/files and separate populated additive upgrade
    // prove recoverability do we migrate the populated source database.
    phase='SOURCE_MIGRATION';
    for(const name of names){const value=Array.isArray(inventories[name])?(name==='fm03-upgrade'?await priorInventory(join(root,name)):await privateInventory(join(root,name))):await fileHash(join(root,name));
      demand(hash(JSON.stringify(value))===hash(JSON.stringify(inventories[name])),'RC_UPGRADE_SOURCE_FILES_CHANGED_BEFORE_UPGRADE');}
    demand(await quiet()==='0','RC_UPGRADE_SOURCE_TRAFFIC_RESUMED');
    db=database('proto_a_01');demand(state.digest(await state.receivingSnapshot(db))===state.digest(before),'RC_UPGRADE_SOURCE_CHANGED_DURING_CAPTURE');
    await db.$disconnect();db=undefined;
    await stage(target,'MIGRATE_SOURCE','pnpm',['prisma:migrate:deploy'],repo,runtime('proto_a_01'));
    db=database('proto_a_01');await verifyMigrations(db,repo);const migrated=await state.receivingSnapshot(db);state.verifyReceivingMigration(before,migrated);
    const configuration=await state.configureReceiving(db,binding,state.digest(migrated));await seal(join(target,'configuration-private.json'),configuration);
    artifacts.compareArtifactInventories(await artifacts.artifactInventory(join(repo,'apps/api/dist')),built.api);
    artifacts.compareArtifactInventories(await artifacts.artifactInventory(join(repo,'apps/web/dist')),built.web);
    demand(await command('git',['rev-parse','HEAD'],repo)===main&&await command('git',['status','--porcelain'],repo)==='','RC_UPGRADE_SOURCE_CHANGED_DURING_UPGRADE');
    phase='CUTOVER';
    for(const [kind,port,entry,cwd,env] of [
      ['api',33071,join(repo,'apps/api/dist/main.js'),join(repo,'apps/api'),runtime('proto_a_01')],
      ['web',44171,join(repo,'deploy/uat/serve-web.mjs'),repo,{...environment(),WEB_HOST:'127.0.0.1',WEB_PORT:'44171'}]]){
      await freePort(port,repo);const log=await open(join(target,'logs',kind+'-runtime.log'),'wx',0o600);
      const child=spawn(process.execPath,[entry],{cwd,env,detached:true,stdio:['ignore',log.fd,log.fd]});
      await new Promise((ok,no)=>{child.once('spawn',ok);child.once('error',no);});await log.close();child.unref();newProcesses.push({child,entry,port,kind});
      const born=await command('/bin/ps',['-p',String(child.pid),'-o','lstart='],repo);
      await seal(join(target,kind+'-owned.json'),{sourceSha:main,reviewedApp:REVIEWED_APP,pid:child.pid,entry,port,born,startedAt:new Date().toISOString()});
    }
    let ready=false;const startupDeadline=Date.now()+60000;
    while(Date.now()<startupDeadline){
      demand(newProcesses.every(p=>p.child.exitCode===null&&p.child.signalCode===null),'RC_UPGRADE_NEW_APPLICATION_EXITED');
      try{const h=await json(API+'/health/ready',2000);if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'){
        const web=await fetch(WEB,{redirect:'error',signal:AbortSignal.timeout(2000)});
        if(web.ok&&hash(await web.text())===hash(await readFile(join(repo,'apps/web/dist/index.html')))){ready=true;break;}
      }}catch{}await pause(500);
    }
    demand(ready,'RC_UPGRADE_NEW_APPLICATION_NOT_READY');
    for(const p of newProcesses){const listener=await command('lsof',['-nP','-a','-p',String(p.child.pid),'-iTCP:'+p.port,'-sTCP:LISTEN'],repo);
      demand(listener.includes('127.0.0.1:'+p.port)&&!listener.includes('*:'+p.port),'RC_UPGRADE_NEW_LISTENER_IDENTITY_DRIFT');}
    phase='SOURCE_API';const source=await state.prepareReceivingSource(db,binding,configuration,{api:API,web:WEB});
    await seal(join(target,'source-private.json'),source);
    phase='BROWSER';copyMayBeRemoved=false;
    try{browser=await browserCode.startBrowser(executable.executable,target);}catch(e){copyMayBeRemoved=e.browserProcessExited===true;throw e;}
    const result=await journey.executeReceivingBrowser(browser.protocol,await state.receivingBrowserBinding(db,binding,configuration,source,{api:API,web:WEB}),db);
    await browser.stop();browser=undefined;copyMayBeRemoved=true;await executable.cleanup();executable=undefined;
    phase='FINAL_PRESERVATION';
    const after=await db.$transaction(tx=>state.receivingSnapshot(tx),{isolationLevel:'RepeatableRead',timeout:30000});
    state.verifyReceivingJourneyPreservation(migrated,after,configuration,binding,source,result);
    for(const name of names){const value=Array.isArray(inventories[name])?(name==='fm03-upgrade'?await priorInventory(join(root,name)):await privateInventory(join(root,name))):await fileHash(join(root,name));
      if(name==='documents')state.verifyReceivingDocumentFiles(inventories[name],value,after.documents.filter(d=>result.documentIds.includes(d.id)));
      else demand(hash(JSON.stringify(value))===hash(JSON.stringify(inventories[name])),'RC_UPGRADE_ORIGINAL_FILES_OR_RECEIPTS_CHANGED');}
    verifyDocumentInventory(after.documents,await privateInventory(join(root,'documents')));
    await seal(join(target,'database-after-private.json'),after);
    await seal(join(target,'journey-private.json'),result);
    const receipt={status:'RECEIVING_POPULATED_MAC_UPGRADE_AND_BROWSER_VERIFIED',originalSource:ORIGINAL,sourceSha:main,reviewedApp:REVIEWED_APP,
      forwardOnlyMigration:true,sourceHistoryPreserved:true,documentsUploadsKeysAndReceiptsPreserved:true,
      preUpgradeSeparatePopulatedRestoreVerified:true,populatedDumpSha256:await fileHash(dump),
      receivingBrowserLifecycleVerified:true,sameDeliveryEvidenceUploaded:true,latePoLinkPreserved:true,independentJaiCheckVerified:true,
      canonicalGrApprovalVerified:true,onlyGoodQuantityPosted:true,damagedQuantityRemainsHeld:true,completedFm03HistoryPreserved:true,
      wrongActorDenialVerified:true,threeLocalesVerified:true,sessionsRevoked:true,
      fullBusinessJourneysVerified:false,milestone7Complete:false,prototypeFrozen:false,humanUatCompleted:false,productionAuthorized:false,secretsPrinted:false};
    await seal(join(target,'ready.json'),receipt);return receipt;
  }catch(e){
    // No source restart, schema rollback, reset, cleanup of backups or retries.
    // Stop only newly launched, still-identical application processes.
    for(const p of newProcesses)try{
      if(p.child.exitCode===null&&p.child.signalCode===null&&await command('/bin/ps',['-ww','-p',String(p.child.pid),'-o','command='],repo)===process.execPath+' '+p.entry)p.child.kill('SIGTERM');
    }catch{}
    await seal(join(target,'failure-private.json'),{phase,code:e.safeCode??'RC_UPGRADE_PRIVATE_FAILURE',sourceMayBeStoppedOrMigrated:cutover,
      preservedTargetRequiresDiagnosis:true,automaticRetryAllowed:false});throw e;
  }finally{
    try{if(browser){await browser.stop();browser=undefined;copyMayBeRemoved=true;}}finally{try{if(executable&&copyMayBeRemoved)await executable.cleanup();}finally{if(db)await db.$disconnect();}}
  }
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{demand(process.argv.length===4&&process.argv[2]==='--execute','RC_UPGRADE_EXECUTE_AND_PINNED_OPERATOR_SHA_REQUIRED');console.log(JSON.stringify(await upgrade(process.argv[3])));}
  catch(e){console.log(JSON.stringify({status:'RECEIVING_UPGRADE_BLOCKED',code:/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'RC_UPGRADE_PRIVATE_FAILURE',
    doNotRetryOrReplayCompletedOperators:true,productionAuthorized:false,secretsPrinted:false}));process.exitCode=1;}
}
