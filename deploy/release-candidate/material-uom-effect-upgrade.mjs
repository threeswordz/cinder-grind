// DEC-050 B: disposable copied-DB provenance boundary, not live activation/UAT.
// This witness runs only in the immutable CI rehearsal sandbox. It preserves
// original stock/approvals/grants, detects invalid direct ledger-pin bypass, and
// verifies that the separately restored DB has identical source bytes.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

const [mode, manifest] = process.argv.slice(2);
const url = new URL(process.env.DATABASE_URL ?? '');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.RC_NON_PRODUCTION_CONFIRMED,'YES');
assert.equal(process.env.MATERIAL_UOM_EFFECT_SCHEMA_UPGRADE,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(url.pathname,/^\/construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12}$/);
assert.ok(['pristine','protect','restored'].includes(mode));
assert.match(manifest??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/material-uom-effect-(?:pristine|protected)\.json$/);
assert.equal(manifest.endsWith('-pristine.json'),mode==='pristine');

const require=createRequire(resolve('apps/api/package.json'));
require('reflect-metadata');
const {PrismaService}=require('./dist/prisma/prisma.service.js');
const db=new PrismaService();
const tables=['stock_transactions','material_reservations','goods_receipt_items','material_issue_items',
  'material_uom_bases','material_uom_revisions','material_uom_effect_pins','material_uom_receipt_source_pins','material_uom_reservation_pins','material_uom_issue_source_pins','material_uom_transfer_source_pins','material_uom_activations','role_permissions','user_roles'];
async function rows() {
 const out={};
 for(const name of tables){
  // Fixed source-owned, public-schema table names only; no untrusted SQL parts.
  const result=await db.$queryRawUnsafe(`SELECT count(*)::text AS count,
    encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY to_jsonb(t)::text),''),'UTF8')),'hex') AS digest
    FROM "${name}" t`);
  out[name]=result[0];
 }
 return out;
}
async function guards(){
 return db.$queryRawUnsafe(`SELECT tgname AS name FROM pg_trigger
   WHERE ((tgrelid='public.material_uom_effect_pins'::regclass)
    OR tgrelid='public.material_uom_receipt_source_pins'::regclass
    OR tgrelid='public.material_uom_reservation_pins'::regclass
    OR tgrelid='public.material_uom_issue_source_pins'::regclass
    OR tgrelid='public.material_uom_transfer_source_pins'::regclass
    OR tgrelid='public.material_uom_activations'::regclass
    OR (tgrelid='public.stock_transfer_items'::regclass AND tgname='material_uom_transfer_source_drift_guard')
    OR (tgrelid='public.approval_instances'::regclass AND tgname='material_uom_transfer_approval_guard')
    OR (tgrelid='public.material_issue_items'::regclass AND tgname='material_uom_issue_source_drift_guard')
    OR (tgrelid='public.material_reservations'::regclass AND tgname IN ('material_uom_reservation_fulfillment_guard','material_uom_active_reservation_proof'))
    OR (tgrelid='public.goods_receipt_items'::regclass AND tgname='material_uom_receipt_source_drift_guard')
    OR (tgrelid='public.goods_receipts'::regclass AND tgname='material_uom_receipt_post_proof')
    OR (tgrelid='public.material_issues'::regclass AND tgname='material_uom_issue_post_proof')
    OR (tgrelid='public.material_returns'::regclass AND tgname='material_uom_return_post_proof')
    OR (tgrelid='public.stock_counts'::regclass AND tgname='material_uom_stock_count_guard')
    OR (tgrelid='public.stock_transactions'::regclass AND tgname IN ('material_uom_active_movement_guard','material_uom_copy_reversal_pin','material_uom_copy_receipt_pin','material_uom_copy_issue_pin','material_uom_copy_return_pin','material_uom_copy_transfer_pin')))
   AND NOT tgisinternal ORDER BY tgname`);
}
try{
 await db.$connect();
 const before=await rows();
 if(mode==='pristine'){
 assert.equal(before.material_uom_effect_pins.count,'0','B migration must not normalize or backfill historical stock');
 assert.equal(before.material_uom_receipt_source_pins.count,'0','No retrospective source freezes');
 assert.equal(before.material_uom_reservation_pins.count,'0','No retrospective reservations');
 assert.equal(before.material_uom_issue_source_pins.count,'0','No retrospective issue freezes');
 assert.equal(before.material_uom_transfer_source_pins.count,'0','No retrospective transfer freezes');
 assert.equal(before.material_uom_activations.count,'0','No automatic material activation');
 }
 assert.deepEqual(await guards(),[{name:'material_uom_activation_guard'},{name:'material_uom_active_movement_guard'},{name:'material_uom_active_reservation_proof'},{name:'material_uom_copy_issue_pin'},{name:'material_uom_copy_receipt_pin'},{name:'material_uom_copy_return_pin'},{name:'material_uom_copy_reversal_pin'},{name:'material_uom_copy_transfer_pin'},{name:'material_uom_effect_pin_guard'},{name:'material_uom_issue_post_proof'},{name:'material_uom_issue_source_drift_guard'},{name:'material_uom_issue_source_guard'},{name:'material_uom_receipt_post_proof'},{name:'material_uom_receipt_source_drift_guard'},{name:'material_uom_receipt_source_guard'},{name:'material_uom_reservation_fulfillment_guard'},{name:'material_uom_reservation_pin_guard'},{name:'material_uom_return_post_proof'},{name:'material_uom_stock_count_guard'},{name:'material_uom_transfer_approval_guard'},{name:'material_uom_transfer_source_drift_guard'},{name:'material_uom_transfer_source_guard'}]);
 const sourceLocks=await db.$queryRawUnsafe(`SELECT c.relname AS name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE tgname='material_uom_source_activation_lock' AND NOT tgisinternal ORDER BY c.relname`);
 assert.deepEqual(sourceLocks.map(x=>x.name),['goods_receipt_items','material_issue_items','material_request_lines','material_reservations','material_return_items','material_usage_plan_lines','receiving_delivery_lines','stock_counts','stock_transfer_items']);
 if(mode==='pristine'){
  writeFileSync(manifest,JSON.stringify({pristine:true,guard:await guards(),sourceLocks}),{mode:0o600});
  console.log('MATERIAL_UOM_EFFECT_PRISTINE_MIGRATION_NO_BACKFILL_VERIFIED');
 }else if(mode==='protect'){
  const pristine=JSON.parse(readFileSync(manifest.replace('-protected.json','-pristine.json'),'utf8'));
  assert.equal(pristine.pristine,true);
  assert.deepEqual(pristine.guard,await guards());assert.deepEqual(pristine.sourceLocks,sourceLocks);
  const bogus=randomUUID();
  await assert.rejects(
   db.$executeRawUnsafe(
    `INSERT INTO material_uom_effect_pins(stock_transaction_id,company_id,material_id,source_uom_id,
      source_quantity,stock_uom_id,stock_quantity,effect_sign,business_date,basis_version,
      revision_id,numerator,denominator)
     VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,1,$5::uuid,1,1,DATE '2026-11-19',1,NULL,'1','1')`,
    bogus,randomUUID(),randomUUID(),randomUUID(),randomUUID()),
   /MATERIAL_UOM_LEDGER_PIN_MISMATCH/,
   'Raw SQL may not manufacture stock effect pins'
  );
  assert.deepEqual(await rows(),before,'Denied direct write may not alter stock or grants');
  writeFileSync(manifest,JSON.stringify({tables:before,guard:await guards(),sourceLocks}),{mode:0o600});
  console.log('MATERIAL_UOM_EFFECT_PREUPGRADE_HISTORY_AND_SQL_BYPASS_DENIED');
 }else{
  const receipt=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(before,receipt.tables,'Copied populated stock/Finance/grants not preserved');
  assert.deepEqual(await guards(),receipt.guard);
  assert.deepEqual(sourceLocks,receipt.sourceLocks);
  console.log('MATERIAL_UOM_EFFECT_RESTORED_HISTORY_AND_GUARDS_VERIFIED');
 }
}finally{await db.$disconnect();}
