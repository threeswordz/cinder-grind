import { apiRequest } from './client';

type Data<T> = { data: T };
export type PlanIssueBinding = {
  issueItemId: string;
  planLineId: string;
  expectedPlanVersion: number;
};
export type PlanIssuePreview = {
  issueId: string;
  result: 'WITHIN_PLAN' | 'OVERAGE_REQUIRED';
  overageQuantity: string;
  items: Array<{
    issueItemId: string;
    planId: string;
    planLineId: string;
    planVersion: number;
    quantity: string;
    overageQuantity: string;
    allowance: string;
    used: string;
    remaining: string;
  }>;
};
export type PlanIssuePolicy = {
  enabled: boolean;
  projectId: string;
  id?: string;
  syntheticOnly?: boolean;
  reason?: string;
  workflow?: { workflowCode: string };
};
export type PlanIssueAuthorization = {
  id: string;
  sequence: number;
  mode: 'DIRECT' | 'OVERAGE';
  createdByUserId: string;
  createdAt: string;
  approval: {
    approvalState: string;
    currentStepNo: number | null;
    actions: Array<{
      id: string;
      action: string;
      actionByUserId: string;
      comment: string | null;
    }>;
  } | null;
  lines: Array<{
    issueItemId: string;
    planId: string;
    planLineId: string;
    planVersion: number;
    quantity: string;
    overageQuantity: string;
  }>;
};
export type PlanIssueHistory = {
  binding: { issueId: string; policyId: string; authorizationId: string | null } | null;
  items: PlanIssueAuthorization[];
  nextCursor: string | null;
};
export type PlanIssueResult = { issueId: string; policyId: string; authorizationId: string };
const root = '/inventory/material-plan-issues';
const post = <T>(suffix: string, body: unknown) =>
  apiRequest<Data<T>>(root + suffix, { method: 'POST', body: JSON.stringify(body), cache: 'no-store' });

// The server is the only posting authority. Preview is never a reservation,
// approval, consumption write or stock movement.
export const materialPlanIssuesApi = {
  policy: (projectId: string) =>
    apiRequest<Data<PlanIssuePolicy>>(root + '/projects/' + projectId + '/policy', { cache: 'no-store' }),
  history: (issueId: string, after = '') =>
    apiRequest<Data<PlanIssueHistory>>(root + '/issues/' + issueId +
      (after ? '?' + new URLSearchParams({ after }).toString() : ''), { cache: 'no-store' }),
  preview: (issueId: string, bindings: PlanIssueBinding[]) =>
    post<PlanIssuePreview>('/issues/' + issueId + '/preview', {
      requestKey: crypto.randomUUID(), bindings,
    }),
  withinPlan: (issueId: string, requestKey: string, bindings: PlanIssueBinding[]) =>
    post<PlanIssueResult>('/issues/' + issueId + '/within-plan', { requestKey, bindings }),
  submitOverage: (issueId: string, requestKey: string, bindings: PlanIssueBinding[]) =>
    post<PlanIssueResult>('/issues/' + issueId + '/overage', { requestKey, bindings }),
  decide: (authorizationId: string, stage: 'review' | 'decision', requestKey: string,
    decision: 'APPROVE' | 'REJECT', comment: string) =>
    post<PlanIssueResult>('/authorizations/' + authorizationId + '/' + stage,
      { requestKey, decision, comment }),
};
