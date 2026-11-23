/**
 * PUR10 — purchase-order cancellation proposal and independent decision rules.
 *
 * Pure contract only. It NEVER cancels an order, posts a finance adjustment,
 * changes a receipt, sends supplier messages, or grants a permission.
 * Integration must enforce current DB session/employee/permission state,
 * Company/Project scope and transaction locks before using a returned decision.
 */
export type Pur10Role = 'PROCUREMENT_OFFICER' | 'PROJECT_MANAGER' | 'MANAGEMENT';
export type Pur10Status = 'PM_PENDING' | 'BEN_PENDING' | 'RETURNED' | 'REJECTED' | 'BEN_APPROVED';
export type Pur10Action = 'PROPOSE' | 'PM_FORWARD' | 'PM_RETURN' | 'BEN_APPROVE' | 'BEN_REJECT';

export type Pur10Actor = Readonly<{
  userId: string;
  companyId: string;
  roleCodes: readonly string[];
  permissions: readonly string[];
  sessionActive: boolean;
  employeeActive: boolean;
}>;
export type Pur10Order = Readonly<{
  id: string;
  companyId: string;
  projectId: string;
  poNumber: string;
  revisionNo: number;
  updatedAt: string;
  /** IDs from current, retained, independently verified business configuration. */
  configuredJaiUserId: string;
  configuredKhaimookUserId: string;
  configuredBenUserId: string;
  isLatestRevision: boolean;
  isCancelled: boolean;
  isRejected: boolean;
}>;
export type Pur10Case = Readonly<{
  caseId: string;
  companyId: string;
  projectId: string;
  orderId: string;
  poNumber: string;
  revisionNo: number;
  orderUpdatedAt: string;
  makerUserId: string;
  pmUserId: string | null;
  benUserId: string | null;
  version: number;
  status: Pur10Status;
}>;
export type Pur10Risk = Readonly<{
  postedUnreversedReceipt: boolean;
  approvedInvoiceSource: boolean;
  supplierRefusesCancellation: boolean;
  depositOrPenaltyUnresolved: boolean;
  partialDeliveryOrInvoice: boolean;
}>;
export type Pur10Decision = Readonly<{
  nextStatus: Pur10Status;
  action: Pur10Action;
  version: number;
  makerUserId: string;
  pmUserId: string | null;
  benUserId: string | null;
  effect: 'NO_PO_CHANGE';
}>;
export class Pur10PolicyError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
    this.name = 'Pur10PolicyError';
  }
}
function deny(code: string): never { throw new Pur10PolicyError(code); }
function validNote(value: string): boolean {
  return typeof value === 'string' && value.trim() === value &&
    value.length >= 3 && value.length <= 2000 && !/\p{Cc}/u.test(value);
}
function allowActor(actor: Pur10Actor, role: Pur10Role, permission: string, order: Pur10Order): void {
  if (!actor.sessionActive || !actor.employeeActive ||
      actor.companyId !== order.companyId ||
      !actor.roleCodes.includes(role) ||
      !actor.permissions.includes(permission)) {
    deny('PUR10_CURRENT_ROLE_AND_PERMISSION_REQUIRED');
  }
}
function checkOrder(order: Pur10Order): void {
  if (!order.id || !order.companyId || !order.projectId || !order.poNumber ||
      !Number.isSafeInteger(order.revisionNo) || order.revisionNo < 0 ||
      !order.updatedAt || !order.configuredJaiUserId ||
      !order.configuredKhaimookUserId || !order.configuredBenUserId ||
      new Set([order.configuredJaiUserId, order.configuredKhaimookUserId, order.configuredBenUserId]).size !== 3 ||
      !order.isLatestRevision || order.isCancelled || order.isRejected) {
    deny('PUR10_ACTIVE_LATEST_PO_REQUIRED');
  }
}
/**
 * Plan one append-only, versioned cancellation decision. Callers MUST compare
 * expectedVersion, orderUpdatedAt and current source under a transactional lock,
 * and persist a durable audit event; no return value authorizes direct PO cancel.
 */
export function planPur10Decision(input: Readonly<{
  action: Pur10Action;
  actor: Pur10Actor;
  order: Pur10Order;
  projectAuthorized: boolean;
  expectedVersion: number;
  note: string;
  current?: Pur10Case | null;
}>): Pur10Decision {
  const { action, actor, order, projectAuthorized, expectedVersion, note, current } = input;
  checkOrder(order);
  if (!projectAuthorized) deny('PUR10_PROJECT_SCOPE_DENIED');
  if (!validNote(note)) deny('PUR10_REASON_OR_NOTE_REQUIRED');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)
    deny('PUR10_VERSION_INVALID');
  if (action === 'PROPOSE') {
    if (current != null || expectedVersion !== 0)
      deny('PUR10_ACTIVE_PROPOSAL_OR_STALE_VERSION');
    allowActor(actor, 'PROCUREMENT_OFFICER', 'procurement.po.create', order);
    if (actor.userId !== order.configuredJaiUserId) deny('PUR10_NAMED_JAI_REQUIRED');
    return {
      action, nextStatus: 'PM_PENDING', version: 1,
      makerUserId: actor.userId, pmUserId: null, benUserId: null,
      effect: 'NO_PO_CHANGE',
    };
  }
  if (!current || current.version !== expectedVersion ||
      current.orderId !== order.id || current.companyId !== order.companyId ||
      current.projectId !== order.projectId || current.poNumber !== order.poNumber ||
      current.revisionNo !== order.revisionNo || current.orderUpdatedAt !== order.updatedAt) {
    deny('PUR10_STALE_OR_CHANGED_SOURCE');
  }
  if (actor.userId === current.makerUserId) deny('PUR10_SELF_REVIEW_DENIED');
  if (action === 'PM_FORWARD' || action === 'PM_RETURN') {
    allowActor(actor, 'PROJECT_MANAGER', 'procurement.po.view', order);
    if (actor.userId !== order.configuredKhaimookUserId) deny('PUR10_NAMED_PM_REQUIRED');
    if (current.status !== 'PM_PENDING' || current.pmUserId !== null)
      deny('PUR10_PM_STAGE_INVALID');
    return {
      action, nextStatus: action === 'PM_FORWARD' ? 'BEN_PENDING' : 'RETURNED',
      version: current.version + 1, makerUserId: current.makerUserId,
      pmUserId: actor.userId, benUserId: null, effect: 'NO_PO_CHANGE',
    };
  }
  if (action === 'BEN_APPROVE' || action === 'BEN_REJECT') {
    allowActor(actor, 'MANAGEMENT', 'procurement.po.approve', order);
    if (actor.userId !== order.configuredBenUserId) deny('PUR10_NAMED_BEN_REQUIRED');
    if (current.status !== 'BEN_PENDING' || !current.pmUserId ||
        current.benUserId !== null || actor.userId === current.pmUserId)
      deny('PUR10_INDEPENDENT_BEN_STAGE_REQUIRED');
    return {
      action, nextStatus: action === 'BEN_APPROVE' ? 'BEN_APPROVED' : 'REJECTED',
      version: current.version + 1, makerUserId: current.makerUserId,
      pmUserId: current.pmUserId, benUserId: actor.userId,
      effect: 'NO_PO_CHANGE',
    };
  }
  return deny('PUR10_ACTION_UNKNOWN');
}
/**
 * Final action gate for the eventual atomic PO cancellation integration.
 * This is a DENY-ONLY precondition; even true requires live receipt, AP, rev,
 * and authorization rechecks in the SAME write transaction that cancels the PO.
 */
export function assertPur10ReadyToCancel(
  current: Pur10Case,
  order: Pur10Order,
  risk: Pur10Risk,
): void {
  checkOrder(order);
  if (current.status !== 'BEN_APPROVED' || !current.pmUserId || !current.benUserId ||
      new Set([current.makerUserId, current.pmUserId, current.benUserId]).size !== 3)
    deny('PUR10_THREE_INDEPENDENT_DECISIONS_REQUIRED');
  if (current.orderId !== order.id || current.companyId !== order.companyId ||
      current.projectId !== order.projectId || current.poNumber !== order.poNumber ||
      current.revisionNo !== order.revisionNo || current.orderUpdatedAt !== order.updatedAt)
    deny('PUR10_SOURCE_CHANGED_SINCE_REVIEW');
  if (risk.postedUnreversedReceipt || risk.approvedInvoiceSource)
    deny('PUR10_RECEIPT_OR_FINANCE_SOURCE_LOCKED');
  if (risk.supplierRefusesCancellation || risk.depositOrPenaltyUnresolved || risk.partialDeliveryOrInvoice)
    deny('PUR10_OWNER_AND_FINANCE_EXCEPTION_DECISION_REQUIRED');
}
