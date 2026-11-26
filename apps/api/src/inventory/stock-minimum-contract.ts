/**
 * SS14 / PM15: immutable material/site minimum threshold policy.
 * Advisory stock alerts only; never a source for receiving, transfers or posting.
 */
export const STOCK_MINIMUM_ENTITY = 'STOCK_MINIMUM';
export const STOCK_MINIMUM_ACTION = 'SET';
export type StockMinimumEvent = {
  id: string; entityId: string; actorUserId: string;
  occurredAt: Date; action: string; newValues: unknown;
};
export type StockMinimumState = {
  projectId: string; warehouseId: string; materialId: string; uomId: string;
  minimumQuantity: string; status: 'ACTIVE' | 'PAUSED'; reason: string;
  version: number; lastEventId: string; changedAt: string; changedByUserId: string;
};
const object = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const uuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function stockMinimumInput(v: unknown) {
  const x = object(v);
  if (!x || Object.keys(x).some(k => !['materialId', 'uomId', 'minimumQuantity', 'status', 'reason'].includes(k)) ||
      !uuid(x.materialId) || !uuid(x.uomId) ||
      typeof x.minimumQuantity !== 'string' ||
      !/^(?:0|[1-9][0-9]{0,13})(?:\.[0-9]{1,4})?$/.test(x.minimumQuantity) ||
      (x.status !== 'ACTIVE' && x.status !== 'PAUSED') ||
      typeof x.reason !== 'string' || x.reason.trim() !== x.reason ||
      x.reason.length < 1 || x.reason.length > 2000)
    throw new RangeError('STOCK_MINIMUM_INVALID');
  return {
    materialId: x.materialId, uomId: x.uomId,
    minimumQuantity: x.minimumQuantity as string,
    status: x.status as 'ACTIVE' | 'PAUSED',
    reason: x.reason as string,
  };
}
export function replayStockMinimums(events: readonly StockMinimumEvent[],
  projectId: string, warehouseId: string): StockMinimumState[] {
  if (!uuid(projectId) || !uuid(warehouseId)) throw new RangeError('STOCK_MINIMUM_SCOPE_INVALID');
  const groups = new Map<string, StockMinimumEvent[]>();
  const ids = new Set<string>();
  for (const event of events) {
    const x = object(event.newValues);
    if (!uuid(event.id) || !uuid(event.actorUserId) || ids.has(event.id) ||
        event.entityId !== warehouseId || event.action !== STOCK_MINIMUM_ACTION ||
        !(event.occurredAt instanceof Date) || !Number.isFinite(event.occurredAt.getTime()) ||
        !x || x.projectId !== projectId || x.warehouseId !== warehouseId ||
        !Number.isSafeInteger(x.version) || Number(x.version) < 1 ||
        !(x.previousEventId === null || uuid(x.previousEventId)))
      throw new RangeError('STOCK_MINIMUM_EVENT_OR_SCOPE_INVALID');
    ids.add(event.id);
    const policy = stockMinimumInput({
      materialId: x.materialId, uomId: x.uomId, minimumQuantity: x.minimumQuantity,
      status: x.status, reason: x.reason,
    });
    const key = policy.materialId + ':' + policy.uomId;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const states: StockMinimumState[] = [];
  for (const group of groups.values()) {
    const byVersion = new Map<number, StockMinimumEvent>();
    for (const event of group) {
      const x = object(event.newValues)!;
      const version = x.version as number;
      if (byVersion.has(version)) throw new RangeError('STOCK_MINIMUM_FORK');
      byVersion.set(version, event);
    }
    let prior: StockMinimumEvent | null = null;
    let state: StockMinimumState | null = null;
    for (let version = 1; version <= group.length; version++) {
      const event = byVersion.get(version);
      if (!event) throw new RangeError('STOCK_MINIMUM_VERSION_GAP');
      const x = object(event.newValues)!;
      if (x.previousEventId !== (prior?.id ?? null) ||
          (prior && event.occurredAt.getTime() < prior.occurredAt.getTime()))
        throw new RangeError('STOCK_MINIMUM_CHAIN_BROKEN');
      const policy = stockMinimumInput({
        materialId: x.materialId, uomId: x.uomId, minimumQuantity: x.minimumQuantity,
        status: x.status, reason: x.reason,
      });
      state = { projectId, warehouseId, ...policy, version, lastEventId: event.id,
        changedAt: event.occurredAt.toISOString(), changedByUserId: event.actorUserId };
      prior = event;
    }
    if (state) states.push(state);
  }
  return states.sort((a, b) => a.materialId.localeCompare(b.materialId) || a.uomId.localeCompare(b.uomId));
}
