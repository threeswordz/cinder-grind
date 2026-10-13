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
