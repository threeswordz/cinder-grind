/**
 * PUR14 fail-closed proof of a posted supplier replacement. Only verifies
 * canonical source facts; it never creates a GR, stock effect or Finance entry.
 */
export class SupplierReplacementProofError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'SupplierReplacementProofError'; }
}
const fail = (code: string): never => { throw new SupplierReplacementProofError(code); };
type Scope = { companyId: string; projectId: string; supplierId: string; purchaseOrderId: string };
type Line = { purchaseOrderLineId: string | null; materialId: string; uomId: string };
export type SupplierReplacementProofInput = {
  expected: Scope & Line & { discrepancyKind: string; claimAt: string };
  original: Scope & Line & {
    id: string; lineId: string; status: string; receivedAt: string;
    observedQuantity: string; goodQuantity: string; discrepancyDocumentLinked: boolean;
  };
  receipt: Scope & {
    id: string; itemId: string; postedAt: string | null; reversedAt: string | null;
    approvalState: string | null;
    item: Line & { quantity: string };
    delivery: Scope & {
      id: string; receivedAt: string; status: string; checkedAt: string | null;
      supersedesId: string | null; line: Line & { goodQuantity: string };
    };
  };
};
const sameScope = (a: Scope, b: Scope) =>
  a.companyId === b.companyId && a.projectId === b.projectId &&
  a.supplierId === b.supplierId && a.purchaseOrderId === b.purchaseOrderId;
const sameLine = (a: Line, b: Line) =>
  Boolean(a.purchaseOrderLineId) && a.purchaseOrderLineId === b.purchaseOrderLineId &&
  a.materialId === b.materialId && a.uomId === b.uomId;
function units(s: string): bigint {
  if (!/^\d{1,14}(?:\.\d{1,4})?$/.test(s)) return fail('PUR14_REPLACEMENT_QUANTITY_INVALID');
  const [whole, fraction = ''] = s.split('.');
  return BigInt(whole!) * 10000n + BigInt(fraction.padEnd(4, '0'));
}
function time(s: string | null): number {
  const ms = s === null ? NaN : Date.parse(s);
  if (!Number.isFinite(ms)) return fail('PUR14_REPLACEMENT_TIME_INVALID');
  return ms;
}
export function verifySupplierReplacementProof(input: SupplierReplacementProofInput) {
  const { expected: e, original: o, receipt: r } = input;
  // The existing receiving model can unambiguously calculate damaged-vs-good
  // units. Short/wrong/excess require separate quantity attribution decisions.
  if (e.discrepancyKind !== 'DAMAGED')
    return fail('PUR14_REPLACEMENT_SOURCE_KIND_NOT_YET_SUPPORTED');
  if (!sameScope(e, o) || !sameScope(e, r) || !sameScope(e, r.delivery))
    return fail('PUR14_REPLACEMENT_SCOPE_MISMATCH');
  if (!o.discrepancyDocumentLinked || o.status !== 'CHECKED' ||
      !sameLine(e, o) || !sameLine(e, r.item) || !sameLine(e, r.delivery.line))
    return fail('PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
  if (!r.id || !r.itemId || !r.delivery.id || o.id === r.delivery.id ||
      r.delivery.supersedesId !== null || r.delivery.status !== 'CHECKED' ||
      !r.delivery.checkedAt || r.approvalState !== 'APPROVED' ||
      !r.postedAt || r.reversedAt)
    return fail('PUR14_REPLACEMENT_POSTED_DISTINCT_CHECKED_GR_REQUIRED');
  const damaged = units(o.observedQuantity) - units(o.goodQuantity);
  if (damaged <= 0n || units(r.item.quantity) !== damaged ||
      units(r.delivery.line.goodQuantity) !== damaged)
    return fail('PUR14_REPLACEMENT_QUANTITY_MISMATCH');
  const claim = time(e.claimAt);
  if (time(o.receivedAt) >= claim || time(r.delivery.receivedAt) <= claim ||
      time(r.postedAt) < time(r.delivery.receivedAt) ||
      time(r.delivery.checkedAt) > time(r.postedAt))
    return fail('PUR14_REPLACEMENT_NOT_AFTER_CLAIM');
  const quantity = (damaged / 10000n).toString() + '.' + (damaged % 10000n).toString().padStart(4, '0');
  return {
    quantity,
    purchaseOrderLineId: e.purchaseOrderLineId!,
    materialId: e.materialId, uomId: e.uomId,
    originalDeliveryId: o.id, originalDeliveryLineId: o.lineId,
    replacementGoodsReceiptId: r.id, replacementGoodsReceiptItemId: r.itemId,
    replacementDeliveryId: r.delivery.id,
    claimAt: e.claimAt,
    effect: 'TRACE_ONLY_NO_STOCK_FINANCE_MUTATION' as const,
  };
}
