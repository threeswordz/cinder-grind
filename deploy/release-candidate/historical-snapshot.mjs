import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const addedTables = ['customer_boq_versions', 'customer_boq_edits', 'customer_boq_lines', 'customer_boq_mappings', 'customer_boq_replays'];
const emptyDigest = createHash('sha256').update('').digest('hex');

// The source snapshot was taken by the actual old runtime. Only the exact new
// empty tables may be absent there; every pre-existing table/hash stays strict.
export function assertHistoricalTables(before, after) {
  const extra = Object.keys(after).filter((name) => !Object.hasOwn(before, name));
  if (extra.length) {
    assert.deepEqual([...extra].sort(), [...addedTables].sort(), 'Unexpected/partial schema addition in historical snapshot');
    for (const name of extra) assert.deepEqual(after[name], { count: '0', digest: emptyDigest }, 'New Customer BOQ table must be empty before integrity verification');
  }
  const retained = Object.fromEntries(Object.entries(after).filter(([name]) => !extra.includes(name)));
  assert.deepEqual(retained, before, 'Historical business/approval/stock/Finance/audit rows changed');
}
