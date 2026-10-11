import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(__dirname, '../../../..');

test('V1.0-D CI retains material idempotency/concurrency regressions', () => {
  const apiPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'apps/api/package.json'), 'utf8'),
  ) as { scripts?: { test?: string } };
  const command = apiPackage.scripts?.test ?? '';

  for (const required of [
    'dist/approval/approval.integration.spec.js',
    'dist/procurement/purchase-order.integration.spec.js',
    'dist/subcontracts/subcontracts-claims-concurrency.integration.spec.js',
    'dist/finance/finance.integration.spec.js',
  ]) {
    assert.equal(
      command.includes(required),
      true,
      `API regression command must retain ${required}`,
    );
  }
});

test('V1.0-D operational evidence artifacts are durable repository inputs', () => {
  for (const relativePath of [
    'docs/OPERATIONS-RUNBOOK.md',
    'docs/V1.0-D-CONCURRENCY-EVIDENCE.md',
    'docs/V1.0-D-PERFORMANCE-EVIDENCE.md',
    'apps/api/scripts/v1-0-d-benchmark.mjs',
  ]) {
    assert.equal(
      existsSync(path.join(repoRoot, relativePath)),
      true,
      `Missing V1.0-D evidence artifact: ${relativePath}`,
    );
  }
});
