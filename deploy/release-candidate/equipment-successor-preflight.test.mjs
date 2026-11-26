import assert from 'node:assert/strict';
import test from 'node:test';
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

test('current combined successor adds exactly the three equipment migrations and pinned PO guard without schema or predecessor drift',()=>{
 assert.equal(assertExactCombinedEquipmentPoSuccessor(),true);
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
