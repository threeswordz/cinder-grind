// SS16: current Company membership and exact same-role grants, no implicit delegate.
export type RoleAssignment = {
  companyId: string;
  role: {
    companyId: string;
    isActive: boolean;
    roleCode: string;
    rolePermissions: { permission: { permissionCode: string } }[];
  };
};
export function currentCompanyRoles(companyId: string, assignments: RoleAssignment[]) {
  return assignments.filter(a => a.companyId === companyId &&
    a.role.companyId === companyId && a.role.isActive).map(a => a.role);
}
export type MovementKind = 'GOODS_RECEIPT' | 'MATERIAL_ISSUE' | 'MATERIAL_RETURN' | 'STOCK_TRANSFER';
const prefixes: Record<MovementKind, string> = {
  GOODS_RECEIPT: 'inventory.receipt', MATERIAL_ISSUE: 'inventory.issue',
  MATERIAL_RETURN: 'inventory.return', STOCK_TRANSFER: 'inventory.transfer',
};
export type CorrectionActor = {
  companyId: string; userId: string; permissions: string[]; roleCodes: string[];
};
export type CorrectionAction = 'REQUEST' | 'APPROVE' | 'REJECT' | 'READ_OWN' | 'READ_REVIEW';
export type CorrectionAuthorityInput = {
  auth: CorrectionActor;
  source: { companyId: string; kind: MovementKind; projectIds: string[] };
  live: { assignments: RoleAssignment[]; employeeCompanyId: string; employeeActive: boolean; assignedProjectIds: string[] } | null;
  action: CorrectionAction;
  requesterUserId?: string;
};
export function correctionAuthority(input: CorrectionAuthorityInput): 'ALLOW' | 'DENY' {
  const { auth, source, live, action, requesterUserId } = input;
  if (!live || !live.employeeActive || live.employeeCompanyId !== auth.companyId ||
      source.companyId !== auth.companyId || !source.projectIds.length ||
      !source.projectIds.every(id => live.assignedProjectIds.includes(id))) return 'DENY';
  const prefix = prefixes[source.kind];
  if (!Object.hasOwn(prefixes, source.kind)) return 'DENY';
  if (action !== 'REQUEST' && action !== 'APPROVE' && action !== 'REJECT' && action !== 'READ_OWN' && action !== 'READ_REVIEW') return 'DENY';
  const request = action === 'REQUEST' || action === 'READ_OWN';
  if ((action === 'APPROVE' || action === 'REJECT') && (!requesterUserId || requesterUserId === auth.userId)) return 'DENY';
  const role = request ? 'STOREKEEPER' : 'PROJECT_MANAGER';
  const required = request ? [prefix + '.view', prefix + '.edit'] :
    [prefix + '.view', prefix + '.approve', prefix + '.reverse'];
  if (!auth.roleCodes.includes(role) || !required.every(p => auth.permissions.includes(p))) return 'DENY';
  return currentCompanyRoles(auth.companyId, live.assignments).some(r =>
    r.roleCode === role && required.every(p => r.rolePermissions.some(g => g.permission.permissionCode === p))) ? 'ALLOW' : 'DENY';
}
