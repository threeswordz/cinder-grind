import { Prisma } from '@prisma/client';

import { budgetInvalid } from './budget-validation';

// Isolated precision: never change Prisma.Decimal's process-wide configuration.
// Approved amount(20,4) * share(7,4) / 100 needs ten fractional places.
const Decimal = Prisma.Decimal.clone({ precision: 80 });
const HALF_UP = Decimal.ROUND_HALF_UP;

export type CustomerBoqCostSource = {
  companyId: string;
  projectId: string;
  revisionId: string;
  currencyCode: string | null;
  approvalState: string;
  lines: readonly {
    id: string;
    quantity: string;
    uomId: string;
    rate: string;
    amount: string;
  }[];
};

export type CustomerBoqPricingLine = {
  lineId: string;
  quantity: string;
  uomId: string;
  uomDecimalPlaces: number;
  method: 'MANUAL' | 'MARKUP';
  manualRate?: string;
  markupPercent?: string;
  mappingReason?: string;
  zeroPriceReason?: string;
  pricingReason?: string;
  // For repricing, the caller must load this from the retained Draft, not HTTP.
  previousRate?: string;
  mappings: readonly { sourceLineId: string; sharePercent: string }[];
};

function text(value: unknown, field: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw budgetInvalid(field, 'A nonempty value is required.');
  }
  return value.trim();
}

function reason(value: unknown, field: string) {
  return value === undefined ? null : text(value, field);
}

function decimal(
  value: unknown,
  field: string,
  scale: number,
  integerPlaces: number,
  positive = false,
) {
  // Monetary inputs must arrive as exact decimal strings, never JS floats.
  if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value)) {
    throw budgetInvalid(field, 'Use a nonnegative plain decimal string.');
  }
  if ((value.split('.')[1]?.length ?? 0) > scale) {
    throw budgetInvalid(field, `Use at most ${scale} decimal places.`);
  }
  if (value.split('.')[0]!.replace(/^0+/, '').length > integerPlaces) {
    throw budgetInvalid(field, 'The decimal is outside the supported range.');
  }
  const parsed = new Decimal(value);
  if (!parsed.isFinite() || parsed.gte(new Decimal(10).pow(integerPlaces))) {
    throw budgetInvalid(field, 'The decimal is outside the supported range.');
  }
  if (positive && parsed.isZero()) {
    throw budgetInvalid(field, 'Must be greater than zero.');
  }
  return parsed;
}

function boundedResult(value: Prisma.Decimal, field: string, integerPlaces: number) {
  if (!value.isFinite() || value.gte(new Decimal(10).pow(integerPlaces))) {
    throw budgetInvalid(field, 'The calculated value exceeds the supported range.');
  }
}

/**
 * Pure C1-C5 calculation, not an authorization boundary or a persistence API.
 * The service caller must resolve Company/Project access, the approved source,
 * customer UOMs and previous Draft prices from the database in its transaction,
 * and enforce the current Company/Project THB-only new-money policy.
 * All returned cost/pricing fields are confidential internal calculation data;
 * never send this result through a Quantity Only/general Finance response.
 */
export function priceCustomerBoq(
  scope: { companyId: string; projectId: string },
  source: CustomerBoqCostSource | null,
  inputs: readonly CustomerBoqPricingLine[],
) {
  const companyId = text(scope.companyId, 'scope.companyId');
  const projectId = text(scope.projectId, 'scope.projectId');
  if (!source || source.approvalState !== 'APPROVED' || source.currencyCode !== 'THB') {
    throw budgetInvalid('source', 'Select an approved cost revision with verified THB provenance.');
  }
  if (source.companyId !== companyId || source.projectId !== projectId) {
    throw budgetInvalid('source', 'The cost revision must belong to the selected Company and Project.');
  }
  const revisionId = text(source.revisionId, 'source.revisionId');
  if (inputs.length === 0) {
    throw budgetInvalid('lines', 'At least one priced Customer BOQ line is required.');
  }

  const sources = new Map<string, {
    id: string; quantity: string; uomId: string; rate: string; amount: string;
  }>();
  source.lines.forEach((line, index) => {
    const field = `source.lines[${index}]`;
    const id = text(line.id, `${field}.id`);
    if (sources.has(id)) throw budgetInvalid(`${field}.id`, 'Duplicate source line identity.');
    sources.set(id, {
      id,
      quantity: decimal(line.quantity, `${field}.quantity`, 4, 14).toFixed(4),
      uomId: text(line.uomId, `${field}.uomId`),
      rate: decimal(line.rate, `${field}.rate`, 4, 14).toFixed(4),
      // Use the stored approved amount; do not recalculate or overwrite it.
      amount: decimal(line.amount, `${field}.amount`, 4, 16).toFixed(4),
    });
  });

  const identities = new Set<string>();
  const coverage = new Map<string, Prisma.Decimal>();
  const lines = inputs.map((input, index) => {
    const field = `lines[${index}]`;
    const lineId = text(input.lineId, `${field}.lineId`);
    if (identities.has(lineId)) throw budgetInvalid(`${field}.lineId`, 'Duplicate Customer line identity.');
    identities.add(lineId);
    const uomId = text(input.uomId, `${field}.uomId`);
    if (!Number.isSafeInteger(input.uomDecimalPlaces) || input.uomDecimalPlaces < 0) {
      throw budgetInvalid(`${field}.uomDecimalPlaces`, 'Use the selected UOM precision.');
    }
    const quantity = decimal(input.quantity, `${field}.quantity`, Math.min(4, input.uomDecimalPlaces), 14, true);
    const mappingReason = reason(input.mappingReason, `${field}.mappingReason`);
    const pricingReason = reason(input.pricingReason, `${field}.pricingReason`);
    const zeroPriceReason = reason(input.zeroPriceReason, `${field}.zeroPriceReason`);
    if (input.mappings.length === 0) {
      throw budgetInvalid(`${field}.mappings`, 'Link every Customer line to the selected approved cost revision.');
    }
    let costBasis = new Decimal(0);
    let needsMappingReason = input.mappings.length > 1;
    const mapped = new Set<string>();
    const mappings = input.mappings.map((mapping, mappingIndex) => {
      const prefix = `${field}.mappings[${mappingIndex}]`;
      const id = text(mapping.sourceLineId, `${prefix}.sourceLineId`);
      const snapshot = sources.get(id);
      if (!snapshot || mapped.has(id)) {
        throw budgetInvalid(`${prefix}.sourceLineId`, 'Use distinct lines from the selected approved cost revision.');
      }
      mapped.add(id);
      const share = decimal(mapping.sharePercent, `${prefix}.sharePercent`, 4, 3, true);
      const used = new Decimal(coverage.get(id) ?? 0).plus(share);
      if (share.gt(100) || used.gt(100)) {
        throw budgetInvalid(`${prefix}.sharePercent`, 'Source coverage in one Customer version must not exceed 100%.');
      }
      coverage.set(id, used);
      needsMappingReason ||= snapshot.uomId !== uomId ||
        !quantity.eq(snapshot.quantity) || share.lt(100);
      const allocatedCost = new Decimal(snapshot.amount).mul(share).div(100);
      costBasis = costBasis.plus(allocatedCost);
      return {
        sourceLineId: id,
        sharePercent: share.toFixed(4),
        allocatedCost: allocatedCost.toFixed(10),
        sourceSnapshot: { ...snapshot },
      };
    });
    if (needsMappingReason && !mappingReason) {
      throw budgetInvalid(`${field}.mappingReason`, 'Explain independent quantities/UOM, split or roll-up source mapping.');
    }

    let rate: Prisma.Decimal;
    let markupPercent: string | null = null;
    let targetAmount: Prisma.Decimal | null = null;
    const previousRate = input.previousRate === undefined ? null :
      decimal(input.previousRate, `${field}.previousRate`, 4, 14);
    if (input.method === 'MANUAL') {
      if (input.markupPercent !== undefined) {
        throw budgetInvalid(`${field}.markupPercent`, 'Manual pricing cannot also apply markup.');
      }
      rate = decimal(input.manualRate, `${field}.manualRate`, 4, 14);
      if (previousRate && !rate.eq(previousRate) && !pricingReason) {
        throw budgetInvalid(`${field}.pricingReason`, 'Explain the changed manual or negotiated price.');
      }
    } else if (input.method === 'MARKUP') {
      if (input.manualRate !== undefined) {
        throw budgetInvalid(`${field}.manualRate`, 'Markup pricing cannot also override the rate.');
      }
      const markup = decimal(input.markupPercent, `${field}.markupPercent`, 4, 14);
      markupPercent = markup.toFixed(4);
      const target = costBasis.mul(new Decimal(1).plus(markup.div(100)));
      rate = target.div(quantity).toDecimalPlaces(4, HALF_UP);
      targetAmount = target.toDecimalPlaces(2, HALF_UP);
    } else {
      throw budgetInvalid(`${field}.method`, 'Choose MANUAL or MARKUP; no gross-margin or conversion method is supported.');
    }
    boundedResult(rate, `${field}.rate`, 14);
    if (rate.isZero() && !zeroPriceReason) {
      throw budgetInvalid(`${field}.zeroPriceReason`, 'Explain the included or free line; a blank price is never zero.');
    }
    const amount = quantity.mul(rate).toDecimalPlaces(2, HALF_UP);
    boundedResult(amount, `${field}.amount`, 18);
    return {
      lineId,
      quantity: quantity.toFixed(4),
      uomId,
      method: input.method,
      mappingReason,
      pricingReason,
      zeroPriceReason,
      previousRate: previousRate?.toFixed(4) ?? null,
      markupPercent,
      costBasis: costBasis.toFixed(10),
      rate: rate.toFixed(4),
      amount: amount.toFixed(2),
      targetAmount: targetAmount?.toFixed(2) ?? null,
      // Explicit diagnostic for E5; never silently adjust a line to its target.
      rateRoundingDifference: targetAmount ? amount.minus(targetAmount).toFixed(2) : null,
      mappings,
    };
  });
  const total = lines.reduce((sum, line) => sum.plus(line.amount), new Decimal(0));
  boundedResult(total, 'totalAmount', 18);
  return {
    companyId,
    projectId,
    sourceRevisionId: revisionId,
    currencyCode: 'THB' as const,
    lines,
    totalAmount: total.toFixed(2),
    // Include unused source coverage for the authorized cost reviewer.
    sourceCoverage: [...sources.keys()].map((id) => ({
      sourceLineId: id,
      allocatedPercent: new Decimal(coverage.get(id) ?? 0).toFixed(4),
      unallocatedPercent: new Decimal(100).minus(coverage.get(id) ?? 0).toFixed(4),
    })),
  };
}
