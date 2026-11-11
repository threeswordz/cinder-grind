#!/usr/bin/env node
/** Authorized local operator procedure, #305 / owner runtime authorization 6797969134.
 * Invokes existing reviewed app commands against the one newly prepared synthetic target.
 * No reset, deletion, retained-container start, rootful switch, test-suite or Production path.
 */
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {lstat,realpath,readFile,readdir,open,mkdir} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {randomBytes,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const SHA='6fe8c4c22b002f66f00593975d381a284581f058';
export const CONTAINER='construction-erp-proto-6fe8c4c2-postgres';
export const IMAGE='docker.io/library/postgres:17.11-alpine';
const CI='43028941941';
const OPERATOR_PATH='deploy/uat/prototype-runtime-operator.mjs';
const OPERATOR_ONLY_PATHS=new Set([OPERATOR_PATH,
  'deploy/release-candidate/prototype-runtime-operator.test.mjs',
  'docs/PROTOTYPE-RUNTIME-OPERATOR.md','docs/CURRENT-STATE.md']);
const API='http://127.0.0.1:33071';
const WEB='http://127.0.0.1:44171';
const EMAIL='proto-admin@example.invalid';
const runFile=promisify(execFile);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const fail=code=>{throw Object.assign(new Error(code),{safeCode:code});};
const demand=(value,code)=>{if(!value)fail(code);};
const hash=s=>createHash('sha256').update(s).digest('hex');
export function imageIdentity(value){return typeof value==='string'?/^(?:sha256:)?([a-f0-9]{64})$/.exec(value)?.[1]??null:null;}
export function gitBlobSha(bytes){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');}
export function toolingOnly(compare){
  return compare?.status==='ahead' && Array.isArray(compare.files) && compare.files.length>0 &&
    compare.files.length<=OPERATOR_ONLY_PATHS.size && compare.files.every(f=>
      OPERATOR_ONLY_PATHS.has(f.filename)&&['added','modified'].includes(f.status)&&!f.previous_filename);
}
const baseResult=()=>({purpose:'AUTHORIZED_SYNTHETIC_PROTOTYPE_RUNTIME',
  sourceSha:SHA,productionAuthorized:false,retainedResourcesUsed:false,
  humanUatCompleted:false,prototypeFrozen:false,businessRoleMatrixVerified:false,
  populatedRecoveryVerified:false,secretsPrinted:false});

export function childEnvironment(original=process.env){
  // In particular never inherit DATABASE_URL, PG*, HR*, bootstrap values, Node
  // preloads, container connection overrides, npm tokens or alternate Git dirs.
  const env={};
  for(const k of ['PATH','HOME','USER','LOGNAME','TMPDIR','LANG','LC_ALL'])
    if(typeof original[k]==='string')env[k]=original[k];
  env.NO_COLOR='1'; env.CI='true';
  return env;
}
export function checkoutInspector(git,original,execute=raw){
  const env=childEnvironment(original);
  return async path=>{
    const options={cwd:path,env,timeout:10000};
    const [head,status]=await Promise.all([
      execute(git,['rev-parse','HEAD'],options),execute(git,['status','--porcelain'],options)]);
    demand(head.code===0&&status.code===0,'CHECKOUT_INSPECTION_FAILED');
    return {head:head.stdout.trim(),clean:status.stdout.trim()===''};
  };
}
export async function waitForPostgres(probe,delay=pause){
  // The official image starts a temporary Unix-socket-only initialization
  // server. Require TCP before treating initialization as complete.
  for(let n=0;n<60;n++){
    if(await probe(['pg_isready','-h','127.0.0.1','-U','proto_runtime','-d','proto_a_01'])===0)return true;
    await delay(1000);
  }
  return false;
}
export function manifestMatches(m,home){
  const root=join(home,'Construction-ERP-Prototype-Runtime');
  return m?.expectedMainSha===SHA && m.mode==='isolated-synthetic' &&
    m.productionConnected===false && m.retainedDataUsed===false &&
    m.realCompanyGrantsModified===false &&
    m.runtime?.checkoutRoot===join(home,'Construction-ERP-Prototype-Checkout') &&
    m.runtime.isolationRoot===root && m.runtime.databaseRoot===join(root,'db') &&
    m.runtime.documentsRoot===join(root,'documents') && m.runtime.hrKeysRoot===join(root,'hrkeys') &&
    m.runtime.apiOrigin===API && m.runtime.webOrigin===WEB &&
    m.runtime.postgresHost==='127.0.0.1' && m.runtime.postgresPort===55471 &&
    m.runtime.postgresDbName==='proto_a_01';
}
export function localConnection(connections){
  const defaults=connections.filter(x=>x.Default===true);
  if(defaults.length!==1)return false;
  const c=defaults[0];
  try{const u=new URL(c.URI);return c.Name==='podman-machine-default' &&
    u.protocol==='ssh:' && u.hostname==='127.0.0.1' && u.username==='core' &&
    !u.password && !u.search && !u.hash && Number(u.port)>1023 &&
    /^\/run\/user\/\d+\/podman\/podman.sock$/.test(u.pathname);
  }catch{return false;}
}
export function ownedContainer(c,{id,image,dbRoot}){
  const bindings=c?.HostConfig?.PortBindings;
  const ports=bindings?.['5432/tcp'];
  return c?.Id===id && imageIdentity(image)!==null && imageIdentity(c.Image)===imageIdentity(image) && c.Name?.replace(/^\//,'')===CONTAINER &&
    c.Config?.Labels?.['erp.prototype.source']===SHA &&
    c.Config?.Labels?.['erp.prototype.scope']==='synthetic-only' &&
    c.Config?.User==='70:70' && ['','no'].includes(c.HostConfig?.RestartPolicy?.Name) &&
    Array.isArray(c.Mounts) && c.Mounts.length===1 &&
    c.Mounts[0].Type==='bind' && c.Mounts[0].Source===dbRoot &&
    c.Mounts[0].Destination==='/var/lib/postgresql/data' && c.Mounts[0].RW===true &&
    bindings && Object.keys(bindings).length===1 && Array.isArray(ports) &&
    ports.length===1 && ports[0].HostIp==='127.0.0.1' && ports[0].HostPort==='55471';
}
async function dir(path,privateOnly=false){
  const s=await lstat(path);
  demand(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&
    await realpath(path)===path&&(s.mode&(privateOnly?0o077:0o022))===0,'UNSAFE_DIRECTORY_IDENTITY');
}
async function privateRead(path){
  const s=await lstat(path);
  demand(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&
    (s.mode&0o077)===0&&s.nlink===1,'UNSAFE_PRIVATE_FILE');
  return readFile(path,'utf8');
}
async function exclusive(path,data){
  const file=await open(path,'wx',0o600);
  try{await file.writeFile(typeof data==='string'?data:JSON.stringify(data,null,2)+'\n');}
  finally{await file.close();}
}
async function absent(path){
  try{await lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}
}
async function raw(exe,args,{cwd,env,timeout=30000}={}){
  try{const x=await runFile(exe,args,{cwd,env,timeout,maxBuffer:16*1024*1024});return {...x,code:0};}
  catch(e){return {stdout:typeof e.stdout==='string'?e.stdout:'',
    stderr:typeof e.stderr==='string'?e.stderr:'',code:typeof e.code==='number'?e.code:-1};}
}
async function requireRun(exe,args,opts,code){
  const r=await raw(exe,args,opts);demand(r.code===0,code);return r.stdout.trim();
}
async function jsonFetch(url,opts={}){
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),...opts});
  demand(r.ok,'HTTP_CHECK_FAILED');return r.json();
}

export async function operator(mode){
  demand(['--plan','--start'].includes(mode),'USE_PLAN_OR_START');
  demand(process.platform==='darwin','MAC_OPERATOR_REQUIRED');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(process.getuid?.()>0,'NONROOT_OPERATOR_REQUIRED');
  const home=homedir();
  demand(home===resolve(home)&&!/[\r\n,]/.test(home),'UNSAFE_HOME_PATH');
  const checkout=join(home,'Construction-ERP-Prototype-Checkout');
  const root=join(home,'Construction-ERP-Prototype-Runtime');
  const logs=join(root,'logs');
  const env=childEnvironment();
  await dir(home); await dir(checkout); await dir(root,true);
  for(const sub of ['db','documents','hrkeys']){
    await dir(join(root,sub),true);
    demand((await readdir(join(root,sub))).length===0,'TARGET_CONTAINS_DATA_STOP_NO_RESET');
  }
  demand((await readdir(root)).every(x=>['db','documents','hrkeys','prototype-target.json'].includes(x)),
    'PARTIAL_OR_PREVIOUS_PROVISIONING_STOP');
  for(const p of ['.env','apps/api/.env','apps/web/.env','deploy/uat/.env'])
    demand(await absent(join(checkout,p)),'EXISTING_CHECKOUT_ENV_STOP');
  const manifest=JSON.parse(await privateRead(join(root,'prototype-target.json')));
  demand(manifestMatches(manifest,home),'WRONG_PREPARED_TARGET');
  const tools={};
  for(const name of ['git','node','pnpm','podman','lsof']){
    const found=await requireRun('/usr/bin/which',[name],{env},'MISSING_REQUIRED_TOOL');
    demand(found.startsWith('/')&&!found.includes('\n'),'UNSAFE_EXECUTABLE_PATH');tools[name]=found;
  }
  demand(await realpath(tools.node)===await realpath(process.execPath),'NODE_PATH_MISMATCH');
  const options={cwd:checkout,env};
  demand(await requireRun(tools.pnpm,['--version'],options,'PNPM_UNAVAILABLE')==='12.6.0','PNPM_12_6_0_REQUIRED');
  demand(await requireRun(tools.git,['rev-parse','--show-toplevel'],options,'GIT_UNAVAILABLE')===checkout,
    'WRONG_GIT_ROOT');
  demand(await requireRun(tools.git,['rev-parse','HEAD'],options,'GIT_UNAVAILABLE')===SHA,'WRONG_CHECKOUT_SHA');
  demand(await requireRun(tools.git,['status','--porcelain'],options,'GIT_UNAVAILABLE')==='','DIRTY_CHECKOUT');
  const origin=await requireRun(tools.git,['remote','get-url','origin'],options,'GIT_UNAVAILABLE');
  demand(['https://github.com/threeswordz/cinder-grind.git','https://github.com/threeswordz/cinder-grind'].includes(origin),
    'WRONG_GIT_ORIGIN');
  const githubHeaders={'User-Agent':'ERP-Authorized-Prototype-Operator','Accept':'application/vnd.github+json'};
  const branch=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/branches/main',{headers:githubHeaders});
  const operatorMainSha=branch.commit?.sha;
  demand(/^[a-f0-9]{40}$/.test(operatorMainSha??''),'MAIN_IDENTITY_REQUIRED');
  // Keep the already-prepared application checkout pinned. A later green main
  // may add only this operator/test/docs package, never application/schema/policy changes.
  demand(operatorMainSha!==SHA,'REVIEWED_OPERATOR_INTEGRATION_REQUIRED');
  const compare=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/compare/'+SHA+'...'+operatorMainSha,{headers:githubHeaders});
  demand(toolingOnly(compare),'APPLICATION_SOURCE_CHANGED_RECHECK_REQUIRED');
  const ci=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/actions/runs/'+CI,{headers:githubHeaders});
  demand(ci.head_sha===SHA&&ci.status==='completed'&&ci.conclusion==='success'&&ci.event==='push','EXACT_MAIN_CI_REQUIRED');
  const operatorRuns=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/actions/runs?head_sha='+operatorMainSha+'&event=push&per_page=20',{headers:githubHeaders});
  demand(operatorRuns.workflow_runs?.some(r=>r.head_sha===operatorMainSha&&r.path==='.github/workflows/validate.yml'&&
    r.event==='push'&&r.status==='completed'&&r.conclusion==='success'),'OPERATOR_MAIN_CI_REQUIRED');
  const published=await jsonFetch('https://api.github.com/repos/threeswordz/cinder-grind/contents/'+OPERATOR_PATH+'?ref='+operatorMainSha,{headers:githubHeaders});
  demand(published.sha===gitBlobSha(await readFile(new URL(import.meta.url))),'OPERATOR_BYTES_DO_NOT_MATCH_GREEN_MAIN');
  const connections=JSON.parse(await requireRun(tools.podman,['system','connection','list','--format','json'],options,'PODMAN_CONNECTION_UNAVAILABLE'));
  demand(Array.isArray(connections)&&localConnection(connections),'WRONG_PODMAN_CONNECTION');
  demand(await requireRun(tools.podman,['info','--format','{{.Host.Security.Rootless}}'],options,'PODMAN_NOT_READY')==='true',
    'ROOTLESS_PODMAN_REQUIRED');
  const collision=await raw(tools.podman,['container','exists',CONTAINER],options);
  demand(collision.code===1,collision.code===0?'CONTAINER_ALREADY_EXISTS_NO_REUSE':'CONTAINER_LOOKUP_FAILED');
  const {assessPrototypeTarget}=await import(pathToFileURL(join(checkout,'deploy/uat/prototype-target-preflight.mjs')).href);
  const {assessPrototypePorts}=await import(pathToFileURL(join(checkout,'deploy/uat/prototype-target-port-preflight.mjs')).href);
  // The existing assessor's default Git subprocess would inherit the operator
  // environment. Supply the same sanitized inspection used by this coordinator.
  const inspectCheckout=checkoutInspector(tools.git,env);
  const assessTarget=()=>assessPrototypeTarget(manifest,SHA,{inspectCheckout});
  const assessPorts=()=>assessPrototypePorts(manifest,SHA,{assess:assessTarget});
  const target=await assessTarget();
  demand(target.status==='LOCAL_SAFETY_PREREQUISITES_OBSERVED'&&target.gaps.length===0,'TARGET_PREFLIGHT_FAILED');
  const ports=await assessPorts();
  demand(ports.status==='PORTS_TEMPORARILY_BINDABLE'&&ports.gaps.length===0,'PORT_PREFLIGHT_FAILED');
  if(mode==='--plan')return {...baseResult(),operatorMainSha,status:'RUNTIME_PLAN_READY',persistentFilesCreated:0};

  // All following writes are now confined to this authorized target, its fresh
  // checkout dependency/build outputs, and one uniquely named new container.
  process.umask(0o077);
  await exclusive(join(root,'provisioning-started.json'),{sourceSha:SHA,container:CONTAINER,startedAt:new Date().toISOString()});
  await mkdir(logs,{mode:0o700});
  await mkdir(join(root,'uploads'),{mode:0o700});
  const secrets={databasePassword:randomBytes(32).toString('hex'),adminPassword:randomBytes(32).toString('hex')};
  const keyring={proto1:randomBytes(32).toString('base64')};
  await exclusive(join(root,'hrkeys','keyring.json'),keyring);
  const config={sourceSha:SHA,companyCode:'PROTO_A',adminEmail:EMAIL,...secrets,
    apiOrigin:API,webOrigin:WEB,databaseName:'proto_a_01',databaseUser:'proto_runtime'};
  await exclusive(join(root,'runtime-private.json'),config);
  const pgEnv='POSTGRES_DB=proto_a_01\nPOSTGRES_USER=proto_runtime\nPOSTGRES_PASSWORD='+secrets.databasePassword+
    '\nPGDATA=/var/lib/postgresql/data/pgdata\n';
  const pgEnvPath=join(root,'postgres-private.env');await exclusive(pgEnvPath,pgEnv);
  const runtimeEnv={...env,NODE_ENV:'uat',API_HOST:'127.0.0.1',API_PORT:'33071',
    WEB_ORIGIN:WEB,STORAGE_ROOT:join(root,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(root,'uploads'),
    DATABASE_URL:'postgresql://proto_runtime:'+secrets.databasePassword+'@127.0.0.1:55471/proto_a_01?schema=public',
    HR_PRIVATE_KEYS:JSON.stringify(keyring),HR_PRIVATE_ACTIVE_KEY_ID:'proto1'};
  async function stage(label,exe,args,stageEnv=env,timeout=900000){
    console.log('STEP: '+label);
    const log=await open(join(logs,label+'.log'),'wx',0o600);
    let r;
    try{r=await raw(exe,args,{cwd:checkout,env:stageEnv,timeout});await log.writeFile(r.stdout+'\n'+r.stderr);}
    finally{await log.close();}
    demand(r.code===0,label+'_FAILED');return r.stdout.trim();
  }
  await stage('INSTALL_FROZEN_DEPENDENCIES',tools.pnpm,['install','--frozen-lockfile']);
  await stage('GENERATE_PRISMA',tools.pnpm,['prisma:generate'],runtimeEnv);
  await stage('VALIDATE_PRISMA',tools.pnpm,['prisma:validate'],runtimeEnv);
  await stage('BUILD_REVIEWED_APPLICATION',tools.pnpm,['build'],{...env,NODE_ENV:'production',VITE_API_BASE_URL:API+'/api/v1'});
  await stage('PULL_APPROVED_POSTGRES',tools.podman,['pull',IMAGE]);
  const image=imageIdentity(await requireRun(tools.podman,['image','inspect','--format','{{.Id}}',IMAGE],options,'IMAGE_INSPECTION_FAILED'));
  demand(image!==null,'IMAGE_ID_INVALID');
  demand((await assessPorts()).status==='PORTS_TEMPORARILY_BINDABLE','PORT_CHANGED_BEFORE_CREATE');
  const cid=await stage('CREATE_NEW_POSTGRES',tools.podman,['create','--name',CONTAINER,'--pull=never',
    '--label','erp.prototype.source='+SHA,'--label','erp.prototype.scope=synthetic-only',
    '--restart=no','--userns=keep-id:uid=70,gid=70','--user=70:70',
    '--cap-drop=ALL','--security-opt=no-new-privileges',
    '--mount','type=bind,source='+join(root,'db')+',target=/var/lib/postgresql/data',
    '--publish','127.0.0.1:55471:5432','--env-file',pgEnvPath,image]);
  demand(/^[a-f0-9]{64}$/.test(cid),'NEW_CONTAINER_ID_INVALID');
  await exclusive(join(root,'container-owned.json'),{sourceSha:SHA,id:cid,image,name:CONTAINER});
  async function verifyContainer(running=false){
    const data=JSON.parse(await requireRun(tools.podman,['inspect',cid],options,'OWN_CONTAINER_INSPECTION_FAILED'));
    demand(Array.isArray(data)&&data.length===1&&ownedContainer(data[0],{id:cid,image,dbRoot:join(root,'db')}),
      'OWN_CONTAINER_IDENTITY_MISMATCH');
    if(running)demand(data[0].State?.Running===true,'OWN_DATABASE_NOT_RUNNING');
  }
  await verifyContainer();
  await stage('START_NEW_POSTGRES',tools.podman,['start',cid]);
  const ready=await waitForPostgres(async args=>(await raw(tools.podman,['exec',cid,...args],options)).code);
  demand(ready,'NEW_POSTGRES_NOT_READY');await verifyContainer(true);
  const sql=async query=>requireRun(tools.podman,['exec',cid,'psql','--no-psqlrc','-U','proto_runtime','-d','proto_a_01',
    '-At','-v','ON_ERROR_STOP=1','-c',query],options,'OWN_DATABASE_CHECK_FAILED');
  demand(await sql('select current_database()')==='proto_a_01','WRONG_DATABASE_IDENTITY');
  demand(/^17\.11(?:\D|$)/.test(await sql('show server_version')),'POSTGRES_17_11_REQUIRED');
  demand(await sql("select count(*) from pg_catalog.pg_tables where schemaname='public'")==='0','NEW_DATABASE_NOT_EMPTY');
  await stage('APPLY_FORWARD_MIGRATIONS',tools.pnpm,['prisma:migrate:deploy'],runtimeEnv);
  await stage('VERIFY_MIGRATION_STATUS',tools.pnpm,['--filter','@construction-erp/api','exec','prisma','migrate','status'],runtimeEnv);
  await verifyContainer(true);
  const bootstrapEnv={...runtimeEnv,BOOTSTRAP_COMPANY_CODE:'PROTO_A',BOOTSTRAP_COMPANY_NAME:'Synthetic Prototype A',
    BOOTSTRAP_ADMIN_EMAIL:EMAIL,BOOTSTRAP_ADMIN_DISPLAY_NAME:'Synthetic Technical Administrator',
    BOOTSTRAP_ADMIN_PASSWORD:secrets.adminPassword};
  await stage('BOOTSTRAP_SYNTHETIC_ADMIN',tools.pnpm,['--filter','@construction-erp/api','bootstrap:admin'],bootstrapEnv);
  const companyId=await sql("select id from companies where company_code='PROTO_A'");
  demand(/^[a-f0-9-]{36}$/.test(companyId),'SYNTHETIC_COMPANY_IDENTITY_FAILED');
  demand(await requireRun(tools.git,['status','--porcelain'],options,'GIT_UNAVAILABLE')==='','SOURCE_CHANGED_DURING_BUILD');

  async function launch(kind,entry,procEnv,cwd){
    const log=await open(join(logs,kind+'.log'),'wx',0o600);
    const child=spawn(process.execPath,[entry],{cwd,env:procEnv,detached:true,stdio:['ignore',log.fd,log.fd]});
    let exited=false;child.on('exit',()=>{exited=true;});
    await new Promise((done,reject)=>{child.once('spawn',done);child.once('error',()=>reject(Object.assign(new Error(),{safeCode:kind+'_SPAWWN_FAILED'})));});
    await log.close();child.unref();
    await exclusive(join(root,kind+'-owned.json'),{sourceSha:SHA,pid:child.pid,entry,startedAt:new Date().toISOString()});
    return {pid:child.pid,exited:()=>exited};
  }
  const ownsListener=async(proc,port)=>{
    if(proc.exited())return false;
    const r=await raw(tools.lsof,['-nP','-a','-p',String(proc.pid),'-iTCP:'+port,'-sTCP:LISTEN'],options);
    return r.code===0&&r.stdout.includes(String(proc.pid));
  };
  const api=await launch('api',join(checkout,'apps/api/dist/main.js'),runtimeEnv,join(checkout,'apps/api'));
  let healthy=false;
  for(let n=0;n<60;n++){
    demand(!api.exited(),'API_EXITED_INSPECT_PRIVATE_LOG');
    try{if(await ownsListener(api,33071)){
      const h=await jsonFetch(API+'/api/v1/health/ready');
      if(h.status==='ok'&&h.database==='ok'&&h.documentStorage==='ok'){healthy=true;break;}
    }}catch{}await pause(1000);
  }
  demand(healthy,'API_HEALTH_OR_PROCESS_OWNERSHIP_FAILED');
  const web=await launch('web',join(checkout,'deploy/uat/serve-web.mjs'),{...env,WEB_HOST:'127.0.0.1',WEB_PORT:'44171'},checkout);
  let webReady=false;
  for(let n=0;n<30;n++){
    demand(!web.exited(),'WEB_EXITED_INSPECT_PRIVATE_LOG');
    try{if(await ownsListener(web,44171)){
      const r=await fetch(WEB,{redirect:'error',signal:AbortSignal.timeout(3000)});
      if(r.ok&&(await r.text()).includes('<html')){webReady=true;break;}
    }}catch{}await pause(1000);
  }
  demand(webReady,'WEB_HEALTH_OR_PROCESS_OWNERSHIP_FAILED');
  const login=await fetch(API+'/api/v1/auth/login',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{'Content-Type':'application/json',Origin:WEB},body:JSON.stringify({email:EMAIL,password:secrets.adminPassword})});
  demand(login.ok,'SYNTHETIC_ADMIN_LOGIN_FAILED');
  const payload=await login.json();const cookie=login.headers.get('set-cookie')?.split(';',1)[0];
  demand(cookie&&payload.data?.csrfToken,'SYNTHETIC_AUTH_RECEIPT_MISSING');
  const me=await jsonFetch(API+'/api/v1/auth/me',{headers:{Cookie:cookie,Origin:WEB}});
  demand(me.data?.email===EMAIL&&me.data.companyId===companyId&&Array.isArray(me.data.roleCodes)&&
    me.data.roleCodes.length===1&&me.data.roleCodes[0]==='SYS_ADMIN','SYNTHETIC_ADMIN_SCOPE_MISMATCH');
  demand(Array.isArray(me.data.permissions)&&!me.data.permissions.some(p=>/\.approve$/.test(p)),'UNEXPECTED_ADMIN_BUSINESS_APPROVAL');
  const logout=await fetch(API+'/api/v1/auth/logout',{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Cookie:cookie,Origin:WEB,'x-csrf-token':payload.data.csrfToken}});
  demand(logout.status===204,'SYNTHETIC_LOGOUT_FAILED');
  demand(await ownsListener(api,33071)&&await ownsListener(web,44171),'FINAL_PROCESS_OWNERSHIP_FAILED');
  await verifyContainer(true);
  const result={...baseResult(),operatorMainSha,status:'SYNTHETIC_RUNTIME_STARTED',container:CONTAINER,
    apiOrigin:API,webOrigin:WEB,apiReady:true,webReady:true,syntheticAdminAuthenticated:true,
    sourceAndProcessChecks:true,migrationsApplied:true,technicalAdminOnly:true,
    observedAt:new Date().toISOString(),imageId:image,
    webIndexSha256:hash(await readFile(join(checkout,'apps/web/dist/index.html'))),
    next:'SYNTHETIC_BUSINESS_ROLE_AND_JOURNEY_CONFIGURATION'};
  await exclusive(join(root,'runtime-ready.json'),result);
  return result;
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    demand(process.argv.length===3,'USE_PLAN_OR_START');
    const answer=await operator(process.argv[2]);console.log(JSON.stringify(answer,null,2));
  }catch(e){
    console.log(JSON.stringify({...baseResult(),status:'RUNTIME_BLOCKED',
      code:typeof e.safeCode==='string'?e.safeCode:'OPERATOR_PRECONDITION_OR_IO_FAILED',
      next:'RETURN_THIS_STATUS_ONLY_NO_RESET_NO_RETRY_AFTER_PARTIAL_START'},null,2));
    process.exitCode=1;
  }
}
