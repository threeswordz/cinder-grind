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
  version: 1,
  releaseCommit: expected,
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
