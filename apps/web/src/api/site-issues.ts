import { apiRequest } from './client';
type Data<T> = { data: T };
export type IssueCategory = 'GENERAL' | 'SAFETY' | 'QUALITY' | 'ASSET_LOSS_DAMAGE';
export type IssueState = 'OPEN' | 'AWAITING_VERIFICATION' | 'VERIFIED' | 'CLOSED';
export type IssuePerson = { id: string; displayName: string };
export type IssueSummary = {
  id: string; description: string; category: IssueCategory; status: IssueState;
  version: number; escalatedAt: string | null; createdAt: string;
};
export type IssueDetail = IssueSummary & {
  companyId: string; projectId: string; reportId: string | null; activityId: string | null;
  reporterUserId: string; ownerUserId: string; escalationUserId: string;
  affectsCostOrDelivery: boolean; workStopped: boolean; deliveryDelayRisk: boolean;
  assetSeverity: 'SEVERE' | 'NOT_SEVERE' | null; verifiedAt: string | null; closedAt: string | null;
  people: IssuePerson[];
  events: Array<{ id: string; version: number; action: string; status: IssueState;
    note: string; recordedAt: string; actor: IssuePerson }>;
  nextBeforeVersion: number | null;
};
export type IssueRouting = { projectId: string; version: number; owner: IssuePerson; escalation: IssuePerson };
export type IssueOptions = {
  activities: Array<{ id: string; activityCode: string; activityName: string }>;
  reports: Array<{ id: string; reportDate: string; status: string }>;
};
export type IssueAlerts = { total: number; items: Array<{ id: string; description: string; status: IssueState;
  escalatedAt: string; project: { id: string; projectCode: string; projectName: string } }> };
export type IssueOperation = { path: string; body: Record<string, unknown> };
export const siteIssuesApi = {
  projects: () => apiRequest<Data<Array<{ id: string; projectCode: string; projectName: string }>>>('/site-issues/projects'),
  options: (projectId: string) => apiRequest<Data<IssueOptions>>('/site-issues/options?projectId=' + encodeURIComponent(projectId)),
  routing: (projectId: string) => apiRequest<Data<IssueRouting | null>>('/site-issues/projects/' + projectId + '/routing'),
  candidates: (projectId: string) => apiRequest<Data<{ owners: IssuePerson[]; recipients: IssuePerson[] }>>('/site-issues/projects/' + projectId + '/routing-candidates'),
  list: (projectId: string, after: string) => apiRequest<Data<{ items: IssueSummary[]; nextCursor: string | null }>>(
    '/site-issues?projectId=' + encodeURIComponent(projectId) + (after ? '&after=' + encodeURIComponent(after) : '')),
  get: (id: string, before?: number) => apiRequest<Data<IssueDetail>>('/site-issues/' + id + (before ? '?beforeVersion=' + before : '')),
  alerts: () => apiRequest<Data<IssueAlerts>>('/site-issues/escalations'),
  send: ({ path, body }: IssueOperation) => apiRequest<Data<{ id?: string; projectId?: string; version: number; eventId?: string }>>(
    '/site-issues' + path, { method: 'POST', body: JSON.stringify(body) }),
};
