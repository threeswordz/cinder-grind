// Named disposable CI databases and private paired file roots only; never a Mac/retained operator.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {receivingTables} from './receiving-schema-contract.mjs';
const require=createRequire(resolve('apps/api/package.json'));
export async function receivingRecovery(mode,manifest,databaseUrl,storage){
 const url=new URL(databaseUrl);assert.equal(process.platform,'linux');
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
 assert.match(url.pathname,/^\/(?:erp_validation|receiving_[a-f0-9]{32}|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
 assert.ok(['protect','restored'].includes(mode));assert.ok(storage&&manifest);
 process.env.DATABASE_URL=url.href;process.env.STORAGE_ROOT=storage;require('reflect-metadata');
 const {PrismaService}=require('./dist/prisma/prisma.service.js'),{NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
 const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js');
 const db=new PrismaService();await db.$connect();const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
 let state;
 const hash=b=>createHash('sha256').update(b).digest('hex');
 async function snapshot(company){
  const result={};
  for(const table of [...receivingTables,'goods_receipts','goods_receipt_items','stock_transactions','documents','document_links']){
   const where=table==='goods_receipt_items'?'goods_receipt_id IN (SELECT id FROM goods_receipts WHERE company_id=$1::uuid)':table==='document_links'?'document_id IN (SELECT id FROM documents WHERE company_id=$1::uuid)':table==='receiving_delivery_lines'?'delivery_id IN (SELECT id FROM receiving_deliveries WHERE company_id=$1::uuid)':'company_id=$1::uuid';
   const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${where}`,company);result[table]=row;
  }return result;
 }
 const base=await app.getUrl()+'/api/v1';
 async function call(token,path,status=200){const r=await fetch(base+path,{headers:token?{Cookie:'erp_session='+token}:{}});assert.equal(r.status,status,path);return status===200?(await r.json()).data:null;}
 try{
  assert.equal((await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,url.pathname.slice(1));
  if(mode==='protect'){
   const {receivingProofFixture}=require('./dist/inventory/receiving-proof-fixture.js');
   const {f,id,grId,docs}=await receivingProofFixture(db,app,true);
   const {ReceivingService}=require('./dist/inventory/receiving.service.js'),service=app.get(ReceivingService);
   const pending=await service.capture({auth:f.store.auth},f.input({qualityRequired:true}));
   const expected=await call(f.store.session.sessionToken,'/inventory/receiving/deliveries/'+id);assert.equal(expected.usable,true);assert.equal(expected.lines[0].heldQuantity,'1.0000');
   state={company:f.company.id,id,grId,pending:pending.id,project:f.project.id,expected,snapshot:await snapshot(f.company.id),docs:docs.map(d=>({id:d.id,checksum:hash(Buffer.from(d.bytes,'base64')),size:Buffer.from(d.bytes,'base64').length})),store:f.store.session.sessionToken,outsider:f.outsider.session.sessionToken,viewer:f.viewer.session.sessionToken,users:[f.store,f.jai,f.pm,f.config,f.outsider,f.viewer,f.buyer,f.buyerChecker].map(a=>a.user.id)};
   await writeFile(manifest,JSON.stringify(state),{mode:0o600,flag:'wx'});
   console.log('RECEIVING_POPULATED_GR_HELD_ANOMALY_PENDING_AND_EVIDENCE_PROTECTED');
  }else{
   state=JSON.parse(await readFile(manifest,'utf8'));assert.deepEqual(await snapshot(state.company),state.snapshot);
   assert.deepEqual(await call(state.store,'/inventory/receiving/deliveries/'+state.id),state.expected);
   const pending=await call(state.store,'/inventory/receiving/deliveries/'+state.pending);assert.equal(pending.usable,false);assert.equal(pending.status,'HELD');assert.equal(pending.qualityRequired,true);
   await call(state.outsider,'/inventory/receiving/deliveries/'+state.id,403);await call(null,'/inventory/receiving/deliveries/'+state.id,401);
   const masked=await call(state.viewer,'/inventory/receiving/deliveries/'+state.id);assert.equal(masked.goodsReceipt,null);assert.ok(masked.evidence.every(e=>e.documentId===null));
   for(const doc of state.docs){const path='/documents/projects/'+state.project+'/targets/RECEIVING_DELIVERY/'+state.id+'/'+doc.id+'/download';const r=await fetch(base+path,{headers:{Cookie:'erp_session='+state.store}});assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.length,doc.size);assert.equal(hash(bytes),doc.checksum);await call(state.viewer,path,403);await call(state.outsider,path,403);}
   assert.deepEqual(await snapshot(state.company),state.snapshot);
   await db.userSession.updateMany({where:{userId:{in:state.users},revokedAt:null},data:{revokedAt:new Date()}});
   console.log('RECEIVING_RESTORED_HISTORY_GR_STOCK_PENDING_EVIDENCE_AUTHENTICATED_DENIALS_PASS');
  }
 }finally{await app.close();await db.$disconnect();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const [mode,manifest]=process.argv.slice(2),storage=process.env.RECEIVING_RECOVERY_STORAGE_ROOT,url=new URL(process.env.DATABASE_URL??'');
 assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');assert.equal(process.env.RECEIVING_SCHEMA_UPGRADE,'YES');
 assert.match(url.pathname,/^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);assert.match(storage??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/receiving-(?:source|restored)$/);assert.match(manifest??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/receiving-protected\.json$/);
 try{await receivingRecovery(mode,manifest,url.href,storage);}catch{console.error('RECEIVING_POPULATED_RECOVERY_FAILED');process.exitCode=1;}
}
