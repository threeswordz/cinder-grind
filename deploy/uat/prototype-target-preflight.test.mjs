import assert from 'node:assert/strict';
import test from 'node:test';
import {assessPrototypeTarget} from './prototype-target-preflight.mjs';
const SHA='a'.repeat(40), PATH='/tmp/erp-proto-candidate';
const valid=()=>({
  schemaVersion:1,purpose:'ISOLATED_PROTOTYPE_TARGET_PREFLIGHT',mode:'isolated-synthetic',
  expectedMainSha:SHA,companyCodes:['PROTO_A','PROTO_B'],projectCount:2,
  personas:['Ben','Nancy','Khaimook','Jai','Store Site','Foreman','Koh','Porn'],
  productionConnected:false,retainedDataUsed:false,realCompanyGrantsModified:false,
  runtime:{checkoutRoot:'/tmp/erp-exact-checkout',isolationRoot:PATH,
    databaseRoot:PATH+'/db',documentsRoot:PATH+'/documents',hrKeysRoot:PATH+'/hrkeys',
    apiOrigin:'http://127.0.0.1:33071',webOrigin:'http://127.0.0.1:44171',
    postgresHost:'127.0.0.1',postgresPort:55471,postgresDbName:'proto_a_01'},
});
const providers={
  inspectDir:async p=>({directory:true,symlink:false,mode:0o700,uid:1001,real:p}),
  inspectCheckout:async()=>({head:SHA,clean:true}),uid:1001,
};
const evaluate=v=>assessPrototypeTarget(v,SHA,providers);
const fails=async (mod,gap)=>{
  const p=valid();mod(p);
  const result=await evaluate(p);
  assert.equal(result.status,'ISOLATED_TARGET_PREFLIGHT_BLOCKED');
  assert.ok(result.gaps.includes(gap),result.gaps.join(','));
  assert.equal(result.runtimeRunningVerified,false);
  assert.equal(result.productionAuthorized,false);
};
test('clean isolated manifest confirms only local prerequisites, not runtime or UAT',async()=>{
  const r=await evaluate(valid());
  assert.deepEqual(r.gaps,[]);
  assert.equal(r.status,'LOCAL_SAFETY_PREREQUISITES_OBSERVED');
  for(const k of ['retainedAccessVerified','authenticatedRoleMatrixVerified','runtimeRunningVerified',
    'prototypeFreezeCertified','humanUatCompleted','productionAuthorized','evidenceIndependentlyVerified'])
    assert.equal(r[k],false);
  assert.equal(r.networkRequests,0);assert.equal(r.filesChanged,0);
});
test('invalid expected SHA fails, and unknown or secret fields reject',async()=>{
  await assert.rejects(()=>assessPrototypeTarget(valid(),'wrong',providers),/EXPECTED_MAIN_SHA_INVALID/);
  await fails(p=>p.databaseUrl='postgresql://secret', 'TARGET_MANIFEST_SCHEMA_INVALID');
  await fails(p=>p.runtime.password='secret','TARGET_RUNTIME_SCHEMA_INVALID');
});
test('production and retained declarations fail closed',async()=>{
  for(const [k,v] of [['productionConnected',true],['retainedDataUsed',true],
    ['realCompanyGrantsModified',true],['mode','production'],['expectedMainSha','b'.repeat(40)]])
    await fails(p=>p[k]=v,'ISOLATION_OR_RELEASE_DECLARATION_INVALID');
});
test('scope must include PROTO_A, PROTO_B, all eight business functions and two Projects',async()=>{
  await fails(p=>p.personas.pop(),'ISOLATION_OR_RELEASE_DECLARATION_INVALID');
  await fails(p=>p.companyCodes=['MKE','TCJ'],'ISOLATION_OR_RELEASE_DECLARATION_INVALID');
  await fails(p=>p.projectCount=1,'ISOLATION_OR_RELEASE_DECLARATION_INVALID');
});
test('non-loopback, historic ports, port collisions and credentialled URLs are blocked',async()=>{
  for(const host of ['0.0.0.0','localhost','example.com','::1'])
    await fails(p=>p.runtime.apiOrigin=`http://${host}:33071`,'NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.apiOrigin='https://127.0.0.1:33071','NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.apiOrigin='http://user:pass@127.0.0.1:33071','NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.apiOrigin='http://127.0.0.1:3001','NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.postgresPort=33071,'NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.postgresHost='0.0.0.0','NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
  await fails(p=>p.runtime.postgresDbName='real_company','NON_ISOLATED_ENDPOINT_OR_DATABASE_IDENTITY');
});
test('rejects root overlap, symlinks and unprotected directories',async()=>{
  await fails(p=>p.runtime.databaseRoot='/tmp/unrelated/db','UNSAFE_OR_OVERLAPPING_TARGET_ROOTS');
  await fails(p=>p.runtime.checkoutRoot=p.runtime.isolationRoot+'/source','UNSAFE_OR_OVERLAPPING_TARGET_ROOTS');
  await fails(p=>p.runtime.hrKeysRoot=p.runtime.documentsRoot,'UNSAFE_OR_OVERLAPPING_TARGET_ROOTS');
  const bad=await assessPrototypeTarget(valid(),SHA,{...providers,inspectDir:async path=>({
    directory:true,symlink:path.endsWith('/hrkeys'),mode:0o755,uid:1001,real:path})});
  assert.ok(bad.gaps.includes('TARGET_DIRECTORY_IDENTITY_OR_PERMISSIONS_INVALID'));
});
test('dirty or mismatched checkout blocks exact release preparation',async()=>{
  for(const result of [{head:SHA,clean:false},{head:'b'.repeat(40),clean:true}]){
    const r=await assessPrototypeTarget(valid(),SHA,{...providers,inspectCheckout:async()=>result});
    assert.ok(r.gaps.includes('EXACT_CLEAN_CHECKOUT_MISSING'));
  }
});
test('filesystem errors block; no positive readiness is manufactured',async()=>{
  const r=await assessPrototypeTarget(valid(),SHA,{...providers,inspectDir:async()=>{throw Error('private path');}});
  assert.deepEqual(r.gaps,['TARGET_DIRECTORY_UNAVAILABLE']);
});
