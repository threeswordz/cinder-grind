import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,realpath,writeFile,readFile,rm,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createM7PairedCapture} from './m7-paired-capture.mjs';
import {bindM7Capture} from './m7-capture-contract.mjs';
import {verifyM7PairedManifest} from './m7-paired-backup.mjs';
import {quiescentSourceProcess} from './m7-source-process.mjs';
const h=b=>createHash('sha256').update(b).digest('hex'),kinds=['documents','uploads','hrkeys'];
async function fixture(t){
 const base=await realpath(await mkdtemp(join(tmpdir(),'m7-capture-')));t.after(()=>rm(base,{recursive:true,force:true}));
 const [parent,runtime,application]=['output','runtime','application'].map(p=>join(base,p));for(const p of [parent,runtime,application])await mkdir(p,{mode:0o700});const sourceRoot=join(runtime,'terminal');await mkdir(sourceRoot,{mode:0o700});
 const expectedInventories={};for(const k of kinds){const dir=join(sourceRoot,k);await mkdir(dir,{mode:0o700});await writeFile(join(dir,'f'),k,{mode:0o600,flag:'wx'});expectedInventories[k]=[['f',Buffer.byteLength(k),h(k)],['','directory']];}
 const anchor={applicationSha:'a'.repeat(40),applicationTree:'b'.repeat(40),terminalSnapshotSha256:'c'.repeat(64),database:'m6_successor_rehearsal'};
 const state={applicationSha:anchor.applicationSha,tree:anchor.applicationTree,rowsSha:anchor.terminalSnapshotSha256,schemaSha:'d'.repeat(64),sourcePreserved:true,quiescent:true,sourceDatabase:{database:anchor.database,role:'proto_runtime',oid:10,cluster:'123'},sourceProcess:quiescentSourceProcess({api:{port:33071,pid:111,born:'a'},web:{port:44171,pid:112,born:'b'}}),expectedInventories,storageIdentitySha256:'e'.repeat(64)};
 const calls=[];const args={parent,runId:'abcdef012345',sourceRoot,protectedRoots:[runtime,application],anchor,observe:async()=>structuredClone(state),dump:async({archive,sourceDatabase})=>{assert.deepEqual(sourceDatabase,state.sourceDatabase);calls.push('dump');await writeFile(archive,Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(2048)]),{mode:0o600,flag:'wx'});}};
 return {args,state,calls,root:join(parent,'m7-capture-'+args.runId)};
}
test('real private file copy, manifest sealing and capture-contract binding with synthetic dump',async t=>{const f=await fixture(t),run=createM7PairedCapture(f.args),r=await run();assert.equal(r.status,'M7_PAIRED_CAPTURE_SET_SEALED');assert.equal(r.nativeCaptureVerified,false);assert.equal(r.milestone7Accepted,false);assert.deepEqual(f.calls,['dump']);const b=await bindM7Capture({...r,verifyManifest:verifyM7PairedManifest});assert.equal(b.capture().sourceProcess.mode,'quiescent');for(const k of kinds){assert.equal(await readFile(join(f.root,k,'f'),'utf8'),k);assert.equal(await readFile(join(f.args.sourceRoot,k,'f'),'utf8'),k);}await assert.rejects(run(),/ALREADY_ATTEMPTED/);await assert.rejects(createM7PairedCapture(f.args)(),{code:'EEXIST'});assert.equal(await verifyM7PairedManifest(r.manifestArgs),true);});
test('wrong source pin or nonquiescent source blocks before target claim',async t=>{const f=await fixture(t);for(const key of ['rowsSha','quiescent','sourcePreserved']){const old=f.state[key];f.state[key]=false;await assert.rejects(createM7PairedCapture(f.args)(),/M7_CAPTURE_SOURCE/);f.state[key]=old;}assert.deepEqual(await readdir(f.args.parent),[]);assert.deepEqual(f.calls,[]);});
test('drift after dump retains partial capture, refuses manifest and replay',async t=>{const f=await fixture(t),original=f.args.dump;f.args.dump=async a=>{await original(a);f.state.rowsSha='f'.repeat(64);};const run=createM7PairedCapture(f.args);await assert.rejects(run(),/M7_CAPTURE_SOURCE/);assert.equal((await readdir(f.root)).includes('m7-paired-manifest.json'),false);await assert.rejects(run(),/ALREADY_ATTEMPTED/);assert.deepEqual(f.calls,['dump']);});
test('source symlink or altered bytes fails before dump; no overwrite or retry',async t=>{const f=await fixture(t),p=join(f.args.sourceRoot,'documents','f');await rm(p);await symlink(join(f.args.sourceRoot,'uploads','f'),p);const run=createM7PairedCapture(f.args);await assert.rejects(run(),/M7_STORAGE_/);assert.deepEqual(f.calls,[]);await assert.rejects(run(),/ALREADY_ATTEMPTED/);});
test('invalid dump magic and occupied capture path fail closed',async t=>{const f=await fixture(t);f.args.dump=async({archive})=>writeFile(archive,Buffer.alloc(2048),{mode:0o600,flag:'wx'});await assert.rejects(createM7PairedCapture(f.args)(),/DUMP_FORMAT/);await assert.rejects(createM7PairedCapture(f.args)(),{code:'EEXIST'});});
test('capture parent cannot alias protected source or application',async t=>{const f=await fixture(t);await assert.rejects(createM7PairedCapture({...f.args,parent:f.args.sourceRoot})(),/OVERLAP/);await assert.rejects(createM7PairedCapture({...f.args,parent:f.args.protectedRoots[1]})(),/OVERLAP/);assert.deepEqual(f.calls,[]);});
