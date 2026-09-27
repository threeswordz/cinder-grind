import { apiRequest } from './client';

type Data<T> = { data: T };

export type BudgetProject = {
  id: string;
  projectCode: string;
  projectName: string;
};

export type BudgetOptions = {
  wbs: Array<{ id: string; wbsCode: string; wbsName: string }>;
  costCodes: Array<{ id: string; costCode: string; costName: string }>;
  uoms: Array<{
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  }>;
};

export type BoqSection = {
  id: string;
  boqId: string;
  sectionCode: string;
  sectionName: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type BoqItem = {
  id: string;
  boqId: string;
  sectionId: string;
  itemCode: string;
  description: string;
  quantity: string;
  uomId: string;
  rate: string;
  amount: string;
  wbsId: string | null;
  costCodeId: string | null;
  sortOrder: number;
  isActive: boolean;
  section: {
    id: string;
    sectionCode: string;
    sectionName: string;
  };
  uom: {
    id: string;
    uomCode: string;
    uomName: string;
    decimalPlaces: number;
  };
  wbs: { id: string; wbsCode: string; wbsName: string } | null;
  costCode: { id: string; costCode: string; costName: string } | null;
};

export type Boq = {
  id: string;
  companyId: string;
  projectId: string;
  boqName: string;
  project: BudgetProject;
  sections: BoqSection[];
  items: BoqItem[];
};

export type BudgetWorkflow = {
  id: string;
  workflowCode: string;
  workflowName: string;
};

export type BudgetRevisionListItem = {
  id: string;
  companyId: string;
  projectId: string;
  revisionNo: number;
  revisionNumber: string;
  createdAt: string;
  submittedAt: string | null;
  revisionNote: string | null;
  lifecycleState: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  isOriginal: boolean;
  isCurrent: boolean;
  createdBy: { id: string; displayName: string; email: string };
  submittedBy: { id: string; displayName: string; email: string } | null;
  approvalInstance: {
    id: string;
    approvalState: string;
    currentStepNo: number;
    startedAt: string;
    completedAt: string | null;
  } | null;
  _count: { lines: number };
};

export type BudgetRevision = BudgetRevisionListItem & {
  project: BudgetProject;
  lines: Array<{
    id: string;
    budgetRevisionId: string;
    boqItemId: string;
    sectionCode: string;
    sectionName: string;
    itemCode: string;
    description: string;
    quantity: string;
    uomId: string;
    uomCode: string;
    uomName: string;
    rate: string;
    amount: string;
    wbsId: string | null;
    wbsCode: string | null;
    wbsName: string | null;
    costCodeId: string | null;
    costCode: string | null;
    costName: string | null;
    sortOrder: number;
  }>;
};

export type BudgetSummaryPart = {
  id: string;
  revisionNo: number;
  revisionNumber: string;
  approvedAt: string | null;
  total: string;
  byWbs: Array<{
    wbsId: string | null;
    wbsCode: string | null;
    wbsName: string | null;
    amount: string;
  }>;
  byCostCode: Array<{
    costCodeId: string | null;
    costCode: string | null;
    costName: string | null;
    amount: string;
  }>;
};

export type BudgetSummary = {
  projectId: string;
  original: BudgetSummaryPart | null;
  current: BudgetSummaryPart | null;
};

export const budgetApi = {
  projects: () => apiRequest<Data<BudgetProject[]>>('/budget/projects'),
  revisionProjects: () =>
    apiRequest<Data<BudgetProject[]>>('/budget/revision-projects'),
  options: (projectId: string) =>
    apiRequest<Data<BudgetOptions>>(
      '/budget/projects/' + projectId + '/options',
    ),
  workflows: () =>
    apiRequest<Data<BudgetWorkflow[]>>('/budget/revision-workflow-options'),
  boq: (projectId: string) =>
    apiRequest<Data<Boq | null>>('/budget/projects/' + projectId + '/boq'),
  createBoq: (projectId: string, boqName: string) =>
    apiRequest<Data<Boq>>('/budget/projects/' + projectId + '/boq', {
      method: 'POST',
      body: JSON.stringify({ boqName }),
    }),
  updateBoq: (projectId: string, boqName: string) =>
    apiRequest<Data<Boq>>('/budget/projects/' + projectId + '/boq', {
      method: 'PATCH',
      body: JSON.stringify({ boqName }),
    }),
  createSection: (
    boqId: string,
    body: {
      sectionCode: string;
      sectionName: string;
      description?: string | null;
      sortOrder?: number;
    },
  ) =>
    apiRequest<Data<BoqSection>>('/budget/boqs/' + boqId + '/sections', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateSection: (
    sectionId: string,
    body: Partial<{
      sectionCode: string;
      sectionName: string;
      description: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) =>
    apiRequest<Data<BoqSection>>('/budget/sections/' + sectionId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  createItem: (
    boqId: string,
    body: {
      sectionId: string;
      itemCode: string;
      description: string;
      quantity: string | number;
      uomId: string;
      rate: string | number;
      wbsId?: string | null;
      costCodeId?: string | null;
      sortOrder?: number;
    },
  ) =>
    apiRequest<Data<BoqItem>>('/budget/boqs/' + boqId + '/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateItem: (
    itemId: string,
    body: Partial<{
      sectionId: string;
      itemCode: string;
      description: string;
      quantity: string | number;
      uomId: string;
      rate: string | number;
      wbsId: string | null;
      costCodeId: string | null;
      sortOrder: number;
      isActive: boolean;
    }>,
  ) =>
    apiRequest<Data<BoqItem>>('/budget/items/' + itemId, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  revisions: (projectId: string) =>
    apiRequest<Data<BudgetRevisionListItem[]>>(
      '/budget/projects/' + projectId + '/revisions',
    ),
  revision: (revisionId: string) =>
    apiRequest<Data<BudgetRevision>>('/budget/revisions/' + revisionId),
  createRevisionDraft: (
    projectId: string,
    revisionNote?: string | null,
  ) =>
    apiRequest<Data<BudgetRevisionListItem>>(
      '/budget/projects/' + projectId + '/revisions',
      {
        method: 'POST',
        body: JSON.stringify({ revisionNote: revisionNote ?? null }),
      },
    ),
  submitRevision: (revisionId: string, workflowCode: string) =>
    apiRequest<Data<BudgetRevisionListItem>>(
      '/budget/revisions/' + revisionId + '/submit',
      {
        method: 'POST',
        body: JSON.stringify({ workflowCode }),
      },
    ),
  approveRevision: (revisionId: string, comment?: string | null) =>
    apiRequest<Data<BudgetRevision>>(
      '/budget/revisions/' + revisionId + '/approve',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  rejectRevision: (revisionId: string, comment?: string | null) =>
    apiRequest<Data<BudgetRevision>>(
      '/budget/revisions/' + revisionId + '/reject',
      {
        method: 'POST',
        body: JSON.stringify({ comment: comment ?? null }),
      },
    ),
  summary: (projectId: string) =>
    apiRequest<Data<BudgetSummary>>(
      '/budget/projects/' + projectId + '/summary',
    ),
  approved: (projectId: string) =>
    apiRequest<Data<BudgetRevision | null>>(
      '/budget/projects/' + projectId + '/approved',
    ),
};
