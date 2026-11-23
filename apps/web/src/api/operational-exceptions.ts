import { apiRequest } from './client';

type Data<T> = { data: T };
const encoded = (id: string) => encodeURIComponent(id);
const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export type UrgentIssueDocumentState = {
  status: 'OPEN' | 'SUBMITTED' | 'RETURNED' | 'CLOSED';
  reason: string;
  createdByUserId: string;
  registeredAt: string;
  dueAt: string;
  sourcePostedAt: string;
  lastEventId: string;
  documentIds: string[];
  evidenceFingerprint: string | null;
  submittedAt: string | null;
  docsUploadedByDeadline: boolean | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewerNote: string | null;
  onTime: boolean | null;
  sourceCurrent: boolean;
  overdue: boolean;
  authority: 'DOCUMENT_TRACKING_ONLY_NO_STOCK_POSTING';
};
export type UrgentIssueDocumentStatus = {
  issueId: string;
  projectId: string;
  record: UrgentIssueDocumentState | null;
};
export type CountSchedule = {
  materialCategory: string | null;
  projectId: string;
  warehouseId: string;
  intervalDays: number;
  firstDueDate: string;
  nextDueDate: string | null;
  status: 'ACTIVE' | 'PAUSED';
  reason: string;
  version: number;
  lastEventId: string;
  changedAt: string;
  changedByUserId: string;
};
export type CountScheduleRead = {
  projectId: string;
  warehouseId: string;
  warehouseCode: string;
  asOfDate: string;
  schedules: CountSchedule[];
  completedPhysicalCountsAssessed: false;
  financeWriteOffAuthorized: false;
};
export type CountScheduleInput = {
  materialCategory: string | null;
  firstDueDate: string;
  intervalDays: number;
  status: 'ACTIVE' | 'PAUSED';
  reason: string;
  expectedPreviousEventId: string | null;
};
export type LossCase = {
  caseId: string;
  projectId: string;
  warehouseId: string;
  materialId: string;
  uomId: string;
  quantity: string;
  kind: 'LOSS' | 'DAMAGE' | 'WASTE';
  occurredOn: string;
  finderName: string;
  place: string;
  cause: string;
  proposedDisposition: 'REPAIR' | 'RETURN' | 'DISPOSAL';
  evidenceDocumentIds: string[];
  evidenceFingerprint: string;
  makerUserId: string;
  registeredAt: string;
  latestEventId: string;
  version: number;
  status: 'OPEN' | 'RETURNED' | 'NONDISPOSAL_REVIEWED' | 'BEN_PENDING' |
    'NANCY_PENDING' | 'NANCY_APPROVED_PENDING_EXECUTION' | 'NANCY_REJECTED';
  pmUserId: string | null;
  pmNote: string | null;
  benUserId: string | null;
  benNote: string | null;
  nancyUserId: string | null;
  nancyNote: string | null;
  stockDisposalExecuted: false;
  financeWriteOffPosted: false;
};
export type LossCaseInput = Pick<LossCase, 'projectId' | 'warehouseId' | 'materialId' |
 'uomId' | 'quantity' | 'kind' | 'occurredOn' | 'finderName' | 'place' |
 'cause' | 'proposedDisposition' | 'evidenceDocumentIds'>;

const urgent = (id: string) => '/inventory/urgent-issue-documents/' + encoded(id);
const loss = (id: string) => '/inventory/stock-loss-cases/' + encoded(id);
const schedule = (projectId: string, warehouseId: string) =>
  '/inventory/stock-count-schedules/projects/' + encoded(projectId) +
  '/sites/' + encoded(warehouseId);

export const operationalExceptionsApi = {
  urgentRead: (id: string) => apiRequest<Data<UrgentIssueDocumentStatus>>(urgent(id)),
  urgentRegister: (id: string, reason: string) =>
    apiRequest<Data<{ issueId: string; dueAt: string; recordedAsLate: boolean }>>(
      urgent(id) + '/register', json({ reason })),
  urgentSubmit: (id: string, documentIds: string[], completionNote: string) =>
    apiRequest<Data<{ issueId: string; evidenceFingerprint: string; dueAt: string }>>(
      urgent(id) + '/submit', json({ documentIds, completionNote })),
  urgentDecide: (
    id: string, decision: 'CLOSE' | 'RETURN',
    expectedSubmissionEventId: string, expectedFingerprint: string, note: string,
  ) => apiRequest<Data<{ issueId: string; decision: 'CLOSE' | 'RETURN'; onTime: boolean }>>(
    urgent(id) + '/decision',
    json({ decision, expectedSubmissionEventId, expectedFingerprint, note })),
  scheduleRead: (projectId: string, warehouseId: string, asOfDate: string) =>
    apiRequest<Data<CountScheduleRead>>(
      schedule(projectId, warehouseId) + '?asOfDate=' + encoded(asOfDate)),
  scheduleSet: (projectId: string, warehouseId: string, input: CountScheduleInput) =>
    apiRequest<Data<{ projectId: string; warehouseId: string; version: number }>>(
      schedule(projectId, warehouseId), json(input)),
  lossOpen: (input: LossCaseInput) =>
    apiRequest<Data<{ caseId: string; status: 'OPEN'; projectId: string }>>(
      '/inventory/stock-loss-cases', json(input)),
  lossRead: (id: string) => apiRequest<Data<LossCase>>(loss(id)),
  lossScreen: (
    id: string, expectedPreviousEventId: string,
    decision: 'RETURN' | 'NONDISPOSAL_REVIEW' | 'FORWARD_DISPOSAL',
    escalateToBen: boolean, note: string,
  ) => apiRequest<Data<{ caseId: string; newVersion: number }>>(
    loss(id) + '/pm-screen', json({ expectedPreviousEventId, decision, escalateToBen, note })),
  lossBenReview: (id: string, expectedPreviousEventId: string, note: string) =>
    apiRequest<Data<{ caseId: string; newVersion: number }>>(
      loss(id) + '/ben-review', json({ expectedPreviousEventId, note })),
  lossNancyDecision: (
    id: string, expectedPreviousEventId: string,
    decision: 'APPROVE_PROPOSAL' | 'REJECT_PROPOSAL', note: string,
  ) => apiRequest<Data<{ caseId: string; newVersion: number }>>(
    loss(id) + '/nancy-decision', json({ expectedPreviousEventId, decision, note })),
};
