export type SourceLinkSection =
  | 'purchase-requests'
  | 'sourcing'
  | 'purchase-orders'
  | 'inventory'
  | 'finance'
  | 'payments'
  | 'subcontracts';

export type SourceLinkRecordKind =
  | 'subcontract-agreement'
  | 'subcontract-work-order'
  | 'subcontract-claim'
  | 'subcontract-certification';

export type SourceLinkTarget = {
  sectionKey: SourceLinkSection;
  projectId: string;
  recordId: string;
  childRecordId?: string;
  recordKind?: SourceLinkRecordKind;
};

const SOURCE_VIEW_PERMISSIONS: Record<SourceLinkSection, readonly string[]> = {
  'purchase-requests': ['procurement.pr.view'],
  sourcing: ['procurement.rfq.view', 'procurement.quotation.view'],
  'purchase-orders': ['procurement.po.view'],
  inventory: ['inventory.receipt.view'],
  finance: ['finance.supplier_invoice.view'],
  payments: ['finance.payment.view'],
  subcontracts: [
    'subcontracts.agreement.view',
    'subcontracts.claim.view',
    'subcontracts.certification.view',
  ],
};

export function canOpenSourceLink(
  sectionKey: SourceLinkSection,
  permissions: readonly string[],
): boolean {
  return SOURCE_VIEW_PERMISSIONS[sectionKey].some((permission) =>
    permissions.includes(permission),
  );
}

export function resolveLinkedProjectId(
  requestedProjectId: string | undefined,
  projects: readonly { id: string }[],
): string {
  if (!requestedProjectId) return '';
  return projects.some((project) => project.id === requestedProjectId)
    ? requestedProjectId
    : '';
}

export function resolveLinkedRecordId(
  requestedRecordId: string | undefined,
  projectId: string,
  records: readonly { id: string; projectId: string }[],
): string {
  if (!requestedRecordId || !projectId) return '';
  return records.some(
    (record) =>
      record.id === requestedRecordId && record.projectId === projectId,
  )
    ? requestedRecordId
    : '';
}

export function resolveLinkedChildRecordId(
  requestedRecordId: string | undefined,
  records: readonly { id: string }[],
): string {
  if (!requestedRecordId) return '';
  return records.some((record) => record.id === requestedRecordId)
    ? requestedRecordId
    : '';
}

export function consumeSourceLinkKey(
  lastApplied: { current: string },
  key: string,
): boolean {
  if (!key || lastApplied.current === key) return false;
  lastApplied.current = key;
  return true;
}

export function sourceLinkTarget(
  sectionKey: SourceLinkSection,
  projectId: string,
  recordId: string,
  childRecordId?: string,
  recordKind?: SourceLinkRecordKind,
): SourceLinkTarget | null {
  if (!projectId || !recordId) return null;
  return {
    sectionKey,
    projectId,
    recordId,
    ...(childRecordId ? { childRecordId } : {}),
    ...(recordKind ? { recordKind } : {}),
  };
}
