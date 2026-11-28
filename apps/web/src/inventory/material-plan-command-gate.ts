// An uncertain command is pinned to its original project and plan; a retry
// must preserve the exact intent and must not depend on the old version still
// being current (the original write may already have committed).
type Command = { kind: 'CREATE'; body: { projectId: string } } |
  { kind: 'REVISE' | 'SUBMIT' | 'DECIDE'; id: string };
type Scope = { projectId: string; authorizedProject: boolean; planId: string | null; permissions: readonly string[] };
const action = { CREATE: 'create', REVISE: 'revise', SUBMIT: 'submit', DECIDE: 'approve' } as const;
export function maySendMaterialPlanCommand(intent: Command, scope: Scope): boolean {
  return scope.authorizedProject && Boolean(scope.projectId) &&
    scope.permissions.includes('inventory.material_plan.view') &&
    scope.permissions.includes('inventory.material_plan.' + action[intent.kind]) &&
    (intent.kind === 'CREATE' ? intent.body.projectId === scope.projectId : intent.id === scope.planId);
}
export function createMaterialPlanCommandGate<T extends Command>() {
  let pending: { intent: T; projectId: string } | null = null;
  let running = false;
  return {
    hasPending: () => pending !== null || running,
    begin(intent: T, scope: Scope): boolean {
      if (pending || running || !maySendMaterialPlanCommand(intent, scope)) return false;
      pending = { intent, projectId: scope.projectId }; running = true; return true;
    },
    retry(scope: Scope): T | null {
      if (!pending || running || pending.projectId !== scope.projectId ||
          !maySendMaterialPlanCommand(pending.intent, scope)) return null;
      running = true; return pending.intent;
    },
    succeed() { pending = null; },
    settle() { running = false; },
    clear(): boolean {
      if (running) return false;
      pending = null; return true;
    },
  };
}
