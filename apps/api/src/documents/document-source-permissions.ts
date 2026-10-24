// Existing owning-target permissions, shared by source and Project document paths.
// Project/WBS/Activity/Procurement attachment policy remains unchanged.
export const DOCUMENT_SOURCE_VIEW_PERMISSIONS: Readonly<Record<string, string>> = {
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
