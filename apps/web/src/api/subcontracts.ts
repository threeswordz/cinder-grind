import { apiRequest } from './client';

type Data<T> = { data: T };

export type SubcontractorRecord = {
  id: string;
  companyId: string;
  supplierId: string | null;
  subcontractorCode: string;
  subcontractorName: string;
  registrationNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
    isActive: boolean;
  } | null;
};

export type SubcontractProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type AgreementStatus = {
  id: string;
  statusCode: string;
  statusLabel: string;
  sortOrder?: number;
};

export type WorkflowOption = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type ApprovalActionRecord = {
  id: string;
  action: string;
  actionAt: string;
  comment: string | null;
  approvalStep: { stepNo: number };
  actionByUser: { id: string; displayName: string };
};

export type ApprovalInstanceRecord = {
  id: string;
  approvalState: string;
  currentStepNo: number;
  startedAt: string;
  completedAt: string | null;
  workflow: {
    id: string;
    workflowCode: string;
    workflowName: string;
  };
  actions: ApprovalActionRecord[];
};

export type AgreementDraft = {
  id: string;
  projectId: string;
  subcontractorId: string;
  agreementNumber: string;
  originalValue: string;
  scopeOfWork: string;
  currencyCode: string;
  approvalState: string;
  operationalStatusId: string | null;
  firstApprovedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  project: SubcontractProject;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
    isActive: boolean;
  };
  operationalStatus: AgreementStatus | null;
  createdBy: { id: string; displayName: string };
};

export type AgreementVersion = {
  id: string;
  agreementId: string;
  versionNo: number;
  approvalState: string;
  originalValue: string;
  scopeOfWork: string;
  currencyCode: string;
  operationalStatusId: string | null;
  reason: string | null;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  operationalStatus: AgreementStatus | null;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvalInstance: ApprovalInstanceRecord | null;
};

export type WorkOrderRecord = {
  id: string;
  projectId: string;
  agreementId: string;
  sequenceNo: number;
  workOrderNumber: string;
  scopeOfWork: string;
  amount: string;
  wbsElementId: string | null;
  costCodeId: string | null;
  approvalState: string;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  agreement: {
    id: string;
    agreementNumber: string;
    currencyCode: string;
    originalValue: string;
    approvalState: string;
    cancelledAt: string | null;
  };
  wbsElement: {
    id: string;
    wbsCode: string;
    wbsName: string;
  } | null;
  costCode: {
    id: string;
    costCode: string;
    costName: string;
  } | null;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvalInstance: ApprovalInstanceRecord | null;
};

export type WorkOrderOptions = {
  agreement: {
    id: string;
    agreementNumber: string;
    currencyCode: string;
    originalValue: string;
  };
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
};

export type ClaimAgreementOption = {
  id: string;
  agreementNumber: string;
  projectId: string;
  originalValue: string;
  currencyCode: string;
  project: SubcontractProject;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
  };
};

export type ClaimOptions = {
  agreement: {
    id: string;
    agreementNumber: string;
    originalValue: string;
    currencyCode: string;
  };
  workOrders: Array<{
    id: string;
    workOrderNumber: string;
    amount: string;
  }>;
};

export type ClaimLineRecord = {
  id: string;
  claimId: string;
  lineNo: number;
  workOrderId: string | null;
  amount: string;
  workOrder: {
    id: string;
    workOrderNumber: string;
    amount: string;
    approvalState: string;
  } | null;
};

export type ClaimAssessmentRecord = {
  id: string;
  claimId: string;
  assessedAmount: string;
  reason: string;
  state: string;
  assessedAt: string;
  rejectedAt: string | null;
  rejectionReason: string | null;
  assessedBy: { id: string; displayName: string };
  rejectedBy: { id: string; displayName: string } | null;
};

export type ClaimRecord = {
  id: string;
  projectId: string;
  agreementId: string;
  claimNumber: string;
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  state: string;
  replacementForClaimId: string | null;
  submittedAt: string | null;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
  replacedAt: string | null;
  agreement: {
    id: string;
    agreementNumber: string;
    originalValue: string;
    currencyCode: string;
    approvalState: string;
    cancelledAt: string | null;
  };
  lines: ClaimLineRecord[];
  assessment: ClaimAssessmentRecord | null;
  replacementFor: {
    id: string;
    claimNumber: string;
    state: string;
  } | null;
  replacementClaim: {
    id: string;
    claimNumber: string;
    state: string;
  } | null;
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  withdrawnBy: { id: string; displayName: string } | null;
};

function query(path: string, values: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) params.set(key, value);
  }
  return path + (params.toString() ? '?' + params.toString() : '');
}

function postAction<T>(path: string, body: Record<string, unknown>) {
  return apiRequest<Data<T>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const subcontractsApi = {
  subcontractors: (
    filters: { includeInactive?: boolean; search?: string } = {},
  ) =>
    apiRequest<Data<SubcontractorRecord[]>>(
      query('/subcontracts/subcontractors', {
        includeInactive: filters.includeInactive ? 'true' : undefined,
        search: filters.search,
      }),
    ),
  suppliers: () =>
    apiRequest<
      Data<Array<{ id: string; supplierCode: string; supplierName: string }>>
    >('/subcontracts/suppliers'),
  createSubcontractor: (
    body: Omit<SubcontractorRecord, 'id' | 'companyId' | 'isActive' | 'supplier'>,
  ) =>
    apiRequest<Data<SubcontractorRecord>>('/subcontracts/subcontractors', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSubcontractor: (
    id: string,
    body: Partial<
      Omit<SubcontractorRecord, 'id' | 'companyId' | 'isActive' | 'supplier'>
    >,
  ) =>
    apiRequest<Data<SubcontractorRecord>>(
      '/subcontracts/subcontractors/' + id,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  setSubcontractorActive: (id: string, active: boolean) =>
    apiRequest<Data<SubcontractorRecord>>(
      '/subcontracts/subcontractors/' +
        id +
        (active ? '/reactivate' : '/archive'),
      { method: 'POST' },
    ),
  agreementSubcontractors: () =>
    apiRequest<
      Data<
        Array<{
          id: string;
          subcontractorCode: string;
          subcontractorName: string;
        }>
      >
    >('/subcontracts/agreement-subcontractors'),
  projects: () =>
    apiRequest<Data<SubcontractProject[]>>('/subcontracts/projects'),
  statuses: () =>
    apiRequest<Data<AgreementStatus[]>>('/subcontracts/agreement-statuses'),
  agreements: (
    filters: { projectId?: string; subcontractorId?: string; search?: string } = {},
  ) =>
    apiRequest<Data<AgreementDraft[]>>(
      query('/subcontracts/agreements', filters),
    ),
  createAgreement: (body: {
    projectId: string;
    subcontractorId: string;
    originalValue: string;
    scopeOfWork: string;
    currencyCode: string;
    operationalStatusId?: string | null;
    createKey?: string;
  }) =>
    apiRequest<Data<AgreementDraft>>('/subcontracts/agreements', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateAgreement: (
    id: string,
    body: Partial<{
      originalValue: string;
      scopeOfWork: string;
      currencyCode: string;
      operationalStatusId: string | null;
    }>,
  ) =>
    apiRequest<Data<AgreementDraft>>('/subcontracts/agreements/' + id, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  agreementWorkflowOptions: () =>
    apiRequest<Data<WorkflowOption[]>>('/subcontracts/agreement-workflow-options'),
  workOrderWorkflowOptions: () =>
    apiRequest<Data<WorkflowOption[]>>('/subcontracts/work-order-workflow-options'),
  agreementVersions: (agreementId: string) =>
    apiRequest<Data<AgreementVersion[]>>(
      '/subcontracts/agreements/' + agreementId + '/versions',
    ),
  submitAgreement: (
    agreementId: string,
    workflowCode: string,
    actionKey: string,
  ) =>
    postAction<AgreementDraft>(
      '/subcontracts/agreements/' + agreementId + '/submit',
      { workflowCode, actionKey },
    ),
  approveAgreement: (
    agreementId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<AgreementDraft>(
      '/subcontracts/agreements/' + agreementId + '/approve',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  rejectAgreement: (
    agreementId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<AgreementDraft>(
      '/subcontracts/agreements/' + agreementId + '/reject',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  createAgreementRevision: (
    agreementId: string,
    body: { operationalStatusId?: string | null; reason: string },
  ) =>
    postAction<AgreementVersion>(
      '/subcontracts/agreements/' + agreementId + '/revisions',
      body,
    ),
  updateAgreementRevision: (
    versionId: string,
    body: { operationalStatusId?: string | null; reason?: string },
  ) =>
    apiRequest<Data<AgreementVersion>>(
      '/subcontracts/agreement-versions/' + versionId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submitAgreementRevision: (
    versionId: string,
    workflowCode: string,
    actionKey: string,
  ) =>
    postAction<AgreementVersion>(
      '/subcontracts/agreement-versions/' + versionId + '/submit',
      { workflowCode, actionKey },
    ),
  approveAgreementRevision: (
    versionId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<AgreementVersion>(
      '/subcontracts/agreement-versions/' + versionId + '/approve',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  rejectAgreementRevision: (
    versionId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<AgreementVersion>(
      '/subcontracts/agreement-versions/' + versionId + '/reject',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  cancelAgreement: (
    agreementId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<AgreementDraft>(
      '/subcontracts/agreements/' + agreementId + '/cancel',
      { reason, actionKey },
    ),

  workOrderOptions: (agreementId: string) =>
    apiRequest<Data<WorkOrderOptions>>(
      '/subcontracts/agreements/' + agreementId + '/work-order-options',
    ),
  workOrders: (agreementId: string) =>
    apiRequest<Data<WorkOrderRecord[]>>(
      '/subcontracts/agreements/' + agreementId + '/work-orders',
    ),
  workOrder: (workOrderId: string) =>
    apiRequest<Data<WorkOrderRecord>>(
      '/subcontracts/work-orders/' + workOrderId,
    ),
  createWorkOrder: (
    agreementId: string,
    body: {
      scopeOfWork: string;
      amount: string;
      wbsElementId?: string | null;
      costCodeId?: string | null;
    },
  ) =>
    postAction<WorkOrderRecord>(
      '/subcontracts/agreements/' + agreementId + '/work-orders',
      body,
    ),
  updateWorkOrder: (
    workOrderId: string,
    body: Partial<{
      scopeOfWork: string;
      amount: string;
      wbsElementId: string | null;
      costCodeId: string | null;
    }>,
  ) =>
    apiRequest<Data<WorkOrderRecord>>(
      '/subcontracts/work-orders/' + workOrderId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submitWorkOrder: (
    workOrderId: string,
    workflowCode: string,
    actionKey: string,
  ) =>
    postAction<WorkOrderRecord>(
      '/subcontracts/work-orders/' + workOrderId + '/submit',
      { workflowCode, actionKey },
    ),
  approveWorkOrder: (
    workOrderId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<WorkOrderRecord>(
      '/subcontracts/work-orders/' + workOrderId + '/approve',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  rejectWorkOrder: (
    workOrderId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<WorkOrderRecord>(
      '/subcontracts/work-orders/' + workOrderId + '/reject',
      { actionKey, ...(comment ? { comment } : {}) },
    ),

  claimAgreementOptions: () =>
    apiRequest<Data<ClaimAgreementOption[]>>(
      '/subcontracts/claim-agreement-options',
    ),
  claimOptions: (agreementId: string) =>
    apiRequest<Data<ClaimOptions>>(
      '/subcontracts/agreements/' + agreementId + '/claim-options',
    ),
  claims: (agreementId: string) =>
    apiRequest<Data<ClaimRecord[]>>(
      '/subcontracts/agreements/' + agreementId + '/claims',
    ),
  claim: (claimId: string) =>
    apiRequest<Data<ClaimRecord>>('/subcontracts/claims/' + claimId),
  createClaim: (
    agreementId: string,
    body: { periodStart: string; periodEnd: string },
  ) =>
    apiRequest<Data<ClaimRecord>>(
      '/subcontracts/agreements/' + agreementId + '/claims',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  updateClaim: (
    claimId: string,
    body: Partial<{ periodStart: string; periodEnd: string }>,
  ) =>
    apiRequest<Data<ClaimRecord>>('/subcontracts/claims/' + claimId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addClaimLine: (
    claimId: string,
    body: { amount: string; workOrderId?: string | null },
  ) =>
    apiRequest<Data<ClaimLineRecord>>(
      '/subcontracts/claims/' + claimId + '/lines',
      { method: 'POST', body: JSON.stringify(body) },
    ),
  updateClaimLine: (
    lineId: string,
    body: Partial<{ amount: string; workOrderId: string | null }>,
  ) =>
    apiRequest<Data<ClaimLineRecord>>(
      '/subcontracts/claim-lines/' + lineId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  deleteClaimLine: (lineId: string) =>
    apiRequest<Data<{ id: string }>>('/subcontracts/claim-lines/' + lineId, {
      method: 'DELETE',
    }),
  submitClaim: (claimId: string, actionKey: string) =>
    postAction<ClaimRecord>('/subcontracts/claims/' + claimId + '/submit', {
      actionKey,
    }),
  withdrawClaim: (
    claimId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<ClaimRecord>('/subcontracts/claims/' + claimId + '/withdraw', {
      reason,
      actionKey,
    }),
  createClaimReplacement: (claimId: string) =>
    postAction<ClaimRecord>(
      '/subcontracts/claims/' + claimId + '/replacements',
      {},
    ),
  assessClaim: (
    claimId: string,
    body: { assessedAmount: string; reason: string; actionKey: string },
  ) =>
    postAction<ClaimRecord>(
      '/subcontracts/claims/' + claimId + '/assess',
      body,
    ),
  rejectClaimAssessment: (
    claimId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<ClaimRecord>(
      '/subcontracts/claims/' + claimId + '/assessment/reject',
      { reason, actionKey },
    ),
};
