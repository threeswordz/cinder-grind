import { apiRequest } from './client';

export type MasterRecord = {
  id: string;
  isActive: boolean;
  [key: string]: unknown;
};

export type UnitOfMeasure = MasterRecord & {
  uomCode: string;
  uomName: string;
  decimalPlaces: number;
};

export type MaterialRecord = MasterRecord & {
  materialCode: string;
  materialName: string;
  description: string | null;
  defaultUomId: string;
  materialCategory: string | null;
  defaultUom: UnitOfMeasure;
};

type Data<T> = { data: T };

function query(search: string, active: string): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (active !== 'all') params.set('active', active);
  const value = params.toString();
  return value ? '?' + value : '';
}

export const masterDataApi = {
  customers: (search = '', active = 'all') =>
    apiRequest<Data<MasterRecord[]>>(
      '/master-data/customers' + query(search, active),
    ),
  createCustomer: (body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/customers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  suppliers: (search = '', active = 'all') =>
    apiRequest<Data<MasterRecord[]>>(
      '/master-data/suppliers' + query(search, active),
    ),
  createSupplier: (body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSupplier: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/suppliers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  employees: (search = '', active = 'all') =>
    apiRequest<Data<MasterRecord[]>>(
      '/master-data/employees' + query(search, active),
    ),
  createEmployee: (body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEmployee: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<MasterRecord>>('/master-data/employees/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  uoms: (search = '', active = 'all') =>
    apiRequest<Data<UnitOfMeasure[]>>(
      '/master-data/uoms' + query(search, active),
    ),
  createUom: (body: Record<string, unknown>) =>
    apiRequest<Data<UnitOfMeasure>>('/master-data/uoms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUom: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<UnitOfMeasure>>('/master-data/uoms/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  materialUomOptions: () =>
    apiRequest<Data<UnitOfMeasure[]>>('/master-data/material-uom-options'),
  materials: (search = '', active = 'all') =>
    apiRequest<Data<MaterialRecord[]>>(
      '/master-data/materials' + query(search, active),
    ),
  createMaterial: (body: Record<string, unknown>) =>
    apiRequest<Data<MaterialRecord>>('/master-data/materials', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMaterial: (id: string, body: Record<string, unknown>) =>
    apiRequest<Data<MaterialRecord>>('/master-data/materials/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
