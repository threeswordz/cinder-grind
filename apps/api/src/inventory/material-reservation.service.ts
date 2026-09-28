import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  InventoryQuantityService,
  StockDimension,
} from './inventory-quantity.service';

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };
type Db = Prisma.TransactionClient | PrismaService;

export type ReservationInput = {
  projectId: string;
  warehouseId: string;
  materialId: string;
  uomId: string;
  wbsId?: string | null;
  activityId?: string | null;
  quantity: Prisma.Decimal;
  requiredDate?: Date | null;
  remarks?: string | null;
};

@Injectable()
export class MaterialReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
    private readonly quantities: InventoryQuantityService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async warehouses(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.warehouse.findMany({
      where: {
        companyId: auth.companyId,
        isActive: true,
        OR: [{ projectId: null }, { projectId }],
      },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        projectId: true,
        isSiteWarehouse: true,
      },
      orderBy: { warehouseCode: 'asc' },
    });
  }

  async stockChoices(
    auth: AuthenticatedUserContext,
    projectId: string,
    warehouseId?: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const warehouse = warehouseId
      ? Prisma.sql`AND st.warehouse_id = ${warehouseId}::uuid`
      : Prisma.empty;
    return this.prisma.$queryRaw<Array<{
      warehouseId: string;
      warehouseCode: string;
      materialId: string;
      materialCode: string;
      materialName: string;
      uomId: string;
      uomCode: string;
      onHand: Prisma.Decimal;
    }>>(Prisma.sql`
      SELECT
        w.id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        m.id AS "materialId",
        m.material_code AS "materialCode",
        m.material_name AS "materialName",
        u.id AS "uomId",
        u.uom_code AS "uomCode",
        SUM(st.quantity)::DECIMAL(38,4) AS "onHand"
      FROM stock_transactions st
      JOIN warehouses w ON w.id=st.warehouse_id AND w.company_id=st.company_id
      JOIN materials m ON m.id=st.material_id AND m.company_id=st.company_id
      JOIN units_of_measure u ON u.id=st.uom_id AND u.company_id=st.company_id
      WHERE st.company_id=${auth.companyId}::uuid
        AND st.project_id=${projectId}::uuid
        AND w.is_active=TRUE
        ${warehouse}
      GROUP BY w.id,w.warehouse_code,m.id,m.material_code,m.material_name,u.id,u.uom_code
      HAVING SUM(st.quantity) > 0
      ORDER BY w.warehouse_code,m.material_code,u.uom_code
      LIMIT 1000
    `);
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.materialReservation.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        warehouse: { select: { warehouseCode: true, warehouseName: true } },
        material: { select: { materialCode: true, materialName: true } },
        uom: { select: { uomCode: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
    const row = await db.materialReservation.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        warehouse: { select: { warehouseCode: true, warehouseName: true } },
        material: { select: { materialCode: true, materialName: true } },
        uom: { select: { uomCode: true } },
        wbs: { select: { wbsCode: true, wbsName: true } },
        activity: { select: { activityCode: true, activityName: true } },
        issueItems: { select: { id: true, materialIssueId: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND' });
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  async availability(
    auth: AuthenticatedUserContext,
    input: Pick<ReservationInput, 'projectId' | 'warehouseId' | 'materialId' | 'uomId'>,
  ) {
    await this.access.assertAccess(auth, input.projectId);
    await this.validateDimensions(auth, input, this.prisma);
    const result = await this.quantities.available(this.prisma, {
      companyId: auth.companyId,
      ...input,
    });
    return {
      onHand: result.onHand.toFixed(4),
      reserved: result.reserved.toFixed(4),
      available: result.available.toFixed(4),
    };
  }

  async create(context: AuditContext, input: ReservationInput) {
    this.assertQuantity(input.quantity);
    await this.access.assertAccess(context.auth, input.projectId);
    const sequence = await this.prisma.numberSequence.findFirst({
      where: {
        companyId: context.auth.companyId,
        sequenceCode: 'MATERIAL_RESERVATION',
      },
    });
    if (
      !sequence ||
      sequence.formatTemplate !== 'RSVYYMM-###' ||
      sequence.resetRule !== 'MONTHLY'
    ) {
      throw new ConflictException({
        code: 'RESERVATION_NUMBERING_REQUIRED',
        detail: 'Configure RSVYYMM-### with a monthly reset.',
      });
    }
    const reservationNumber = await this.numbers.next(
      context.auth.companyId,
      'MATERIAL_RESERVATION',
    );
    return this.prisma.$transaction(async (tx) => {
      await this.validateDimensions(context.auth, input, tx);
      const row = await tx.materialReservation.create({
        data: {
          companyId: context.auth.companyId,
          projectId: input.projectId,
          warehouseId: input.warehouseId,
          materialId: input.materialId,
          uomId: input.uomId,
          wbsId: input.wbsId ?? null,
          activityId: input.activityId ?? null,
          reservationNumber,
          quantity: input.quantity,
          requiredDate: input.requiredDate ?? null,
          remarks: input.remarks ?? null,
          createdByUserId: context.auth.userId,
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RESERVATION',
        entityId: row.id,
        action: 'CREATE',
        newValues: {
          reservationNumber,
          projectId: input.projectId,
          warehouseId: input.warehouseId,
          materialId: input.materialId,
          uomId: input.uomId,
          quantity: input.quantity.toString(),
        },
      }, tx);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateDraft(
    context: AuditContext,
    id: string,
    input: Partial<Omit<ReservationInput, 'projectId'>>,
  ) {
    if (input.quantity) this.assertQuantity(input.quantity);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      if (before.status !== 'DRAFT') {
        throw new ConflictException({ code: 'RESERVATION_NOT_DRAFT' });
      }
      const next = {
        projectId: before.projectId,
        warehouseId: input.warehouseId ?? before.warehouseId,
        materialId: input.materialId ?? before.materialId,
        uomId: input.uomId ?? before.uomId,
        wbsId: input.wbsId !== undefined ? input.wbsId : before.wbsId,
        activityId:
          input.activityId !== undefined ? input.activityId : before.activityId,
      };
      await this.validateDimensions(context.auth, next, tx);
      const row = await tx.materialReservation.update({
        where: { id },
        data: {
          ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
          ...(input.materialId !== undefined ? { materialId: input.materialId } : {}),
          ...(input.uomId !== undefined ? { uomId: input.uomId } : {}),
          ...(input.wbsId !== undefined ? { wbsId: input.wbsId } : {}),
          ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
          ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
          ...(input.requiredDate !== undefined ? { requiredDate: input.requiredDate } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RESERVATION',
        entityId: id,
        action: 'UPDATE_DRAFT',
        oldValues: {
          warehouseId: before.warehouseId,
          materialId: before.materialId,
          uomId: before.uomId,
          quantity: before.quantity.toString(),
        },
        newValues: {
          warehouseId: row.warehouseId,
          materialId: row.materialId,
          uomId: row.uomId,
          quantity: row.quantity.toString(),
        },
      }, tx);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async activate(context: AuditContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.get(context.auth, id, tx);
      if (row.status !== 'DRAFT') {
        throw new ConflictException({ code: 'RESERVATION_NOT_DRAFT' });
      }
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'inventory-warehouse:' + row.warehouseId,
      );
      await this.validateDimensions(context.auth, row, tx);
      const dimension = this.dimension(context.auth.companyId, row);
      await this.quantities.lock(tx, dimension);
      const availability = await this.quantities.available(tx, dimension);
      if (row.quantity.greaterThan(availability.available)) {
        throw new ConflictException({
          code: 'RESERVATION_INSUFFICIENT_AVAILABLE',
          detail: 'Reservation quantity exceeds currently available stock.',
        });
      }
      const at = new Date();
      const updated = await tx.materialReservation.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          activatedAt: at,
          activatedByUserId: context.auth.userId,
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RESERVATION',
        entityId: id,
        action: 'ACTIVATE',
        newValues: {
          activatedAt: at,
          onHand: availability.onHand.toString(),
          reservedBefore: availability.reserved.toString(),
          quantity: row.quantity.toString(),
        },
      }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async release(context: AuditContext, id: string, reason: string) {
    return this.closeActive(context, id, 'RELEASED', reason);
  }

  async cancel(context: AuditContext, id: string, reason: string) {
    return this.closeActive(context, id, 'CANCELLED', reason);
  }

  private async closeActive(
    context: AuditContext,
    id: string,
    target: 'RELEASED' | 'CANCELLED',
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.get(context.auth, id, tx);
      if (row.status !== 'ACTIVE') {
        throw new ConflictException({ code: 'RESERVATION_NOT_ACTIVE' });
      }
      const at = new Date();
      const updated = await tx.materialReservation.update({
        where: { id },
        data:
          target === 'RELEASED'
            ? {
                status: target,
                releasedAt: at,
                releasedByUserId: context.auth.userId,
                releaseReason: reason,
              }
            : {
                status: target,
                cancelledAt: at,
                cancelledByUserId: context.auth.userId,
                cancellationReason: reason,
              },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RESERVATION',
        entityId: id,
        action: target === 'RELEASED' ? 'RELEASE' : 'CANCEL',
        newValues: { status: target, reason, at },
      }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async validateDimensions(
    auth: AuthenticatedUserContext,
    input: {
      projectId: string;
      warehouseId: string;
      materialId: string;
      uomId: string;
      wbsId?: string | null;
      activityId?: string | null;
    },
    db: Db,
  ) {
    await this.access.assertAccess(auth, input.projectId, db);
    const [warehouse, material, uom] = await Promise.all([
      db.warehouse.findFirst({
        where: {
          id: input.warehouseId,
          companyId: auth.companyId,
          isActive: true,
        },
      }),
      db.material.findFirst({
        where: { id: input.materialId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      }),
      db.unitOfMeasure.findFirst({
        where: { id: input.uomId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (
      !warehouse ||
      (warehouse.projectId && warehouse.projectId !== input.projectId)
    ) {
      throw new UnprocessableEntityException({
        code: 'RESERVATION_WAREHOUSE_INVALID',
      });
    }
    if (!material || !uom) {
      throw new UnprocessableEntityException({
        code: 'RESERVATION_MATERIAL_UOM_INVALID',
      });
    }
    if (input.wbsId) {
      const wbs = await db.wbsElement.findFirst({
        where: { id: input.wbsId, projectId: input.projectId, isActive: true },
        select: { id: true },
      });
      if (!wbs) throw new UnprocessableEntityException({ code: 'RESERVATION_WBS_INVALID' });
    }
    if (input.activityId) {
      const activity = await db.activity.findFirst({
        where: { id: input.activityId, projectId: input.projectId, isActive: true },
        select: { id: true },
      });
      if (!activity) {
        throw new UnprocessableEntityException({ code: 'RESERVATION_ACTIVITY_INVALID' });
      }
    }
  }

  private assertQuantity(quantity: Prisma.Decimal) {
    if (
      !quantity.isFinite() ||
      quantity.lte(0) ||
      quantity.decimalPlaces() > 4 ||
      quantity.greaterThan('99999999999999.9999')
    ) {
      throw new UnprocessableEntityException({
        code: 'RESERVATION_QUANTITY_INVALID',
      });
    }
  }

  private dimension(
    companyId: string,
    row: {
      warehouseId: string;
      materialId: string;
      projectId: string;
      uomId: string;
    },
  ): StockDimension {
    return {
      companyId,
      warehouseId: row.warehouseId,
      materialId: row.materialId,
      projectId: row.projectId,
      uomId: row.uomId,
    };
  }
}
