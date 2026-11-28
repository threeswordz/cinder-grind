import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runSuccessorUpgrade} from './m6-successor-upgrade-operator.mjs';
import {readSuccessorSources} from './m6-successor-migrations.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const additions=['20261127041000_ss16_movement_correction_request','20261127050000_ss16_unposted_cancellation_pin','20261127060000_ss16_controlled_submitted_cancellation','20261127070000_ss16_terminal_controlled_cancellation','20261127080000_ss16_plan_cancel_decision_proof','20261127150000_ss16_reciprocal_decision_integrity','20261127160000_ss16_terminal_outcome_ledger_proof'];
const candidate={sha:'a'.repeat(40),tree:'b'.repeat(40),syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false};
const sessionCounts={unrevoked:0n,active:0n,expired:0n};
function db(name,state,calls){return {$transaction:async(fn,options)=>{
  assert.equal(options.isolationLevel,'RepeatableRead');let ro=false;
  return fn({$executeRawUnsafe:async sql=>{assert.equal(sql,'SET TRANSACTION READ ONLY');ro=true;},$queryRawUnsafe:async sql=>{
    assert.equal(ro,true);calls.push(name+':'+sql);
    if(sql.includes('current_database()'))return [{db:name,role:'proto_runtime',ro:'on',isolation:'repeatable read'}];
    if(sql.includes('COUNT(*) FILTER'))return [state.sessions??sessionCounts];
    if(sql.startsWith('SELECT migration_name,checksum'))return state.ledger;
    if(sql.startsWith('SELECT migration_name,row_to_json'))return state.ledger.map(r=>({migration_name:r.migration_name,raw:JSON.stringify(r)}));
    if(sql.includes('pg_catalog.pg_tables'))return Object.keys(state.rows).sort().map(tablename=>({tablename}));
    const table=sql.match(/public\."([a-z_]+)"/)[1];
    return (table==='_prisma_migrations'?state.ledger.map(r=>JSON.stringify(r)):state.rows[table]).map(raw=>({raw}));
  }});
}};}
async function fixture(t,mode='ok'){
  const base=await realpath(await mkdtemp(join(tmpdir(),'m6-successor-')));t.after(()=>rm(base,{recursive:true,force:true}));
  const sourceRoot=join(base,'source'),retainedRoot=join(base,'retained');
  const dir=join(sourceRoot,'apps/api/prisma/migrations');await mkdir(dir,{recursive:true,mode:0o700});await mkdir(retainedRoot,{mode:0o700});
  const old=Array.from({length:177},(_,i)=>'old_'+String(i).padStart(3,'0'));
  for(const name of [...old,...additions]){await mkdir(join(dir,name),{mode:0o700});await writeFile(join(dir,name,'migration.sql'),'-- '+name+'\n',{mode:0o600});}
  const all=(await readSuccessorSources(sourceRoot)).sort((a,b)=>a.migration_name<b.migration_name?-1:1);
  const predecessor=all.filter(r=>old.includes(r.migration_name));
  const applied=rows=>rows.map(r=>({...r,finished_at:new Date('2026-11-27T00:00:00Z'),rolled_back_at:null}));
  const rows={_prisma_migrations:[],user_sessions:[],documents:['{"id":"a","amount":9007199254740993}']};
  const sourceState={ledger:applied(predecessor),rows:structuredClone(rows)},recoveryState={ledger:applied(predecessor),rows:structuredClone(rows)};
  const calls=[],steps=[];const sourceDatabase=db('proto_a_01',sourceState,calls);
  const recovery=db(mode==='wrong-db'?'proto_a_01':'m6_successor_rehearsal',recoveryState,calls);
  for(const kind of ['documents','uploads','hrkeys']){await mkdir(join(retainedRoot,kind),{mode:0o700});await writeFile(join(retainedRoot,kind,'witness'),'original '+kind,{mode:0o600});}
  const readInventory=async path=>{const bytes=await readFile(join(path,'witness'));return [['','directory'],['witness',bytes.length,hash(bytes)]];};
  const dump=Buffer.alloc(2048,4);
  const adapter={verifyRetainedCustody:async()=>{},verifyRecoveryCustody:async(target,client)=>{assert.equal(target.database,'m6_successor_rehearsal');assert.equal(client,recovery);},claim:async target=>{steps.push('claim');assert.equal(target.sha,candidate.sha);await mkdir(join(retainedRoot,'m6-successor-'+candidate.sha),{mode:0o700});},restore:async target=>{
    steps.push('restore');await mkdir(target.root,{mode:0o700});for(const kind of ['documents','uploads','hrkeys']){await mkdir(join(target.root,kind),{mode:0o700});await writeFile(join(target.root,kind,'witness'),await readFile(join(retainedRoot,kind,'witness')),{mode:0o600});}await writeFile(join(target.root,'postgresql.custom'),dump,{mode:0o600});
    if(mode==='restore-drift')recoveryState.rows.documents=['{"id":"wrong"}'];
    return {db:recovery,dumpSha:hash(dump)};
  },migrate:async target=>{
    steps.push('migrate');recoveryState.ledger=applied(all);recoveryState.rows.movement_correction_requests=[];
    if(mode==='ledger-drift')recoveryState.ledger[0].checksum='f'.repeat(64);
    if(mode==='old-ledger-drift')recoveryState.ledger.find(r=>r.migration_name===predecessor[0].migration_name).finished_at=new Date('2026-11-28T00:00:00Z');
    if(mode==='row-drift')recoveryState.rows.documents=['{"id":"wrong"}'];
    if(mode==='new-row')recoveryState.rows.movement_correction_requests=['{"id":"unexpected"}'];
    if(mode==='dump-drift')await writeFile(join(target.root,'postgresql.custom'),Buffer.alloc(2048,9));
    if(mode==='key-drift')await writeFile(join(target.root,'hrkeys','witness'),'changed');
    if(mode==='retained-drift')sourceState.rows.documents=[];
    if(mode==='active')recoveryState.sessions={unrevoked:1n,active:1n,expired:0n};
  }};
  const readCheckout=async()=>({...candidate,clean:mode!=='dirty'});
  const input={candidate,sourceRoot,retainedRoot,predecessor,sourceDatabase,adapter,readCheckout,readInventory};
  if(mode==='source-drift')await writeFile(join(dir,old[0],'migration.sql'),'changed');
  if(mode==='symlink'){await rm(join(dir,old[0],'migration.sql'));await symlink(join(dir,old[1],'migration.sql'),join(dir,old[0],'migration.sql'));}
  return {input,steps,calls};
}
test('pinned rehearsal integrates actual filesystem migration scan, restore, seven added migrations and preserved recovery copy',async t=>{
  const {input,steps}=await fixture(t);const out=await runSuccessorUpgrade(input);assert.deepEqual(steps,['claim','restore','migrate']);assert.equal(out.migrationProof.appliedChecksumsMatched,184);assert.equal(out.historicalTablesPreserved,2);assert.equal(out.recoveryCopyUnchanged,true);assert.equal(out.retainedDatabaseAndFilesUnchanged,true);assert.equal(out.cutoverPerformed,false);assert.equal(out.productionAuthorized,false);assert.equal(out.milestone6Accepted,false);
});
for(const [mode,pattern,expected] of [
  ['dirty','CHECKOUT_DRIFT',[]],['source-drift','SOURCE_DRIFT',[]],['symlink','SOURCE_PATH',[]],
  ['wrong-db','DB_IDENTITY',['claim','restore']],['restore-drift','RESTORE_DRIFT',['claim','restore']],
  ['ledger-drift','LEDGER_DRIFT',['claim','restore','migrate']],['old-ledger-drift','HISTORICAL_LEDGER_ROW_DRIFT',['claim','restore','migrate']],
  ['row-drift','HISTORICAL_ROW_DRIFT',['claim','restore','migrate']],['new-row','NEW_TABLE_NOT_EMPTY',['claim','restore','migrate']],
  ['dump-drift','DUMP_DRIFT',['claim','restore','migrate']],['key-drift','HRKEYS_DRIFT',['claim','restore','migrate']],
  ['retained-drift','RETAINED_DRIFT',['claim','restore','migrate']],['active','ACTIVE_SESSIONS',['claim','restore','migrate']],
])test('fail closed: '+mode,async t=>{const {input,steps}=await fixture(t,mode);await assert.rejects(runSuccessorUpgrade(input),new RegExp(pattern));assert.deepEqual(steps,expected);});
test('existing attempt cannot be silently reused',async t=>{const {input,steps}=await fixture(t);await mkdir(join(input.retainedRoot,'m6-successor-'+candidate.sha));await assert.rejects(runSuccessorUpgrade(input),/PRIOR_ATTEMPT/);assert.deepEqual(steps,[]);});
