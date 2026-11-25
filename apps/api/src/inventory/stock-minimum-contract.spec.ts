import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  replayStockMinimums, stockMinimumInput, STOCK_MINIMUM_ACTION,
} from './stock-minimum-contract';

const projectId = randomUUID(), warehouseId = randomUUID(), materialId = randomUUID(), uomId = randomUUID();
const actorUserId = randomUUID();
const minimum = { materialId, uomId, minimumQuantity: '15.2500' as string,
  status: 'ACTIVE' as 'ACTIVE' | 'PAUSED', reason: 'Project Manager site reorder point' };
const event = (id: string, version: number, previousEventId: string | null,
  values: Record<string, unknown> = {}) => ({
  id, entityId: warehouseId, actorUserId, action: STOCK_MINIMUM_ACTION,
  occurredAt: new Date('2026-11-24T00:00:00Z'),
  newValues: { projectId, warehouseId, ...minimum, ...values, version, previousEventId },
});

test('SS14/PM15 minimum policy accepts exact stock UOM quantity, pause and reason; rejects unsafe input', () => {
  assert.deepEqual(stockMinimumInput(minimum), minimum);
  assert.equal(stockMinimumInput({ ...minimum, minimumQuantity: '0' }).minimumQuantity, '0');
  assert.equal(stockMinimumInput({ ...minimum, status: 'PAUSED' }).status, 'PAUSED');
  for (const invalid of [
    { ...minimum, minimumQuantity: '-1' },
    { ...minimum, minimumQuantity: '1e6' },
    { ...minimum, minimumQuantity: '2.00001' },
    { ...minimum, minimumQuantity: '1.5', surprise: 'unowned' },
    { ...minimum, minimumQuantity: 4 },
    { ...minimum, materialId: 'another-company' },
    { ...minimum, reason: '  ' },
  ]) assert.throws(() => stockMinimumInput(invalid), RangeError);
});

test('SS14 audit source replays immutable thresholds and detects forks, lost events and changed scope', () => {
  const first = randomUUID(), second = randomUUID();
  const values = replayStockMinimums([
    event(second, 2, first, { minimumQuantity: '20', status: 'PAUSED' }),
    event(first, 1, null),
  ], projectId, warehouseId);
  assert.equal(values.length, 1);
  assert.equal(values[0]?.minimumQuantity, '20');
  assert.equal(values[0]?.status, 'PAUSED');
  assert.equal(values[0]?.version, 2);
  assert.equal(values[0]?.lastEventId, second);
  assert.throws(() => replayStockMinimums([
    event(first, 1, null), event(randomUUID(), 1, null),
  ], projectId, warehouseId), /FORK/);
  assert.throws(() => replayStockMinimums([
    event(second, 2, first),
  ], projectId, warehouseId), /VERSION_GAP/);
  assert.throws(() => replayStockMinimums([
    event(first, 1, null), event(second, 2, randomUUID()),
  ], projectId, warehouseId), /CHAIN_BROKEN/);
  assert.throws(() => replayStockMinimums([
    event(first, 1, null, { projectId: randomUUID() }),
  ], projectId, warehouseId), /SCOPE_INVALID/);
  assert.throws(() => replayStockMinimums([
    { ...event(first, 1, null), entityId: randomUUID() },
  ], projectId, warehouseId), /SCOPE_INVALID/);
});

test('SS14 different materials have independent threshold histories without quantity mutations', () => {
  const secondMaterial = randomUUID();
  const result = replayStockMinimums([
    event(randomUUID(), 1, null, { materialId: secondMaterial, minimumQuantity: '1' }),
    event(randomUUID(), 1, null, { minimumQuantity: '5' }),
  ], projectId, warehouseId);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.minimumQuantity).sort(), ['1', '5']);
  assert.ok(result.every(r => !('stockTransactionId' in r) && !('financeAmount' in r)));
});
