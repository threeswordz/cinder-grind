import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type ComparableOffer = {
  rfqLineId: string;
  supplierId: string;
  quantity: Prisma.Decimal;
};

// PUR01: net after discount + freight/additional charges, ex VAT.
export function poQuoteBasis(
  subtotal: Prisma.Decimal,
  discount: Prisma.Decimal | null,
  freight: Prisma.Decimal | null,
  charges: Prisma.Decimal | null,
  vatPercent: Prisma.Decimal | null,
) {
  if ([discount, freight, charges, vatPercent].some((n) => n === null)) {
    throw new UnprocessableEntityException({ code: 'PO_QUOTE_COMMERCIAL_BASIS_UNKNOWN' });
  }
  if (discount!.gt(subtotal)) {
    throw new UnprocessableEntityException({ code: 'PO_DISCOUNT_EXCEEDS_SUBTOTAL' });
  }
  const netExVat = subtotal.minus(discount!).plus(freight!).plus(charges!);
  if (netExVat.lte(0)) {
    throw new UnprocessableEntityException({ code: 'PO_NET_EX_VAT_INVALID' });
  }
  return {
    netExVat,
    requiredSuppliers: netExVat.lte(10_000) ? 1 : netExVat.lte(50_000) ? 2 : 3,
  };
}

// The same supplier must have an actual THB offer covering each PO RFQ
// line. Counting the union of partial bids from unrelated suppliers would
// improperly pass the Owner's PO-level comparison threshold.
export function completeSupplierCount(
  orderLines: Array<{rfqLineId: string; quantity: Prisma.Decimal}>,
  offers: ComparableOffer[],
): number {
  const sources = new Map<string, Map<string, Prisma.Decimal>>();
  for (const q of offers) {
    const byRfq = sources.get(q.supplierId) ?? new Map<string, Prisma.Decimal>();
    const old = byRfq.get(q.rfqLineId);
    if (!old || q.quantity.gt(old)) byRfq.set(q.rfqLineId, q.quantity);
    sources.set(q.supplierId, byRfq);
  }
  return [...sources.values()].filter((byRfq) => orderLines.every(
    (row) => byRfq.get(row.rfqLineId)?.gte(row.quantity) ?? false,
  )).length;
}
