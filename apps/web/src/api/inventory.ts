import { apiRequest } from './client';

type Data<T> = { data: T };

export type InventoryProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type StockBalanceRecord = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseProjectId: string | null;
  warehouseProjectCode: string | null;
  warehouseProjectName: string | null;
  isSiteWarehouse: boolean;
  warehouseIsActive: boolean;
  materialId: string;
  materialCode: string;
  materialName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  uomId: string;
  uomCode: string;
  quantity: string;
};

export type WarehouseRecord = {
  id: string;
  companyId: string;
  warehouseCode: string;
  warehouseName: string;
  projectId: string | null;
  location: string | null;
  isSiteWarehouse: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project: InventoryProject | null;
};

export type ReceiptPoLine = {
  id: string;
  lineNo: number;
  lineType: string;
  materialCodeSnapshot: string | null;
  description: string;
  quantity: string;
  uomCodeSnapshot: string;
};

export type ReceiptPo = {
  id: string;
  poNumber: string;
  revisionNo: number;
  supplierId: string;
  lines: ReceiptPoLine[];
};

export type GoodsReceipt = {
  id: string;
  receiptNumber: string;
  projectId: string;
  purchaseOrderId: string;
  warehouseId: string;
  supplierId: string;
  remarks: string | null;
  createdAt: string;
  submittedAt: string | null;
  postedAt: string | null;
  reversedAt: string | null;
  approvalInstance: { approvalState: string } | null;
  items?: Array<{ id: string; lineNo: number; description: string; quantity: string; uomCodeSnapshot: string }>;
  stockTransactions?: Array<{ id: string; movementType: string; quantity: string }>;
  _count?: { items: number };
};

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  return path + (search.toString() ? '?' + search.toString() : '');
}

export const inventoryApi = {

  stockProjects: () =>
    apiRequest<Data<InventoryProject[]>>('/inventory/stock-projects'),

  stockBalances: (filters: {
    projectId?: string;
    warehouseId?: string;
    materialId?: string;
    search?: string;
    includeInactiveWarehouses?: boolean;
    includeZero?: boolean;
  } = {}) =>
    apiRequest<Data<StockBalanceRecord[]>>(
      query('/inventory/stock-balances', {
        projectId: filters.projectId,
        warehouseId: filters.warehouseId,
        materialId: filters.materialId,
        search: filters.search,
        includeInactiveWarehouses: filters.includeInactiveWarehouses ? 'true' : undefined,
        includeZero: filters.includeZero ? 'true' : undefined,
      }),
    ),

  projects: () =>
    apiRequest<Data<InventoryProject[]>>('/inventory/projects'),

  warehouses: (filters: {
    includeInactive?: boolean;
    projectId?: string;
    search?: string;
  } = {}) =>
    apiRequest<Data<WarehouseRecord[]>>(
      query('/inventory/warehouses', {
        includeInactive: filters.includeInactive ? 'true' : undefined,
        projectId: filters.projectId,
        search: filters.search,
      }),
    ),

  warehouse: (id: string) =>
    apiRequest<Data<WarehouseRecord>>('/inventory/warehouses/' + id),

  createWarehouse: (body: {
    warehouseCode: string;
    warehouseName: string;
    projectId?: string | null;
    location?: string | null;
    isSiteWarehouse: boolean;
  }) =>
    apiRequest<Data<WarehouseRecord>>('/inventory/warehouses', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateWarehouse: (
    id: string,
    body: Partial<{
      warehouseCode: string;
      warehouseName: string;
      projectId: string | null;
      location: string | null;
      isSiteWarehouse: boolean;
    }>,
  ) =>
    apiRequest<Data<WarehouseRecord>>('/inventory/warehouses/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  archiveWarehouse: (id: string) =>
    apiRequest<Data<WarehouseRecord>>(
      '/inventory/warehouses/' + id + '/archive',
      { method: 'POST' },
    ),

  receiptProjects: () =>
    apiRequest<Data<InventoryProject[]>>('/inventory/receipt-projects'),

  receiptWarehouses: (projectId: string) =>
    apiRequest<Data<Array<{ id: string; warehouseCode: string; warehouseName: string; projectId: string | null }>>>(
      '/inventory/projects/' + projectId + '/receipt-warehouses',
    ),

  eligibleReceiptPos: (projectId: string) =>
    apiRequest<Data<ReceiptPo[]>>('/inventory/projects/' + projectId + '/eligible-receipt-pos'),

  goodsReceipts: (projectId: string) =>
    apiRequest<Data<GoodsReceipt[]>>('/inventory/projects/' + projectId + '/goods-receipts'),

  goodsReceipt: (id: string) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id),

  receiptWorkflows: () =>
    apiRequest<Data<Array<{ workflowCode: string; workflowName: string }>>>('/inventory/receipt-workflows'),

  createGoodsReceipt: (body: {
    projectId: string;
    purchaseOrderId: string;
    warehouseId: string;
    remarks?: string | null;
    lines: Array<{ purchaseOrderLineId: string; quantity: string }>;
  }) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts', {
      method: 'POST', body: JSON.stringify(body),
    }),

  updateGoodsReceipt: (id: string, remarks: string | null) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id, {
      method: 'PATCH', body: JSON.stringify({ remarks }),
    }),

  updateGoodsReceiptItem: (id: string, quantity: string) =>
    apiRequest<Data<{ id: string }>>('/inventory/goods-receipt-items/' + id, {
      method: 'PATCH', body: JSON.stringify({ quantity }),
    }),

  submitGoodsReceipt: (id: string, workflowCode: string) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id + '/submit', {
      method: 'POST', body: JSON.stringify({ workflowCode }),
    }),

  approveGoodsReceipt: (id: string, postKey: string, comment?: string) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id + '/approve', {
      method: 'POST', body: JSON.stringify({ postKey, comment }),
    }),

  rejectGoodsReceipt: (id: string, comment: string) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id + '/reject', {
      method: 'POST', body: JSON.stringify({ comment }),
    }),

  reverseGoodsReceipt: (id: string, reversalKey: string, reason: string) =>
    apiRequest<Data<GoodsReceipt>>('/inventory/goods-receipts/' + id + '/reverse', {
      method: 'POST', body: JSON.stringify({ reversalKey, reason }),
    }),

  reactivateWarehouse: (id: string) =>
    apiRequest<Data<WarehouseRecord>>(
      '/inventory/warehouses/' + id + '/reactivate',
      { method: 'POST' },
    ),
};
