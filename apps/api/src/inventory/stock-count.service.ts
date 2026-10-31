import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService, StockDimension } from './inventory-quantity.service';

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };
type Db = Prisma.TransactionClient | PrismaService;

export type StockCountCreateInput = {
  projectId: string;
  warehouseId: string;
  materialId: string;
  uomId: string;
  countedAt: Date;
  actualQuantity: Prisma.Decimal;
  evidenceReference?: string | null;
};

export type StockCountDraftInput = {
  expectedVersion: number;
  countedAt?: Date;
  actualQuantity?: Prisma.Decimal;
  evidenceReference?: string | null;
};

@Injectable()
export class StockCountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
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

  async siteWarehouses(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.warehouse.findMany({
      where: { companyId: auth.companyId, projectId, isSiteWarehouse: true, isActive: true },
      select: { id: true, warehouseCode: true, warehouseName: true, projectId: true },
      orderBy: { warehouseCode: 'asc' },
    });
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.stockCount.findMany({
      where: { companyId: auth.companyId, projectId },
      include: this.include(),
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async get(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
    const row = await db.stockCount.findFirst({
      where: { id, companyId: auth.companyId },
      include: this.include(),
    });
    if (!row) {
      throw new NotFoundException({ code: 'STOCK_COUNT_NOT_FOUND', detail: 'Stock count not found.' });
    }
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  async create(context: AuditContext, input: StockCountCreateInput) {
    this.assertQuantity(input.actualQuantity);
    return this.prisma.$transaction(async (tx) => {
      await this.validateDimensions(context.auth, input, tx);
      const dimension = this.dimension(context.auth.companyId, input);
      await this.quantities.lock(tx, dimension);
      const snapshot = await this.quantities.available(tx, dimension);
      const variance = input.actualQuantity.minus(snapshot.onHand);
      const row = await tx.stockCount.create({
        data: {
          companyId: context.auth.companyId,
          projectId: input.projectId,
          warehouseId: input.warehouseId,
          materialId: input.materialId,
          uomId: input.uomId,
          countedAt: input.countedAt,
          expectedOnHand: snapshot.onHand,
          expectedReserved: snapshot.reserved,
          actualQuantity: input.actualQuantity,
          varianceQuantity: variance,
          evidenceReference: input.evidenceReference ?? null,
          createdByUserId: context.auth.userId,
        },
      });
      await this.audit.record({
        ...context, entityType: 'STOCK_COUNT', entityId: row.id, action: 'CREATE',
        newValues: this.auditValues(row),
      }, tx);
      return this.get(context.auth, row.id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateDraft(context: AuditContext, id: string, input: StockCountDraftInput) {
    if (input.actualQuantity !== undefined) this.assertQuantity(input.actualQuantity);
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      this.assertDraftVersion(before.status, before.version, input.expectedVersion);
      const actual = input.actualQuantity ?? before.actualQuantity;
      const row = await tx.stockCount.update({
        where: { id },
        data: {
          ...(input.countedAt !== undefined ? { countedAt: input.countedAt } : {}),
          ...(input.actualQuantity !== undefined
            ? { actualQuantity: input.actualQuantity, varianceQuantity: actual.minus(before.expectedOnHand) }
            : {}),
          ...(input.evidenceReference !== undefined ? { evidenceReference: input.evidenceReference } : {}),
          version: before.version + 1,
        },
      });
      await this.audit.record({
        ...context, entityType: 'STOCK_COUNT', entityId: id, action: 'UPDATE_DRAFT',
        oldValues: this.auditValues(before), newValues: this.auditValues(row),
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submit(context: AuditContext, id: string, expectedVersion: number) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      this.assertDraftVersion(before.status, before.version, expectedVersion);
      await this.validateDimensions(context.auth, before, tx);
      const dimension = this.dimension(context.auth.companyId, before);
      await this.quantities.lock(tx, dimension);
      const current = await this.quantities.available(tx, dimension);
      this.assertSnapshotFresh(before, current);
      this.assertEvidence(before.varianceQuantity, before.evidenceReference);
      this.assertReservations(before.actualQuantity, current.reserved);
      const row = await tx.stockCount.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedByUserId: context.auth.userId,
          submittedAt: new Date(),
          version: before.version + 1,
        },
      });
      await this.audit.record({
        ...context, entityType: 'STOCK_COUNT', entityId: id, action: 'SUBMIT',
        newValues: {
          version: row.version,
          expectedOnHand: row.expectedOnHand.toString(),
          expectedReserved: row.expectedReserved.toString(),
          actualQuantity: row.actualQuantity.toString(),
          varianceQuantity: row.varianceQuantity.toString(),
        },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async approve(
    context: AuditContext,
    id: string,
    expectedVersion: number,
    postKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      if (before.status === 'APPROVED') {
        if (before.postKey === postKey && (before.decisionComment ?? null) === (comment ?? null)) return before;
        throw new ConflictException({
          code: 'STOCK_COUNT_APPROVAL_REPLAY_CONFLICT',
          detail: 'The approved stock count cannot be replayed with changed input.',
        });
      }
      if (before.status !== 'SUBMITTED' || before.version !== expectedVersion) {
        throw new ConflictException({
          code: 'STOCK_COUNT_NOT_CURRENT_SUBMISSION',
          detail: 'Refresh the submitted stock count before deciding it.',
        });
      }
      if (before.createdByUserId === context.auth.userId || before.submittedByUserId === context.auth.userId) {
        throw new ForbiddenException({
          code: 'STOCK_COUNT_SELF_APPROVAL_DENIED',
          detail: 'The stock count maker or submitter cannot approve the same count.',
        });
      }
      await this.validateDimensions(context.auth, before, tx);
      const dimension = this.dimension(context.auth.companyId, before);
      await this.quantities.lock(tx, dimension);
      const current = await this.quantities.available(tx, dimension);
      this.assertSnapshotFresh(before, current);
      this.assertReservations(before.actualQuantity, current.reserved);
      this.assertEvidence(before.varianceQuantity, before.evidenceReference);

      const approved = await tx.stockCount.update({
        where: { id },
        data: {
          status: 'APPROVED',
          decidedByUserId: context.auth.userId,
          decidedAt: new Date(),
          decisionComment: comment ?? null,
          postKey,
          version: before.version + 1,
        },
      });
      if (!before.varianceQuantity.equals(0)) {
        await tx.stockTransaction.create({
          data: {
            companyId: context.auth.companyId,
            warehouseId: before.warehouseId,
            materialId: before.materialId,
            projectId: before.projectId,
            uomId: before.uomId,
            stockCountId: before.id,
            movementType: 'STOCK_COUNT_ADJUSTMENT',
            quantity: before.varianceQuantity,
            effectKey: 'stock-count:' + before.id + ':' + postKey,
            postedByUserId: context.auth.userId,
          },
        });
      }
      await this.audit.record({
        ...context, entityType: 'STOCK_COUNT', entityId: id, action: 'APPROVE',
        newValues: {
          version: approved.version, postKey, varianceQuantity: approved.varianceQuantity.toString(),
          quantityOnly: true, financeEffect: false,
        },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async reject(context: AuditContext, id: string, expectedVersion: number, comment: string) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      if (before.status !== 'SUBMITTED' || before.version !== expectedVersion) {
        throw new ConflictException({
          code: 'STOCK_COUNT_NOT_CURRENT_SUBMISSION',
          detail: 'Refresh the submitted stock count before deciding it.',
        });
      }
      if (before.createdByUserId === context.auth.userId || before.submittedByUserId === context.auth.userId) {
        throw new ForbiddenException({
          code: 'STOCK_COUNT_SELF_DECISION_DENIED',
          detail: 'The stock count maker or submitter cannot decide the same count.',
        });
      }
      await this.validateDimensions(context.auth, before, tx);
      const row = await tx.stockCount.update({
        where: { id },
        data: {
          status: 'REJECTED',
          decidedByUserId: context.auth.userId,
          decidedAt: new Date(),
          decisionComment: comment,
          version: before.version + 1,
        },
      });
      await this.audit.record({
        ...context, entityType: 'STOCK_COUNT', entityId: id, action: 'REJECT',
        newValues: { version: row.version, commentRecorded: true },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private include() {
    return {
      warehouse: { select: { warehouseCode: true, warehouseName: true, isSiteWarehouse: true } },
      material: { select: { materialCode: true, materialName: true } },
      uom: { select: { uomCode: true, uomName: true } },
      stockTransaction: { select: { id: true, movementType: true, quantity: true, effectKey: true, postedAt: true } },
    } as const;
  }

  private async validateDimensions(
    auth: AuthenticatedUserContext,
    input: { projectId: string; warehouseId: string; materialId: string; uomId: string },
    db: Db,
  ) {
    await this.access.assertAccess(auth, input.projectId, db);
    const [project, warehouse, material, uom] = await Promise.all([
      db.project.findFirst({ where: { id: input.projectId, companyId: auth.companyId, isActive: true }, select: { id: true } }),
      db.warehouse.findFirst({
        where: { id: input.warehouseId, companyId: auth.companyId, projectId: input.projectId, isSiteWarehouse: true, isActive: true },
        select: { id: true },
      }),
      db.material.findFirst({ where: { id: input.materialId, companyId: auth.companyId, isActive: true }, select: { id: true } }),
      db.unitOfMeasure.findFirst({ where: { id: input.uomId, companyId: auth.companyId, isActive: true }, select: { id: true } }),
    ]);
    if (!project || !warehouse || !material || !uom) {
      throw new UnprocessableEntityException({
        code: 'STOCK_COUNT_DIMENSION_INVALID',
        detail: 'Use one active Project-owned site Warehouse, Material and UOM in the same Company.',
      });
    }
  }

  private assertDraftVersion(status: string, version: number, expectedVersion: number) {
    if (status !== 'DRAFT' || version !== expectedVersion) {
      throw new ConflictException({
        code: 'STOCK_COUNT_DRAFT_CONFLICT',
        detail: 'Refresh the draft stock count before changing or submitting it.',
      });
    }
  }

  private assertSnapshotFresh(
    row: { expectedOnHand: Prisma.Decimal; expectedReserved: Prisma.Decimal },
    current: { onHand: Prisma.Decimal; reserved: Prisma.Decimal },
  ) {
    if (!row.expectedOnHand.equals(current.onHand) || !row.expectedReserved.equals(current.reserved)) {
      throw new ConflictException({
        code: 'STOCK_COUNT_SNAPSHOT_STALE',
        detail: 'Stock or reservations changed after the physical count snapshot. Record a new count.',
      });
    }
  }

  private assertEvidence(variance: Prisma.Decimal, evidence: string | null) {
    if (!variance.equals(0) && !evidence?.trim()) {
      throw new UnprocessableEntityException({
        code: 'STOCK_COUNT_VARIANCE_EVIDENCE_REQUIRED',
        detail: 'A non-zero physical variance requires inspection evidence.',
      });
    }
  }

  private assertReservations(actual: Prisma.Decimal, reserved: Prisma.Decimal) {
    if (actual.lessThan(reserved)) {
      throw new ConflictException({
        code: 'STOCK_COUNT_RESERVED_STOCK_VIOLATION',
        detail: 'Counted stock cannot fall below active reserved quantity.',
      });
    }
  }

  private assertQuantity(quantity: Prisma.Decimal) {
    if (
      !quantity.isFinite() ||
      quantity.lessThan(0) ||
      quantity.decimalPlaces() > 4 ||
      quantity.greaterThan('99999999999999.9999')
    ) {
      throw new UnprocessableEntityException({
        code: 'STOCK_COUNT_QUANTITY_INVALID',
        detail: 'Physical count quantity must be non-negative with at most four decimal places.',
      });
    }
  }

  private dimension(companyId: string, row: {
    projectId: string; warehouseId: string; materialId: string; uomId: string;
  }): StockDimension {
    return {
      companyId, projectId: row.projectId, warehouseId: row.warehouseId,
      materialId: row.materialId, uomId: row.uomId,
    };
  }

  private auditValues(row: {
    projectId: string; warehouseId: string; materialId: string; uomId: string;
    countedAt: Date; expectedOnHand: Prisma.Decimal; expectedReserved: Prisma.Decimal;
    actualQuantity: Prisma.Decimal; varianceQuantity: Prisma.Decimal; status: string; version: number;
    evidenceReference?: string | null;
  }) {
    return {
      projectId: row.projectId, warehouseId: row.warehouseId, materialId: row.materialId, uomId: row.uomId,
      countedAt: row.countedAt, expectedOnHand: row.expectedOnHand.toString(),
      expectedReserved: row.expectedReserved.toString(), actualQuantity: row.actualQuantity.toString(),
      varianceQuantity: row.varianceQuantity.toString(), evidenceRecorded: Boolean(row.evidenceReference?.trim()),
      status: row.status, version: row.version,
    };
  }
}
