import assert from 'node:assert/strict';
import test from 'node:test';
import {assessRoleMatrix,emptyRoleMatrixTemplate,SCENARIOS,ACTOR_FUNCTIONS} from './gl04-synthetic-role-matrix-preflight.mjs';
const SHA='a'.repeat(40),NOW=Date.UTC(2026,10,3,8,0,0);
const ISO=new Date(NOW).toISOString().replace('.000Z','Z');
function packet(){
 const p=emptyRoleMatrixTemplate();
 p.mainSha=p.runtimeSha=SHA;p.capturedAt=ISO;
 p.fixture.fixtureEvidenceId='CASE-FIXTURE-001';
 for(const [role,binding] of Object.entries(p.fixture.actorBindings)){
  binding.key='ACTOR_'+role.replaceAll('_','');
  binding.roleEvidenceId='CASE-ROLE-'+role;
 }
 const makers={
  BEN_PO_APPROVE:'JAI',KHAIMOOK_GR_APPROVE:'STORE_SITE',
  KHAIMOOK_COUNT_APPROVE:'STORE_SITE',NANCY_CUSTOMER_BOQ_APPROVE:'BEN'
 };
 for(const row of p.scenarios){
  const s=SCENARIOS.find(x=>x.id===row.id);
  row.httpStatus=s.outcome==='ALLOW'?200:s.outcome==='DENY_AUTH'?403:409;
  row.actorKey=p.fixture.actorBindings[row.actor].key;
  row.observedAt=ISO;row.evidenceId='CASE-RUNTIME-'+row.id;
  row.requestAuditId='CASE-AUDIT-'+row.id;
  if(row.separation){
   row.separation.actorKey=row.actorKey;
   row.separation.makerKey=s.outcome==='DENY_POLICY'?row.actorKey:
      p.fixture.actorBindings[makers[row.id]].key;
   row.separation.immutableDecisionEvidenceId='CASE-DECISION-'+row.id;
   if(s.outcome==='DENY_POLICY')
     row.separation.eligibilityEvidenceId='CASE-ELIGIBILITY-'+row.id;
  }
 }
 return p;
}
const audit=x=>assessRoleMatrix(x,{now:NOW,expectedSha:SHA});
const codes=x=>audit(x).gaps.map(g=>g.code);
const row=(p,id)=>p.scenarios.find(s=>s.id===id);
function check(mutate,code){
 const p=packet();mutate(p);
 assert.ok(codes(p).includes(code),code+': '+codes(p).join(', '));
 assert.equal(audit(p).gl04GateClosed,false);
}
test('24 required scenarios: structurally consistent packet is never independently verified',()=>{
 const r=audit(packet());
 assert.equal(SCENARIOS.length,24);assert.equal(ACTOR_FUNCTIONS.length,9);
 assert.equal(r.checkedScenarios,24);assert.equal(r.gaps.length,0);
 assert.equal(r.status,'DECLARED_MATRIX_CONSISTENT_INDEPENDENT_VERIFICATION_PENDING');
 for(const k of ['realRoleConfigurationVerified','prototypeFreezeCertified','humanUatCompleted',
  'gl04GateClosed','productionAuthorized','grantsApplied'])assert.equal(r[k],false);
 assert.equal(r.networkRequests,0);assert.equal(r.retainedReads,0);
});
test('empty template is not an observation or proof',()=>{
 const p=emptyRoleMatrixTemplate();
 for(const code of ['SOURCE_RUNTIME_SHA_MISMATCH','CAPTURE_TIME_NOT_CURRENT',
  'SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED','SCENARIO_PROVENANCE_OR_SCOPE_INVALID',
  'SCENARIO_OUTCOME_INVALID'])assert.ok(codes(p).includes(code),code);
});
test('release source and runtime SHA must match caller-verifed main',()=>{
 check(p=>p.mainSha='b'.repeat(40),'SOURCE_RUNTIME_SHA_MISMATCH');
 check(p=>p.runtimeSha='b'.repeat(40),'SOURCE_RUNTIME_SHA_MISMATCH');
 assert.throws(()=>assessRoleMatrix(packet(),{now:NOW,expectedSha:'not-sha'}),/EXPECTED_SHA_OR_CLOCK_INVALID/);
});
test('strict UTC freshness denies impossible, stale and future dates',()=>{
 check(p=>p.capturedAt='2026-02-30T00:00:00Z','CAPTURE_TIME_NOT_CURRENT');
 check(p=>p.capturedAt='2026-10-30T08:00:00Z','CAPTURE_TIME_NOT_CURRENT');
 check(p=>p.capturedAt='2026-11-03T09:00:00Z','CAPTURE_TIME_NOT_CURRENT');
});
test('per-probe UTC times need not be identical, but must be within two hours before capture',()=>{
 const p=packet();
 row(p,'STORE_PR_CREATE').observedAt='2026-11-03T07:59:00Z';
 assert.deepEqual(audit(p).gaps,[]);
 check(p=>row(p,'STORE_PR_CREATE').observedAt='2026-11-03T05:59:59Z','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_PR_CREATE').observedAt='2026-11-03T08:00:01Z','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
});
test('no Production, retained, unauthenticated or premature human UAT inputs',()=>{
 check(p=>p.retainedReads=true,'ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
 check(p=>p.productionConnected=true,'ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
 check(p=>p.realRoleGrantsModified=true,'ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
 check(p=>p.humanUatPerformed=true,'ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
 check(p=>p.transport='SOURCE_ONLY','ISOLATION_OR_UAT_BOUNDARY_UNVERIFIED');
});
test('two isolated synthetic companies/projects and all function personas required',()=>{
 check(p=>p.fixture.denialCompany='PROTO_A','SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>p.fixture.functions.pop(),'SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>p.fixture.functions.push('KOH'),'SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>p.fixture.fixtureEvidenceId='FILL_ID','SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
});
test('missing, duplicate and unexpected scenarios cannot be silently counted',()=>{
 check(p=>p.scenarios.pop(),'SCENARIO_NOT_OBSERVED');
 check(p=>p.scenarios.push({...p.scenarios[0]}),'DUPLICATE_SCENARIO');
 check(p=>p.scenarios.push({...p.scenarios[0],id:'UNKNOWN'}),'UNEXPECTED_OR_INVALID_SCENARIO');
 check(p=>p.scenarios={},'SCENARIO_ARRAY_INVALID');
});
test('synthetic role identity must be distinct and stable across positive and negative probes',()=>{
 check(p=>p.fixture.actorBindings.KOH.key=p.fixture.actorBindings.PORN.key,'SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>delete p.fixture.actorBindings.JAI,'SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>p.fixture.actorBindings.STORE_SITE.roleEvidenceId='FILL_ROLE','SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
 check(p=>row(p,'FOREMAN_COUNT_DENIED').actorKey=p.fixture.actorBindings.STORE_SITE.key,'ACTOR_BINDING_MISMATCH');
 check(p=>row(p,'STORE_OTHER_COMPANY_DENIED').actorKey=p.fixture.actorBindings.JAI.key,'ACTOR_BINDING_MISMATCH');
 check(p=>row(p,'STORE_COUNT_CREATE').actorKey='ACTOR_FAKE','ACTOR_BINDING_MISMATCH');
});
test('successful approval must cite its correct maker role, not merely a different token',()=>{
 check(p=>row(p,'BEN_PO_APPROVE').separation.makerKey=p.fixture.actorBindings.FOREMAN.key,
   'INDEPENDENT_APPROVAL_NOT_TRACED');
 check(p=>row(p,'KHAIMOOK_COUNT_APPROVE').separation.makerKey=p.fixture.actorBindings.JAI.key,
   'INDEPENDENT_APPROVAL_NOT_TRACED');
 check(p=>row(p,'NANCY_CUSTOMER_BOQ_APPROVE').separation.makerKey=p.fixture.actorBindings.KOH.key,
   'INDEPENDENT_APPROVAL_NOT_TRACED');
 check(p=>row(p,'JAI_PO_SELF_APPROVE').separation.actorKey=p.fixture.actorBindings.BEN.key,
   'MAKER_CHECKER_DENIAL_NOT_TRACED');
 check(p=>delete row(p,'STORE_COUNT_SELF_APPROVE').separation.eligibilityEvidenceId,
   'MAKER_CHECKER_DENIAL_NOT_TRACED');
 check(p=>row(p,'FOREMAN_WEEKLY_VIEW').separation={actorKey:'ACTOR_FAKE'},
   'UNEXPECTED_SEPARATION_ON_UNRELATED_SCENARIO');
});
test('scenario role, Company, Project, permission, transport and provenance are pinned',()=>{
 check(p=>row(p,'FOREMAN_COUNT_DENIED').actor='STORE_SITE','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_OTHER_COMPANY_DENIED').company='PROTO_A','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_OTHER_PROJECT_DENIED').project='SITE_A','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'KOH_EMPLOYEE_VIEW').permission='hr.documents.view','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_PR_CREATE').expectedOutcome='DENY_AUTH','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_PR_CREATE').transport='SOURCE_ONLY','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_PR_CREATE').observedAt='2026-11-01T08:00:00Z','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
});
test('authorization denials cannot be faked with 409, and 500 is never a PASS',()=>{
 check(p=>row(p,'STORE_COUNT_CREATE').httpStatus=403,'SCENARIO_OUTCOME_INVALID');
 check(p=>row(p,'FOREMAN_COUNT_DENIED').httpStatus=409,'SCENARIO_OUTCOME_INVALID');
 check(p=>row(p,'JAI_PO_SELF_APPROVE').httpStatus=200,'SCENARIO_OUTCOME_INVALID');
 check(p=>row(p,'PORN_HR_IDENTITY_DENIED').httpStatus=500,'SCENARIO_OUTCOME_INVALID');
});
test('positive independent approvals require different maker/checker actor keys',()=>{
 for(const id of ['BEN_PO_APPROVE','KHAIMOOK_GR_APPROVE','KHAIMOOK_COUNT_APPROVE',
  'NANCY_CUSTOMER_BOQ_APPROVE']){
  check(p=>row(p,id).separation.makerKey=row(p,id).separation.actorKey,'INDEPENDENT_APPROVAL_NOT_TRACED');
  check(p=>row(p,id).separation.actorKey='','INDEPENDENT_APPROVAL_NOT_TRACED');
 }
});
test('self-approval negative traces require the *same* actor key',()=>{
 for(const id of ['JAI_PO_SELF_APPROVE','STORE_COUNT_SELF_APPROVE',
  'BEN_CUSTOMER_BOQ_SELF_APPROVE']){
  check(p=>row(p,id).separation.makerKey='ACTOR_INVALID','MAKER_CHECKER_DENIAL_NOT_TRACED');
  check(p=>row(p,id).separation.actorKey='','MAKER_CHECKER_DENIAL_NOT_TRACED');
 }
});
test('opaque private references reject placeholders and user-supplied secrets are never returned',()=>{
 check(p=>row(p,'STORE_PR_CREATE').evidenceId='SYNTHETIC-ONLY-TEST','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'STORE_PR_CREATE').evidenceId='https://token.example/?secret=abc','SCENARIO_PROVENANCE_OR_SCOPE_INVALID');
 check(p=>row(p,'JAI_PO_SELF_APPROVE').separation.immutableDecisionEvidenceId='FILL_ABC','MAKER_CHECKER_DENIAL_NOT_TRACED');
 const p=packet();p.scenarios[0].password='SECRET-NEVER-REFLECT';
 assert.ok(codes(p).includes('UNEXPECTED_SCENARIO_FIELD'));
 assert.ok(!JSON.stringify(audit(p)).includes('SECRET-NEVER-REFLECT'));
});
test('unknown packet/fixture fields fail closed rather than implying private actor verification',()=>{
 assert.ok(codes(null).includes('INVALID_MATRIX_PACKET'));
 check(p=>p.secrets='PRIVATE_VALUE','UNEXPECTED_PACKET_FIELD');
 check(p=>p.fixture.employeeName='PRIVATE_PERSON','SYNTHETIC_FIXTURE_SCOPE_UNVERIFIED');
});
