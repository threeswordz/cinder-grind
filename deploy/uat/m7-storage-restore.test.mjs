import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,readFile,readdir,symlink,link,chmod,rm,realpath,rename,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createM7StorageRestore} from './m7-storage-restore.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'m7-storage-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const captureRoot=join(root,'capture'),target=join(root,'target');await mkdir(captureRoot,{mode:0o700});await mkdir(target,{mode:0o700});
  const expectedInventories={},storage={},ids={};
  for(const k of ['documents','uploads','hrkeys']){
    const p=join(captureRoot,k);await mkdir(p,{mode:0o700});await mkdir(join(p,'nested'),{mode:0o700});
    const b=Buffer.from('private-'+k);await writeFile(join(p,'nested','file'),b,{mode:0o600});await writeFile(join(p,'empty'),Buffer.alloc(0),{mode:0o600});
    expectedInventories[k]=[['','directory'],['empty',0,hash('')],['nested','directory'],['nested/file',b.length,hash(b)]];
    storage[k]=join(target,k);await mkdir(storage[k],{mode:0o700});ids[k]=await lstat(storage[k]);
  }
  let checks=0;const claim={plan:{storage},verifyPaths:async()=>{for(const [k,p] of Object.entries(storage)){const s=await lstat(p);assert.equal(s.ino,ids[k].ino);assert.equal(s.dev,ids[k].dev);}}};
  return {root,captureRoot,claim,expectedInventories,reverifyCapture:async()=>{checks++;},checks:()=>checks};
}
test('copies all three complete private trees, including empty files, and refuses replay',async t=>{
  const f=await fixture(t),run=createM7StorageRestore(f),r=await run();assert.equal(r.rootsVerified,3);assert.equal(r.milestone7Accepted,false);assert.equal(f.checks(),2);
  for(const k of Object.keys(f.claim.plan.storage)){assert.equal(await readFile(join(f.claim.plan.storage[k],'nested/file'),'utf8'),'private-'+k);assert.equal((await lstat(join(f.claim.plan.storage[k],'empty'))).size,0);assert.equal((await lstat(join(f.claim.plan.storage[k],'nested/file'))).mode&0o777,0o600);assert.equal(await readFile(join(f.captureRoot,k,'nested/file'),'utf8'),'private-'+k);}
  await assert.rejects(run(),/ALREADY_ATTEMPTED/);
});
test('preflights every target before writing anything and preserves preexisting bytes',async t=>{const f=await fixture(t),p=join(f.claim.plan.storage.hrkeys,'existing');await writeFile(p,'keep',{mode:0o600});await assert.rejects(createM7StorageRestore(f)(),/TARGET_NOT_EMPTY/);assert.deepEqual(await readdir(f.claim.plan.storage.documents),[]);assert.equal(await readFile(p,'utf8'),'keep');});
test('source byte drift, symlink, hardlink and loose permissions fail before writes',async t=>{for(const fault of ['bytes','symlink','hardlink','mode']){const f=await fixture(t),p=join(f.captureRoot,'hrkeys/nested/file');if(fault==='bytes')await writeFile(p,'changed');if(fault==='mode')await chmod(p,0o644);if(fault==='symlink'||fault==='hardlink'){await rm(p);await (fault==='symlink'?symlink:link)(join(f.captureRoot,'documents/nested/file'),p);}await assert.rejects(createM7StorageRestore(f)());assert.deepEqual(await readdir(f.claim.plan.storage.documents),[]);}});
test('rejects source aliases and unsafe inventories before writes',async t=>{const f=await fixture(t),p=f.claim.plan.storage.documents;f.claim.plan.storage.documents=join(f.captureRoot,'documents');f.claim.verifyPaths=async()=>{};await assert.rejects(createM7StorageRestore(f)(),/ROOT_ALIAS/);f.claim.plan.storage.documents=p;f.expectedInventories.documents.push(['../unsafe',1,hash('a')]);assert.throws(()=>createM7StorageRestore(f));});
test('late existing destination is never overwritten and failed attempt cannot retry',async t=>{const f=await fixture(t),p=join(f.claim.plan.storage.documents,'empty'),check=f.claim.verifyPaths;let n=0;f.claim.verifyPaths=async()=>{await check();if(++n===2)await writeFile(p,'keep',{mode:0o600});};const run=createM7StorageRestore(f);await assert.rejects(run(),/EEXIST/);assert.equal(await readFile(p,'utf8'),'keep');await assert.rejects(run(),/ALREADY_ATTEMPTED/);});
test('target root substitution is refused and outside directory stays untouched',async t=>{const f=await fixture(t),p=f.claim.plan.storage.documents,other=join(f.root,'other');await mkdir(other,{mode:0o700});const check=f.claim.verifyPaths;let n=0;f.claim.verifyPaths=async()=>{if(++n===2){await rename(p,p+'-original');await symlink(other,p);}await check();};await assert.rejects(createM7StorageRestore(f)());assert.deepEqual(await readdir(other),[]);});
test('final capture recheck failure blocks receipt and retains copied evidence',async t=>{const f=await fixture(t);let n=0;f.reverifyCapture=async()=>{if(++n===2)throw Error('M7_TEST_FINAL_CAPTURE_DRIFT');};const run=createM7StorageRestore(f);await assert.rejects(run(),/M7_TEST_FINAL_CAPTURE_DRIFT/);assert.equal(await readFile(join(f.claim.plan.storage.hrkeys,'nested/file'),'utf8'),'private-hrkeys');await assert.rejects(run(),/ALREADY_ATTEMPTED/);});
