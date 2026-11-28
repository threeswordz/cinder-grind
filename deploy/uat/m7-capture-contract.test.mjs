import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bindM7Capture} from './m7-capture-contract.mjs';
const h=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const d=c=>c.repeat(64);
function fixture(){
  const expectedInventories=Object.fromEntries(['documents','uploads','hrkeys'].map((k,i)=>[k,[['','directory'],['f',i+1,d('a')]]]));
  const evidence={applicationSha:'a'.repeat(40),dumpSha256:d('b'),databaseIdentitySha256:d('c'),storageIdentitySha256:d('d'),quiescenceReceiptSha256:d('e'),beforeStateSha256:d('f'),afterStateSha256:d('f')};
  const manifestArgs={root:'/synthetic',manifestSha256:d('1'),expectedInventories,evidence};
  const w={applicationSha:evidence.applicationSha,tree:'b'.repeat(40),manifestSha256:manifestArgs.manifestSha256,dumpSha:evidence.dumpSha256,databaseIdentitySha256:evidence.databaseIdentitySha256,storageIdentitySha256:evidence.storageIdentitySha256,quiescenceReceiptSha256:evidence.quiescenceReceiptSha256,stateSha256:evidence.beforeStateSha256,schemaSha:d('2'),rowsSha:d('3'),sourceDatabase:{cluster:'123',oid:1,database:'source',role:'source_role'},sourceProcess:{pid:123}};
  for(const k of ['documents','uploads','hrkeys'])w[k+'Sha']=h(expectedInventories[k]);
  const witnessSha256=h([w.applicationSha,w.tree,w.manifestSha256,w.dumpSha,w.databaseIdentitySha256,w.storageIdentitySha256,w.quiescenceReceiptSha256,w.stateSha256,w.schemaSha,w.rowsSha,w.documentsSha,w.uploadsSha,w.hrkeysSha,['123',1,'source','source_role'],123]);
  return {manifestArgs,witness:w,witnessSha256,verifyManifest:async()=>true};
}
test('binds sealed capture fields to restore and verification contracts without native claims',async()=>{const f=fixture(),b=await bindM7Capture(f),c=b.capture();assert.equal(c.sha,f.witness.applicationSha);assert.equal(c.documentsSha,f.witness.documentsSha);assert.equal(b.assertObservation({...c,manifestSha:b.manifestSha}),true);assert.deepEqual(b.verificationTarget({...c,port:33072},'wrong'),{api:'http://127.0.0.1:33072/api/v1',manifestSha:b.manifestSha,appSha:c.sha,keyMode:'wrong'});});
test('rejects changed manifest identity, witness, source database and schema digest',async()=>{for(const k of ['manifestSha256','databaseIdentitySha256','storageIdentitySha256','quiescenceReceiptSha256','stateSha256','dumpSha','schemaSha','rowsSha']){const f=fixture();f.witness[k]=d('9');await assert.rejects(bindM7Capture(f));}const f=fixture();f.witness.sourceDatabase.oid=2;await assert.rejects(bindM7Capture(f),/WITNESS_DIGEST/);});
test('rejects changed inventory, invalid path, and missing root',async()=>{for(const rows of [[['','directory'],['f',9,d('a')]],[['','directory'],['../f',1,d('a')]],[['f',1,d('a')]]]){const f=fixture();f.manifestArgs.expectedInventories.documents=rows;await assert.rejects(bindM7Capture(f));}});
test('requires real verifier success and rechecks it rather than caching success',async()=>{let calls=0;const f=fixture();f.verifyManifest=async()=>++calls===1;const b=await bindM7Capture(f);await assert.rejects(b.reverify(),/MANIFEST_RECHECK/);await assert.rejects(bindM7Capture(f),/MANIFEST_RECHECK/);});
test('caller mutation cannot alter retained capture or verification identity',async()=>{const f=fixture(),b=await bindM7Capture(f);f.witness.sourceDatabase.oid=9;f.manifestArgs.manifestSha256=d('9');const c=b.capture();c.sourceDatabase.oid=8;assert.equal(b.capture().sourceDatabase.oid,1);assert.notEqual(b.manifestSha,d('9'));});
test('rejects drift in observed capture and wrong verification target',async()=>{const b=await bindM7Capture(fixture()),c=b.capture(),o={...c,manifestSha:b.manifestSha};for(const k of ['manifestSha','dumpSha','documentsSha','uploadsSha','hrkeysSha','schemaSha','rowsSha'])assert.throws(()=>b.assertObservation({...o,[k]:d('9')}),/OBSERVATION_DRIFT/);assert.throws(()=>b.assertObservation({...o,sourceDatabase:{...c.sourceDatabase,oid:2}}));assert.throws(()=>b.verificationTarget({...c,port:33071},'correct'));assert.throws(()=>b.verificationTarget({...c,port:33072,tree:'c'.repeat(40)},'correct'));assert.throws(()=>b.verificationTarget({...c,port:33072},'invalid'));});
