import { apiRequest } from './client';

type Data<T> = { data: T };

export type ProcurementProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type ProcurementOptions = {
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
  uoms: Array<{
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  }>;
  materials: Array<{
    id: string;
    materialCode: string;
    materialName: string;
    defaultUomId: string;
  }>;
  activities: Array<{
    id: string;
    activityCode: string;
    activityName: string;
    wbsId: string;
  }>;
};

export type ProcurementWorkflow = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type PurchaseRequestLifecycle =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PurchaseRequestListItem = {
  id: string;
  companyId: string;
  projectId: string;
  prNumber: string;
  remarks: string | null;
  sourceRequestId: string | null;
  approvalInstanceId: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  cancelledByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  cancelledAt: string | null;
  lifecycleState: PurchaseRequestLifecycle;
  createdBy: { id: string; displayName: string; email: string };
  submittedBy: { id: string; displayName: string; email: string } | null;
  cancelledBy: { id: string; displayName: string; email: string } | null;
  sourceRequest: { id: string; prNumber: string } | null;
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number;
    startedAt: string;
    completedAt: string | null;
    workflow?: {
      id: string;
      workflowCode: string;
      workflowName: string;
    };
    actions?: Array<{
      id: string;
      action: string;
      actionAt: string;
      comment: string | null;
      actionByUser: {
        id: string;
        displayName: string;
        email: string;
      };
      approvalStep: {
        id: string;
        stepNo: number;
        stepName: string;
      };
    }>;
  } | null;
  _count: { lines: number; copies: number };
};

export type PurchaseRequestLine = {
  id: string;
  purchaseRequestId: string;
  lineNo: number;
  lineType: 'MATERIAL' | 'SERVICE';
  materialId: string | null;
  materialCodeSnapshot: string | null;
  description: string;
  quantity: string;
  uomId: string;
  wbsId: string | null;
  costCodeId: string | null;
  activityId: string | null;
  requiredOnSite: string | null;
  material: {
    id: string;
    materialCode: string;
    materialName: string;
  } | null;
  uom: {
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  };
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: { id: string; costCode: string; costName: string } | null;
  activity: {
    id: string;
    activityCode: string;
    activityName: string;
  } | null;
};

export type PurchaseRequest = PurchaseRequestListItem & {
  project: ProcurementProject;
  copies: Array<{ id: string; prNumber: string }>;
  lines: PurchaseRequestLine[];
};

export const procurementApi = {
  projects: () =>
    apiRequest<Data<ProcurementProject[]>>('/procurement/projects'),
  options: (projectId: string) =>
    apiRequest<Data<ProcurementOptions>>(
      '/procurement/projects/' + projectId + '/options',
    ),
  workflows: () =>
    apiRequest<Data<ProcurementWorkflow[]>>(
      '/procurement/pr-workflow-options',
    ),
  requests: (projectId: string) =>
    apiRequest<Data<PurchaseRequestListItem[]>>(
      '/procurement/projects/' + projectId + '/purchase-requests',
    ),
  request: (requestId: string) =>
    apiRequest<Data<PurchaseRequest>>(
      '/procurement/purchase-requests/' + requestId,
    ),
  createRequest: (projectId: string, remarks?: string | null) =>
    apiRequest<Data<PurchaseRequestListItem>>(
      '/procurement/projects/' + projectId + '/purchase-requests',
      {
        method: 'POST',
        body: JSON.stringify({ remarks: remarks ?? null }),
      },
    ),
  updateRequest: (requestId: string, remarks: string | null) =>
    apiRequest<Data<PurchaseRequestListItem>>(
      '/procurement/purchase-requests/' + requestId,
      {
        method: 'PATCH',
        body: JSON.stringify({ remarks }),
      },
    ),
  copyRejected: (requestId: string, remarks?: string | null) =>
    apiRequest<Data<PurchaseRequestListItem>>(
      '/procurement/purchase-requests/' + requestId + '/copy-rejected',
      {
        method: 'POST',
        body: JSON.stringify(
          remarks === undefined ? {} : { remarks: remarks ?? null },
        ),
      },
    ),
  createLine: (
    requestId: string,
    body: {
      lineType: 'MATERIAL' | 'SERVICE';
      materialId?: string | null;
      description?: string;
      quantity: string | number;
      uomId: string;
      wbsId?: string | null;
      costCodeId?: string | null;
      activityId?: string | null;
      requiredOnSite?: string | null;
    },
  ) =>
    apiRequest<Data<PurchaseRequestLine>>(
      '/procurement/purchase-requests/' + requestId + '/lines',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),
  updateLine: (
    lineId: string,
    body: Partial<{
      lineType: 'MATERIAL' | 'SERVICE';
      materialId: string | null;
      description: string;
      quantity: string | number;
      uomId: string;
      wbsId: string | null;
      costCodeId: string | null;
      activityId: string | null;
      requiredOnSite: string | null;
    }>,
  ) =>
    apiRequest<Data<PurchaseRequestLine>>(
      '/procurement/purchase-request-lines/' + lineId,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    ),
  deleteLine: (lineId: string) =>
    apiRequest<Data<{ id: string }>>(
      '/procurement/purchase-request-lines/' + lineId,
      { method: 'DELETE' },
    ),
  submit: (requestId: string, workflowCode: string) =>
    apiRequest<Data<PurchaseRequestListItem>>(
      '/procurement/purchase-requests/' + requestId + '/submit',
      {
        method: 'POST',
        body: JSON.stringify({ workflowCode }),
      },
    ),
  approve: (requestId: string, comment?: string | null) =>
    apiRequest<Data<PurchaseRequest>>(
      '/procurement/purchase-requests/' + requestId + '/approve',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  reject: (requestId: string, comment?: string | null) =>
    apiRequest<Data<PurchaseRequest>>(
      '/procurement/purchase-requests/' + requestId + '/reject',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  cancel: (requestId: string) =>
    apiRequest<Data<PurchaseRequestListItem>>(
      '/procurement/purchase-requests/' + requestId + '/cancel',
      { method: 'POST', body: JSON.stringify({}) },
    ),
};
