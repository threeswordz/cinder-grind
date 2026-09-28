import { Alert, Stack, Tab, Tabs } from '@mui/material';
import { useState } from 'react';

import { GoodsReceiptsPanel } from './GoodsReceiptsPanel';
import { MaterialIssuesPanel } from './MaterialIssuesPanel';
import { MaterialReservationsPanel } from './MaterialReservationsPanel';
import { MaterialReturnsPanel } from './MaterialReturnsPanel';
import { StockBalancePanel } from './StockBalancePanel';
import { StockTransfersPanel } from './StockTransfersPanel';
import { InventoryReportsPanel } from './InventoryReportsPanel';
import { WarehousesPanel } from './WarehousesPanel';

type InventoryTab =
  | 'warehouses'
  | 'receipts'
  | 'stock'
  | 'reservations'
  | 'issues'
  | 'returns'
  | 'transfers'
  | 'reports';

export function InventoryWorkspace({ permissions }: { permissions: string[] }) {
  const canSeeWarehouses = permissions.includes('inventory.warehouse.view');
  const canSeeReceipts = permissions.includes('inventory.receipt.view');
  const canSeeStock = permissions.includes('inventory.stock.view');
  const canSeeReservations = permissions.includes('inventory.reservation.view');
  const canSeeIssues = permissions.includes('inventory.issue.view');
  const canSeeReturns = permissions.includes('inventory.return.view');
  const canSeeTransfers = permissions.includes('inventory.transfer.view');
  const canSeeReports = permissions.includes('inventory.report.view');
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
            : canSeeReturns
              ? 'returns'
              : canSeeTransfers
                ? 'transfers'
                : 'reports';
  const [selected, setSelected] = useState<InventoryTab>(first);
  if (
    !canSeeWarehouses &&
    !canSeeReceipts &&
    !canSeeStock &&
    !canSeeReservations &&
    !canSeeIssues &&
    !canSeeReturns &&
    !canSeeTransfers &&
    !canSeeReports
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
                : selected === 'transfers' && canSeeTransfers
                  ? 'transfers'
                  : selected === 'reports' && canSeeReports
                    ? 'reports'
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
        {canSeeTransfers ? <Tab value="transfers" label="Stock Transfers" /> : null}
        {canSeeReports ? <Tab value="reports" label="Reports" /> : null}
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
      ) : active === 'returns' ? (
        <MaterialReturnsPanel permissions={permissions} />
      ) : active === 'transfers' ? (
        <StockTransfersPanel permissions={permissions} />
      ) : (
        <InventoryReportsPanel />
      )}
    </Stack>
  );
}
