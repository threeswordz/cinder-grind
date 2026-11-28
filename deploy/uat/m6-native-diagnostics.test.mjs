import test from 'node:test';
import assert from 'node:assert/strict';
import {safeFailure,observeStage} from './m6-native-diagnostics.mjs';
test('redacts raw query, message and credentials',async()=>{
  const error=Object.assign(new Error('private row and password'),{code:'P2010',meta:{code:'42P01',message:'secret SQL'}});
  assert.deepEqual(await observeStage('M6_LANE_A',async()=>{throw error;}),{stage:'M6_LANE_A',status:'BLOCKED',safeCode:'M6_NATIVE_PRIVATE_FAILURE',prismaCode:'P2010',sqlState:'42P01'});
});
test('keeps only allowlisted code shapes',()=>{
  assert.deepEqual(safeFailure({safeCode:'M6_NATIVE_ACTIVE_SESSIONS',code:'secret',meta:{code:'private data'}}),{safeCode:'M6_NATIVE_ACTIVE_SESSIONS'});
  assert.deepEqual(safeFailure(null),{safeCode:'M6_NATIVE_PRIVATE_FAILURE'});
});
test('independent observation after failed stage still runs',async()=>{
  const a=await observeStage('M6_ROWS',async()=>{throw new Error('private');});
  const b=await observeStage('M6_LANE_B',async()=>({count:'2'}));
  assert.equal(a.status,'BLOCKED');assert.deepEqual(b,{stage:'M6_LANE_B',status:'PASS',result:{count:'2'}});
});
test('invalid stage label is rejected',async()=>assert.rejects(observeStage('private value',async()=>true)));
