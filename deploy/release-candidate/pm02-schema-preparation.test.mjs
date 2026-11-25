import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {assertExactPm02Increment,stripPm02Schema,pm02Fields,pm02Migrations} from './pm02-schema-preparation.mjs';
const baseline='040395bc7b0dedd40207f91f743bc2efc1584622';
const prev=execFileSync('git',['show',baseline+':apps/api/prisma/schema.prisma'],{encoding:'utf8'});
const next=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
test('PM02 exact five nullable fields only on PurchaseRequestLine',()=>{
 assert.equal(stripPm02Schema(prev).present,false);
 assert.equal(stripPm02Schema(next).present,true);
 assert.equal(assertExactPm02Increment(prev,next),true);
});
test('PM02 rejects partial, required, defaulted, nonunique, relocated or unrelated schema changes',()=>{
 for(const invalid of [
  next.replace(/reviewReason\s+String\?\s+@map\("review_reason"\) @db.Text/,''),
  next.replace(/reviewDecision\s+String\?/,'reviewDecision String'),
  next.replace(/reviewedAt\s+DateTime\?/,'reviewedAt DateTime? @default(now())'),
  next.replace(/correctionSourceLineId\s+String\?\s+@unique/,'correctionSourceLineId String?'),
  next.replace(/contractValue\s+Decimal/,'contractValue Float'),
  next.replace(/model PurchaseRequestLine \{/,'model OtherPurchaseRequestLine {'),
  next+'\nmodel Unreviewed {\n id String @id\n}',
 ]) {assert.notEqual(invalid,next);assert.throws(()=>assertExactPm02Increment(prev,invalid));}
 assert.throws(()=>assertExactPm02Increment(next,prev));
 assert.throws(()=>assertExactPm02Increment(prev,prev));
 assert.equal(pm02Fields.length,5);
});
test('exact two added forward migrations; all prior migration blobs unchanged',()=>{
 const changed=execFileSync('git',['diff','--name-status',baseline,'HEAD','--','apps/api/prisma/migrations'],{encoding:'utf8'}).trim().split('\n').sort();
 const entries=Object.entries(pm02Migrations);
 assert.deepEqual(changed,entries.map(([name])=>'A\tapps/api/prisma/migrations/'+name+'/migration.sql').sort());
 for(const [name,sha] of entries)
  assert.equal(execFileSync('git',['hash-object','apps/api/prisma/migrations/'+name+'/migration.sql'],{encoding:'utf8'}).trim(),sha);
});
