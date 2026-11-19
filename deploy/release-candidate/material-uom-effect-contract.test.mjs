import {assertHistoricalTables} from './historical-snapshot.mjs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {classifySchema} from './schema-contract.mjs';
import {stripMaterialUomEffectSchema,materialUomEffectMode,materialUomEffectMigration} from './material-uom-effect-schema-contract.mjs';
const candidate=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
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
 const candidate={...before,material_uom_effect_pins:empty};
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
