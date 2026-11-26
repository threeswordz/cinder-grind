/**
 * PUR08/PUR14 — pure, fail-closed business transition contract.
 * This is NOT an authenticated endpoint or inventory/Finance posting operation.
 * Persistence adapters must resolve live grants and Company/Project access,
 * validate actual PO/GR/Document source records, and append events atomically.
 */
export type SupplierAction =
  | 'ACKNOWLEDGE'
  | 'CONFIRM_IN_TRANSIT'
  | 'REPORT_DELAY'
  | 'REPORT_DISCREPANCY'
  | 'PM_REVIEW_DISCREPANCY'
  | 'JAI_RECORD_CLAIM'
  | 'STORE_RECORD_RETURN_DISPATCH'
  | 'STORE_RECORD_REPLACEMENT_RECEIPT';

export type SupplierCaseStage =
  | 'ACKNOWLEDGED'
  | 'IN_TRANSIT'
  | 'DELAY_REPORTED'
  | 'DISCREPANCY_REPORTED'
  | 'PM_REVIEWED'
  | 'CLAIM_RECORDED'
  | 'RETURN_DISPATCH_RECORDED'
  | 'REPLACEMENT_RECEIPT_RECORDED';

export type DiscrepancyKind = 'SHORT' | 'WRONG_ITEM' | 'EXCESS' | 'DAMAGED';
export type DiscrepancyDecision = 'REQUEST_RETURN' | 'REQUEST_REPLACEMENT' | 'DOCUMENT_ONLY';

export type SupplierDeliverySource = {
  purchaseOrderId: string;
  companyId: string;
  projectId: string;
  latestApprovedRevisionId: string;
  isLatestApprovedRevision: boolean;
  cancelled: boolean;
};
export type SupplierDeliveryActor = {
  userId: string;
  companyId: string;
  roleCodes: string[];
  permissions: string[];
  activeSession: boolean;
  activeEmployee: boolean;
};
export type SupplierDeliveryCase = {
  purchaseOrderId: string;
  companyId: string;
  projectId: string;
  revisionId: string;
  version: number;
  stage: SupplierCaseStage;
  storeReporterId: string | null;
  pmReviewerId: string | null;
  jaiClaimerId: string | null;
  discrepancyKind: DiscrepancyKind | null;
  pmDecision: DiscrepancyDecision | null;
};
export type SupplierDeliveryRequest = {
  action: SupplierAction;
  actor: SupplierDeliveryActor;
  source: SupplierDeliverySource;
  current: SupplierDeliveryCase | null;
  expectedVersion: number;
  projectAuthorized: boolean;
  evidenceDocumentId: string;
  note: string;
  discrepancyKind?: DiscrepancyKind;
  pmDecision?: DiscrepancyDecision;
  recordedGoodsReceiptId?: string;
  newSupplierExpectedDate?: string;
};

export class SupplierDeliveryPolicyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = 'SupplierDeliveryPolicyError'; }
}
const fail = (code: string): never => { throw new SupplierDeliveryPolicyError(code); };
const own = (roles: string[], code: string) => roles.includes(code);
function safeDate(input: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
  const date = new Date(input + 'T00:00:00.000Z');
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(input);
}
function recordSource(input: SupplierDeliveryRequest) {
  const { source, actor, current } = input;
  if (!actor.activeEmployee || !actor.activeSession || actor.companyId !== source.companyId)
    fail('PUR08_ACTIVE_ACTOR_AND_COMPANY_REQUIRED');
  if (!input.projectAuthorized) fail('PUR08_PROJECT_SCOPE_DENIED');
  if (!source.isLatestApprovedRevision || source.cancelled)
    fail('PUR08_CURRENT_APPROVED_UNCANCELLED_PO_REQUIRED');
  if (!source.purchaseOrderId || !source.latestApprovedRevisionId || !source.projectId)
    fail('PUR08_PO_SOURCE_INVALID');
  if (current && (current.companyId !== source.companyId ||
    current.projectId !== source.projectId || current.purchaseOrderId !== source.purchaseOrderId ||
    current.revisionId !== source.latestApprovedRevisionId))
    fail('PUR08_PO_REVISION_SOURCE_CHANGED');
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0 ||
    input.expectedVersion !== (current?.version ?? 0))
    fail('PUR08_STALE_CASE_VERSION');
  if (!input.note.trim() || input.note.length > 2000 ||
      !input.evidenceDocumentId.trim() || input.evidenceDocumentId.length > 128)
    fail('PUR08_SOURCE_EVIDENCE_AND_NOTE_REQUIRED');
}
function canJai(actor: SupplierDeliveryActor) {
  return own(actor.roleCodes, 'PROCUREMENT_OFFICER') &&
    actor.permissions.includes('procurement.po.view');
}
function canStore(actor: SupplierDeliveryActor) {
  return own(actor.roleCodes, 'STOREKEEPER') &&
    actor.permissions.includes('inventory.receiving.view');
}
function canPm(actor: SupplierDeliveryActor) {
  return own(actor.roleCodes, 'PROJECT_MANAGER') &&
    actor.permissions.includes('inventory.receipt.view');
}
/**
 * Records a traceable intent/evidence state; never changes a PO, stock quantity,
 * GR approval or Finance ledger. Claim/return/replacement are human claims,
 * not confirmed supplier actions or canonical physical postings.
 */
export function planSupplierDeliveryTransition(input: SupplierDeliveryRequest) {
  recordSource(input);
  const { actor, current, action } = input;
  const from = current?.stage ?? null;
  const state: SupplierDeliveryCase = {
    purchaseOrderId: input.source.purchaseOrderId,
    companyId: input.source.companyId,
    projectId: input.source.projectId,
    revisionId: input.source.latestApprovedRevisionId,
    version: (current?.version ?? 0) + 1,
    stage: 'ACKNOWLEDGED',
    storeReporterId: current?.storeReporterId ?? null,
    pmReviewerId: current?.pmReviewerId ?? null,
    jaiClaimerId: current?.jaiClaimerId ?? null,
    discrepancyKind: current?.discrepancyKind ?? null,
    pmDecision: current?.pmDecision ?? null,
  };
  if (action === 'ACKNOWLEDGE') {
    if (current || !canJai(actor)) fail('PUR08_INITIAL_JAI_ACK_EVIDENCE_REQUIRED');
    state.stage = 'ACKNOWLEDGED';
  } else if (action === 'CONFIRM_IN_TRANSIT') {
    if (!canJai(actor) || !['ACKNOWLEDGED', 'DELAY_REPORTED'].includes(from ?? ''))
      fail('PUR08_ACKNOWLEDGED_PO_AND_JAI_REQUIRED');
    state.stage = 'IN_TRANSIT';
  } else if (action === 'REPORT_DELAY') {
    if (!canJai(actor) || !['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED'].includes(from ?? '') ||
      !input.newSupplierExpectedDate || !safeDate(input.newSupplierExpectedDate))
      fail('PUR08_SUPPLIER_REVISED_DATE_EVIDENCE_REQUIRED');
    state.stage = 'DELAY_REPORTED';
  } else if (action === 'REPORT_DISCREPANCY') {
    if (!canStore(actor) || (from !== null && !['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED'].includes(from)) ||
      !input.discrepancyKind || !['SHORT','WRONG_ITEM','EXCESS','DAMAGED'].includes(input.discrepancyKind))
      fail('PUR14_STORE_DISCREPANCY_SOURCE_REQUIRED');
    state.stage = 'DISCREPANCY_REPORTED';
    state.storeReporterId = actor.userId;
    state.discrepancyKind = input.discrepancyKind!;
  } else if (action === 'PM_REVIEW_DISCREPANCY') {
    if (!canPm(actor) || from !== 'DISCREPANCY_REPORTED' || !state.storeReporterId ||
      actor.userId === state.storeReporterId ||
      !input.pmDecision || !['REQUEST_RETURN','REQUEST_REPLACEMENT','DOCUMENT_ONLY'].includes(input.pmDecision))
      fail('PUR14_INDEPENDENT_PM_DECISION_REQUIRED');
    state.stage = 'PM_REVIEWED';
    state.pmReviewerId = actor.userId;
    state.pmDecision = input.pmDecision!;
  } else if (action === 'JAI_RECORD_CLAIM') {
    if (!canJai(actor) || from !== 'PM_REVIEWED' || !state.pmReviewerId ||
      state.pmDecision === 'DOCUMENT_ONLY' || actor.userId === state.pmReviewerId)
      fail('PUR14_JAI_AFTER_PM_DECISION_REQUIRED');
    state.stage = 'CLAIM_RECORDED';
    state.jaiClaimerId = actor.userId;
  } else if (action === 'STORE_RECORD_RETURN_DISPATCH') {
    if (!canStore(actor) || from !== 'CLAIM_RECORDED' ||
      state.pmDecision !== 'REQUEST_RETURN' || !state.jaiClaimerId ||
      actor.userId === state.jaiClaimerId)
      fail('PUR14_STORE_RETURN_AFTER_AUTHORIZED_CLAIM_REQUIRED');
    // Owner-approved custody-only rule: SHORT, WRONG_ITEM and EXCESS remain
    // traceable claims, not an inferred physical stock/Finance resolution.
    if (state.discrepancyKind !== 'DAMAGED')
      fail('PUR14_RETURN_KIND_REQUIRES_ATTRIBUTION_POLICY');
    state.stage = 'RETURN_DISPATCH_RECORDED';
  } else if (action === 'STORE_RECORD_REPLACEMENT_RECEIPT') {
    if (!canStore(actor) || from !== 'CLAIM_RECORDED' ||
      state.pmDecision !== 'REQUEST_REPLACEMENT' || !state.jaiClaimerId ||
      actor.userId === state.jaiClaimerId || !input.recordedGoodsReceiptId?.trim())
      fail('PUR14_CANONICAL_REPLACEMENT_GR_REQUIRED');
    state.stage = 'REPLACEMENT_RECEIPT_RECORDED';
  } else {
    fail('PUR08_ACTION_INVALID');
  }
  return {
    case: state,
    action,
    actorUserId: actor.userId,
    evidenceDocumentId: input.evidenceDocumentId,
    note: input.note.trim(),
    newSupplierExpectedDate: action === 'REPORT_DELAY' ? input.newSupplierExpectedDate : undefined,
    recordedGoodsReceiptId: action === 'STORE_RECORD_REPLACEMENT_RECEIPT'
      ? input.recordedGoodsReceiptId : undefined,
    effect: 'NO_PO_GR_STOCK_FINANCE_MUTATION' as const,
  };
}
