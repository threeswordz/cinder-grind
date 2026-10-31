import assert from 'node:assert/strict';

export const stockCountCatalog = [
  { id: 'b0310000-0000-4000-8000-000000000001', permission_code: 'inventory.stock_count.view',
    module_code: 'INVENTORY', description: 'View physical stock counts within effective Project scope' },
  { id: 'b0310000-0000-4000-8000-000000000002', permission_code: 'inventory.stock_count.create',
    module_code: 'INVENTORY', description: 'Record a physical stock count draft for a Project site warehouse' },
  { id: 'b0310000-0000-4000-8000-000000000003', permission_code: 'inventory.stock_count.edit',
    module_code: 'INVENTORY', description: 'Correct an unsigned physical stock count draft' },
  { id: 'b0310000-0000-4000-8000-000000000004', permission_code: 'inventory.stock_count.submit',
    module_code: 'INVENTORY', description: 'Submit a physical stock count for independent review' },
  { id: 'b0310000-0000-4000-8000-000000000005', permission_code: 'inventory.stock_count.approve',
    module_code: 'INVENTORY', description: 'Approve or reject physical stock counts and post quantity-only reconciliation' },
];

export function verifyStockCountCatalog(rows, complete = false) {
  if (complete) assert.equal(rows.length, stockCountCatalog.length, 'Complete stock-count permission catalog required');
  for (const row of rows) {
    const expected = stockCountCatalog.find(item => item.id === row.id);
    assert.ok(expected, 'Unapproved stock-count permission identity');
    for (const [key, value] of Object.entries(expected)) assert.equal(row[key], value, 'Stock-count permission definition changed');
  }
}
