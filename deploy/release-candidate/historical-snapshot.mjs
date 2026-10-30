import {hrTables} from './hr-schema-contract.mjs';
import {hrDocumentTables} from './hr-document-schema-contract.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const addedTables = ['customer_boq_versions', 'customer_boq_edits', 'customer_boq_lines', 'customer_boq_mappings', 'customer_boq_replays'];
const emptyDigest = createHash('sha256').update('').digest('hex');

// The source snapshot was taken by the actual old runtime. Only the exact new
// empty tables may be absent there; every pre-existing table/hash stays strict.
export function assertHistoricalTables(before, after, hrApproved = false, hrDocumentApproved = false) {
  const extra = Object.keys(after).filter((name) => !Object.hasOwn(before, name));
  if (hrApproved) assert.ok(hrTables.every(name => !Object.hasOwn(before,name) && extra.includes(name)), 'Complete new HR table group required');
  if (hrDocumentApproved) assert.ok(hrDocumentTables.every(name => !Object.hasOwn(before,name) && extra.includes(name)), 'Complete new HR attachment table group required');
  if (extra.length) {
    const expected = [...(hrApproved ? hrTables : []), ...(hrDocumentApproved ? hrDocumentTables : []),
      ...(!Object.hasOwn(before,'customer_boq_versions') ? addedTables : [])];
    assert.deepEqual([...extra].sort(), [...expected].sort(), 'Unexpected/partial schema addition in historical snapshot');
    for (const name of extra) assert.deepEqual(after[name], { count: '0', digest: emptyDigest }, 'New table must be empty before integrity verification');
  }
  const retained = Object.fromEntries(Object.entries(after).filter(([name]) => !extra.includes(name)));
  assert.deepEqual(retained, before, 'Historical business/approval/stock/Finance/audit rows changed');
}
