import { Alert, Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { GoodsReceiptsPanel } from './GoodsReceiptsPanel';
import { WarehousesPanel } from './WarehousesPanel';

export function InventoryWorkspace({ permissions }: { permissions: string[] }) {
  const canSeeWarehouses = permissions.includes('inventory.warehouse.view');
  const canSeeReceipts = permissions.includes('inventory.receipt.view');
  const [selected, setSelected] = useState<'warehouses' | 'receipts'>(
    canSeeWarehouses ? 'warehouses' : 'receipts',
  );
  if (!canSeeWarehouses && !canSeeReceipts) {
    return <Alert severity="info">Inventory view permission is required.</Alert>;
  }
  const active = selected === 'warehouses' && canSeeWarehouses
    ? 'warehouses'
    : canSeeReceipts ? 'receipts' : 'warehouses';
  return (
    <Stack spacing={2}>
      <Tabs value={active} onChange={(_event, value: 'warehouses' | 'receipts') => setSelected(value)}>
        {canSeeWarehouses ? <Tab value="warehouses" label="Warehouses" /> : null}
        {canSeeReceipts ? <Tab value="receipts" label="Goods Receipts" /> : null}
      </Tabs>
      {active === 'warehouses'
        ? <WarehousesPanel permissions={permissions} />
        : <GoodsReceiptsPanel permissions={permissions} />}
    </Stack>
  );
}
