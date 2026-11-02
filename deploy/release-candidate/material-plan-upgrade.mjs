// DEC-044 foundation proof: exact owned disposable CI targets only.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const [mode,manifestPath]=process.argv.slice(2);
let url;try{url=new URL(process.env.DATABASE_URL??'');}catch{throw Error('Invalid material plan proof target');}
if(process.env.GITHUB_ACTIONS!=='true'||process.env.RC_NON_PRODUCTION_CONFIRMED!=='YES'||process.env.MATERIAL_PLAN_SCHEMA_UPGRADE!=='YES'||
 !['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/construction_erp_v10e_(upgrade|hrrestore)_[a-f0-9]{12}$/.test(url.pathname)||
 !['protect','restored'].includes(mode)||!/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/mp-plan\.json$/.test(manifestPath??''))throw Error('Material plan proof requires exact disposable CI context');
const require=createRequire(resolve('apps/api/package.json'));const {PrismaService}=require('./dist/prisma/prisma.service.js');const {Prisma}=require('@prisma/client');const db=new PrismaService();await db.$connect();
const tables=['material_usage_plans','material_usage_plan_revisions','material_usage_plan_lines','material_usage_plan_operations'];
async function snapshot(id){const result={};for(const table of tables){const where=table==='material_usage_plans'?'t.id=$1::uuid':table==='material_usage_plan_lines'?'t.revision_id IN (SELECT id FROM material_usage_plan_revisions WHERE plan_id=$1::uuid)':'t.plan_id=$1::uuid';
 const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${where}`,id);result[table]=row;}return result;}
try{
 if(mode==='protect'){
  const {materialPlanFixture}=require('./dist/inventory/material-plan-test-fixture.js');const f=await materialPlanFixture(db);
  const warehouse=await db.warehouse.create({data:{companyId:f.company.id,projectId:f.project.id,warehouseCode:'MP-RESTORE',warehouseName:'Plan-only restored warehouse',isSiteWarehouse:true}});
  assert.equal(await db.stockTransaction.count({where:{warehouseId:warehouse.id}}),0);
  assert.equal(await db.materialRequest.count({where:{warehouseId:warehouse.id}}),0);
  let receipt=await f.service.create({auth:f.store.auth},{...f.input('6'),warehouseId:warehouse.id});
  receipt=await f.service.submit({auth:f.store.auth},receipt.id,{requestKey:randomUUID(),expectedVersion:receipt.version});
  receipt=await f.service.decide({auth:f.manager.auth},receipt.id,{requestKey:randomUUID(),expectedVersion:receipt.version,decision:'APPROVE',comment:'Synthetic first plan approval'});
  receipt=await f.service.revise({auth:f.store.auth},receipt.id,{requestKey:randomUUID(),expectedVersion:receipt.version,validFrom:'2026-11-01',validTo:'2026-12-31',reason:'Synthetic retained plan revision',lines:f.input('5').lines});
  receipt=await f.service.submit({auth:f.store.auth},receipt.id,{requestKey:randomUUID(),expectedVersion:receipt.version});
  receipt=await f.service.decide({auth:f.manager.auth},receipt.id,{requestKey:randomUUID(),expectedVersion:receipt.version,decision:'APPROVE',comment:'Synthetic replacement plan approval'});
  const expected=JSON.parse(JSON.stringify(await f.service.get(f.store.auth,receipt.id)));
  assert.equal(expected.latestRevision.revisionNo,2);assert.equal(expected.approvedRevision.lines[0].quantity,'5.0000');
  writeFileSync(manifestPath,JSON.stringify({id:receipt.id,expected,tables:await snapshot(receipt.id),sessionToken:f.store.session.sessionToken,outsiderToken:f.outsider.session.sessionToken}),{mode:0o600});
  console.log('MATERIAL_PLAN_POPULATED_HISTORY_PROTECTED');
 }else{
  const state=JSON.parse(readFileSync(manifestPath,'utf8'));assert.deepEqual(await snapshot(state.id),state.tables);
  await assert.rejects(()=>db.warehouse.update({where:{id:state.expected.warehouseId},data:{projectId:null,isSiteWarehouse:false}}),e=>e instanceof Prisma.PrismaClientKnownRequestError&&e.code==='P2003'&&String(e.meta?.field_name).includes('material_usage_plans_warehouse_scope_fkey'));
  console.log('MATERIAL_PLAN_RESTORED_WAREHOUSE_SCOPE_PASS');
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js'),{ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
  try{
   const root=await app.getUrl()+'/api/v1/inventory/material-plans/'+state.id;
   const response=await fetch(root,{headers:{Cookie:'erp_session='+state.sessionToken}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual((await response.json()).data,state.expected);
   assert.equal((await fetch(root,{headers:{Cookie:'erp_session='+state.outsiderToken}})).status,403);assert.equal((await fetch(root)).status,401);
   assert.deepEqual(await snapshot(state.id),state.tables);
  }finally{await app.close();}
  console.log('MATERIAL_PLAN_RESTORED_HTTP_HISTORY_QUANTITY_AND_SCOPE_PASS');
 }
}finally{await db.$disconnect();}
