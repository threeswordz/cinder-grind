import assert from 'node:assert/strict';
export const transferCatalog=[
  {
    "id": "d1170010-0000-4000-8000-000000000001",
    "permission_code": "inventory.transfer.configure",
    "module_code": "INVENTORY",
    "description": "Enable synthetic dispatch/receipt transfer policy"
  },
  {
    "id": "d1170010-0000-4000-8000-000000000002",
    "permission_code": "inventory.transfer.dispatch",
    "module_code": "INVENTORY",
    "description": "Dispatch approved origin stock"
  },
  {
    "id": "d1170010-0000-4000-8000-000000000003",
    "permission_code": "inventory.transfer.receipt_view",
    "module_code": "INVENTORY",
    "description": "View destination-scoped transfer receipts"
  },
  {
    "id": "d1170010-0000-4000-8000-000000000004",
    "permission_code": "inventory.transfer.receive",
    "module_code": "INVENTORY",
    "description": "Acknowledge destination stock as configured Store"
  },
  {
    "id": "d1170010-0000-4000-8000-000000000005",
    "permission_code": "inventory.transfer.receive_assigned",
    "module_code": "INVENTORY",
    "description": "Acknowledge stock only as explicitly assigned destination Employee"
  },
  {
    "id": "d1170010-0000-4000-8000-000000000006",
    "permission_code": "inventory.transfer.assign_receiver",
    "module_code": "INVENTORY",
    "description": "Explicitly assign destination receiving Employee"
  }
];
export function verifyTransferCatalog(rows,required=false){if(!rows.length&&!required)return;assert.equal(rows.length,transferCatalog.length);for(const expected of transferCatalog){const row=rows.find(r=>r.id===expected.id);assert.ok(row);const {created_at,...fields}=row;if(created_at!==undefined)assert.ok(Number.isFinite(new Date(created_at).getTime()));assert.deepEqual(fields,expected);}}
