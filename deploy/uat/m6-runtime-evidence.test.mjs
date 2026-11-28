import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink,link,chmod,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inventory,readDatabaseEvidence,verifyDatabaseEvidence,verifyRuntimePair,inspectEvidence} from './m6-runtime-evidence.mjs';
function client({raw='{"amount":9007199254740993}',sessions=0,expired=0,wrong=false,tables=['ledger'],ro='on'}={}){
  const calls=[];
  const tx={async $executeRawUnsafe(sql){calls.push(sql);assert.equal(sql,'SET TRANSACTION READ ONLY');},async $queryRawUnsafe(sql){calls.push(sql);if(sql.includes('current_database'))return [{db:wrong?'production':'proto_a_01',role:'proto_runtime',ro,isolation:'repeatable read'}];if(sql.includes('FROM public.user_sessions'))return [{unrevoked:BigInt(sessions+expired),active:BigInt(sessions),expired:BigInt(expired)}];if(sql.includes('pg_tables'))return tables.map(tablename=>({tablename}));assert.equal(sql,'SELECT row_to_json(t)::text AS raw FROM public."ledger" AS t');return [{raw}];}};
  return {calls,async $transaction(fn,opts){assert.equal(opts.isolationLevel,'RepeatableRead');return fn(tx);}};
}
async function fixture(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'m6-evidence-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const application=join(root,'app'),nodePath='/usr/bin/node',uid=501;
  for(const dir of ['documents','uploads','hrkeys','app/apps/api/dist','app/apps/web/dist'])await mkdir(join(root,dir),{recursive:true,mode:0o700});
  for(const file of ['documents/a','uploads/a','hrkeys/a','app/apps/api/dist/main.js','app/apps/web/dist/index.html'])await writeFile(join(root,file),'fixture',{mode:0o600});
  const runtime={},observed={health:{status:'ok',database:'ok',documentStorage:'ok'}};
  for(const [kind,pid,port,path] of [['api',100,33071,'apps/api/dist/main.js'],['web',101,44171,'deploy/uat/serve-web.mjs']]){
    const entry=join(application,path);runtime[kind]={pid,port,entry,born:'same-start'};observed[kind]={pid,born:'same-start',uid,command:nodePath+' '+entry,listenerPids:[pid],listenAddresses:['127.0.0.1:'+port]};
  }
  const db=client(),baseline={runtime,database:await readDatabaseEvidence(db,['ledger']),files:{},artifacts:{}};
  for(const k of ['documents','uploads','hrkeys'])baseline.files[k]=await inventory(join(root,k));
  for(const k of ['api','web'])baseline.artifacts[k]=await inventory(join(application,'apps',k,'dist'),{privateRoot:false});
  return {root,application,nodePath,uid,baseline,db,observed,observeRuntime:async()=>structuredClone(observed)};
}
test('combined core checks real protected and compiled bytes and read-only DB contract twice',async t=>{const f=await fixture(t);const p=await inspectEvidence(f);assert.equal(p.normalizedEvidenceMatched,true);assert.equal(p.mayMutate,false);assert.equal(p.liveRuntimeVerified,false);assert.equal(f.db.calls.filter(c=>c==='SET TRANSACTION READ ONLY').length,3);});
for(const [file,code] of [['documents/a','M6_PROTECTED_FILE_DRIFT'],['uploads/a','M6_PROTECTED_FILE_DRIFT'],['hrkeys/a','M6_PROTECTED_FILE_DRIFT'],['app/apps/api/dist/main.js','M6_COMPILED_ARTIFACT_DRIFT'],['app/apps/web/dist/index.html','M6_COMPILED_ARTIFACT_DRIFT']])test('reject changed '+file,async t=>{const f=await fixture(t);await writeFile(join(f.root,file),'changed');await assert.rejects(inspectEvidence(f),{message:code});});
for(const opts of [{sessions:1},{wrong:true},{ro:'off'},{tables:['ledger','unexpected']}])test('reject database '+JSON.stringify(opts),async()=>{await assert.rejects(readDatabaseEvidence(client(opts),['ledger']));});
test('rejects exact big integer drift without JS rounding',async()=>{const a=await readDatabaseEvidence(client(),['ledger']),b=await readDatabaseEvidence(client({raw:'{"amount":9007199254740992}'}),['ledger']);assert.throws(()=>verifyDatabaseEvidence(a,b),{message:'M6_DB_ROW_DRIFT'});});
test('reject unsafe SQL identifiers before database access',async()=>{const db=client();await assert.rejects(readDatabaseEvidence(db,['ledger; DROP TABLE ledger']),{message:'M6_DB_TABLE_BASELINE_INVALID'});assert.equal(db.calls.length,0);});
for(const delta of [{pid:123},{born:'different'},{uid:0},{command:'bad'},{listenerPids:[100,200]},{listenAddresses:['*:33071']}])test('reject process drift '+JSON.stringify(delta),async t=>{const f=await fixture(t);Object.assign(f.observed.api,delta);assert.throws(()=>verifyRuntimePair(f.baseline.runtime,f.observed,f.application,f.nodePath,f.uid),{message:'M6_RUNTIME_PROCESS_DRIFT'});});
test('reject symlink, hardlink and writable private tree',async t=>{const f=await fixture(t),dir=join(f.root,'documents');await symlink(join(dir,'a'),join(dir,'b'));await assert.rejects(inventory(dir));await rm(join(dir,'b'));await link(join(dir,'a'),join(dir,'b'));await assert.rejects(inventory(dir));await rm(join(dir,'b'));await chmod(dir,0o755);await assert.rejects(inventory(dir));});
test('reject runtime drift after both captures',async t=>{const f=await fixture(t);let n=0;f.observeRuntime=async()=>{const o=structuredClone(f.observed);if(++n===2)o.api.born='changed';return o;};await assert.rejects(inspectEvidence(f),{message:'M6_RUNTIME_PROCESS_DRIFT'});});

test('expired-only session history does not block read-only snapshot',async()=>assert.ok((await readDatabaseEvidence(client({expired:1}),['ledger'])).ledger));
