// A request action is owned by its original Project and request. In-flight
// and uncertain commands retain their exact key and body until settled/cleared.
type Intent = { suffix: string; body: unknown };
type Scope = { projectId: string; requestId: string | null; authorized: boolean; permissions: readonly string[] };
const required: Record<string, readonly string[]> = {
  create: ['inventory.material_request.create'],
  revisions: ['inventory.material_request.edit'],
  'issue-links': ['inventory.material_request.link', 'inventory.issue.view'],
  receipts: ['inventory.material_request.acknowledge', 'inventory.issue.view', 'documents.document.view'],
};
export function maySendMaterialRequestCommand(intent: Intent, scope: Scope): boolean {
  if (!scope.authorized || !scope.projectId || !scope.permissions.includes('inventory.material_request.view')) return false;
  let action: string;
  if (scope.requestId === null) {
    if (intent.suffix !== '' || !intent.body || typeof intent.body !== 'object' ||
        !('projectId' in intent.body) || intent.body.projectId !== scope.projectId) return false;
    action = 'create';
  } else {
    const prefix = '/' + scope.requestId + '/';
    if (!intent.suffix.startsWith(prefix)) return false;
    action = intent.suffix.slice(prefix.length);
    if (action === 'create') return false;
  }
  return Object.hasOwn(required, action) && required[action]!.every(p => scope.permissions.includes(p));
}
export function createMaterialRequestCommandGate() {
  let pending: { intent: Intent; projectId: string; requestId: string | null } | null = null;
  let running = false;
  const owns = (scope: Scope) => pending !== null && pending.projectId === scope.projectId && pending.requestId === scope.requestId;
  return {
    hasPending: () => pending !== null || running,
    begin(intent: Intent, scope: Scope): boolean {
      if (pending || running || !maySendMaterialRequestCommand(intent, scope)) return false;
      pending = { intent, projectId: scope.projectId, requestId: scope.requestId }; running = true; return true;
    },
    retry(scope: Scope): Intent | null {
      if (!pending || running || !owns(scope) || !maySendMaterialRequestCommand(pending.intent, scope)) return null;
      running = true; return pending.intent;
    },
    succeed() { pending = null; },
    settle() { running = false; },
    clear(scope: Scope): boolean {
      if (running || !owns(scope)) return false;
      pending = null; return true;
    },
  };
}
export type MaterialRequestCommandGate = ReturnType<typeof createMaterialRequestCommandGate>;
export type MaterialRequestCommandScope = Scope;
