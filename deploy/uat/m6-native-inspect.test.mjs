import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,realpath,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {discoverBaselineFiles,readAdmissionDatabase,inspectAdmission} from './m6-native-inspect.mjs';
function fixtureDb({sessions=0,count=177,role='proto_runtime',ro='on',rolled=false}={}){
 const calls=[];return {calls,async $transaction(fn,opts){assert.equal(opts.isolationLevel,'RepeatableRead');return fn({async $executeRawUnsafe(s){assert.equal(s,'SET TRANSACTION READ ONLY');calls.push(s);},async $queryRawUnsafe(s){calls.push(s);return s.includes('current_database')?[{db:'proto_a_01',role,ro,isolation:'repeatable read'}]:Array.from({length:count},(_,i)=>({migration_name:'m'+i,checksum:'a'.repeat(64),finished_at:'date',rolled_back_at:rolled?'date':null}));},userSession:{async count(q){assert.deepEqual(q,{where:{revokedAt:null}});return sessions;}}});}};
}
test('read-only transaction verifies migration count and sessions',async()=>{const db=fixtureDb();assert.equal((await readAdmissionDatabase(db)).length,177);assert.equal(db.calls.length,3);});
for(const opts of [{sessions:1},{count:176},{role:'wrong'},{ro:'off'},{rolled:true}])test('refuse database drift '+JSON.stringify(opts),async()=>assert.rejects(readAdmissionDatabase(fixtureDb(opts))));
function admission(){const db=fixtureDb();let observations=0;return {db,root:'/fixture',application:'/fixture/app',observeRuntime:async()=>({ok:++observations>0}),verifyRuntime:r=>assert.equal(r.ok,true),readInventory:async p=>[[p,'directory']]};}
test('admission checks both observations without claiming historical proof',async()=>{const a=admission(),r=await inspectAdmission(a);assert.equal(r.historicalBaselineVerified,false);assert.equal(r.mayMutate,false);assert.equal(a.db.calls.length,6);});
test('refuses inventory drift',async()=>{const a=admission();let n=0;a.readInventory=async p=>[[p,++n]];await assert.rejects(inspectAdmission(a),{message:'M6_NATIVE_OBSERVATION_DRIFT'});});
test('refuses process drift after captures',async()=>{const a=admission();let n=0;a.observeRuntime=async()=>({ok:++n===1});await assert.rejects(inspectAdmission(a));});
async function files(t){const root=await realpath(await mkdtemp(join(tmpdir(),'m6-native-')));t.after(()=>rm(root,{recursive:true,force:true}));const stage=join(root,'m4-upgrade-9417f07c'),cut=join(stage,'cutover');await mkdir(cut,{recursive:true,mode:0o700});return {root,cut};}
test('schema discovery emits only keys and filenames, never values',async t=>{const {root,cut}=await files(t);await writeFile(join(cut,'snapshot-private.json'),JSON.stringify({rows:[{secret:'sensitive-value'}],checksum:'sensitive-hash'}),{mode:0o600});await writeFile(join(cut,'hr-secret.json'),'ignored',{mode:0o600});const r=await discoverBaselineFiles(root);assert.deepEqual(r,[{path:'cutover/snapshot-private.json',shape:'object',fields:['checksum','rows']}]);assert.ok(!JSON.stringify(r).includes('sensitive'));});
test('schema discovery refuses symlink',async t=>{const {root,cut}=await files(t);await writeFile(join(cut,'hidden.json'),'{}',{mode:0o600});await symlink(join(cut,'hidden.json'),join(cut,'snapshot-private.json'));await assert.rejects(discoverBaselineFiles(root),{message:'M6_NATIVE_SCHEMA_FILE_INVALID'});});
