import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,chmod,symlink,link,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {M4_CUSTODY as m,verifyM4HistoricalReceipts,inspectM4HistoricalCustody} from './m6-post-m4-custody.mjs';
const cutover=()=>({status:'M4_CUTOVER_AND_RUNTIME_READY_PASS',source:m.source,target:m.target,
  tree:m.tree,fullMainRun:m.fullMainRun,originalTables:168,migrations:177,sourceDataPreserved:true,
  protectedFilesPreserved:true,runtimeOwned:true,roleVerificationComplete:false,humanUatCompleted:false,productionAuthorized:false});
const role=()=>({status:'M4_EIGHT_SYNTHETIC_ROLES_READBACK_PASS',roles:['BEN','NANCY','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH'],historicalPornAssignmentVerified:true,productionAuthorized:false});
test('historical receipts are not live or write authority',()=>{
  const p=verifyM4HistoricalReceipts(cutover(),role());
  assert.equal(p.sourceSha,m.target);assert.equal(p.historicalRoleReceiptMatched,true);
  for(const k of ['liveRuntimeVerified','mayMutate','milestone6Accepted','productionAuthorized'])assert.equal(p[k],false);
});
for(const [k,v] of Object.entries({source:m.target,target:m.source,tree:'0'.repeat(40),fullMainRun:0,originalTables:167,migrations:176,sourceDataPreserved:false,protectedFilesPreserved:false,runtimeOwned:false,roleVerificationComplete:true,humanUatCompleted:true,productionAuthorized:true}))
  test('reject cutover '+k,()=>assert.throws(()=>verifyM4HistoricalReceipts({...cutover(),[k]:v},role()),{message:'M6_M4_CUTOVER_RECEIPT_INVALID'}));
for(const r of [{...role(),roles:role().roles.slice(0,7)},{...role(),roles:Array(8).fill('BEN')},{...role(),historicalPornAssignmentVerified:false},{...role(),productionAuthorized:true}])
  test('reject invalid continuation',()=>assert.throws(()=>verifyM4HistoricalReceipts(cutover(),r),{message:'M6_M4_ROLE_RECEIPT_INVALID'}));
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),'m6-post-m4-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const stage=join(root,m.stage);for(const p of [stage,join(stage,'cutover'),join(stage,'role-readback'),join(stage,'rehearsal'),join(stage,'rehearsal','application')])await mkdir(p,{mode:0o700});
  const a=join(stage,'cutover','cutover-ready.json'),b=join(stage,'role-readback','continuation-ready.json');
  await writeFile(a,JSON.stringify(cutover()),{mode:0o600});await writeFile(b,JSON.stringify(role()),{mode:0o600});return {root,a,b};
}
test('read actual private files without altering receipt bytes',async t=>{
  const f=await fixture(t),before=await readFile(f.a);const p=await inspectM4HistoricalCustody(f.root);
  assert.equal(p.application,join(f.root,m.stage,'rehearsal','application'));assert.deepEqual(await readFile(f.a),before);
});
test('refuse missing continuation',async t=>{const f=await fixture(t);await rm(f.b);await assert.rejects(inspectM4HistoricalCustody(f.root));});
test('refuse public receipt',async t=>{const f=await fixture(t);await chmod(f.b,0o644);await assert.rejects(inspectM4HistoricalCustody(f.root),{message:'M6_M4_CUSTODY_RECEIPT_NOT_PRIVATE'});});
test('refuse symlink receipt',async t=>{const f=await fixture(t);await rm(f.b);await symlink(f.a,f.b);await assert.rejects(inspectM4HistoricalCustody(f.root));});
test('refuse hard-linked receipt',async t=>{const f=await fixture(t);await link(f.b,f.b+'.copy');await assert.rejects(inspectM4HistoricalCustody(f.root),{message:'M6_M4_CUSTODY_RECEIPT_NOT_PRIVATE'});});
test('refuse symlink application',async t=>{const f=await fixture(t),p=join(f.root,m.stage,'rehearsal','application');await rm(p,{recursive:true});await symlink(f.root,p);await assert.rejects(inspectM4HistoricalCustody(f.root),{message:'M6_M4_CUSTODY_DIRECTORY_INVALID'});});
