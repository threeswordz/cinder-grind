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
const userId = randomUUID(), sessionId = randomUUID(), materialId = randomUUID();
const uomId = randomUUID(), planId = randomUUID(), revisionId = randomUUID();
const auth: AuthenticatedUserContext = {
  companyId, userId, sessionId, roleCodes: ['STOREKEEPER'],
  permissions: ['inventory.stock.view'],
} as AuthenticatedUserContext;

function fixture(options: {
  revoked?: boolean; foreignProject?: boolean;
  foreignMaterial?: boolean; planCount?: number;
  latestStart?: string;
} = {}) {
  const accesses: string[] = [];
  let planReads = 0;
  let stockOrFinanceWrites = 0;
  const makePlan = (index: number) => ({
    id: index === 0 ? planId : randomUUID(),
    workPackageCode: 'WP-' + index,
    revisions: [{
      id: revisionId, revisionNo: 3,
      validFrom: new Date((options.latestStart ?? '2026-12-01') + 'T00:00:00.000Z'),
      validTo: new Date('2027-01-01T00:00:00.000Z'),
      lines: [
        { id: randomUUID(), materialId, uomId, quantity: new Prisma.Decimal('8.5'),
          material: {
            companyId: options.foreignMaterial ? randomUUID() : companyId,
            isActive: true, materialCode: 'MAT01', materialName: 'Safe material',
          },
          uom: { companyId, isActive: true, uomCode: 'EA' },
        },
      ],
    }],
  });
  const db = {
    userSession: { findFirst: async () => options.revoked ? null : {
      user: {
        employee: { companyId, isActive: true },
        userRoles: [{ role: { companyId, isActive: true, roleCode: 'STOREKEEPER',
          rolePermissions: [{ permission: { permissionCode: 'inventory.stock.view' } }] } }],
      },
    } },
    warehouse: { findFirst: async ({ where }: { where: { companyId: string; projectId: string; id: string } }) => {
      accesses.push('warehouse');
      return where.companyId === companyId && where.projectId === projectId &&
        where.id === warehouseId
        ? { id: warehouseId, warehouseCode: 'SITE_A', warehouseName: 'Site A' } : null;
    } },
    materialUsagePlan: { findMany: async (args: {
      where: { companyId: string; projectId: string; warehouseId: string;
        revisions: {some: {status: string; validFrom: {gte: Date; lte: Date}}} };
      select: {revisions: {orderBy: {revisionNo: string};take: number}};
      take: number;
    }) => {
      planReads++;
      assert.deepEqual([args.where.companyId,args.where.projectId,args.where.warehouseId],
        [companyId,projectId,warehouseId]);
      assert.equal(args.where.revisions.some.status, 'APPROVED');
      assert.equal(args.select.revisions.take, 1);
      assert.equal(args.select.revisions.orderBy.revisionNo, 'desc');
      assert.equal(args.take,201);
      assert.equal(args.where.revisions.some.validFrom.gte.toISOString().slice(0,10),'2026-11-24');
      assert.equal(args.where.revisions.some.validFrom.lte.toISOString().slice(0,10),'2026-12-08');
      return Array.from({ length: options.planCount ?? 1 }, (_,i) => makePlan(i));
    } },
    stockTransaction: { create: async () => {stockOrFinanceWrites++;} },
    payment: { create: async () => {stockOrFinanceWrites++;} },
  };
  const access = { assertAccess: async (_auth: unknown, id: string) => {
    accesses.push('scope');
    if (options.foreignProject || id !== projectId)
      throw new ForbiddenException({code:'PROJECT_DENIED'});
  } };
  const service = new StockMinimumService(
    db as unknown as PrismaService,access as unknown as ProjectAccessService,
    {} as AuditService,{} as InventoryQuantityService,{} as StockCountService);
  return {service,accesses, get planReads(){return planReads;},
    get writes(){return stockOrFinanceWrites;}};
}

test('SS14 approved plan start 7-day reminder uses scoped latest approved revision with no posting',async()=>{
  const f=fixture();
  const result=await f.service.planStarts(auth,projectId,warehouseId,
    new Date('2026-11-23T18:00:00.000Z'));
  assert.deepEqual([result.asOfThailandDate,result.alerts.length,result.alerts[0]?.daysUntilStart,
    result.alerts[0]?.window],['2026-11-24',1,7,'WITHIN_7_DAYS']);
  assert.equal(result.alerts[0]?.quantity,'8.5000');
  assert.equal(result.alerts[0]?.quantityBasis,'APPROVED_PLAN_ENTERED_UOM_ONLY');
  assert.equal(result.dayByDayDemandScheduleIncluded,false);
  assert.equal(result.supplierDueOrLateIndicatorsIncluded,false);
  assert.equal(result.externalNotificationsSent,false);
  assert.deepEqual([f.planReads,f.writes],[1,0]);
});

test('SS14 foreign Project or revoked current actor fails before querying material plans',async()=>{
  const denied=fixture({foreignProject:true});
  await assert.rejects(denied.service.planStarts(auth,projectId,warehouseId),ForbiddenException);
  assert.equal(denied.planReads,0);
  const revoked=fixture({revoked:true});
  await assert.rejects(revoked.service.planStarts(auth,projectId,warehouseId),ForbiddenException);
  assert.equal(revoked.planReads,0);
});

test('SS14 inconsistent foreign-Company plan material fails closed without leaking row',async()=>{
  const f=fixture({foreignMaterial:true});
  await assert.rejects(f.service.planStarts(auth,projectId,warehouseId,
    new Date('2026-11-23T18:00:00.000Z')),
    (e:unknown)=>e instanceof ConflictException &&
      (e.getResponse() as {code?:string}).code==='SS14_APPROVED_PLAN_CROSS_COMPANY_SOURCE');
  assert.equal(f.writes,0);
});

test('SS14 refuses silently truncated approved plan results',async()=>{
  const f=fixture({planCount:201});
  await assert.rejects(f.service.planStarts(auth,projectId,warehouseId,
    new Date('2026-11-23T18:00:00.000Z')),
    (e:unknown)=>e instanceof ConflictException &&
      (e.getResponse() as {code?:string}).code==='SS14_PLAN_ALERT_PAGE_LIMIT');
  assert.equal(f.writes,0);
});
