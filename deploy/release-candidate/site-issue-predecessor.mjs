// Exact populated 480fd4c7 predecessor -> FM03; no legacy-row exclusions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {safeEnvironment} from '../uat/prototype-actors.mjs';
import {stripSiteIssueSchema} from './site-issue-schema-contract.mjs';
import {siteIssueCatalog,verifySiteIssueCatalog} from './site-issue-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const execute=promisify(execFile),previous='480fd4c7ee5e1aeab3fecf9670607a32a8f23d8b';
const require=createRequire(resolve('apps/api/package.json'));
export async function prepareFm03Upgrade(databaseUrl){
 const u=new URL(databaseUrl);assert.equal(process.platform,'linux');assert.equal(process.versions.node,'24.21.0');
 assert.ok(['127.0.0.1','localhost'].includes(u.hostname)&&['5432','55485'].includes(u.port));assert.match(u.pathname,/^\/fm03_[a-f0-9]{32}$/);
 const temp=await mkdtemp(join(tmpdir(),'erp-fm03-predecessor-'));
 const {PrismaClient}=require('@prisma/client'),db=new PrismaClient({datasources:{db:{url:u.href}},log:[]});
 try{
  const git=async args=>(await execute('git',args,{maxBuffer:16777216})).stdout;
  const schema=await git(['show',previous+':apps/api/prisma/schema.prisma']);
  const {readFile}=await import('node:fs/promises');
  assert.equal(stripSiteIssueSchema(await readFile('apps/api/prisma/schema.prisma','utf8')).text.replace(/\s+/g,' ').trim(),schema.replace(/\s+/g,' ').trim());
  await writeFile(join(temp,'schema.prisma'),schema,{mode:0o600});
  const names=(await git(['ls-tree','-r','--name-only',previous,'apps/api/prisma/migrations'])).trim().split('\n');
  for(const name of names){const rel=name.slice('apps/api/prisma/'.length),path=join(temp,rel);await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,await git(['show',previous+':'+name]),{mode:0o600});}
  await execute('pnpm',['--filter','@construction-erp/api','exec','prisma','migrate','deploy','--schema',join(temp,'schema.prisma')],{env:{...safeEnvironment(),DATABASE_URL:u.href},timeout:120000,maxBuffer:2097152});
  const tag=randomUUID(),company=await db.company.create({data:{companyCode:'FM3-PRE-'+tag,companyName:'Synthetic populated predecessor'}});
  const customer=await db.customer.create({data:{companyId:company.id,customerCode:'PRE',customerName:'Synthetic predecessor customer'}});
  const user=await db.user.create({data:{companyId:company.id,email:tag+'@example.invalid',displayName:'Synthetic predecessor',passwordHash:'unusable-synthetic-fixture'}});
  const project=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'PRE',projectName:'Preserved predecessor',contractValue:'0',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2026-12-31')}});
  await db.dailySiteReport.create({data:{companyId:company.id,projectId:project.id,createdByUserId:user.id,reportDate:new Date('2026-11-14'),issues:{create:{issueText:'Retained issue observation before FM03'}}}});
  async function snapshot(candidate){
   const result={},tables=await db.$queryRawUnsafe("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename");
   for(const {tablename}of tables){
    assert.match(tablename,/^[a-z_]+$/);
    if(candidate&&tablename==='permissions')verifySiteIssueCatalog(await db.$queryRawUnsafe('SELECT * FROM permissions WHERE id=ANY($1::uuid[])',siteIssueCatalog.map(p=>p.id)),true);
    const filter=candidate&&tablename==='permissions';
    const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${tablename}" t ${filter?'WHERE id <> ALL($1::uuid[])':''}`,...(filter?[siteIssueCatalog.map(p=>p.id)]:[]));result[tablename]=row;
   }return result;
  }
  const before=await snapshot(false);
  await execute('pnpm',['prisma:migrate:deploy'],{env:{...safeEnvironment(),DATABASE_URL:u.href},timeout:120000,maxBuffer:2097152});
  assertHistoricalTables(before,await snapshot(true),false,false,false,false,false,false,true);
  console.log('FM03_EXACT_POPULATED_PREDECESSOR_ALL_HISTORICAL_TABLES_AND_GRANTS_PASS');
 }finally{await db.$disconnect();await rm(temp,{recursive:true,force:true});}
}
