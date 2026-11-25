import assert from 'node:assert/strict';
import test from 'node:test';
import {assertExactEquipmentSuccessor,assertEquipmentSuccessor,expected,migrationRoot} from './equipment-successor-preflight.mjs';
test('exact successor adds only pinned custody and asset migrations, preserves all historical blobs and Prisma schema',()=>{
 assert.equal(assertExactEquipmentSuccessor(),true);
});
test('fails closed on missing, edited, additional or historical migration changes and unrelated schema drift',()=>{
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
