// DEC-050 C disposable populated-copy proof. Never a retained Mac operator.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {stageCTables} from './material-uom-stage-c-schema-contract.mjs';
const [mode,manifest]=process.argv.slice(2),url=new URL(process.env.DATABASE_URL??'');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.env.MATERIAL_UOM_STAGE_C_SCHEMA_UPGRADE,'YES');
assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
assert.match(url.pathname,/^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);
assert.ok(['pristine','protect','restored'].includes(mode));
assert.match(manifest??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/material-uom-stage-c-(?:pristine|protected)\.json$/);
assert.equal(manifest.endsWith('-pristine.json'),mode==='pristine');
const require=createRequire(resolve('apps/api/package.json'));require('reflect-metadata');
const {PrismaService}=require('./dist/prisma/prisma.service.js');
const db=new PrismaService();
async function snapshot(){
 const names=await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','user_sessions') ORDER BY tablename`;
 const tables={};
 for(const {tablename:name} of names){
  assert.match(name,/^[a-z_]+$/);
  const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${name}" t`);
  tables[name]=row;
 }
 return tables;
}
async function apiReads(probes){
 const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
 const {SessionService}=require('./dist/auth/session.service.js');
 const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js');
 const {securityHeadersMiddleware}=require('./dist/common/security-headers.js');
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
 const sessions=[];
 try{
  await app.listen(0,'127.0.0.1');const base=await app.getUrl()+'/api/v1';
  const service=app.get(SessionService),results=[];
  for(const probe of probes){
   const user=await db.user.findUniqueOrThrow({where:{id:probe.userId}});
   assert.match(user.email,/@example\.invalid$/);
   const session=await service.create(user.id);sessions.push(session.sessionId);
   const response=await fetch(base+probe.path,{headers:{Cookie:'erp_session='+session.sessionToken}});
   assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
   const body=await response.json();assert.doesNotMatch(JSON.stringify(body),/"(?:rate|amount|salary|bankAccount|contractValue)"/);
   const anonymous=await fetch(base+probe.path);assert.equal(anonymous.status,401);
   const foreign=await db.user.findFirstOrThrow({where:{companyId:{not:user.companyId},isActive:true,email:{endsWith:'@example.invalid'}}});
   const foreignSession=await service.create(foreign.id);sessions.push(foreignSession.sessionId);
   const denied=await fetch(base+probe.path,{headers:{Cookie:'erp_session='+foreignSession.sessionToken}});
   assert.ok([403,404].includes(denied.status));
   results.push({userId:user.id,path:probe.path,body});
  }
  return results;
 }finally{
  try{await app.close();}finally{await db.userSession.updateMany({where:{id:{in:sessions}},data:{revokedAt:new Date()}});}
 }
}
try{
 await db.$connect();const before=await snapshot();
 if(mode==='pristine'){
  for(const table of stageCTables)assert.equal(before[table]?.count,'0','No Stage C historical backfill');
  writeFileSync(manifest,JSON.stringify({tables:stageCTables}),{mode:0o600,flag:'wx'});
  console.log('MATERIAL_UOM_STAGE_C_PRISTINE_NO_BACKFILL_VERIFIED');
 }else if(mode==='protect'){
  assert.deepEqual(JSON.parse(readFileSync(manifest.replace('-protected.json','-pristine.json'),'utf8')).tables,stageCTables);
  for(const table of stageCTables)assert.ok(Number(before[table]?.count)>0,'Actual converted plan/request/allocation required');
  const plan=await db.materialUsagePlan.findFirstOrThrow({where:{revisions:{some:{lines:{some:{materialUomPlanLinePin:{isNot:null}}}}}},orderBy:{createdAt:'desc'}});
  const request=await db.materialRequest.findFirstOrThrow({where:{lines:{some:{materialUomRequestLinePins:{some:{}}}}},orderBy:{createdAt:'desc'}});
  const probes=[{userId:plan.createdByUserId,path:'/inventory/material-plans/'+plan.id},
   {userId:request.createdByUserId,path:'/inventory/material-requests/'+request.id}];
  const responses=await apiReads(probes);
  assert.match(JSON.stringify(responses[0].body),/FROZEN_STOCK_CANONICAL/);
  assert.match(JSON.stringify(responses[1].body),/stockQuantity/);
  for(const table of stageCTables)await assert.rejects(db.$executeRawUnsafe('UPDATE "'+table+'" SET numerator=\'999\''),/IMMUTABLE/);
  assert.deepEqual(await snapshot(),before,'Read/denial probes must preserve all business/Finance/grant rows');
  writeFileSync(manifest,JSON.stringify({tables:before,responses}),{mode:0o600,flag:'wx'});
  console.log('MATERIAL_UOM_STAGE_C_PROTECTED_HTTP_HISTORY_SQL_DENIAL_VERIFIED');
 }else{
  const receipt=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(before,receipt.tables,'Populated copy must preserve every business table');
  assert.deepEqual(await apiReads(receipt.responses),receipt.responses,'Restored authenticated plan/request facts must match original');
  assert.deepEqual(await snapshot(),before,'Restored application reads must preserve business history');
  console.log('MATERIAL_UOM_STAGE_C_POPULATED_RESTORED_APPLICATION_VERIFIED');
 }
}finally{await db.$disconnect();}
