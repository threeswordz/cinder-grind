import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {M4_CUSTODY as m} from './m6-post-m4-custody.mjs';
import {readCheckoutIdentity,verifyM4Checkout} from './m6-post-m4-inspect.mjs';
const exact={sha:m.target,tree:m.tree,clean:true};
test('exact released checkout identity only',()=>assert.equal(verifyM4Checkout(exact),true));
for(const delta of [{sha:m.source},{tree:'0'.repeat(40)},{clean:false}, {clean:undefined}])
  test('reject checkout drift',()=>assert.throws(()=>verifyM4Checkout({...exact,...delta}),{message:'M6_M4_CHECKOUT_IDENTITY_MISMATCH'}));
async function repo(t){
  const root=await realpath(await mkdtemp(join(tmpdir(),'m6-inspect-')));t.after(()=>rm(root,{recursive:true,force:true}));
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  git('init','-q');await writeFile(join(root,'fixture'),'original');git('add','fixture');
  git('-c','user.name=Test','-c','user.email=test@example.invalid','-c','commit.gpgsign=false','commit','-qm','fixture');
  return {root,git};
}
test('reads real git commit and tree, rejects dirty tracked and untracked state',async t=>{
  const {root,git}=await repo(t),p=await readCheckoutIdentity(root);
  assert.deepEqual(p,{sha:git('rev-parse','HEAD'),tree:git('rev-parse','HEAD^{tree}'),clean:true});
  await writeFile(join(root,'fixture'),'modified');assert.equal((await readCheckoutIdentity(root)).clean,false);
  await writeFile(join(root,'fixture'),'original');await writeFile(join(root,'extra'),'untracked');assert.equal((await readCheckoutIdentity(root)).clean,false);
});
test('rejects nested checkout root',async t=>{const {root}=await repo(t);const nested=join(root,'sub');await mkdir(nested);await assert.rejects(readCheckoutIdentity(nested),{message:'M6_M4_CHECKOUT_ROOT_INVALID'});});
