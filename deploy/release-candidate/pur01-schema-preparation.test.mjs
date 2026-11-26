import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pur01Column,pur01Migration,pur01MigrationBlob,assertExactPur01Increment,stripPur01Schema,classifyPurchasingPreparation} from './pur01-schema-preparation.mjs';
import {verifiedPur01HistoricalColumns} from './pur01-historical-columns.mjs';
import {classifySchema} from './schema-contract.mjs';
const base='f9b4feadf1b0641621a489082c2ca2224df789cd';
const prior='05e64e24eb8d5b0864c360109bcdc570eae9134a';
const main='040395bc7b0dedd40207f91f743bc2efc1584622';
const schema=ref=>execFileSync('git',['show',ref+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
const pur01Source='cde0237679608074da07f7ef32f611c9ea158d77';
const before=schema(base),after=schema(pur01Source);
test('exact PUR01 increment and composed historical modes with bounded global admission',()=>{
 assert.equal(assertExactPur01Increment(before,after),true);
 assert.equal(classifyPurchasingPreparation(before,after),'migration-aware-pur01-schema');
 assert.equal(classifyPurchasingPreparation(schema(prior),after),'migration-aware-pur01-pur04-schema');
 assert.equal(classifyPurchasingPreparation(schema(main),after),'migration-aware-pur01-pur04-pm02-schema');
 assert.equal(classifyPurchasingPreparation(after,after),'migration-aware-sql-only');
 assert.equal(classifyPurchasingPreparation(schema(prior),before),'migration-aware-pur04-schema');
 assert.throws(()=>classifyPurchasingPreparation(after,before));
 assert.throws(()=>classifyPurchasingPreparation(before,schema(prior)));
 assert.equal(classifySchema(before,after),'migration-aware-pur01-schema');
 assert.equal(classifySchema(schema(main),after),'migration-aware-pur01-pur04-pm02-schema');
 assert.throws(()=>classifySchema(after,before));
 for(const bad of [
  after.replace('supplierQuoteExceptionReason String?','supplierQuoteExceptionReason String'),
  after.replace('@map("supplier_quote_exception_reason") @db.VarChar(2000)','@map("supplier_quote_exception_reason") @db.VarChar(4000)'),
  after.replace('supplierQuoteExceptionReason String?','supplierQuoteExceptionReason String? @default("unknown")'),
  after.replace(/contractValue\s+Decimal/,'contractValue Float'),
 ]){assert.notEqual(bad,after);assert.throws(()=>classifyPurchasingPreparation(before,bad));assert.throws(()=>classifySchema(before,bad));}
 const path='apps/api/prisma/migrations/'+pur01Migration+'/migration.sql';
 assert.equal(execFileSync('git',['diff','--name-status',base,pur01Source,'--','apps/api/prisma/migrations'],{encoding:'utf8'}).trim(),'A\t'+path);
 assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),pur01MigrationBlob);
});
const fixture=()=>[
 [{migration_name:pur01Migration,checksum:createHash('sha256').update(readFileSync(new URL('../../apps/api/prisma/migrations/'+pur01Migration+'/migration.sql',import.meta.url))).digest('hex')}],
 [{column_name:pur01Column,data_type:'character varying',character_maximum_length:2000,is_nullable:'YES',column_default:null}],
 [{n:'0'}]
];
test('historical PUR01 exclusion is restricted to validated exact NULL column',async()=>{
 const db=rows=>({$queryRawUnsafe:async()=>rows.shift()});
 assert.deepEqual(await verifiedPur01HistoricalColumns(db(fixture())),[pur01Column]);
 for(const change of [r=>r[0][0].checksum='bad',r=>r[1][0].character_maximum_length=1000,r=>r[1][0].is_nullable='NO',r=>r[1][0].column_default='unknown',r=>r[2][0].n='1']){
  const rows=fixture();change(rows);await assert.rejects(()=>verifiedPur01HistoricalColumns(db(rows)));
 }
});
