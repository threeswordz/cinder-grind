import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,rm,realpath,rename,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSuccessorRecoveryAdapter,createNativeSuccessorRecoveryAdapter} from './m6-successor-recovery-adapter.mjs';
const candidate={sha:'a'.repeat(40),tree:'b'.repeat(40),syntheticOnly:true,rehearsalOnly:true,productionAuthorized:false};
const containerId='c'.repeat(64),password='d'.repeat(64),dbName='m6_successor_rehearsal';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,mode='ok'){
  const base=await realpath(await mkdtemp(join(tmpdir(),'m6-adapter-')));t.after(()=>rm(base,{recursive:true,force:true}));
  const sourceRoot=join(base,'src'),retainedRoot=join(base,'retained');await mkdir(sourceRoot,{mode:0o700});await mkdir(retainedRoot,{mode:0o700});
  for(const kind of ['documents','uploads','hrkeys']){await mkdir(join(retainedRoot,kind),{mode:0o700});await writeFile(join(retainedRoot,kind,'witness'),kind,{mode:0o600});}
  const stage=join(retainedRoot,'m6-successor-'+candidate.sha),root=join(stage,'recovery');
  const target={root,database:dbName,role:'proto_runtime',sha:candidate.sha,tree:candidate.tree};
  const calls=[];let catalog=mode==='existing'?'99:proto_runtime:true':'',dirty=false;
  const sourceDatabase={},db={$disconnect:async()=>calls.push(['disconnect'])};
  const command=async (bin,args,cwd)=>{assert.equal(bin,'podman');assert.equal(cwd,sourceRoot);assert.equal(args[0],'exec');assert.equal(args[1],containerId);calls.push(args.slice(2));
    if(args[2]==='createdb'){catalog=mode==='wrong-owner'?'73:other:true':'73:proto_runtime:true';return '';}
    assert.equal(args[2],'psql');const sql=args.at(-1),database=args[args.indexOf('-d')+1];
    if(sql.includes('pg_database')){assert.equal(database,'proto_a_01');return catalog;}
    assert.equal(database,dbName);return mode==='wrong-db'?'proto_a_01:proto_runtime':dbName+':proto_runtime';};
  const databaseStream=async (id,args,cwd,path,input)=>{assert.equal(id,containerId);assert.equal(cwd,sourceRoot);assert.equal(path,join(root,'postgresql.custom'));calls.push(args);
    if(!input){if(mode==='dump-failure')throw Error('dump failed');await writeFile(path,Buffer.alloc(2048,5),{flag:'wx',mode:0o600});}
    else if(mode==='dump-drift')await writeFile(path,Buffer.alloc(2048,6));};
  const inventory=async path=>{const b=await readFile(join(path,'witness'));return [['','directory'],['witness',b.length,sha(b)]];};
  const adapter=createSuccessorRecoveryAdapter({candidate,sourceRoot,retainedRoot,containerId,password,sourceDatabase,
    verifyRetained:async()=>{},verifyContainer:async id=>assert.equal(id,containerId),readCheckout:async()=>({...candidate,clean:!dirty}),inventory,command,databaseStream,
    makeClient:url=>{assert.equal(url,'postgresql://proto_runtime:'+password+'@127.0.0.1:55471/'+dbName+'?schema=public');return db;},
    migrateDeploy:async (cwd,url,path)=>{assert.equal(cwd,sourceRoot);assert.equal(path,stage);assert.ok(url.endsWith('/'+dbName+'?schema=public'));calls.push(['migrate',dbName]);if(mode==='migrate-failure')throw Error('migration failed');if(mode==='oid-drift')catalog='74:proto_runtime:true';}});
  const mutations=()=>calls.filter(c=>['pg_dump','createdb','pg_restore','migrate'].includes(c[0]));
  return {adapter,target,sourceDatabase,db,stage,root,calls,mutations,setDirty:()=>{dirty=true;}};
}
test('exclusive populated-recovery flow fixes all write destinations to separate rehearsal',async t=>{
  const f=await fixture(t);await f.adapter.verifyRetainedCustody({candidate,sourceDatabase:f.sourceDatabase});await f.adapter.claim(f.target);const r=await f.adapter.restore(f.target);
  assert.equal(r.db,f.db);assert.equal(r.dumpSha,sha(Buffer.alloc(2048,5)));await f.adapter.verifyRecoveryCustody(f.target,r.db);await f.adapter.migrate(f.target);await f.adapter.verifyRecoveryCustody(f.target,r.db);await f.adapter.close();
  assert.deepEqual(f.mutations(),[['pg_dump','-U','proto_runtime','-d','proto_a_01','--format=custom','--no-owner','--no-acl'],['createdb','-U','proto_runtime','--owner=proto_runtime','--template=template0',dbName],['pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','proto_runtime','-d',dbName],['migrate',dbName]]);assert.deepEqual(f.calls.at(-1),['disconnect']);
});
test('retained or foreign database target is refused before any command',async t=>{const f=await fixture(t);await assert.rejects(f.adapter.claim({...f.target,database:'proto_a_01'}),/ADAPTER_TARGET/);assert.deepEqual(f.calls,[]);});
test('wrong source client binding is refused before command',async t=>{const f=await fixture(t);await assert.rejects(f.adapter.verifyRetainedCustody({candidate,sourceDatabase:{}}),/RETAINED_BINDING/);assert.deepEqual(f.calls,[]);});
test('existing recovery database blocks exclusive claim',async t=>{const f=await fixture(t,'existing');await assert.rejects(f.adapter.claim(f.target),/PRIOR_ATTEMPT/);assert.deepEqual(f.mutations(),[]);});
test('existing stage blocks exclusive claim',async t=>{const f=await fixture(t);await mkdir(f.stage);await assert.rejects(f.adapter.claim(f.target),/PRIOR_ATTEMPT/);assert.deepEqual(f.mutations(),[]);});
test('changed checkout after claim blocks archive and database commands',async t=>{const f=await fixture(t);await f.adapter.claim(f.target);f.setDirty();await assert.rejects(f.adapter.restore(f.target),/SOURCE_DRIFT/);assert.deepEqual(f.mutations(),[]);});
test('replaced stage inode blocks recovery',async t=>{const f=await fixture(t);await f.adapter.claim(f.target);await rename(f.stage,f.stage+'-old');await mkdir(f.stage,{mode:0o700});await assert.rejects(f.adapter.restore(f.target),/STAGE_DRIFT/);assert.deepEqual(f.mutations(),[]);});
test('symlink stage fails closed',async t=>{const f=await fixture(t);await f.adapter.claim(f.target);await rename(f.stage,f.stage+'-old');await symlink(f.stage+'-old',f.stage);await assert.rejects(f.adapter.restore(f.target),/ADAPTER_DIRECTORY/);assert.deepEqual(f.mutations(),[]);});
for(const [mode,code,expected] of [['dump-failure','dump failed',['pg_dump']],['wrong-owner','DB_CUSTODY',['pg_dump','createdb']],['wrong-db','DB_CUSTODY',['pg_dump','createdb']],['dump-drift','ARCHIVE_DRIFT',['pg_dump','createdb','pg_restore']]])test('restore failure stops without replay: '+mode,async t=>{const f=await fixture(t,mode);await f.adapter.claim(f.target);await assert.rejects(f.adapter.restore(f.target),new RegExp(code));assert.deepEqual(f.mutations().map(c=>c[0]),expected);await assert.rejects(f.adapter.restore(f.target),/RESTORE_ORDER/);});
for(const [mode,code] of [['migrate-failure','migration failed'],['oid-drift','DB_CUSTODY']])test('migration failure or replacement cannot be retried: '+mode,async t=>{const f=await fixture(t,mode);await f.adapter.claim(f.target);const r=await f.adapter.restore(f.target);await assert.rejects(f.adapter.migrate(f.target),new RegExp(code));await assert.rejects(f.adapter.migrate(f.target),/MIGRATE_ORDER/);await assert.rejects(f.adapter.verifyRecoveryCustody(f.target,r.db),/ADAPTER_CLIENT/);assert.equal(f.mutations().filter(c=>c[0]==='migrate').length,1);});
test('wrong recovery client cannot use ownership proof',async t=>{const f=await fixture(t);await f.adapter.claim(f.target);await f.adapter.restore(f.target);await assert.rejects(f.adapter.verifyRecoveryCustody(f.target,{}),/ADAPTER_CLIENT/);});
test('native adapter cannot be constructed in this non-Mac test environment',async()=>{if(process.platform!=='darwin')await assert.rejects(createNativeSuccessorRecoveryAdapter({}),/MAC_REQUIRED/);});
