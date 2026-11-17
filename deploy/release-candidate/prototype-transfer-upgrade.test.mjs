import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,realpath,symlink,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {upgrade,validUpgradeDelta} from '../uat/prototype-transfer-upgrade.mjs';
import {verifyTransferMigration,TRANSFER_MIGRATIONS,verifyTransferHistoricalRows,transferNewRows} from '../uat/prototype-transfer-state.mjs';
import {transferTables} from './transfer-schema-contract.mjs';
import {transferCatalog} from './transfer-catalog-contract.mjs';

test('Mac transfer operator refuses non-Mac execution and unexpected source deltas',async()=>{
 if(process.platform!=='darwin')await assert.rejects(upgrade(),e=>e.safeCode==='TR_UPGRADE_NONROOT_MAC_REQUIRED');
 const delta={status:'ahead',files:[{filename:'deploy/uat/prototype-transfer-upgrade.mjs',status:'added'},
  {filename:'deploy/uat/prototype-transfer-state.mjs',status:'added'},
  {filename:'deploy/uat/transfer-browser.mjs',status:'modified'},
  {filename:'docs/OP-SUBCONTRACT-PHYSICAL-01-ENTRY.md',status:'added'}]};
 assert.equal(validUpgradeDelta(delta),true);
 for(const change of [d=>d.status='behind',d=>d.files=[],d=>d.files[0].status='removed',d=>d.files[0].previous_filename='renamed',
  d=>d.files.push(d.files[0]),d=>d.files.push({filename:'apps/api/prisma/schema.prisma',status:'modified'}),
  d=>d.files.push({filename:'apps/api/src/subcontracts/subcontracts-claims.service.ts',status:'modified'}),
  d=>d.files.push({filename:'deploy/uat/prototype-receiving-upgrade.mjs',status:'modified'}),
  d=>d.files.push({filename:'docs/UNREVIEWED.md',status:'added'})]){
  const altered=structuredClone(delta);change(altered);assert.equal(validUpgradeDelta(altered),false);
 }
});
test('transfer CLI dispatches through canonical and Mac-style alias paths without executing upgrade',async t=>{
 const operator=await realpath(fileURLToPath(new URL('../uat/prototype-transfer-upgrade.mjs',import.meta.url)));
 const temporary=await mkdtemp(join(tmpdir(),'transfer-cli-'));t.after(()=>rm(temporary,{recursive:true,force:true}));
 const alias=join(temporary,'alias');await symlink(dirname(operator),alias,'dir');
 for(const [flags,path]of [[[],operator],[[],join(alias,'prototype-transfer-upgrade.mjs')],[['--preserve-symlinks-main'],join(alias,'prototype-transfer-upgrade.mjs')]]){
  const result=spawnSync(process.execPath,[...flags,path,'--entrypoint-probe','a'.repeat(40)],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,HOME:process.env.HOME}});
  assert.equal(result.error,undefined);assert.equal(result.signal,null);assert.equal(result.status,1);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.status,'TRANSFER_UPGRADE_BLOCKED');
  assert.equal(receipt.code,'TR_UPGRADE_EXECUTE_AND_PINNED_OPERATOR_SHA_REQUIRED');assert.equal(receipt.secretsPrinted,false);
 }
 const imported=spawnSync(process.execPath,['--input-type=module','-e','await import('+JSON.stringify(new URL('../uat/prototype-transfer-upgrade.mjs',import.meta.url).href)+')'],{encoding:'utf8',timeout:10000});
 assert.equal(imported.status,0);assert.equal(imported.stdout,'');assert.equal(imported.stderr,'');
});
test('transfer additive upgrade admits exactly five migrations and NULL historical stock provenance',()=>{
 const before={permissions:[],_prisma_migrations:[{id:'old-migration',migration_name:'receiving',checksum:'retained'}],
  stock_transactions:[{id:'old-stock',quantity:3,__fm03_exact_row_json:'{"id":"old-stock","quantity":3}'}],
  receiving_deliveries:[{id:'delivery',checked_by_user_id:'jai'}],goods_receipts:[{id:'gr',delivery_id:'delivery'}],
  role_permissions:[{id:'retained-grant'}]};
 const after={...structuredClone(before),permissions:transferCatalog.map(p=>({...p,created_at:'2026-11-17T00:00:00Z'})),
  stock_transactions:[{...before.stock_transactions[0],transfer_receipt_line_id:null,__fm03_exact_row_json:'{"id":"old-stock","quantity":3,"transfer_receipt_line_id":null}'}],
  _prisma_migrations:[...before._prisma_migrations,...TRANSFER_MIGRATIONS.map((name,i)=>({id:'new-'+i,migration_name:name,finished_at:'2026-11-17T00:00:00Z',rolled_back_at:null}))],
  ...Object.fromEntries(transferTables.map(t=>[t,[]]))};
 verifyTransferMigration(before,after);
 const exactBefore=structuredClone(before),exactAfter=structuredClone(after);
 exactBefore.stock_transactions[0].quantity=99999999999999.9998;
 exactAfter.stock_transactions[0].quantity=99999999999999.9999;
 assert.equal(exactBefore.stock_transactions[0].quantity,exactAfter.stock_transactions[0].quantity,'JS rounds these distinct PostgreSQL Decimals equally');
 exactBefore.stock_transactions[0].__fm03_exact_row_json='{"id":"old-stock","quantity":99999999999999.9998}';
 exactAfter.stock_transactions[0].__fm03_exact_row_json='{"id":"old-stock","quantity":99999999999999.9999,"transfer_receipt_line_id":null}';
 assert.throws(()=>verifyTransferMigration(exactBefore,exactAfter),'Exact PostgreSQL bytes must expose the otherwise rounded change');

 for(const change of [a=>a.stock_transactions[0].quantity=30,a=>a.stock_transactions[0].transfer_receipt_line_id='invented',
  a=>a.stock_transactions[0].__fm03_exact_row_json='{"id":"old-stock","quantity":3.0001,"transfer_receipt_line_id":null}',
  a=>a.receiving_deliveries[0].checked_by_user_id='other',a=>a.role_permissions=[],a=>a.permissions.pop(),
  a=>a._prisma_migrations.pop(),a=>a._prisma_migrations[0].checksum='rewritten',
  a=>a.transfer_custodies.push({transfer_id:'backfilled'}),a=>delete a.transfer_operations]){
  const altered=structuredClone(after);change(altered);assert.throws(()=>verifyTransferMigration(before,altered));
 }
});
test('populated transfer preservation uses real non-id history keys and catches removals or mutations',()=>{
 const before={transfer_project_policies:[{project_id:'site',reason:'retained'}],transfer_custodies:[{transfer_id:'transfer',version:2}],
  receiving_project_policies:[{project_id:'receiving',synthetic_only:true}],
  material_plan_issue_bindings:[{issue_id:'issue-a',authorization_id:'auth-a'},{issue_id:'issue-b',authorization_id:'auth-b'}]};
 const after=structuredClone(before);after.material_plan_issue_bindings.reverse();
 verifyTransferHistoricalRows(before,after);
 after.transfer_custodies.push({transfer_id:'new',version:1});
 assert.deepEqual(transferNewRows('transfer_custodies',before.transfer_custodies,after.transfer_custodies),[{transfer_id:'new',version:1}]);
 for(const change of [a=>a.transfer_custodies[0].version=3,a=>a.transfer_project_policies=[],
  a=>a.material_plan_issue_bindings[0].authorization_id='changed',a=>a.unapproved_table=[]]){
  const altered=structuredClone(after);change(altered);assert.throws(()=>verifyTransferHistoricalRows(before,altered));
 }
});

test('populated operator migration identity matches all actual reviewed additive SQL directories',async()=>{
 const names=(await readdir(new URL('../../apps/api/prisma/migrations/',import.meta.url))).filter(n=>n.startsWith('20261117'));
 assert.deepEqual(names.sort(),[...TRANSFER_MIGRATIONS].sort());
});
