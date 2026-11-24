import { Prisma } from '@prisma/client';

/**
 * SS14 / PM15: advisory classification of an APPROVED purchase-order line.
 * expectedDelivery comes only from the PO line, never an approved plan's
 * validFrom or a goods-receipt timestamp. A PO does not identify a site.
 */
export type SupplierDateWindow =
  'DATE_UNKNOWN' | 'LATE' | 'DUE_TODAY' | 'WITHIN_7_DAYS' | 'WITHIN_14_DAYS' | 'LATER';

function dayNumber(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith('0000'))
    throw new RangeError('SS14_SUPPLIER_DATE_INVALID');
  const millis = Date.parse(date + 'T00:00:00.000Z');
  if (!Number.isFinite(millis) || new Date(millis).toISOString().slice(0, 10) !== date)
    throw new RangeError('SS14_SUPPLIER_DATE_INVALID');
  return Math.floor(millis / 86400000);
}

export function supplierDateWindow(
  sourceDate: string | null, businessDate: string,
): { window: SupplierDateWindow; daysUntil: number | null } {
  const today = dayNumber(businessDate);
  if (sourceDate === null) return { window: 'DATE_UNKNOWN', daysUntil: null };
  const days = dayNumber(sourceDate) - today;
  return {
    daysUntil: days,
    window: days < 0 ? 'LATE' : days === 0 ? 'DUE_TODAY' :
      days <= 7 ? 'WITHIN_7_DAYS' : days <= 14 ? 'WITHIN_14_DAYS' : 'LATER',
  };
}

export function supplierLineIndicator(input: {
  orderedQuantity: Prisma.Decimal;
  receivedQuantity: Prisma.Decimal;
  receivedAtSite: Prisma.Decimal;
  expectedDelivery: string | null;
  requiredOnSite: string | null;
  previousApprovedExpectedDelivery: string | null | undefined;
  asOfThailandDate: string;
  cancelled: boolean;
}) {
  const { orderedQuantity: ordered, receivedQuantity: received,
    receivedAtSite: atSite } = input;
  if (ordered.lessThan(0) || received.lessThan(0) || atSite.lessThan(0) ||
      received.greaterThan(ordered) || atSite.greaterThan(received))
    throw new RangeError('SS14_SUPPLIER_QUANTITY_SOURCE_INVALID');
  const pending = ordered.minus(received);
  const due = supplierDateWindow(input.expectedDelivery, input.asOfThailandDate);
  const needed = supplierDateWindow(input.requiredOnSite, input.asOfThailandDate);
  const dateRevised = input.previousApprovedExpectedDelivery != null &&
    input.expectedDelivery != null &&
    input.previousApprovedExpectedDelivery !== input.expectedDelivery;
  const dateRemoved = input.previousApprovedExpectedDelivery != null &&
    input.expectedDelivery === null;
  return {
    orderedQuantity: ordered.toFixed(4),
    receivedQuantity: received.toFixed(4),
    receivedAtSelectedSite: atSite.toFixed(4),
    pendingQuantity: input.cancelled ? '0.0000' : pending.toFixed(4),
    deliveryState: input.cancelled ? 'CANCELLED' as const :
      pending.isZero() ? 'FULFILLED' as const : due.window,
    expectedDeliveryWindow: due.window,
    daysUntilExpectedDelivery: due.daysUntil,
    requiredOnSiteWindow: needed.window,
    daysUntilRequiredOnSite: needed.daysUntil,
    dateRevisedFromPreviousApproved: dateRevised,
    dateRemovedFromPreviousApproved: dateRemoved,
    previousApprovedExpectedDelivery: dateRevised || dateRemoved
      ? input.previousApprovedExpectedDelivery ?? null : null,
    supplierAcknowledgment: 'NOT_VERIFIED' as const,
    targetSite: 'NOT_RECORDED_ON_PO' as const,
    quantityBasis: 'PO_LINE_ENTERED_UOM_NO_STOCK_CONVERSION' as const,
  };
}
