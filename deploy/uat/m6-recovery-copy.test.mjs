import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,chmod,symlink,link} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyM6RecoveryCopy as verify} from './m6-recovery-copy.mjs';
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'m6-copy-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const dump=join(root,'postgresql.custom'),bytes=Buffer.alloc(2048,7);await writeFile(dump,bytes,{mode:0o600});
  const expected=Object.fromEntries(['documents','uploads','hrkeys'].map(k=>[k,[['','directory'],[k+'.file',42,'a'.repeat(64)]]]));
  const observed=structuredClone(expected);
  const args={root,expected,expectedDumpSha:createHash('sha256').update(bytes).digest('hex'),readInventory:async p=>observed[basename(p)]};
  return {args,dump,observed,root};
}
test('verifies all three inventories and the actual private dump bytes',async t=>{const f=await fixture(t);assert.equal(await verify(f.args),true);});
for(const kind of ['documents','uploads','hrkeys'])test('rejects changed '+kind+' recovery inventory',async t=>{
  const f=await fixture(t);f.observed[kind][1][2]='b'.repeat(64);await assert.rejects(verify(f.args),{message:'M6_RECOVERY_COPY_'+kind.toUpperCase()+'_DRIFT'});
});
test('rejects modified actual dump bytes',async t=>{const f=await fixture(t);await writeFile(f.dump,Buffer.alloc(2048,8));await assert.rejects(verify(f.args),{message:'M6_RECOVERY_DUMP_DRIFT'});});
test('rejects exposed dump permissions',async t=>{const f=await fixture(t);await chmod(f.dump,0o644);await assert.rejects(verify(f.args),{message:'M6_RECOVERY_DUMP_UNSAFE'});});
test('rejects symlink and hardlink dump substitutions',async t=>{
 const f=await fixture(t),other=join(f.root,'other');await writeFile(other,Buffer.alloc(2048,7),{mode:0o600});await rm(f.dump);await symlink(other,f.dump);await assert.rejects(verify(f.args),{message:'M6_RECOVERY_DUMP_UNSAFE'});await rm(f.dump);await link(other,f.dump);await assert.rejects(verify(f.args),{message:'M6_RECOVERY_DUMP_UNSAFE'});
});
test('rejects missing inventory baseline and missing expected digest',async t=>{const f=await fixture(t);delete f.args.expected.hrkeys;await assert.rejects(verify(f.args),{message:'M6_RECOVERY_COPY_BASELINE_INVALID'});delete f.args.expectedDumpSha;await assert.rejects(verify(f.args),{message:'M6_RECOVERY_COPY_INPUT_INVALID'});});
test('rejects a recovery root accessible to group or others',async t=>{const f=await fixture(t);await chmod(f.root,0o755);await assert.rejects(verify(f.args),{message:'M6_RECOVERY_ROOT_UNSAFE'});});
test('rejects a symlink to an otherwise valid recovery root',async t=>{const f=await fixture(t);const alias=f.root+'-alias';t.after(()=>rm(alias,{force:true}));await symlink(f.root,alias);await assert.rejects(verify({...f.args,root:alias}),{message:'M6_RECOVERY_ROOT_UNSAFE'});});
test('rejects directory entry drift during inventory reads',async t=>{const f=await fixture(t);const read=f.args.readInventory;await assert.rejects(verify({...f.args,readInventory:async p=>{if(basename(p)==='uploads')await writeFile(join(f.root,'unexpected'), 'new');return read(p);}}),{message:'M6_RECOVERY_ROOT_CHANGED_DURING_READ'});});
