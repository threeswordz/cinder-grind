// CI-only API-shape compatibility for #338's new HTTP boundary. Reuses the
// existing disposable fixture; does not repeat the stock/overage business suite.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {SOURCE,safeEnvironment} from './prototype-actors.mjs';
import {materialJourneyHttp} from './prototype-material-http.mjs';

async function native(){
assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.versions.node,'24.21.0');
const baseUrl=new URL(process.env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(baseUrl.hostname)&&baseUrl.port==='5432'&&
  baseUrl.username==='construction_erp'&&baseUrl.pathname==='/construction_erp');
const root=fileURLToPath(new URL('../../',import.meta.url)),apiRoot=join(root,'apps/api');
const require=createRequire(join(apiRoot,'package.json'));
require('reflect-metadata');
const {PrismaClient}=require('@prisma/client'),base=new PrismaClient({datasources:{db:{url:baseUrl.href}},log:[]});
const name='material_http_ci_'+randomUUID().replaceAll('-','');
assert.match(name,/^material_http_ci_[a-f0-9]{32}$/);
const ownUrl=new URL(baseUrl);ownUrl.pathname='/'+name;
const temporary=await mkdtemp(join(tmpdir(),'erp-material-http-'));
const env={...safeEnvironment(),CI:'true',NODE_ENV:'uat',DATABASE_URL:ownUrl.href,
  API_HOST:'127.0.0.1',API_PORT:'31319',WEB_ORIGIN:'http://127.0.0.1:44319',
  STORAGE_ROOT:join(temporary,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(temporary,'uploads'),
  HR_PRIVATE_KEYS:JSON.stringify({native:randomBytes(32).toString('base64')}),HR_PRIVATE_ACTIVE_KEY_ID:'native'};
async function run(exe,args,childEnv){
  const child=spawn(exe,args,{cwd:root,env:childEnv,stdio:['ignore','pipe','pipe']});
  child.stdout.resume();child.stderr.resume();const timer=setTimeout(()=>child.kill('SIGKILL'),120000);
  try{const [code]=await once(child,'close');assert.equal(code,0);}finally{clearTimeout(timer);}
}
let created=false,db,app,phase='CREATE_UNIQUE_DATABASE';
try{
  await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
  phase='MIGRATE_CATALOG';await run('pnpm',['prisma:migrate:deploy'],env);
  await run(process.execPath,[join(apiRoot,'dist/scripts/bootstrap-admin.js')],{...env,
    BOOTSTRAP_COMPANY_CODE:'PROTO_A',BOOTSTRAP_COMPANY_NAME:'Synthetic HTTP fixture',
    BOOTSTRAP_ADMIN_EMAIL:'proto-admin@example.invalid',BOOTSTRAP_ADMIN_DISPLAY_NAME:'Synthetic technical admin',
    BOOTSTRAP_ADMIN_PASSWORD:randomBytes(32).toString('hex')});
  Object.assign(process.env,env);
  const {PrismaService}=require('./dist/prisma/prisma.service.js');
  db=new PrismaService();await db.$connect();
  const identity=await db.$queryRawUnsafe('SELECT current_database() AS name');assert.equal(identity[0].name,name);
  phase='REUSE_DISPOSABLE_FIXTURE';
  const {materialPlanFixture}=require('./dist/inventory/material-plan-test-fixture.js');
  const f=await materialPlanFixture(db);
  const type=await db.documentType.findFirstOrThrow({where:{companyId:f.company.id,documentTypeCode:'SIGNED'}});
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
  const {securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js');
  app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');
  app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(31319,'127.0.0.1');phase='REAL_HTTP_CONTRACT';
  const client=materialJourneyHttp({sourceSha:SOURCE,api:'http://127.0.0.1:31319/api/v1',web:env.WEB_ORIGIN,
    companyId:f.company.id,projectId:f.project.id,warehouseId:f.warehouse.id,materialId:f.material.id,uomId:f.uom.id,
    budgetRevisionId:f.approved.id,budgetRevisionLineId:f.source.id,storeEmployeeId:f.store.employee.id,
    foremanEmployeeId:f.foreman.employee.id,documentTypeId:type.id});
  const actor=a=>({cookie:'erp_session='+a.session.sessionToken,csrf:a.session.csrfToken});
  const store=actor(f.store),manager=actor(f.manager),foreman=actor(f.foreman);
  let plan=(await client.call(store,'PLAN_CREATE','/inventory/material-plans',201,f.input())).value.data;
  await assert.rejects(client.call(store,'UNREAD_PLAN','/inventory/material-plans/'+plan.id+'/submit',201,
    {requestKey:randomUUID(),expectedVersion:plan.version}),e=>e.safeCode==='MATERIAL_HTTP_BOUNDARY_REFUSED');
  await client.call(store,'PLAN_READ','/inventory/material-plans/'+plan.id,200);
  plan=(await client.call(store,'PLAN_SUBMIT','/inventory/material-plans/'+plan.id+'/submit',201,
    {requestKey:randomUUID(),expectedVersion:plan.version})).value.data;
  await client.call(manager,'PLAN_DECIDE','/inventory/material-plans/'+plan.id+'/decision',201,
    {requestKey:randomUUID(),expectedVersion:plan.version,decision:'APPROVE',comment:'Independent disposable compatibility check'});
  await client.call(store,'PLAN_APPROVED_READ','/inventory/material-plans/'+plan.id,200);
  const issue=(await client.call(store,'ISSUE_CREATE','/inventory/material-issues',201,{projectId:f.project.id,
    warehouseId:f.warehouse.id,issueDate:'2026-11-13',issuedToEmployeeId:f.foreman.employee.id,
    lines:[{materialId:f.material.id,uomId:f.uom.id,quantity:'3.0000'}]})).value.data;
  await client.call(store,'ISSUE_READ','/inventory/material-issues/'+issue.id,200);
  const requestInput={requestKey:randomUUID(),projectId:f.project.id,warehouseId:f.warehouse.id,
    requesterEmployeeId:f.foreman.employee.id,requestDate:'2026-11-13',remarks:'Synthetic transport contract',
    lines:[{materialId:f.material.id,uomId:f.uom.id,requestedQuantity:'3.0000',wbsId:null,costCodeId:null,activityId:null,remarks:null}]};
  // Material Request's action result is intentionally only id/version/revisionId.
  const request=(await client.call(store,'REQUEST_CREATE','/inventory/material-requests',201,requestInput)).value.data;
  await client.call(store,'REQUEST_READ','/inventory/material-requests/'+request.id,200);
  const bytes=new TextEncoder().encode('%PDF-1.4\nSynthetic transport test; no human signature\n%%EOF');
  await client.upload(foreman,'FOREMAN_UPLOAD_DENIED',request.id,403,bytes);
  const uploaded=await client.upload(store,'SIGNED_UPLOAD',request.id,201,bytes);
  assert.deepEqual(await client.download(store,'SIGNED_BYTES',request.id,uploaded.data.id,200),bytes);
  await client.download(foreman,'FOREMAN_DOWNLOAD_DENIED',request.id,uploaded.data.id,403);
  await client.call(actor(f.outsider),'UNASSIGNED_PROJECT_DENIED','/inventory/material-requests/'+request.id,403);
  assert.equal(await db.stockTransaction.count({where:{companyId:f.company.id}}),1,'Transport compatibility does not post stock');
  assert.equal(await db.materialIssue.count({where:{companyId:f.company.id,postedAt:{not:null}}}),0);
  console.log('MATERIAL_HTTP_NATIVE_PASS: '+client.observations.length+' real API contract requests; new boundary only. Not Mac/full journey/login/browser/UAT/recovery proof.');
}catch(e){
  console.error('MATERIAL_HTTP_NATIVE_FAILED: '+phase+' '+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'NATIVE_ASSERTION_OR_SETUP_FAILED'));
  process.exitCode=1;
}finally{
  try{if(app)await app.close();}
  finally{
    try{if(db)await db.$disconnect();}
    finally{
      try{if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');}
      finally{await base.$disconnect();assert.ok(resolve(temporary).startsWith(resolve(tmpdir())+'/erp-material-http-'));
        await rm(temporary,{recursive:true,force:true});}
    }
  }
}
}
await native().catch(()=>{console.error('MATERIAL_HTTP_NATIVE_FAILED: GUARD_OR_CLEANUP_FAILED');process.exitCode=1;});
