// DEC-043 populated signed-receipt proof, restricted to named disposable CI databases/storage.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const [mode,manifestPath]=process.argv.slice(2);
let url;try{url=new URL(process.env.DATABASE_URL??'');}catch{throw Error('Invalid disposable material-request target');}
const storage=process.env.MATERIAL_REQUEST_RECOVERY_STORAGE_ROOT;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.RC_NON_PRODUCTION_CONFIRMED!=='YES'||process.env.MATERIAL_REQUEST_SCHEMA_UPGRADE!=='YES'||
 !['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/construction_erp_v10e_(upgrade|hrrestore)_[a-f0-9]{12}$/.test(url.pathname)||
 !/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/mr-receipt-(source|restored)$/.test(storage??'')||
 !['protect','restored'].includes(mode)||!manifestPath)throw Error('Material request proof requires exact isolated CI context');
process.env.STORAGE_ROOT=storage;
const require=createRequire(resolve('apps/api/package.json'));
const {PrismaService}=require('./dist/prisma/prisma.service.js');
const db=new PrismaService();await db.$connect();
const hash=b=>createHash('sha256').update(b).digest('hex');
const tables=['material_requests','material_request_lines','material_request_revisions','material_request_issue_links','material_request_receipts','material_request_operations'];
async function snapshot(id){const result={};for(const table of tables){const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY id),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${table==='material_requests'?'id':'request_id'}=$1::uuid`,id);result[table]=row;}return result;}
try{
 if(mode==='protect'){
  const {materialRequestFixture}=require('./dist/inventory/material-request-test-fixture.js');
  const f=await materialRequestFixture(db);
  const created=await f.service.create({auth:f.store.auth},f.input());
  let d=await f.service.get(f.store.auth,created.id);const issue=await f.issue('6');
  await f.service.link({auth:f.store.auth},created.id,{requestKey:randomUUID(),expectedVersion:d.version,requestLineId:d.lines[0].id,materialIssueItemId:issue.items[0].id,reason:'Synthetic recovery linked issue'});
  d=await f.service.get(f.store.auth,created.id);const doc=await f.upload(created.id);
  await f.service.acknowledge({auth:f.store.auth},created.id,{requestKey:randomUUID(),expectedVersion:d.version,issueLinkId:d.lines[0].issueLinks[0].id,recipientEmployeeId:f.foreman.employee.id,issuerEmployeeId:f.store.employee.id,receivedAt:new Date(Date.now()-60000).toISOString(),documentId:doc.id,signedEvidenceConfirmed:true,supersedesReceiptId:null,reason:'Synthetic populated signed receipt recovery'});
  d=await f.service.get(f.store.auth,created.id);
  assert.equal(d.lines[0].issuedQuantity,'6.0000');assert.equal(d.lines[0].acknowledgedQuantity,'6.0000');
  const state={requestId:created.id,projectId:f.project.id,documentId:doc.id,sessionToken:f.store.session.sessionToken,
   outsiderToken:f.outsider.session.sessionToken,expected:JSON.parse(JSON.stringify(d)),tables:await snapshot(created.id),checksum:hash(f.bytes),size:f.bytes.length};
  writeFileSync(manifestPath,JSON.stringify(state),{mode:0o600});
  console.log('MATERIAL_REQUEST_POPULATED_SIGNED_RECEIPT_PROTECTED');
 }else{
  const state=JSON.parse(readFileSync(manifestPath,'utf8'));assert.deepEqual(await snapshot(state.requestId),state.tables);
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js');
  const {ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js');
  const {securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0,'127.0.0.1');
  try{
   const root=await app.getUrl()+'/api/v1',headers={Cookie:'erp_session='+state.sessionToken};
   const response=await fetch(root+'/inventory/material-requests/'+state.requestId,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
   assert.deepEqual((await response.json()).data,state.expected);
   const downloaded=await fetch(root+'/documents/projects/'+state.projectId+'/targets/MATERIAL_REQUEST/'+state.requestId+'/'+state.documentId+'/download',{headers});
   assert.equal(downloaded.status,200);const bytes=Buffer.from(await downloaded.arrayBuffer());assert.equal(bytes.length,state.size);assert.equal(hash(bytes),state.checksum);
   assert.equal((await fetch(root+'/inventory/material-requests/'+state.requestId,{headers:{Cookie:'erp_session='+state.outsiderToken}})).status,403);
   assert.equal((await fetch(root+'/inventory/material-requests/'+state.requestId)).status,401);
   assert.deepEqual(await snapshot(state.requestId),state.tables);
  }finally{await app.close();}
  console.log('MATERIAL_REQUEST_RESTORED_HTTP_HISTORY_SIGNED_BYTES_AND_SCOPE_PASS');
 }
}finally{await db.$disconnect();}
