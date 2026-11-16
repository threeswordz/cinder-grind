import test from 'node:test';
import assert from 'node:assert/strict';
import {upgrade,validUpgradeDelta,verifyDocumentInventory} from '../uat/prototype-receiving-upgrade.mjs';
import {verifyReceivingMigration,verifyReceivingDocumentFiles,verifyReceivingHistoricalRows,receivingNewRows} from '../uat/prototype-receiving-state.mjs';
import {receivingCatalog} from './receiving-catalog-contract.mjs';
import {receivingTables} from './receiving-schema-contract.mjs';
test('receiving coordinator refuses non-Mac execution and application/schema/renamed delta',async()=>{
 if(process.platform!=='darwin')await assert.rejects(upgrade(),e=>e.safeCode==='RC_UPGRADE_NONROOT_MAC_REQUIRED');
 const delta={status:'ahead',files:[{filename:'deploy/uat/prototype-receiving-upgrade.mjs',status:'added'}]};
 assert.equal(validUpgradeDelta(delta),true);
 for(const change of [d=>d.files.push({filename:'apps/api/src/inventory/receiving.service.ts',status:'modified'}),
  d=>d.files.push({filename:'apps/api/prisma/schema.prisma',status:'modified'}),d=>d.files[0].previous_filename='old.mjs',
  d=>d.files[0].status='removed',d=>d.status='behind',d=>d.files=[]]){
  const bad=structuredClone(delta);change(bad);assert.equal(validUpgradeDelta(bad),false);
 }
});
test('receiving migration preserves populated FM03 and grants, admits only NULL legacy GR provenance',()=>{
 const before={permissions:[],_prisma_migrations:[{id:'old',migration_name:'previous',checksum:'retained'}],
  goods_receipts:[{id:'retained-gr',posted_at:null,__fm03_exact_row_json:'old-shape'}],
  site_issues:[{id:'completed-issue',status:'CLOSED',version:6}],stock_transactions:[{id:'retained-stock',quantity:20}],
  role_permissions:[{id:'old-grant',permission_id:'retained'}]};
 const after={...structuredClone(before),permissions:receivingCatalog.map(p=>({...p,created_at:'2026-11-16T00:00:00Z'})),
  _prisma_migrations:[...before._prisma_migrations,{id:'new',migration_name:'20261115130000_receiving_custody',finished_at:'2026-11-16T00:00:00Z',rolled_back_at:null}],
  goods_receipts:[{...before.goods_receipts[0],delivery_id:null,__fm03_exact_row_json:'new-shape'}],
  ...Object.fromEntries(receivingTables.map(t=>[t,[]]))};
 verifyReceivingMigration(before,after);
 for(const change of [d=>d.site_issues[0].status='OPEN',d=>d.role_permissions=[],d=>d.goods_receipts[0].delivery_id='invented',
  d=>d.stock_transactions[0].quantity=0,d=>d.receiving_deliveries.push({id:'backfill'}),d=>d.permissions.pop(),
  d=>d._prisma_migrations[0].checksum='rewritten']){
  const bad=structuredClone(after);change(bad);assert.throws(()=>verifyReceivingMigration(before,bad));
 }
});
test('new receiving files cannot change signed/encrypted history or introduce unrelated bytes',()=>{
 const old=[['','directory'],['retained-signed',4,'a'.repeat(64)],['retained-encrypted',8,'b'.repeat(64)]],
  key='df73e6aa-76d3-4c14-81bd-dae91754d627',doc={storage_provider:'LOCAL',storage_key:key,file_size_bytes:6,checksum:'c'.repeat(64)},
  after=[...old,[key,6,doc.checksum]];
 verifyReceivingDocumentFiles(old,after,[doc]);verifyDocumentInventory([doc],after);
 for(const change of [a=>a[1]=['retained-signed',4,'d'.repeat(64)],a=>a.pop(),a=>a.push(['unrelated',1,'e'.repeat(64)]),
  a=>a[a.length-1][1]=7,a=>a[a.length-1][2]='f'.repeat(64)]){
  const bad=structuredClone(after);change(bad);assert.throws(()=>verifyReceivingDocumentFiles(old,bad,[doc]));
 }
});

test('receiving preservation uses exact historical primary keys instead of undefined id matches',()=>{
 const before={material_plan_issue_bindings:[
  {issue_id:'one',policy_id:'policy-1',authorization_id:'auth-1'},
  {issue_id:'two',policy_id:'policy-2',authorization_id:'auth-2'}],
  login_rate_limit_buckets:[{client_key:'client-a',attempt_count:1},{client_key:'client-b',attempt_count:2}],
  site_issue_routings:[{project_id:'project-a',owner_user_id:'owner-a'}],
  users:[{id:'user-a',company_id:'company-a'}]};
 const after=structuredClone(before);
 after.material_plan_issue_bindings.reverse();after.login_rate_limit_buckets.reverse();
 verifyReceivingHistoricalRows(before,after);
 assert.deepEqual(receivingNewRows('material_plan_issue_bindings',before.material_plan_issue_bindings,after.material_plan_issue_bindings),[]);
 after.material_plan_issue_bindings.push({issue_id:'three',policy_id:'policy-3',authorization_id:'auth-3'});
 assert.equal(receivingNewRows('material_plan_issue_bindings',before.material_plan_issue_bindings,after.material_plan_issue_bindings).length,1);
 const tampered=structuredClone(after);tampered.material_plan_issue_bindings[0].authorization_id='tampered';
 assert.throws(()=>verifyReceivingHistoricalRows(before,tampered),/Receiving changed historical material_plan_issue_bindings/);
 const removed=structuredClone(after);removed.material_plan_issue_bindings=removed.material_plan_issue_bindings.filter(row=>row.issue_id!=='one');
 assert.throws(()=>verifyReceivingHistoricalRows(before,removed),/Receiving changed historical material_plan_issue_bindings/);
});
