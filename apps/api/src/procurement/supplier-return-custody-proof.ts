/**
 * PUR14: physical supplier return of DAMAGED units that never became usable
 * stock. This proves only an operator-attested, source-linked supplier
 * handover, NOT a canonical inventory issue, GR reversal or Finance credit.
 *
 * Accepted GOOD units may already have a posted GR. They are not included
 * in the damaged held quantity; returning posted goods needs a separately
 * authorized canonical stock reversal with its own Company/Project controls.
 */
export class SupplierReturnCustodyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; this.name = 'SupplierReturnCustodyError'; }
}
const fail = (code: string): never => { throw new SupplierReturnCustodyError(code); };
type Scope = { companyId: string; projectId: string; supplierId: string; purchaseOrderId: string };
type Item = { purchaseOrderLineId: string | null; materialId: string; uomId: string };
export type SupplierReturnCustodyProofInput = {
  expected: Scope & Item & { discrepancyKind: string };
  original: Scope & Item & {
    deliveryId: string; lineId: string; warehouseId: string;
    status: string; condition: string; checkedAt: string | null;
    superseded: boolean; observedQuantity: string; goodQuantity: string;
    conditionPhotoVerified: boolean;
  };
  handover: {
    quantity: string; supplierSignatory: string; supplierSignatureConfirmed: boolean;
    documentId: string; documentChecksum: string | null;
    documentDistinctFromConditionPhoto: boolean;
  };
};
const sameScope = (a: Scope, b: Scope) =>
  a.companyId === b.companyId && a.projectId === b.projectId &&
  a.supplierId === b.supplierId && a.purchaseOrderId === b.purchaseOrderId;
function units(s: string): bigint {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(s))
    return fail('PUR14_RETURN_QUANTITY_INVALID');
  const [whole, decimals = ''] = s.split('.');
  return BigInt(whole!) * 10000n + BigInt(decimals.padEnd(4, '0'));
}
function format(n: bigint): string {
  return (n / 10000n).toString() + '.' + (n % 10000n).toString().padStart(4, '0');
}
export function verifySupplierReturnCustody(input: SupplierReturnCustodyProofInput) {
  const { expected: e, original: o, handover: h } = input;
  if (e.discrepancyKind !== 'DAMAGED')
    return fail('PUR14_RETURN_KIND_REQUIRES_ATTRIBUTION_POLICY');
  if (!sameScope(e, o) ||
      !e.purchaseOrderLineId || e.purchaseOrderLineId !== o.purchaseOrderLineId ||
      e.materialId !== o.materialId || e.uomId !== o.uomId)
    return fail('PUR14_RETURN_SOURCE_SCOPE_OR_ITEM_MISMATCH');
  if (!o.deliveryId || !o.lineId || !o.warehouseId ||
      o.status !== 'CHECKED' || o.condition !== 'DAMAGED' ||
      !o.checkedAt || o.superseded || !o.conditionPhotoVerified)
    return fail('PUR14_RETURN_CHECKED_DAMAGED_CUSTODY_SOURCE_REQUIRED');
  const damaged = units(o.observedQuantity) - units(o.goodQuantity);
  if (damaged <= 0n || units(h.quantity) <= 0n ||
      units(h.quantity) !== damaged)
    return fail('PUR14_RETURN_UNPOSTED_DAMAGED_QUANTITY_REQUIRED');
  // Source and signed-handover evidence are user reported, not a verified
  // third-party receipt. Require a distinct uploaded, checksummed document
  // plus named witness attestation, not the original condition photo alone.
  if (!h.supplierSignatureConfirmed ||
      typeof h.supplierSignatory !== 'string' ||
      h.supplierSignatory.trim().length < 2 ||
      h.supplierSignatory.trim().length > 200 ||
      /[\x00-\x1f\x7f]/.test(h.supplierSignatory) ||
      !h.documentDistinctFromConditionPhoto ||
      !h.documentId ||
      !h.documentChecksum || !/^[a-f0-9]{64}$/i.test(h.documentChecksum))
    return fail('PUR14_RETURN_SIGNED_SUPPLIER_DOCUMENT_REQUIRED');
  return {
    returnType: 'UNPOSTED_DAMAGED_CUSTODY_ONLY' as const,
    originalDeliveryId: o.deliveryId, originalDeliveryLineId: o.lineId,
    purchaseOrderLineId: o.purchaseOrderLineId!, materialId: o.materialId,
    uomId: o.uomId, warehouseId: o.warehouseId,
    quantity: format(damaged),
    signedHandoverDocumentId: h.documentId,
    signedHandoverChecksum: h.documentChecksum.toLowerCase(),
    supplierSignatory: h.supplierSignatory.trim(),
    signedHandoverOperatorAttested: true as const,
    stockEffect: false as const,
    financeEffect: false as const,
    requiresSeparateCanonicalReversalForPostedGoods: true as const,
    financeResolution: 'REPLACEMENT_ONLY_NO_AP_CREDIT' as const,
  };
}
