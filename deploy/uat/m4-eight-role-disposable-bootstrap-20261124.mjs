// One-time, exact-reviewed-source disposable eight-role Chromium proof.
// Runner-only child branch. Never run against Mac, retained MKE/TCJ or Production.
// Missing protected artifacts are intentionally reported PARTIAL, not a green UAT.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const EXACT='4819d794b6bc34738341efd9725e93f55c696da0';
const ROOT=process.env.GITHUB_WORKSPACE;
const failure=(code)=>{throw Object.assign(new Error(code),{safeCode:code});};
function requireSafe(value,code){if(!value)failure(code);}
requireSafe(process.env.GITHUB_ACTIONS==='true'&&process.platform==='linux',
  'NON_EPHEMERAL_TARGET_DENIED');
requireSafe(process.env.M4_LANE_C_DISPOSABLE_VERIFIED==='YES'&&
  process.env.M4_LANE_C_APPROVED_SOURCE_SHA===EXACT,'SOURCE_AUTHORIZATION_DENIED');
requireSafe(ROOT?.startsWith('/home/runner/work/'),'GITHUB_WORKSPACE_REQUIRED');
const sha=spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'});
const dirty=spawnSync('git',['status','--porcelain','--untracked-files=no'],
  {cwd:ROOT,encoding:'utf8'});
requireSafe(sha.status===0&&sha.stdout.trim()===EXACT&&
  dirty.status===0&&dirty.stdout.trim()==='','SOURCE_CHECKOUT_NOT_FROZEN');
const dbUrl=new URL(process.env.DATABASE_URL);
requireSafe(['127.0.0.1','localhost'].includes(dbUrl.hostname)&&
  dbUrl.port==='5432'&&dbUrl.pathname==='/erp_m4_lane_c_20261124'&&
  dbUrl.username==='m4_disposable','UNSAFE_POSTGRES_TARGET');
const API='http://127.0.0.1:31375';
const WEB='http://127.0.0.1:44375';
const specModule=await import(pathToFileURL(
  join(ROOT,'deploy/uat/m4-eight-role-journeys-20261124.mjs')).href);
const {PERSONAS,validateFixture}=specModule;
const keys=Object.keys(PERSONAS);
assert.equal(keys.length,8,'EIGHT_PERSONAS_REQUIRED');
const apiRequire=createRequire(join(ROOT,'apps/api/package.json'));
const webRequire=createRequire(join(ROOT,'apps/web/package.json'));
apiRequire('reflect-metadata');
const {NestFactory}=apiRequire('@nestjs/core');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {PasswordService}=apiRequire('./dist/auth/password.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {createServer}=await import(pathToFileURL(webRequire.resolve('vite')).href);
const folder=await mkdtemp(join(tmpdir(),'m4-canonical-actors-'));
process.env.STORAGE_ROOT=join(folder,'documents');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=join(folder,'uploads');
process.env.HR_PRIVATE_KEYS=JSON.stringify({synthetic:randomBytes(32).toString('base64')});
process.env.HR_PRIVATE_ACTIVE_KEY_ID='synthetic';
process.env.WEB_ORIGIN=WEB;
process.env.VITE_API_BASE_URL=WEB+'/api/v1';
process.env.NODE_ENV='test';

let app=null,web=null;
let stage='INIT';
const roleGrants={
  FINANCE_MANAGER:['projects.project.view','projects.access_all','budget.customer.view'],
  MANAGEMENT:['projects.project.view','projects.access_all','procurement.po.view'],
  PROJECT_MANAGER:['projects.project.view','projects.access_all','inventory.receipt.view'],
  STOREKEEPER:['projects.project.view','procurement.pr.view'],
  PROCUREMENT_OFFICER:['projects.project.view','projects.access_all','procurement.po.view'],
  PROJECT_ENGINEER:['projects.project.view','site.daily_report.view'],
  FINANCE_OFFICER:['projects.project.view','finance.supplier_invoice.view'],
  UAT_HR_STAFF:['projects.project.view','hr.employment.view'],
};
try{
  stage='START_API';
  app=await NestFactory.create(AppModule,{logger:false});
  app.setGlobalPrefix('api/v1');
  app.use(securityHeadersMiddleware(false));
  app.useGlobalFilters(new ProblemDetailsFilter());
  app.enableCors({origin:WEB,credentials:true});
  await app.listen(31375,'127.0.0.1');
  const db=app.get(PrismaService);
  stage='VERIFY_MIGRATED_PERMISSION_CATALOG';
  const requested=[...new Set(Object.values(roleGrants).flat())];
  const permissions=await db.permission.findMany({
    where:{permissionCode:{in:requested}},
    select:{id:true,permissionCode:true}
  });
  const pmap=new Map(permissions.map(p=>[p.permissionCode,p.id]));
  requireSafe(requested.every(p=>pmap.has(p)),'MIGRATED_PERMISSIONS_INCOMPLETE');

  stage='SEED_SYNTHETIC_TWO_COMPANIES';
  const suffix=randomUUID().slice(0,8);
  const company=await db.company.create({data:{
    companyCode:'M4A-'+suffix,companyName:'Disposable M4 roles A',baseCurrencyCode:'THB'
  }});
  const foreign=await db.company.create({data:{
    companyCode:'M4B-'+suffix,companyName:'Disposable M4 roles B',baseCurrencyCode:'THB'
  }});
  const customer=await db.customer.create({data:{companyId:company.id,
    customerCode:'C-'+suffix,customerName:'Disposable A'}});
  const otherCustomer=await db.customer.create({data:{companyId:foreign.id,
    customerCode:'D-'+suffix,customerName:'Disposable B'}});
  const dates={contractValue:'1000',contractCurrencyCode:'THB',
    plannedStartDate:new Date('2026-01-01T00:00:00Z'),
    plannedCompletionDate:new Date('2027-12-31T00:00:00Z')};
  const makeProject=(c,cust,code)=>db.project.create({data:{
    companyId:c,customerId:cust,projectCode:code,
    projectName:'Disposable '+code,...dates}});
  const assigned=await makeProject(company.id,customer.id,'A-'+suffix);
  const unassigned=await makeProject(company.id,customer.id,'U-'+suffix);
  const outside=await makeProject(foreign.id,otherCustomer.id,'F-'+suffix);

  stage='SEED_EIGHT_REAL_ROLE_CODES';
  const roles={};
  for(const [code,codes] of Object.entries(roleGrants)){
    roles[code]=await db.role.create({data:{
      companyId:company.id,roleCode:code,roleName:'Disposable '+code
    }});
    await db.rolePermission.createMany({data:codes.map(c=>({
      roleId:roles[code].id,permissionId:pmap.get(c)
    }))});
  }
  const actors={};
  const passwordService=new PasswordService();
  for(const key of keys){
    const a=PERSONAS[key];
    const password=randomBytes(32).toString('hex');
    const employee=await db.employee.create({data:{companyId:company.id,
      employeeCode:'M4-'+key+'-'+suffix,employeeName:'Disposable '+key}});
    const user=await db.user.create({data:{companyId:company.id,
      employeeId:employee.id,email:'m4-'+key.toLowerCase()+'-'+suffix+'@example.invalid',
      displayName:'Disposable '+key,passwordHash:await passwordService.hash(password)}});
    await db.projectMember.create({data:{
      projectId:assigned.id,employeeId:employee.id,projectRole:'DISPOSABLE_SITE'
    }});
    for(const code of a.roles)await db.userRole.create({data:{
      companyId:company.id,userId:user.id,roleId:roles[code].id
    }});
    actors[key]={userId:user.id,email:user.email,password,roleCodes:[...a.roles]};
  }
  const disabledPassword=randomBytes(32).toString('hex');
  const disabled=await db.employee.create({data:{companyId:company.id,
    employeeCode:'M4-DISABLED-'+suffix,employeeName:'Disposable disabled'}});
  await db.user.create({data:{companyId:company.id,employeeId:disabled.id,
    email:'m4-disabled-'+suffix+'@example.invalid',
    displayName:'Disposable disabled',passwordHash:await passwordService.hash(disabledPassword),
    isActive:false}});
  const fixture={
    purpose:'M4_LANE_C_DISPOSABLE_SYNTHETIC_ONLY',
    sourceSha:EXACT,
    apiBase:API+'/api/v1',webOrigin:WEB,databaseName:'erp_m4_lane_c_20261124',
    companyId:company.id,projectId:assigned.id,
    sameCompanyOtherProjectId:unassigned.id,
    foreignCompanyId:foreign.id,foreignProjectId:outside.id,
    employeeId:disabled.id,actors,
    disabledActor:{email:'m4-disabled-'+suffix+'@example.invalid',password:disabledPassword}
  };
  validateFixture(fixture,EXACT);
  const fixturePath=join(folder,'private-disposable-fixture.json');
  await writeFile(fixturePath,JSON.stringify(fixture),{mode:0o600,flag:'wx'});
  stage='REAL_VITE_UI';
  web=await createServer({root:join(ROOT,'apps/web'),
    server:{host:'127.0.0.1',port:44375,strictPort:true,
      proxy:{'/api':{target:API,changeOrigin:false}}}});
  await web.listen();
  stage='REAL_EIGHT_ROLE_CHROMIUM';
  const child=spawn(process.execPath,[
    join(ROOT,'deploy/uat/m4-eight-role-journeys-20261124.mjs'),
    '--disposable-readback',fixturePath
  ],{
    cwd:ROOT,
    env:{...process.env,
      M4_LANE_C_APPROVED_SOURCE_SHA:EXACT,
      M4_LANE_C_DISPOSABLE_VERIFIED:'YES'},
    stdio:['ignore','pipe','pipe']
  });
  let output='';
  child.stdout.on('data',chunk=>{if(output.length<50000)output+=chunk.toString()});
  child.stderr.resume();
  const [exitCode]=await once(child,'close');
  let report=null;
  try{report=JSON.parse(output.trim().split('\n').at(-1))}catch{}
  if(report?.status==='FAILED')failure('CHROMIUM_'+String(report.safeCode||'BROWSER_FAILED')
    .replace(/[^A-Z0-9_]/g,'').slice(0,72));
  requireSafe(report&&Array.isArray(report.personas),'REAL_CHROMIUM_RECEIPT_MISSING');
  requireSafe(report.personas.length===9,'EIGHT_ROLES_AND_DISABLED_ACTOR_NOT_COMPLETE');
  requireSafe(report.personas.every(x=>Array.isArray(x.checks)&&
    x.checks.length>=1&&x.checks.every(c=>c.status==='PASS')),
    'REAL_BROWSER_ROLE_BOUNDARY_NOT_PROVEN');
  requireSafe(report.status==='PARTIAL_BLOCKED_FIXTURE'&&exitCode===1,
    'SENSITIVE_ARTIFACTS_NOT_REPORTED_AS_PARTIAL');
  const expectedMissing=['clientBoqVersionId','foreignDocumentId',
    'otherProjectDocumentId','hrAttachmentId'];
  requireSafe(expectedMissing.every(x=>report.missingSyntheticArtifacts.includes(x))&&
    report.missingSyntheticArtifacts.length===expectedMissing.length,
    'PROTECTED_ARTIFACT_STATUS_INCORRECT');
  const count=report.personas.reduce((sum,a)=>sum+a.checks.length,0);
  console.log('M4_SYNTHETIC_EIGHT_CANONICAL_ROLE_BROWSER_PARTIAL_VERIFIED checks='+count+
    ' people=8 disabled=1 source='+EXACT.slice(0,12)+
    ' protected-artifact-bytes=BLOCKED_CONFIGURATION retained-UAT=false');
} catch(error){
  const code=String(error?.safeCode??'DISPOSABLE_RUNNER_FAILED')
    .replace(/[^A-Z0-9_]/g,'').slice(0,100);
  console.error('M4_DISPOSABLE_ROLE_FIXTURE_BLOCKED_'+code);
  process.exitCode=1;
} finally {
  try{if(web)await web.close()}catch{}
  try{if(app)await app.close()}catch{}
  try{await rm(folder,{recursive:true,force:true})}catch{}
}
