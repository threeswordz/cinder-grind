import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,chmod,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeM6PrivateStage} from './prototype-m6-private-stage.mjs';
const src='9fa0506e9a50fd556f1c4404e4db2e3d88093b85',release='a9714872cf43a7c721c2d0de91bd3364a06caad6';
const names=['upgrade','configure','finance','hr','boq','preserve'];
async function setup(){const root=await mkdtemp(join(tmpdir(),'m6-test-'));await chmod(root,0o700);return root;}
test('creates protected ordered receipts and one final non-go-live seal',async()=>{
 const root=await setup();try{
  const p=makeM6PrivateStage(root,src,release),a={sourceSha:src,releaseSha:release},r=await p.claim(a);
  assert.equal(r.claimed,true);
  const results={};for(const name of names){results[name]={ok:true,releaseSha:release,proof:{status:name}};await p.recordPhase(name,results[name]);}
  const sealed=await p.seal({authority:a,results});assert.equal(sealed.ok,true);
  const ready=JSON.parse(await readFile(join(root,'m6-upgrade/ready.json')));
  assert.equal(ready.productionAuthorized,false);assert.equal(ready.milestone6Accepted,false);
  await assert.rejects(p.claim(a));
  await assert.rejects(makeM6PrivateStage(root,src,release).claim(a),{code:'EEXIST'});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('cannot skip a phase, seal early or accept wrong identity',async()=>{
 const root=await setup();try{
  const p=makeM6PrivateStage(root,src,release),a={sourceSha:src,releaseSha:release};
  await assert.rejects(p.claim({...a,releaseSha:src}),/M6_CLAIM_IDENTITY_OR_REPLAY/);
  await p.claim(a);
  await assert.rejects(p.recordPhase('hr',{ok:true,releaseSha:release}),/M6_PHASE_SEQUENCE_OR_EVIDENCE_INVALID/);
  await assert.rejects(p.seal({authority:a,results:{}}),/M6_SEAL_PRECONDITIONS_INVALID/);
  await p.recordPhase('upgrade',{ok:true,releaseSha:release});
  await assert.rejects(p.recordPhase('upgrade',{ok:true,releaseSha:release}),/M6_PHASE_SEQUENCE_OR_EVIDENCE_INVALID/);
 }finally{await rm(root,{recursive:true,force:true});}
});
