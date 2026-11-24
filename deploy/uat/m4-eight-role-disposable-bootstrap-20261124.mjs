// One-time, exact-reviewed-source disposable eight-role Chromium proof.
// Runner-only child branch. Never run against Mac, retained MKE/TCJ or Production.
// Missing protected artifacts are intentionally reported PARTIAL, not a green UAT.
import assert from 'node:assert/strict';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const REVIEWED_APP='435bd8805d5bcd7e0a1a9941668b67860f288b78';
const EXACT=process.env.GITHUB_SHA;
assert.match(EXACT??'',/^[0-9a-f]{40}$/,'EXACT_TEST_SHA_REQUIRED');
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
const changes=spawnSync('git',['diff','--name-only',REVIEWED_APP,EXACT],
  {cwd:ROOT,encoding:'utf8'});
const allowed=new Set([
  '.github/workflows/m4-eight-role-disposable-native-once.yml',
  'deploy/uat/m4-eight-role-disposable-bootstrap-20261124.mjs',
  'deploy/uat/m4-eight-role-journeys-20261124.mjs'
]);
const paths=changes.stdout.trim().split('\n').filter(Boolean);
requireSafe(changes.status===0&&paths.length===allowed.size&&
  paths.every(p=>allowed.has(p)),
  'UNREVIEWED_APPLICATION_SOURCE_CHANGED');
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
const {DocumentStorage}=apiRequire('./dist/documents/document-storage.js');
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
  FINANCE_MANAGER:['projects.project.view','projects.access_all','budget.customer.view',
    'budget.cost.full_view','budget.boq.view','budget.revision.view'],
  MANAGEMENT:['projects.project.view','projects.access_all','procurement.po.view',
    'documents.document.view','budget.cost.full_view','budget.boq.view','budget.revision.view','budget.customer.view'],
  PROJECT_MANAGER:['projects.project.view','projects.access_all','inventory.receipt.view'],
  STOREKEEPER:['projects.project.view','procurement.pr.view','documents.document.view'],
  PROCUREMENT_OFFICER:['projects.project.view','projects.access_all','procurement.po.view'],
  PROJECT_ENGINEER:['projects.project.view','site.daily_report.view'],
  FINANCE_OFFICER:['projects.project.view','finance.supplier_invoice.view'],
  UAT_HR_STAFF:['projects.project.view','hr.employment.view','hr.documents.view','hr.documents.manage'],
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
  // All objects below are synthetic records in a newly created disposable DB.
  // A positive authenticated download must succeed before its denial is useful.
  stage='CREATE_POSITIVE_CONTROL_PROTECTED_BYTES';
  const fingerprint=bytes=>createHash('sha256').update(bytes).digest('hex');
  async function signIn(email,password){
    const result=await fetch(API+'/api/v1/auth/login',{
      method:'POST',headers:{Origin:WEB,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),redirect:'error'});
    requireSafe(result.status===201,'POSITIVE_ACTOR_LOGIN_DENIED');
    const cookie=result.headers.get('set-cookie')?.split(';',1)[0];
    const data=await result.json();
    requireSafe(cookie?.startsWith('erp_session=')&&typeof data?.data?.csrfToken==='string',
      'POSITIVE_ACTOR_SESSION_INVALID');
    return {cookie,csrf:data.data.csrfToken};
  }
  async function positiveGet(session,pathname,expected){
    const response=await fetch(API+'/api/v1'+pathname,{
      headers:{Cookie:session.cookie,Origin:WEB},redirect:'error'});
    requireSafe(response.status===200,'POSITIVE_PROTECTED_RECORD_READ_DENIED');
    const bytes=Buffer.from(await response.arrayBuffer());
    requireSafe(bytes.equals(expected),'POSITIVE_PROTECTED_BYTES_WRONG');
    return bytes.length;
  }
  async function signOut(session){
    const response=await fetch(API+'/api/v1/auth/logout',{method:'POST',
      headers:{Cookie:session.cookie,Origin:WEB,'x-csrf-token':session.csrf},
      redirect:'error'});
    requireSafe(response.status===204,'POSITIVE_SESSION_REVOCATION_FAILED');
  }
  stage='DOCUMENT_STORAGE_RESOLVE';
  const storage=app.get(DocumentStorage);
  async function seedProjectBytes(owner,project,uploader,label) {
    const bytes=Buffer.from('LANEC_SYNTHETIC_SECRET '+label+' '+suffix,'utf8');
    const documentType=await db.documentType.create({data:{
      companyId:owner,documentTypeCode:'DP-'+label+'-'+suffix,
      documentTypeName:'Disposable '+label
    }});
    const stored=await storage.put(bytes);
    const document=await db.document.create({data:{
      companyId:owner,documentTypeId:documentType.id,fileName:label+'.txt',
      storageProvider:stored.storageProvider,storageKey:stored.storageKey,
      mimeType:'text/plain',fileSizeBytes:bytes.length,
      uploadedByUserId:uploader,checksum:fingerprint(bytes)
    }});
    await db.documentLink.create({data:{documentId:document.id,
      entityType:'PROJECT',entityId:project,linkedByUserId:uploader}});
    const actual=await storage.read(stored.storageKey);
    requireSafe(actual.equals(bytes)&&fingerprint(actual)===fingerprint(bytes),
      'PROTECTED_STORAGE_POSITIVE_SOURCE_MISSING');
    return {id:document.id,bytes};
  }
  // Real second-company actor proves the foreign document is not a fake 404.
  const foreignProofPassword=randomBytes(32).toString('hex');
  const foreignEmployee=await db.employee.create({data:{
    companyId:foreign.id,employeeCode:'WIT-'+suffix,employeeName:'Foreign positive verifier'
  }});
  const foreignUser=await db.user.create({data:{companyId:foreign.id,
    employeeId:foreignEmployee.id,email:'foreign-verifier-'+suffix+'@example.invalid',
    passwordHash:await passwordService.hash(foreignProofPassword),
    displayName:'Disposable foreign positive verifier'}});
  const foreignRole=await db.role.create({data:{
    companyId:foreign.id,roleCode:'DISPOSABLE_PROJECT_DOCUMENT_VERIFIER',
    roleName:'Disposable same-Company positive verifier'
  }});
  await db.rolePermission.createMany({data:
    ['projects.project.view','documents.document.view'].map(code=>({
      roleId:foreignRole.id,permissionId:pmap.get(code)}))
  });
  await db.userRole.create({data:{
    companyId:foreign.id,userId:foreignUser.id,roleId:foreignRole.id}});
  await db.projectMember.create({data:{
    projectId:outside.id,employeeId:foreignEmployee.id,projectRole:'PROTECTED_DOC_PROOF'}});

  stage='FOREIGN_DOCUMENT_SOURCE_AND_BYTES';
  const foreignDocument=await seedProjectBytes(
    foreign.id,outside.id,foreignUser.id,'foreign-document');
  stage='OTHER_PROJECT_DOCUMENT_SOURCE_AND_BYTES';
  const sameCompanyDocument=await seedProjectBytes(
    company.id,unassigned.id,actors.BEN.userId,'unassigned-document');

  stage='FOREIGN_DOCUMENT_AUTHENTICATED_POSITIVE';
  const foreignSession=await signIn(foreignUser.email,foreignProofPassword);
  await positiveGet(foreignSession,
    '/documents/projects/'+outside.id+'/'+foreignDocument.id+'/download',
    foreignDocument.bytes);
  await signOut(foreignSession);
  stage='OTHER_PROJECT_AUTHENTICATED_POSITIVE';
  const benSession=await signIn(actors.BEN.email,actors.BEN.password);
  await positiveGet(benSession,
    '/documents/projects/'+unassigned.id+'/'+sameCompanyDocument.id+'/download',
    sameCompanyDocument.bytes);

  // Client BOQ requires the actual authorized cost revision workflow.
  // Never bypass ERP_THB_PROVENANCE_REQUIRED by manufacturing a priced revision.
  // Client BOQ protected-byte evidence remains BLOCKED_CONFIGURATION.
  await signOut(benSession);

  // Real encrypted HR upload under a persisted employee/role/category grant.
  stage='HR_CATEGORY_SOURCE_GRANT_SYNTHETIC_ONLY';
  // Database rejects self-granted HR scope. A distinct disposable synthetic
  // actor witnesses fixture setup; this is NOT a retained Owner authorization.
  await db.hrCompanyAccess.create({data:{
    companyId:company.id,userId:actors.KOH.userId,category:'documents',
    reasonCode:'OWNER_APPROVED_SCOPE',updatedByUserId:actors.BEN.userId
  }});
  const hrType=await db.documentType.create({data:{
    companyId:company.id,documentTypeCode:'HR-'+suffix,
    documentTypeName:'Disposable encrypted HR attachment'
  }});
  const kohSession=await signIn(actors.KOH.email,actors.KOH.password);
  const hrBytes=Buffer.from('LANEC_SYNTHETIC_SECRET PRIVATE HR '+suffix,'utf8');
  const form=new FormData();
  form.set('requestId',randomUUID());
  form.set('documentTypeId',hrType.id);
  form.set('expectedVersion','0');
  form.set('file',new Blob([hrBytes],{type:'text/plain'}),'private-proof.txt');
  stage='HR_AUTHENTICATED_ENCRYPTED_UPLOAD';
  const upload=await fetch(API+'/api/v1/hr/companies/'+company.id+
    '/employees/'+disabled.id+'/documents',{method:'POST',
      headers:{Cookie:kohSession.cookie,Origin:WEB,
        'x-csrf-token':kohSession.csrf},body:form,redirect:'error'});
  requireSafe(upload.status===201,'HR_PRIVATE_REAL_UPLOAD_DENIED');
  const hrUploadReceipt=await upload.json();
  const hrAttachmentId=hrUploadReceipt?.data?.id;
  requireSafe(typeof hrAttachmentId==='string'&&
    /^[0-9a-f-]{36}$/i.test(hrAttachmentId),
    'HR_ATTACHMENT_CANONICAL_RECORD_MISSING');
  stage='HR_ENCRYPTED_SOURCE_EXISTENCE';
  const hrDb=await db.hrDocumentAttachment.findUnique({
    where:{id:hrAttachmentId},include:{document:true}});
  requireSafe(hrDb?.document?.storageProvider==='LOCAL'&&
    hrDb?.document?.checksum&&hrDb?.encryptedMetadata,
    'HR_PRIVATE_SOURCE_OR_CIPHERTEXT_MISSING');
  const encrypted=await storage.read(hrDb.document.storageKey);
  requireSafe(fingerprint(encrypted)===hrDb.document.checksum&&
    !encrypted.includes('LANEC_SYNTHETIC_SECRET'),
    'HR_PRIVATE_STORAGE_CIPHERTEXT_UNSAFE');
  stage='HR_AUTHENTICATED_POSITIVE_DOWNLOAD';
  await positiveGet(kohSession,
    '/hr/companies/'+company.id+'/employees/'+disabled.id+
      '/documents/'+hrAttachmentId+'/download',hrBytes);
  await signOut(kohSession);
  stage='THREE_REAL_POSITIVE_CONTROLS_VERIFIED';

  const fixture={
    purpose:'M4_LANE_C_DISPOSABLE_SYNTHETIC_ONLY',
    sourceSha:EXACT,
    apiBase:API+'/api/v1',webOrigin:WEB,databaseName:'erp_m4_lane_c_20261124',
    companyId:company.id,projectId:assigned.id,
    sameCompanyOtherProjectId:unassigned.id,
    foreignCompanyId:foreign.id,foreignProjectId:outside.id,
    employeeId:disabled.id,actors,
    foreignDocumentId:foreignDocument.id,
    otherProjectDocumentId:sameCompanyDocument.id,
    hrAttachmentId,
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
    'UNSEEDED_COST_BOQ_MUST_NOT_PASS_FULL_BROWSER');
  requireSafe(Array.isArray(report.missingSyntheticArtifacts)&&
    report.missingSyntheticArtifacts.length===1&&
    report.missingSyntheticArtifacts[0]==='clientBoqVersionId',
    'PROTECTED_ARTIFACT_BLOCKER_NOT_EXACT');
  const count=report.personas.reduce((sum,a)=>sum+a.checks.length,0);
  requireSafe(count>=74,'EXPECTED_THREE_PROTECTED_RECORD_CHECKS_MISSING');
  console.log('M4_DISPOSABLE_DOC_HR_POSITIVE_PARTIAL checks='+count+
    ' canonicalRoles=8 disabled=1 source='+EXACT.slice(0,12)+
    ' verified=foreign-doc+other-project-doc+encrypted-hr client-boq=BLOCKED_PROVENANCE'+
    ' retainedUat=false humanAcceptance=false');
} catch(error){
  const code=String(error?.safeCode??'DISPOSABLE_RUNNER_FAILED')
    .replace(/[^A-Z0-9_]/g,'').slice(0,100);
  const safeKind=String(error?.constructor?.name??'ERROR')
    .replace(/[^A-Za-z0-9_]/g,'').slice(0,48).toUpperCase();
  const safeDb=String(error?.code??'NONE').replace(/[^A-Za-z0-9_]/g,'').slice(0,30);
  console.error('M4_DISPOSABLE_ROLE_FIXTURE_BLOCKED_'+code+
    '_STAGE_'+stage+'_KIND_'+safeKind+'_DB_'+safeDb);
  process.exitCode=1;
} finally {
  try{if(web)await web.close()}catch{}
  try{if(app)await app.close()}catch{}
  try{await rm(folder,{recursive:true,force:true})}catch{}
}
