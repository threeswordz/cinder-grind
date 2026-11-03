// DEC-044 B populated proof. Never runs against retained Company/Project or host storage.
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
const [mode,manifestPath]=process.argv.slice(2);
let url;try{url=new URL(process.env.DATABASE_URL??'');}catch{throw Error('Invalid material plan issue proof target');}
const storage=process.env.MATERIAL_PLAN_ISSUE_RECOVERY_STORAGE_ROOT;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.RC_NON_PRODUCTION_CONFIRMED!=='YES'||process.env.MATERIAL_PLAN_ISSUE_SCHEMA_UPGRADE!=='YES'||
 !['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!/^\/construction_erp_v10e_(upgrade|hrrestore)_[a-f0-9]{12}$/.test(url.pathname)||
 !/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/mpi-(source|restored)$/.test(storage??'')||
 !['protect','restored'].includes(mode)||!/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/mpi-protected\.json$/.test(manifestPath??''))throw Error('Material plan issue proof requires exact isolated CI context');
process.env.STORAGE_ROOT=storage;process.env.NODE_ENV='test';
const require=createRequire(resolve('apps/api/package.json'));
const {PrismaService}=require('./dist/prisma/prisma.service.js');const db=new PrismaService();await db.$connect();
const hash=b=>createHash('sha256').update(b).digest('hex');
const companyTables=['material_plan_project_policies','material_plan_issue_operations','material_usage_plans','material_usage_plan_operations','material_issues','stock_transactions','approval_instances','audit_logs','material_requests','material_request_operations'];
async function snapshot(company){
 const result={};const conditions=Object.fromEntries(companyTables.map(t=>[t,'t.company_id=$1::uuid']));
 conditions.material_plan_issue_bindings='t.policy_id IN (SELECT id FROM material_plan_project_policies WHERE company_id=$1::uuid)';
 conditions.material_plan_issue_authorizations='t.issue_id IN (SELECT id FROM material_issues WHERE company_id=$1::uuid)';
 conditions.material_plan_issue_allocations='t.authorization_id IN (SELECT a.id FROM material_plan_issue_authorizations a JOIN material_issues h ON h.id=a.issue_id WHERE h.company_id=$1::uuid)';
 conditions.material_issue_items='t.material_issue_id IN (SELECT id FROM material_issues WHERE company_id=$1::uuid)';
 conditions.material_usage_plan_revisions='t.plan_id IN (SELECT id FROM material_usage_plans WHERE company_id=$1::uuid)';
 conditions.material_usage_plan_lines='t.revision_id IN (SELECT r.id FROM material_usage_plan_revisions r JOIN material_usage_plans p ON p.id=r.plan_id WHERE p.company_id=$1::uuid)';
 conditions.approval_actions='t.approval_instance_id IN (SELECT id FROM approval_instances WHERE company_id=$1::uuid)';
 for(const table of ['material_request_lines','material_request_revisions','material_request_issue_links','material_request_receipts'])conditions[table]='t.request_id IN (SELECT id FROM material_requests WHERE company_id=$1::uuid)';
 for(const [table,where] of Object.entries(conditions)){
  const [row]=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest FROM "${table}" t WHERE ${where}`,company);result[table]=row;
 }return result;
}
try{
 if(mode==='protect'){
  const {materialPlanIssueFixture}=require('./dist/inventory/material-plan-issue-test-fixture.js');const f=await materialPlanIssueFixture(db);
  await f.controls.enable({auth:f.ben.auth},f.project.id,f.enableInput());
  const direct=await f.issue('3',false);await f.controls.withinPlan({auth:f.store.auth},direct.id,await f.pin(direct.id));
  const excess=await f.issue('5',false),pending=await f.controls.submitOverage({auth:f.store.auth},excess.id,await f.pin(excess.id));
  const decision=()=>({requestKey:randomUUID(),decision:'APPROVE',comment:'Independent synthetic paired recovery proof'});
  await f.controls.decide({auth:f.manager.auth},pending.authorizationId,decision(),'REVIEW');
  await f.controls.decide({auth:f.ben.auth},pending.authorizationId,decision(),'DECIDE');
  const history=JSON.parse(JSON.stringify(await f.controls.history(f.store.auth,excess.id)));
  assert.equal(history.items[0].lines[0].overageQuantity,'2.0000');assert.equal(history.items[0].approval.actions.length,2);
  const {MaterialRequestService}=require('./dist/inventory/material-request.service.js'),{ProjectAccessService}=require('./dist/projects/project-access.service.js'),{ProjectScopeService}=require('./dist/authorization/project-scope.service.js'),{AuthorizationService}=require('./dist/authorization/authorization.service.js'),{AuditService}=require('./dist/audit/audit.service.js');
  const requests=new MaterialRequestService(db,new ProjectAccessService(db,new ProjectScopeService(new AuthorizationService())),new AuditService(db),f.documents);
  const request=await requests.create({auth:f.store.auth},{requestKey:randomUUID(),projectId:f.project.id,warehouseId:f.warehouse.id,requesterEmployeeId:f.foreman.employee.id,requestDate:'2026-11-02',remarks:'Synthetic B2 canonical request link',lines:[{materialId:f.material.id,uomId:f.uom.id,requestedQuantity:'3.0000',wbsId:null,costCodeId:null,activityId:null,remarks:null}]});
  let detail=await requests.get(f.store.auth,request.id);
  await requests.link({auth:f.store.auth},request.id,{requestKey:randomUUID(),expectedVersion:detail.version,requestLineId:detail.lines[0].id,materialIssueItemId:direct.items[0].id,reason:'B2 canonical posted issue provenance'});
  detail=await requests.get(f.store.auth,request.id);const doc=await f.upload(request.id);
  await requests.acknowledge({auth:f.store.auth},request.id,{requestKey:randomUUID(),expectedVersion:detail.version,issueLinkId:detail.lines[0].issueLinks[0].id,recipientEmployeeId:f.foreman.employee.id,issuerEmployeeId:f.store.employee.id,receivedAt:new Date(Date.now()-60000).toISOString(),documentId:doc.id,signedEvidenceConfirmed:true,supersedesReceiptId:null,reason:'Synthetic B2 signed receipt recovery'});
  const state={companyId:f.company.id,projectId:f.project.id,issueId:excess.id,requestId:request.id,documentId:doc.id,sessionToken:f.store.session.sessionToken,outsiderToken:f.outsider.session.sessionToken,
   history,policy:JSON.parse(JSON.stringify(await f.controls.policy(f.store.auth,f.project.id))),request:JSON.parse(JSON.stringify(await requests.get(f.store.auth,request.id))),tables:await snapshot(f.company.id),checksum:hash(f.bytes),size:f.bytes.length};
  writeFileSync(manifestPath,JSON.stringify(state),{mode:0o600});console.log('MATERIAL_PLAN_ISSUE_POPULATED_APPROVAL_AND_SIGNED_RECEIPT_PROTECTED');
 }else{
  const state=JSON.parse(readFileSync(manifestPath,'utf8'));assert.deepEqual(await snapshot(state.companyId),state.tables);
  const {NestFactory}=require('@nestjs/core'),{AppModule}=require('./dist/app.module.js'),{ProblemDetailsFilter}=require('./dist/common/problem-details.filter.js'),{securityHeadersMiddleware}=require('./dist/common/security-headers.js');
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
  try{
   const root=await app.getUrl()+'/api/v1',headers={Cookie:'erp_session='+state.sessionToken};
   for(const [path,expected] of [['/inventory/material-plan-issues/issues/'+state.issueId,state.history],['/inventory/material-plan-issues/projects/'+state.projectId+'/policy',state.policy],['/inventory/material-requests/'+state.requestId,state.request]]){
    const response=await fetch(root+path,{headers});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual((await response.json()).data,expected);
    assert.equal((await fetch(root+path,{headers:{Cookie:'erp_session='+state.outsiderToken}})).status,403);assert.equal((await fetch(root+path)).status,401);
   }
   const response=await fetch(root+'/documents/projects/'+state.projectId+'/targets/MATERIAL_REQUEST/'+state.requestId+'/'+state.documentId+'/download',{headers});assert.equal(response.status,200);
   const bytes=Buffer.from(await response.arrayBuffer());assert.equal(bytes.length,state.size);assert.equal(hash(bytes),state.checksum);
   // Protected business/approval/stock/operation history remains exact after authenticated reads.
   const after=await snapshot(state.companyId);delete after.audit_logs;const before={...state.tables};delete before.audit_logs;assert.deepEqual(after,before);
  }finally{await app.close();}
  console.log('MATERIAL_PLAN_ISSUE_RESTORED_HISTORY_APPROVAL_SIGNED_BYTES_AND_SCOPE_PASS');
 }
}finally{await db.$disconnect();}
