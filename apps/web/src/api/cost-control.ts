import { apiRequest } from './client';

type Data<T> = { data: T };

export type CostProject = {
  id: string;
  projectCode: string;
  projectName: string;
  isActive: boolean;
};

export type CostWorkflow = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type ForecastOptions = {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    isActive: boolean;
  };
  baseCurrencyCode: string;
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
};

export type ForecastLine = {
  id: string;
  lineNo: number;
  wbsId: string | null;
  costCodeId: string | null;
  uncommittedEtcAmount: string;
  remarks: string | null;
  wbs?: { id: string; wbsCode: string; wbsName: string } | null;
  costCode?: { id: string; costCode: string; costName: string } | null;
  allocationState?: 'FULLY_ALLOCATED' | 'PARTIALLY_ALLOCATED' | 'UNALLOCATED';
};

export type CostForecast = {
  id: string;
  companyId: string;
  projectId: string;
  forecastDate: string;
  versionNo: number;
  description: string | null;
  currencyCode: string;
  state: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  approvalInstanceId: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  lines: ForecastLine[];
};

export type CostForecastDetail = CostForecast & {
  totalUncommittedEtc: string;
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    isActive: boolean;
  } | null;
  createdBy: { id: string; displayName: string } | null;
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  approvalInstance: DirectCostDetail['approvalInstance'];
};

export type ProjectVariation = {
  id: string;
  companyId: string;
  projectId: string;
  variationNumber: string;
  description: string;
  reason: string | null;
  valueDelta: string;
  currencyCode: string;
  state: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  approvalInstanceId: string | null;
  reversesVariationId: string | null;
  reversalReason: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

export type ProjectVariationDetail = ProjectVariation & {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    isActive: boolean;
  } | null;
  createdBy: { id: string; displayName: string } | null;
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
  approvalInstance: DirectCostDetail['approvalInstance'];
};

export type DirectCostOptions = {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
    isActive: boolean;
  };
  baseCurrencyCode: string;
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
};

export type DirectCostPosting = {
  id: string;
  companyId: string;
  projectId: string;
  wbsId: string | null;
  costCodeId: string;
  postingDate: string;
  description: string;
  reference: string | null;
  amount: string;
  currencyCode: string;
  state: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  approvalInstanceId: string | null;
  reversesPostingId: string | null;
  reversalReason: string | null;
  createdByUserId: string;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  rejectedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
};

export type DirectCostDetail = DirectCostPosting & {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
  } | null;
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: {
    id: string;
    costCode: string;
    costName: string;
  } | null;
  createdBy: { id: string; displayName: string } | null;
  submittedBy: { id: string; displayName: string } | null;
  approvedBy: { id: string; displayName: string } | null;
  rejectedBy: { id: string; displayName: string } | null;
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

export type CostControlReadModel = {
  baseCurrencyCode: string;
  totals: {
    originalBudget: string;
    revisedBudget: string;
    committedCost: {
      procurement: string;
      subcontract: string;
      total: string;
    };
    actualCost: {
      supplier: string;
      subcontract: string;
      direct: string;
      total: string;
    };
    paidCost: {
      supplier: string;
      subcontract: string;
      total: string;
    };
    remainingCommitment: {
      procurement: string;
      subcontract: string;
      total: string;
    };
    uncommittedEtc: string;
    costToComplete: string;
    forecastCost: string;
    variance: string;
    commercial: {
      allocationLevel: 'PROJECT';
      originalContractValue: string;
      approvedVariationValue: string;
      revisedContractValue: string;
      actualRevenue: string;
      cashReceived: string;
      forecastRevenue: string;
      actualProfit: string | null;
      forecastProfit: string | null;
      profitAvailableAtCurrentFilter: boolean;
    };
  };
  currentForecast: {
    id: string;
    versionNo: number;
    forecastDate: string;
    approvedAt: string | null;
  } | null;
  boundaries: {
    committedActualPaidSeparate: boolean;
    directCostPostingImplemented: boolean;
    forecastImplemented: boolean;
    projectVariationRevenueProfitImplemented: boolean;
    revenueProfitProjectLevelOnly: boolean;
  };
};

function postAction<T>(path: string, body: Record<string, unknown>) {
  return apiRequest<Data<T>>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export const costControlApi = {
  projects: () =>
    apiRequest<Data<CostProject[]>>('/cost-control/projects'),
  workflows: () =>
    apiRequest<Data<CostWorkflow[]>>(
      '/cost-control/direct-cost-workflow-options',
    ),
  forecastWorkflows: () =>
    apiRequest<Data<CostWorkflow[]>>(
      '/cost-control/forecast-workflow-options',
    ),
  forecastOptions: (projectId: string) =>
    apiRequest<Data<ForecastOptions>>(
      '/cost-control/projects/' + projectId + '/forecast-options',
    ),
  forecastList: (projectId: string) =>
    apiRequest<Data<CostForecast[]>>(
      '/cost-control/projects/' + projectId + '/forecasts',
    ),
  forecastDetail: (forecastId: string) =>
    apiRequest<Data<CostForecastDetail>>(
      '/cost-control/forecasts/' + forecastId,
    ),
  forecastCreate: (
    projectId: string,
    body: {
      forecastDate: string;
      description?: string | null;
      lines: Array<{
        wbsId?: string | null;
        costCodeId?: string | null;
        uncommittedEtcAmount: string;
        remarks?: string | null;
      }>;
      createKey: string;
    },
  ) =>
    postAction<CostForecastDetail>(
      '/cost-control/projects/' + projectId + '/forecasts',
      body,
    ),
  forecastUpdate: (
    forecastId: string,
    body: Partial<{
      forecastDate: string;
      description: string | null;
      lines: Array<{
        wbsId?: string | null;
        costCodeId?: string | null;
        uncommittedEtcAmount: string;
        remarks?: string | null;
      }>;
    }>,
  ) =>
    apiRequest<Data<CostForecastDetail>>(
      '/cost-control/forecasts/' + forecastId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  forecastSubmit: (
    forecastId: string,
    body: { workflowCode: string; actionKey: string },
  ) =>
    postAction<CostForecastDetail>(
      '/cost-control/forecasts/' + forecastId + '/submit',
      body,
    ),
  forecastApprove: (
    forecastId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<CostForecastDetail>(
      '/cost-control/forecasts/' + forecastId + '/approve',
      body,
    ),
  forecastReject: (
    forecastId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<CostForecastDetail>(
      '/cost-control/forecasts/' + forecastId + '/reject',
      body,
    ),
  variationWorkflows: () =>
    apiRequest<Data<CostWorkflow[]>>(
      '/cost-control/project-variation-workflow-options',
    ),
  variationList: (projectId: string) =>
    apiRequest<Data<ProjectVariation[]>>(
      '/cost-control/projects/' + projectId + '/project-variations',
    ),
  variationDetail: (variationId: string) =>
    apiRequest<Data<ProjectVariationDetail>>(
      '/cost-control/project-variations/' + variationId,
    ),
  variationCreate: (
    projectId: string,
    body: {
      variationNumber: string;
      description: string;
      reason?: string | null;
      valueDelta: string;
      createKey: string;
    },
  ) =>
    postAction<ProjectVariationDetail>(
      '/cost-control/projects/' + projectId + '/project-variations',
      body,
    ),
  variationUpdate: (
    variationId: string,
    body: Partial<{
      description: string;
      reason: string | null;
      valueDelta: string;
    }>,
  ) =>
    apiRequest<Data<ProjectVariationDetail>>(
      '/cost-control/project-variations/' + variationId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  variationReversal: (
    variationId: string,
    body: { variationNumber: string; reason: string; createKey: string },
  ) =>
    postAction<ProjectVariationDetail>(
      '/cost-control/project-variations/' + variationId + '/reversal',
      body,
    ),
  variationSubmit: (
    variationId: string,
    body: { workflowCode: string; actionKey: string },
  ) =>
    postAction<ProjectVariationDetail>(
      '/cost-control/project-variations/' + variationId + '/submit',
      body,
    ),
  variationApprove: (
    variationId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<ProjectVariationDetail>(
      '/cost-control/project-variations/' + variationId + '/approve',
      body,
    ),
  variationReject: (
    variationId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<ProjectVariationDetail>(
      '/cost-control/project-variations/' + variationId + '/reject',
      body,
    ),
  options: (projectId: string) =>
    apiRequest<Data<DirectCostOptions>>(
      '/cost-control/projects/' + projectId + '/direct-cost-options',
    ),
  readModel: (projectId: string) =>
    apiRequest<Data<CostControlReadModel>>(
      '/projects/' + projectId + '/cost-control',
    ),
  list: (projectId: string) =>
    apiRequest<Data<DirectCostPosting[]>>(
      '/cost-control/projects/' + projectId + '/direct-cost-postings',
    ),
  detail: (postingId: string) =>
    apiRequest<Data<DirectCostDetail>>(
      '/cost-control/direct-cost-postings/' + postingId,
    ),
  create: (
    projectId: string,
    body: {
      postingDate: string;
      description: string;
      reference?: string | null;
      amount: string;
      wbsId?: string | null;
      costCodeId: string;
      createKey: string;
    },
  ) =>
    postAction<DirectCostDetail>(
      '/cost-control/projects/' + projectId + '/direct-cost-postings',
      body,
    ),
  update: (
    postingId: string,
    body: Partial<{
      postingDate: string;
      description: string;
      reference: string | null;
      amount: string;
      wbsId: string | null;
      costCodeId: string;
    }>,
  ) =>
    apiRequest<Data<DirectCostDetail>>(
      '/cost-control/direct-cost-postings/' + postingId,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),
  reversal: (
    postingId: string,
    body: {
      postingDate: string;
      reason: string;
      reference?: string | null;
      createKey: string;
    },
  ) =>
    postAction<DirectCostDetail>(
      '/cost-control/direct-cost-postings/' + postingId + '/reversal',
      body,
    ),
  submit: (
    postingId: string,
    body: { workflowCode: string; actionKey: string },
  ) =>
    postAction<DirectCostDetail>(
      '/cost-control/direct-cost-postings/' + postingId + '/submit',
      body,
    ),
  approve: (
    postingId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<DirectCostDetail>(
      '/cost-control/direct-cost-postings/' + postingId + '/approve',
      body,
    ),
  reject: (
    postingId: string,
    body: { actionKey: string; comment?: string },
  ) =>
    postAction<DirectCostDetail>(
      '/cost-control/direct-cost-postings/' + postingId + '/reject',
      body,
    ),
};
