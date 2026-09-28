import { apiRequest } from './client';

type Data<T> = { data: T };

export type InventoryProject = {
  id: string;
  projectCode: string;
  projectName: string;
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

function query(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, value);
  }
  return path + (search.toString() ? '?' + search.toString() : '');
}

export const inventoryApi = {
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

  reactivateWarehouse: (id: string) =>
    apiRequest<Data<WarehouseRecord>>(
      '/inventory/warehouses/' + id + '/reactivate',
      { method: 'POST' },
    ),
};
