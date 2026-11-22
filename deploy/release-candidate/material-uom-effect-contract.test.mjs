import {stripFm02Schema} from './fm02-schema-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {classifySchema} from './schema-contract.mjs';
import {stripMaterialUomStageCSchema} from './material-uom-stage-c-schema-contract.mjs';
import {stripMaterialUomEffectSchema,materialUomEffectMode,materialUomEffectMigration} from './material-uom-effect-schema-contract.mjs';
const candidate=stripMaterialUomStageCSchema(stripFm02Schema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text).text;
const previous=execFileSync('git',['show','72ec4127a6a04a92419fedf5db7ccb338ef8e444:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('DEC-050 B accepts exactly one isolated stock effect pin model/relation',()=>{
 assert.equal(classifySchema(previous,candidate),'migration-aware-material-uom-effect-schema');
 assert.equal(stripMaterialUomEffectSchema(candidate).text.replace(/\s+/g,' ').trim(),previous.replace(/\s+/g,' ').trim());
 assert.deepEqual(materialUomEffectMode('migration-aware-material-uom-effect-schema'),{present:true,prior:'migration-aware-sql-only'});
 assert.throws(()=>classifySchema(candidate,previous));
 for(const bad of [
  candidate.replace('sourceQuantity Decimal','sourceQuantity Float'),
  candidate.replace('effectSign Int','effectSign Float'),
  candidate.replace('model MaterialUomEffectPin {','model UnapprovedEffect {'),
  candidate.replace('materialUomEffectPin MaterialUomEffectPin?', 'materialUomEffectPin MaterialUomEffectPin[]'),
  candidate.replace('stockTransaction StockTransaction','stockTransaction String'),
  candidate+'model UnknownLedger {\n id String @id\n}',
 ])assert.throws(()=>classifySchema(previous,bad));
});
test('DEC-050 B records one exact forward-only migration and does not mutate historical balances or grants',()=>{
 const all=readdirSync(new URL('../../apps/api/prisma/migrations/',import.meta.url));
 assert.deepEqual(all.filter(n=>n==='20261119140600_material_uom_effect_pins'),[materialUomEffectMigration]);
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE material_uom_effect_pins/);
 assert.match(sql,/BEFORE INSERT OR UPDATE OR DELETE ON material_uom_effect_pins/);
 assert.match(sql,/MATERIAL_UOM_EFFECT_PIN_IMMUTABLE/);
 assert.doesNotMatch(sql,/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(?:stock_transactions|material_reservations|role_permissions|user_roles|payments)"?\b/i);
});

test('B history extension requires only the exact empty effect-pin table; no legacy-row or grant drift',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')};
 const before={customer_boq_versions:empty,stock_transactions:{count:'2',digest:'old'},role_permissions:{count:'1',digest:'grants'}};
 const verify=after=>assertHistoricalTables(before,after,false,false,false,false,false,false,false,false,false,false,false,true);
 const candidate={...before,material_uom_effect_pins:empty,material_uom_receipt_source_pins:empty,material_uom_reservation_pins:empty,material_uom_issue_source_pins:empty,material_uom_transfer_source_pins:empty,material_uom_activations:empty};
 verify(candidate);
 assert.throws(()=>verify(before));
 assert.throws(()=>verify({...candidate,stock_transactions:{count:'2',digest:'changed'}}));
 assert.throws(()=>verify({...candidate,role_permissions:empty}));
 assert.throws(()=>verify({...candidate,material_uom_effect_pins:{count:'1',digest:'fabricated'}}));
 assert.throws(()=>verify({...candidate,unknown_table:empty}));
});

test('B reversal inherits the original immutable pin; fresh pins cannot annotate historical ledger effects',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 const reverseGuard=sql.slice(sql.indexOf('IF ledger.reversal_of_id IS NOT NULL THEN'),sql.indexOf('-- Fresh pins'));
 assert.match(reverseGuard,/WHERE stock_transaction_id=ledger\.reversal_of_id/);
 assert.match(reverseGuard,/-original_pin\.effect_sign/);
 assert.match(reverseGuard,/MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED/);
 assert.match(reverseGuard,/RETURN NEW/);
 assert.doesNotMatch(reverseGuard,/ORDER BY effective_from|is_active|current_date/i);
 assert.match(sql,/t\.xmin=pg_current_xact_id\(\)::xid/);
 assert.match(sql,/basis\.version<>NEW\.basis_version/);
 assert.match(sql,/AFTER INSERT ON stock_transactions\s+FOR EACH ROW WHEN \(NEW\.reversal_of_id IS NOT NULL\)/);
 assert.match(sql,/p\.stock_quantity,-p\.effect_sign,p\.business_date,p\.basis_version/);
});

test('receipt source freeze is immutable and canonical posting requires its exact source',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE material_uom_receipt_source_pins/);
 assert.match(sql,/MATERIAL_UOM_RECEIPT_SUBMISSION_REQUIRED/);
 assert.match(sql,/item\.quantity IS DISTINCT FROM NEW\.source_quantity/);
 assert.match(sql,/MATERIAL_UOM_RECEIPT_SOURCE_IMMUTABLE/);
 assert.match(sql,/MATERIAL_UOM_RECEIPT_LEDGER_SOURCE_MISMATCH/);
 assert.match(sql,/MATERIAL_UOM_RECEIPT_APPROVED_POST_REQUIRED/);
 assert.match(sql,/MATERIAL_UOM_RECEIPT_POST_PROOF_REQUIRED/);
 assert.match(sql,/material_uom_copy_receipt_pin AFTER INSERT ON stock_transactions/);
 assert.throws(()=>classifySchema(previous,candidate.replace('materialUomReceiptSourcePin MaterialUomReceiptSourcePin?','')));
 assert.throws(()=>classifySchema(previous,candidate.replace('model MaterialUomReceiptSourcePin {','model UnreviewedReceiptPin {')));
});

test('reservation provenance is exact, immutable, canonical and legacy fulfillment is denied',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE material_uom_reservation_pins/);
 assert.match(sql,/MATERIAL_UOM_RESERVATION_PIN_IMMUTABLE/);
 assert.match(sql,/SUM\(COALESCE\(p.stock_quantity,a.quantity\)\)/);
 assert.match(sql,/MATERIAL_UOM_ISSUE_FULFILLMENT_PROOF_REQUIRED/);
 assert.match(sql,/MATERIAL_UOM_ISSUE_POST_PROOF_REQUIRED/);
 assert.match(sql,/material_uom_copy_issue_pin AFTER INSERT ON stock_transactions/);
 assert.match(sql,/MATERIAL_UOM_PLAN_ISSUE_NOT_READY/);
 assert.match(sql,/MATERIAL_UOM_RETURN_APPROVED_POST_REQUIRED/);
 assert.match(sql,/MATERIAL_UOM_RETURN_POST_PROOF_REQUIRED/);
 assert.match(sql,/MATERIAL_UOM_RETURN_ORIGINAL_PRECISION_OR_QUANTITY/);
 assert.match(sql,/material_uom_copy_return_pin AFTER INSERT ON stock_transactions/);
 assert.throws(()=>classifySchema(previous,candidate.replace('materialUomReservationPin MaterialUomReservationPin?','')));
});

test('unreserved issue source uses exact explicit date, immutable source and approval proof',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE material_uom_issue_source_pins/);
 assert.match(sql,/header\.issue_date IS DISTINCT FROM NEW\.business_date/);
 assert.match(sql,/MATERIAL_UOM_ISSUE_SOURCE_IMMUTABLE/);
 assert.match(sql,/MATERIAL_UOM_ISSUE_DEFINITION_CHANGED/);
 assert.throws(()=>classifySchema(previous,candidate.replace('materialUomIssueSourcePin MaterialUomIssueSourcePin?','')));
});

test('physical counts keep canonical stock precision and prepared definitions alone do not change legacy dimensions',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE FUNCTION erp_material_uom_tracked_stock_basis/);
 assert.match(sql,/CREATE TRIGGER material_uom_stock_count_guard BEFORE INSERT OR UPDATE ON stock_counts/);
 assert.match(sql,/MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED/);
});

test('controlled transfer conversion preserves approval, actual receipt and reversal proofs',()=>{
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+materialUomEffectMigration+'/migration.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE TABLE material_uom_transfer_source_pins/);
 assert.match(sql,/MATERIAL_UOM_TRANSFER_DISPATCH_PIN_REQUIRED/);
 assert.match(sql,/MATERIAL_UOM_TRANSFER_APPROVED_EFFECT_REQUIRED/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION erp_transfer_proof/);
 assert.throws(()=>classifySchema(previous,candidate.replace('materialUomTransferSourcePin MaterialUomTransferSourcePin?','')));
});


test('activation is exact and pristine no-backfill proof precedes deliberate populated test writes',()=>{
 assert.throws(()=>classifySchema(previous,candidate.replace('model MaterialUomActivation {','model UnreviewedActivation {')));
 assert.throws(()=>classifySchema(previous,candidate.replace('basisVersion Int @map("basis_version")','basisVersion Float @map("basis_version")')));
 const script=readFileSync(new URL('./rehearse-migration.sh',import.meta.url),'utf8');
 const pristine=script.indexOf('material-uom-effect-upgrade.mjs" pristine');
 const fixture=script.indexOf('node --test apps/api/dist/budget/customer-boq.integration.spec.js');
 const protect=script.indexOf('material-uom-effect-upgrade.mjs" protect');
 assert.ok(pristine>0&&pristine<fixture&&fixture<protect);
 const witness=readFileSync(new URL('./material-uom-effect-upgrade.mjs',import.meta.url),'utf8');
 const emptyProof=witness.slice(witness.indexOf("if(mode==='pristine'){"),witness.indexOf('assert.deepEqual(await guards()'));
 assert.match(emptyProof,/material_uom_effect_pins.count,'0'/);
 assert.match(emptyProof,/material_uom_activations.count,'0'/);
 assert.match(witness,/pristine.guard,await guards\(\)/);
 assert.match(witness,/before,receipt.tables/);
});
