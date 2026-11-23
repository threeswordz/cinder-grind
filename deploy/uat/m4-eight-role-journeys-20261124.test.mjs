// Focused no-network contract tests for the M4 Lane C disposable browser guard.
// NOT a substitute for Chrome + Nest + PG17 or retained-role DEC-042 UAT.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SOURCE,PERSONAS,validateFixture,plannedChecks,readOnlyPath,assessResponse,
} from './m4-eight-role-journeys-20261124.mjs';

const uid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const fixture=()=>{
  const actors={};
  Object.entries(PERSONAS).forEach(([key,value],i)=>{
    actors[key]={userId:uid(100+i),email:key.toLowerCase()+'@example.invalid',
      password:'synthetic-only-secret-not-committed',roleCodes:[...value.roles]};
  });
  return {
    purpose:'M4_LANE_C_DISPOSABLE_SYNTHETIC_ONLY',sourceSha:BASE_SOURCE,
    apiBase:'http://127.0.0.1:31375/api/v1',webOrigin:'http://127.0.0.1:44375',
    databaseName:'erp_m4_lane_c_20261124',companyId:uid(1),projectId:uid(2),
    sameCompanyOtherProjectId:uid(3),foreignCompanyId:uid(4),foreignProjectId:uid(5),
    employeeId:uid(6),clientBoqVersionId:uid(7),foreignDocumentId:uid(8),
    otherProjectDocumentId:uid(9),hrAttachmentId:uid(10),actors,
  };
};
const error=(pattern,fn)=>assert.throws(fn,e=>pattern.test(e.safeCode??e.message));
test('Eight named production-role personas only: no SYS_ADMIN or permission-union actor',()=>{
  assert.deepEqual(Object.keys(PERSONAS),[
    'NANCY','BEN','KHAIMOOK','JAI','STORE_SITE','FOREMAN','PORN','KOH']);
  assert.equal(validateFixture(fixture()).sourceSha,BASE_SOURCE);
  assert.deepEqual(PERSONAS.KHAIMOOK.roles,['PROJECT_MANAGER','STOREKEEPER']);
  const c=fixture();c.actors.NANCY.roleCodes=['SYS_ADMIN'];
  error(/ACTOR_ROLE_UNEXPECTED_NANCY/,()=>validateFixture(c));
  const d=fixture();d.actors.JAI.roleCodes.push('MANAGEMENT');
  error(/ACTOR_ROLE_UNEXPECTED_JAI/,()=>validateFixture(d));
});
test('Refuse retained, remote, alternative DB/source, and non-loopback targets',()=>{
  for(const [name,value] of [
    ['apiBase','http://erp.example.com/api/v1'],
    ['webOrigin','http://127.0.0.1:4173'],
    ['databaseName','construction_erp'],
  ]){
    const c=fixture();c[name]=value;
    error(/UNSAFE_TARGET/,()=>validateFixture(c));
  }
  const a=fixture();a.sourceSha='f'.repeat(40);
  error(/INTEGRATED_BASE_SHA_MISMATCH/,()=>validateFixture(a));
  const b=fixture();b.purpose='RETAINED_MKE';
  error(/DISPOSABLE_PROOF_REQUIRED/,()=>validateFixture(b));
});
test('Require distinct actor IDs, account emails and Company/Project targets',()=>{
  const c=fixture();c.actors.BEN.userId=c.actors.NANCY.userId;
  error(/ACTOR_IDENTITY_REUSED/,()=>validateFixture(c));
  const d=fixture();d.actors.BEN.email=d.actors.NANCY.email.toUpperCase();
  error(/ACTOR_IDENTITY_REUSED/,()=>validateFixture(d));
  const e=fixture();e.sameCompanyOtherProjectId=e.projectId;
  error(/SCOPE_FIXTURE_NOT_DISTINCT/,()=>validateFixture(e));
  const f=fixture();delete f.actors.KOH;
  error(/EIGHT_ACTORS_REQUIRED/,()=>validateFixture(f));
});
test('Exact paths only: GET probes cannot be generalized into write or outbound routes',()=>{
  const c=fixture();
  for(const key of Object.keys(PERSONAS)){
    const checks=plannedChecks(c,key,[]);
    assert.ok(checks.length>=8);
    for(const check of checks)assert.equal(readOnlyPath(check.path),true,check.name);
    assert.ok(checks.some(x=>x.name==='FOREIGN_COMPANY_PROJECT'));
    assert.ok(checks.some(x=>x.name==='UNASSIGNED_PROJECT_DOCUMENT_BYTES_DENIED'));
  }
  for(const path of [
    '/admin/roles','/admin/users','https://evil.example.invalid/',
    '/auth/login','/procurement/purchase-orders','/projects/'+uid(1)+'/members',
    '/documents/projects/'+uid(2)+'/'+uid(3)+'/download/../../admin',
  ])assert.equal(readOnlyPath(path),false,path);
});
test('Project membership is not Company-level access; restricted roles must be denied',()=>{
  const c=fixture();
  const without=plannedChecks(c,'STORE_SITE',['projects.project.view']);
  assert.deepEqual(without.find(x=>x.name==='WRONG_SAME_COMPANY_PROJECT').status,[403,404]);
  const all=plannedChecks(c,'BEN',['projects.project.view','projects.access_all']);
  assert.deepEqual(all.find(x=>x.name==='WRONG_SAME_COMPANY_PROJECT').status,[200]);
  assert.deepEqual(all.find(x=>x.name==='FOREIGN_COMPANY_PROJECT').status,[403,404]);
});
test('Actual CSV, document bytes and HR attachment are separate negative probes',()=>{
  const c=fixture();
  const checks=plannedChecks(c,'FOREMAN',['projects.project.view','hr.operational.view']);
  for(const name of ['CLIENT_BOQ_CSV_EXPORT_DENIED','FOREIGN_DOCUMENT_BYTES_DENIED',
    'UNASSIGNED_PROJECT_DOCUMENT_BYTES_DENIED','HR_ATTACHMENT_BYTES_DENIED']){
    assert.ok(checks.some(x=>x.name===name),name);
  }
  const readable=plannedChecks(c,'NANCY',['budget.customer.view','hr.documents.view',
    'projects.access_all','hr.bank.view']);
  assert.ok(readable.some(x=>x.name==='CLIENT_BOQ_CSV_EXPORT_DENIED'));
  assert.ok(!readable.some(x=>x.name==='HR_ATTACHMENT_BYTES_DENIED'));
  const full=plannedChecks(c,'NANCY',['budget.cost.full_view','budget.boq.view',
    'budget.revision.view','budget.customer.view']);
  assert.deepEqual(full.find(x=>x.name==='CLIENT_BOQ_CSV_AUTHORIZED').status,[200]);
  assert.deepEqual(readable.find(x=>x.name==='HR_BANK_PERMISSION').status,[200]);
});
test('No simulated PASS from forbidden, leaky, oversized or unexpected status',()=>{
  const c=fixture(),check=plannedChecks(c,'FOREMAN',[]).find(x=>x.name==='CLIENT_BOQ_CSV_EXPORT_DENIED');
  assert.equal(assessResponse(check,403,'{"code":"PERMISSION_DENIED"}','LANEC_SYNTHETIC_SECRET').status,'PASS');
  error(/API_AUTH_BOUNDARY_FAILED/,()=>assessResponse(check,200,'', 'LANEC_SYNTHETIC_SECRET'));
  error(/SENSITIVE_BYTES_EXPOSED/,()=>assessResponse(check,404,'LANEC_SYNTHETIC_SECRET','LANEC_SYNTHETIC_SECRET'));
  const positive=plannedChecks(c,'NANCY',['hr.bank.view']).find(x=>x.name==='HR_BANK_PERMISSION');
  assert.equal(assessResponse(positive,200,'LANEC_SYNTHETIC_SECRET','LANEC_SYNTHETIC_SECRET').status,'PASS');
});
test('Omitted synthetic evidence IDs do not generate counterfeit export/byte tests',()=>{
  const c=fixture();
  for(const name of ['clientBoqVersionId','foreignDocumentId','otherProjectDocumentId','hrAttachmentId'])delete c[name];
  validateFixture(c);
  const names=plannedChecks(c,'FOREMAN',[]).map(x=>x.name);
  assert.ok(!names.includes('CLIENT_BOQ_CSV_EXPORT_DENIED'));
  assert.ok(!names.includes('FOREIGN_DOCUMENT_BYTES_DENIED'));
  assert.ok(!names.includes('UNASSIGNED_PROJECT_DOCUMENT_BYTES_DENIED'));
  assert.ok(!names.includes('HR_ATTACHMENT_BYTES_DENIED'));
});

test('A separately provisioned disabled synthetic user cannot reuse persona credentials',()=>{
  const c=fixture();
  c.disabledActor={email:'disabled@example.invalid',password:'disposable-disabled-secret'};
  validateFixture(c);
  const conflict=fixture();
  conflict.disabledActor={email:'NANCY@example.invalid',password:'disposable-disabled-secret'};
  error(/INVALID_DISABLED_ACTOR/,()=>validateFixture(conflict));
  const weak=fixture();
  weak.disabledActor={email:'disabled@example.invalid',password:'short'};
  error(/INVALID_DISABLED_ACTOR/,()=>validateFixture(weak));
});
