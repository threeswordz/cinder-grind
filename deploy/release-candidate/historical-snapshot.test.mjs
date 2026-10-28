import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { assertHistoricalTables } from './historical-snapshot.mjs';

test('historical table hashes stay exact; only all five empty Customer BOQ tables may be added', () => {
  const before = { projects: { count: '2', digest: 'retained hash' }, audit_logs: { count: '1', digest: 'audit hash' } };
  const empty = { count: '0', digest: createHash('sha256').update('').digest('hex') };
  const additions = Object.fromEntries(['customer_boq_versions','customer_boq_edits','customer_boq_lines','customer_boq_mappings','customer_boq_replays'].map((name) => [name, empty]));
  assertHistoricalTables(before, before);
  assertHistoricalTables(before, { ...before, ...additions });
  for (const after of [
    { ...before, customer_boq_versions: empty },
    { ...before, ...additions, unexpected: empty },
    { ...before, ...additions, customer_boq_versions: { ...empty, count: '1' } },
    { ...before, ...additions, customer_boq_lines: { ...empty, digest: 'changed' } },
    { ...before, ...additions, projects: { ...before.projects, digest: 'changed' } },
    { ...additions, projects: before.projects },
  ]) assert.throws(() => assertHistoricalTables(before, after));
});
