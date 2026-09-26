import { masterDataApi } from '../api/master-data';
import { MasterField, SimpleMasterPanel } from './SimpleMasterPanel';

const customerFields: MasterField[] = [
  { key: 'customerCode', label: 'Customer Code', required: true },
  { key: 'customerName', label: 'Customer Name', required: true },
  { key: 'registrationNumber', label: 'Registration Number' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', type: 'multiline' },
];

const supplierFields: MasterField[] = [
  { key: 'supplierCode', label: 'Supplier Code', required: true },
  { key: 'supplierName', label: 'Supplier Name', required: true },
  { key: 'registrationNumber', label: 'Registration Number' },
  { key: 'contactName', label: 'Contact Name' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address', type: 'multiline' },
];

const employeeFields: MasterField[] = [
  { key: 'employeeCode', label: 'Employee Code', required: true },
  { key: 'employeeName', label: 'Employee Name', required: true },
  { key: 'jobTitle', label: 'Job Title' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
];

const uomFields: MasterField[] = [
  { key: 'uomCode', label: 'UOM Code', required: true },
  { key: 'uomName', label: 'UOM Name', required: true },
  {
    key: 'decimalPlaces',
    label: 'Decimal Places',
    required: true,
    type: 'number',
    helperText: 'Allowed range: 0 to 6.',
  },
];

export function CustomersPanel({ canManage }: { canManage: boolean }) {
  return (
    <SimpleMasterPanel
      title="Customers"
      singular="Customer"
      queryKey="customers"
      codeField="customerCode"
      nameField="customerName"
      fields={customerFields}
      canManage={canManage}
      list={masterDataApi.customers}
      create={masterDataApi.createCustomer}
      update={masterDataApi.updateCustomer}
    />
  );
}

export function SuppliersPanel({ canManage }: { canManage: boolean }) {
  return (
    <SimpleMasterPanel
      title="Suppliers"
      singular="Supplier"
      queryKey="suppliers"
      codeField="supplierCode"
      nameField="supplierName"
      fields={supplierFields}
      canManage={canManage}
      list={masterDataApi.suppliers}
      create={masterDataApi.createSupplier}
      update={masterDataApi.updateSupplier}
    />
  );
}

export function EmployeesPanel({ canManage }: { canManage: boolean }) {
  return (
    <SimpleMasterPanel
      title="Employees"
      singular="Employee"
      queryKey="employees"
      codeField="employeeCode"
      nameField="employeeName"
      fields={employeeFields}
      canManage={canManage}
      list={masterDataApi.employees}
      create={masterDataApi.createEmployee}
      update={masterDataApi.updateEmployee}
    />
  );
}

export function UomsPanel({ canManage }: { canManage: boolean }) {
  return (
    <SimpleMasterPanel
      title="Units of Measure"
      singular="Unit of Measure"
      queryKey="uoms"
      codeField="uomCode"
      nameField="uomName"
      fields={uomFields}
      canManage={canManage}
      list={masterDataApi.uoms}
      create={masterDataApi.createUom}
      update={masterDataApi.updateUom}
    />
  );
}
