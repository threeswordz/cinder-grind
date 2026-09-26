import { apiRequest } from './client';

type Data<T> = { data: T };

export type Customer = {
  id: string;
  customerCode: string;
  customerName: string;
  registrationNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
};

export type Supplier = {
  id: string;
  supplierCode: string;
  supplierName: string;
  registrationNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
};

export type Employee = {
  id: string;
  employeeCode: string;
  employeeName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
};

export type UnitOfMeasure = {
  id: string;
  uomCode: string;
  uomName: string;
  decimalPlaces: number;
  isActive: boolean;
};

export type Material = {
  id: string;
  materialCode: string;
  materialName: string;
  description: string | null;
  defaultUomId: string;
  materialCategory: string | null;
  isActive: boolean;
  defaultUom: UnitOfMeasure;
};

function query(search: string, active: 'all' | 'true' | 'false'): string {
  const params = new URLSearchParams();
  if (search.trim()) params.set('search', search.trim());
  if (active !== 'all') params.set('active', active);
  const value = params.toString();
  return value ? '?' + value : '';
}

export const masterDataApi = {
  customers: (search = '', active: 'all' | 'true' | 'false' = 'all') =>
    apiRequest<Data<Customer[]>>('/master-data/customers' + query(search, active)),
  createCustomer: (body: Omit<Customer, 'id' | 'isActive'>) =>
    apiRequest<Data<Customer>>('/master-data/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateCustomer: (id: string, body: Partial<Customer>) =>
    apiRequest<Data<Customer>>('/master-data/customers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  suppliers: (search = '', active: 'all' | 'true' | 'false' = 'all') =>
    apiRequest<Data<Supplier[]>>('/master-data/suppliers' + query(search, active)),
  createSupplier: (body: Omit<Supplier, 'id' | 'isActive'>) =>
    apiRequest<Data<Supplier>>('/master-data/suppliers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSupplier: (id: string, body: Partial<Supplier>) =>
    apiRequest<Data<Supplier>>('/master-data/suppliers/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  employees: (search = '', active: 'all' | 'true' | 'false' = 'all') =>
    apiRequest<Data<Employee[]>>('/master-data/employees' + query(search, active)),
  createEmployee: (body: Omit<Employee, 'id' | 'isActive'>) =>
    apiRequest<Data<Employee>>('/master-data/employees', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateEmployee: (id: string, body: Partial<Employee>) =>
    apiRequest<Data<Employee>>('/master-data/employees/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  uoms: (search = '', active: 'all' | 'true' | 'false' = 'all') =>
    apiRequest<Data<UnitOfMeasure[]>>('/master-data/uoms' + query(search, active)),
  createUom: (body: Omit<UnitOfMeasure, 'id' | 'isActive'>) =>
    apiRequest<Data<UnitOfMeasure>>('/master-data/uoms', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateUom: (id: string, body: Partial<UnitOfMeasure>) =>
    apiRequest<Data<UnitOfMeasure>>('/master-data/uoms/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  materials: (search = '', active: 'all' | 'true' | 'false' = 'all') =>
    apiRequest<Data<Material[]>>('/master-data/materials' + query(search, active)),
  createMaterial: (body: {
    materialCode: string;
    materialName: string;
    description?: string | null;
    defaultUomId: string;
    materialCategory?: string | null;
  }) =>
    apiRequest<Data<Material>>('/master-data/materials', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMaterial: (id: string, body: Partial<Material>) =>
    apiRequest<Data<Material>>('/master-data/materials/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};
