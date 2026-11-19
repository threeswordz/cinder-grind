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
};

const conflict = (code: string): never => {
  throw new ConflictException({ code });
};

export async function resolveStockEffectPin(
  tx: Prisma.TransactionClient,
  input: StockEffectSource,
) {
  const businessDate = uomDate(input.businessDate);
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
