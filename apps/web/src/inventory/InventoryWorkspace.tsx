import { Alert, Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { GoodsReceiptsPanel } from './GoodsReceiptsPanel';
import { StockBalancePanel } from './StockBalancePanel';
import { WarehousesPanel } from './WarehousesPanel';

type InventoryTab = 'warehouses' | 'receipts' | 'stock';

export function InventoryWorkspace({ permissions }: { permissions: string[] }) {
  const canSeeWarehouses = permissions.includes('inventory.warehouse.view');
  const canSeeReceipts = permissions.includes('inventory.receipt.view');
  const canSeeStock = permissions.includes('inventory.stock.view');
  const first: InventoryTab = canSeeWarehouses
    ? 'warehouses'
    : canSeeReceipts
      ? 'receipts'
      : 'stock';
  const [selected, setSelected] = useState<InventoryTab>(first);
  if (!canSeeWarehouses && !canSeeReceipts && !canSeeStock) {
    return <Alert severity="info">Inventory view permission is required.</Alert>;
  }
  const active: InventoryTab =
    selected === 'warehouses' && canSeeWarehouses
      ? 'warehouses'
      : selected === 'receipts' && canSeeReceipts
        ? 'receipts'
        : canSeeStock
          ? 'stock'
          : canSeeReceipts
            ? 'receipts'
            : 'warehouses';
  return (
    <Stack spacing={2}>
      <Tabs value={active} onChange={(_event, value: InventoryTab) => setSelected(value)}>
        {canSeeWarehouses ? <Tab value="warehouses" label="Warehouses" /> : null}
        {canSeeReceipts ? <Tab value="receipts" label="Goods Receipts" /> : null}
        {canSeeStock ? <Tab value="stock" label="Stock Balance" /> : null}
      </Tabs>
      {active === 'warehouses' ? (
        <WarehousesPanel permissions={permissions} />
      ) : active === 'receipts' ? (
        <GoodsReceiptsPanel permissions={permissions} />
      ) : (
        <StockBalancePanel />
      )}
    </Stack>
  );
}
