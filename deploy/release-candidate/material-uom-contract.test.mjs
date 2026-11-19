import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripMaterialUomSchema,stripMaterialUomStockSchema,materialUomMode,materialUomTables,materialUomMigrations,materialUomStockMigrations} from './material-uom-schema-contract.mjs';
import {materialUomCatalog,verifyMaterialUomCatalog} from './material-uom-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const schema=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
const previous=execFileSync('git',['show','59d67d1f2e54e6bfde51e4c5be336ea97906bf52:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('DEC-050 A admits exactly three prepared facts without changing canonical stock/commercial models',()=>{
 assert.equal(classifySchema(previous,schema),'migration-aware-material-uom-schema');
 assert.equal(stripMaterialUomStockSchema(schema).present,true,'All fourteen optional B fields are exact and complete');
 assert.equal(stripMaterialUomSchema(schema).text.replace(/\s+/g,' ').trim(),previous.replace(/\s+/g,' ').trim());
 assert.deepEqual(materialUomMode('migration-aware-material-uom-subcontract-physical-schema'),{present:true,prior:'migration-aware-subcontract-physical-schema'});
 for(const bad of [schema.replace('numerator String @db.VarChar(38)','numerator Float'),schema.replace('model MaterialUomOperation {','model OtherReceipt {'),schema+'\nmodel AnotherStockLedger {\n id String @id\n}',schema.replace('defaultUomId     String','defaultUomId     Float')])if(bad!==schema)assert.throws(()=>classifySchema(previous,bad));
 assert.throws(()=>classifySchema(schema,previous));
 assert.throws(()=>classifySchema(schema,stripMaterialUomStockSchema(schema).text),'No B source fact may be silently removed');
});
test('conversion capability catalog is exact and migrations never grant roles or alter historical effects',()=>{
 verifyMaterialUomCatalog(materialUomCatalog,true);assert.throws(()=>verifyMaterialUomCatalog([],true));
 const names=readdirSync(new URL('../../apps/api/prisma/migrations/',import.meta.url)).filter(n=>n.includes('_material_uom_'));
 assert.deepEqual(names.sort(),[...materialUomMigrations,...materialUomStockMigrations].sort());
 const sql=[...materialUomMigrations,...materialUomStockMigrations].map(n=>readFileSync(new URL('../../apps/api/prisma/migrations/'+n+'/migration.sql',import.meta.url),'utf8')).join('\n');
 for(const value of Object.values(materialUomCatalog[0]))assert.ok(sql.includes(value));
 assert.doesNotMatch(sql,/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+"?(?:role_permissions|user_roles|stock_transactions|material_reservations|purchase_orders|payments)"?\b/i);
 for(const guard of ['material_uom_basis_receipt','material_uom_revision_receipt','material_uom_operation_receipt','material_uom_unit_pin'])assert.ok(sql.includes(guard));
 for(const guard of ['erp_material_uom_exact_stock_fact','material_uom_stock_fact_guard','material_uom_reservation_stock_guard'])
  assert.ok(sql.includes(guard),'B must retain the exact stock/reservation database source guard: '+guard);
 for(const invalid of [
   schema.replace('stockQuantity        Decimal?', 'stockQuantity        Float'),
   schema.replace('conversionNumerator String?', 'conversionNumerator Float'),
   schema.replace(/stockUomId\s+String\?\s+@map\("stock_uom_id"\)\s+@db.Uuid/, ''),
   schema+'\nmodel UnapprovedStockLedger {\n id String @id\n}',
 ])if(invalid!==schema)assert.throws(()=>classifySchema(previous,invalid));

});
test('historical proof admits only the complete empty definition group, never old-row drift',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},before={customer_boq_versions:empty,materials:{count:'2',digest:'old'},role_permissions:{count:'3',digest:'grants'}},added=Object.fromEntries(materialUomTables.map(n=>[n,empty]));
 const check=after=>assertHistoricalTables(before,after,false,false,false,false,false,false,false,false,false,false,true);
 check({...before,...added});assert.throws(()=>check({...before,...added,materials:empty}));assert.throws(()=>check({...before,...added,role_permissions:empty}));
 assert.throws(()=>check({...before,...added,material_uom_bases:{count:'1',digest:'backfill'}}));
 delete added.material_uom_operations;assert.throws(()=>check({...before,...added}));
});
