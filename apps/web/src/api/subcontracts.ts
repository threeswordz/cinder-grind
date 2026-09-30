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
  retentionRate: string;
  retentionCap: string | null;
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
  retentionRate: string;
  retentionCap: string | null;
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
  approvalState: string;
  cancelledAt: string | null;
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


export type CertificationRecord = {
  id: string;
  projectId: string;
  agreementId: string;
  claimId: string;
  assessmentId: string;
  certificationNumber: string;
  currencyCode: string;
  certifiedGross: string;
  state: string;
  approvalInstanceId: string | null;
  assessedAmountSnapshot: string | null;
  retentionRateSnapshot: string | null;
  retentionCapSnapshot: string | null;
  retainedBeforeSnapshot: string | null;
  retainedAmount: string | null;
  netCertifiedAmount: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
  agreement: {
    id: string;
    agreementNumber: string;
    originalValue: string;
    currencyCode: string;
    retentionRate: string;
    retentionCap: string | null;
    approvalState: string;
    cancelledAt: string | null;
  };
  claim: {
    id: string;
    claimNumber: string;
    state: string;
  };
  assessment: {
    id: string;
    assessedAmount: string;
    state: string;
    assessedAt: string;
  };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  reversedBy: { id: string; displayName: string } | null;
  approvalInstance: ApprovalInstanceRecord | null;
};


export type VariationAgreementOption = {
  id: string;
  agreementNumber: string;
  projectId: string;
  originalValue: string;
  currencyCode: string;
  approvalState: string;
  cancelledAt: string | null;
  project: SubcontractProject;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
  };
};

export type VariationRecord = {
  id: string;
  projectId: string;
  agreementId: string;
  variationNumber: string;
  currencyCode: string;
  valueDelta: string;
  scopeChange: string;
  reason: string;
  state: string;
  approvalInstanceId: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  reversedAt: string | null;
  reversalReason: string | null;
  createdAt: string;
  agreement: {
    id: string;
    agreementNumber: string;
    originalValue: string;
    currencyCode: string;
    approvalState: string;
    cancelledAt: string | null;
  };
  createdBy: { id: string; displayName: string };
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  reversedBy: { id: string; displayName: string } | null;
  approvalInstance: ApprovalInstanceRecord | null;
};

export type SubcontractReportRecord = {
  id: string;
  agreementNumber: string;
  projectId: string;
  originalValue: string;
  currencyCode: string;
  approvalState: string;
  cancelledAt: string | null;
  approvedVariationDelta: string;
  currentCeiling: string;
  approvedWorkOrderAllocation: string;
  activeClaimedValue: string;
  assessedValue: string;
  certifiedGross: string;
  withheldRetention: string;
  netCertification: string;
  project: SubcontractProject;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
  };
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
    retentionRate?: string;
    retentionCap?: string | null;
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
      retentionRate: string;
      retentionCap: string | null;
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

  certificationWorkflowOptions: () =>
    apiRequest<Data<WorkflowOption[]>>(
      '/subcontracts/certification-workflow-options',
    ),
  certifications: (agreementId: string) =>
    apiRequest<Data<CertificationRecord[]>>(
      '/subcontracts/agreements/' + agreementId + '/certifications',
    ),
  certification: (certificationId: string) =>
    apiRequest<Data<CertificationRecord>>(
      '/subcontracts/certifications/' + certificationId,
    ),
  createCertification: (
    claimId: string,
    body: { certifiedGross: string },
  ) =>
    postAction<CertificationRecord>(
      '/subcontracts/claims/' + claimId + '/certifications',
      body,
    ),
  updateCertification: (
    certificationId: string,
    body: { certifiedGross: string },
  ) =>
    apiRequest<Data<CertificationRecord>>(
      '/subcontracts/certifications/' + certificationId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submitCertification: (
    certificationId: string,
    workflowCode: string,
    actionKey: string,
  ) =>
    postAction<CertificationRecord>(
      '/subcontracts/certifications/' + certificationId + '/submit',
      { workflowCode, actionKey },
    ),
  approveCertification: (
    certificationId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<CertificationRecord>(
      '/subcontracts/certifications/' + certificationId + '/approve',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  rejectCertification: (
    certificationId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<CertificationRecord>(
      '/subcontracts/certifications/' + certificationId + '/reject',
      { reason, actionKey },
    ),
  reverseCertification: (
    certificationId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<CertificationRecord>(
      '/subcontracts/certifications/' + certificationId + '/reverse',
      { reason, actionKey },
    ),

  variationAgreementOptions: () =>
    apiRequest<Data<VariationAgreementOption[]>>(
      '/subcontracts/variation-agreement-options',
    ),
  variationWorkflowOptions: () =>
    apiRequest<Data<WorkflowOption[]>>(
      '/subcontracts/variation-workflow-options',
    ),
  variations: (agreementId: string) =>
    apiRequest<Data<VariationRecord[]>>(
      '/subcontracts/agreements/' + agreementId + '/variations',
    ),
  variation: (variationId: string) =>
    apiRequest<Data<VariationRecord>>(
      '/subcontracts/variations/' + variationId,
    ),
  createVariation: (
    agreementId: string,
    body: {
      valueDelta: string;
      scopeChange: string;
      reason: string;
      createKey: string;
    },
  ) =>
    postAction<VariationRecord>(
      '/subcontracts/agreements/' + agreementId + '/variations',
      body,
    ),
  updateVariation: (
    variationId: string,
    body: Partial<{
      valueDelta: string;
      scopeChange: string;
      reason: string;
    }>,
  ) =>
    apiRequest<Data<VariationRecord>>(
      '/subcontracts/variations/' + variationId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  submitVariation: (
    variationId: string,
    workflowCode: string,
    actionKey: string,
  ) =>
    postAction<VariationRecord>(
      '/subcontracts/variations/' + variationId + '/submit',
      { workflowCode, actionKey },
    ),
  approveVariation: (
    variationId: string,
    actionKey: string,
    comment?: string,
  ) =>
    postAction<VariationRecord>(
      '/subcontracts/variations/' + variationId + '/approve',
      { actionKey, ...(comment ? { comment } : {}) },
    ),
  rejectVariation: (
    variationId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<VariationRecord>(
      '/subcontracts/variations/' + variationId + '/reject',
      { reason, actionKey },
    ),
  reverseVariation: (
    variationId: string,
    reason: string,
    actionKey: string,
  ) =>
    postAction<VariationRecord>(
      '/subcontracts/variations/' + variationId + '/reverse',
      { reason, actionKey },
    ),
  subcontractReports: (projectId?: string) =>
    apiRequest<Data<SubcontractReportRecord[]>>(
      query('/subcontracts/reports/agreements', { projectId }),
    ),
};
