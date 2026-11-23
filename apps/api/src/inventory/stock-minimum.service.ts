import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { StockCountService } from './stock-count.service';
import { trackedCanonicalBasis } from './material-uom-stock-dimension';
import {
  replayStockMinimums, stockMinimumInput, STOCK_MINIMUM_ACTION, STOCK_MINIMUM_ENTITY,
} from './stock-minimum-contract';

type Db = PrismaService | Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
const denied = (): never => { throw new ForbiddenException({ code: 'STOCK_MINIMUM_LIVE_PERMISSION_DENIED' }); };
const conflict = (code: string): never => { throw new ConflictException({ code }); };
const invalid = (code: string): never => { throw new UnprocessableEntityException({ code }); };

/** Read-only, site/Project-specific low-stock alerts. Never posts or reserves stock. */
@Injectable()
export class StockMinimumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly quantities: InventoryQuantityService,
    private readonly choicesService: StockCountService,
  ) {}

  private async liveActor(supplied: AuthenticatedUserContext, db: Db, edit: boolean) {
    const session = await db.userSession.findFirst({
      where: { id: supplied.sessionId, userId: supplied.userId, revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { companyId: supplied.companyId, isActive: true, company: { isActive: true } } },
      select: { user: { select: {
        employee: { select: { companyId: true, isActive: true } },
        userRoles: { select: { role: { select: {
          companyId: true, isActive: true, roleCode: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
        } } } },
      } } },
    });
    const roles = session?.user.userRoles
      .filter(r => r.role.isActive && r.role.companyId === supplied.companyId)
      .map(r => r.role) ?? [];
    const permissions = new Set(roles.flatMap(r => r.rolePermissions.map(p => p.permission.permissionCode)));
    if (!session || !session.user.employee?.isActive ||
        session.user.employee.companyId !== supplied.companyId ||
        !roles.some(r => edit ? r.roleCode === 'PROJECT_MANAGER' :
          ['PROJECT_MANAGER', 'STOREKEEPER'].includes(r.roleCode)) ||
        !supplied.permissions.includes('inventory.stock.view') ||
        !permissions.has('inventory.stock.view'))
      return denied();
    return { ...supplied, roleCodes: roles.map(r => r.roleCode),
      permissions: [...permissions].filter(p => supplied.permissions.includes(p)) };
  }

  private async site(auth: AuthenticatedUserContext, projectId: string, warehouseId: string, db: Db) {
    await this.access.assertAccess(auth, projectId, db);
    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId, projectId,
        isSiteWarehouse: true, isActive: true, project: { isActive: true } },
      select: { id: true, warehouseCode: true, warehouseName: true },
    });
    if (!warehouse) return invalid('STOCK_MINIMUM_ACTIVE_SITE_REQUIRED');
    return warehouse;
  }

  private async history(auth: AuthenticatedUserContext, warehouseId: string, db: Db) {
    const events = await db.auditLog.findMany({
      where: { companyId: auth.companyId, entityType: STOCK_MINIMUM_ENTITY,
        entityId: warehouseId, action: STOCK_MINIMUM_ACTION },
      select: { id: true, entityId: true, actorUserId: true, action: true,
        occurredAt: true, newValues: true },
      take: 5001,
    });
    if (events.length > 5000) return conflict('STOCK_MINIMUM_HISTORY_LIMIT');
    return events;
  }

  async projects(supplied: AuthenticatedUserContext) {
    const auth = await this.liveActor(supplied, this.prisma, false);
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({ where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true }, orderBy: { projectCode: 'asc' } });
  }

  async sites(supplied: AuthenticatedUserContext, projectId: string) {
    const auth = await this.liveActor(supplied, this.prisma, false);
    await this.access.assertAccess(auth, projectId);
    return this.prisma.warehouse.findMany({ where: {
      companyId: auth.companyId, projectId, isSiteWarehouse: true, isActive: true,
      project: { isActive: true },
    }, select: { id: true, warehouseCode: true, warehouseName: true },
      orderBy: { warehouseCode: 'asc' } });
  }

  async choices(supplied: AuthenticatedUserContext, projectId: string, warehouseId: string, after?: string) {
    const auth = await this.liveActor(supplied, this.prisma, false);
    await this.site(auth, projectId, warehouseId, this.prisma);
    return this.choicesService.choices(auth, projectId, warehouseId, after);
  }

  async read(supplied: AuthenticatedUserContext, projectId: string, warehouseId: string) {
    const auth = await this.liveActor(supplied, this.prisma, false);
    const warehouse = await this.site(auth, projectId, warehouseId, this.prisma);
    let policies;
    try { policies = replayStockMinimums(await this.history(auth, warehouseId, this.prisma), projectId, warehouseId); }
    catch { return conflict('STOCK_MINIMUM_AUDIT_CHAIN_INVALID'); }
    const alerts = [];
    for (const policy of policies) {
      const material = await this.prisma.material.findFirst({
        where: { id: policy.materialId, companyId: auth.companyId, isActive: true },
        select: { materialCode: true, materialName: true, defaultUomId: true },
      });
      if (!material) continue;
      const uom = await this.prisma.unitOfMeasure.findFirst({
        where: { id: policy.uomId, companyId: auth.companyId },
        select: { uomCode: true, isActive: true },
      });
      if (!uom) continue;
      const balance = await this.quantities.available(this.prisma, {
        companyId: auth.companyId, projectId, warehouseId,
        materialId: policy.materialId, uomId: policy.uomId,
      });
      const minimum = new Prisma.Decimal(policy.minimumQuantity);
      // A historical threshold must not silently compare a retired purchase UOM
      // with a newly activated canonical stock UOM. It requires fresh PM setup.
      const canonical = await trackedCanonicalBasis(this.prisma, auth.companyId, policy.materialId);
      const configurationStale = !uom.isActive || (canonical
        ? canonical.stockUomId !== policy.uomId
        : material.defaultUomId !== policy.uomId);
      const belowMinimum = !configurationStale && policy.status === 'ACTIVE' &&
        balance.available.lessThan(minimum);
      alerts.push({
        ...policy, materialCode: material.materialCode, materialName: material.materialName,
        uomCode: uom.uomCode, configurationStale,
        onHand: balance.onHand.toFixed(4), reserved: balance.reserved.toFixed(4),
        available: balance.available.toFixed(4),
        belowMinimum,
        shortage: belowMinimum ? minimum.minus(balance.available).toFixed(4) : '0.0000',
      });
    }
    return { projectId, warehouseId, warehouseCode: warehouse.warehouseCode,
      warehouseName: warehouse.warehouseName, alerts, advisoryOnly: true,
      approvedPlanDemandAlertsIncluded: false, externalNotificationsSent: false };
  }

  async set(context: Context, projectId: string, warehouseId: string, input: unknown,
    expectedPreviousEventId: string | null) {
    let body: ReturnType<typeof stockMinimumInput>;
    try { body = stockMinimumInput(input); }
    catch { return invalid('STOCK_MINIMUM_INVALID_CONFIGURATION'); }
    const outcome = await this.prisma.$transaction(async tx => {
      const auth = await this.liveActor(context.auth, tx, true);
      await this.site(auth, projectId, warehouseId, tx);
      const material = await tx.material.findFirst({
        where: { id: body.materialId, companyId: auth.companyId, isActive: true },
        select: { defaultUomId: true },
      });
      const uom = await tx.unitOfMeasure.findFirst({
        where: { id: body.uomId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      });
      if (!material || !uom) return invalid('STOCK_MINIMUM_MATERIAL_UOM_INVALID');
      const canonical = await trackedCanonicalBasis(tx, auth.companyId, body.materialId);
      if ((canonical && canonical.stockUomId !== body.uomId) ||
          (!canonical && material.defaultUomId !== body.uomId))
        return invalid('STOCK_MINIMUM_STOCK_UOM_REQUIRED');
      if (canonical && new Prisma.Decimal(body.minimumQuantity).decimalPlaces() > canonical.stockPrecision)
        return invalid('STOCK_MINIMUM_STOCK_PRECISION_EXCEEDED');

      // Policy lock is separate from stock effects, so alert setup cannot post stock.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        ['stock-minimum', auth.companyId, warehouseId, body.materialId, body.uomId].join(':'));
      let states;
      try { states = replayStockMinimums(await this.history(auth, warehouseId, tx), projectId, warehouseId); }
      catch { return conflict('STOCK_MINIMUM_AUDIT_CHAIN_INVALID'); }
      const prior = states.find(x => x.materialId === body.materialId && x.uomId === body.uomId) ?? null;
      if (expectedPreviousEventId !== (prior?.lastEventId ?? null))
        return conflict('STOCK_MINIMUM_STALE_VERSION');
      await this.audit.record({
        ...context, auth, entityType: STOCK_MINIMUM_ENTITY,
        entityId: warehouseId, action: STOCK_MINIMUM_ACTION,
        newValues: { projectId, warehouseId, ...body,
          version: (prior?.version ?? 0) + 1,
          previousEventId: prior?.lastEventId ?? null,
          effect: 'ALERT_POLICY_ONLY_NO_STOCK_OR_FINANCE_POSTING' },
      }, tx);
      return { projectId, warehouseId, ...body, version: (prior?.version ?? 0) + 1,
        advisoryOnly: true, stockEffect: false, financeEffect: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    return outcome;
  }
}
