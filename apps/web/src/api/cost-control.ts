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

export type DirectCostOptions = {
  project: {
    id: string;
    projectCode: string;
    projectName: string;
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
  };
  boundaries: {
    committedActualPaidSeparate: boolean;
    directCostPostingImplemented: boolean;
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
