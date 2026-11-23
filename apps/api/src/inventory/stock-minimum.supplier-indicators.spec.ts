import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import type { PrismaService } from '../prisma/prisma.service';
import type { ProjectAccessService } from '../projects/project-access.service';
import type { AuditService } from '../audit/audit.service';
import type { InventoryQuantityService } from './inventory-quantity.service';
import type { StockCountService } from './stock-count.service';
import { StockMinimumService } from './stock-minimum.service';

const companyId = randomUUID(), projectId = randomUUID(), warehouseId = randomUUID();
const otherSiteId = randomUUID(), supplierId = randomUUID(), userId = randomUUID();
const sessionId = randomUUID(), materialId = randomUUID(), uomId = randomUUID();
const awardId = randomUUID(), poId = randomUUID(), oldPoId = randomUUID();
const poLineId = randomUUID(), oldPoLineId = randomUUID();
const auth: AuthenticatedUserContext = {
  companyId, userId, sessionId, roleCodes: ['STOREKEEPER'],
  permissions: ['inventory.stock.view'],
} as AuthenticatedUserContext;
const date = (value: string) => new Date(value + 'T00:00:00.000Z');
const line = (id: string, expected: string | null) => ({
  id, lineNo: 1, quotationAwardId: awardId, materialId,
  materialCodeSnapshot: 'MAT-01', description: 'Steel',
  quantity: new Prisma.Decimal(10), uomId, uomCodeSnapshot: 'EA',
  requiredOnSite: date('2026-12-02'),
  expectedDelivery: expected ? date(expected) : null,
  material: { companyId, isActive: true, materialCode: 'MAT-01', materialName: 'Steel' },
  uom: { companyId, isActive: true, uomCode: 'EA' },
});

function fixture(options: {
  revoked?: boolean; inactiveEmployee?: boolean; foreignProject?: boolean; foreignSupplier?: boolean;
  cancellation?: boolean; previousApproval?: boolean; draftAhead?: boolean;
  noDeliveryDate?: boolean; badReceiptUom?: boolean; foreignReceipt?: boolean; overReceipt?: boolean;
  tooManyOrders?: boolean;
} = {}) {
  let poReads = 0, grReads = 0, writes = 0;
  const latest = {
    id: poId, poNumber: 'PO-01', revisionNo: 1,
    cancelledAt: options.cancellation ? new Date('2026-11-24T00:00:00Z') : null,
    approvalInstance: { approvalState: 'APPROVED' },
    supplier: { companyId: options.foreignSupplier ? randomUUID() : companyId,
      supplierCode: 'SUP-01', supplierName: 'Approved supplier', isActive: true },
    lines: [line(poLineId, options.noDeliveryDate ? null : '2026-12-01')],
  };
  const prior = {
    ...latest, id: oldPoId, revisionNo: 0, cancelledAt: null,
    lines: [line(oldPoLineId, '2026-11-28')],
  };
  const draft = { ...latest, id: randomUUID(), revisionNo: 2,
    approvalInstance: null, lines: [line(randomUUID(), '2027-01-01')] };
  const posted = (qty: string, siteId: string) => ({
    quotationAwardId: awardId, materialId,
    uomId: options.badReceiptUom ? randomUUID() : uomId,
    quantity: new Prisma.Decimal(qty),
    goodsReceipt: {
      companyId: options.foreignReceipt ? randomUUID() : companyId, projectId, warehouseId: siteId,
      purchaseOrder: { companyId, projectId, poNumber: 'PO-01' },
    },
    purchaseOrderLine: {
      quotationAwardId: awardId, materialId, uomId,
      purchaseOrder: { companyId, projectId, poNumber: 'PO-01' },
    },
  });
  const tx = {
    userSession: { findFirst: async () => options.revoked ? null : {
      user: {
        employee: { companyId, isActive: !options.inactiveEmployee },
        userRoles: [{ role: { companyId, isActive: true, roleCode: 'STOREKEEPER',
          rolePermissions: [{ permission: { permissionCode: 'inventory.stock.view' } }] } }],
      },
    } },
    warehouse: { findFirst: async ({ where }: { where: { companyId: string;
      projectId: string; id: string } }) => {
      assert.deepEqual([where.companyId, where.projectId, where.id],
        [companyId, projectId, warehouseId]);
      return { id: warehouseId, warehouseCode: 'SITE_A', warehouseName: 'Site A' };
    } },
    purchaseOrder: {
      findMany: async ({ where, take, orderBy }: {
        where: { companyId: string; projectId: string };
        take: number; orderBy: Array<Record<string, string>>;
      }) => {
        poReads++;
        assert.deepEqual(where, { companyId, projectId });
        assert.equal(take, 201);
        assert.deepEqual(orderBy, [{ poNumber: 'asc' }, { revisionNo: 'desc' }]);
        return options.tooManyOrders
          ? Array.from({ length: 201 }, (_, i) => ({ ...latest, poNumber: 'PO-' + i }))
          : [...(options.draftAhead ? [draft] : []), latest,
            ...(options.previousApproval ? [prior] : [])];
      },
    },
    goodsReceiptItem: {
      findMany: async ({ where, take }: { where: {
        goodsReceipt: { companyId: string; projectId: string;
          postedAt: { not: null }; reversedAt: null;
          purchaseOrder: { companyId: string; projectId: string; poNumber: { in: string[] } };
        };
      }; take: number }) => {
        grReads++;
        assert.deepEqual(where.goodsReceipt.purchaseOrder,
          { companyId, projectId, poNumber: { in: ['PO-01'] } });
        assert.deepEqual([where.goodsReceipt.companyId, where.goodsReceipt.projectId,
          where.goodsReceipt.reversedAt, take], [companyId, projectId, null, 5001]);
        return options.cancellation ? [] : options.overReceipt ? [posted('11', warehouseId)] :
          [posted('2.25', warehouseId), posted('2', otherSiteId)];
      },
    },
    stockTransaction: { create: async () => { writes++; } },
    purchaseOrderCreate: { create: async () => { writes++; } },
    payment: { create: async () => { writes++; } },
  };
  const access = { assertAccess: async (_actor: unknown, requested: string) => {
    if (options.foreignProject || requested !== projectId)
      throw new ForbiddenException({ code: 'PROJECT_DENIED' });
  } };
  const db = { ...tx, $transaction: async <T>(
    cb: (client: typeof tx) => Promise<T>,
    options: { isolationLevel: string },
  ) => {
    assert.equal(options.isolationLevel, Prisma.TransactionIsolationLevel.RepeatableRead);
    return cb(tx);
  } };
  const service = new StockMinimumService(
    db as unknown as PrismaService, access as unknown as ProjectAccessService,
    {} as AuditService, {} as InventoryQuantityService, {} as StockCountService);
  return { service, get poReads() { return poReads; },
    get grReads() { return grReads; }, get writes() { return writes; } };
}

const at = new Date('2026-11-23T18:00:00.000Z');

test('SS14 authenticated scoped project PO date and partial GR are advisory only', async () => {
  const f = fixture({ previousApproval: true });
  const result = await f.service.supplierCommitments(auth, projectId, warehouseId, at);
  assert.equal(result.asOfThailandDate, '2026-11-24');
  assert.deepEqual([result.alerts.length, result.alerts[0]?.revisionNo,
    result.alerts[0]?.receivedQuantity, result.alerts[0]?.receivedAtSelectedSite,
    result.alerts[0]?.pendingQuantity, result.alerts[0]?.deliveryState],
    [1, 1, '4.2500', '2.2500', '5.7500', 'WITHIN_7_DAYS']);
  assert.equal(result.alerts[0]?.previousApprovedExpectedDelivery, '2026-11-28');
  assert.equal(result.alerts[0]?.dateRevisedFromPreviousApproved, true);
  assert.equal(result.projectWidePoDates, true);
  assert.equal(result.poLineSiteAssignmentIncluded, false);
  assert.equal(result.supplierAcknowledgmentsVerified, false);
  assert.deepEqual([f.poReads, f.grReads, f.writes], [1, 1, 0]);
});

test('SS14 real actor revocation and foreign Project fail before any PO read', async () => {
  for (const options of [{ revoked: true }, { inactiveEmployee: true }, { foreignProject: true }]) {
    const f = fixture(options);
    await assert.rejects(f.service.supplierCommitments(auth, projectId, warehouseId, at),
      ForbiddenException);
    assert.deepEqual([f.poReads, f.grReads, f.writes], [0, 0, 0]);
  }
});

test('SS14 rejects foreign Company supplier and inconsistent GR UOM instead of leaking', async () => {
  for (const options of [{ foreignSupplier: true }, { foreignReceipt: true },
    { badReceiptUom: true }]) {
    const f = fixture(options);
    await assert.rejects(f.service.supplierCommitments(auth, projectId, warehouseId, at),
      ConflictException);
    assert.equal(f.writes, 0);
  }
});

test('SS14 does not substitute a newer unapproved draft for current approved date', async () => {
  const f = fixture({ draftAhead: true });
  const result = await f.service.supplierCommitments(auth, projectId, warehouseId, at);
  assert.equal(result.alerts.length, 1);
  assert.equal(result.alerts[0]?.revisionNo, 1);
  assert.equal(result.alerts[0]?.expectedDelivery, '2026-12-01');
});

test('SS14 cancellation suppresses pending and unknown PO date is never fabricated', async () => {
  const cancelled = await fixture({ cancellation: true }).service
    .supplierCommitments(auth, projectId, warehouseId, at);
  assert.equal(cancelled.alerts[0]?.deliveryState, 'CANCELLED');
  assert.equal(cancelled.alerts[0]?.pendingQuantity, '0.0000');
  const unknown = await fixture({ noDeliveryDate: true }).service
    .supplierCommitments(auth, projectId, warehouseId, at);
  assert.equal(unknown.alerts[0]?.deliveryState, 'DATE_UNKNOWN');
  assert.equal(unknown.alerts[0]?.expectedDelivery, null);
  assert.equal(unknown.alerts[0]?.requiredOnSite, '2026-12-02');
});

test('SS14 pagination and invalid over-receipt fail closed, never silently truncate', async () => {
  await assert.rejects(
    fixture({ tooManyOrders: true }).service.supplierCommitments(
      auth, projectId, warehouseId, at),
    (e: unknown) => e instanceof ConflictException &&
      (e.getResponse() as {code?: string}).code === 'SS14_SUPPLIER_PO_PAGE_LIMIT',
  );
  await assert.rejects(
    fixture({ overReceipt: true }).service.supplierCommitments(
      auth, projectId, warehouseId, at),
    (e: unknown) => e instanceof ConflictException &&
      (e.getResponse() as {code?: string}).code === 'SS14_SUPPLIER_DATE_OR_QUANTITY_SOURCE_INVALID',
  );
});
