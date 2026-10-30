import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../docs/ROLE-REQUIREMENTS-2026-10-30/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const inventory = JSON.parse(read('data/requirements-execution.json'));

const roles = {
  ben: '01-ben.md',
  nancy: '02-nancy.md',
  khaimook: '03-khaimook.md',
  jai: '04-jai.md',
  store: '05-store-site.md',
  foreman: '06-foreman.md',
  porn: '07-porn.md',
  koh: '08-koh.md',
};
const expectedLanes = {
  OPERATIONAL_REVIEW_ONLY: 51,
  POLICY_UNRESOLVED: 1,
  FUTURE_GATED: 4,
  EXISTING_CONTROLS: 6,
  MIXED_KEEP_BOUNDARY: 5,
  FUTURE_HR: 14,
  DEFER_ACCOUNTING: 24,
  COUNT_CANDIDATE: 4,
  APPROVED_HR1A: 3,
};
const protectedAssignments = {
  BEN02: 'POLICY_UNRESOLVED',
  BEN03: 'FUTURE_GATED',
  PM03: 'FUTURE_GATED',
  PUR06: 'FUTURE_GATED',
  SS13: 'FUTURE_GATED',
  SS12: 'COUNT_CANDIDATE',
  PM08: 'COUNT_CANDIDATE',
  FM05: 'COUNT_CANDIDATE',
  'NANCY-07': 'COUNT_CANDIDATE',
  'KOH-01': 'APPROVED_HR1A',
  'KOH-02': 'APPROVED_HR1A',
  'NANCY-12': 'APPROVED_HR1A',
  'PORN-HR-01': 'MIXED_KEEP_BOUNDARY',
  'PORN-BOQ-01': 'EXISTING_CONTROLS',
  'PORN-SUB-01': 'EXISTING_CONTROLS',
  'NANCY-02': 'DEFER_ACCOUNTING',
  'NANCY-03': 'DEFER_ACCOUNTING',
  'NANCY-08': 'DEFER_ACCOUNTING',
  'NANCY-09': 'DEFER_ACCOUNTING',
};

function verifyInventory(value) {
  assert.equal(value.schema, 'execution-baseline-v2');
  assert.equal(value.governing_issue, 288);
  assert.equal(value.original_records, 112);
  assert.ok(Array.isArray(value.records));
  assert.equal(value.records.length, 112);
  const ids = new Set();
  const laneCounts = Object.fromEntries(Object.keys(expectedLanes).map((lane) => [lane, 0]));
  for (const row of value.records) {
    assert.match(row.id, /^[A-Z][A-Z0-9-]+$/, 'Stable requirement ID is required');
    assert.ok(!ids.has(row.id), 'Duplicate requirement ID: ' + row.id);
    ids.add(row.id);
    assert.equal(row.source_file, roles[row.role], 'Role/source mismatch for ' + row.id);
    assert.ok(Object.hasOwn(laneCounts, row.execution_lane), 'Unknown lane for ' + row.id);
    assert.match(row.original_risk, /^L[012]$/, 'Original risk evidence must remain separate');
    assert.ok(typeof row.implementation_observation === 'string' && row.implementation_observation.length > 0,
      'Frozen code observation is required for ' + row.id);
    assert.ok(typeof row.title === 'string' && row.title.length > 0, 'Title is required for ' + row.id);
    laneCounts[row.execution_lane] += 1;
  }
  assert.deepEqual(laneCounts, expectedLanes, 'Owner-approved execution census changed');
  for (const [id, lane] of Object.entries(protectedAssignments)) {
    assert.equal(value.records.find((row) => row.id === id)?.execution_lane, lane,
      'Change in execution authority needs explicit Owner disposition: ' + id);
  }
  for (const row of value.records.filter((item) => item.role === 'porn' && item.id.startsWith('ACC'))) {
    assert.equal(row.execution_lane, 'DEFER_ACCOUNTING', 'Accounting intake reactivated: ' + row.id);
  }
  return ids;
}

test('112 stable requirements preserve #288 accounting deferral, HR1-A scope and count-candidate lanes', () => {
  verifyInventory(inventory);
});

test('each source role document and the published disposition have the same stable IDs', () => {
  const disposition = read('13-execution-disposition.md');
  for (const row of inventory.records) {
    assert.ok(read(row.source_file).includes('## ' + row.id + ' —'),
      'Missing original source section for ' + row.id);
    assert.ok(disposition.includes('| ' + row.id + ' |'),
      'Missing execution-disposition row for ' + row.id);
  }
  assert.match(read('07-porn.md'), /Accounting development is deferred/i);
  assert.match(read('08-koh.md'), /HR-PAYROLL-REQUIREMENTS-TH-2026-10-27\.md/);
});

test('published sequencing retains the original evidence and does not authorize new coding', () => {
  const readme = read('README.md');
  const launch = read('11-launch-scope-and-next-package.md');
  const workflows = read('00-shared-workflows.md');
  assert.match(readme, /#288/);
  assert.match(readme, /#283/);
  assert.match(readme, /#289/);
  assert.match(readme, /deferred/i);
  assert.match(launch, /WF-BUDGET-01/);
  assert.match(launch, /not yet approved for coding/i);
  assert.match(launch, /No repeat|Do not repeat/i);
  assert.match(workflows, /Store Site evidence\s*\|\s*Khaimook/);
  assert.match(workflows, /No Foreman variance\/proposal\/approval authority/);
});

test('contract fails closed on silent priority reversals and corrupted provenance', () => {
  const mutated = (id, patch) => ({
    ...inventory,
    records: inventory.records.map((row) => row.id === id ? { ...row, ...patch } : { ...row }),
  });
  assert.throws(() => verifyInventory(mutated('BEN02', { execution_lane: 'OPERATIONAL_REVIEW_ONLY' })));
  assert.throws(() => verifyInventory(mutated('ACC01', { execution_lane: 'OPERATIONAL_REVIEW_ONLY' })));
  assert.throws(() => verifyInventory(mutated('FM05', { execution_lane: 'OPERATIONAL_REVIEW_ONLY' })));
  assert.throws(() => verifyInventory(mutated('KOH-01', { execution_lane: 'FUTURE_HR' })));
  assert.throws(() => verifyInventory(mutated('SS12', { source_file: '06-foreman.md' })));
  const duplicate = { ...inventory, records: inventory.records.map((row) => ({ ...row })) };
  duplicate.records[1].id = duplicate.records[0].id;
  assert.throws(() => verifyInventory(duplicate));
});
