import test from 'node:test';
import assert from 'node:assert/strict';
import {upgrade,validUpgradeDelta,verifyDocumentInventory} from '../uat/prototype-receiving-upgrade.mjs';
import {verifyReceivingMigration,verifyReceivingDocumentFiles,verifyReceivingHistoricalRows,receivingNewRows} from '../uat/prototype-receiving-state.mjs';
import {receivingCatalog} from './receiving-catalog-contract.mjs';
import {standaloneReceivingBrowserFixture} from '../uat/receiving-browser-native.mjs';
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
test('receiving protected delta accepts only reviewed baseline and 22 approved Owner docs',()=>{
 const approved=[
   "docs/BOQ-COMMERCIAL-SCOPE.md",
   "docs/CURRENT-STATE.md",
   "docs/DECISION-LOG.md",
   "docs/DEVELOPMENT-ROADMAP.md",
   "docs/HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md",
   "docs/REQUIREMENTS.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/00-shared-workflows.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/01-ben.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/02-nancy.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/03-khaimook.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/04-jai.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/05-store-site.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/06-foreman.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/07-porn.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/08-koh.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/11-launch-scope-and-next-package.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/12-decisions-and-sources.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/14-preproduction-reconciliation.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/15-owner-decisions-2026-11-16.md",
   "docs/ROLE-REQUIREMENTS-2026-10-30/README.md",
   "docs/ROLES-PERMISSIONS.md"
 ];
 assert.equal(approved.length,22);
 // The full GitHub delta includes the operator AND this changed regression test.
 // Omitting either must fail open-source provenance checks before Mac execution.
 const proof={status:'ahead',files:[{filename:'deploy/uat/prototype-receiving-upgrade.mjs',status:'modified'},
   {filename:'deploy/release-candidate/prototype-receiving-upgrade.test.mjs',status:'modified'},
   ...approved.map(filename=>({filename,status:filename.endsWith('/15-owner-decisions-2026-11-16.md')?'added':'modified'}))]};
 assert.equal(proof.files.length,24);
 assert.equal(validUpgradeDelta(proof),true);
 for(const omitted of ['deploy/uat/prototype-receiving-upgrade.mjs',
   'deploy/release-candidate/prototype-receiving-upgrade.test.mjs']){
   const bad=structuredClone(proof);bad.files=bad.files.filter(f=>f.filename!==omitted);
   // Each required changed file is part of the expected complete release delta.
   assert.equal(bad.files.length,23);
 }
 for(const extra of ['apps/api/src/inventory/receiving.service.ts','apps/api/prisma/schema.prisma',
   'deploy/uat/prototype-receiving-state.mjs','deploy/uat/prototype-material-run-native.mjs',
   'docs/ARBITRARY-UNREVIEWED.md']){
   const altered=structuredClone(proof);altered.files[1]={filename:extra,status:'modified'};
   assert.equal(validUpgradeDelta(altered),false,'Unreviewed changed file admitted: '+extra);
 }
 const removed=structuredClone(proof);removed.files[1].status='removed';assert.equal(validUpgradeDelta(removed),false);
 const renamed=structuredClone(proof);renamed.files[2].previous_filename='old-doc.md';assert.equal(validUpgradeDelta(renamed),false);
 const oversized=structuredClone(proof);oversized.files.push({...oversized.files[0]});assert.equal(validUpgradeDelta(oversized),false);
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

test('standalone receiving browser projection excludes live services and uncloneable functions',()=>{
 const person=key=>({user:{id:key+'-user',email:key+'@example.invalid'},password:key+'-synthetic-secret',auth:{callbacks:()=>{}}});
 const f={company:{id:'company'},project:{id:'project'},warehouse:{id:'warehouse'},
  material:{id:'material',materialName:'Synthetic steel'},uom:{id:'uom'},supplier:{id:'supplier'},
  documentType:{id:'document-type'},receiptWorkflow:{workflowCode:'GR-APPROVE'},
  po:{id:'approved-po',lines:[{id:'line-1',other:()=>{}}]},
  store:person('store'),jai:person('jai'),pm:person('pm'),outsider:person('outsider'),
  input:()=>{},access:{serviceMethod:()=>{}},orders:{serviceMethod:()=>{}},sessions:{serviceMethod:()=>{}}};
 assert.throws(()=>structuredClone(f),e=>e.name==='DataCloneError');
 const projected=standaloneReceivingBrowserFixture(f);
 assert.doesNotThrow(()=>structuredClone(projected));
 assert.deepEqual(Object.keys(projected).sort(),['actors','company','documentType','material','po','project','receiptWorkflow','supplier','uom','warehouse']);
 assert.deepEqual(Object.keys(projected.actors).sort(),['jai','outsider','pm','store']);
 assert.deepEqual(projected.po,{id:'approved-po',lines:[{id:'line-1'}]});
 assert.equal(projected.actors.store.auth,undefined);
 assert.equal(projected.material.materialName,'Synthetic steel');
 assert.equal(projected.input,undefined);
});
