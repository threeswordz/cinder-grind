import assert from 'node:assert/strict';
import test from 'node:test';
import { assessOnboarding, COMPANIES, DATASETS, CANONICALIZATION, emptyTemplate, fingerprintBusinessKeys } from '../uat/gl09-onboarding-reconcile.mjs';

const NOW = Date.parse('2026-11-01T02:00:00Z');
const EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
function snapshot() {
  const datasets = COMPANIES.flatMap((companyKey, a) => DATASETS.map((dataset, b) => ({
    companyKey, dataset,
    count: b === 0 ? 3 : 0,
    sha256: b === 0 ? String(a + 1).repeat(64) : EMPTY,
    rejectedRows: 0, duplicateRows: 0, foreignCompanyReferences: 0,
  })));
  return {
    version: 1, capturedAt: '2026-11-01T01:59:00Z',
    companies: [
      { businessKey: 'MKE', sourceCompanyCode: 'K', targetCompanyCode: 'K' },
      { businessKey: 'TCJ', sourceCompanyCode: 'T', targetCompanyCode: 'T' },
    ],
    source: { kind: 'ERP_COMMIT', releaseSha: 'a'.repeat(40), capturedAt: '2026-11-01T01:58:00Z',
      canonicalization: CANONICALIZATION, datasets: structuredClone(datasets) },
    target: { releaseSha: 'b'.repeat(40), capturedAt: '2026-11-01T01:58:30Z',
      canonicalization: CANONICALIZATION, datasets: structuredClone(datasets) },
    currencyPolicy: { newDocumentCurrency: 'THB', legacyCurrencyProvenancePreserved: true },
    handoff: { scopeReference: 'OWNER-SIGNED-PILOT-SCOPE-FIXTURE', openingBalances: 'OUTSIDE_APPROVED_SCOPE',
      accounting: 'OUTSIDE_APPROVED_PILOT', trainingRecorded: true, rollbackPlanRecorded: true },
  };
}
const audit = data => assessOnboarding(data, { now: NOW });
const codes = report => report.gaps.map(g => g.code);

test('matching synthetic MKE and TCJ metadata is not live acceptance or permission verification', () => {
  const result = audit(snapshot());
  assert.equal(result.status, 'DECLARED_RECONCILIATION_CONSISTENT_INDEPENDENT_PROOF_PENDING');
  assert.equal(result.expectedDatasetPairs, 20);
  assert.equal(result.checkedDatasetPairs, 20);
  assert.deepEqual(result.gaps, []);
  assert.equal(result.gl09GateClosed, false);
  assert.equal(result.productionAuthorized, false);
  assert.equal(result.realCompanyConfigurationsVerified, false);
  assert.equal(result.independentEvidenceVerified, false);
  assert.equal(result.actualBusinessAcceptance, false);
  assert.equal(result.networkRequests, 0);
  assert.equal(result.retainedDataReads, 0);
  assert.equal(result.dataWrites, 0);
});

test('missing and repeated datasets never get counted as reconciled', () => {
  const missing = snapshot();
  missing.target.datasets.pop();
  assert.ok(codes(audit(missing)).includes('DATASET_NOT_PRESENT_BOTH_SIDES'));
  const duplicate = snapshot();
  duplicate.source.datasets.push(structuredClone(duplicate.source.datasets[0]));
  assert.ok(codes(audit(duplicate)).includes('SOURCE_DATASET_DUPLICATE'));
});

test('different counts or canonical fingerprints are independently blocked', () => {
  const count = snapshot();
  count.target.datasets[0].count++;
  assert.ok(codes(audit(count)).includes('SOURCE_TARGET_ROW_COUNT_MISMATCH'));
  const fingerprint = snapshot();
  fingerprint.target.datasets[0].sha256 = 'e'.repeat(64);
  assert.ok(codes(audit(fingerprint)).includes('SOURCE_TARGET_FINGERPRINT_MISMATCH'));
  const canonicalization = snapshot();
  canonicalization.target.canonicalization = 'UNTRUSTED-FORMAT';
  assert.ok(codes(audit(canonicalization)).includes('FINGERPRINT_CANONICALIZATION_NOT_AGREED'));
});

test('nonempty dataset count cannot masquerade as a canonical empty-set fingerprint', () => {
  const inconsistent = snapshot();
  inconsistent.source.datasets[0].sha256 = EMPTY;
  inconsistent.target.datasets[0].sha256 = EMPTY;
  assert.ok(codes(audit(inconsistent)).includes('SOURCE_DATASET_ROW_INVALID'));
  assert.ok(codes(audit(inconsistent)).includes('TARGET_DATASET_ROW_INVALID'));
  assert.ok(codes(audit(inconsistent)).includes('DATASET_NOT_PRESENT_BOTH_SIDES'));

  const emptyWrong = snapshot();
  emptyWrong.target.datasets[1].sha256 = 'a'.repeat(64);
  assert.ok(codes(audit(emptyWrong)).includes('TARGET_DATASET_ROW_INVALID'));
});

test('cross-Company references, duplicates and rejected rows cannot be hidden', () => {
  for (const field of ['foreignCompanyReferences', 'duplicateRows', 'rejectedRows']) {
    const value = snapshot();
    value.source.datasets[0][field] = 1;
    assert.ok(codes(audit(value)).includes('SOURCE_UNRESOLVED_DATA_QUALITY'));
  }
  const malformed = snapshot();
  malformed.target.datasets[0].companyKey = 'DIFFERENT_COMPANY';
  assert.ok(codes(audit(malformed)).includes('TARGET_DATASET_ROW_INVALID'));
});

test('Company code collision, missing MKE/TCJ binding and private values are blocked or redacted', () => {
  const collision = snapshot();
  collision.companies[1].targetCompanyCode = 'K';
  assert.ok(codes(audit(collision)).includes('TWO_COMPANY_BINDINGS_UNVERIFIED'));
  const missing = snapshot();
  missing.companies.pop();
  assert.ok(codes(audit(missing)).includes('TWO_COMPANY_BINDINGS_UNVERIFIED'));
  const secret = snapshot();
  secret.target.datasets[0].privatePayroll = 'CONFIDENTIAL-PAYROLL-DETAIL';
  secret.target.datasets[0].sha256 = 'NOT_A_HASH_SECRET';
  const output = JSON.stringify(audit(secret));
  assert.ok(!output.includes('CONFIDENTIAL-PAYROLL-DETAIL'));
  assert.ok(!output.includes('NOT_A_HASH_SECRET'));
  assert.ok(codes(audit(secret)).includes('TARGET_DATASET_ROW_INVALID'));
});

test('historical SGD provenance, new THB, opening balances and handoff need explicit evidence', () => {
  const currency = snapshot();
  currency.currencyPolicy.newDocumentCurrency = 'SGD';
  currency.currencyPolicy.legacyCurrencyProvenancePreserved = false;
  assert.ok(codes(audit(currency)).includes('NEW_DOCUMENT_THB_POLICY_UNVERIFIED'));
  assert.ok(codes(audit(currency)).includes('HISTORICAL_CURRENCY_PROVENANCE_UNVERIFIED'));
  const handoff = snapshot();
  handoff.handoff.accounting = 'UNVERIFIED';
  handoff.handoff.openingBalances = 'UNVERIFIED';
  handoff.handoff.trainingRecorded = false;
  handoff.handoff.rollbackPlanRecorded = false;
  assert.ok(codes(audit(handoff)).includes('EXTERNAL_ACCOUNTING_HANDOFF_SCOPE_UNVERIFIED'));
  assert.ok(codes(audit(handoff)).includes('OPENING_BALANCE_SCOPE_OR_RECEIPT_UNVERIFIED'));
  assert.ok(codes(audit(handoff)).includes('STAFF_TRAINING_UNVERIFIED'));
  assert.ok(codes(audit(handoff)).includes('CUTOVER_ROLLBACK_PLAN_UNVERIFIED'));
});

test('stale, future and impossible timestamps cannot pass as a current source-to-target capture', () => {
  const stale = snapshot();
  stale.capturedAt = '2026-10-25T01:59:00Z';
  assert.ok(codes(audit(stale)).includes('CAPTURE_TIME_MISSING_STALE_OR_FUTURE'));
  const future = snapshot();
  future.target.capturedAt = '2026-11-03T01:58:00Z';
  assert.ok(codes(audit(future)).includes('TARGET_SNAPSHOT_TIME_UNVERIFIED'));
  const impossible = snapshot();
  impossible.source.capturedAt = '2026-02-30T01:58:00Z';
  assert.ok(codes(audit(impossible)).includes('SOURCE_SNAPSHOT_TIME_UNVERIFIED'));
});

test('external source registers use an explicit source reference instead of invented Git history', () => {
  const x = snapshot();
  x.source.kind = 'EXTERNAL_REGISTER';
  delete x.source.releaseSha;
  x.source.externalReference = 'APPROVED-EXTERNAL-REGISTER';
  assert.equal(audit(x).gaps.length, 0);
  x.source.externalReference = '';
  assert.ok(codes(audit(x)).includes('SOURCE_OR_TARGET_PROVENANCE_UNVERIFIED'));
});

test('empty template is not executable proof or a populated real data extract', () => {
  const template = emptyTemplate();
  assert.equal(template.currencyPolicy.legacyCurrencyProvenancePreserved, false);
  assert.equal(template.source.datasets.length, 0);
  assert.equal(template.target.datasets.length, 0);
  assert.equal(template.handoff.trainingRecorded, false);
  assert.equal(template.datasetKinds.length, 10);
});

test('offline fingerprint stable by key order and never exposes private key values', () => {
  const a = fingerprintBusinessKeys({companyKey:'MKE',dataset:'PROJECTS',keys:['PROJECT-20','PROJECT-01']});
  const b = fingerprintBusinessKeys({companyKey:'MKE',dataset:'PROJECTS',keys:['PROJECT-01','PROJECT-20']});
  assert.deepEqual(a,b);
  assert.equal(a.count,2);
  assert.match(a.sha256,/^[a-f0-9]{64}$/);
  assert.equal(a.dataQualityChecks,'NOT_RUN');
  assert.equal(JSON.stringify(a).includes('PROJECT-01'),false);
});
test('domain separation and length-framing prevent cross-company or key ambiguity', () => {
  const input={companyKey:'MKE',dataset:'PROJECTS',keys:['ab','c']};
  const a=fingerprintBusinessKeys(input).sha256;
  assert.notEqual(a,fingerprintBusinessKeys({...input,companyKey:'TCJ'}).sha256);
  assert.notEqual(a,fingerprintBusinessKeys({...input,dataset:'MATERIALS'}).sha256);
  assert.notEqual(a,fingerprintBusinessKeys({...input,keys:['a','bc']}).sha256);
  assert.equal(fingerprintBusinessKeys({...input,keys:[]}).sha256,EMPTY);
});
test('refuses duplicate, non-NFC, whitespace, control, extra fields and oversized business keys', () => {
  const input={companyKey:'TCJ',dataset:'SUPPLIERS',keys:['VENDOR-A']};
  assert.throws(()=>fingerprintBusinessKeys({...input,keys:['x','x']}),/DUPLICATE_BUSINESS_KEY/);
  assert.throws(()=>fingerprintBusinessKeys({...input,keys:['e'+String.fromCharCode(0x0301)]}),/NONCANONICAL_BUSINESS_KEY/);
  assert.throws(()=>fingerprintBusinessKeys({...input,keys:[' x ']}),/NONCANONICAL_BUSINESS_KEY/);
  assert.throws(()=>fingerprintBusinessKeys({...input,keys:['x'+String.fromCharCode(10)]}),/NONCANONICAL_BUSINESS_KEY/);
  assert.throws(()=>fingerprintBusinessKeys({...input,keys:['x'.repeat(257)]}),/BUSINESS_KEY_TOO_LONG/);
  assert.throws(()=>fingerprintBusinessKeys({...input,credentials:'SECRET'}),/INVALID_CANONICAL_FINGERPRINT_INPUT/);
});
