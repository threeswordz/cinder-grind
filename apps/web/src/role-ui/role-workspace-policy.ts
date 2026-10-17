import type { QueryClient } from '@tanstack/react-query';

// V1.1-B: presentation-only guards over backend-authorized source data.
// The backend remains authoritative for permissions, Project scope and record actions.
// UI cache identity only; source APIs remain the authorization authority.
export function effectiveUiQueryScope(userId: string, companyId: string, permissions: readonly string[]): string {
  return JSON.stringify([userId, companyId, [...new Set(permissions)].sort()]);
}
export function projectContextQueryKey(scope: string, source: string) {
  return ['v1.1', 'project-context', scope, source] as const;
}
export function myPurchaseRequestsQueryKey(scope: string, projectId: string) {
  return ['v1.1', 'my-prs', scope, projectId] as const;
}

// Returning A → B → A must never resurrect A's old Project/PR snapshot.
// This only clears V1.1 workspace cache entries; the backend still authorizes.
export function clearRoleWorkspaceQueries(client: Pick<QueryClient, 'removeQueries'>): void {
  client.removeQueries({ queryKey: ['v1.1', 'project-context'] });
  client.removeQueries({ queryKey: ['v1.1', 'my-prs'] });
}

// Withhold workspace query data before the cache purge has completed.
export function isRoleWorkspaceQueryReady(readyScope: string | null, activeScope: string): boolean {
  return readyScope === activeScope;
}

export type ProjectChoice = { id: string };

export type EditablePurchaseRequest = {
  id: string;
  companyId: string;
  projectId: string;
  createdByUserId: string;
  lifecycleState: string;
};

export function visibleNavigationKeys(groupKeys: readonly string[], sourceSectionKeys: readonly string[]): string[] {
  const allowed = new Set(sourceSectionKeys);
  return groupKeys.filter((key) => allowed.has(key));
}

export function mayReadMyPurchaseRequests(
  permissions: readonly string[],
  sourceSectionKeys: readonly string[],
): boolean {
  return permissions.includes('procurement.pr.view') &&
    sourceSectionKeys.includes('purchase-requests');
}

export function isAccessibleProject(projectId: string, projects: readonly ProjectChoice[]): boolean {
  return Boolean(projectId) && projects.some((project) => project.id === projectId);
}

export function selectedAccessibleProject(
  current: string,
  projects: readonly ProjectChoice[],
): string {
  return isAccessibleProject(current, projects) ? current : (projects[0]?.id ?? '');
}

export function ownEditablePurchaseRequests<T extends EditablePurchaseRequest>(
  sourceRows: readonly T[],
  userId: string,
  companyId: string,
  selectedProjectId: string,
  accessibleProjects: readonly ProjectChoice[],
): T[] {
  if (!userId || !companyId || !isAccessibleProject(selectedProjectId, accessibleProjects)) {
    return [];
  }
  return sourceRows.filter((row) =>
    row.createdByUserId === userId &&
    row.companyId === companyId &&
    row.projectId === selectedProjectId &&
    (row.lifecycleState === 'DRAFT' || row.lifecycleState === 'REJECTED'),
  );
}

// A My Work shortcut may only link to a visible, authorized source row.
// The destination PurchaseRequestsPanel/API re-checks backend permission and scope.
export function verifiedPurchaseRequestLink(
  requestId: string,
  projectId: string,
  accessibleProjects: readonly ProjectChoice[],
  visibleRows: readonly { id: string; projectId: string }[],
): { projectId: string; requestId: string } | null {
  if (!requestId || !isAccessibleProject(projectId, accessibleProjects) ||
      !visibleRows.some((row) => row.id === requestId && row.projectId === projectId)) {
    return null;
  }
  return { projectId, requestId };
}
