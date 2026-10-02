import { apiRequest } from './client';

type Data<T> = { data: T };

export type FinanceProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type FinanceWorkflow = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type SupplierInvoiceOptions = {
  baseCurrencyCode: string;
  suppliers: Array<{
    id: string;
    supplierCode: string;
    supplierName: string;
  }>;
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
  purchaseOrderLines: Array<{
    id: string;
    lineNo: number;
    description: string;
    amount: string;
    purchaseOrder: {
      id: string;
      supplierId: string;
      poNumber: string;
      revisionNo: number;
    };
  }>;
  goodsReceiptItems: Array<{
    id: string;
    lineNo: number;
    description: string;
    purchaseOrderLineId: string | null;
    goodsReceipt: {
      id: string;
      supplierId: string;
      receiptNumber: string;
    };
  }>;
};

export type SupplierInvoiceListItem = {
  id: string;
  companyId: string;
  projectId: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  supplierReference: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  totalAmount: string;
  state: string;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
  };
  approvalInstance: {
    approvalState: string;
  } | null;
  _count: { items: number };
};

export type SupplierInvoiceItem = {
  id: string;
  companyId: string;
  projectId: string;
  supplierInvoiceId: string;
  lineNo: number;
  purchaseOrderLineId: string | null;
  goodsReceiptItemId: string | null;
  wbsId: string | null;
  costCodeId: string | null;
  description: string;
  amount: string;
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: { id: string; costCode: string; costName: string } | null;
  purchaseOrderLine: {
    id: string;
    lineNo: number;
    description: string;
    purchaseOrder: {
      id: string;
      poNumber: string;
      revisionNo: number;
    };
  } | null;
  goodsReceiptItem: {
    id: string;
    lineNo: number;
    description: string;
    goodsReceipt: {
      id: string;
      receiptNumber: string;
    };
  } | null;
};

export type SupplierInvoiceDetail = Omit<
  SupplierInvoiceListItem,
  'approvalInstance' | '_count'
> & {
  project: FinanceProject;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
  };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  items: SupplierInvoiceItem[];
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number | null;
    startedAt: string;
    completedAt: string | null;
    workflow: {
      id: string;
      workflowCode: string;
      workflowName: string;
    };
    actions: Array<{
      id: string;
      action: string;
      actionAt: string;
      comment: string | null;
      approvalStep: {
        stepNo: number;
        stepName: string;
      } | null;
      actionByUser: {
        id: string;
        displayName: string;
      } | null;
    }>;
  } | null;
};

export type SupplierInvoiceLineInput = {
  description: string;
  amount: string;
  purchaseOrderLineId?: string | null;
  goodsReceiptItemId?: string | null;
  wbsId?: string | null;
  costCodeId?: string | null;
};

function postAction<T>(path: string, body: Record<string, unknown>) {
  return apiRequest<Data<T>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const financeApi = {
  projects: () => apiRequest<Data<FinanceProject[]>>('/finance/projects'),
  workflows: () =>
    apiRequest<Data<FinanceWorkflow[]>>(
      '/finance/supplier-invoice-workflow-options',
    ),
  options: (projectId: string) =>
    apiRequest<Data<SupplierInvoiceOptions>>(
      '/finance/projects/' + projectId + '/supplier-invoice-options',
    ),
  list: (projectId: string) =>
    apiRequest<Data<SupplierInvoiceListItem[]>>(
      '/finance/projects/' + projectId + '/supplier-invoices',
    ),
  detail: (invoiceId: string) =>
    apiRequest<Data<SupplierInvoiceDetail>>(
      '/finance/supplier-invoices/' + invoiceId,
    ),
  create: (
    projectId: string,
    body: {
      supplierId: string;
      supplierReference: string;
      invoiceDate: string;
      dueDate?: string | null;
      createKey: string;
      lines: SupplierInvoiceLineInput[];
    },
  ) =>
    postAction<SupplierInvoiceDetail>(
      '/finance/projects/' + projectId + '/supplier-invoices',
      body,
    ),
  update: (
    invoiceId: string,
    body: Partial<{
      supplierReference: string;
      invoiceDate: string;
      dueDate: string | null;
    }>,
  ) =>
    apiRequest<Data<SupplierInvoiceDetail>>(
      '/finance/supplier-invoices/' + invoiceId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  addLine: (invoiceId: string, body: SupplierInvoiceLineInput) =>
    postAction<SupplierInvoiceDetail>(
      '/finance/supplier-invoices/' + invoiceId + '/items',
      body,
    ),
  updateLine: (
    itemId: string,
    body: Partial<SupplierInvoiceLineInput>,
  ) =>
    apiRequest<Data<SupplierInvoiceDetail>>(
      '/finance/supplier-invoice-items/' + itemId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteLine: (itemId: string) =>
    apiRequest<Data<SupplierInvoiceDetail>>(
      '/finance/supplier-invoice-items/' + itemId,
      { method: 'DELETE' },
    ),
  submit: (invoiceId: string, workflowCode: string, actionKey: string) =>
    postAction<SupplierInvoiceDetail>(
      '/finance/supplier-invoices/' + invoiceId + '/submit',
      { workflowCode, actionKey },
    ),
  approve: (
    invoiceId: string,
    actionKey: string,
    comment?: string | null,
  ) =>
    postAction<SupplierInvoiceDetail>(
      '/finance/supplier-invoices/' + invoiceId + '/approve',
      { actionKey, comment: comment ?? null },
    ),
  reject: (
    invoiceId: string,
    actionKey: string,
    comment?: string | null,
  ) =>
    postAction<SupplierInvoiceDetail>(
      '/finance/supplier-invoices/' + invoiceId + '/reject',
      { actionKey, comment: comment ?? null },
    ),
};

export type ClientInvoiceOptions = {
  baseCurrencyCode: string;
  customers: Array<{
    id: string;
    customerCode: string;
    customerName: string;
  }>;
};

export type ClientInvoiceItem = {
  id: string;
  companyId: string;
  projectId: string;
  clientInvoiceId: string;
  lineNo: number;
  description: string;
  amount: string;
};

export type ClientInvoiceListItem = {
  id: string;
  companyId: string;
  projectId: string;
  customerId: string;
  clientInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  totalAmount: string;
  state: string;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    customerCode: string;
    customerName: string;
  };
  approvalInstance: { approvalState: string } | null;
  _count: { items: number };
};

export type ClientInvoiceDetail = Omit<
  ClientInvoiceListItem,
  'approvalInstance' | '_count'
> & {
  project: FinanceProject;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  items: ClientInvoiceItem[];
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number | null;
    startedAt: string;
    completedAt: string | null;
    workflow: { workflowCode: string; workflowName: string };
    actions: Array<{
      id: string;
      action: string;
      actionAt: string;
      comment: string | null;
      approvalStep: { stepNo: number; stepName: string } | null;
      actionByUser: { id: string; displayName: string } | null;
    }>;
  } | null;
};

export type ClientInvoiceLineInput = {
  description: string;
  amount: string;
};

export type AccountsReceivableRow = {
  id: string;
  clientInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  totalAmount: string;
  allocatedAmount: string;
  outstandingAmount: string;
  customer: { id: string; customerCode: string; customerName: string };
};

export type AccountsPayableRow = {
  id: string;
  supplierInvoiceNumber: string;
  supplierReference: string;
  invoiceDate: string;
  dueDate: string | null;
  currencyCode: string;
  totalAmount: string;
  allocatedAmount: string;
  outstandingAmount: string;
  supplier: { id: string; supplierCode: string; supplierName: string };
};

export const clientFinanceApi = {
  projects: () =>
    apiRequest<Data<FinanceProject[]>>('/finance/client-invoice-projects'),
  workflows: () =>
    apiRequest<Data<FinanceWorkflow[]>>('/finance/client-invoice-workflow-options'),
  options: (projectId: string) =>
    apiRequest<Data<ClientInvoiceOptions>>(
      '/finance/projects/' + projectId + '/client-invoice-options',
    ),
  list: (projectId: string) =>
    apiRequest<Data<ClientInvoiceListItem[]>>(
      '/finance/projects/' + projectId + '/client-invoices',
    ),
  detail: (invoiceId: string) =>
    apiRequest<Data<ClientInvoiceDetail>>('/finance/client-invoices/' + invoiceId),
  create: (
    projectId: string,
    body: {
      customerId: string;
      invoiceDate: string;
      dueDate?: string | null;
      createKey: string;
      lines: ClientInvoiceLineInput[];
    },
  ) =>
    postAction<ClientInvoiceDetail>(
      '/finance/projects/' + projectId + '/client-invoices',
      body,
    ),
  update: (
    invoiceId: string,
    body: Partial<{ invoiceDate: string; dueDate: string | null }>,
  ) =>
    apiRequest<Data<ClientInvoiceDetail>>('/finance/client-invoices/' + invoiceId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addLine: (invoiceId: string, body: ClientInvoiceLineInput) =>
    postAction<ClientInvoiceDetail>(
      '/finance/client-invoices/' + invoiceId + '/items',
      body,
    ),
  updateLine: (itemId: string, body: Partial<ClientInvoiceLineInput>) =>
    apiRequest<Data<ClientInvoiceDetail>>(
      '/finance/client-invoice-items/' + itemId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteLine: (itemId: string) =>
    apiRequest<Data<ClientInvoiceDetail>>(
      '/finance/client-invoice-items/' + itemId,
      { method: 'DELETE' },
    ),
  submit: (invoiceId: string, workflowCode: string, actionKey: string) =>
    postAction<ClientInvoiceDetail>(
      '/finance/client-invoices/' + invoiceId + '/submit',
      { workflowCode, actionKey },
    ),
  approve: (invoiceId: string, actionKey: string, comment?: string | null) =>
    postAction<ClientInvoiceDetail>(
      '/finance/client-invoices/' + invoiceId + '/approve',
      { actionKey, comment: comment ?? null },
    ),
  reject: (invoiceId: string, actionKey: string, comment?: string | null) =>
    postAction<ClientInvoiceDetail>(
      '/finance/client-invoices/' + invoiceId + '/reject',
      { actionKey, comment: comment ?? null },
    ),
  accountsReceivable: (projectId: string) =>
    apiRequest<Data<AccountsReceivableRow[]>>(
      '/finance/projects/' + projectId + '/accounts-receivable',
    ),
  accountsPayable: (projectId: string) =>
    apiRequest<Data<AccountsPayableRow[]>>(
      '/finance/projects/' + projectId + '/accounts-payable',
    ),
};

