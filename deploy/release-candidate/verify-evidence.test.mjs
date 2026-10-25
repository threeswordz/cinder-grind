import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

// Synthetic validator inputs only; these do not represent executed rehearsals.
const commit = '1'.repeat(40);
const previous = '2'.repeat(40);
const env = { ...process.env, RELEASE_COMMIT: commit, GITHUB_ACTIONS: 'true',
  GITHUB_WORKFLOW: 'unit-fixture', GITHUB_WORKFLOW_REF: 'fixture', GITHUB_RUN_ID: '1',
  GITHUB_RUN_NUMBER: '1', GITHUB_RUN_ATTEMPT: '1', GITHUB_JOB: 'fixture', GITHUB_REPOSITORY: 'fixture/repository' };
function evidence(mode) {
  const data = { version: mode === 'migration-aware-thb-schema' ? 4 : 3, releaseMode: mode,
    releaseCommit: commit, previousReleaseCommit: previous, previousRuntimeCommit: previous,
    migrationNames: ['20261025110000_v1_2_fixture'],
    toolVersions: Object.fromEntries(['git','node','pnpm','postgresqlClient','openssl'].map((key) => [key, 'unit-fixture'])),
    ci: { provider: 'github-actions', workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF,
      runId: env.GITHUB_RUN_ID, runNumber: env.GITHUB_RUN_NUMBER, runAttempt: env.GITHUB_RUN_ATTEMPT,
      job: env.GITHUB_JOB, repository: env.GITHUB_REPOSITORY } };
  for (const key of ['exactCheckout','cleanTree','migrationHistoryChanged','prismaSchemaUnchanged',
    'forwardOnlyNewMigrations','freshMigration','previousReleaseFixture','verifiedRecoveryPoint',
    'productionPreparation','migrationAwareUpgrade','authenticatedLiveAcceptance','productionSafeSmoke',
    'rollbackRestore','rollbackPreviousMigrationStatus','rollbackCandidateMigrationsAbsent','rollbackDocuments',
    'applicationOnlyRollbackProhibited','rollbackReadiness','boundedSchemaContract','previousRuntimeClientBuild',
    'genuineLegacySgdNullFixture','historicalRowsUnchanged','restoredPreviousRuntimeAuthenticationDownload']) data[key] = 'PASS';
  return data;
}
function verify(data, overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'erp-evidence-validator-test-'));
  try {
    writeFileSync(join(root, 'rehearsal.json'), JSON.stringify(data));
    writeFileSync(join(root, 'recovery.json'), JSON.stringify({ releaseCommit: commit,
      pairedRecoverySet: 'PASS', isolatedRestore: 'PASS', restoredRuntimeAuthentication: 'PASS' }));
    return spawnSync(process.execPath, [new URL('./verify-evidence.mjs', import.meta.url).pathname,
      join(root, 'rehearsal.json'), join(root, 'recovery.json')], { env: { ...env, ...overrides }, encoding: 'utf8' });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

test('SQL-only and schema-aware evidence preserve separate required contracts and human gates', () => {
  for (const mode of ['migration-aware-sql-only','migration-aware-thb-schema']) {
    const result = verify(evidence(mode));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).acceptance['AC-V10-039'], 'HUMAN_GATE_NOT_COMPLETED');
    assert.equal(JSON.parse(result.stdout).acceptance['AC-V10-040'], 'HUMAN_GATE_NOT_COMPLETED');
  }
});

test('schema-aware evidence fails closed for missing history/recovery/runtime proof or wrong identity', () => {
  for (const key of ['boundedSchemaContract','previousRuntimeClientBuild','genuineLegacySgdNullFixture',
    'historicalRowsUnchanged','restoredPreviousRuntimeAuthenticationDownload','rollbackDocuments']) {
    const data = evidence('migration-aware-thb-schema');
    delete data[key];
    assert.notEqual(verify(data).status, 0, key);
  }
  for (const change of [{ previousRuntimeCommit: commit }, { version: 3 },
    { releaseCommit: previous }, { releaseMode: 'unapproved-mode', version: 2 }]) {
    assert.notEqual(verify({ ...evidence('migration-aware-thb-schema'), ...change }).status, 0);
  }
  assert.notEqual(verify(evidence('migration-aware-thb-schema'), { GITHUB_ACTIONS: 'false' }).status, 0);
  assert.notEqual(verify(evidence('migration-aware-thb-schema'), { GITHUB_RUN_ID: '2' }).status, 0);
  const sql = evidence('migration-aware-sql-only');
  delete sql.prismaSchemaUnchanged;
  assert.notEqual(verify(sql).status, 0);
  const policy = evidence('migration-aware-thb-schema');
  policy.migrationNames = ['20261025120000_v1_2_thb_monetary_policy'];
  assert.notEqual(verify(policy).status, 0);
  policy.thbPolicyUpgrade = 'PASS';
  assert.equal(verify(policy).status, 0);
});
