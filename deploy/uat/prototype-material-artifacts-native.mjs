// CI-only build-custody proof on a fresh local clone of the pinned app source.
// No services, actors, DB, migrations or browser scenarios are run here.
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SOURCE,API,safeEnvironment} from './prototype-actors.mjs';
import {verifyMaterialArtifacts,artifactInventory,compareArtifactInventories} from './prototype-material-artifacts.mjs';
const execute=promisify(execFile);
async function native(){
  assert.equal(process.platform,'linux');assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(process.versions.node,'24.21.0');
  const root=fileURLToPath(new URL('../../',import.meta.url)),temporary=await mkdtemp(join(tmpdir(),'erp-artifact-native-')),
    checkout=join(temporary,'checkout');
  async function run(exe,args,cwd,env=safeEnvironment()){
    return execute(exe,args,{cwd,env,timeout:180000,maxBuffer:2097152});
  }
  try{
    await run('git',['clone','--shared','--no-checkout',root,checkout],root);
    await run('git',['checkout','--detach',SOURCE],checkout);
    for(const sub of ['','apps/api','apps/web'])await symlink(join(root,sub,'node_modules'),join(checkout,sub,'node_modules'),'dir');
    // Directory-only node_modules/ ignores do not match symlinks in Git.
    // Exclude only this clone's three injected dependency links, never source.
    await appendFile(join(checkout,'.git/info/exclude'),'\n/node_modules\n/apps/api/node_modules\n/apps/web/node_modules\n');
    const requireApi=createRequire(join(checkout,'apps/api/package.json')),requireWeb=createRequire(join(checkout,'apps/web/package.json'));
    await run(process.execPath,[requireApi.resolve('typescript/bin/tsc'),'-p','tsconfig.build.json'],join(checkout,'apps/api'));
    await run(process.execPath,[join(requireWeb.resolve('vite/package.json'),'../bin/vite.js'),'build'],join(checkout,'apps/web'),
      {...safeEnvironment(),NODE_ENV:'production',VITE_API_BASE_URL:API});
    const proof=await verifyMaterialArtifacts(checkout);
    assert.equal(proof.status,'MATERIAL_API_WEB_ARTIFACT_BYTES_VERIFIED');assert.ok(proof.api.files>100&&proof.web.files>1);
    assert.equal(proof.existingBuildsModified,false);assert.equal(proof.runtimeRestarted,false);
    // Corrupt an actual nested compiled module, not index.html. The complete
    // inventory detects it using the already established expected byte set.
    const expected=await artifactInventory(resolve(checkout,'apps/api/dist'));
    await appendFile(join(checkout,'apps/api/dist/auth/auth.guard.js'),'\n// simulated artifact drift\n');
    assert.throws(()=>compareArtifactInventories([],expected),e=>e.safeCode==='MATERIAL_COMPILED_ARTIFACT_MISMATCH');
    const changed=await artifactInventory(resolve(checkout,'apps/api/dist'));
    assert.throws(()=>compareArtifactInventories(changed,expected),e=>e.safeCode==='MATERIAL_COMPILED_ARTIFACT_MISMATCH');
    console.log('MATERIAL_ARTIFACT_NATIVE_PASS: complete pinned-source API/web emission matches fresh isolated outputs; nested API drift refused; no live build/process/DB modified. Not Mac loaded-memory or dependency-installation attestation.');
  }finally{
    assert.ok(resolve(temporary).startsWith(resolve(tmpdir())+'/erp-artifact-native-'));
    await rm(temporary,{recursive:true,force:true});
  }
}
await native().catch(e=>{console.error('MATERIAL_ARTIFACT_NATIVE_FAILED: '+(/^[A-Z0-9_]+$/.test(e.safeCode??'')?e.safeCode:'BUILD_OR_INVENTORY_FAILED'));process.exitCode=1;});
