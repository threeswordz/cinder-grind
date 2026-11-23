// PUR12/DEC-049: successor presentation ID. The canonical PO number, per-company
// monthly allocator and old immutable PO/revision identities are not rewritten.
// Company prefix and supplier short name are separate from supplier code.
export type PurchaseOrderPresentation = {
  displayNumber: string | null;
  supplierShortNameSnapshot: string | null;
};

export function purchaseOrderCompanyPrefix(
  companyCode: string,
): 'K' | 'T' | null {
  switch (companyCode.trim().toUpperCase()) {
    case 'MKE': return 'K';
    case 'TCJ': return 'T';
    default: return null; // Other synthetic/legacy companies keep existing PO numbers.
  }
}

export function purchaseOrderPresentation(
  companyCode: string,
  canonicalPoNumber: string,
  supplierShortName: string | null | undefined,
): PurchaseOrderPresentation {
  const prefix = purchaseOrderCompanyPrefix(companyCode);
  if (!prefix) return { displayNumber: null, supplierShortNameSnapshot: null };
  // Whitespace is normalized once at creation; later partner edits cannot
  // mutate the saved business-document identity.
  const shortName = supplierShortName?.trim().replace(/\s+/gu, ' ') || null;
  if (!shortName) return { displayNumber: null, supplierShortNameSnapshot: null };
  return {
    displayNumber: prefix + '-' + canonicalPoNumber + ' ' + shortName,
    supplierShortNameSnapshot: shortName,
  };
}
