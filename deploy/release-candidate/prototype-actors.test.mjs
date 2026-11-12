import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,link,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {SOURCE,STARTUP,CONTAINER,API,WEB,ROLES,validReady,validConfig,validContainer,
  safeEnvironment,toolingOnly,isEntry,privateFile,summary,pristine,provision,httpClient,operator} from '../uat/prototype-actors.mjs';

const ready=()=>({status:'SYNTHETIC_RUNTIME_STARTED',sourceSha:SOURCE,operatorMainSha:STARTUP,container:CONTAINER,
  apiOrigin:API.slice(0,-7),webOrigin:WEB,apiReady:true,webReady:true,syntheticAdminAuthenticated:true,
  sourceAndProcessChecks:true,migrationsApplied:true,technicalAdminOnly:true,productionAuthorized:false,
  retainedResourcesUsed:false,humanUatCompleted:false,prototypeFrozen:false,businessRoleMatrixVerified:false,
  populatedRecoveryVerified:false,imageId:'a'.repeat(64),webIndexSha256:'b'.repeat(64)});
const config=()=>({sourceSha:SOURCE,companyCode:'PROTO_A',adminEmail:'proto-admin@example.invalid',
  databaseName:'proto_a_01',databaseUser:'proto_runtime',apiOrigin:API.slice(0,-7),webOrigin:WEB,
  databasePassword:'c'.repeat(64),adminPassword:'d'.repeat(64)});
test('only the successfully started exact synthetic runtime is eligible',()=>{
  assert.equal(validReady(ready()),true);assert.equal(validConfig(config()),true);
  for(const [k,v] of [['sourceSha','f'.repeat(40)],['operatorMainSha',SOURCE],['apiOrigin','http://0.0.0.0:33071'],
    ['webOrigin','http://127.0.0.1:4173'],['technicalAdminOnly',false],['migrationsApplied',false],
    ['prototypeFrozen',true],['businessRoleMatrixVerified',true],['productionAuthorized',true],
    ['retainedResourcesUsed',true],['imageId','latest']])assert.equal(validReady({...ready(),[k]:v}),false);
  for(const [k,v] of [['companyCode','TCJ'],['databaseName','construction_erp'],['databaseUser','postgres'],
    ['adminEmail','real@example.com'],['databasePassword','dev'],['apiOrigin','http://remote:33071']])
    assert.equal(validConfig({...config(),[k]:v}),false);
});
test('running container must retain exact image, UID, mount, labels and loopback port',()=>{
  const receipt={sourceSha:SOURCE,name:CONTAINER,id:'e'.repeat(64),image:'a'.repeat(64)};
  const c={Id:receipt.id,Name:CONTAINER,Image:receipt.image,State:{Running:true},
    Config:{User:'70:70',Labels:{'erp.prototype.source':SOURCE,'erp.prototype.scope':'synthetic-only'}},
    HostConfig:{RestartPolicy:{Name:''},PortBindings:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'55471'}]}},
    Mounts:[{Type:'bind',Source:'/private/db',Destination:'/var/lib/postgresql/data',RW:true}]};
  assert.equal(validContainer(c,receipt,'/private/db'),true);
  for(const mutate of [x=>x.State.Running=false,x=>x.Image='b'.repeat(64),x=>x.Config.User='0',
    x=>x.Config.Labels['erp.prototype.scope']='production',x=>x.Mounts[0].Source='/retained',
    x=>x.Mounts.push({...x.Mounts[0]}),x=>x.HostConfig.PortBindings['5432/tcp'][0].HostIp='0.0.0.0',
    x=>x.HostConfig.PortBindings['5432/tcp'][0].HostPort='55432']){
    const broken=structuredClone(c);mutate(broken);assert.equal(validContainer(broken,receipt,'/private/db'),false);
  }
});
test('only bounded tooling differences can coexist with the pinned application',()=>{
  const f={filename:'deploy/uat/prototype-actors.mjs',status:'added'};
  assert.equal(toolingOnly({status:'ahead',files:[f]}),true);
  for(const x of [{status:'identical',files:[f]},{status:'ahead',files:[]},
    {status:'ahead',files:[{...f,filename:'apps/api/src/main.ts'}]},
    {status:'ahead',files:[{...f,status:'renamed',previous_filename:'retained'}]},
    {status:'ahead',files:[{...f,filename:'pnpm-lock.yaml'}]}])assert.equal(toolingOnly(x),false);
});
test('child inspection never inherits connection, preload, Git or key overrides',()=>{
  const env=safeEnvironment({HOME:'/home/synthetic',PATH:'/trusted',DATABASE_URL:'secret',PRISMA_QUERY_ENGINE_LIBRARY:'/evil',
    NODE_OPTIONS:'--require /evil',NODE_PATH:'/evil',HR_PRIVATE_KEYS:'secret',PGPASSWORD:'secret',
    CONTAINER_CONNECTION:'remote',GIT_DIR:'/retained',DOCKER_HOST:'remote'});
  assert.deepEqual(env,{HOME:'/home/synthetic',PATH:'/trusted'});
});
test('macOS-style symlink entry executes while module imports do not',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'erp-actor-entry-'));
  try{
    const file=join(temporary,'actual.mjs'),alias=join(temporary,'alias.mjs');
    await writeFile(file,'export const x=1;');await symlink(file,alias);
    assert.equal(await isEntry(alias,pathToFileURL(file).href),true);
    assert.equal(await isEntry(file,pathToFileURL(alias).href),false);
    assert.equal(await isEntry(undefined,pathToFileURL(file).href),false);
    assert.equal(await isEntry(join(temporary,'missing'),pathToFileURL(file).href),false);
  }finally{await rm(temporary,{recursive:true,force:true});}
});
test('private inputs reject public permissions, symlinks and hard links',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'erp-actor-private-'));
  try{
    const file=join(temporary,'private.json'),alias=join(temporary,'alias.json');
    await writeFile(file,'{}',{mode:0o600});assert.deepEqual(await privateFile(file),{});
    await chmod(file,0o644);await assert.rejects(privateFile(file),e=>e.safeCode==='UNSAFE_PRIVATE_FILE');
    await chmod(file,0o600);await symlink(file,alias);
    await assert.rejects(privateFile(alias),e=>e.safeCode==='UNSAFE_PRIVATE_FILE');
    await link(file,join(temporary,'hardlink.json'));
    await assert.rejects(privateFile(file),e=>e.safeCode==='UNSAFE_PRIVATE_FILE');
  }finally{await rm(temporary,{recursive:true,force:true});}
});
function pristineFixture(){
  const companyId=randomUUID(),roleId=randomUUID(),adminUserId=randomUUID();
  const state={companies:[{id:companyId,companyCode:'PROTO_A',isActive:true,baseCurrencyCode:'THB'}],
    users:[{id:adminUserId,companyId,employeeId:null,isActive:true,email:'proto-admin@example.invalid',userRoles:[{roleId,
      role:{companyId,roleCode:'SYS_ADMIN',isActive:true,rolePermissions:[]}}]}],counts:{}};
  const db=new Proxy({company:{findMany:async()=>state.companies},user:{findMany:async()=>state.users},
    role:{findMany:async()=>[{id:roleId}]}},{get:(target,key)=>target[key]??{count:async()=>state.counts[key]??0}});
  return {db,state};
}
test('database baseline rejects retained, extra, inactive or already populated identities before fixture writes',async()=>{
  const good=pristineFixture();assert.ok((await pristine(good.db)).companyId);
  const mutations=[s=>s.companies[0].companyCode='TCJ',s=>s.companies.push({...s.companies[0]}),
    s=>s.users[0].isActive=false,s=>s.users[0].userRoles[0].role.roleCode='MANAGEMENT',
    s=>s.users[0].userRoles[0].role.rolePermissions.push({permission:{permissionCode:'procurement.po.approve'}}),
    s=>s.users[0].userRoles[0].role.rolePermissions.push({permission:{permissionCode:'hr.bank.view'}}),
    s=>s.counts.project=1,s=>s.counts.employee=1,s=>s.counts.materialPlanProjectPolicy=1,s=>s.counts.payment=1];
  for(const mutate of mutations){const f=pristineFixture();mutate(f.state);await assert.rejects(pristine(f.db));}
});
test('fixture refuses a nonpristine target inside the serializable transaction before any create',async()=>{
  const {db,state}=pristineFixture();state.counts.project=1;let created=0;
  db.$transaction=async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(db);};
  db.$executeRawUnsafe=async()=>{};
  db.company.create=async()=>{created++;};
  const p=await provision(db,{hash:async()=> 'synthetic-hash'});
  assert.equal(Object.keys(p.actors).length,8);
  assert.equal(new Set(Object.values(p.actors).map(x=>x.password)).size,8);
  await assert.rejects(p.commit(),e=>e.safeCode==='EXISTING_BUSINESS_DATA_STOP');assert.equal(created,0);
});
test('bounded synthetic permissions retain distinct makers, approvers and HR categories',()=>{
  assert.equal(Object.keys(ROLES).length,8);
  for(const x of Object.values(ROLES))assert.equal(new Set(x.permissions).size,x.permissions.length);
  assert.ok(!ROLES.STORE_SITE.permissions.includes('inventory.stock_count.approve'));
  assert.ok(ROLES.KHAIMOOK.permissions.includes('inventory.stock_count.approve'));
  assert.ok(!ROLES.FOREMAN.permissions.includes('procurement.pr.manage'));
  assert.ok(!ROLES.JAI.permissions.includes('procurement.po.approve'));
  assert.ok(!ROLES.BEN.permissions.includes('site.daily_report.create'));
  assert.deepEqual(ROLES.PORN.categories,['employment','bank']);
  assert.deepEqual(ROLES.BEN.categories,['employment']);
  assert.ok(!Object.values(ROLES).some(x=>x.permissions.includes('inventory.material_plan.prototype.enable')));
});
test('HTTP evidence rejects 500/false-positive denial and never exposes response bodies or credentials',async()=>{
  const secret='PRIVATE_PASSWORD_OR_BANK_VALUE';
  const c=httpClient(API,WEB,async()=>new Response(JSON.stringify({secret}),{status:500,headers:{'content-type':'application/json'}}));
  await assert.rejects(c.call({cookie:secret,csrf:secret},'DENY_CASE','/safe',403),e=>e.safeCode==='PROBE_DENY_CASE_HTTP_500'&&!e.message.includes(secret));
  assert.ok(!JSON.stringify(c.observations).includes(secret));
  assert.equal(c.observations.length,1);
});
test('every HTTP probe has a unique request receipt, credentials stay in the transport, and redirects are forbidden',async()=>{
  const seen=[];const c=httpClient(API,WEB,async(url,options)=>{seen.push({url,options});return new Response('{}',{status:200});});
  const actor={cookie:'PRIVATE_COOKIE',csrf:'PRIVATE_CSRF'};
  await c.call(actor,'FIRST','/safe',200,{});await c.call(actor,'SECOND','/safe',200);
  assert.notEqual(c.observations[0].requestId,c.observations[1].requestId);
  assert.equal(seen[0].options.redirect,'error');assert.equal(seen[0].options.headers['x-csrf-token'],actor.csrf);
  assert.equal(seen[1].options.headers.Cookie,actor.cookie);
  assert.ok(!JSON.stringify(c.observations).includes('PRIVATE'));
});
test('operator rejects unsafe modes and non-Mac execution without touching the target',async()=>{
  await assert.rejects(operator('--reset'),e=>e.safeCode==='USE_PLAN_OR_CONFIGURE');
  if(process.platform!=='darwin')await assert.rejects(operator('--configure'),e=>e.safeCode==='NONROOT_MAC_OPERATOR_REQUIRED');
  const s=summary('TEST');assert.equal(s.fullBusinessRoleMatrixVerified,false);
  assert.equal(s.authenticatedBrowserVerified,false);assert.equal(s.populatedRecoveryVerified,false);
});
