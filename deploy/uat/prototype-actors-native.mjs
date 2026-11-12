// Native PostgreSQL + actual authenticated NestJS proof for the actor coordinator.
// CI ONLY: fresh uniquely named database; never the Mac or the shared CI app DB.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,resolve} from 'node:path';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {provision,pristine,httpClient,initialJourneys,safeEnvironment} from './prototype-actors.mjs';

assert.equal(process.platform,'linux','Native actor harness is Linux CI only');
assert.equal(process.env.GITHUB_ACTIONS,'true','Native actor harness is CI only');
assert.equal(process.versions.node,'24.21.0');
const baseUrl=new URL(process.env.DATABASE_URL??'');
assert.ok(['127.0.0.1','localhost'].includes(baseUrl.hostname)&&baseUrl.port==='5432'&&
  baseUrl.pathname==='/construction_erp'&&baseUrl.username==='construction_erp','Unexpected CI base identity');
const root=fileURLToPath(new URL('../../',import.meta.url)),apiRoot=join(root,'apps/api');
const require=createRequire(join(apiRoot,'package.json'));
const {PrismaClient}=require('@prisma/client'),{PasswordService}=require('./dist/auth/password.service.js');
const base=new PrismaClient({datasources:{db:{url:baseUrl.href}},log:[]});
const name='actor_proto_ci_'+randomUUID().replaceAll('-','');
assert.match(name,/^actor_proto_ci_[a-f0-9]{32}$/);
const ownUrl=new URL(baseUrl);ownUrl.pathname='/'+name;
const db=new PrismaClient({datasources:{db:{url:ownUrl.href}},log:[]});
const temporary=await mkdtemp(join(tmpdir(),'erp-actor-native-'));
const env={...safeEnvironment(),CI:'true',NODE_ENV:'uat',DATABASE_URL:ownUrl.href,
  API_HOST:'127.0.0.1',API_PORT:'31319',WEB_ORIGIN:'http://127.0.0.1:44319',
  STORAGE_ROOT:join(temporary,'documents'),DOCUMENT_UPLOAD_TEMP_ROOT:join(temporary,'uploads'),
  HR_PRIVATE_KEYS:JSON.stringify({native:randomBytes(32).toString('base64')}),HR_PRIVATE_ACTIVE_KEY_ID:'native'};
const adminPassword=randomBytes(32).toString('hex');
let created=false,server,phase='CREATE_DATABASE';
async function run(exe,args,childEnv){
  const p=spawn(exe,args,{cwd:root,env:childEnv,stdio:['ignore','pipe','pipe']});
  // Never forward raw child logs (bootstrap/build/connection errors may contain secrets).
  p.stdout.resume();p.stderr.resume();
  const timeout=setTimeout(()=>p.kill('SIGKILL'),120000);
  try{const [code]=await once(p,'close');assert.equal(code,0,'Native fixture subprocess failed');}
  finally{clearTimeout(timeout);}
}
try{
  await base.$executeRawUnsafe('CREATE DATABASE "'+name+'"');created=true;
  phase='MIGRATE_BOOTSTRAP';
  await run('pnpm',['prisma:migrate:deploy'],env);
  await run(process.execPath,[join(apiRoot,'dist/scripts/bootstrap-admin.js')],{...env,
    BOOTSTRAP_COMPANY_CODE:'PROTO_A',BOOTSTRAP_COMPANY_NAME:'Synthetic Prototype A',
    BOOTSTRAP_ADMIN_EMAIL:'proto-admin@example.invalid',BOOTSTRAP_ADMIN_DISPLAY_NAME:'Synthetic technical administrator',
    BOOTSTRAP_ADMIN_PASSWORD:adminPassword});
  await pristine(db);
  phase='PROVISION';
  const prepared=await provision(db,new PasswordService()),fixture=await prepared.commit();
  await assert.rejects(pristine(db),e=>e.safeCode==='DATABASE_NOT_FRESH_SYNTHETIC');
  await assert.rejects(prepared.commit(),e=>e.safeCode==='DATABASE_NOT_FRESH_SYNTHETIC');
  assert.equal(await db.user.count(),9,'No duplicate accounts on refused rerun');
  assert.equal(await db.company.count(),2);
  assert.equal(await db.auditLog.count({where:{entityType:'PROTOTYPE_SYNTHETIC_ACTOR'}}),8);
  server=spawn(process.execPath,[join(apiRoot,'dist/main.js')],{cwd:apiRoot,env,stdio:['ignore','pipe','pipe']});
  phase='START_API';
  server.stdout.resume();server.stderr.resume();
  let healthy=false;
  for(let n=0;n<60;n++){
    assert.equal(server.exitCode,null,'Native API exited before readiness');
    try{const r=await fetch('http://127.0.0.1:31319/api/v1/health/ready',{signal:AbortSignal.timeout(1500)});
      if(r.ok&&(await r.json()).status==='ok'){healthy=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  assert.ok(healthy,'Native isolated API not ready');
  const client=httpClient('http://127.0.0.1:31319/api/v1',env.WEB_ORIGIN);
  phase='INITIAL_JOURNEYS';
  await initialJourneys(db,fixture,prepared.actors,client,{userId:fixture.adminUserId,email:'proto-admin@example.invalid',
    password:adminPassword,expectedRoleCodes:['SYS_ADMIN']});
  assert.ok(client.observations.length>90,'Expected nontrivial authenticated HTTP matrix');
  assert.equal(client.observations.filter(x=>x.id.endsWith('_LOGOUT')).length,9);
  assert.equal(await db.stockTransaction.count(),1);
  assert.equal(await db.materialRequest.count(),1);
  assert.equal(await db.hrPrivateRevision.count(),2);
  const ciphertexts=await db.hrPrivateRevision.findMany({select:{ciphertext:true}});
  assert.ok(ciphertexts.every(x=>!x.ciphertext.includes('SYNTHETIC_PRIVATE_ID')&&!x.ciphertext.includes('SYNTHETIC_ACCOUNT')));
  assert.equal(await db.userSession.count({where:{revokedAt:null}}),0,'No active actor sessions left');
  console.log('PROTOTYPE_ACTOR_NATIVE_PASS: '+client.observations.length+' actual HTTP checks; eight real logins, Company/Project/action/privacy denial, independent quantity count/replay, request non-posting, HR encryption, daily/weekly. Not Mac/browser/UAT/recovery proof.');
}catch(e){
  // Never forward Prisma/HTTP/bootstrap exceptions or private fixture details.
  console.error('PROTOTYPE_ACTOR_NATIVE_FAILED: '+phase+' '+(e.safeCode??(/^P\d{4}$/.test(e.code??'')?e.code:'NATIVE_ASSERTION_OR_SETUP_FAILED')));
  process.exitCode=1;
}finally{
  if(server&&server.exitCode===null){
    const closed=once(server,'close');server.kill('SIGTERM');
    const timer=setTimeout(()=>server.kill('SIGKILL'),5000);
    try{await closed;}finally{clearTimeout(timer);}
  }
  await db.$disconnect();
  if(created)await base.$executeRawUnsafe('DROP DATABASE "'+name+'" WITH (FORCE)');
  await base.$disconnect();
  assert.ok(resolve(temporary).startsWith(resolve(tmpdir())+'/erp-actor-native-'));
  await rm(temporary,{recursive:true,force:true});
}
