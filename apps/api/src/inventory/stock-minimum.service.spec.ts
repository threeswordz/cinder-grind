import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProjectAccessService } from '../projects/project-access.service';
import type { InventoryQuantityService } from './inventory-quantity.service';
import type { StockCountService } from './stock-count.service';
import { StockMinimumService } from './stock-minimum.service';
import { STOCK_MINIMUM_ACTION } from './stock-minimum-contract';

const companyId = randomUUID(), projectId = randomUUID(), warehouseId = randomUUID();
const materialId = randomUUID(), uomId = randomUUID(), userId = randomUUID(), sessionId = randomUUID();
const eventId = randomUUID();
const auth = (role: string): AuthenticatedUserContext => ({
  companyId, userId, sessionId,
  roleCodes: [role], permissions: ['inventory.stock.view'],
} as AuthenticatedUserContext);
const validInput = {
  materialId, uomId, minimumQuantity: '6', status: 'ACTIVE', reason: 'Khaimook threshold',
};

function service(options: {
  role?: string; inactive?: boolean; allowedProject?: boolean;
  activeUomId?: string;
} = {}) {
  const role = options.role ?? 'STOREKEEPER';
  const queries: string[] = [];
  let auditWrites = 0, stockWrites = 0;
  const db = {
    userSession: { findFirst: async () => options.inactive ? null : ({
      user: {
        employee: { companyId, isActive: true },
        userRoles: [{ role: {
          companyId, isActive: true, roleCode: role,
          rolePermissions: [{ permission: { permissionCode: 'inventory.stock.view' } }],
        } }],
      },
    }) },
    warehouse: { findFirst: async (input: { where: { projectId: string; companyId: string } }) => {
      queries.push('warehouse');
      return input.where.projectId === projectId && input.where.companyId === companyId
        ? { id: warehouseId, warehouseCode: 'SITE_A', warehouseName: 'Site A' } : null;
    } },
    auditLog: { findMany: async () => [{ id: eventId, entityId: warehouseId,
      actorUserId: userId, occurredAt: new Date('2026-11-24T00:00:00Z'),
      action: STOCK_MINIMUM_ACTION,
      newValues: { projectId, warehouseId, ...validInput, version: 1, previousEventId: null } }] },
    material: { findFirst: async () => ({
      materialCode: 'MAT01', materialName: 'Test material', defaultUomId: uomId,
    }) },
    unitOfMeasure: { findFirst: async () => ({ uomCode: 'EA', isActive: true }) },
    $queryRaw: async () => options.activeUomId
      ? [{ stockUomId: options.activeUomId, stockPrecision: 4 }] : [],
    stockTransaction: { create: async () => { stockWrites++; } },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(db),
  };
  const access = { assertAccess: async (_actor: unknown, requested: string) => {
    queries.push('assertAccess');
    if (options.allowedProject === false || requested !== projectId)
      throw new ForbiddenException({ code: 'PROJECT_DENIED' });
  } };
  const quantities = { available: async (_db: unknown, dimension: { companyId: string; projectId: string; warehouseId: string }) => {
    queries.push('available');
    assert.deepEqual({ companyId: dimension.companyId, projectId: dimension.projectId,
      warehouseId: dimension.warehouseId }, { companyId, projectId, warehouseId });
    return { onHand: new Prisma.Decimal(9), reserved: new Prisma.Decimal(4),
      available: new Prisma.Decimal(5) };
  } };
  const audit = { record: async () => { auditWrites++; } };
  const handler = new StockMinimumService(
    db as unknown as PrismaService, access as unknown as ProjectAccessService,
    audit as unknown as AuditService, quantities as unknown as InventoryQuantityService,
    {} as StockCountService);
  return { handler, queries, get auditWrites() { return auditWrites; },
    get stockWrites() { return stockWrites; } };
}

test('SS14/PM15 scoped Store read reflects actual reserved stock, never creates stock', async () => {
  const f = service();
  const report = await f.handler.read(auth('STOREKEEPER'), projectId, warehouseId);
  assert.equal(report.advisoryOnly, true);
  assert.equal(report.approvedPlanDemandAlertsIncluded, false);
  assert.equal(report.externalNotificationsSent, false);
  assert.equal(report.alerts.length, 1);
  assert.equal(report.alerts[0]?.onHand, '9.0000');
  assert.equal(report.alerts[0]?.reserved, '4.0000');
  assert.equal(report.alerts[0]?.available, '5.0000');
  assert.equal(report.alerts[0]?.shortage, '1.0000');
  assert.equal(report.alerts[0]?.belowMinimum, true);
  assert.deepEqual([f.auditWrites, f.stockWrites], [0, 0]);
  assert.ok(f.queries.includes('assertAccess'));
});

test('SS14 denies Storekeeper threshold configuration and a revoked user session', async () => {
  const f = service();
  await assert.rejects(
    f.handler.set({ auth: auth('STOREKEEPER') }, projectId, warehouseId, validInput, null),
    ForbiddenException,
  );
  assert.equal(f.auditWrites, 0);
  const revoked = service({ role: 'PROJECT_MANAGER', inactive: true });
  await assert.rejects(revoked.handler.read(auth('PROJECT_MANAGER'), projectId, warehouseId),
    ForbiddenException);
  assert.equal(revoked.auditWrites, 0);
});

test('PM15 cannot read another Project through a guessed site URL', async () => {
  const f = service({ role: 'PROJECT_MANAGER', allowedProject: false });
  await assert.rejects(f.handler.read(auth('PROJECT_MANAGER'), projectId, warehouseId),
    ForbiddenException);
  assert.ok(!f.queries.includes('available'), 'No stock quantity is read after scope denial');
});

test('SS14 warns on changed canonical stock UOM rather than reporting false shortage', async () => {
  const f = service({ activeUomId: randomUUID() });
  const result = await f.handler.read(auth('STOREKEEPER'), projectId, warehouseId);
  assert.equal(result.alerts[0]?.configurationStale, true);
  assert.equal(result.alerts[0]?.belowMinimum, false);
  assert.equal(result.alerts[0]?.shortage, '0.0000');
  assert.equal(f.stockWrites, 0);
});
