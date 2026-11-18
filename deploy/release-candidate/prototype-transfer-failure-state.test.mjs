import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyFailedTransferState} from '../uat/prototype-transfer-failure-state.mjs';
import {TRANSFER_GRANTS,TRANSFER_MIGRATIONS} from '../uat/prototype-transfer-state.mjs';
import {transferTables} from './transfer-schema-contract.mjs';
import {transferCatalog} from './transfer-catalog-contract.mjs';
import {inspectFailedTransfer,readbackSql} from '../uat/prototype-transfer-failure-readback.mjs';
import {continuationBaseline,prepareTransferContinuationSource} from '../uat/prototype-transfer-continuation-core.mjs';
import {verifyTransferMigration,digest} from '../uat/prototype-transfer-state.mjs';
function fixture(){
 const b={fixture:{companyId:'company',projectId:'origin',unassignedProjectId:'destination',adminUserId:'admin'},
  actors:Object.fromEntries(['STORE_SITE','KHAIMOOK','PORN'].map(k=>[k,{userId:k,roleId:k+'-role',employeeId:k+'-employee'}]))};
 const allCodes=[...new Set(Object.values(TRANSFER_GRANTS).flat())],existing=allCodes.filter(code=>!transferCatalog.some(p=>p.permission_code===code));
 const before={permissions:existing.map((permission_code,i)=>({id:'permission-'+i,permission_code})),_prisma_migrations:[{id:'old',checksum:'preserved'}],
  users:['STORE_SITE','KHAIMOOK','PORN'].map(id=>({id,email:id+'@example.invalid',last_login_at:'prior',updated_at:'prior',__fm03_exact_row_json:id})),
  role_permissions:[],warehouses:[],project_members:[],approval_workflows:[],approval_steps:[],approval_step_roles:[],number_sequences:[],
  audit_logs:[],user_sessions:[],stock_transfers:[],stock_transfer_items:[],payments:[],
  stock_transactions:[{id:'old-stock',quantity:20,__fm03_exact_row_json:'{"id":"old-stock","quantity":20}'}]};
 const current=structuredClone(before);
 current.permissions.push(...transferCatalog.map(p=>({...p,created_at:'2026-11-17T00:00:00Z'})));
 current._prisma_migrations.push(...TRANSFER_MIGRATIONS.map((migration_name,i)=>({id:'new-'+i,migration_name,finished_at:'2026-11-17T00:00:00Z',rolled_back_at:null})));
 current.stock_transactions[0]={...before.stock_transactions[0],transfer_receipt_line_id:null,__fm03_exact_row_json:'{"id":"old-stock","quantity":20,"transfer_receipt_line_id":null}'};
 for(const t of transferTables)current[t]=[];
 const c={status:'TRANSFER_SYNTHETIC_CONFIGURATION_APPLIED',productionAuthorized:false,addedRolePermissionIds:[],
  warehouse:{id:'warehouse',companyId:'company',projectId:'destination',warehouseCode:'PROTO_TRANSFER_DEST',isActive:true},
  member:{id:'member',projectId:'destination',employeeId:'PORN-employee',isActive:true},
  workflow:{id:'workflow',companyId:'company',entityType:'STOCK_TRANSFER',workflowCode:'PROTO_TRANSFER_APPROVAL',isActive:true},
  sequence:{id:'sequence',companyId:'company',entityType:'STOCK_TRANSFER',sequenceCode:'STOCK_TRANSFER',formatTemplate:'STYYMM-###',resetRule:'MONTHLY',nextValue:1,lastPeriodKey:null}};
 for(const [key,codes]of Object.entries(TRANSFER_GRANTS))for(const code of codes){const id='grant-'+current.role_permissions.length;
  c.addedRolePermissionIds.push(id);current.role_permissions.push({id,role_id:b.actors[key].roleId,permission_id:current.permissions.find(p=>p.permission_code===code).id});}
 const sql=record=>Object.fromEntries(Object.entries(record).map(([k,v])=>[k.replace(/[A-Z]/g,s=>'_'+s.toLowerCase()),v]));
 current.warehouses.push(sql(c.warehouse));current.project_members.push(sql(c.member));current.approval_workflows.push(sql(c.workflow));
 current.approval_steps.push({id:'step',approval_workflow_id:'workflow',step_no:1,step_name:'Independent Khaimook decision',required_approvals:1});
 current.approval_step_roles.push({id:'step-role',approval_step_id:'step',role_id:'KHAIMOOK-role'});
 current.number_sequences.push({...sql(c.sequence),next_value:2,last_period_key:'202611'});
 const reason='Explicit synthetic dispatch/actual-receipt policy',outcome={projectId:'origin',enabled:true};
 current.transfer_project_policies.push({project_id:'origin',company_id:'company',enabled_by_user_id:'KHAIMOOK',synthetic_only:true,reason});
 current.transfer_operations.push({id:'enable',action:'ENABLE',company_id:'company',actor_user_id:'KHAIMOOK',project_id:'origin',transfer_id:null,
  created_at:'2026-11-17T15:00:00Z',outcome,body_digest:createHash('sha256').update(JSON.stringify(['ENABLE','origin',reason])).digest('hex')});
 current.audit_logs.push({id:'config-audit',entity_type:'PROTOTYPE_TRANSFER_CONFIGURATION',entity_id:'origin',company_id:'company',actor_user_id:'admin',action:'CONFIGURE',
  new_values:{syntheticOnly:true,grantMatrix:TRANSFER_GRANTS,destinationProjectId:'destination',receiverEmployeeId:'PORN-employee'}},
 {id:'enable-audit',entity_type:'STOCK_TRANSFER',entity_id:'origin',company_id:'company',actor_user_id:'KHAIMOOK',action:'CUSTODY_ENABLE',new_values:outcome});
 current.user_sessions.push(...['STORE_SITE','KHAIMOOK'].map(user_id=>({id:user_id+'-session',user_id,revoked_at:'2026-11-17T15:00:01Z'})));
 current.users[0].last_login_at='2026-11-17T15:00:00Z';
 return {b,c,before,current};
}
test('failed transfer readback admits only exact committed configuration/enable, one consumed number and two revoked sessions',()=>{
 const {before,current,c,b}=fixture(),original=structuredClone({before,current,c,b});
 const receipt=verifyFailedTransferState(before,current,c,b);
 assert.equal(receipt.status,'TRANSFER_FAILED_SOURCE_STATE_VERIFIED');assert.equal(receipt.continuationAuthorized,false);
 assert.equal(receipt.failedNumberConsumed,true);assert.deepEqual({before,current,c,b},original,'Inspection cannot mutate its input');
});
test('readback refuses unexpected partial success, live sessions, reset numbering, altered grants or historical bytes',()=>{
 for(const mutate of [
  f=>f.current.stock_transfers.push({id:'unexpected-transfer'}),f=>f.current.stock_transfer_items.push({id:'unexpected-item'}),
  f=>f.current.transfer_custodies.push({transfer_id:'unexpected-custody'}),f=>f.current.payments.push({id:'unexpected-payment'}),
  f=>f.current.user_sessions[0].revoked_at=null,f=>f.current.user_sessions.push({id:'extra',user_id:'STORE_SITE',revoked_at:'now'}),
  f=>f.current.number_sequences[0].next_value=1,f=>f.current.number_sequences[0].last_period_key='202612',
  f=>f.current.role_permissions[0].role_id='NANCY-role',f=>f.current.approval_step_roles[0].role_id='STORE_SITE-role',
  f=>f.current.transfer_operations[0].body_digest='changed',f=>f.current.transfer_project_policies[0].enabled_by_user_id='STORE_SITE',
  f=>f.current.warehouses[0].project_id='foreign',f=>f.current.users[0].email='changed@example.invalid',
  f=>f.current.stock_transactions[0].__fm03_exact_row_json='{"id":"old-stock","quantity":19,"transfer_receipt_line_id":null}',
  f=>f.current._prisma_migrations[0].checksum='changed',f=>f.current.audit_logs[0].new_values.syntheticOnly=false,
 ]){const f=fixture();mutate(f);assert.throws(()=>verifyFailedTransferState(f.before,f.current,f.c,f.b));}
});
test('readback uses an explicit read-only transaction and rejects injected, duplicated or empty table names',async()=>{
 const sql=readbackSql(['users','stock_transactions']);
 assert.match(sql,/^BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;/);
 assert.match(sql,/current_setting\('transaction_read_only'\)/);assert.match(sql,/pg_stat_activity/);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|CALL|DO)\b/);
 for(const tables of [[],['users','users'],['users; DROP TABLE users'],['"users"'],['public.users'],['users--'],Array.from({length:201},(_,i)=>'a'.repeat(i+1))])assert.throws(()=>readbackSql(tables));
 if(process.platform!=='darwin')await assert.rejects(inspectFailedTransfer('a'.repeat(40)),e=>e.safeCode==='TR_READBACK_NONROOT_MAC_REQUIRED');
});
test('continuation reconstructs the proven pre-configuration baseline without rewriting a consumed number or prior rows',()=>{
 const f=fixture(),original=structuredClone(f),baseline=continuationBaseline(f.before,f.current,f.c,f.b);
 verifyTransferMigration(f.before,baseline);
 assert.deepEqual(baseline.users,f.before.users);assert.deepEqual(baseline.role_permissions,f.before.role_permissions);
 assert.deepEqual(baseline.transfer_project_policies,[]);assert.deepEqual(baseline.transfer_operations,[]);
 assert.equal(f.current.number_sequences[0].next_value,2);assert.deepEqual(f,original);
 const changed=structuredClone(f);changed.current.payments.push({id:'unrelated'});
 assert.throws(()=>continuationBaseline(changed.before,changed.current,changed.c,changed.b));
});
test('continuation refuses stale snapshots and arbitrary origins before any authentication or write',async()=>{
 const f=fixture();let writes=0;
 const db={$transaction:async work=>work({$queryRawUnsafe:async sql=>{
  if(sql.startsWith('SELECT tablename'))return Object.keys(f.current).sort().map(tablename=>({tablename}));
  const table=sql.match(/FROM "([a-z_]+)"/)?.[1];return f.current[table].map(({__fm03_exact_row_json,...row})=>({bytes:JSON.stringify(row)}));
 }}),stockTransaction:{findMany:()=>{writes++;throw Error('Must not reach source actions');}}};
 const old=process.env.GITHUB_ACTIONS;process.env.GITHUB_ACTIONS='true';
 try{
  await assert.rejects(prepareTransferContinuationSource(db,f.b,f.c,{before:f.before,stateSha256:'0'.repeat(64)},
   {api:'http://127.0.0.1:31319/api/v1',web:'http://127.0.0.1:44319'}),e=>e.safeCode==='TR_CONTINUATION_FAILED_STATE_DRIFT');
  await assert.rejects(prepareTransferContinuationSource(db,f.b,f.c,{before:f.before,stateSha256:digest(f.current)},
   {api:'https://example.invalid/api/v1',web:'https://example.invalid'}),e=>e.safeCode==='TR_CONTINUATION_ORIGINS_REFUSED');
  assert.equal(writes,0);
 }finally{if(old===undefined)delete process.env.GITHUB_ACTIONS;else process.env.GITHUB_ACTIONS=old;}
});
