import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import {
  visibleNavigationKeys, mayReadMyPurchaseRequests, isAccessibleProject,
  selectedAccessibleProject, ownEditablePurchaseRequests, verifiedPurchaseRequestLink,
  effectiveUiQueryScope, projectContextQueryKey, myPurchaseRequestsQueryKey,
  clearRoleWorkspaceQueries, isRoleWorkspaceQueryReady,
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

test('D3 React Query rejects previous context cache after effective permission, Company or Project changes', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const permissionSet = ['procurement.pr.view', 'projects.project.view'];
    const scope = effectiveUiQueryScope('user-A', 'company-A', permissionSet);
    const projectKey = projectContextQueryKey(scope, 'procurement');
    const prKey = myPurchaseRequestsQueryKey(scope, 'project-A');

    client.setQueryData(projectKey, [{ id: 'project-A' }]);
    client.setQueryData(prKey, [{ id: 'a-draft' }]);
    assert.deepEqual(client.getQueryData(projectKey), [{ id: 'project-A' }]);
    assert.deepEqual(client.getQueryData(prKey), [{ id: 'a-draft' }]);

    const downgraded = effectiveUiQueryScope('user-A', 'company-A', ['projects.project.view']);
    const otherCompany = effectiveUiQueryScope('user-A', 'company-B', permissionSet);
    const otherUser = effectiveUiQueryScope('user-B', 'company-A', permissionSet);
    for (const changed of [downgraded, otherCompany, otherUser]) {
      assert.equal(client.getQueryData(projectContextQueryKey(changed, 'procurement')), undefined);
      assert.equal(client.getQueryData(myPurchaseRequestsQueryKey(changed, 'project-A')), undefined);
    }
    assert.equal(client.getQueryData(projectContextQueryKey(scope, 'projects')), undefined);
    assert.equal(client.getQueryData(myPurchaseRequestsQueryKey(scope, 'project-B')), undefined);

    // A mocked query function counts deduplicated concurrent calls; this does
    // not measure a deployed API response, pagination, network latency or UAT.
    let requests = 0;
    const secondKey = myPurchaseRequestsQueryKey(scope, 'project-B');
    const query = () => client.fetchQuery({
      queryKey: secondKey,
      queryFn: async () => {
        requests += 1;
        return [{ id: 'project-B-only' }];
      },
    });
    const [first, second] = await Promise.all([query(), query()]);
    assert.deepEqual(first, second);
    assert.equal(requests, 1, 'concurrent identical keys deduplicate fetches');
    assert.deepEqual(client.getQueryData(prKey), [{ id: 'a-draft' }]);
  } finally {
    client.clear();
  }
});

test('D3 P1: returning A → B → A cannot reactivate cached Project/PR data', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    const scopeA = effectiveUiQueryScope('user-A', 'company-A', ['procurement.pr.view']);
    const scopeB = effectiveUiQueryScope('user-A', 'company-A', ['projects.project.view']);
    const keyA = projectContextQueryKey(scopeA, 'procurement');
    const prA = myPurchaseRequestsQueryKey(scopeA, 'project-A');
    const keyB = projectContextQueryKey(scopeB, 'projects');
    const prB = myPurchaseRequestsQueryKey(scopeB, 'project-B');
    const unrelated = ['projects', 'legacy-cache'];
    client.setQueryData(unrelated, { unrelated: true });
    client.setQueryData(keyA, [{ id: 'now-revoked-project-A' }]);
    client.setQueryData(prA, [{ id: 'revoked-pr-A' }]);
    assert.equal(isRoleWorkspaceQueryReady(null, scopeA), false);
    assert.equal(isRoleWorkspaceQueryReady(scopeA, scopeB), false);
    clearRoleWorkspaceQueries(client);
    assert.equal(client.getQueryData(keyA), undefined);
    assert.equal(client.getQueryData(prA), undefined);

    client.setQueryData(keyB, [{ id: 'project-B' }]);
    client.setQueryData(prB, [{ id: 'pr-B' }]);
    assert.equal(isRoleWorkspaceQueryReady(scopeB, scopeA), false);
    // B's data and even the previously cached A bucket must go before A is ready.
    clearRoleWorkspaceQueries(client);
    assert.equal(client.getQueryData(keyA), undefined);
    assert.equal(client.getQueryData(prA), undefined);
    assert.equal(client.getQueryData(keyB), undefined);
    assert.equal(client.getQueryData(prB), undefined);
    assert.equal(isRoleWorkspaceQueryReady(scopeA, scopeA), true);
    assert.deepEqual(client.getQueryData(unrelated), { unrelated: true });
  } finally {
    client.clear();
  }
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
