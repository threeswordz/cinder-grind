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
assert.ok(['protect','restored'].includes(mode));
assert.match(manifest??'',/^\/tmp\/construction-erp-v10e-migration\.[^/]+\/material-uom-effect-protected\.json$/);

const require=createRequire(resolve('apps/api/package.json'));
require('reflect-metadata');
const {PrismaService}=require('./dist/prisma/prisma.service.js');
const db=new PrismaService();
const tables=['stock_transactions','material_reservations','goods_receipt_items','material_issue_items',
  'material_uom_bases','material_uom_revisions','material_uom_effect_pins','role_permissions','user_roles'];
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
    OR (tgrelid='public.stock_transactions'::regclass AND tgname='material_uom_copy_reversal_pin'))
   AND NOT tgisinternal ORDER BY tgname`);
}
try{
 await db.$connect();
 const before=await rows();
 assert.equal(before.material_uom_effect_pins.count,'0','B migration must not normalize or backfill historical stock');
 assert.deepEqual(await guards(),[{name:'material_uom_copy_reversal_pin'},{name:'material_uom_effect_pin_guard'}]);
 if(mode==='protect'){
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
  writeFileSync(manifest,JSON.stringify({tables:before,guard:await guards()}),{mode:0o600});
  console.log('MATERIAL_UOM_EFFECT_PREUPGRADE_HISTORY_AND_SQL_BYPASS_DENIED');
 }else{
  const receipt=JSON.parse(readFileSync(manifest,'utf8'));
  assert.deepEqual(before,receipt.tables,'Copied populated stock/Finance/grants not preserved');
  assert.deepEqual(await guards(),receipt.guard);
  console.log('MATERIAL_UOM_EFFECT_RESTORED_HISTORY_AND_GUARDS_VERIFIED');
 }
}finally{await db.$disconnect();}
