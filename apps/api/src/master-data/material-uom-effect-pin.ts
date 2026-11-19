import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { exactUomQuantity, uomDate } from './material-uom-contract';

// DEC-050 B: the source owner must already have checked its own session,
// Company/Project and approval rights. This internal function does not grant
// permission or activate any stock source. It must run in the SAME serializable
// posting transaction as the eventual canonical StockTransaction/pin write.
export type StockEffectSource = {
  companyId: string;
  materialId: string;
  sourceUomId: string;
  quantity: Prisma.Decimal;
  businessDate: string;
  effectSign: 1 | -1;
};

const conflict = (code: string): never => {
  throw new ConflictException({ code });
};

// Mandatory first half of a future explicit activation transaction. This
// read-only check does NOT activate a material, grant rights, or authorize
// operational posting. Source owners must also lock and reconcile outstanding
// GR/issue/return/count/transfer documents before activation. No historical
// ledger effect is rewritten or treated as a convertible balance.
export async function assertCanonicalStockHistoryCompatible(
  tx: Prisma.TransactionClient,
  companyId: string,
  materialId: string,
) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${[
    'material-uom', companyId, materialId,
  ].join(':')},0))`;
  const [material, basis] = await Promise.all([
    tx.material.findFirst({ where: { id: materialId, companyId, isActive: true }, select: { id: true } }),
    tx.materialUomBasis.findUnique({ where: { materialId } }),
  ]);
  if (!material || !basis || basis.companyId !== companyId) {
    return conflict('MATERIAL_UOM_SOURCE_INVALID');
  }
  const stockUnit = await tx.unitOfMeasure.findFirst({
    where: { id: basis.stockUomId, companyId, isActive: true },
    select: { decimalPlaces: true },
  });
  if (!stockUnit || stockUnit.decimalPlaces !== basis.stockPrecision) {
    return conflict('MATERIAL_UOM_STOCK_BASIS_INVALID');
  }
  // Deliberately check historical EFFECTS, not net stock. A +N/-N pair in a
  // different unit is still incompatible historical provenance. Never let a
  // zero balance hide that history or silently convert it.
  const [historicalForeignUnit, openReservation] = await Promise.all([
    tx.stockTransaction.findFirst({
      where: { companyId, materialId, uomId: { not: basis.stockUomId } },
      select: { id: true },
    }),
    tx.materialReservation.findFirst({
      where: { companyId, materialId, status: { in: ['DRAFT', 'ACTIVE'] } },
      select: { id: true },
    }),
  ]);
  if (historicalForeignUnit) return conflict('MATERIAL_UOM_HISTORICAL_UNIT_CONFLICT');
  if (openReservation) return conflict('MATERIAL_UOM_OPEN_RESERVATION_CONFLICT');
  return { companyId, materialId, stockUomId: basis.stockUomId, basisVersion: basis.version };
}

export async function resolveStockEffectPin(
  tx: Prisma.TransactionClient,
  input: StockEffectSource,
) {
  const businessDate = uomDate(input.businessDate);
  if (input.effectSign !== 1 && input.effectSign !== -1) return conflict('MATERIAL_UOM_EFFECT_SIGN_INVALID');
  // Identical lock order to the authoritative material UOM definition writer.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${[
    'material-uom', input.companyId, input.materialId,
  ].join(':')},0))`;

  const [material, basis, sourceUnit] = await Promise.all([
    tx.material.findFirst({
      where: { id: input.materialId, companyId: input.companyId, isActive: true },
      select: { id: true },
    }),
    tx.materialUomBasis.findUnique({ where: { materialId: input.materialId } }),
    tx.unitOfMeasure.findFirst({
      where: { id: input.sourceUomId, companyId: input.companyId, isActive: true },
      select: { id: true, decimalPlaces: true },
    }),
  ]);
  if (!material || !basis || basis.companyId !== input.companyId || !sourceUnit) {
    return conflict('MATERIAL_UOM_SOURCE_INVALID');
  }
  const stockUnit = await tx.unitOfMeasure.findFirst({
    where: { id: basis.stockUomId, companyId: input.companyId, isActive: true },
    select: { decimalPlaces: true },
  });
  if (!stockUnit || stockUnit.decimalPlaces !== basis.stockPrecision) {
    return conflict('MATERIAL_UOM_STOCK_BASIS_INVALID');
  }
  const identity = input.sourceUomId === basis.stockUomId;
  const revision = identity ? null : await tx.materialUomRevision.findFirst({
    where: {
      companyId: input.companyId,
      materialId: input.materialId,
      sourceUomId: input.sourceUomId,
      effectiveFrom: { lte: new Date(businessDate + 'T00:00:00.000Z') },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { revisionNo: 'desc' }],
  });
  if (!identity && (!revision || revision.sourcePrecision !== sourceUnit.decimalPlaces)) {
    return conflict('MATERIAL_UOM_DEFINITION_REQUIRED');
  }
  const numerator = revision?.numerator ?? '1';
  const denominator = revision?.denominator ?? '1';
  const normalized = exactUomQuantity(
    input.quantity.toString(),
    sourceUnit.decimalPlaces,
    basis.stockPrecision,
    numerator,
    denominator,
  );
  return {
    companyId: input.companyId,
    materialId: input.materialId,
    sourceUomId: input.sourceUomId,
    sourceQuantity: new Prisma.Decimal(normalized.enteredQuantity),
    stockUomId: basis.stockUomId,
    stockQuantity: new Prisma.Decimal(normalized.stockQuantity),
    businessDate: new Date(businessDate + 'T00:00:00.000Z'),
    basisVersion: basis.version,
    effectSign: input.effectSign,
    revisionId: revision?.id ?? null,
    numerator,
    denominator,
  };
}

export async function recordStockEffectPin(
  tx: Prisma.TransactionClient,
  stockTransactionId: string,
  pin: Awaited<ReturnType<typeof resolveStockEffectPin>>,
) {
  // The additive SQL guard requires a matching canonical ledger movement,
  // exact ratio/effective revision, Company/material scope and immutability.
  // Duplicate pins and mismatched effects are denied by database constraints.
  return tx.materialUomEffectPin.create({
    data: { stockTransactionId, ...pin },
  });
}
