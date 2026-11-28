import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {projectPreSs16TestSchema} from './historical-schema-test-projection.mjs';
import {assertExactEquipmentSuccessor,assertEquipmentSuccessor,assertExactCombinedEquipmentPoSuccessor,assertCombinedEquipmentPoSuccessor,expected,poCommercialHistoryMigration,migrationRoot} from './equipment-successor-preflight.mjs';
test('exact successor adds only pinned custody, asset and Thai calendar migrations, preserves all historical blobs and Prisma schema',()=>{
 assert.equal(assertExactEquipmentSuccessor('2468adefd0f6a8a14c981a7386dd9b0d91d1b53c'),true);
});
test('fails closed on missing, edited, additional or historical migration changes and unrelated schema drift',()=>{
 assert.equal(Object.keys(expected).length,3);
 const old={[migrationRoot+'previous/migration.sql']:'historical'};
 const next={...old,...expected};
 assert.equal(assertEquipmentSuccessor(old,next,'same','same'),true);
 for(const path of Object.keys(expected)){
  const missing={...next};delete missing[path];
  assert.throws(()=>assertEquipmentSuccessor(old,missing,'same','same'));
  assert.throws(()=>assertEquipmentSuccessor(old,{...next,[path]:'tampered'},'same','same'));
 }
 assert.throws(()=>assertEquipmentSuccessor(old,{...next,[migrationRoot+'unexpected/migration.sql']:'other'},'same','same'));
 assert.throws(()=>assertEquipmentSuccessor(old,{...next,[Object.keys(old)[0]]:'rewritten'},'same','same'));
 assert.throws(()=>assertEquipmentSuccessor(old,{...expected},'same','same'));
 assert.throws(()=>assertEquipmentSuccessor(old,next,'same','different'));
});

test('historical combined successor adds exactly the three equipment migrations and pinned PO guard without schema or predecessor drift',()=>{
 assert.equal(assertExactCombinedEquipmentPoSuccessor('9417f07c609dbc091b5bbe2e09071c5e2c316459'),true);
 // A later SS16 successor cannot be misclassified as the old combined release.
 assert.throws(()=>assertExactCombinedEquipmentPoSuccessor());
 // The historical three-migration contract remains strict, not widened.
 assert.throws(()=>assertExactEquipmentSuccessor());
 assert.throws(()=>assertExactCombinedEquipmentPoSuccessor('2468adefd0f6a8a14c981a7386dd9b0d91d1b53c'));
});
test('combined admission fails closed for missing, altered or unknown additions and changed history',()=>{
 const old={[migrationRoot+'previous/migration.sql']:'historical'};
 const pins={...expected,...poCommercialHistoryMigration};
 const next={...old,...pins};
 assert.equal(Object.keys(expected).length,3);
 assert.equal(Object.keys(pins).length,4);
 assert.equal(assertCombinedEquipmentPoSuccessor(old,next,'same','same'),true);
 for(const path of Object.keys(pins)){
  const missing={...next};delete missing[path];
  assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,missing,'same','same'));
  assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,{...next,[path]:'tampered'},'same','same'));
 }
 assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,{...next,[migrationRoot+'unexpected/migration.sql']:'other'},'same','same'));
 assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,{...next,[Object.keys(old)[0]]:'rewritten'},'same','same'));
 assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,pins,'same','same'));
 assert.throws(()=>assertCombinedEquipmentPoSuccessor(old,next,'same','different'));
 assert.throws(()=>assertEquipmentSuccessor(old,next,'same','same'));
});

// Test the actual current successor in addition to the strict historical gate.
const ss16Pins=Object.freeze({
  "20261127041000_ss16_movement_correction_request": "15c5c008c89319fff63b2693dd74643672260b79",
  "20261127050000_ss16_unposted_cancellation_pin": "ddaa18ba825224109678f57a980aa2cba176f748",
  "20261127060000_ss16_controlled_submitted_cancellation": "78e06c3b3ab90dc1b63657f83436bd837a39c868",
  "20261127070000_ss16_terminal_controlled_cancellation": "c48243e098aa21fe1f6177adf277927249f77263",
  "20261127080000_ss16_plan_cancel_decision_proof": "05dd43ce8d6961ec0a8bb0ba25d9d07288148ebe",
  "20261127150000_ss16_reciprocal_decision_integrity": "11142cdbee00034f8b27bfd4eb9d099cb10f85cf",
  "20261127160000_ss16_terminal_outcome_ledger_proof": "e53dc8f7ad59fbd4cebf716a77366d91db311f9d"
});
const inventory=ref=>Object.fromEntries(execFileSync('git',['ls-tree','-r','-z',ref,'--',migrationRoot],{encoding:'utf8'}).split('\0').filter(Boolean).map(row=>{const [meta,path]=row.split('\t');assert.match(meta,/^100644 blob [a-f0-9]{40}$/);return [path,meta.split(' ')[2]];}));
test('SS16 exact current layer preserves every predecessor migration and adds only the seven reviewed blobs',()=>{
 const previous=inventory('9417f07c609dbc091b5bbe2e09071c5e2c316459'),current=inventory('HEAD');
 assert.equal(Object.keys(previous).filter(path=>path.endsWith('/migration.sql')).length,177);
 assert.deepEqual(current,{...previous,...Object.fromEntries(Object.entries(ss16Pins).map(([name,blob])=>[migrationRoot+name+'/migration.sql',blob]))});
 assert.equal(Object.keys(current).filter(path=>path.endsWith('/migration.sql')).length,184);
 const schema=readFileSync(new URL('../../apps/api/prisma/schema.prisma',import.meta.url),'utf8');
 const prior=projectPreSs16TestSchema(schema);
 for(const bad of [prior,schema.replace('sourceKind String @map("source_kind")','sourceKind Int @map("source_kind")'),schema+'\nmodel Unauthorized {\n id String @id\n}\n'])assert.throws(()=>projectPreSs16TestSchema(bad));
});
