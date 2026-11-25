import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {assertExactPur12Increment,assertExactPur07Increment,stripPur12Schema,stripPur07Schema,pur12Migration,pur12MigrationBlob,pur07Migration,pur07MigrationBlob} from './purchasing-successor-schema-preparation.mjs';
import {classifySchema} from './schema-contract.mjs';
const base='bd8be84e91c985db53a7ecd4ecd8796e03664834';
const identity='59be28af0285ff42d671d4dbc9b9a3b614ab0400';
const dispatch='2dfd9b96fe4495f3a2ac5d4aa37f6cbc0170cf20';
const read=ref=>execFileSync('git',['show',ref+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
const old=read(base),one=read(identity),two=read(dispatch);
test('PUR12 four nullable fields only, exact immutable-identity migration, admission remains closed',()=>{
 assert.equal(assertExactPur12Increment(old,one),true);
 assert.throws(()=>assertExactPur12Increment(one,old));
 assert.throws(()=>classifySchema(old,one));
 for(const bad of [
 one.replace(/shortName\s+String\?/,'shortName String'),
 one.replace(/displayNumber\s+String\?/,'displayNumber String? @default("unknown")'),
 one.replace(/supplierShortNameSnapshot\s+String\?/,'supplierShortNameSnapshot String'),
 one.replace(/contractValue\s+Decimal/,'contractValue Float')
 ]){assert.notEqual(bad,one);assert.throws(()=>assertExactPur12Increment(old,bad));}
});
test('PUR07 exact dispatch model and five relations, no historical rewrite, admission remains closed',()=>{
 assert.equal(assertExactPur07Increment(one,two),true);
 assert.equal(assertExactPur12Increment(old,stripPur07Schema(two).text),true);
 assert.throws(()=>assertExactPur07Increment(two,one));
 assert.throws(()=>classifySchema(one,two));
 for(const bad of [
 two.replace('poDispatchEvents PoDispatchEvent[]',''),
 two.replace(/evidenceReference\s+String\s+@map\("evidence_reference"\) @db.VarChar\(1200\)/,'evidenceReference String? @map("evidence_reference") @db.VarChar(1200)'),
 two.replace('@@index([evidenceDocumentId])',''),
 two.replace(/contractValue\s+Decimal/,'contractValue Float')
 ]){assert.notEqual(bad,two);assert.throws(()=>assertExactPur07Increment(one,bad));}
});
test('exact two new migrations and no altered predecessor migration blobs',()=>{
 for(const [from,to,name,hash] of [[base,identity,pur12Migration,pur12MigrationBlob],[identity,dispatch,pur07Migration,pur07MigrationBlob]]){
  const path='apps/api/prisma/migrations/'+name+'/migration.sql';
  assert.equal(execFileSync('git',['diff','--name-status',from,to,'--','apps/api/prisma/migrations'],{encoding:'utf8'}).trim(),'A\t'+path);
  assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),hash);
 }
});
