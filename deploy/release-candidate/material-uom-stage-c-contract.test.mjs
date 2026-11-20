import {assertHistoricalTables} from './historical-snapshot.mjs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripMaterialUomStageCSchema,materialUomStageCMode,stageCMigrations,stageCTables} from './material-uom-stage-c-schema-contract.mjs';
import {classifySchema} from './schema-contract.mjs';

const schema=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
const before=execFileSync('git',['show','bd84f5d188b34ce3017ae42a2c88859d4162240f:apps/api/prisma/schema.prisma'],{encoding:'utf8'});

test('DEC-050 C admits only three exact immutable models/relations and preserves all B business fields',()=>{
 const stripped=stripMaterialUomStageCSchema(schema);
 assert.equal(stripped.present,true);
 assert.equal(stripped.text.replace(/\s+/g,' ').trim(),before.replace(/\s+/g,' ').trim());
 for(const bad of [
  schema.replace('stockOverageQuantity Decimal @map("stock_overage_quantity")','stockOverageQuantity Float @map("stock_overage_quantity")'),
  schema.replace('materialUomRequestLinePins MaterialUomRequestLinePin[]','materialUomRequestLinePins MaterialUomRequestLinePin?'),
  schema.replace('materialUomPlanLinePin MaterialUomPlanLinePin?','materialUomPlanLinePin MaterialUomPlanLinePin[]'),
  schema.replace('model MaterialUomPlanAllocationPin {','model UnauthorizedStockOverageBalance {'),
  schema+'\nmodel UnauthorizedStockLedger {\n  id String @id\n}',
 ]){
  assert.throws(()=>classifySchema(before,bad));
 }
 assert.throws(()=>classifySchema(schema,before),'Cannot delete approved immutable C source');
 assert.equal(classifySchema(before,schema),'migration-aware-material-uom-stage-c-schema');
});

test('DEC-050 C uses exactly five forward-only migrations with no stock/Finance/history backfill',()=>{
 const names=readdirSync(new URL('../../apps/api/prisma/migrations/',import.meta.url));
 assert.deepEqual(names.filter(x=>x>='20261120221000'&&x.includes('_material_uom_')).sort(),stageCMigrations);
 for(const [index,name] of stageCMigrations.entries()){
  const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
  if(index<3)assert.ok(sql.includes(stageCTables[index]));
  else assert.ok(sql.includes('CREATE OR REPLACE FUNCTION erp_mpi_validate_auth'));
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:"?stock_transactions|"?role_permissions|"?user_roles|"?payments|"?direct_cost_postings)\b/i);
  assert.doesNotMatch(sql,/\b(?:DROP TABLE|TRUNCATE|ALTER TABLE\s+(?:stock_transactions|payments|direct_cost_postings)\b)/i);
 }
});


test('C is explicit in every older predecessor mode rather than silently lost behind B/A',()=>{
 for(const sha of ['59d67d1f2e54e6bfde51e4c5be336ea97906bf52','d2b790801119fb1b5b4176ad416086ee7363d091']){
  const prior=execFileSync('git',['show',sha+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
  const mode=classifySchema(prior,schema),peeled=materialUomStageCMode(mode);
  assert.equal(peeled.present,true);assert.equal(peeled.prior,classifySchema(prior,before));
 }
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},old={customer_boq_versions:empty,stock_transactions:{count:'2',digest:'unaltered'}};
 const after={...old,...Object.fromEntries(stageCTables.map(n=>[n,empty]))};
 const verify=value=>assertHistoricalTables(old,value,...Array(12).fill(false),true);
 verify(after);assert.throws(()=>verify(old));assert.throws(()=>assertHistoricalTables(old,after));
 for(const name of stageCTables)assert.throws(()=>verify({...after,[name]:{...empty,count:'1'}}));
 assert.throws(()=>verify({...after,stock_transactions:empty}));
});
