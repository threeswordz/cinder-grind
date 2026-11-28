import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectCompiledRebuild,readHistoricalRowEvidence} from './m6-integrated-evidence.mjs';
async function fixture(t){
 const base=await realpath(await mkdtemp(join(tmpdir(),'m6-rebuild-')));t.after(()=>rm(base,{recursive:true,force:true}));
 const root=join(base,'runtime'),application=join(root,'app'),rebuild=join(base,'rebuild');
 for(const p of [application,rebuild])for(const [k,f] of [['api','main.js'],['web','index.html']]){const dir=join(p,'apps',k,'dist');await mkdir(dir,{recursive:true});await writeFile(join(dir,f),'compiled fixture');}
 const readCheckout=async()=>({sha:'9417f07c609dbc091b5bbe2e09071c5e2c316459',tree:'bfcab1977ef80b8d7becf00d0056e892250052aa',clean:true});
 const readInventory=async p=>{const f=p.includes('/api/')?'main.js':'index.html';const b=await import('node:fs/promises').then(x=>x.readFile(join(p,f)));return [['','directory'],[f,b.length,createHash('sha256').update(b).digest('hex')]];};
 return {base,root,application,rebuild,readCheckout,readInventory};
}
test('matches independently located artifact bytes but never claims historical manifest',async t=>{const f=await fixture(t);assert.deepEqual(await inspectCompiledRebuild(f),{exactSourceRebuildCompared:true,apiRebuildBytesMatched:true,webRebuildBytesMatched:true,compiledRebuildBytesVerified:true,historicalCompiledArtifactBytesVerified:false});});
test('detects different compiled bytes',async t=>{const f=await fixture(t);await writeFile(join(f.rebuild,'apps/web/dist/index.html'),'different');const r=await inspectCompiledRebuild(f);assert.equal(r.apiRebuildBytesMatched,true);assert.equal(r.webRebuildBytesMatched,false);assert.equal(r.compiledRebuildBytesVerified,false);});
test('rejects same or nested artifact root',async t=>{const f=await fixture(t);await assert.rejects(inspectCompiledRebuild({...f,rebuild:f.application}),{safeCode:'M6_REBUILD_NOT_ISOLATED'});await assert.rejects(inspectCompiledRebuild({...f,rebuild:join(f.root,'candidate')}),{safeCode:'M6_REBUILD_NOT_ISOLATED'});});
test('rejects symlinked rebuild path',async t=>{const f=await fixture(t);const alias=join(f.base,'alias');await symlink(f.rebuild,alias);await assert.rejects(inspectCompiledRebuild({...f,rebuild:alias}),{safeCode:'M6_REBUILD_PATH_ALIAS'});});
test('rejects changed checkout identity',async t=>{const f=await fixture(t);f.readCheckout=async()=>({sha:'0'.repeat(40),clean:true});await assert.rejects(inspectCompiledRebuild(f),{safeCode:'M6_REBUILD_SOURCE_IDENTITY_INVALID'});});
test('historical database admission rejects non-read-only or wrong target before comparison',async()=>{let calls=[];const db={$transaction:async(fn,opts)=>{assert.equal(opts.isolationLevel,'RepeatableRead');return fn({$executeRawUnsafe:async sql=>calls.push(sql),$queryRawUnsafe:async()=>[{db:'wrong',role:'proto_runtime',ro:'on',isolation:'repeatable read'}]});}};await assert.rejects(readHistoricalRowEvidence({db,requireNoLiveSessions:()=>{throw Error('must not reach');}}),{safeCode:'M6_HISTORICAL_ROW_DB_IDENTITY_INVALID'});assert.deepEqual(calls,['SET TRANSACTION READ ONLY']);});
