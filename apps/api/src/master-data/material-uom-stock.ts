import { Prisma } from '@prisma/client';
import { uomDate, uomFixed, uomInvalid, uomQuantity, exactUomQuantity } from './material-uom-contract';

/**
 * DEC-050 B: resolve an explicit, deterministic material-specific stock fact
 * in the same serializable transaction that owns the authorized source.
 *
 * It does not post stock, change a commercial source, assign a permission or
 * activate conversions on a retained Company. Operational source owners must
 * persist this snapshot when freezing their source and must reuse it on
 * retries/returns/reversals; never re-select a later revision for an old source.
 *
 * NULL means the material has no prepared basis and remains legacy single-UOM.
 * A prepared basis does NOT automatically activate mixed-UOM posting.
 */
export type MaterialUomStockFact = Readonly<{
  materialId: string;
  sourceUomId: string;
  sourceUomCode: string;
  stockUomId: string;
  stockUomCode: string;
  businessDate: string;
  basisVersion: number;
  revisionId: string | null;
  effectiveFrom: string | null;
  numerator: string;
  denominator: string;
  enteredQuantity: string;
  stockQuantity: string;
}>;

export async function resolveMaterialUomStock(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string; materialId: string; sourceUomId: string;
    businessDate: string; quantity: string;
  },
): Promise<MaterialUomStockFact | null> {
  // Revision maintenance uses this same lock, so source selection cannot
  // race a newly effective factor or another same-day correction.
  await tx.$executeRaw\`SELECT pg_advisory_xact_lock(hashtextextended(\${'material-uom:' + input.companyId + ':' + input.materialId},0))\`;
  const basis = await tx.materialUomBasis.findFirst({
    where: { materialId: input.materialId, companyId: input.companyId },
  });
  if (!basis) return null;

  const businessDate = uomDate(input.businessDate);
  const material = await tx.material.findFirst({
    where: { id: input.materialId, companyId: input.companyId, isActive: true },
    select: { id: true },
  });
  const currentUnits = await tx.unitOfMeasure.findMany({
    where: {
      companyId: input.companyId, isActive: true,
      id: { in: [basis.stockUomId, input.sourceUomId] },
    },
    select: { id: true, decimalPlaces: true },
  });
  const stockUnit = currentUnits.find(u => u.id === basis.stockUomId);
  const sourceUnit = currentUnits.find(u => u.id === input.sourceUomId);
  if (!material || !stockUnit || !sourceUnit ||
      stockUnit.decimalPlaces !== basis.stockPrecision)
    return uomInvalid('uomId', 'MATERIAL_UOM_REFERENCE_INVALID');

  const identity = input.sourceUomId === basis.stockUomId;
  const revision = identity ? null : await tx.materialUomRevision.findFirst({
    where: {
      companyId: input.companyId, materialId: input.materialId,
      sourceUomId: input.sourceUomId,
      revisionNo: { lte: basis.version },
      effectiveFrom: { lte: new Date(businessDate + 'T00:00:00.000Z') },
    },
    orderBy: [{ effectiveFrom: 'desc' }, { revisionNo: 'desc' }],
  });
  if (!identity && !revision)
    return uomInvalid('businessDate', 'MATERIAL_UOM_DEFINITION_REQUIRED');
  if (revision && sourceUnit.decimalPlaces !== revision.sourcePrecision)
    return uomInvalid('uomId', 'MATERIAL_UOM_REFERENCE_INVALID');

  const numerator = revision?.numerator ?? '1';
  const denominator = revision?.denominator ?? '1';
  // Canonicalize via the exact shared integer-rational contract, never
  // Decimal division or a rounded floating-point intermediate.
  const entered = uomFixed(uomQuantity(input.quantity));
  const quantities = exactUomQuantity(
    entered, revision?.sourcePrecision ?? basis.stockPrecision,
    basis.stockPrecision, numerator, denominator,
  );
  return {
    materialId: input.materialId,
    sourceUomId: input.sourceUomId,
    sourceUomCode: revision?.sourceUomCode ?? basis.stockUomCode,
    stockUomId: basis.stockUomId,
    stockUomCode: basis.stockUomCode,
    businessDate, basisVersion: basis.version,
    revisionId: revision?.id ?? null,
    effectiveFrom: revision?.effectiveFrom.toISOString().slice(0, 10) ?? null,
    numerator, denominator, ...quantities,
  };
}
