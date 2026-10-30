import assert from 'node:assert/strict';
import test from 'node:test';
import {validateTarget,validateActors,auditRoles,functions} from './hr1a-role-assurance.mjs';

const target={baseUrl:'http://127.0.0.1:3001/api/v1',
  companyId:'11111111-1111-4111-8111-111111111111',
  projectId:'22222222-2222-4222-8222-222222222222',
  employeeId:'33333333-3333-4333-8333-333333333333',
  expectedBuildSha:'646b2877335097ee204d5ec0ccc043c2e1fce548'};
test('rejects remote, noncanonical or credential-bearing URLs before any network request',()=>{
  for(const value of ['https://127.0.0.1:3001/api/v1','http://localhost:3001/api/v1',
    'http://127.0.0.1:3001/api/v1/','http://127.0.0.1:3001/api/v1?x=1',
    'http://name:credential@127.0.0.1:3001/api/v1']) {
    assert.throws(()=>validateTarget({...target,baseUrl:value}),/UNSAFE_TARGET/);
  }
  assert.throws(()=>validateTarget({...target,employeeId:'wrong'}),/INVALID_FIXTURE_ID/);
  assert.throws(()=>validateTarget({...target,expectedBuildSha:'unknown'}),/EXPECTED_BUILD_SHA_REQUIRED/);
});
test('fail closed for unknown identities or missing bindings',()=>{
  assert.throws(()=>validateActors({UNKNOWN:{}}),/INVALID_ACTOR_MAP/);
  assert.throws(()=>validateActors({KOH:{email:'example@example.test'}}),/INVALID_ACTOR_BINDING_KOH/);
});
test('unsupplied role fixture is blocked, not treated as proof of business acceptance',async()=>{
  let called=false;
  const report=await auditRoles({...target,actors:{},fetchImpl:async()=>{called=true;throw new Error('network forbidden');}});
  assert.equal(called,false);
  assert.equal(report.status,'BLOCKED');
  assert.equal(report.observations.length,functions.length);
  assert.equal(report.observations.every(x=>x.status==='BLOCKED_ALIAS_NOT_SUPPLIED'),true);
  assert.equal(report.runtimeIdentity,'NOT_ATTESTED_BY_API');
  assert.equal(report.humanAcceptance,false);
  assert.equal(report.productionAuthorized,false);
  assert.equal(report.businessWrites,false);
  assert.equal(report.configurationWrites,false);
});
