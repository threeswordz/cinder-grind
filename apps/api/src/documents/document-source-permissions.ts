// Existing owning-target permissions, shared by source and Project document paths.
// Project/WBS/Activity/Procurement attachment policy remains unchanged.
export const DOCUMENT_SOURCE_VIEW_PERMISSIONS: Readonly<Record<string, string>> = {
  BOQ: 'budget.boq.view',
  BUDGET_REVISION: 'budget.revision.view',
  CUSTOMER_BOQ: 'budget.customer.view',
  GOODS_RECEIPT: 'inventory.receipt.view',
  MATERIAL_RESERVATION: 'inventory.reservation.view',
  MATERIAL_ISSUE: 'inventory.issue.view',
  MATERIAL_RETURN: 'inventory.return.view',
  STOCK_TRANSFER: 'inventory.transfer.view',
  SUPPLIER_INVOICE: 'finance.supplier_invoice.view',
  CLIENT_INVOICE: 'finance.client_invoice.view',
  PAYMENT: 'finance.payment.view',
  SUBCONTRACT_AGREEMENT: 'subcontracts.agreement.view',
  SUBCONTRACT_WORK_ORDER: 'subcontracts.work_order.view',
  SUBCONTRACT_CLAIM: 'subcontracts.claim.view',
  SUBCONTRACT_CERTIFICATION: 'subcontracts.certification.view',
  SUBCONTRACT_VARIATION: 'subcontracts.variation.view',
};

export function documentSourcePermissions(entityType: string): readonly string[] {
  if (entityType === 'CUSTOMER_BOQ') return ['budget.customer.view','budget.boq.view','budget.revision.view'];
  const required = DOCUMENT_SOURCE_VIEW_PERMISSIONS[entityType];
  return required ? [required] : [];
}
