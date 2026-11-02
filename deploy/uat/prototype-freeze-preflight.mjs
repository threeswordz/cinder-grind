/**
 * Offline consistency check for a *proposed* synthetic pre-production freeze packet.
 * No network, database, GitHub setting, user grant or production action is performed.
 * This cannot authenticate the evidence referenced in the packet, approve a release,
 * close a GL gate, or mark human UAT as completed.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const EVIDENCE = /^[A-Za-z0-9][A-Za-z0-9._:/#-]{5,199}$/;
const REPO = 'threeswordz/cinder-grind';
const DIGEST = '301b0b292c5d55ca1de08b41b760d52185d9f349fa2763c75eea6bb5f5583e39';
const REQUIRED_PERSONAS = ['Ben', 'Nancy', 'Khaimook', 'Jai', 'Store Site', 'Foreman', 'Koh', 'Porn'];
const REQUIRED_SCOPES = ['material-plan-a', 'material-plan-b', 'material-plan-c', 'material-request',
  'stock-count', 'weekly-report', 'hr1-a', 'boq-v1.3', 'procurement-inventory'];
const REQUIRED_EXCLUSIONS = ['new-accounting', 'later-hr-payroll', 'multi-project-po'];
const REQUIRED_CHECKS = [
  'procurementStock', 'materialPlanIssue', 'materialReturnCount', 'foremanDailyWeekly',
  'boqCommercialPrivacy', 'hrEncryptedDocuments', 'authNegativeMatrix',
  'trilingualUi', 'chromiumBrowser', 'freshMigrationAndUpgrade',
];
const REQUIRED_RECOVERY = ['pairedDatabaseDocuments', 'externalHrKeys',
  'authenticatedRestoredApi', 'ordinaryAndSignedDocumentBytes', 'encryptedHrDocumentBytes',
  'immutableHistoryAndScope'];

function object(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function evidenceRef(v) { return typeof v === 'string' && EVIDENCE.test(v) && !v.includes('://'); }
function sameSet(values, expected) {
  return Array.isArray(values) && values.length === expected.length &&
    values.every(v => typeof v === 'string') && new Set(values).size === expected.length &&
    expected.every(v => values.includes(v));
}

/** Returns only stable gap codes: never prints private packet contents or secrets. */
export function analyzePrototypeFreeze(packet, expectedMainSha) {
  if (!SHA.test(expectedMainSha ?? '')) throw new Error('EXPECTED_MAIN_SHA_INVALID');
  const gaps = [];
  const need = (ok, gap) => { if (!ok) gaps.push(gap); };
  if (!object(packet)) {
    return { status: 'EVIDENCE_PACKET_INCOMPLETE', gaps: ['PACKET_INVALID'],
      evidenceAuthenticityVerified: false, prototypeFreezeCertified: false,
      humanUatCompleted: false, productionAuthorized: false, productionGlGatesClosed: false };
  }
  need(packet.schemaVersion === 1 && packet.repository === REPO, 'PACKET_IDENTITY_INVALID');
  const release = packet.release;
  need(object(release) && release.mainSha === expectedMainSha &&
    release.runtimeSha === expectedMainSha, 'EXACT_RELEASE_IDENTITY_MISSING');
  need(object(release?.mainCi) && release.mainCi.sha === expectedMainSha &&
    release.mainCi.event === 'push' && release.mainCi.conclusion === 'success' &&
    /^https:\/\/github\.com\/threeswordz\/cinder-grind\/actions\/runs\/[1-9]\d*$/.test(release.mainCi.runUrl ?? ''),
  'EXACT_MAIN_CI_EVIDENCE_MISSING');
  // A guarded squash merge changes the commit SHA, so review-head SHA must not
  // be compared to post-merge main. Require explicit source-tree equivalence
  // evidence for all three material increments, without pretending to verify it.
  for (const increment of ['A','B','C']) {
    const review = release?.independentReviews?.[increment];
    need(object(review) && SHA.test(review.headSha ?? '') &&
      review.disposition === 'CLEAN' && review.blockingFindings === 0 &&
      review.unresolvedThreads === 0 && review.integratedTreeEquivalent === true &&
      evidenceRef(review.evidenceId) && evidenceRef(review.treeProofId),
    'INDEPENDENT_REVIEW_EVIDENCE_MISSING_' + increment);
  }
  need(object(release?.toolchain) && release.toolchain.node === '24.21.0' &&
    release.toolchain.pnpm === '12.6.0' && release.toolchain.postgres === '17.11',
  'PINNED_TOOLCHAIN_UNVERIFIED');
  need(evidenceRef(release?.migrationInventoryId) && evidenceRef(release?.limitationsId),
    'RELEASE_INVENTORY_OR_LIMITATIONS_MISSING');

  const scope = packet.scope;
  need(object(scope) && scope.stableRequirementCount === 112 &&
    scope.stableRequirementDigest === DIGEST && evidenceRef(scope.dispositionId),
  'ROLE_112_ID_DISPOSITION_MISSING');
  need(sameSet(scope?.features, REQUIRED_SCOPES), 'PROTOTYPE_FEATURE_SCOPE_INCOMPLETE');
  need(sameSet(scope?.excluded, REQUIRED_EXCLUSIONS) &&
    evidenceRef(scope?.controlledHandoffId), 'DEFERRED_SCOPE_HANDOFF_MISSING');

  const env = packet.environment;
  need(object(env) && env.mode === 'isolated-synthetic' &&
    env.retainedDataUsed === false && env.productionConnected === false &&
    env.companyCode === 'PROTO_A' && env.denialCompanyCode === 'PROTO_B' &&
    env.projectCount >= 2 && Number.isInteger(env.projectCount) &&
    sameSet(env.personas, REQUIRED_PERSONAS) &&
    env.databaseIsolated === true && env.documentsIsolated === true &&
    env.externalHrKeysIsolated === true && env.businessAdminCannotSelfApprove === true &&
    evidenceRef(env.deploymentEvidenceId), 'ISOLATED_RUNTIME_OR_PERSONA_EVIDENCE_MISSING');
  need(object(env?.observedRuntime) && env.observedRuntime.apiSha === expectedMainSha &&
    env.observedRuntime.webSha === expectedMainSha && env.observedRuntime.databaseSchemaSha === expectedMainSha &&
    evidenceRef(env.observedRuntime.evidenceId), 'ACTUAL_RUNTIME_IDENTITY_MISSING');

  for (const check of REQUIRED_CHECKS) {
    const value = packet.checks?.[check];
    need(object(value) && value.result === 'PASS' && value.sha === expectedMainSha &&
      evidenceRef(value.evidenceId), 'TECHNICAL_CHECK_MISSING_' + check);
  }
  need(packet.checks?.chromiumBrowser?.transport === 'authenticated-runtime' &&
    packet.checks?.authNegativeMatrix?.transport === 'authenticated-runtime',
  'AUTHENTICATED_BROWSER_AND_DENIAL_EVIDENCE_MISSING');

  const restore = packet.recovery;
  need(object(restore) && restore.sha === expectedMainSha &&
    restore.sourceTargetSeparated === true &&
    Number.isFinite(restore.observedMinutes) && restore.observedMinutes > 0 &&
    evidenceRef(restore.evidenceId), 'RESTORE_IDENTITY_DURATION_OR_ISOLATION_MISSING');
  for (const key of REQUIRED_RECOVERY) {
    need(restore?.[key] === 'PASS', 'RESTORE_CHECK_MISSING_' + key);
  }
  need(packet.uat?.status === 'DEFERRED_UNTIL_FROZEN_PROTOTYPE' &&
    packet.production?.authorized === false &&
    packet.production?.realGlGateClaims === false,
  'UAT_OR_PRODUCTION_BOUNDARY_INVALID');

  return {
    status: gaps.length ? 'EVIDENCE_PACKET_INCOMPLETE' : 'EVIDENCE_PACKET_STRUCTURALLY_REVIEWABLE',
    gaps,
    evidenceAuthenticityVerified: false,
    prototypeFreezeCertified: false,
    humanUatCompleted: false,
    productionAuthorized: false,
    productionGlGatesClosed: false,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [path, expected] = process.argv.slice(2);
  if (!path || !expected) {
    console.error('Usage: node deploy/uat/prototype-freeze-preflight.mjs PRIVATE_PACKET.json EXPECTED_MAIN_SHA');
    process.exitCode = 2;
  } else {
    try {
      const packet = JSON.parse(await readFile(path, 'utf8'));
      const result = analyzePrototypeFreeze(packet, expected);
      console.log(JSON.stringify(result, null, 2));
      if (result.gaps.length) process.exitCode = 1;
    } catch {
      // Avoid leaking sensitive input file path, data, or JSON parse excerpts.
      console.error('FREEZE_PACKET_READ_OR_VALIDATION_ERROR');
      process.exitCode = 2;
    }
  }
}
