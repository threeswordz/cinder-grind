import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { boqCatalog, verifyBoqCatalog } from './boq-catalog-contract.mjs';
import { hrCatalog, verifyHrCatalog } from './hr-catalog-contract.mjs';
import { assertHistoricalTables } from './historical-snapshot.mjs';

const [mode, previousRoot, manifestPath, keyPath] = process.argv.slice(2);
let target; try { target = new URL(process.env.DATABASE_URL ?? ''); } catch { throw new Error('Invalid disposable HR proof target.'); }
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RC_NON_PRODUCTION_CONFIRMED !== 'YES' ||
    !['localhost','127.0.0.1','[::1]'].includes(target.hostname) ||
    !/^\/construction_erp_v10e_(upgrade|hrrestore|rollback)_[a-f0-9]{12}$/.test(target.pathname) ||
    !['snapshot','verify','rollback','protect','restored'].includes(mode) || !previousRoot || !manifestPath) {
  throw new Error('HR upgrade proof requires the exact disposable CI rehearsal context.');
}
const candidate = createRequire(resolve('apps/api/package.json'));
const runtime = ['snapshot','rollback'].includes(mode) ? createRequire(resolve(previousRoot,'apps/api/package.json')) : candidate;
const { PrismaClient } = runtime('@prisma/client');
const db = new PrismaClient();
const protect = (path,value) => writeFileSync(path, JSON.stringify(value), {mode:0o600});
const load = path => {try{return JSON.parse(readFileSync(path,'utf8'));}catch{throw new Error('Protected CI proof input is unavailable or invalid.');}};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const knownCatalog = [...boqCatalog,...hrCatalog];
const provenanceColumns = { projects:['contract_currency_code'], boqs:['currency_code'], supplier_quotations:['currency_code'], quotation_awards:['currency_code'] };

async function snapshot(before) {
  const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`;
  const catalog = await db.permission.findMany({where:{id:{in:knownCatalog.map(p=>p.id)}}});
  const present = catalog.map(p=>p.id).sort();
  const rawCatalog = await db.$queryRaw`SELECT * FROM permissions`;
  verifyBoqCatalog(rawCatalog.filter(p=>boqCatalog.some(x=>x.id===p.id)));
  verifyHrCatalog(rawCatalog.filter(p=>hrCatalog.some(x=>x.id===p.id)),!['snapshot','rollback'].includes(mode));
  // Existing catalog rows are included in the digest, including creation dates.
  // Only exact reviewed definitions absent in the predecessor may be separated.
  const excluded = knownCatalog.filter(p=>!(before?.catalogPresent??present).includes(p.id)).map(p=>p.id);
  const hashes={}, columns={};
  for(const {tablename:name} of tables){
    if(!/^[a-z_]+$/.test(name))throw new Error('Unexpected rehearsal table');
    columns[name]=(await db.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=${name} ORDER BY column_name`).map(c=>c.column_name);
    const prior=before?.columns[name];
    const added=prior?columns[name].filter(c=>!prior.includes(c)):[];
    if(prior){
      assert.ok(prior.every(c=>columns[name].includes(c)),'Historical column removal');
      assert.ok(added.every(c=>(provenanceColumns[name]??[]).includes(c)),'Unapproved old-table column change');
    }
    const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count, encode(sha256(convert_to(coalesce(string_agg((to_jsonb(t)-$1::text[])::text,E'\n' ORDER BY (to_jsonb(t)-$1::text[])::text),''),'UTF8')),'hex') AS digest FROM "${name}" t ${name==='permissions'?'WHERE id <> ALL($2::uuid[])':''}`, ... (name==='permissions'?[added,excluded]:[added]));
    hashes[name]=row;
  }
  const migrations=await db.$queryRaw`SELECT migration_name,checksum FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  return {tables:hashes,columns,catalogPresent:present,migrations};
}

async function service(){
  const {PrismaService}=candidate('./dist/prisma/prisma.service.js');
  const {hrFixture,hrFacts}=candidate('./dist/hr/hr-test-fixture.js');
  return {PrismaService,hrFixture,hrFacts};
}
try {
  if(mode==='snapshot') protect(manifestPath,await snapshot());
  else if(mode==='verify'||mode==='rollback'){
    const before=load(manifestPath),after=await snapshot(before);
    if(mode==='rollback'){
      assert.deepEqual(after.tables,before.tables,'Restored predecessor rows/table inventory changed');
      assert.deepEqual(after.columns,before.columns,'Restored predecessor columns changed');
      assert.deepEqual(after.catalogPresent,before.catalogPresent,'Restored predecessor catalog changed');
      assert.deepEqual(after.migrations,before.migrations,'Restored predecessor migrations changed');
    }else assertHistoricalTables(before.tables,after.tables,
      process.env.HR_SCHEMA_UPGRADE === 'YES', process.env.HR_DOCUMENT_SCHEMA_UPGRADE === 'YES');
    for(const migration of before.migrations)assert.deepEqual(after.migrations.find(m=>m.migration_name===migration.migration_name),migration);
    console.log(mode==='rollback'?'HR_EXACT_PREDECESSOR_ROLLBACK_ROWS_PRESERVED':'HR_PREDECESSOR_ROWS_AND_MIGRATIONS_PRESERVED');
  } else {
    if(!keyPath)throw new Error('External disposable key custody file required');
    if(mode==='protect') protect(keyPath,{keys:{recover1:randomBytes(32).toString('base64'),recover2:randomBytes(32).toString('base64')},active:'recover1'});
    const custody=load(keyPath);
    process.env.HR_PRIVATE_KEYS=JSON.stringify(custody.keys); process.env.HR_PRIVATE_ACTIVE_KEY_ID=custody.active;
    const {PrismaService,hrFixture,hrFacts}=await service();
    const prisma=new PrismaService();await prisma.$connect();
    try {
      if(mode==='protect'){
        const f=await hrFixture(prisma),auth=f.actors.hr.auth,companyId=f.company.id,employeeId=f.legacy.id;
        const original={employee:await prisma.employee.findUniqueOrThrow({where:{id:employeeId}}),
          user:await prisma.user.findUniqueOrThrow({where:{id:f.legacyUser.id}}),member:await prisma.projectMember.findUniqueOrThrow({where:{id:f.legacyMember.id}})};
        await f.service.employment(auth,companyId,employeeId,{requestId:randomUUID(),expectedVersion:0,facts:hrFacts({reason:'Synthetic protected historical reason'})});
        await f.service.privateWrite(auth,companyId,employeeId,'identity',{requestId:randomUUID(),expectedVersion:0,values:{identityNumber:'Synthetic protected restore identity'},reason:'Synthetic private identity correction'});
        await f.service.privateWrite(auth,companyId,employeeId,'bank',{requestId:randomUUID(),expectedVersion:0,values:{accountNumber:'Synthetic protected restore bank v1'},reason:'Synthetic bank correction'});
        process.env.HR_PRIVATE_ACTIVE_KEY_ID='recover2'; custody.active='recover2'; protect(keyPath,custody);
        await f.service.privateWrite(auth,companyId,employeeId,'bank',{requestId:randomUUID(),expectedVersion:1,values:{accountNumber:'Synthetic protected restore bank v2'},reason:'Synthetic bank correction v2'});
        const identity=await f.service.privateRead(auth,companyId,employeeId,'identity',1),bank1=await f.service.privateRead(auth,companyId,employeeId,'bank',1),bank2=await f.service.privateRead(auth,companyId,employeeId,'bank',2);
        const history=await f.service.history(auth,companyId,employeeId);
        const reason=await f.service.employmentReason(auth,companyId,employeeId,history.employment.revisions[0].id);
        protect(manifestPath,{companyId,employeeId,userId:auth.userId,sessionId:auth.sessionId,legacyUserId:f.legacyUser.id,memberId:f.legacyMember.id,
          revisionId:history.employment.revisions[0].id,expected:{identity:digest(identity),bank1:digest(bank1),bank2:digest(bank2),reason:digest(reason),original:digest(original)}});
        console.log('HR_NONEMPTY_ENCRYPTED_RECORD_FIXTURE_CREATED');
      }else{
        const {AuditService}=candidate('./dist/audit/audit.service.js'),{HrService}=candidate('./dist/hr/hr.service.js'),{HrPrivateCrypto}=candidate('./dist/hr/hr-private-crypto.js');
        const f=load(manifestPath),auth={userId:f.userId,companyId:f.companyId,sessionId:f.sessionId,email:'',displayName:'',roleCodes:[],permissions:[],csrfTokenHash:''};
        const {ProjectAccessService}=candidate('./dist/projects/project-access.service.js'),{ProjectScopeService}=candidate('./dist/authorization/project-scope.service.js'),{AuthorizationService}=candidate('./dist/authorization/authorization.service.js');
        const projects=new ProjectAccessService(prisma,new ProjectScopeService(new AuthorizationService()));
        const hr=new HrService(prisma,new AuditService(prisma),projects,new HrPrivateCrypto());
        const original={employee:await prisma.employee.findUniqueOrThrow({where:{id:f.employeeId}}),user:await prisma.user.findUniqueOrThrow({where:{id:f.legacyUserId}}),member:await prisma.projectMember.findUniqueOrThrow({where:{id:f.memberId}})};
        assert.equal(digest(original),f.expected.original);
        for(const [name,category,version] of [['identity','identity',1],['bank1','bank',1],['bank2','bank',2]])assert.equal(digest(await hr.privateRead(auth,f.companyId,f.employeeId,category,version)),f.expected[name]);
        assert.equal(digest(await hr.employmentReason(auth,f.companyId,f.employeeId,f.revisionId)),f.expected.reason);
        const valid=process.env.HR_PRIVATE_KEYS;
        const unavailable = error => error?.getResponse?.().code === 'HR_PRIVATE_UNAVAILABLE';
        delete process.env.HR_PRIVATE_KEYS;await assert.rejects(hr.privateRead(auth,f.companyId,f.employeeId,'bank',1),unavailable);
        process.env.HR_PRIVATE_KEYS=JSON.stringify({recover1:randomBytes(32).toString('base64'),recover2:randomBytes(32).toString('base64')});
        await assert.rejects(hr.privateRead(auth,f.companyId,f.employeeId,'bank',1),unavailable);
        process.env.HR_PRIVATE_KEYS=valid;
        assert.equal(digest(await hr.privateRead(auth,f.companyId,f.employeeId,'bank',2)),f.expected.bank2);
        console.log('HR_ENCRYPTED_RECORD_RESTORE_AND_EXTERNAL_KEY_CUSTODY_PASS');
      }
    } finally {await prisma.$disconnect();}
  }
} finally {await db.$disconnect();}
