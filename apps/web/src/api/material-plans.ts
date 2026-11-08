import { apiRequest } from './client';

type Data<T> = { data: T };
export type PlanPage<T> = { items: T[]; nextCursor: string | null };
export type PlanProject = { id: string; projectCode: string; projectName: string };
export type PlanChoice = {
  id: string;
  warehouseCode?: string;
  warehouseName?: string;
  materialCode?: string;
  materialName?: string;
  defaultUomId?: string;
  revisionNo?: number;
  revisionNumber?: string;
  itemCode?: string;
  description?: string;
  quantity?: string;
  uomId?: string;
  uomCode?: string;
};
export type PlanLine = {
  id: string;
  budgetRevisionLineId: string;
  materialId: string;
  uomId: string;
  quantity: string;
  material: { materialCode: string; materialName: string };
  uom: { uomCode: string };
};
export type PlanRevision = {
  id: string;
  revisionNo: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  validFrom: string;
  validTo: string;
  reason: string;
  createdByUserId: string;
  submittedByUserId: string | null;
  decidedByUserId: string | null;
  decisionComment: string | null;
  lines: PlanLine[];
};
export type PlanSummary = {
  id: string;
  companyId: string;
  projectId: string;
  warehouseId: string;
  budgetRevisionId: string;
  workPackageCode: string;
  version: number;
  createdByUserId: string;
};
export type MaterialPlan = PlanSummary & {
  latestRevision: PlanRevision | null;
  approvedRevision: PlanRevision | null;
  issueEnforcement: string;
};
export type PlanHistoryRow = Pick<PlanRevision, 'id' | 'revisionNo' | 'status' | 'reason' | 'createdByUserId' | 'submittedByUserId' | 'decidedByUserId' | 'decisionComment'>;
export type PlanLineInput = {
  budgetRevisionLineId: string;
  materialId: string;
  uomId: string;
  quantity: string;
};
export type PlanContent = {
  validFrom: string;
  validTo: string;
  reason: string;
  lines: PlanLineInput[];
};
export type PlanResult = { id: string; projectId: string; revisionId: string; version: number; status: string };
const path = '/inventory/material-plans';
const query = (suffix: string, args: Record<string, string>) => {
  const params = new URLSearchParams();
  Object.entries(args).forEach(([key, value]) => { if (value) params.set(key, value); });
  return suffix + (params.size ? '?' + params.toString() : '');
};
const command = (suffix: string, body: unknown) =>
  apiRequest<Data<PlanResult>>(path + suffix, { method: 'POST', body: JSON.stringify(body) });

// This is only a typed client. Server-side Company, Project, Cost BOQ and
// maker/checker authorization always remains authoritative.
export const materialPlansApi = {
  projects: () => apiRequest<Data<PlanProject[]>>(path + '/projects', { cache: 'no-store' }),
  list: (projectId: string, after = '') =>
    apiRequest<Data<PlanPage<PlanSummary>>>(query(path, { projectId, after }), { cache: 'no-store' }),
  get: (id: string) => apiRequest<Data<MaterialPlan>>(path + '/' + id, { cache: 'no-store' }),
  history: (id: string, after = '') =>
    apiRequest<Data<PlanPage<PlanHistoryRow>>>(query(path + '/' + id + '/revisions', { after }), { cache: 'no-store' }),
  choices: (projectId: string, kind: 'warehouses' | 'materials' | 'revisions' | 'source-lines', basis = '', after = '') =>
    apiRequest<Data<PlanPage<PlanChoice>>>(query(path + '/choices', { projectId, kind, budgetRevisionId: basis, after }), { cache: 'no-store' }),
  create: (body: PlanContent & {
    requestKey: string; projectId: string; warehouseId: string;
    budgetRevisionId: string; workPackageCode: string;
  }) => command('', body),
  revise: (id: string, body: PlanContent & { requestKey: string; expectedVersion: number }) =>
    command('/' + id + '/revisions', body),
  submit: (id: string, body: { requestKey: string; expectedVersion: number }) => command('/' + id + '/submit', body),
  decide: (id: string, body: {
    requestKey: string; expectedVersion: number;
    decision: 'APPROVE' | 'REJECT'; comment: string;
  }) => command('/' + id + '/decision', body),
};
