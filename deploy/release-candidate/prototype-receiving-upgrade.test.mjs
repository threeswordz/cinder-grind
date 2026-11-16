import test from 'node:test';
import assert from 'node:assert/strict';
import {upgrade,validUpgradeDelta,verifyDocumentInventory} from '../uat/prototype-receiving-upgrade.mjs';
import {verifyReceivingMigration,verifyReceivingDocumentFiles} from '../uat/prototype-receiving-state.mjs';
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
