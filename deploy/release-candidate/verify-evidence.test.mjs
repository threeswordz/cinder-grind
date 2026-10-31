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

test('Customer BOQ evidence requires version5, predecessor runtime/restore and executed persistence upgrade', () => {
  const data = { ...evidence('migration-aware-customer-boq-schema'), version: 5,
    migrationNames: ['20261028140000_v1_3_customer_boq_versions'], customerBoqPersistenceUpgrade: 'PASS' };
  delete data.genuineLegacySgdNullFixture; delete data.historicalRowsUnchanged;
  assert.equal(verify(data).status, 0);
  for (const key of ['customerBoqPersistenceUpgrade', 'boundedSchemaContract', 'previousRuntimeClientBuild', 'restoredPreviousRuntimeAuthenticationDownload', 'rollbackDocuments']) {
    const bad = { ...data }; delete bad[key]; assert.notEqual(verify(bad).status, 0, key);
  }
  assert.notEqual(verify({ ...data, version: 4 }).status, 0);
  assert.notEqual(verify({ ...data, migrationNames: [...data.migrationNames, '20261025120000_v1_2_thb_monetary_policy'], thbPolicyUpgrade: 'PASS' }).status, 0);
});

test('bounded HR evidence preserves earlier modes and requires executed preservation, HTTP upgrade and external-key record recovery', () => {
  for (const [mode,version,customer] of [['migration-aware-hr-schema',6,false],['migration-aware-hr-customer-boq-schema',7,true]]) {
    const data={...evidence(mode),version,migrationNames:['20261029140000_hr1_a_employee_access'],
      hrPredecessorPreservation:'PASS',hrPredecessorRollback:'PASS',hrEmployeeUpgradeTests:'PASS',hrEncryptedRecordRecovery:'PASS',
      hrPrivateAttachmentRecovery:'NOT_IMPLEMENTED_THIS_INCREMENT',...(customer?{customerBoqPersistenceUpgrade:'PASS'}:{})};
    delete data.genuineLegacySgdNullFixture;delete data.historicalRowsUnchanged;
    assert.equal(verify(data).status,0);
    for(const key of ['hrPredecessorPreservation','hrPredecessorRollback','hrEmployeeUpgradeTests','hrEncryptedRecordRecovery','boundedSchemaContract','restoredPreviousRuntimeAuthenticationDownload','hrPrivateAttachmentRecovery']) {
      const bad={...data};delete bad[key];assert.notEqual(verify(bad).status,0,key);
    }
    assert.notEqual(verify({...data,version:5}).status,0);
    assert.notEqual(verify({...data,migrationNames:['other']}).status,0);
    assert.notEqual(verify({...data,hrPrivateAttachmentRecovery:'PASS'}).status,0);
    if(customer){const bad={...data};delete bad.customerBoqPersistenceUpgrade;assert.notEqual(verify(bad).status,0);}
  }
});

test('HR document custody recovery evidence requires nonempty DB/store/key/restored API proof', () => {
  const data = { ...evidence('migration-aware-hr-document-hr-schema'), version: 8,
    migrationNames: ['20261029140000_hr1_a_employee_access', '20261030160000_hr1_a_document_custody'],
    hrPredecessorPreservation: 'PASS', hrPredecessorRollback: 'PASS',
    hrEmployeeUpgradeTests: 'PASS', hrEncryptedRecordRecovery: 'PASS',
    hrDocumentCustodyUpgrade: 'PASS', hrDocumentSchemaOnly: 'PASS',
    hrPrivateAttachmentRecovery: 'PASS' };
  delete data.genuineLegacySgdNullFixture; delete data.historicalRowsUnchanged;
  assert.equal(verify(data).status, 0);
  for (const key of ['hrPrivateAttachmentRecovery', 'hrDocumentCustodyUpgrade',
    'hrDocumentSchemaOnly', 'hrEncryptedRecordRecovery']) {
    const broken = { ...data };
    delete broken[key];
    assert.notEqual(verify(broken).status, 0, 'Missing HR recovery evidence: ' + key);
  }
  assert.notEqual(verify({ ...data, hrPrivateAttachmentRecovery: 'NOT_IMPLEMENTED_THIS_INCREMENT' }).status, 0);
  assert.notEqual(verify({ ...data, version: 7 }).status, 0);
});
