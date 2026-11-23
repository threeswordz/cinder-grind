import { OperationalExceptionsPanel } from './OperationalExceptionsPanel';
import { TransferReceiptsPanel } from './TransferReceiptsPanel';
import { transferCustodyLabels } from './transfer-custody-labels';
import { ReceivingPanel } from './ReceivingPanel';
import { receivingLabels } from './receiving-labels';
import { MaterialRequestsPanel } from './MaterialRequestsPanel';
import { MaterialPlansPanel } from './MaterialPlansPanel';
import { materialPlanLabels } from './material-plan-labels';
import { useContext } from 'react';
import { MonetaryLocaleContext } from '../role-ui/monetary-presentation';
import { materialRequestLabels } from './material-request-labels';
import { Alert, Stack, Tab, Tabs } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

import { GoodsReceiptsPanel } from './GoodsReceiptsPanel';
import { MaterialIssuesPanel } from './MaterialIssuesPanel';
import { MaterialReservationsPanel } from './MaterialReservationsPanel';
import { MaterialReturnsPanel } from './MaterialReturnsPanel';
import { StockBalancePanel } from './StockBalancePanel';
import { StockCountsPanel } from './StockCountsPanel';
import { StockTransfersPanel } from './StockTransfersPanel';
import { InventoryReportsPanel } from './InventoryReportsPanel';
import { WarehousesPanel } from './WarehousesPanel';
import type { SourceLinkTarget } from '../role-ui/source-link-policy';

type InventoryTab =
  | 'exceptions'
  | 'transfer-receipts'
  | 'receiving'
  | 'requests'
  | 'plans'
  | 'warehouses'
  | 'receipts'
  | 'stock'
  | 'counts'
  | 'reservations'
  | 'issues'
  | 'returns'
  | 'transfers'
  | 'reports';

export function InventoryWorkspace({
  permissions,
  roleCodes = [],
  userId = '',
  companyId = '',
  initialProjectId,
  initialReceiptId,
  onOpenSource,
}: {
  permissions: string[];
  roleCodes?: string[];
  userId?: string;
  companyId?: string;
  initialProjectId?: string | undefined;
  initialReceiptId?: string | undefined;
  onOpenSource?: ((target: SourceLinkTarget) => void) | undefined;
}) {
  const locale = useContext(MonetaryLocaleContext);
  const requestText = materialRequestLabels[locale];
  const planText = materialPlanLabels[locale];
  const canSeeExceptions = permissions.includes('documents.document.view') && (
    (permissions.includes('inventory.issue.view') && roleCodes.some(r => r === 'STOREKEEPER' || r === 'PROJECT_MANAGER')) ||
    (permissions.includes('inventory.stock.view') && roleCodes.some(r => ['STOREKEEPER','PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(r))) ||
    (permissions.includes('inventory.stock_count.view') && roleCodes.some(r => ['FINANCE_MANAGER','PROJECT_MANAGER','STOREKEEPER'].includes(r)))
  );
  const canSeeTransferReceipts = permissions.includes('inventory.transfer.receipt_view');
  const canSeeReceiving = permissions.includes('inventory.receiving.view');
  const canSeeRequests = permissions.includes('inventory.material_request.view');
  const canSeePlans = permissions.includes('inventory.material_plan.view');
  const canSeeWarehouses = permissions.includes('inventory.warehouse.view');
  const canSeeReceipts = permissions.includes('inventory.receipt.view');
  const canSeeStock = permissions.includes('inventory.stock.view');
  const canSeeCounts = permissions.includes('inventory.stock_count.view');
  const canSeeReservations = permissions.includes('inventory.reservation.view');
  const canSeeIssues = permissions.includes('inventory.issue.view');
  const canSeeReturns = permissions.includes('inventory.return.view');
  const canSeeTransfers = permissions.includes('inventory.transfer.view');
  const canSeeReports = permissions.includes('inventory.report.view');
  const first: InventoryTab = canSeeTransferReceipts ? 'transfer-receipts' : canSeeReceiving ? 'receiving' : canSeeRequests ? 'requests' : canSeePlans ? 'plans' : canSeeWarehouses
    ? 'warehouses'
    : canSeeReceipts
      ? 'receipts'
      : canSeeStock
        ? 'stock'
        : canSeeCounts
          ? 'counts'
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
  const appliedReceiptProjectSourceLink = useRef('');
  const appliedReceiptSourceLink = useRef('');
  const [receivingGr, setReceivingGr] = useState<{projectId:string;id:string}|null>(null);
  useEffect(() => {
    if (initialReceiptId && canSeeReceipts) setSelected('receipts');
  }, [initialReceiptId, canSeeReceipts]);
  if (
    !canSeeExceptions &&
    !canSeeTransferReceipts &&
    !canSeeReceiving &&
    !canSeeRequests &&
    !canSeePlans &&
    !canSeeWarehouses &&
    !canSeeReceipts &&
    !canSeeStock &&
    !canSeeCounts &&
    !canSeeReservations &&
    !canSeeIssues &&
    !canSeeReturns &&
    !canSeeTransfers &&
    !canSeeReports
  ) {
    return <Alert severity="info">Inventory view permission is required.</Alert>;
  }
  const active: InventoryTab =
    selected === 'exceptions' && canSeeExceptions ? 'exceptions' : selected === 'transfer-receipts' && canSeeTransferReceipts ? 'transfer-receipts' : selected === 'receiving' && canSeeReceiving ? 'receiving' : selected === 'requests' && canSeeRequests ? 'requests' : selected === 'plans' && canSeePlans ? 'plans' : selected === 'warehouses' && canSeeWarehouses
      ? 'warehouses'
      : selected === 'receipts' && canSeeReceipts
        ? 'receipts'
        : selected === 'stock' && canSeeStock
          ? 'stock'
          : selected === 'counts' && canSeeCounts
            ? 'counts'
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
        {canSeeExceptions ? <Tab value="exceptions" label="Operational Exceptions" /> : null}
        {canSeeTransferReceipts ? <Tab value="transfer-receipts" label={transferCustodyLabels[locale].title} /> : null}
        {canSeeReceiving ? <Tab value="receiving" label={receivingLabels[locale].title} /> : null}
        {canSeeRequests ? <Tab value="requests" label={requestText.title} /> : null}
        {canSeePlans ? <Tab value="plans" label={planText.title} /> : null}
        {canSeeWarehouses ? <Tab value="warehouses" label="Warehouses" /> : null}
        {canSeeReceipts ? <Tab value="receipts" label="Goods Receipts" /> : null}
        {canSeeStock ? <Tab value="stock" label="Stock Balance" /> : null}
        {canSeeCounts ? <Tab value="counts" label="Stock Counts" /> : null}
        {canSeeReservations ? <Tab value="reservations" label="Reservations" /> : null}
        {canSeeIssues ? <Tab value="issues" label="Material Issues" /> : null}
        {canSeeReturns ? <Tab value="returns" label="Material Returns" /> : null}
        {canSeeTransfers ? <Tab value="transfers" label="Stock Transfers" /> : null}
        {canSeeReports ? <Tab value="reports" label="Reports" /> : null}
      </Tabs>
      {active === 'exceptions' ? (
        <OperationalExceptionsPanel permissions={permissions} roleCodes={roleCodes} userId={userId} />
      ) : active === 'transfer-receipts' ? (
        <TransferReceiptsPanel permissions={permissions} userId={userId} companyId={companyId}/>
      ) : active === 'receiving' ? (
        <ReceivingPanel permissions={permissions} userId={userId} companyId={companyId} onOpenGr={(projectId,id)=>{appliedReceiptProjectSourceLink.current='';appliedReceiptSourceLink.current='';setReceivingGr({projectId,id});setSelected('receipts');}}/>
      ) : active === 'requests' ? (
        <MaterialRequestsPanel permissions={permissions}/>
      ) : active === 'plans' ? (
        <MaterialPlansPanel permissions={permissions} />
      ) : active === 'warehouses' ? (
        <WarehousesPanel permissions={permissions} />
      ) : active === 'receipts' ? (
        <GoodsReceiptsPanel
          permissions={permissions}
          initialProjectId={receivingGr?.projectId ?? initialProjectId}
          initialReceiptId={receivingGr?.id ?? initialReceiptId}
          appliedProjectSourceLink={appliedReceiptProjectSourceLink}
          appliedReceiptSourceLink={appliedReceiptSourceLink}
          onOpenSource={onOpenSource}
        />
      ) : active === 'stock' ? (
        <StockBalancePanel />
      ) : active === 'counts' ? (
        <StockCountsPanel permissions={permissions} />
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
