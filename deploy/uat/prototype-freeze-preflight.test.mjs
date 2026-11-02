import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePrototypeFreeze } from './prototype-freeze-preflight.mjs';

const SHA = 'a'.repeat(40);
const DIGEST = '301b0b292c5d55ca1de08b41b760d52185d9f349fa2763c75eea6bb5f5583e39';
const personas = ['Ben', 'Nancy', 'Khaimook', 'Jai', 'Store Site', 'Foreman', 'Koh', 'Porn'];
const features = ['material-plan-a', 'material-plan-b', 'material-plan-c', 'material-request',
  'stock-count', 'weekly-report', 'hr1-a', 'boq-v1.3', 'procurement-inventory'];
const checks = ['procurementStock','materialPlanIssue','materialReturnCount','foremanDailyWeekly',
  'boqCommercialPrivacy','hrEncryptedDocuments','authNegativeMatrix','trilingualUi',
  'chromiumBrowser','freshMigrationAndUpgrade'];
const recoveryKeys = ['pairedDatabaseDocuments','externalHrKeys','authenticatedRestoredApi',
  'ordinaryAndSignedDocumentBytes','encryptedHrDocumentBytes','immutableHistoryAndScope'];
function syntheticComplete() {
  const checksObject = Object.fromEntries(checks.map(k => [k,
    { result:'PASS', sha:SHA, evidenceId:'SYNTHETIC-ONLY-'+k }]));
  checksObject.chromiumBrowser.transport = 'authenticated-runtime';
  checksObject.authNegativeMatrix.transport = 'authenticated-runtime';
  return {
    schemaVersion:1, repository:'threeswordz/cinder-grind',
    release: {
      mainSha:SHA, runtimeSha:SHA,
      mainCi:{sha:SHA,event:'push',conclusion:'success',runUrl:'https://github.com/threeswordz/cinder-grind/actions/runs/123456'},
      independentReviews:Object.fromEntries(['A','B','C'].map(k=>[k,{headSha:SHA,disposition:'CLEAN',
        blockingFindings:0,unresolvedThreads:0,integratedTreeEquivalent:true,
        evidenceId:'SYNTHETIC-ONLY-review-'+k,treeProofId:'SYNTHETIC-ONLY-tree-'+k}])),
      toolchain:{node:'24.21.0',pnpm:'12.6.0',postgres:'17.11'},
      migrationInventoryId:'SYNTHETIC-ONLY-migrations',limitationsId:'SYNTHETIC-ONLY-limitations',
    },
    scope:{stableRequirementCount:112,stableRequirementDigest:DIGEST,dispositionId:'SYNTHETIC-ONLY-roles',
      features,excluded:['new-accounting','later-hr-payroll','multi-project-po'],
      controlledHandoffId:'SYNTHETIC-ONLY-exclusions'},
    environment:{mode:'isolated-synthetic',retainedDataUsed:false,productionConnected:false,
      companyCode:'PROTO_A',denialCompanyCode:'PROTO_B',projectCount:2,personas,
      databaseIsolated:true,documentsIsolated:true,externalHrKeysIsolated:true,
      businessAdminCannotSelfApprove:true,deploymentEvidenceId:'SYNTHETIC-ONLY-host',
      observedRuntime:{apiSha:SHA,webSha:SHA,databaseSchemaSha:SHA,evidenceId:'SYNTHETIC-ONLY-running'}},
    checks:checksObject,
    recovery:{sha:SHA,sourceTargetSeparated:true,observedMinutes:2.5,evidenceId:'SYNTHETIC-ONLY-restore',
      ...Object.fromEntries(recoveryKeys.map(k=>[k,'PASS']))},
    uat:{status:'DEFERRED_UNTIL_FROZEN_PROTOTYPE'},
    production:{authorized:false,realGlGateClaims:false},
  };
}
const result = p => analyzePrototypeFreeze(p, SHA);
function expectGap(mutator, gap) {
  const packet=syntheticComplete(); mutator(packet);
  const r=result(packet);
  assert.equal(r.status,'EVIDENCE_PACKET_INCOMPLETE');
  assert.ok(r.gaps.includes(gap),r.gaps.join(', '));
  assert.equal(r.prototypeFreezeCertified,false);
  assert.equal(r.productionAuthorized,false);
}
test('synthetic completeness remains structural only: never certifies freeze, UAT or Production',()=>{
  const r=result(syntheticComplete());
  assert.equal(r.status,'EVIDENCE_PACKET_STRUCTURALLY_REVIEWABLE');
  assert.deepEqual(r.gaps,[]);
  for(const field of ['evidenceAuthenticityVerified','prototypeFreezeCertified','humanUatCompleted',
    'productionAuthorized','productionGlGatesClosed'])assert.equal(r[field],false);
});
test('packet and expected release SHA fail closed',()=>{
  assert.throws(()=>analyzePrototypeFreeze(syntheticComplete(),'not-sha'),/EXPECTED_MAIN_SHA_INVALID/);
  expectGap(p=>p.release.mainSha='b'.repeat(40),'EXACT_RELEASE_IDENTITY_MISSING');
  assert.deepEqual(result(null).gaps,['PACKET_INVALID']);
});
test('only exact-main push SUCCESS with same SHA and pinned GitHub run URL counts',()=>{
  expectGap(p=>p.release.mainCi.event='pull_request','EXACT_MAIN_CI_EVIDENCE_MISSING');
  expectGap(p=>p.release.mainCi.sha='b'.repeat(40),'EXACT_MAIN_CI_EVIDENCE_MISSING');
  expectGap(p=>p.release.mainCi.runUrl='https://example.com/fake','EXACT_MAIN_CI_EVIDENCE_MISSING');
});
test('independent review evidence is mandatory and cannot be an earlier-head review',()=>{
  expectGap(p=>p.release.independentReviews.A.headSha='invalid','INDEPENDENT_REVIEW_EVIDENCE_MISSING_A');
  expectGap(p=>p.release.independentReviews.B.blockingFindings=1,'INDEPENDENT_REVIEW_EVIDENCE_MISSING_B');
  expectGap(p=>p.release.independentReviews.C.unresolvedThreads=1,'INDEPENDENT_REVIEW_EVIDENCE_MISSING_C');
  expectGap(p=>p.release.independentReviews.A.integratedTreeEquivalent=false,'INDEPENDENT_REVIEW_EVIDENCE_MISSING_A');
  expectGap(p=>p.release.independentReviews.B.evidenceId='https://secret.example/?key=foo','INDEPENDENT_REVIEW_EVIDENCE_MISSING_B');
});
test('pin toolchain and release inventory/limitations',()=>{
  expectGap(p=>p.release.toolchain.postgres='16','PINNED_TOOLCHAIN_UNVERIFIED');
  expectGap(p=>delete p.release.limitationsId,'RELEASE_INVENTORY_OR_LIMITATIONS_MISSING');
});
test('112 role IDs and scope exclusions cannot be silently dropped',()=>{
  expectGap(p=>p.scope.stableRequirementCount=111,'ROLE_112_ID_DISPOSITION_MISSING');
  expectGap(p=>p.scope.stableRequirementDigest='b'.repeat(64),'ROLE_112_ID_DISPOSITION_MISSING');
  expectGap(p=>p.scope.features.splice(2,1),'PROTOTYPE_FEATURE_SCOPE_INCOMPLETE');
  expectGap(p=>p.scope.features.push('material-plan-a'),'PROTOTYPE_FEATURE_SCOPE_INCOMPLETE');
  expectGap(p=>p.scope.excluded=[],'DEFERRED_SCOPE_HANDOFF_MISSING');
});
test('isolation prevents real-data, cross-Company, maker self-approval and absent persona claims',()=>{
  expectGap(p=>p.environment.retainedDataUsed=true,'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  expectGap(p=>p.environment.productionConnected=true,'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  expectGap(p=>p.environment.denialCompanyCode=p.environment.companyCode,'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  expectGap(p=>p.environment.personas.splice(6,1),'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  expectGap(p=>p.environment.businessAdminCannotSelfApprove=false,'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  expectGap(p=>p.environment.documentsIsolated=false,'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
});
test('running API, web and database schema identities must match freeze SHA',()=>{
  expectGap(p=>p.environment.observedRuntime.apiSha='b'.repeat(40),'ACTUAL_RUNTIME_IDENTITY_MISSING');
  expectGap(p=>delete p.environment.observedRuntime.evidenceId,'ACTUAL_RUNTIME_IDENTITY_MISSING');
});
test('every integrated runtime, negative-auth, multilingual and browser check is required',()=>{
  for(const key of checks) expectGap(p=>delete p.checks[key],'TECHNICAL_CHECK_MISSING_'+key);
  expectGap(p=>p.checks.chromiumBrowser.transport='synthetic-transport',
    'AUTHENTICATED_BROWSER_AND_DENIAL_EVIDENCE_MISSING');
  expectGap(p=>p.checks.authNegativeMatrix.transport='source-only',
    'AUTHENTICATED_BROWSER_AND_DENIAL_EVIDENCE_MISSING');
});
test('restore evidence must cover populated DB+files+keys and scoped restored application',()=>{
  for(const key of recoveryKeys) expectGap(p=>p.recovery[key]='NOT_RUN','RESTORE_CHECK_MISSING_'+key);
  expectGap(p=>p.recovery.sourceTargetSeparated=false,'RESTORE_IDENTITY_DURATION_OR_ISOLATION_MISSING');
  expectGap(p=>p.recovery.observedMinutes=0,'RESTORE_IDENTITY_DURATION_OR_ISOLATION_MISSING');
});
test('the checker never accepts prematurely completed human UAT or Production authorization',()=>{
  expectGap(p=>p.uat.status='PASS','UAT_OR_PRODUCTION_BOUNDARY_INVALID');
  expectGap(p=>p.production.authorized=true,'UAT_OR_PRODUCTION_BOUNDARY_INVALID');
  expectGap(p=>p.production.realGlGateClaims=true,'UAT_OR_PRODUCTION_BOUNDARY_INVALID');
});
