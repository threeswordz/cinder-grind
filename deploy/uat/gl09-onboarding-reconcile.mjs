// GL-09 offline reconciliation preflight. No network, DB connection, writes or approvals.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COMPANIES = Object.freeze(['MKE', 'TCJ']);
export const DATASETS = Object.freeze([
  'PROJECTS', 'WAREHOUSES', 'UOMS', 'MATERIALS', 'SUPPLIERS',
  'ACTIVE_USERS', 'PROJECT_MEMBERS', 'APPROVAL_WORKFLOWS', 'BOQ_BASELINES', 'DOCUMENTS',
]);
export const CANONICALIZATION = 'GL09-CANONICAL-BUSINESS-KEYS-V1';
const SHA256 = /^[0-9a-f]{64}$/i;
const SHA40 = /^[0-9a-f]{40}$/i;
const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
const MAX_AGE_MS = 48 * 60 * 60 * 1000;
const SKEW_MS = 5 * 60 * 1000;

function dateMillis(value) {
  if (typeof value !== 'string' || !UTC.test(value)) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) && new Date(t).toISOString().replace('.000Z', 'Z') === value ? t : null;
}
function int(value) { return Number.isSafeInteger(value) && value >= 0; }
function validRow(row) {
  return row && typeof row === 'object' && !Array.isArray(row) &&
    COMPANIES.includes(row.companyKey) && DATASETS.includes(row.dataset) &&
    int(row.count) && typeof row.sha256 === 'string' && SHA256.test(row.sha256) &&
    (row.count !== 0 || row.sha256.toLowerCase() === EMPTY_SHA256) &&
    int(row.rejectedRows) && int(row.duplicateRows) && int(row.foreignCompanyReferences);
}
const key = row => row.companyKey + '/' + row.dataset;
const gap = (gaps, code, companyKey = null, dataset = null) => {
  gaps.push({ code, ...(companyKey ? { companyKey } : {}), ...(dataset ? { dataset } : {}) });
};
function rowsByKey(rows, side, gaps) {
  const index = new Map();
  if (!Array.isArray(rows) || rows.length > 2 * COMPANIES.length * DATASETS.length) {
    gap(gaps, side + '_DATASET_LIST_INVALID');
    return index;
  }
  for (const row of rows) {
    if (!validRow(row)) {
      // Input may contain private fields. Never reflect them into the audit report.
      gap(gaps, side + '_DATASET_ROW_INVALID');
      continue;
    }
    const k = key(row);
    if (index.has(k)) gap(gaps, side + '_DATASET_DUPLICATE', row.companyKey, row.dataset);
    else index.set(k, row);
    if (row.rejectedRows !== 0 || row.duplicateRows !== 0 || row.foreignCompanyReferences !== 0)
      gap(gaps, side + '_UNRESOLVED_DATA_QUALITY', row.companyKey, row.dataset);
  }
  return index;
}
export function assessOnboarding(input, { now = Date.now() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !Number.isFinite(now))
    throw new Error('INVALID_GL09_EVIDENCE');
  const gaps = [];
  if (input.version !== 1) gap(gaps, 'UNSUPPORTED_EVIDENCE_VERSION');
  const captured = dateMillis(input.capturedAt);
  if (captured === null || captured > now + SKEW_MS || captured < now - MAX_AGE_MS)
    gap(gaps, 'CAPTURE_TIME_MISSING_STALE_OR_FUTURE');
  const companies = input.companies;
  if (!Array.isArray(companies) || companies.length !== 2 ||
      !COMPANIES.every(k => companies.some(c => c?.businessKey === k)) ||
      companies.some(c => !c || !COMPANIES.includes(c.businessKey) ||
        !CODE.test(c.sourceCompanyCode ?? '') || !CODE.test(c.targetCompanyCode ?? '')) ||
      new Set(companies.map(c => c.businessKey)).size !== 2 ||
      new Set(companies.map(c => c.sourceCompanyCode)).size !== 2 ||
      new Set(companies.map(c => c.targetCompanyCode)).size !== 2)
    gap(gaps, 'TWO_COMPANY_BINDINGS_UNVERIFIED');
  const source = input.source ?? {}, target = input.target ?? {};
  const sourceProvenanceValid = source.kind === 'ERP_COMMIT'
    ? SHA40.test(source.releaseSha ?? '')
    : source.kind === 'EXTERNAL_REGISTER' && typeof source.externalReference === 'string' &&
      source.externalReference.trim().length >= 8 && source.externalReference.length <= 200;
  if (!sourceProvenanceValid || !SHA40.test(target.releaseSha ?? ''))
    gap(gaps, 'SOURCE_OR_TARGET_PROVENANCE_UNVERIFIED');
  if (source.canonicalization !== CANONICALIZATION || target.canonicalization !== CANONICALIZATION)
    gap(gaps, 'FINGERPRINT_CANONICALIZATION_NOT_AGREED');
  for (const [name, snapshot] of [['SOURCE', source], ['TARGET', target]]) {
    const ms = dateMillis(snapshot.capturedAt);
    if (ms === null || captured === null || ms > captured || captured - ms > MAX_AGE_MS)
      gap(gaps, name + '_SNAPSHOT_TIME_UNVERIFIED');
  }
  const src = rowsByKey(source.datasets, 'SOURCE', gaps);
  const dest = rowsByKey(target.datasets, 'TARGET', gaps);
  let compared = 0;
  for (const company of COMPANIES) {
    for (const dataset of DATASETS) {
      const k = company + '/' + dataset, a = src.get(k), b = dest.get(k);
      if (!a || !b) { gap(gaps, 'DATASET_NOT_PRESENT_BOTH_SIDES', company, dataset); continue; }
      compared++;
      if (a.count !== b.count) gap(gaps, 'SOURCE_TARGET_ROW_COUNT_MISMATCH', company, dataset);
      if (a.sha256.toLowerCase() !== b.sha256.toLowerCase())
        gap(gaps, 'SOURCE_TARGET_FINGERPRINT_MISMATCH', company, dataset);
    }
  }
  // These are declarations, never actual database, Company or user/approval attestation.
  const currency = input.currencyPolicy ?? {};
  if (currency.newDocumentCurrency !== 'THB') gap(gaps, 'NEW_DOCUMENT_THB_POLICY_UNVERIFIED');
  if (currency.legacyCurrencyProvenancePreserved !== true)
    gap(gaps, 'HISTORICAL_CURRENCY_PROVENANCE_UNVERIFIED');
  // Do not invent accounting, payroll or opening-balance scope.
  const scope = input.handoff ?? {};
  if (!['OUTSIDE_APPROVED_SCOPE', 'OWNER_RECONCILIATION_RECEIPT'].includes(scope.openingBalances) ||
      typeof scope.scopeReference !== 'string' || scope.scopeReference.trim().length < 8 ||
      scope.scopeReference.length > 200)
    gap(gaps, 'OPENING_BALANCE_SCOPE_OR_RECEIPT_UNVERIFIED');
  if (!['OUTSIDE_APPROVED_PILOT', 'EXTERNAL_ACCOUNTANT_RECONCILIATION_RECEIPT'].includes(scope.accounting) ||
      typeof scope.scopeReference !== 'string' || scope.scopeReference.trim().length < 8)
    gap(gaps, 'EXTERNAL_ACCOUNTING_HANDOFF_SCOPE_UNVERIFIED');
  if (scope.trainingRecorded !== true) gap(gaps, 'STAFF_TRAINING_UNVERIFIED');
  if (scope.rollbackPlanRecorded !== true) gap(gaps, 'CUTOVER_ROLLBACK_PLAN_UNVERIFIED');
  // Never output identities, raw input fields, monetary amounts, or fingerprints.
  return {
    purpose: 'GL09_MKE_TCJ_OFFLINE_ONBOARDING_RECONCILIATION',
    status: gaps.length ? 'DECLARATIONS_INCOMPLETE_OR_MISMATCHED' :
      'DECLARED_RECONCILIATION_CONSISTENT_INDEPENDENT_PROOF_PENDING',
    checkedDatasetPairs: compared, expectedDatasetPairs: COMPANIES.length * DATASETS.length,
    gaps,
    inputTrust: 'UNATTESTED_OPERATOR_SUPPLIED_METADATA',
    realCompanyConfigurationsVerified: false, independentEvidenceVerified: false,
    actualBusinessAcceptance: false, productionAuthorized: false, gl09GateClosed: false,
    networkRequests: 0, retainedDataReads: 0, dataWrites: 0,
  };
}

/**
 * Fingerprint a pre-mapped, caller-supplied list of stable business keys.
 * No source keys or sensitive input content are returned in results/errors.
 * This does not certify the mapping, key provenance or non-key record fields.
 */
export function fingerprintBusinessKeys(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !COMPANIES.includes(input.companyKey) || !DATASETS.includes(input.dataset) ||
      Object.keys(input).some(k => !['companyKey', 'dataset', 'keys'].includes(k)) ||
      !Array.isArray(input.keys) || input.keys.length > 10000)
    throw new Error('INVALID_CANONICAL_FINGERPRINT_INPUT');
  const seen = new Set(), buffers = [];
  for (const value of input.keys) {
    if (typeof value !== 'string' || !value ||
        value.normalize('NFC') !== value || value !== value.trim() ||
        /[\u0000-\u001f\u007f]/u.test(value))
      throw new Error('NONCANONICAL_BUSINESS_KEY');
    const bytes = Buffer.from(value, 'utf8');
    if (bytes.length > 256) throw new Error('BUSINESS_KEY_TOO_LONG');
    if (seen.has(value)) throw new Error('DUPLICATE_BUSINESS_KEY');
    seen.add(value);
    buffers.push(bytes);
  }
  buffers.sort(Buffer.compare);
  const hash = createHash('sha256'), LF = String.fromCharCode(10);
  if (buffers.length) {
    hash.update([CANONICALIZATION, input.companyKey, input.dataset, ''].join(LF));
    for (const bytes of buffers) {
      hash.update(String(bytes.length) + ':');
      hash.update(bytes);
      hash.update(LF);
    }
  }
  return {
    companyKey: input.companyKey,
    dataset: input.dataset,
    count: buffers.length,
    sha256: hash.digest('hex'),
    canonicalization: CANONICALIZATION,
    provenance: 'CALLER_SUPPLIED_KEYS_NOT_INDEPENDENTLY_VERIFIED',
    dataQualityChecks: 'NOT_RUN',
  };
}

export function emptyTemplate() {
  return {
    version: 1, capturedAt: 'UTC-YYYY-MM-DDTHH:MM:SSZ',
    companies: COMPANIES.map(businessKey => ({ businessKey, sourceCompanyCode: 'FILL_REAL_CODE', targetCompanyCode: 'FILL_REAL_CODE' })),
    source: { kind: 'ERP_COMMIT_OR_EXTERNAL_REGISTER', releaseSha: 'OPTIONAL_FOR_ERP_COMMIT',
      externalReference: 'REQUIRED_FOR_EXTERNAL_REGISTER', capturedAt: 'UTC-YYYY-MM-DDTHH:MM:SSZ',
      canonicalization: CANONICALIZATION, datasets: [] },
    target: { releaseSha: 'FILL_40_SHA', capturedAt: 'UTC-YYYY-MM-DDTHH:MM:SSZ', canonicalization: CANONICALIZATION, datasets: [] },
    datasetRowShape: { companyKey: 'MKE_OR_TCJ', dataset: 'ONE_OF_DOCUMENTED_DATASETS', count: null,
      sha256: 'CANONICAL_ROW_DIGEST_SHA256', rejectedRows: null, duplicateRows: null, foreignCompanyReferences: null },
    datasetKinds: DATASETS,
    currencyPolicy: { newDocumentCurrency: 'THB', legacyCurrencyProvenancePreserved: false },
    handoff: { scopeReference: 'OWNER_SCOPE_APPROVAL_REFERENCE_REQUIRED', openingBalances: 'UNVERIFIED',
      accounting: 'UNVERIFIED', trainingRecorded: false, rollbackPlanRecorded: false },
  };
}
async function main(args) {
  if (args.length === 1 && args[0] === '--template') {
    process.stdout.write(JSON.stringify(emptyTemplate(), null, 2) + '\n');
    return;
  }
  if (args.length === 2 && args[0] === '--fingerprint') {
    const bytes = await readFile(resolve(args[1]));
    if (bytes.length > 1024 * 1024) throw Error('INPUT_TOO_LARGE');
    let data;
    try { data = JSON.parse(bytes.toString('utf8')); } catch { throw Error('INVALID_JSON'); }
    process.stdout.write(JSON.stringify(fingerprintBusinessKeys(data), null, 2) + String.fromCharCode(10));
    return;
  }
  if (args.length !== 2 || args[0] !== '--evaluate') throw Error('USAGE_TEMPLATE_OR_EVALUATE');
  const bytes = await readFile(resolve(args[1]));
  if (bytes.length > 256 * 1024) throw Error('INPUT_TOO_LARGE');
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { throw Error('INVALID_JSON'); }
  const result = assessOnboarding(data);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.gaps.length) process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(() => {
    // Do not leak source/target file paths, secrets or sensitive field values.
    process.stderr.write('GL09_ONBOARDING_PREFLIGHT_BLOCKED\n');
    process.exitCode = 2;
  });
}
