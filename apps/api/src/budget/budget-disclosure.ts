import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';

export const QUANTITY_VIEW = 'budget.quantity.view';
export function quantityWithoutCost(auth: AuthenticatedUserContext, kind: 'BOQ' | 'REVISION' = 'REVISION') {
  return auth.permissions.includes(QUANTITY_VIEW) && !auth.permissions.includes(kind === 'BOQ' ? 'budget.boq.view' : 'budget.revision.view');
}
export function assertCostReportDisclosure(auth: AuthenticatedUserContext) {
  if (quantityWithoutCost(auth)) throw new ForbiddenException({ code: 'BOQ_COST_DISCLOSURE_DENIED', detail: 'This report contains protected Budget costs. Explicit full Budget read authority is required.' });
}
export async function persistedBudgetActor(tx: Prisma.TransactionClient, supplied: AuthenticatedUserContext) {
  const user = await tx.user.findFirst({ where: { id: supplied.userId, companyId: supplied.companyId, isActive: true, company: { isActive: true } },
    include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } });
  if (!user) throw new ForbiddenException({ code: 'BUDGET_ACTOR_DENIED', detail: 'An active Company user is required.' });
  const roles = user.userRoles.map((r) => r.role).filter((r) => r.isActive && r.companyId === supplied.companyId);
  return { ...supplied, roleCodes: roles.map((r) => r.roleCode), permissions: [...new Set(roles.flatMap((r) => r.rolePermissions.map((p) => p.permission.permissionCode)))] };
}

// A whitelist, deliberately excluding notes, comments, money and future fields.
// Quantities/UOMs remain exact values, never converted to JS numeric amounts.
export function quantityRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(quantityRecord);
  if (value === null || value === undefined) return value;
  const row = value as Record<string, unknown>;
  const keys = ['id','projectId','companyId','boqId','boqName','budgetRevisionId','boqItemId',
    'revisionNo','revisionNumber','lifecycleState','isOriginal','isCurrent','createdAt','submittedAt',
    'itemCode','description','sectionId','sectionCode','sectionName','quantity','uomId','uomCode','uomName',
    'wbsId','wbsCode','wbsName','costCodeId','costCode','costName','sortOrder','isActive'];
  const out: Record<string, unknown> = {};
  for (const key of keys) if (Object.hasOwn(row, key)) out[key] = row[key];
  for (const key of ['items','lines','sections']) if (Array.isArray(row[key])) out[key] = (row[key] as unknown[]).map(value => {const projected=quantityRecord(value) as Record<string,unknown>;if(key==='sections')delete projected.description;return projected;});
  for (const [key, fields] of Object.entries({
    project: ['id','projectCode','projectName'], section: ['id','sectionCode','sectionName'],
    uom: ['id','uomCode','uomName','decimalPlaces'], wbs: ['id','wbsCode','wbsName'], costCode: ['id','costCode','costName'],
    approvalInstance: ['id','approvalState','currentStepNo','startedAt','completedAt'],
  })) if (Object.hasOwn(row,key)) {
    const child = row[key];
    // Approved revision snapshots store a scalar code; working items carry the
    // relation object. Preserve that distinction without copying unknown shapes.
    if (key === 'costCode' && typeof child === 'string') out[key] = child;
    else if (child === null) out[key] = null;
    else if (typeof child === 'object' && !Array.isArray(child)) {
      const record = child as Record<string,unknown>;
      out[key] = Object.fromEntries(fields.filter((f) => Object.hasOwn(record,f)).map((f) => [f,record[f]]));
    } else delete out[key];
  }
  return out;
}
export function budgetMutationReceipt(value: unknown) {
  const row = value as Record<string,unknown>;
  return Object.fromEntries(['id','projectId','boqId','lifecycleState','revisionNo','revisionNumber'].filter((k) => Object.hasOwn(row,k)).map((k) => [k,row[k]]));
}
