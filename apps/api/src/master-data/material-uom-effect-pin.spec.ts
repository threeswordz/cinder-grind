import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { resolveStockEffectPin, recordStockEffectPin } from './material-uom-effect-pin';

const companyId = randomUUID();
const materialId = randomUUID();
const stockUomId = randomUUID();
const boxUomId = randomUUID();
const revisionId = randomUUID();
const date = new Date('2026-10-20T00:00:00.000Z');

function context(overrides: Record<string, unknown> = {}) {
  const basis = { companyId, materialId, stockUomId, stockPrecision: 0, version: 3 };
  const units = [
    { id: stockUomId, decimalPlaces: 0 },
    { id: boxUomId, decimalPlaces: 0 },
  ];
  const revision = { id: revisionId, revisionNo: 3, sourcePrecision: 0, numerator: '20', denominator: '1', effectiveFrom: date };
  const calls: string[] = [];
  const tx = {
    $executeRaw: async () => { calls.push('lock'); return 0; },
    material: { findFirst: async () => overrides.material === false ? null : { id: materialId } },
    materialUomBasis: { findUnique: async () => overrides.basis === false ? null : { ...basis, ...(overrides.basis ?? {}) } },
    unitOfMeasure: { findFirst: async ({ where }: { where: { id: string } }) =>
      overrides.inactiveUom === where.id ? null : units.find(u => u.id === where.id) ?? null },
    materialUomRevision: { findFirst: async () => overrides.revision === false ? null : { ...revision, ...(overrides.revision ?? {}) } },
    materialUomEffectPin: { create: async ({ data }: { data: unknown }) => { calls.push('pin'); return data; } },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, calls };
}
const input = (sourceUomId = boxUomId, quantity = '2', businessDate = '2026-10-20') =>
  ({ companyId, materialId, sourceUomId, quantity: new Prisma.Decimal(quantity), businessDate });

test('stock effect pin freezes exact entered/commercial and canonical stock quantities', async () => {
  const { tx, calls } = context();
  const result = await resolveStockEffectPin(tx, input());
  assert.deepEqual(calls, ['lock']);
  assert.equal(result.sourceQuantity.toString(), '2');
  assert.equal(result.stockQuantity.toString(), '40');
  assert.equal(result.stockUomId, stockUomId);
  assert.equal(result.revisionId, revisionId);
  assert.equal(result.basisVersion, 3);
  assert.equal(result.businessDate.toISOString(), '2026-10-20T00:00:00.000Z');
  const saved = await recordStockEffectPin(tx, randomUUID(), result);
  assert.equal((saved as { stockQuantity: Prisma.Decimal }).stockQuantity.toString(), '40');
  assert.deepEqual(calls, ['lock', 'pin']);
});
test('identity stock unit pins 1:1 without inferring a material conversion', async () => {
  const { tx } = context({ revision: false });
  const result = await resolveStockEffectPin(tx, input(stockUomId, '3'));
  assert.equal(result.revisionId, null);
  assert.equal(result.numerator, '1');
  assert.equal(result.denominator, '1');
  assert.equal(result.stockQuantity.toString(), '3');
});
test('missing, cross-Company, inactive and stale definitions fail closed', async () => {
  for (const overrides of [
    { material: false }, { basis: false }, { basis: { companyId: randomUUID() } },
    { revision: false }, { inactiveUom: boxUomId }, { inactiveUom: stockUomId },
    { revision: { sourcePrecision: 2 } },
  ]) {
    const { tx } = context(overrides);
    await assert.rejects(() => resolveStockEffectPin(tx, input()), /MATERIAL_UOM_/);
  }
});
test('explicit business date and exact stock precision deny residuals, overprecision and overflow', async () => {
  const { tx } = context({ revision: { numerator: '1', denominator: '3' } });
  await assert.rejects(() => resolveStockEffectPin(tx, input()), /MATERIAL_UOM_NOT_REPRESENTABLE/);
  const second = context();
  for (const bad of ['2026-02-29', '2026-10-20T01:00:00Z', '']) {
    await assert.rejects(() => resolveStockEffectPin(second.tx, input(boxUomId, '2', bad)), /MATERIAL_UOM_INPUT_INVALID/);
  }
  await assert.rejects(() => resolveStockEffectPin(second.tx, input(boxUomId, '0.0001')), /MATERIAL_UOM_SOURCE_PRECISION/);
});
