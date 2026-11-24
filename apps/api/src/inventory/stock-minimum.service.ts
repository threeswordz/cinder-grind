import { ConflictException, ForbiddenException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { StockCountService } from './stock-count.service';
import { trackedCanonicalBasis } from './material-uom-stock-dimension';
import { supplierLineIndicator } from './supplier-commitment-indicator';
import {
  approvedPlanStartWindow, dayPlus, thailandBusinessDate,
} from './approved-plan-start-reminder';
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

  /**
   * PM15 operational work queue across currently authorized Projects in the
   * selected Company. Each metric requires its own existing view capability.
   * Count records, not financial amounts; absent authorization is null, not 0.
   * No implied cross-Company access, approval, notification or posting.
   */
  async portfolioWorkQueue(supplied: AuthenticatedUserContext, at = new Date()) {
    return this.prisma.$transaction(async tx => {
      const auth = await this.liveActor(supplied, tx, false);
      if (!supplied.roleCodes.includes('PROJECT_MANAGER') ||
          !auth.roleCodes.includes('PROJECT_MANAGER')) return denied();
      const scope = await this.access.scopeWhere(auth, tx);
      const projects = await tx.project.findMany({
        where: { AND: [scope, { companyId: auth.companyId, isActive: true }] },
        select: { id: true, projectCode: true, projectName: true },
        orderBy: [{ projectCode: 'asc' }, { id: 'asc' }], take: 101,
      });
      if (projects.length > 100) return conflict('PM15_PORTFOLIO_PROJECT_LIMIT');
      const ids = projects.map(p => p.id);
      const where = { companyId: auth.companyId, projectId: { in: ids } };
      const has = (permission: string) => auth.permissions.includes(permission);
      const date = thailandBusinessDate(at);
      const today = new Date(date + 'T00:00:00.000Z');
      type Counts = Map<string, number>;
      const grouped = (rows: { projectId: string; _count: { _all: number } }[]): Counts =>
        new Map(rows.map(r => [r.projectId, r._count._all]));
      const rawCounts = (rows: { projectId: string; count: number }[]): Counts =>
        new Map(rows.map(r => [r.projectId, r.count]));
      const prAllowed = has('procurement.pr.view');
      const countAllowed = has('inventory.stock_count.view');
      const toolAllowed = has('equipment.custody.view');
      const woAllowed = has('subcontracts.work_order.view');
      const claimAllowed = has('subcontracts.claim.view');
      const certAllowed = has('subcontracts.certification.view');
      const pendingPrRows = prAllowed && ids.length ? await tx.purchaseRequest.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, cancelledAt: null,
          approvalInstance: { approvalState: 'SUBMITTED' } }, _count: { _all: true },
      }) : [];
      const pendingPr = grouped(pendingPrRows);
      // Count only original returned lines for which a correction line has
      // not yet been captured; this is not a count of all unresolved demand.
      const returned = prAllowed && ids.length ? rawCounts(await tx.$queryRaw<
        { projectId: string; count: number }[]>(Prisma.sql`
          SELECT pr.project_id AS "projectId", COUNT(*)::int AS count
          FROM purchase_request_lines l
          JOIN purchase_requests pr ON pr.id = l.purchase_request_id
          JOIN approval_instances a ON a.id = pr.approval_instance_id
          WHERE pr.company_id = ${auth.companyId}::uuid
            AND pr.project_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
            AND pr.cancelled_at IS NULL AND a.approval_state = 'APPROVED'
            AND a.company_id = pr.company_id AND a.entity_id = pr.id
            AND l.review_decision = 'RETURNED'
            AND NOT EXISTS (
              SELECT 1 FROM purchase_request_lines c
              JOIN purchase_requests cp ON cp.id = c.purchase_request_id
              WHERE c.correction_source_line_id = l.id
                AND cp.company_id = pr.company_id AND cp.project_id = pr.project_id
            )
          GROUP BY pr.project_id
        `)) : new Map<string, number>();
      const correctionsRows = prAllowed && ids.length ? await tx.purchaseRequest.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, cancelledAt: null,
          lines: { some: { correctionSourceLineId: { not: null } } },
          OR: [{ approvalInstanceId: null },
            { approvalInstance: { approvalState: { in: ['SUBMITTED', 'REJECTED'] } } }] },
        _count: { _all: true },
      }) : [];
      const corrections = grouped(correctionsRows);
      const stockCountsRows = countAllowed && ids.length ? await tx.stockCount.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, status: 'SUBMITTED' }, _count: { _all: true },
      }) : [];
      const stockCounts = grouped(stockCountsRows);
      const tools = toolAllowed && ids.length ? await tx.$queryRaw<
        { projectId: string; dueToday: number; overdue: number }[]>(Prisma.sql`
          SELECT project_id AS "projectId",
            COUNT(*) FILTER (WHERE due_on = ${today}::date)::int AS "dueToday",
            COUNT(*) FILTER (WHERE due_on < ${today}::date)::int AS overdue
          FROM equipment_custody_loans
          WHERE company_id = ${auth.companyId}::uuid
            AND project_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))})
            AND returned_on IS NULL AND due_on <= ${today}::date
          GROUP BY project_id
        `) : [];
      const toolsByProject = new Map(tools.map(row => [row.projectId,row]));
      const workOrdersRows = woAllowed && ids.length ? await tx.subcontractWorkOrder.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, approvalState: 'SUBMITTED' }, _count: { _all: true },
      }) : [];
      const workOrders = grouped(workOrdersRows);
      const claimsRows = claimAllowed && ids.length ? await tx.subcontractClaim.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, state: 'SUBMITTED' }, _count: { _all: true },
      }) : [];
      const claims = grouped(claimsRows);
      const certificatesRows = certAllowed && ids.length ? await tx.subcontractCertification.groupBy({
        by: ['projectId'], orderBy: { projectId: 'asc' }, where: { ...where, state: 'SUBMITTED' }, _count: { _all: true },
      }) : [];
      const certificates = grouped(certificatesRows);
      // Reuse canonical site minima and approved PO lineage within the same
      // repeatable-read snapshot. Count PO lines once per Project, even when
      // there are several sites (or no configured site warehouse).
      const sites = ids.length ? await tx.warehouse.findMany({
        where: { ...where, isActive: true, isSiteWarehouse: true },
        select: { id: true, projectId: true }, orderBy: { id: 'asc' }, take: 101,
      }) : [];
      if (sites.length > 100) return conflict('PM15_PORTFOLIO_SITE_LIMIT');
      const inventory = new Map<string, { sites: number; policies: number;
        activeComparable: number; shortage: number; review: number }>();
      let policyBudget = 500;
      for (const site of sites) {
        if (!site.projectId || !ids.includes(site.projectId)) return conflict('PM15_PORTFOLIO_SITE_SCOPE');
        const detail = await this.readSiteMinimums(auth, site.projectId, site.id, tx, policyBudget);
        policyBudget -= detail.policyCount;
        const totals = inventory.get(site.projectId) ?? {
          sites: 0, policies: 0, activeComparable: 0, shortage: 0, review: 0,
        };
        totals.sites++;
        totals.policies += detail.policyCount;
        totals.activeComparable += detail.alerts.filter(x => x.status === 'ACTIVE' && !x.configurationStale).length;
        totals.shortage += detail.alerts.filter(x => x.belowMinimum).length;
        totals.review += detail.unavailableActivePolicies +
          detail.alerts.filter(x => x.status === 'ACTIVE' && x.configurationStale).length;
        inventory.set(site.projectId, totals);
      }
      const deliveries = new Map<string, { late: number; today: number; within7: number;
        unknown: number; review: number; requiredLate: number }>();
      for (const p of projects) {
        // No site ID passed: the existing PO-line evaluator aggregates all
        // posted, unreversed receipts across approved revision lineage.
        const detail = await this.readSupplierCommitments(auth, p.id, null, tx, at);
        const lines = detail.alerts;
        deliveries.set(p.id, {
          late: lines.filter(x => x.deliveryState === 'LATE').length,
          today: lines.filter(x => x.deliveryState === 'DUE_TODAY').length,
          within7: lines.filter(x => x.deliveryState === 'WITHIN_7_DAYS').length,
          unknown: lines.filter(x => x.deliveryState === 'DATE_UNKNOWN').length,
          review: lines.filter(x => x.deliveryState === 'SOURCE_REVIEW_REQUIRED').length,
          requiredLate: lines.filter(x => x.deliveryState !== 'CANCELLED' &&
            x.deliveryState !== 'SOURCE_REVIEW_REQUIRED' && x.pendingQuantity !== '0.0000' &&
            x.requiredOnSiteWindow === 'LATE').length,
        });
      }
      const value = (allowed: boolean, counts: Counts, id: string) =>
        allowed ? counts.get(id) ?? 0 : null;
      return {
        companyId: auth.companyId, asOfThailandDate: date,
        projects: projects.map(p => ({ ...p,
          pendingPurchaseRequests: value(prAllowed,pendingPr,p.id),
          returnedLinesWithoutCorrection: value(prAllowed,returned,p.id),
          correctionRequestsNotApproved: value(prAllowed,corrections,p.id),
          pendingStockCounts: value(countAllowed,stockCounts,p.id),
          toolsDueToday: toolAllowed ? toolsByProject.get(p.id)?.dueToday ?? 0 : null,
          toolsOverdue: toolAllowed ? toolsByProject.get(p.id)?.overdue ?? 0 : null,
          pendingWorkOrders: value(woAllowed,workOrders,p.id),
          pendingClaims: value(claimAllowed,claims,p.id),
          pendingCertifications: value(certAllowed,certificates,p.id),
          activeSiteWarehouses: inventory.get(p.id)?.sites ?? 0,
          configuredMinimums: inventory.get(p.id)?.policies ?? 0,
          comparableActiveMinimums: inventory.get(p.id)?.activeComparable ?? 0,
          belowMinimumSiteDimensions: inventory.get(p.id)?.shortage ?? 0,
          minimumsRequireReview: inventory.get(p.id)?.review ?? 0,
          lateDeliveryLines: deliveries.get(p.id)!.late,
          deliveryLinesDueToday: deliveries.get(p.id)!.today,
          deliveryLinesWithin7Days: deliveries.get(p.id)!.within7,
          unknownDeliveryDateLines: deliveries.get(p.id)!.unknown,
          deliverySourceReviewLines: deliveries.get(p.id)!.review,
          lateRequiredOnSiteLines: deliveries.get(p.id)!.requiredLate,
        })),
        advisoryOnly: true, stockEffect: false, financeEffect: false,
        externalNotificationsSent: false,
        stockShortageAndDeliveryDetail: 'PORTFOLIO_COUNTS_AND_SITE_DRILLDOWN' as const,
        deliveryCountBasis: 'PROJECT_PO_LINES_ONCE_NOT_PER_SITE' as const,
        shortageCountBasis: 'ACTIVE_CONFIGURED_SITE_MATERIAL_UOM_DIMENSIONS' as const,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
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
    return this.readSiteMinimums(auth, projectId, warehouseId, this.prisma);
  }

  private async readSiteMinimums(auth: AuthenticatedUserContext, projectId: string, warehouseId: string,
    db: Db, policyLimit = Number.POSITIVE_INFINITY) {
    const warehouse = await this.site(auth, projectId, warehouseId, db);
    let policies;
    try { policies = replayStockMinimums(await this.history(auth, warehouseId, db), projectId, warehouseId); }
    catch { return conflict('STOCK_MINIMUM_AUDIT_CHAIN_INVALID'); }
    if (policies.length > policyLimit) return conflict('PM15_PORTFOLIO_POLICY_LIMIT');
    let unavailableActivePolicies = 0;
    const alerts = [];
    for (const policy of policies) {
      const material = await db.material.findFirst({
        where: { id: policy.materialId, companyId: auth.companyId, isActive: true },
        select: { materialCode: true, materialName: true, defaultUomId: true },
      });
      if (!material) { if (policy.status === 'ACTIVE') unavailableActivePolicies++; continue; }
      const uom = await db.unitOfMeasure.findFirst({
        where: { id: policy.uomId, companyId: auth.companyId },
        select: { uomCode: true, isActive: true },
      });
      if (!uom) { if (policy.status === 'ACTIVE') unavailableActivePolicies++; continue; }
      const balance = await this.quantities.available(db, {
        companyId: auth.companyId, projectId, warehouseId,
        materialId: policy.materialId, uomId: policy.uomId,
      });
      const minimum = new Prisma.Decimal(policy.minimumQuantity);
      // A historical threshold must not silently compare a retired purchase UOM
      // with a newly activated canonical stock UOM. It requires fresh PM setup.
      const canonical = await trackedCanonicalBasis(db, auth.companyId, policy.materialId);
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
      warehouseName: warehouse.warehouseName, alerts, policyCount: policies.length,
      unavailableActivePolicies, advisoryOnly: true,
      approvedPlanDemandAlertsIncluded: false, externalNotificationsSent: false };
  }

  /**
   * Actual approved material-plan windows only; no invented daily requirement,
   * supplier due date, future stock credit, reservation or procurement effect.
   * Each plan contributes its LATEST approved revision (never drafts).
   */
  async planStarts(supplied: AuthenticatedUserContext, projectId: string,
    warehouseId: string, at = new Date()) {
    const auth = await this.liveActor(supplied, this.prisma, false);
    await this.site(auth, projectId, warehouseId, this.prisma);
    const today = thailandBusinessDate(at);
    const dateFrom = dayPlus(today, 0);
    const dateThrough = dayPlus(today, 14);
    const plans = await this.prisma.materialUsagePlan.findMany({
      where: {
        companyId: auth.companyId, projectId, warehouseId,
        revisions: { some: { status: 'APPROVED',
          validFrom: { gte: dateFrom, lte: dateThrough } } },
      },
      select: {
        id: true, workPackageCode: true,
        revisions: {
          where: { status: 'APPROVED' },
          orderBy: { revisionNo: 'desc' }, take: 1,
          select: {
            id: true, revisionNo: true, validFrom: true, validTo: true,
            lines: {
              select: {
                id: true, materialId: true, uomId: true, quantity: true,
                material: { select: { companyId: true, isActive: true,
                  materialCode: true, materialName: true } },
                uom: { select: { companyId: true, isActive: true, uomCode: true } },
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
      take: 201,
    });
    // Never silently truncate scope evidence and imply "no pending demand".
    if (plans.length > 200) return conflict('SS14_PLAN_ALERT_PAGE_LIMIT');
    const alerts: Array<{
      planId: string; revisionId: string; revisionNo: number;
      workPackageCode: string; validFrom: string; validTo: string;
      lineId: string; materialId: string; materialCode: string; materialName: string;
      quantity: string; uomId: string; uomCode: string;
      sourceInactive: boolean; daysUntilStart: number;
      window: 'DUE_TODAY' | 'WITHIN_7_DAYS' | 'WITHIN_14_DAYS';
      quantityBasis: 'APPROVED_PLAN_ENTERED_UOM_ONLY';
    }> = [];
    for (const plan of plans) {
      const revision = plan.revisions[0];
      if (!revision) continue;
      const validFrom = revision.validFrom.toISOString().slice(0, 10);
      const validTo = revision.validTo.toISOString().slice(0, 10);
      if (validTo < validFrom) return conflict('SS14_APPROVED_PLAN_DATES_INVALID');
      const window = approvedPlanStartWindow(validFrom, today);
      if (!window) continue;
      for (const line of revision.lines) {
        // An improperly scoped material/UOM must never leak even as a reminder.
        if (line.material.companyId !== auth.companyId ||
            line.uom.companyId !== auth.companyId) {
          return conflict('SS14_APPROVED_PLAN_CROSS_COMPANY_SOURCE');
        }
        alerts.push({
          planId: plan.id, revisionId: revision.id,
          revisionNo: revision.revisionNo, workPackageCode: plan.workPackageCode,
          validFrom, validTo, lineId: line.id,
          materialId: line.materialId, materialCode: line.material.materialCode,
          materialName: line.material.materialName,
          quantity: line.quantity.toFixed(4), uomId: line.uomId,
          uomCode: line.uom.uomCode,
          sourceInactive: !line.material.isActive || !line.uom.isActive,
          daysUntilStart: window.daysUntilStart, window: window.window,
          quantityBasis: 'APPROVED_PLAN_ENTERED_UOM_ONLY',
        });
      }
    }
    alerts.sort((a, b) => a.daysUntilStart - b.daysUntilStart ||
      a.workPackageCode.localeCompare(b.workPackageCode) ||
      a.materialCode.localeCompare(b.materialCode) ||
      a.lineId.localeCompare(b.lineId));
    return {
      projectId, warehouseId, asOfThailandDate: today,
      alerts, advisoryOnly: true,
      approvedPlanStartRemindersIncluded: true,
      dayByDayDemandScheduleIncluded: false,
      supplierDueOrLateIndicatorsIncluded: false,
      availabilityOrShortageComputed: false,
      externalNotificationsSent: false,
      stockEffect: false, financeEffect: false,
    };
  }

  /**
   * Advisory project-wide APPROVED PO-line dates, with posted/unreversed GR
   * quantities reconciled across PO revisions. POs do not carry warehouseId:
   * only actually posted site receipts are attributed to the selected site.
   * No supplier promise, daily demand or site assignment is inferred.
   */
  async supplierCommitments(supplied: AuthenticatedUserContext, projectId: string,
    warehouseId: string, at = new Date()) {
    return this.prisma.$transaction(async tx => {
      const auth = await this.liveActor(supplied, tx, false);
      await this.site(auth, projectId, warehouseId, tx);
      return this.readSupplierCommitments(auth, projectId, warehouseId, tx, at);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async readSupplierCommitments(auth: AuthenticatedUserContext, projectId: string,
    warehouseId: string | null, tx: Prisma.TransactionClient, at: Date) {
      const asOfThailandDate = thailandBusinessDate(at);
      const orders = await tx.purchaseOrder.findMany({
        where: { companyId: auth.companyId, projectId },
        orderBy: [{ poNumber: 'asc' }, { revisionNo: 'desc' }],
        take: 201,
        select: {
          id: true, poNumber: true, revisionNo: true, cancelledAt: true,
          approvalInstance: { select: { approvalState: true } },
          supplier: { select: { companyId: true, isActive: true,
            supplierCode: true, supplierName: true } },
          lines: {
            where: { lineType: 'MATERIAL' },
            orderBy: { lineNo: 'asc' }, take: 101,
            select: {
              id: true, lineNo: true, quotationAwardId: true,
              materialId: true, materialCodeSnapshot: true,
              description: true, quantity: true, uomId: true,
              uomCodeSnapshot: true, requiredOnSite: true, expectedDelivery: true,
              material: { select: { companyId: true, isActive: true,
                materialCode: true, materialName: true } },
              uom: { select: { companyId: true, isActive: true, uomCode: true } },
            },
          },
        },
      });
      if (orders.length > 200) return conflict('SS14_SUPPLIER_PO_PAGE_LIMIT');
      const families = new Map<string, typeof orders>();
      for (const order of orders) {
        const family = families.get(order.poNumber) ?? [];
        family.push(order);
        families.set(order.poNumber, family);
      }
      const current = [...families.values()].map(family =>
        family.find(order => order.approvalInstance?.approvalState === 'APPROVED'))
        .filter((order): order is (typeof orders)[number] => order !== undefined);
      if (current.some(order => order.lines.length > 100))
        return conflict('SS14_SUPPLIER_LINE_PAGE_LIMIT');
      const poNumbers = current.map(order => order.poNumber);
      const receipts = poNumbers.length ? await tx.goodsReceiptItem.findMany({
        where: {
          goodsReceipt: {
            companyId: auth.companyId, projectId,
            postedAt: { not: null }, reversedAt: null,
            purchaseOrder: { companyId: auth.companyId, projectId,
              poNumber: { in: poNumbers } },
          },
        },
        take: 5001,
        select: {
          quotationAwardId: true, materialId: true, uomId: true, quantity: true,
          goodsReceipt: { select: {
            companyId: true, projectId: true, warehouseId: true,
            purchaseOrder: { select: {
              companyId: true, projectId: true, poNumber: true,
            } },
          } },
          purchaseOrderLine: { select: {
            quotationAwardId: true, materialId: true, uomId: true,
            purchaseOrder: { select: {
              companyId: true, projectId: true, poNumber: true,
            } },
          } },
        },
      }) : [];
      if (receipts.length > 5000) return conflict('SS14_SUPPLIER_GR_PAGE_LIMIT');
      const receivedByKey = new Map<string, { total: Prisma.Decimal;
        atSite: Prisma.Decimal; materialId: string; uomId: string }>();
      for (const receipt of receipts) {
        const gr = receipt.goodsReceipt;
        const order = gr.purchaseOrder;
        const source = receipt.purchaseOrderLine;
        if (gr.companyId !== auth.companyId || gr.projectId !== projectId ||
            order.companyId !== auth.companyId || order.projectId !== projectId ||
            source.purchaseOrder.companyId !== auth.companyId ||
            source.purchaseOrder.projectId !== projectId ||
            order.poNumber !== source.purchaseOrder.poNumber ||
            receipt.quotationAwardId !== source.quotationAwardId ||
            receipt.materialId !== source.materialId ||
            receipt.uomId !== source.uomId || receipt.quantity.lessThanOrEqualTo(0))
          return conflict('SS14_SUPPLIER_RECEIPT_SOURCE_INVALID');
        const key = order.poNumber + ':' + receipt.quotationAwardId;
        const before = receivedByKey.get(key);
        if (before && (before.materialId !== receipt.materialId ||
                       before.uomId !== receipt.uomId))
          return conflict('SS14_SUPPLIER_RECEIPT_UOM_MISMATCH');
        receivedByKey.set(key, {
          total: (before?.total ?? new Prisma.Decimal(0)).plus(receipt.quantity),
          atSite: (before?.atSite ?? new Prisma.Decimal(0)).plus(
            gr.warehouseId === warehouseId ? receipt.quantity : 0),
          materialId: receipt.materialId, uomId: receipt.uomId,
        });
      }

      const alerts = [];
      for (const order of current) {
        if (order.supplier.companyId !== auth.companyId)
          return conflict('SS14_SUPPLIER_FOREIGN_COMPANY_SOURCE');
        const family = families.get(order.poNumber) ?? [];
        const previousApproved = family.find(other =>
          other.revisionNo < order.revisionNo &&
          other.approvalInstance?.approvalState === 'APPROVED');
        if (previousApproved && previousApproved.lines.length > 100)
          return conflict('SS14_SUPPLIER_LINE_PAGE_LIMIT');
        for (const line of order.lines) {
          if (!line.material || !line.materialId ||
              line.material.companyId !== auth.companyId ||
              line.uom.companyId !== auth.companyId ||
              !line.material.isActive || !line.uom.isActive ||
              line.material.materialCode !== line.materialCodeSnapshot ||
              line.uom.uomCode !== line.uomCodeSnapshot)
            return conflict('SS14_SUPPLIER_MATERIAL_UOM_SOURCE_INVALID');
          const key = order.poNumber + ':' + line.quotationAwardId;
          const actual = receivedByKey.get(key);
          if (actual && (actual.materialId !== line.materialId ||
                         actual.uomId !== line.uomId))
            return conflict('SS14_SUPPLIER_REVISION_UOM_MISMATCH');
          const previousLine = previousApproved?.lines.find(
            old => old.quotationAwardId === line.quotationAwardId);
          const expectedDelivery = line.expectedDelivery?.toISOString().slice(0, 10) ?? null;
          const requiredOnSite = line.requiredOnSite?.toISOString().slice(0, 10) ?? null;
          const previousApprovedExpectedDelivery =
            previousLine?.expectedDelivery?.toISOString().slice(0, 10) ?? null;
          let indicator;
          try {
            indicator = supplierLineIndicator({
              orderedQuantity: line.quantity,
              receivedQuantity: actual?.total ?? new Prisma.Decimal(0),
              receivedAtSite: actual?.atSite ?? new Prisma.Decimal(0),
              expectedDelivery, requiredOnSite, previousApprovedExpectedDelivery,
              asOfThailandDate, cancelled: order.cancelledAt !== null,
            });
          } catch {
            return conflict('SS14_SUPPLIER_DATE_OR_QUANTITY_SOURCE_INVALID');
          }
          alerts.push({
            poId: order.id, poNumber: order.poNumber, revisionNo: order.revisionNo,
            poLineId: line.id, lineNo: line.lineNo, quotationAwardId: line.quotationAwardId,
            supplierCode: order.supplier.supplierCode,
            supplierName: order.supplier.supplierName,
            supplierInactive: !order.supplier.isActive,
            materialId: line.materialId, materialCode: line.material.materialCode,
            materialName: line.material.materialName,
            uomId: line.uomId, uomCode: line.uom.uomCode,
            requiredOnSite, expectedDelivery,
            ...indicator,
            deliveryState: !order.supplier.isActive && !order.cancelledAt
              ? 'SOURCE_REVIEW_REQUIRED' as const : indicator.deliveryState,
          });
          if (alerts.length > 500) return conflict('SS14_SUPPLIER_ALERT_PAGE_LIMIT');
        }
      }
      alerts.sort((a, b) =>
        a.poNumber.localeCompare(b.poNumber) || a.lineNo - b.lineNo);
      return {
        projectId, warehouseId, asOfThailandDate, alerts,
        advisoryOnly: true, supplierDueIndicatorsIncluded: true,
        planValidFromUsedAsDeliveryDate: false,
        poLineSiteAssignmentIncluded: false,
        projectWidePoDates: true,
        receiptsScopedToSelectedSite: warehouseId !== null,
        supplierAcknowledgmentsVerified: false,
        dayByDayDemandScheduleIncluded: false,
        externalNotificationsSent: false, stockEffect: false, financeEffect: false,
      };
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
