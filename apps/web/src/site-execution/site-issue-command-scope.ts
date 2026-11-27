type Operation = { path: string; body: Record<string, unknown> };
type Scope = { identity: string; projectId: string; authorized: boolean; currentIssueId: string | null; permissions: readonly string[] };
type Pinned = { operation: Operation; identity: string; projectId: string };
export function maySendSiteIssueOperation(operation: Operation, scope: Scope): boolean {
  if (!scope.authorized || !scope.projectId) return false;
  const has = (right: string) => scope.permissions.includes('site.issue.' + right);
  if (operation.path === '') return has('view') && has('report') && operation.body.projectId === scope.projectId;
  if (operation.path === '/projects/' + scope.projectId + '/routing') return has('routing.manage');
  if (!scope.currentIssueId || !has('view')) return false;
  const prefix = '/' + scope.currentIssueId + '/';
  if (!operation.path.startsWith(prefix)) return false;
  const action = operation.path.slice(prefix.length);
  return action === 'follow-up' ? has('follow_up') : action === 'verify' ? has('verify') : action === 'close' && has('close');
}
export function pinSiteIssueOperation(operation: Operation, scope: Scope): Pinned | null {
  return maySendSiteIssueOperation(operation, scope) ? { operation, identity: scope.identity, projectId: scope.projectId } : null;
}
export function mayRetrySiteIssueOperation(pinned: Pinned | null, scope: Scope): boolean {
  return pinned !== null && pinned.identity === scope.identity && pinned.projectId === scope.projectId &&
    maySendSiteIssueOperation(pinned.operation, scope);
}
