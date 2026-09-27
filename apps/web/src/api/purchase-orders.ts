import { apiRequest } from './client';

type Data<T> = { data: T };

export type PoProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type PoWorkflow = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type PoAward = {
  id: string;
  rfqId: string;
  rfqNumber: string;
  rfqLineId: string;
  purchaseRequestLineId: string;
  prNumber: string;
  supplierId: string;
  supplierCodeSnapshot: string;
  supplierNameSnapshot: string;
  lineType: 'MATERIAL' | 'SERVICE';
  material: {
    id: string;
    materialCode: string;
    materialName: string;
  } | null;
  description: string;
  quantity: string;
  uom: { id: string; uomCode: string; uomName: string };
  unitPrice: string;
  amount: string;
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: { id: string; costCode: string; costName: string } | null;
  requiredOnSite: string | null;
  selectedAt: string;
};

export type PurchaseOrderListItem = {
  id: string;
  companyId: string;
  projectId: string;
  supplierId: string;
  poNumber: string;
  revisionNo: number;
  revisionReason: string | null;
  remarks: string | null;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  lifecycleState: string;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
  };
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
  _count: { lines: number };
};

export type PurchaseOrderLine = {
  id: string;
  purchaseOrderId: string;
  lineNo: number;
  quotationAwardId: string;
  purchaseRequestLineId: string;
  rfqId: string;
  rfqLineId: string;
  supplierQuotationId: string;
  supplierQuotationLineId: string;
  lineType: 'MATERIAL' | 'SERVICE';
  materialId: string | null;
  materialCodeSnapshot: string | null;
  description: string;
  quantity: string;
  uomId: string;
  uomCodeSnapshot: string;
  unitPrice: string;
  amount: string;
  wbsId: string | null;
  costCodeId: string | null;
  requiredOnSite: string | null;
  expectedDelivery: string | null;
  remarks: string | null;
  material?: {
    id: string;
    materialCode: string;
    materialName: string;
  } | null;
  uom?: {
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  } | null;
  wbs?: { id: string; wbsCode: string; wbsName: string } | null;
  costCode?: { id: string; costCode: string; costName: string } | null;
  quotationAward?: {
    id: string;
    selectedAt: string;
    supplierCodeSnapshot: string;
    supplierNameSnapshot: string;
  } | null;
  rfq?: { id: string; rfqNumber: string } | null;
  purchaseRequestLine?: {
    purchaseRequest: { id: string; prNumber: string };
  } | null;
  supplierQuotation?: {
    id: string;
    supplierReference: string | null;
    quotationDate: string;
  } | null;
};

export type ApprovalAction = {
  id: string;
  actionType?: string;
  actionAt: string;
  comment?: string | null;
  actionByUser?: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  approvalStep?: {
    id: string;
    stepNo: number;
    stepName: string;
  } | null;
};

export type PurchaseOrderDetail = PurchaseOrderListItem & {
  project: PoProject;
  createdBy: { id: string; displayName: string; email: string };
  submittedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  cancelledBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  previousRevision: {
    id: string;
    poNumber: string;
    revisionNo: number;
  } | null;
  nextRevision: {
    id: string;
    poNumber: string;
    revisionNo: number;
  } | null;
  approvalInstance: (PurchaseOrderListItem['approvalInstance'] & {
    workflow?: {
      id: string;
      workflowCode: string;
      workflowName: string;
    };
    actions?: ApprovalAction[];
  }) | null;
  lines: PurchaseOrderLine[];
};

export type PurchaseOrderRevision = {
  id: string;
  poNumber: string;
  revisionNo: number;
  revisionReason: string | null;
  submittedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  lifecycleState: string;
  approvalInstance: {
    approvalState: string;
    startedAt: string;
    completedAt: string | null;
  } | null;
  createdBy: { id: string; displayName: string; email: string };
  submittedBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  cancelledBy: {
    id: string;
    displayName: string;
    email: string;
  } | null;
  _count: { lines: number };
};

export const purchaseOrdersApi = {
  projects: () =>
    apiRequest<Data<PoProject[]>>('/procurement/po-projects'),
  createProjects: () =>
    apiRequest<Data<PoProject[]>>('/procurement/po-create-projects'),
  workflows: () =>
    apiRequest<Data<PoWorkflow[]>>('/procurement/po-workflow-options'),
  awards: (projectId: string) =>
    apiRequest<Data<PoAward[]>>(
      '/procurement/projects/' + projectId + '/po-awards',
    ),
  list: (projectId: string) =>
    apiRequest<Data<PurchaseOrderListItem[]>>(
      '/procurement/projects/' + projectId + '/purchase-orders',
    ),
  detail: (orderId: string) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId,
    ),
  revisions: (orderId: string) =>
    apiRequest<Data<PurchaseOrderRevision[]>>(
      '/procurement/purchase-orders/' + orderId + '/revisions',
    ),
  create: (
    projectId: string,
    awardIds: string[],
    remarks?: string | null,
  ) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/projects/' + projectId + '/purchase-orders',
      {
        method: 'POST',
        body: JSON.stringify({ awardIds, remarks: remarks ?? null }),
      },
    ),
  update: (
    orderId: string,
    body: Partial<{
      remarks: string | null;
      revisionReason: string | null;
    }>,
  ) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  updateLine: (
    lineId: string,
    body: Partial<{
      quantity: string | number;
      unitPrice: string | number;
      wbsId: string | null;
      costCodeId: string | null;
      requiredOnSite: string | null;
      expectedDelivery: string | null;
      remarks: string | null;
    }>,
  ) =>
    apiRequest<Data<PurchaseOrderLine>>(
      '/procurement/purchase-order-lines/' + lineId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteLine: (lineId: string) =>
    apiRequest<Data<{ id: string }>>(
      '/procurement/purchase-order-lines/' + lineId,
      { method: 'DELETE' },
    ),
  submit: (orderId: string, workflowCode: string) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId + '/submit',
      {
        method: 'POST',
        body: JSON.stringify({ workflowCode }),
      },
    ),
  approve: (orderId: string, comment?: string | null) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId + '/approve',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  reject: (orderId: string, comment?: string | null) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId + '/reject',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  cancel: (orderId: string, reason: string) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId + '/cancel',
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    ),
  revise: (orderId: string, revisionReason?: string | null) =>
    apiRequest<Data<PurchaseOrderDetail>>(
      '/procurement/purchase-orders/' + orderId + '/revise',
      {
        method: 'POST',
        body: JSON.stringify({ revisionReason: revisionReason ?? null }),
      },
    ),
};
