import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {stripMaterialUomStageCSchema,stageCMigrations,stageCTables} from './material-uom-stage-c-schema-contract.mjs';
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

test('DEC-050 C uses exactly three forward-only migrations with no stock/Finance/history backfill',()=>{
 const names=readdirSync(new URL('../../apps/api/prisma/migrations/',import.meta.url));
 assert.deepEqual(names.filter(x=>/^2026112022|^2026112023/.test(x)).sort(),stageCMigrations);
 for(const [index,name] of stageCMigrations.entries()){
  const sql=readFileSync(new URL('../../apps/api/prisma/migrations/'+name+'/migration.sql',import.meta.url),'utf8');
  assert.ok(sql.includes(stageCTables[index]));
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE|DELETE FROM)\s+(?:"?stock_transactions|"?role_permissions|"?user_roles|"?payments|"?direct_cost_postings)\b/i);
  assert.doesNotMatch(sql,/\b(?:DROP TABLE|TRUNCATE|ALTER TABLE\s+(?:stock_transactions|payments|direct_cost_postings)\b)/i);
 }
});
