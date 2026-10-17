import assert from 'node:assert/strict';
import test from 'node:test';
import {
  visibleNavigationKeys, mayReadMyPurchaseRequests, isAccessibleProject,
  selectedAccessibleProject, ownEditablePurchaseRequests, verifiedPurchaseRequestLink,
  effectiveUiQueryScope, projectContextQueryKey, myPurchaseRequestsQueryKey,
} from './role-workspace-policy.ts';

test('D3 query scope isolates user, Company, permission and Project changes', () => {
  const permissions = ['projects.project.view', 'procurement.pr.view'];
  const copy = [...permissions];
  const a = effectiveUiQueryScope('user-A', 'company-A', permissions);
  assert.equal(a, effectiveUiQueryScope('user-A', 'company-A', [...permissions].reverse()));
  assert.equal(a, effectiveUiQueryScope('user-A', 'company-A', [...permissions, permissions[0]]));
  assert.deepEqual(permissions, copy);
  assert.notEqual(a, effectiveUiQueryScope('user-B', 'company-A', permissions));
  assert.notEqual(a, effectiveUiQueryScope('user-A', 'company-B', permissions));
  assert.notEqual(a, effectiveUiQueryScope('user-A', 'company-A', ['projects.project.view']));
  assert.notEqual(a, effectiveUiQueryScope('user-A', 'company-A', [...permissions, 'finance.payment.view']));
  assert.deepEqual(projectContextQueryKey(a, 'procurement'), ['v1.1', 'project-context', a, 'procurement']);
  assert.notDeepEqual(projectContextQueryKey(a, 'procurement'), projectContextQueryKey(a, 'projects'));
  assert.deepEqual(myPurchaseRequestsQueryKey(a, 'project-A'), ['v1.1', 'my-prs', a, 'project-A']);
  assert.notDeepEqual(myPurchaseRequestsQueryKey(a, 'project-A'), myPurchaseRequestsQueryKey(a, 'project-B'));
});

const projects = [{ id: 'project-A' }, { id: 'project-B' }];
const rows = [
  { id: 'a-draft', companyId: 'company-A', projectId: 'project-A', createdByUserId: 'user-A', lifecycleState: 'DRAFT' },
  { id: 'a-rejected', companyId: 'company-A', projectId: 'project-A', createdByUserId: 'user-A', lifecycleState: 'REJECTED' },
  { id: 'a-submitted', companyId: 'company-A', projectId: 'project-A', createdByUserId: 'user-A', lifecycleState: 'SUBMITTED' },
  { id: 'a-approved', companyId: 'company-A', projectId: 'project-A', createdByUserId: 'user-A', lifecycleState: 'APPROVED' },
  { id: 'other-user', companyId: 'company-A', projectId: 'project-A', createdByUserId: 'user-B', lifecycleState: 'DRAFT' },
  { id: 'other-company', companyId: 'company-B', projectId: 'project-A', createdByUserId: 'user-A', lifecycleState: 'DRAFT' },
  { id: 'other-project', companyId: 'company-A', projectId: 'project-B', createdByUserId: 'user-A', lifecycleState: 'DRAFT' },
];

test('navigation only exposes existing permission-filtered source modules', () => {
  assert.deepEqual(visibleNavigationKeys(['projects', 'finance', 'purchase-requests'], ['projects', 'purchase-requests']), ['projects', 'purchase-requests']);
  assert.deepEqual(visibleNavigationKeys(['finance'], []), []);
});

test('role names and manage/approve permissions do not fabricate a My Work PR queue', () => {
  assert.equal(mayReadMyPurchaseRequests(['procurement.pr.approve'], ['purchase-requests']), false);
  assert.equal(mayReadMyPurchaseRequests(['procurement.pr.view'], ['projects']), false);
  assert.equal(mayReadMyPurchaseRequests(['procurement.pr.view'], ['purchase-requests']), true);
});

test('Project context only accepts Project IDs returned by authorized source', () => {
  assert.equal(isAccessibleProject('project-A', projects), true);
  assert.equal(isAccessibleProject('project-Z', projects), false);
  assert.equal(isAccessibleProject('', projects), false);
  assert.equal(selectedAccessibleProject('project-B', projects), 'project-B');
  assert.equal(selectedAccessibleProject('project-Z', projects), 'project-A');
  assert.equal(selectedAccessibleProject('project-A', []), '');
});

test('only current subject draft/rejected PRs in Company and selected Project are shown', () => {
  const filtered = ownEditablePurchaseRequests(rows, 'user-A', 'company-A', 'project-A', projects);
  assert.deepEqual(filtered.map((p) => p.id), ['a-draft', 'a-rejected']);
  assert.deepEqual(rows.map((p) => p.id), [
    'a-draft', 'a-rejected', 'a-submitted', 'a-approved', 'other-user', 'other-company', 'other-project',
  ]);
});

test('changing Project does not retain previous Project tasks', () => {
  assert.deepEqual(ownEditablePurchaseRequests(rows, 'user-A', 'company-A', 'project-B', projects).map((r) => r.id), ['other-project']);
  assert.deepEqual(ownEditablePurchaseRequests(rows, 'user-A', 'company-A', 'project-Z', projects), []);
  assert.deepEqual(ownEditablePurchaseRequests(rows, 'user-A', 'company-A', '', projects), []);
});

test('cross-user or cross-company subject cannot reuse another identity’s rows', () => {
  assert.deepEqual(ownEditablePurchaseRequests(rows, 'user-B', 'company-A', 'project-A', projects).map((r) => r.id), ['other-user']);
  assert.deepEqual(ownEditablePurchaseRequests(rows, 'user-A', 'company-B', 'project-A', projects).map((r) => r.id), ['other-company']);
  assert.deepEqual(ownEditablePurchaseRequests(rows, '', 'company-A', 'project-A', projects), []);
});

test('source deep links require the same authorized Project and a visible PR row', () => {
  const visible = ownEditablePurchaseRequests(rows, 'user-A', 'company-A', 'project-A', projects);
  assert.deepEqual(verifiedPurchaseRequestLink('a-draft', 'project-A', projects, visible), { projectId: 'project-A', requestId: 'a-draft' });
  for (const id of ['a-approved', 'other-user', 'other-company', 'other-project', '', 'not-found']) {
    assert.equal(verifiedPurchaseRequestLink(id, 'project-A', projects, visible), null);
  }
  assert.equal(verifiedPurchaseRequestLink('a-draft', 'project-Z', projects, visible), null);
  assert.equal(verifiedPurchaseRequestLink('a-draft', 'project-B', projects, visible), null);
});
