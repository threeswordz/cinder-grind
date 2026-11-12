#!/usr/bin/env node
// #305 authority6797969134: bounded initial browser readback on existing actors.
import {homedir} from 'node:os';
import {join} from 'node:path';
import {lstat,realpath,readFile,readdir,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SOURCE,API,WEB,ROLES,validReady,validConfig,validContainer,privateFile,safeEnvironment,isEntry} from './prototype-actors.mjs';
import {startBrowser,browserReadback} from './prototype-browser.mjs';

const ACTOR_MAIN='28b043bd545f0d4d6f11dd34d3d877ea94c0e095';
const SELF='deploy/uat/prototype-browser-operator.mjs';
const modules=[SELF,'deploy/uat/prototype-browser.mjs','deploy/uat/prototype-actors.mjs'];
const allowed=new Set([...modules,'deploy/uat/prototype-runtime-operator.mjs',
  'deploy/release-candidate/prototype-runtime-operator.test.mjs','docs/PROTOTYPE-RUNTIME-OPERATOR.md',
  'docs/CURRENT-STATE.md','deploy/uat/prototype-actors-native.mjs',
  'deploy/release-candidate/prototype-actors.test.mjs','docs/PROTOTYPE-ACTOR-OPERATOR.md',
  '.github/workflows/validate.yml','deploy/release-candidate/prototype-browser.test.mjs',
  'docs/PROTOTYPE-BROWSER-OPERATOR.md']);
const demand=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
const execute=promisify(execFile);
async function command(exe,args,cwd){
  try{return (await execute(exe,args,{cwd,env:safeEnvironment(),timeout:20000,maxBuffer:2097152})).stdout.trim();}
  catch{throw Object.assign(new Error(),{safeCode:'BROWSER_TARGET_IDENTITY_COMMAND_FAILED'});}
}
async function jsonFetch(url){
  const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{'User-Agent':'ERP-Prototype-Browser-Operator'}});
  demand(r.ok,'BROWSER_SOURCE_OR_HEALTH_CHECK_FAILED');return r.json();
}
async function directory(path,privateOnly=false){
  const s=await lstat(path);
  demand(s.isDirectory()&&!s.isSymbolicLink()&&await realpath(path)===path&&s.uid===process.getuid()&&
    !(s.mode&(privateOnly?0o077:0o022)),'BROWSER_UNSAFE_DIRECTORY');
}
async function exclusive(path,value){
  const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');}finally{await f.close();}
}
export function toolingOnly(compare){
  return compare?.status==='ahead'&&compare.files?.length>0&&compare.files.length<=allowed.size&&
    compare.files.every(f=>allowed.has(f.filename)&&['added','modified'].includes(f.status)&&!f.previous_filename);
}
export function validActorReceipt(r){
  return r?.status==='SYNTHETIC_ACTORS_INITIAL_HTTP_VERIFIED'&&r.sourceSha===SOURCE&&r.operatorMainSha===ACTOR_MAIN&&
    r.functionalActors===8&&r.initialHttpChecks===123&&r.syntheticRoleConfigurationVerified===true&&
    r.stockCountRequestEmploymentJourneysVerified===true&&
    ['productionAuthorized','retainedResourcesUsed','humanUatCompleted','prototypeFrozen','fullBusinessRoleMatrixVerified',
      'authenticatedBrowserVerified','populatedRecoveryVerified','secretsPrinted'].every(k=>r[k]===false);
}
export function validPrivateActors(value){
  const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(x);
  return value?.sourceSha===SOURCE&&Object.keys(value.actors??{}).length===8&&Object.keys(ROLES).every(key=>{
    const a=value.actors[key];return a&&uuid(a.userId)&&uuid(a.employeeId)&&uuid(a.roleId)&&
      a.email==='proto-'+key.toLowerCase()+'@example.invalid'&&/^[a-f0-9]{64}$/.test(a.password??'')&&
      a.expectedRoleCodes?.length===1&&a.expectedRoleCodes[0]==='PROTO_'+key;
  })&&['userId','employeeId','roleId','password'].every(field=>new Set(Object.values(value.actors).map(a=>a[field])).size===8);
}
export async function populatedIdentity(db,actors,fixture){
  const companies=await db.company.findMany({select:{id:true,companyCode:true,isActive:true,baseCurrencyCode:true}});
  demand(companies.length===2&&companies.every(c=>c.isActive&&c.baseCurrencyCode==='THB')&&
    companies.some(c=>c.id===fixture.companyId&&c.companyCode==='PROTO_A')&&
    companies.some(c=>c.id===fixture.foreignCompanyId&&c.companyCode==='PROTO_B'),'BROWSER_COMPANY_IDENTITY_MISMATCH');
  const projects=await db.project.findMany({select:{id:true,companyId:true,projectCode:true,isActive:true}});
  demand(projects.length===3&&[[fixture.projectId,fixture.companyId,'SITE_A'],
    [fixture.unassignedProjectId,fixture.companyId,'SITE_B'],[fixture.foreignProjectId,fixture.foreignCompanyId,'SITE_FOREIGN']]
    .every(([id,companyId,projectCode])=>projects.some(p=>p.id===id&&p.companyId===companyId&&p.projectCode===projectCode&&p.isActive)),
    'BROWSER_PROJECT_IDENTITY_MISMATCH');
  const users=await db.user.findMany({include:{userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}}});
  demand(users.length===9&&await db.role.count()===9&&await db.employee.count()===8,'BROWSER_ACTOR_CENSUS_CHANGED');
  for(const [key,actor] of Object.entries(actors)){
    const user=users.find(u=>u.id===actor.userId);
    demand(user?.isActive&&user.companyId===fixture.companyId&&user.employeeId===actor.employeeId&&user.email===actor.email&&
      user.userRoles.length===1&&user.userRoles[0].roleId===actor.roleId&&user.userRoles[0].role.isActive&&
      user.userRoles[0].role.companyId===fixture.companyId&&user.userRoles[0].role.roleCode==='PROTO_'+key,
      'BROWSER_ACTOR_BINDING_CHANGED');
    const permissions=user.userRoles[0].role.rolePermissions.map(x=>x.permission.permissionCode);
    demand(JSON.stringify(permissions.sort())===JSON.stringify([...ROLES[key].permissions].sort()),'BROWSER_ROLE_GRANTS_CHANGED');
    const grants=await db.hrCompanyAccess.findMany({where:{userId:actor.userId},select:{companyId:true,category:true}});
    demand(grants.every(x=>x.companyId===fixture.companyId)&&
      JSON.stringify(grants.map(x=>x.category).sort())===JSON.stringify([...ROLES[key].categories].sort()),'BROWSER_HR_GRANTS_CHANGED');
  }
  const admin=users.find(u=>u.id===fixture.adminUserId);
  demand(admin?.isActive&&admin.companyId===fixture.companyId&&admin.email==='proto-admin@example.invalid'&&
    admin.employeeId===null&&admin.userRoles.length===1&&admin.userRoles[0].role.roleCode==='SYS_ADMIN'&&
    admin.userRoles[0].role.isActive&&admin.userRoles[0].role.companyId===fixture.companyId,
    'BROWSER_TECHNICAL_ADMIN_CHANGED');
  const permissions=admin.userRoles[0].role.rolePermissions.map(x=>x.permission.permissionCode);
  demand(!permissions.some(p=>/\.approve$/.test(p)||p.startsWith('hr.'))&&
    await db.hrCompanyAccess.count({where:{userId:admin.id}})===0,'BROWSER_TECHNICAL_ADMIN_BUSINESS_AUTHORITY');
  return permissions;
}
// Auth sessions, audit records and lastLoginAt are expected to change. Business
// records and persisted role/category grants must remain byte-for-byte equal.
const businessModels=['company','employee','role','rolePermission','userRole','project','projectMember','hrCompanyAccess',
  'customer','supplier','unitOfMeasure','material','warehouse','stockCount','stockTransaction','stockTransfer',
  'purchaseRequest','purchaseOrder','goodsReceipt','materialRequest','materialRequestLine','materialRequestRevision',
  'materialRequestIssueLink','materialRequestReceipt','materialUsagePlan','materialPlanProjectPolicy',
  'dailySiteReport','hrEmployment','hrEmploymentRevision','hrPrivateRevision','hrPerson','hrPersonLink','hrDocumentAttachment',
  'document','documentLink','documentType','subcontractAgreement','supplierInvoice','clientInvoice','payment'];
export async function businessFingerprint(db){
  return db.$transaction(async tx=>{
    const rows={};for(const model of businessModels)rows[model]=(await tx[model].findMany()).map(row=>JSON.stringify(row)).sort();
    return sha(JSON.stringify(rows));
  },{isolationLevel:'RepeatableRead',timeout:30000});
}
export function summary(status){return {purpose:'AUTHORIZED_POPULATED_SYNTHETIC_INITIAL_BROWSER_READBACK',sourceSha:SOURCE,status,
  productionAuthorized:false,retainedResourcesUsed:false,humanUatCompleted:false,prototypeFrozen:false,
  fullBusinessRoleMatrixVerified:false,fullAuthenticatedBrowserJourneysVerified:false,populatedRecoveryVerified:false,secretsPrinted:false};}

async function preflight(){
  demand(process.platform==='darwin'&&process.getuid()>0,'NONROOT_MAC_OPERATOR_REQUIRED');
  demand(process.versions.node==='24.21.0','NODE_24_21_0_REQUIRED');
  demand(!Object.keys(process.env).some(k=>/^PRISMA_|^NODE_OPTIONS$|^NODE_PATH$/.test(k)),'INHERITED_RUNTIME_OVERRIDE_REFUSED');
  const home=homedir(),checkout=join(home,'Construction-ERP-Prototype-Checkout'),root=join(home,'Construction-ERP-Prototype-Runtime');
  await directory(home);await directory(checkout);await directory(root,true);
  for(const sub of ['db','documents','hrkeys','logs','uploads'])await directory(join(root,sub),true);
  for(const file of ['browser-started.json','browser-ready.json','browser-evidence-private.json']){
    try{await lstat(join(root,file));demand(false,'BROWSER_READBACK_ALREADY_STARTED_NO_OVERWRITE');}
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
  let chrome;
  for(const candidate of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium',
    join(home,'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),join(home,'Applications/Chromium.app/Contents/MacOS/Chromium')]){
    try{const s=await lstat(candidate);if(s.isFile()&&!s.isSymbolicLink()&&[0,process.getuid()].includes(s.uid)&&!(s.mode&0o022)&&
      (s.mode&0o111)&&await realpath(candidate)===candidate){chrome=candidate;break;}}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  demand(chrome,'EXISTING_CHROME_OR_CHROMIUM_REQUIRED');
  const browserVersion=await command(chrome,['--version'],checkout);
  demand(/^(Google Chrome|Chromium) \d+\.\d+\.\d+\.\d+/.test(browserVersion),'BROWSER_VERSION_UNRECOGNIZED');
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
    const actors=privateActors.actors,adminPermissions=await populatedIdentity(db,actors,fixture);
    const count=await db.stockCount.findUnique({where:{id:evidence.results.stockCountId}}),
      request=await db.materialRequest.findUnique({where:{id:evidence.results.requestId}});
    demand(count?.companyId===fixture.companyId&&count.projectId===fixture.projectId&&count.status==='APPROVED'&&
      request?.companyId===fixture.companyId&&request.projectId===fixture.projectId,'BROWSER_POPULATED_RECORDS_MISSING');
    return {root,db,chrome,browserVersion,operatorMainSha:main,fixture,initial:evidence.results,
      actors:{...Object.fromEntries(Object.entries(actors).map(([k,a])=>[k,{...a,permissions:ROLES[k].permissions}])),
        SYS_ADMIN:{userId:fixture.adminUserId,email:config.adminEmail,password:config.adminPassword,
          expectedRoleCodes:['SYS_ADMIN'],permissions:adminPermissions}}};
  }catch(e){await db.$disconnect();throw e;}
}

export async function operator(mode){
  demand(['--plan','--verify'].includes(mode),'USE_PLAN_OR_VERIFY');
  const context=await preflight();let browser;
  try{
    if(mode==='--plan')return {...summary('SYNTHETIC_BROWSER_PLAN_READY'),persistentFilesCreated:0};
    process.umask(0o077);
    const before=await businessFingerprint(context.db);
    const existingSessions=(await context.db.userSession.findMany({where:{revokedAt:null},select:{id:true}})).map(s=>s.id);
    await exclusive(join(context.root,'browser-started.json'),{sourceSha:SOURCE,observedAt:new Date().toISOString()});
    console.log('STEP: PRIVATE_CHROME_AUTHENTICATED_READBACK');
    browser=await startBrowser(context.chrome,context.root);
    const results=await browserReadback({...context,protocol:browser.protocol,api:API,web:WEB});
    await browser.stop();browser=undefined;
    demand(await businessFingerprint(context.db)===before,'BROWSER_BUSINESS_STATE_CHANGED');
    demand(await context.db.userSession.count({where:{revokedAt:null,id:{notIn:existingSessions}}})===0,
      'BROWSER_SERVER_SESSION_NOT_REVOKED');
    await exclusive(join(context.root,'browser-evidence-private.json'),{...results,sourceSha:SOURCE,
      operatorMainSha:context.operatorMainSha,browserVersion:context.browserVersion,businessFingerprint:before});
    const result={...summary('SYNTHETIC_BROWSER_INITIAL_READBACK_VERIFIED'),operatorMainSha:context.operatorMainSha,
      functionalActors:8,technicalAdminProbed:true,browserChecks:results.browserChecks,
      initialAuthenticatedBrowserVerified:true,businessStateUnchanged:true,browserSessionsRevoked:true,
      observedAt:new Date().toISOString(),next:'COMPLETE_MATERIAL_PLAN_SUBCONTRACT_DOCUMENT_JOURNEYS_AND_POPULATED_RECOVERY'};
    await exclusive(join(context.root,'browser-ready.json'),result);return result;
  }finally{try{if(browser)await browser.stop();}finally{await context.db.$disconnect();}}
}
if(await isEntry(process.argv[1],import.meta.url)){
  try{demand(process.argv.length===3,'USE_PLAN_OR_VERIFY');console.log(JSON.stringify(await operator(process.argv[2]),null,2));}
  catch(e){console.log(JSON.stringify({...summary('SYNTHETIC_BROWSER_BLOCKED'),code:e.safeCode??'BROWSER_OPERATOR_OR_TRANSPORT_FAILED',
    next:'RETURN_STATUS_ONLY_PRESERVE_EXISTING_ACTORS_RUNTIME_AND_PRIVATE_FILES'},null,2));process.exitCode=1;}
}
