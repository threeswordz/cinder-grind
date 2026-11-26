import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {stripPurchasingSchema,purchasingUpgradeFlags,purchasingHistoricalNames,verifiedPurchasingHistoricalColumns} from './purchasing-historical-columns.mjs';
import {pur04Columns} from './pur04-schema-preparation.mjs';
import {pur01Column} from './pur01-schema-preparation.mjs';
const read=ref=>execFileSync('git',['show',ref+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
const old=read('05e64e24eb8d5b0864c360109bcdc570eae9134a'),four=read('f9b4feadf1b0641621a489082c2ca2224df789cd'),one=read('cde0237679608074da07f7ef32f611c9ea158d77');
test('fixed predecessor layers strip only exact new purchasing declarations',()=>{
 assert.deepEqual(stripPurchasingSchema(old),{text:old,pur01:false,pur04:false});
 assert.deepEqual(stripPurchasingSchema(four),{text:old,pur01:false,pur04:true});
 assert.deepEqual(stripPurchasingSchema(one),{text:old,pur01:true,pur04:true});
 assert.throws(()=>stripPurchasingSchema(one.replace(/deliveryLocation\s+String\?/,'deliveryLocation String')));
});
test('flags are independent, and disabled layers do not query or exclude historical data',async()=>{
 assert.deepEqual(purchasingUpgradeFlags({}),{pur04:false,pur01:false});
 assert.deepEqual(purchasingUpgradeFlags({PUR04_SCHEMA_UPGRADE:'YES',PUR01_SCHEMA_UPGRADE:'NO'}),{pur04:true,pur01:false});
 assert.deepEqual(purchasingHistoricalNames({pur04:true,pur01:false}),[...pur04Columns]);
 assert.deepEqual(purchasingHistoricalNames({pur04:false,pur01:true}),[pur01Column]);
 assert.deepEqual(purchasingHistoricalNames({pur04:true,pur01:true}),[...pur04Columns,pur01Column]);
 assert.deepEqual(await verifiedPurchasingHistoricalColumns({$queryRawUnsafe:()=>{throw Error('unexpected query')}},{pur04:false,pur01:false}),[]);
});
