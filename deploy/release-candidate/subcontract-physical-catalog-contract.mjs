import assert from 'node:assert/strict';
export const physicalCatalog = [
  {
    "id": "f0480000-0000-4000-8000-000000000001",
    "permission_code": "subcontracts.physical.view",
    "module_code": "SUBCONTRACTS",
    "description": "View scoped physical observations and held work; no implicit commercial decision authority."
  },
  {
    "id": "f0480000-0000-4000-8000-000000000002",
    "permission_code": "subcontracts.physical.edit",
    "module_code": "SUBCONTRACTS",
    "description": "Capture reasoned physical source revisions for an explicitly controlled new claim."
  },
  {
    "id": "f0480000-0000-4000-8000-000000000003",
    "permission_code": "subcontracts.physical.decide",
    "module_code": "SUBCONTRACTS",
    "description": "Independently decide accepted and held work with explicit accepted monetary allocations."
  },
  {
    "id": "f0480000-0000-4000-8000-000000000004",
    "permission_code": "subcontracts.physical.configure",
    "module_code": "SUBCONTRACTS",
    "description": "Explicitly enable new physical claim provenance in a non-Production synthetic Project."
  }
];
export function verifyPhysicalCatalog(rows, required = false) {
  if (!rows.length && !required) return;
  assert.equal(rows.length, physicalCatalog.length);
  for (const expected of physicalCatalog) {
    const row = rows.find(r => r.id === expected.id); assert.ok(row);
    const { created_at, ...fields } = row;
    if (created_at !== undefined) assert.ok(Number.isFinite(new Date(created_at).getTime()));
    assert.deepEqual(fields, expected);
  }
}
