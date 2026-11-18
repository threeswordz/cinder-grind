// DEC-050 A: exact disposable restored-application proof. No Mac/retained target.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {materialUomTables} from './material-uom-schema-contract.mjs';
const [mode,manifest]=process.argv.slice(2),url=new URL(process.env.DATABASE_URL??'');
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');assert.equal(process.env.MATERIAL_UOM_SCHEMA_UPGRADE,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&/^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/.test(url.pathname));
assert.ok(['protect','restored'].includes(mode)&&/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/material-uom-protected\.json$/.test(manifest??''));
const require=createRequire(resolve('apps/api/package.json'));require('reflect-metadata');
const {PrismaService}=require('./dist/prisma/prisma.service.js'),db=new PrismaService();await db.$connect();
const json=value=>JSON.parse(JSON.stringify(value));
async function snapshot(materialId){
 const result={};for(const table of materialUomTables)result[table]=await db.$queryRawUnsafe(`SELECT to_jsonb(t)::text AS row FROM "${table}" t WHERE material_id=$1::uuid ORDER BY to_jsonb(t)::text`,materialId);return result;
}
try{
 if(mode==='protect'){
  const {materialUomFixture}=require('./dist/master-data/material-uom-test-fixture.js'),f=await materialUomFixture(db);
  await f.service.prepare({auth:f.maker.auth},f.material.id,{requestKey:randomUUID(),stockUomId:f.each.id,reason:'Explicit restored definition basis'});
  await f.service.revise({auth:f.maker.auth},f.material.id,{requestKey:randomUUID(),expectedVersion:1,sourceUomId:f.carton.id,effectiveFrom:'2026-01-01',numerator:'20',denominator:'1',reason:'Original immutable conversion'});
  await f.service.revise({auth:f.maker.auth},f.material.id,{requestKey:randomUUID(),expectedVersion:2,sourceUomId:f.carton.id,effectiveFrom:'2027-01-01',numerator:'24',denominator:'1',reason:'Future immutable conversion'});
  const input={sourceUomId:f.carton.id,businessDate:'2026-11-18',quantity:'2'};
  const expected=json(await f.service.get(f.viewer.auth,f.material.id)),preview=json(await f.service.preview(f.viewer.auth,f.material.id,input));
  assert.equal(preview.stockQuantity,'40.0000');assert.equal(expected.inventoryConversionEnabled,false);
  writeFileSync(manifest,JSON.stringify({materialId:f.material.id,expected,preview,input,rows:await snapshot(f.material.id),viewer:f.viewer.session,foreign:f.foreign.session,technical:f.technical.session}),{mode:0o600});
  console.log('MATERIAL_UOM_POPULATED_DEFINITIONS_PROTECTED');
 }else{
  const state=JSON.parse(readFileSync(manifest,'utf8'));assert.deepEqual(await snapshot(state.materialId),state.rows);
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js'),{ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
  try{
   const endpoint=await app.getUrl()+'/api/v1/master-data/material-conversions/'+state.materialId;
   const read=await fetch(endpoint,{headers:{Cookie:'erp_session='+state.viewer.sessionToken}});assert.equal(read.status,200);assert.equal(read.headers.get('cache-control'),'private, no-store');assert.deepEqual((await read.json()).data,state.expected);
   const preview=await fetch(endpoint+'/preview',{method:'POST',headers:{Cookie:'erp_session='+state.viewer.sessionToken,'X-CSRF-Token':state.viewer.csrfToken,'Content-Type':'application/json'},body:JSON.stringify(state.input)});assert.equal(preview.status,201);assert.deepEqual((await preview.json()).data,state.preview);
   for(const [token,status]of [[state.foreign.sessionToken,404],[state.technical.sessionToken,403],[null,401]])assert.equal((await fetch(endpoint,{headers:token?{Cookie:'erp_session='+token}:{}})).status,status);
   assert.deepEqual(await snapshot(state.materialId),state.rows);
  }finally{await app.close();}
  console.log('MATERIAL_UOM_RESTORED_APPLICATION_PREVIEW_HISTORY_AND_DENIALS_PASS');
 }
}finally{await db.$disconnect();}
