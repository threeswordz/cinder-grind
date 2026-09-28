import { Alert, Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { GoodsReceiptsPanel } from './GoodsReceiptsPanel';
import { MaterialIssuesPanel } from './MaterialIssuesPanel';
import { MaterialReservationsPanel } from './MaterialReservationsPanel';
import { MaterialReturnsPanel } from './MaterialReturnsPanel';
import { StockBalancePanel } from './StockBalancePanel';
import { WarehousesPanel } from './WarehousesPanel';

type InventoryTab =
  | 'warehouses'
  | 'receipts'
  | 'stock'
  | 'reservations'
  | 'issues'
  | 'returns';

export function InventoryWorkspace({ permissions }: { permissions: string[] }) {
  const canSeeWarehouses = permissions.includes('inventory.warehouse.view');
  const canSeeReceipts = permissions.includes('inventory.receipt.view');
  const canSeeStock = permissions.includes('inventory.stock.view');
  const canSeeReservations = permissions.includes('inventory.reservation.view');
  const canSeeIssues = permissions.includes('inventory.issue.view');
  const canSeeReturns = permissions.includes('inventory.return.view');
  const first: InventoryTab = canSeeWarehouses
    ? 'warehouses'
    : canSeeReceipts
      ? 'receipts'
      : canSeeStock
        ? 'stock'
        : canSeeReservations
          ? 'reservations'
          : canSeeIssues
            ? 'issues'
            : 'returns';
  const [selected, setSelected] = useState<InventoryTab>(first);
  if (
    !canSeeWarehouses &&
    !canSeeReceipts &&
    !canSeeStock &&
    !canSeeReservations &&
    !canSeeIssues &&
    !canSeeReturns
  ) {
    return <Alert severity="info">Inventory view permission is required.</Alert>;
  }
  const active: InventoryTab =
    selected === 'warehouses' && canSeeWarehouses
      ? 'warehouses'
      : selected === 'receipts' && canSeeReceipts
        ? 'receipts'
        : selected === 'stock' && canSeeStock
          ? 'stock'
          : selected === 'reservations' && canSeeReservations
            ? 'reservations'
            : selected === 'issues' && canSeeIssues
              ? 'issues'
              : selected === 'returns' && canSeeReturns
                ? 'returns'
                : first;
  return (
    <Stack spacing={2}>
      <Tabs value={active} onChange={(_event, value: InventoryTab) => setSelected(value)}>
        {canSeeWarehouses ? <Tab value="warehouses" label="Warehouses" /> : null}
        {canSeeReceipts ? <Tab value="receipts" label="Goods Receipts" /> : null}
        {canSeeStock ? <Tab value="stock" label="Stock Balance" /> : null}
        {canSeeReservations ? <Tab value="reservations" label="Reservations" /> : null}
        {canSeeIssues ? <Tab value="issues" label="Material Issues" /> : null}
        {canSeeReturns ? <Tab value="returns" label="Material Returns" /> : null}
      </Tabs>
      {active === 'warehouses' ? (
        <WarehousesPanel permissions={permissions} />
      ) : active === 'receipts' ? (
        <GoodsReceiptsPanel permissions={permissions} />
      ) : active === 'stock' ? (
        <StockBalancePanel />
      ) : active === 'reservations' ? (
        <MaterialReservationsPanel permissions={permissions} />
      ) : active === 'issues' ? (
        <MaterialIssuesPanel permissions={permissions} />
      ) : (
        <MaterialReturnsPanel permissions={permissions} />
      )}
    </Stack>
  );
}
