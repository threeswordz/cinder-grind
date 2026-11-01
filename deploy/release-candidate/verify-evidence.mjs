import { readFileSync } from 'node:fs';

function fail(message) {
  process.stderr.write('V1.0-E evidence verification failed: ' + message + '\n');
  process.exit(1);
}

function read(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(label + ' is missing or invalid JSON: ' + (error instanceof Error ? error.message : String(error)));
  }
}

const rehearsalPath = process.argv[2];
const recoveryPath = process.argv[3];
if (!rehearsalPath || !recoveryPath) {
  fail('usage: node verify-evidence.mjs <rehearsal.json> <recovery.json>');
}

const rehearsal = read(rehearsalPath, 'rehearsal evidence');
const recovery = read(recoveryPath, 'recovery evidence');
const expected = process.env.RELEASE_COMMIT ?? process.env.GITHUB_SHA;
if (!expected || !/^[0-9a-f]{40}$/i.test(expected)) fail('exact expected release SHA is unavailable');

if (rehearsal.releaseCommit !== expected || recovery.releaseCommit !== expected) {
  fail('evidence release SHA does not match the exact workflow commit');
}

const hrDocumentSchema = typeof rehearsal.releaseMode === 'string' &&
  rehearsal.releaseMode.startsWith('migration-aware-hr-document-');
const historicalMode = !hrDocumentSchema ? rehearsal.releaseMode :
  rehearsal.releaseMode === 'migration-aware-hr-document-schema' ? 'migration-aware-sql-only' :
  'migration-aware-' + rehearsal.releaseMode.slice('migration-aware-hr-document-'.length);
if (['migration-aware-sql-only', 'migration-aware-thb-schema', 'migration-aware-customer-boq-schema', 'migration-aware-hr-schema', 'migration-aware-hr-customer-boq-schema'].includes(historicalMode) &&
    (!hrDocumentSchema || ['migration-aware-hr-document-schema', 'migration-aware-hr-document-thb-schema',
      'migration-aware-hr-document-customer-boq-schema', 'migration-aware-hr-document-hr-schema',
      'migration-aware-hr-document-hr-customer-boq-schema'].includes(rehearsal.releaseMode))) {
  const customerSchema = ['migration-aware-customer-boq-schema','migration-aware-hr-customer-boq-schema'].includes(historicalMode);
  const hrSchema = ['migration-aware-hr-schema','migration-aware-hr-customer-boq-schema'].includes(historicalMode);
  const schemaAware = rehearsal.releaseMode !== 'migration-aware-sql-only';
  if (rehearsal.version !== (hrDocumentSchema ? 8 : hrSchema ? (customerSchema ? 7 : 6) : customerSchema ? 5 : schemaAware ? 4 : 3)) fail('migration-aware rehearsal evidence schema version does not match its mode');
  if (schemaAware) {
    if (!/^[0-9a-f]{40}$/.test(rehearsal.previousReleaseCommit ?? '') ||
        rehearsal.previousRuntimeCommit !== rehearsal.previousReleaseCommit) {
      fail('restored previous runtime identity does not match the pre-upgrade release');
    }
    for (const key of ['boundedSchemaContract','previousRuntimeClientBuild',
      'restoredPreviousRuntimeAuthenticationDownload']) {
      if (rehearsal[key] !== 'PASS') fail('schema-aware rehearsal gate ' + key + ' did not PASS');
    }
    if (customerSchema && rehearsal.customerBoqPersistenceUpgrade !== 'PASS') fail('Customer BOQ upgrade/persistence proof did not PASS');
    if (hrSchema || hrDocumentSchema) {
      for (const key of ['hrPredecessorPreservation','hrPredecessorRollback','hrEmployeeUpgradeTests','hrEncryptedRecordRecovery']) if (rehearsal[key] !== 'PASS') fail('HR upgrade proof ' + key + ' did not PASS');
      if (hrSchema && !rehearsal.migrationNames?.includes('20261029140000_hr1_a_employee_access')) fail('Exact bounded HR migration missing');
      if (rehearsal.hrPrivateAttachmentRecovery !== (hrDocumentSchema ? 'PASS' : 'NOT_IMPLEMENTED_THIS_INCREMENT')) fail('HR attachment recovery proof missing or misreported');
    }
    if (hrDocumentSchema) {
      if (!rehearsal.migrationNames?.includes('20261030160000_hr1_a_document_custody')) fail('Exact bounded HR attachment migration missing');
      for (const key of ['hrDocumentCustodyUpgrade','hrDocumentSchemaOnly']) if (rehearsal[key] !== 'PASS') fail('HR attachment custody upgrade ' + key + ' did not PASS');
    }
    if ((!customerSchema && !hrSchema) || rehearsal.migrationNames?.some((name) => name.endsWith('_v1_2_thb_monetary_policy'))) {
      for (const key of ['genuineLegacySgdNullFixture', 'historicalRowsUnchanged']) {
        if (rehearsal[key] !== 'PASS') fail('historical migration proof ' + key + ' did not PASS');
      }
    }
    if (rehearsal.migrationNames?.some((name) => name.endsWith('_v1_2_thb_monetary_policy')) && rehearsal.thbPolicyUpgrade !== 'PASS') {
      fail('THB policy upgrade/correction proof did not PASS');
    }
  } else if (rehearsal.prismaSchemaUnchanged !== 'PASS') {
    fail('SQL-only rehearsal must prove unchanged Prisma schema');
  }
  if (!rehearsal.toolVersions || typeof rehearsal.toolVersions !== 'object') {
    fail('migration-aware tool/runtime provenance is missing');
  }
  for (const key of ['git', 'node', 'pnpm', 'postgresqlClient', 'openssl']) {
    if (typeof rehearsal.toolVersions[key] !== 'string' || rehearsal.toolVersions[key].trim() === '') {
      fail('migration-aware tool/runtime provenance ' + key + ' is missing');
    }
  }

  if (!rehearsal.ci || typeof rehearsal.ci !== 'object') fail('migration-aware CI provenance is missing');
  if (process.env.GITHUB_ACTIONS !== 'true') {
    fail('migration-aware PASS requires consolidation inside the matching GitHub Actions run');
  }
  const migrationExpectedCi = {
    provider: 'github-actions',
    workflow: process.env.GITHUB_WORKFLOW,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: process.env.GITHUB_RUN_ID,
    runNumber: process.env.GITHUB_RUN_NUMBER,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    job: process.env.GITHUB_JOB,
    repository: process.env.GITHUB_REPOSITORY,
  };
  for (const [key, value] of Object.entries(migrationExpectedCi)) {
    if (!value) fail('expected GitHub Actions provenance ' + key + ' is unavailable');
    if (rehearsal.ci[key] !== value) {
      fail('migration-aware CI provenance ' + key + ' does not match the current GitHub Actions run');
    }
  }

  for (const key of [
    'exactCheckout',
    'cleanTree',
    'migrationHistoryChanged',
    'forwardOnlyNewMigrations',
    'freshMigration',
    'previousReleaseFixture',
    'verifiedRecoveryPoint',
    'productionPreparation',
    'migrationAwareUpgrade',
    'authenticatedLiveAcceptance',
    'productionSafeSmoke',
    'rollbackRestore',
    'rollbackPreviousMigrationStatus',
    'rollbackCandidateMigrationsAbsent',
    'rollbackDocuments',
    'applicationOnlyRollbackProhibited',
    'rollbackReadiness',
  ]) {
    if (rehearsal[key] !== 'PASS') fail('migration-aware rehearsal gate ' + key + ' did not PASS');
  }
  if (!Array.isArray(rehearsal.migrationNames) || rehearsal.migrationNames.length === 0) {
    fail('migration-aware evidence is missing forward migration names');
  }
  for (const name of rehearsal.migrationNames) {
    if (typeof name !== 'string' || !/^[0-9]{14}_[A-Za-z0-9_]+$/.test(name)) {
      fail('migration-aware evidence contains an invalid migration name');
    }
  }
  for (const key of ['pairedRecoverySet', 'isolatedRestore', 'restoredRuntimeAuthentication']) {
    if (recovery[key] !== 'PASS') fail('recovery gate ' + key + ' did not PASS');
  }

  const migrationConsolidated = {
    version: hrDocumentSchema ? 8 : customerSchema ? 5 : schemaAware ? 4 : 3,
    releaseMode: rehearsal.releaseMode,
    releaseCommit: expected,
    provenance: {
      toolVersions: rehearsal.toolVersions,
      ci: rehearsal.ci,
    },
    acceptance: {
      'AC-V10-035': 'PASS',
      'AC-V10-036': 'PASS',
      'AC-V10-037': 'PASS',
      'AC-V10-038': 'PASS',
      'AC-V10-039': 'HUMAN_GATE_NOT_COMPLETED',
      'AC-V10-040': 'HUMAN_GATE_NOT_COMPLETED',
    },
    rehearsal,
    recovery,
  };
  process.stdout.write(JSON.stringify(migrationConsolidated, null, 2) + '\n');
  process.exit(0);
}

if (rehearsal.releaseMode !== undefined) fail('unknown rehearsal release mode');
if (rehearsal.version !== 2) fail('rehearsal evidence schema version is not 2');

if (!rehearsal.toolVersions || typeof rehearsal.toolVersions !== 'object') {
  fail('tool/runtime provenance is missing');
}
for (const key of ['git', 'node', 'pnpm', 'postgresqlClient', 'openssl']) {
  if (typeof rehearsal.toolVersions[key] !== 'string' || rehearsal.toolVersions[key].trim() === '') {
    fail('tool/runtime provenance ' + key + ' is missing');
  }
}

if (!rehearsal.ci || typeof rehearsal.ci !== 'object') fail('CI provenance is missing');
if (process.env.GITHUB_ACTIONS !== 'true') {
  fail('AC-V10-036 PASS requires consolidation inside the matching GitHub Actions run; native rehearsal evidence alone is insufficient');
}
const expectedCi = {
  provider: 'github-actions',
  workflow: process.env.GITHUB_WORKFLOW,
  workflowRef: process.env.GITHUB_WORKFLOW_REF,
  runId: process.env.GITHUB_RUN_ID,
  runNumber: process.env.GITHUB_RUN_NUMBER,
  runAttempt: process.env.GITHUB_RUN_ATTEMPT,
  job: process.env.GITHUB_JOB,
  repository: process.env.GITHUB_REPOSITORY,
};
for (const [key, value] of Object.entries(expectedCi)) {
  if (!value) fail('expected GitHub Actions provenance ' + key + ' is unavailable');
  if (rehearsal.ci[key] !== value) {
    fail('CI provenance ' + key + ' does not match the current GitHub Actions run');
  }
}

for (const key of [
  'exactCheckout',
  'cleanTree',
  'migrationHistoryUnchanged',
  'prismaSchemaUnchanged',
  'freshMigration',
  'upgradeRehearsal',
  'verifiedRecoveryPoint',
  'productionPreparation',
  'authenticatedLiveAcceptance',
  'productionSafeSmoke',
  'rollbackReadiness',
]) {
  if (rehearsal[key] !== 'PASS') fail('rehearsal gate ' + key + ' did not PASS');
}

for (const key of ['pairedRecoverySet', 'isolatedRestore', 'restoredRuntimeAuthentication']) {
  if (recovery[key] !== 'PASS') fail('recovery gate ' + key + ' did not PASS');
}

const consolidated = {
  version: 2,
  releaseCommit: expected,
  provenance: {
    toolVersions: rehearsal.toolVersions,
    ci: rehearsal.ci,
  },
  acceptance: {
    'AC-V10-035': 'PASS',
    'AC-V10-036': 'PASS',
    'AC-V10-037': 'PASS',
    'AC-V10-038': 'PASS',
    'AC-V10-039': 'HUMAN_GATE_NOT_COMPLETED',
    'AC-V10-040': 'HUMAN_GATE_NOT_COMPLETED',
  },
  rehearsal,
  recovery,
};
process.stdout.write(JSON.stringify(consolidated, null, 2) + '\n');
