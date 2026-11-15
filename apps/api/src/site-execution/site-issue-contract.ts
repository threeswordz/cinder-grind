import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { siteObject, siteUuid, optionalSiteUuid, requiredSiteString } from './site-execution-validation';

export const ISSUE_CATEGORIES = ['GENERAL', 'SAFETY', 'QUALITY', 'ASSET_LOSS_DAMAGE'] as const;
export type IssueCategory = typeof ISSUE_CATEGORIES[number];
export type IssueState = 'OPEN' | 'AWAITING_VERIFICATION' | 'VERIFIED' | 'CLOSED';
export type IssueAction = 'FOLLOW_UP' | 'VERIFY' | 'CLOSE';
export type IssueFacts = {
  category: IssueCategory;
  affectsCostOrDelivery: boolean;
  workStopped: boolean;
  deliveryDelayRisk: boolean;
};
export type IssueCreate = IssueFacts & {
  requestKey: string; projectId: string; reportId: string | null; activityId: string | null; description: string;
};
export type IssueCommand = {
  requestKey: string; expectedVersion: number; note: string;
  resolved?: boolean; assetSeverity?: 'SEVERE' | 'NOT_SEVERE';
};
export function issueInvalid(): never {
  throw new UnprocessableEntityException({ code: 'SITE_ISSUE_INPUT_INVALID' });
}
function keys(body: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(body).some(k => !allowed.includes(k))) issueInvalid();
}
function boolean(body: Record<string, unknown>, key: string): boolean {
  const value = body[key]; if (typeof value !== 'boolean') issueInvalid(); return value;
}
export function issueVersion(value: unknown, minimum = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum || value > 2147483646) issueInvalid();
  return value;
}
export function issueCreateInput(value: unknown): IssueCreate {
  const b = siteObject(value);
  keys(b, ['requestKey', 'projectId', 'reportId', 'activityId', 'description', 'category', 'affectsCostOrDelivery', 'workStopped', 'deliveryDelayRisk']);
  if (!ISSUE_CATEGORIES.includes(b.category as IssueCategory)) issueInvalid();
  return { requestKey: siteUuid(b.requestKey, 'requestKey'), projectId: siteUuid(b.projectId, 'projectId'),
    reportId: optionalSiteUuid(b.reportId, 'reportId') ?? null, activityId: optionalSiteUuid(b.activityId, 'activityId') ?? null,
    description: requiredSiteString(b, 'description', 10000), category: b.category as IssueCategory,
    affectsCostOrDelivery: boolean(b, 'affectsCostOrDelivery'), workStopped: boolean(b, 'workStopped'),
    deliveryDelayRisk: boolean(b, 'deliveryDelayRisk') };
}
export function issueCommandInput(value: unknown, action: IssueAction): IssueCommand {
  const b = siteObject(value);
  keys(b, ['requestKey', 'expectedVersion', 'note', ...(action === 'VERIFY' ? ['resolved'] : []),
    ...(action === 'FOLLOW_UP' ? ['assetSeverity'] : [])]);
  const result: IssueCommand = { requestKey: siteUuid(b.requestKey, 'requestKey'),
    expectedVersion: issueVersion(b.expectedVersion), note: requiredSiteString(b, 'note', 10000) };
  if (action === 'VERIFY') result.resolved = boolean(b, 'resolved');
  if (b.assetSeverity !== undefined) {
    if (!['SEVERE', 'NOT_SEVERE'].includes(String(b.assetSeverity))) issueInvalid();
    result.assetSeverity = b.assetSeverity as 'SEVERE' | 'NOT_SEVERE';
  }
  return result;
}
export function immediateIssueEscalation(f: IssueFacts): boolean {
  return f.workStopped || f.deliveryDelayRisk ||
    (['SAFETY', 'QUALITY'].includes(f.category) && f.affectsCostOrDelivery);
}
export function issueTransition(issue: { status: string; category: string; reporterUserId: string; ownerUserId: string },
  actorUserId: string, action: IssueAction, command: IssueCommand): IssueState {
  const ownerAction = action !== 'VERIFY';
  if (actorUserId !== (ownerAction ? issue.ownerUserId : issue.reporterUserId)) {
    throw new ForbiddenException({ code: 'SITE_ISSUE_ASSIGNED_ACTOR_REQUIRED' });
  }
  const required = action === 'FOLLOW_UP' ? 'OPEN' : action === 'VERIFY' ? 'AWAITING_VERIFICATION' : 'VERIFIED';
  if (issue.status !== required) throw new ConflictException({ code: 'SITE_ISSUE_TRANSITION_CONFLICT' });
  if (action === 'FOLLOW_UP' && (issue.category === 'ASSET_LOSS_DAMAGE') !== Boolean(command.assetSeverity)) issueInvalid();
  return action === 'FOLLOW_UP' ? 'AWAITING_VERIFICATION' : action === 'CLOSE' ? 'CLOSED' : command.resolved ? 'VERIFIED' : 'OPEN';
}
