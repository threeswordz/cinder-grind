import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {assertExactPur04Increment,pur04Migration,pur04MigrationBlob,pur04Columns} from './pur04-schema-preparation.mjs';
import {verifiedPur04HistoricalColumns} from './pur04-historical-columns.mjs';
import {classifySchema} from './schema-contract.mjs';
const base='05e64e24eb8d5b0864c360109bcdc570eae9134a';
const before=execFileSync('git',['show',base+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
const pur04Source='f9b4feadf1b0641621a489082c2ca2224df789cd';
const after=execFileSync('git',['show',pur04Source+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
test('PUR04 exact increment, migration blob and bounded global admission',()=>{
 assert.equal(assertExactPur04Increment(before,after),true);
 assert.throws(()=>assertExactPur04Increment(after,before));
 assert.equal(classifySchema(before,after),'migration-aware-pur04-schema');
 assert.throws(()=>classifySchema(after,before));
 for(const invalid of [
 after.replace(/deliveryLocation\s+String\?/,'deliveryLocation String'),
 after.replace(/discountAmount\s+Decimal\?/,'discountAmount Decimal? @default(0)'),
 after.replace(/vatRatePercent\s+Decimal\?\s+@map\("vat_rate_percent"\) @db.Decimal\(5, 2\)/,''),
 after.replace(/contractValue\s+Decimal/,'contractValue Float'),
 ]){assert.notEqual(invalid,after);assert.throws(()=>assertExactPur04Increment(before,invalid));}
 const path='apps/api/prisma/migrations/'+pur04Migration+'/migration.sql';
 assert.equal(execFileSync('git',['diff','--name-status',base,pur04Source,'--','apps/api/prisma/migrations'],{encoding:'utf8'}).trim(),'A\t'+path);
 assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),pur04MigrationBlob);
});
const types={
 delivery_location:['character varying',500,null,null],delivery_contact:['character varying',200,null,null],
 delivery_terms:['text',null,null,null],payment_terms:['text',null,null,null],credit_terms:['text',null,null,null],
 discount_amount:['numeric',null,18,2],freight_amount:['numeric',null,18,2],
 additional_charge_amount:['numeric',null,18,2],vat_rate_percent:['numeric',null,5,2]
};
const fixture=()=>[
 [{migration_name:pur04Migration,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+pur04Migration+'/migration.sql',import.meta.url))).digest('hex')}],
 pur04Columns.map(column_name=>{const [data_type,character_maximum_length,numeric_precision,numeric_scale]=types[column_name];return {column_name,data_type,character_maximum_length,numeric_precision,numeric_scale,is_nullable:'YES',column_default:null}}),
 [{n:'0'}],[{convalidated:true,contype:'c'}]
];
const db=rows=>({$queryRawUnsafe:async()=>rows.shift()});
test('historical exclusion only for pinned migration, exact catalog and NULL values',async()=>{
 assert.deepEqual(await verifiedPur04HistoricalColumns(db(fixture())),[...pur04Columns]);
 for(const change of [r=>r[0][0].checksum='forged',r=>r[1].pop(),r=>r[1][0].column_default='0',r=>r[1][5].numeric_scale=4,r=>r[2][0].n='1',r=>r[3][0].convalidated=false]){
  const r=fixture();change(r);await assert.rejects(()=>verifiedPur04HistoricalColumns(db(r)));
 }
});
