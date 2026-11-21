import {stripMaterialUomStageCSchema} from './material-uom-stage-c-schema-contract.mjs';
import {stripMaterialUomEffectSchema} from './material-uom-effect-schema-contract.mjs';
import {stripMaterialUomSchema} from './material-uom-schema-contract.mjs';
import {stripPhysicalSchema} from './subcontract-physical-schema-contract.mjs';
import {stripTransferSchema as transferBase} from './transfer-schema-contract.mjs';
const stripTransferSchema=schema=>transferBase(stripPhysicalSchema(schema).text);
const stripReceivingSchema=schema=>receivingBase(stripTransferSchema(schema).text);
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {classifySchema} from './schema-contract.mjs';
import {stripReceivingSchema as receivingBase,receivingMode,receivingTables} from './receiving-schema-contract.mjs';
import {receivingCatalog,verifyReceivingCatalog} from './receiving-catalog-contract.mjs';
import {assertHistoricalTables} from './historical-snapshot.mjs';
const current=stripTransferSchema(stripMaterialUomSchema(stripMaterialUomEffectSchema(stripMaterialUomStageCSchema(readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8')).text).text).text).text;
const previous=execFileSync('git',['show','d2b790801119fb1b5b4176ad416086ee7363d091:apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('receiving exact six-model contract preserves the post-FM03 schema and nullable GR provenance',()=>{
 assert.equal(classifySchema(previous,current),'migration-aware-receiving-schema');assert.equal(stripReceivingSchema(current).present,true);
 assert.equal(stripReceivingSchema(current).text.replace(/\s+/g,' ').trim(),previous.replace(/\s+/g,' ').trim());
 for(const bad of [current.replace('receivingPolicy ReceivingProjectPolicy?',''),current.replace('deliveryId String? @unique','deliveryId String @unique'),current.replace('observedQuantity Decimal','observedQuantity Float'),current.replace('model ReceivingOperation {','model OtherOperation {'),current+'\nmodel Unapproved {\n id String @id\n}'])assert.throws(()=>classifySchema(previous,bad));
 assert.throws(()=>classifySchema(current,previous));assert.deepEqual(receivingMode('migration-aware-receiving-site-issue-schema'),{present:true,prior:'migration-aware-site-issue-schema'});
});
test('receiving catalogue adds only exact definitions with no retained grants or acceptance backfill',()=>{
 verifyReceivingCatalog(receivingCatalog,true);
 for(const bad of [receivingCatalog.slice(1),receivingCatalog.map((p,i)=>i?p:{...p,module_code:'FINANCE'}),receivingCatalog.map((p,i)=>i?p:{...p,extra:true})])assert.throws(()=>verifyReceivingCatalog(bad,true));
 const sql=readFileSync(new URL('../../apps/api/prisma/migrations/20261115130000_receiving_custody/migration.sql',import.meta.url),'utf8');
 for(const row of receivingCatalog)for(const value of Object.values(row))assert.ok(sql.includes(value));
 assert.doesNotMatch(sql,/INSERT\s+INTO\s+"?(role_permissions|user_roles|stock_transactions|payments|direct_cost_postings|receiving_deliveries)"?/i);
});
test('receiving historical snapshots admit only six empty tables while preserving every old row and grant',()=>{
 const empty={count:'0',digest:createHash('sha256').update('').digest('hex')},before={customer_boq_versions:empty,role_permissions:{count:'7',digest:'retained'},goods_receipts:{count:'2',digest:'original-with-null-new-link'}};
 const added=Object.fromEntries(receivingTables.map(t=>[t,empty])),verify=after=>assertHistoricalTables(before,after,false,false,false,false,false,false,false,true);
 verify({...before,...added});assert.throws(()=>assertHistoricalTables(before,{...before,...added}));assert.throws(()=>verify({...before,...added,goods_receipts:empty}));assert.throws(()=>verify({...before,...added,receiving_deliveries:{count:'1',digest:'fabricated-acceptance'}}));delete added.receiving_operations;assert.throws(()=>verify({...before,...added}));
});
