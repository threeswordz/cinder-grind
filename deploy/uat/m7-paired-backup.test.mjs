import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,writeFile,chmod,rm,symlink,link,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareM7PairedManifest,verifyM7PairedManifest} from './m7-paired-backup.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'m7-paired-')));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const expectedInventories={};
  for(const k of ['documents','uploads','hrkeys']){
    await mkdir(join(root,k),{mode:0o700});
    const bytes=Buffer.from(`fixture-${k}`);
    await writeFile(join(root,k,'file'),bytes,{mode:0o600});
    expectedInventories[k]=[['','directory'],['file',bytes.length,sha(bytes)]];
  }
  const dump=Buffer.concat([Buffer.from('PGDMP'),Buffer.alloc(2048,7)]);
  await writeFile(join(root,'postgresql.custom'),dump,{mode:0o600});
  const evidence={applicationSha:'a'.repeat(40),databaseIdentitySha256:'b'.repeat(64),storageIdentitySha256:'c'.repeat(64),quiescenceReceiptSha256:'d'.repeat(64),beforeStateSha256:'e'.repeat(64),afterStateSha256:'e'.repeat(64),dumpSha256:sha(dump)};
  return {root,evidence,expectedInventories};
}
test('private paired fixture seals and verifies without acceptance or capture claim',async t=>{
  const a=await fixture(t),r=await prepareM7PairedManifest(a);
  assert.equal(r.actualCaptureVerified,false);assert.equal(r.milestone7Accepted,false);assert.equal(r.productionAuthorized,false);
  assert.equal(await verifyM7PairedManifest({...a,...r}),true);
  const p=join(a.root,'m7-paired-manifest.json'),before=await readFile(p);
  await assert.rejects(prepareM7PairedManifest(a));assert.deepEqual(await readFile(p),before);
});
for(const k of ['documents','uploads','hrkeys'])test(`rejects changed ${k} bytes`,async t=>{
  const a=await fixture(t),r=await prepareM7PairedManifest(a);
  await writeFile(join(a.root,k,'file'),'tampered');await assert.rejects(verifyM7PairedManifest({...a,...r}));
});
test('rejects modified dump',async t=>{const a=await fixture(t),r=await prepareM7PairedManifest(a);await writeFile(join(a.root,'postgresql.custom'),'PGDMP changed');await assert.rejects(verifyM7PairedManifest({...a,...r}));});
test('rejects noncustom dump even with matching digest',async t=>{const a=await fixture(t),b=Buffer.alloc(2048);await writeFile(join(a.root,'postgresql.custom'),b);a.evidence.dumpSha256=sha(b);await assert.rejects(prepareM7PairedManifest(a),/M7_BACKUP_DUMP_FORMAT/);});
test('rejects rewritten manifest and replaced external digest',async t=>{const a=await fixture(t),r=await prepareM7PairedManifest(a),p=join(a.root,'m7-paired-manifest.json');await chmod(p,0o600);await writeFile(p,'{}\n');await assert.rejects(verifyM7PairedManifest({...a,...r}));await assert.rejects(verifyM7PairedManifest({...a,manifestSha256:sha('{}\n')}));});
test('rejects changed source state and identity binding',async t=>{const a=await fixture(t);await assert.rejects(prepareM7PairedManifest({...a,evidence:{...a.evidence,afterStateSha256:'f'.repeat(64)}}));const r=await prepareM7PairedManifest(a);await assert.rejects(verifyM7PairedManifest({...a,...r,evidence:{...a.evidence,databaseIdentitySha256:'f'.repeat(64)}}));});
test('rejects symlink, hardlink, loose permissions, path aliases, and extra content',async t=>{const a=await fixture(t),p=join(a.root,'documents','file'),target=join(a.root,'uploads','file');await rm(p);await symlink(target,p);await assert.rejects(prepareM7PairedManifest(a));await rm(p);await link(target,p);await assert.rejects(prepareM7PairedManifest(a));await rm(p);await writeFile(p,'fixture-documents',{mode:0o644});await assert.rejects(prepareM7PairedManifest(a));await chmod(p,0o600);await assert.rejects(prepareM7PairedManifest({...a,root:a.root+'/.'}));await writeFile(join(a.root,'extra'),'x',{mode:0o600});await assert.rejects(prepareM7PairedManifest(a));});
test('rejects missing inventory and traversal in expected inventory',async t=>{const a=await fixture(t);await assert.rejects(prepareM7PairedManifest({...a,expectedInventories:{documents:[]}}));a.expectedInventories.documents.push(['../escape',0,'a'.repeat(64)]);await assert.rejects(prepareM7PairedManifest(a));});
