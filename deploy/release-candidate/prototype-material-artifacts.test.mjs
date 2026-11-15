import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,chmod,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {artifactInventory,compareArtifactInventories,verifyMaterialArtifacts} from '../uat/prototype-material-artifacts.mjs';

test('compiled inventory binds every filename and byte; extra, missing and modified bundles are refused',async t=>{
  const root=await mkdtemp(join(tmpdir(),'erp-artifact-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));
  await mkdir(join(root,'assets'));await writeFile(join(root,'index.html'),'actual build');
  await writeFile(join(root,'assets','app.js'),'actual bundle');
  const expected=await artifactInventory(resolve(root));
  assert.equal(compareArtifactInventories(expected,expected).files,2);
  for(const changed of [expected.slice(1),[...expected,['extra.js',1,'a'.repeat(64)]],
    expected.map((r,i)=>i?[r[0],r[1],'b'.repeat(64)]:r),expected.map((r,i)=>i?['renamed.js',...r.slice(1)]:r)])
    assert.throws(()=>compareArtifactInventories(changed,expected),e=>e.safeCode==='MATERIAL_COMPILED_ARTIFACT_MISMATCH');
});
test('links, shared writable files and multiply linked bundles cannot pass artifact inventory',async t=>{
  for(const kind of ['symlink','writable','hardlink']){
    const root=await mkdtemp(join(tmpdir(),'erp-artifact-unit-'));t.after(()=>rm(root,{recursive:true,force:true}));
    const file=join(root,'main.js');await writeFile(file,'compiled bytes');
    if(kind==='symlink')await symlink(file,join(root,'alias.js'));
    if(kind==='writable')await chmod(file,0o666);
    if(kind==='hardlink')await link(file,join(root,'alias.js'));
    await assert.rejects(artifactInventory(resolve(root)),e=>e.safeCode==='MATERIAL_ARTIFACT_UNSAFE_ENTRY');
  }
});
test('artifact helper cannot accept an unbound checkout before invoking a compiler',async()=>{
  await assert.rejects(verifyMaterialArtifacts('relative-checkout'),e=>e.safeCode==='MATERIAL_ARTIFACT_PATH_INVALID');
});
