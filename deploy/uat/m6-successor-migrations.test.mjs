import test from 'node:test';
import assert from 'node:assert/strict';
import {verifySuccessorMigrations,observeSuccessorMigrations} from './m6-successor-migrations.mjs';
const additions=['20261127041000_ss16_movement_correction_request','20261127050000_ss16_unposted_cancellation_pin','20261127060000_ss16_controlled_submitted_cancellation','20261127070000_ss16_terminal_controlled_cancellation','20261127080000_ss16_plan_cancel_decision_proof','20261127150000_ss16_reciprocal_decision_integrity','20261127160000_ss16_terminal_outcome_ledger_proof'];
function fixture(){
  const predecessor=Array.from({length:177},(_,i)=>({migration_name:`old_${i}`,checksum:i.toString(16).padStart(64,'0')}));
  const sources=[...predecessor.map(r=>({...r})),...additions.map(migration_name=>({migration_name,checksum:'a'.repeat(64)}))];
  const live=sources.map(r=>({...r,finished_at:new Date('2026-11-27T00:00:00Z'),rolled_back_at:null}));
  return {predecessor,sources,live};
}
test('exact successor proof, independent of input order',()=>{
  const f=fixture();f.live.reverse();const r=verifySuccessorMigrations(f);assert.equal(r.appliedChecksumsMatched,184);assert.equal(r.predecessorChecksumsMatched,177);assert.equal(r.mayMutate,false);assert.equal(r.releaseAccepted,false);
});
for(const [name,mutate,code] of [
  ['missing migration',f=>f.live.pop(),'COUNT'],
  ['duplicate migration',f=>f.live[1]={...f.live[0]},'SHAPE'],
  ['modified historical SQL',f=>f.sources[0].checksum='f'.repeat(64),'PREDECESSOR_DRIFT'],
  ['unexpected new migration',f=>f.sources[183].migration_name='unexpected','ADDITIONS_DRIFT'],
  ['wrong applied checksum',f=>f.live[183].checksum='f'.repeat(64),'LEDGER_DRIFT'],
  ['unfinished migration',f=>f.live[183].finished_at=null,'UNFINISHED_MIGRATION'],
  ['rolled-back migration',f=>f.live[183].rolled_back_at=new Date(),'UNFINISHED_MIGRATION'],
  ['extra migration',f=>f.live.push({...f.live[0]}),'COUNT'],
])test(name,()=>{const f=fixture();mutate(f);assert.throws(()=>verifySuccessorMigrations(f),new RegExp('M6_SUCCESSOR_(MIGRATION_)?'+code));});
function adapter(f,wrong=false){
  const calls=[];const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'RepeatableRead');return fn({$executeRawUnsafe:async sql=>{calls.push(sql);},$queryRawUnsafe:async sql=>{calls.push(sql);return calls.length===2?[{db:wrong?'other':'rehearsal',role:'proto_runtime',ro:'on',isolation:'repeatable read'}]:f.live;}});}};
  return {calls,db};
}
test('read-only database observation uses identity before ledger',async()=>{const f=fixture(),{db,calls}=adapter(f);const r=await observeSuccessorMigrations({...f,db,expectedDatabase:'rehearsal',expectedRole:'proto_runtime'});assert.equal(r.appliedChecksumsMatched,184);assert.equal(calls[0],'SET TRANSACTION READ ONLY');assert.equal(calls.length,3);});
test('wrong database identity stops before ledger',async()=>{const f=fixture(),{db,calls}=adapter(f,true);await assert.rejects(observeSuccessorMigrations({...f,db,expectedDatabase:'rehearsal',expectedRole:'proto_runtime'}),/M6_SUCCESSOR_DB_IDENTITY/);assert.equal(calls.length,2);});
