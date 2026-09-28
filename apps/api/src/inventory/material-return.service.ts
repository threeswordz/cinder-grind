import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
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

export type ReturnLineInput = {
  materialIssueItemId: string;
  quantity: Prisma.Decimal;
  remarks?: string | null;
};

@Injectable()
export class MaterialReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
    private readonly numbers: NumberSequenceService,
    private readonly quantities: InventoryQuantityService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'MATERIAL_RETURN',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: { workflowCode: 'asc' },
    });
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.materialReturn.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        approvalInstance: { select: { approvalState: true } },
        warehouse: { select: { warehouseCode: true, warehouseName: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
    const row = await db.materialReturn.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        items: {
          orderBy: { lineNo: 'asc' },
          include: {
            material: { select: { materialCode: true, materialName: true } },
            uom: { select: { uomCode: true } },
            materialIssueItem: {
              include: {
                materialIssue: {
                  select: { id: true, issueNumber: true, projectId: true },
                },
              },
            },
          },
        },
        approvalInstance: {
          include: { actions: { orderBy: { actionAt: 'asc' } } },
        },
        stockTransactions: { orderBy: { postedAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'MATERIAL_RETURN_NOT_FOUND' });
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  async eligibleIssueLines(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const items = await this.prisma.materialIssueItem.findMany({
      where: {
        materialIssue: {
          companyId: auth.companyId,
          projectId,
          postedAt: { not: null },
          reversedAt: null,
        },
      },
      include: {
        materialIssue: {
          select: { id: true, issueNumber: true, issueDate: true, warehouseId: true },
        },
        material: { select: { materialCode: true, materialName: true } },
        uom: { select: { uomCode: true } },
      },
      orderBy: [{ materialIssue: { issueDate: 'desc' } }, { lineNo: 'asc' }],
    });
    const result = [];
    for (const item of items) {
      const rows = await this.prisma.materialReturnItem.findMany({
        where: {
          materialIssueItemId: item.id,
          materialReturn: { postedAt: { not: null }, reversedAt: null },
        },
        select: { quantity: true },
      });
      const returned = rows.reduce(
        (sum, row) => sum.plus(row.quantity),
        new Prisma.Decimal(0),
      );
      const returnable = item.quantity.minus(returned);
      if (returnable.gt(0)) {
        result.push({
          ...item,
          returned: returned.toFixed(4),
          returnable: returnable.toFixed(4),
        });
      }
    }
    return result;
  }

  async create(
    context: AuditContext,
    input: {
      projectId: string;
      warehouseId: string;
      returnDate: Date;
      remarks?: string | null;
      lines: ReturnLineInput[];
    },
  ) {
    await this.access.assertAccess(context.auth, input.projectId);
    if (
      !input.lines.length ||
      input.lines.length > 200 ||
      new Set(input.lines.map((line) => line.materialIssueItemId)).size !==
        input.lines.length
    ) {
      throw new UnprocessableEntityException({ code: 'MATERIAL_RETURN_LINES_INVALID' });
    }
    input.lines.forEach((line) => this.assertQuantity(line.quantity));
    const sequence = await this.prisma.numberSequence.findFirst({
      where: {
        companyId: context.auth.companyId,
        sequenceCode: 'MATERIAL_RETURN',
      },
    });
    if (!sequence || sequence.formatTemplate !== 'MRTYYMM-###' || sequence.resetRule !== 'MONTHLY') {
      throw new ConflictException({
        code: 'MATERIAL_RETURN_NUMBERING_REQUIRED',
        detail: 'Configure MRTYYMM-### with a monthly reset.',
      });
    }
    const returnNumber = await this.numbers.next(
      context.auth.companyId,
      'MATERIAL_RETURN',
    );
    return this.prisma.$transaction(async (tx) => {
      await this.validateWarehouse(
        context.auth,
        input.projectId,
        input.warehouseId,
        tx,
      );
      const row = await tx.materialReturn.create({
        data: {
          companyId: context.auth.companyId,
          projectId: input.projectId,
          warehouseId: input.warehouseId,
          returnNumber,
          returnDate: input.returnDate,
          remarks: input.remarks ?? null,
          createdByUserId: context.auth.userId,
        },
      });
      for (const [index, line] of input.lines.entries()) {
        const source = await this.validateSource(
          context.auth,
          input.projectId,
          line.materialIssueItemId,
          line.quantity,
          tx,
        );
        await tx.materialReturnItem.create({
          data: {
            materialReturnId: row.id,
            lineNo: index + 1,
            materialIssueItemId: source.id,
            materialId: source.materialId,
            quantity: line.quantity,
            uomId: source.uomId,
            remarks: line.remarks ?? null,
          },
        });
      }
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RETURN',
        entityId: row.id,
        action: 'CREATE',
        newValues: {
          returnNumber,
          projectId: row.projectId,
          warehouseId: row.warehouseId,
          lineCount: input.lines.length,
        },
      }, tx);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateDraft(
    context: AuditContext,
    id: string,
    input: { returnDate?: Date; remarks?: string | null },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      if (before.submittedAt || before.postedAt || before.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_DRAFT' });
      }
      const row = await tx.materialReturn.update({
        where: { id },
        data: {
          ...(input.returnDate !== undefined ? { returnDate: input.returnDate } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RETURN',
        entityId: id,
        action: 'UPDATE_DRAFT',
        oldValues: { returnDate: before.returnDate, remarks: before.remarks },
        newValues: { returnDate: row.returnDate, remarks: row.remarks },
      }, tx);
      return row;
    });
  }

  async updateDraftLine(
    context: AuditContext,
    itemId: string,
    quantity: Prisma.Decimal,
  ) {
    this.assertQuantity(quantity);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.materialReturnItem.findFirst({
        where: {
          id: itemId,
          materialReturn: { companyId: context.auth.companyId },
        },
      });
      if (!item) throw new NotFoundException({ code: 'MATERIAL_RETURN_ITEM_NOT_FOUND' });
      const header = await this.get(context.auth, item.materialReturnId, tx);
      if (header.submittedAt || header.postedAt || header.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_DRAFT' });
      }
      await this.validateSource(
        context.auth,
        header.projectId,
        item.materialIssueItemId,
        quantity,
        tx,
      );
      const row = await tx.materialReturnItem.update({
        where: { id: itemId },
        data: { quantity },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RETURN_ITEM',
        entityId: itemId,
        action: 'UPDATE_DRAFT',
        oldValues: { quantity: item.quantity.toString() },
        newValues: { quantity: quantity.toString() },
      }, tx);
      return row;
    });
  }

  async submit(context: AuditContext, id: string, workflowCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.get(context.auth, id, tx);
      if (row.submittedAt || row.postedAt || row.reversedAt || !row.items.length) {
        throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_DRAFT' });
      }
      for (const item of row.items) {
        await this.validateSource(
          context.auth,
          row.projectId,
          item.materialIssueItemId,
          item.quantity,
          tx,
        );
      }
      const approval = await this.approvals.start({
        companyId: context.auth.companyId,
        workflowCode,
        entityType: 'MATERIAL_RETURN',
        entityId: id,
      }, tx);
      const updated = await tx.materialReturn.update({
        where: { id },
        data: {
          approvalInstanceId: approval.id,
          submittedByUserId: context.auth.userId,
          submittedAt: new Date(),
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RETURN',
        entityId: id,
        action: 'SUBMIT',
        newValues: { approvalInstanceId: approval.id },
      }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async approve(
    context: AuditContext,
    id: string,
    postKey: string,
    comment?: string,
  ) {
    const materialReturn = await this.get(context.auth, id);
    if (materialReturn.postedAt && materialReturn.postKey === postKey) {
      return materialReturn;
    }
    if (
      !materialReturn.approvalInstanceId ||
      !materialReturn.submittedByUserId ||
      materialReturn.postedAt ||
      materialReturn.reversedAt
    ) {
      throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_SUBMITTED' });
    }
    await this.approvals.approve(
      materialReturn.approvalInstanceId,
      context.auth,
      materialReturn.createdByUserId,
      comment,
      async (tx) => {
        const current = await this.get(context.auth, id, tx);
        if (current.postedAt || current.reversedAt) {
          throw new ConflictException({ code: 'MATERIAL_RETURN_ALREADY_POSTED' });
        }
        await this.validateWarehouse(
          context.auth,
          current.projectId,
          current.warehouseId,
          tx,
        );

        for (const sourceId of current.items
          .map((item) => item.materialIssueItemId)
          .sort()) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'inventory-return-source:' + sourceId,
          );
        }
        const dimensions = new Map<string, StockDimension>();
        for (const item of current.items) {
          const dimension: StockDimension = {
            companyId: current.companyId,
            warehouseId: current.warehouseId,
            materialId: item.materialId,
            projectId: current.projectId,
            uomId: item.uomId,
          };
          dimensions.set(this.quantities.key(dimension), dimension);
        }
        for (const key of [...dimensions.keys()].sort()) {
          await this.quantities.lock(tx, dimensions.get(key)!);
        }

        const sources = new Map<string, Awaited<ReturnType<MaterialReturnService['sourceForPosting']>>>();
        for (const item of current.items) {
          const source = await this.sourceForPosting(
            current.companyId,
            current.projectId,
            item.materialIssueItemId,
            tx,
          );
          const priorRows = await tx.materialReturnItem.findMany({
            where: {
              materialIssueItemId: item.materialIssueItemId,
              materialReturnId: { not: id },
              materialReturn: { postedAt: { not: null }, reversedAt: null },
            },
            select: { quantity: true },
          });
          const alreadyReturned = priorRows.reduce(
            (sum, row) => sum.plus(row.quantity),
            new Prisma.Decimal(0),
          );
          if (alreadyReturned.plus(item.quantity).greaterThan(source.quantity)) {
            throw new ConflictException({
              code: 'MATERIAL_RETURN_EXCEEDS_ISSUED',
              detail: 'Cumulative non-reversed returns cannot exceed the posted Issue quantity.',
            });
          }
          sources.set(item.id, source);
        }

        const now = new Date();
        await tx.materialReturn.update({
          where: { id },
          data: {
            postedAt: now,
            postedByUserId: context.auth.userId,
            postKey,
          },
        });
        for (const item of current.items) {
          const source = sources.get(item.id)!;
          await tx.stockTransaction.create({
            data: {
              companyId: current.companyId,
              warehouseId: current.warehouseId,
              materialId: item.materialId,
              projectId: current.projectId,
              uomId: item.uomId,
              materialReturnId: current.id,
              materialReturnItemId: item.id,
              wbsId: source.wbsId,
              costCodeId: source.costCodeId,
              activityId: source.activityId,
              movementType: 'MATERIAL_RETURN',
              quantity: item.quantity,
              effectKey: 'material-return:' + item.id,
              postedByUserId: context.auth.userId,
            },
          });
        }
        await this.audit.record({
          ...context,
          entityType: 'MATERIAL_RETURN',
          entityId: id,
          action: 'APPROVE_POST',
          newValues: {
            postKey,
            postedAt: now,
            lineCount: current.items.length,
          },
        }, tx);
      },
    );
    return this.get(context.auth, id);
  }

  async reject(context: AuditContext, id: string, comment?: string) {
    const row = await this.get(context.auth, id);
    if (!row.approvalInstanceId || !row.submittedByUserId || row.postedAt) {
      throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_SUBMITTED' });
    }
    const result = await this.approvals.reject(
      row.approvalInstanceId,
      context.auth,
      row.createdByUserId,
      comment,
    );
    await this.audit.record({
      ...context,
      entityType: 'MATERIAL_RETURN',
      entityId: id,
      action: 'REJECT',
      newValues: { approvalState: result.approvalState },
    });
    return this.get(context.auth, id);
  }

  async reverse(
    context: AuditContext,
    id: string,
    reversalKey: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'material-return-reverse:' + id,
      );
      const row = await this.get(context.auth, id, tx);
      if (row.reversedAt && row.reversalKey === reversalKey) return row;
      if (!row.postedAt || row.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_RETURN_NOT_REVERSIBLE' });
      }
      const originals = row.stockTransactions.filter(
        (movement) => movement.movementType === 'MATERIAL_RETURN',
      );
      if (originals.length !== row.items.length) {
        throw new ConflictException({ code: 'MATERIAL_RETURN_LEDGER_INCOMPLETE' });
      }
      const dimensions = new Map<string, StockDimension>();
      for (const movement of originals) {
        const dimension: StockDimension = {
          companyId: movement.companyId,
          warehouseId: movement.warehouseId,
          materialId: movement.materialId,
          projectId: movement.projectId!,
          uomId: movement.uomId,
        };
        dimensions.set(this.quantities.key(dimension), dimension);
      }
      for (const key of [...dimensions.keys()].sort()) {
        await this.quantities.lock(tx, dimensions.get(key)!);
      }

      for (const movement of originals) {
        const dimension: StockDimension = {
          companyId: movement.companyId,
          warehouseId: movement.warehouseId,
          materialId: movement.materialId,
          projectId: movement.projectId!,
          uomId: movement.uomId,
        };
        const available = await this.quantities.available(tx, dimension);
        if (movement.quantity.greaterThan(available.available)) {
          throw new ConflictException({
            code: 'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE',
            detail: 'Return reversal cannot create negative stock or consume stock reserved by an Active Reservation.',
          });
        }
      }

      const at = new Date();
      await tx.materialReturn.update({
        where: { id },
        data: {
          reversedAt: at,
          reversedByUserId: context.auth.userId,
          reversalKey,
          reversalReason: reason,
        },
      });
      for (const movement of originals) {
        await tx.stockTransaction.create({
          data: {
            companyId: movement.companyId,
            warehouseId: movement.warehouseId,
            materialId: movement.materialId,
            projectId: movement.projectId,
            uomId: movement.uomId,
            materialReturnId: movement.materialReturnId,
            materialReturnItemId: movement.materialReturnItemId,
            wbsId: movement.wbsId,
            costCodeId: movement.costCodeId,
            activityId: movement.activityId,
            movementType: 'MATERIAL_RETURN_REVERSAL',
            quantity: movement.quantity.negated(),
            effectKey: 'material-return-reversal:' + movement.id,
            reversalOfId: movement.id,
            postedByUserId: context.auth.userId,
          },
        });
      }
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_RETURN',
        entityId: id,
        action: 'REVERSE',
        newValues: { reversalKey, reason, reversedAt: at },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async validateWarehouse(
    auth: AuthenticatedUserContext,
    projectId: string,
    warehouseId: string,
    db: Db,
  ) {
    await this.access.assertAccess(auth, projectId, db);
    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId, isActive: true },
    });
    if (!warehouse || (warehouse.projectId && warehouse.projectId !== projectId)) {
      throw new UnprocessableEntityException({ code: 'MATERIAL_RETURN_WAREHOUSE_INVALID' });
    }
  }

  private async validateSource(
    auth: AuthenticatedUserContext,
    projectId: string,
    materialIssueItemId: string,
    quantity: Prisma.Decimal,
    db: Db,
  ) {
    this.assertQuantity(quantity);
    const source = await this.sourceForPosting(
      auth.companyId,
      projectId,
      materialIssueItemId,
      db,
    );
    const returns = await db.materialReturnItem.findMany({
      where: {
        materialIssueItemId,
        materialReturn: { postedAt: { not: null }, reversedAt: null },
      },
      select: { quantity: true },
    });
    const returned = returns.reduce(
      (sum, row) => sum.plus(row.quantity),
      new Prisma.Decimal(0),
    );
    if (returned.plus(quantity).greaterThan(source.quantity)) {
      throw new UnprocessableEntityException({
        code: 'MATERIAL_RETURN_EXCEEDS_ISSUED',
      });
    }
    return source;
  }

  private async sourceForPosting(
    companyId: string,
    projectId: string,
    materialIssueItemId: string,
    db: Db,
  ) {
    const source = await db.materialIssueItem.findFirst({
      where: {
        id: materialIssueItemId,
        materialIssue: {
          companyId,
          projectId,
          postedAt: { not: null },
          reversedAt: null,
        },
      },
      include: {
        materialIssue: { select: { id: true, issueNumber: true } },
      },
    });
    if (!source) {
      throw new UnprocessableEntityException({
        code: 'MATERIAL_RETURN_SOURCE_INVALID',
        detail: 'Return source must be a posted, non-reversed Material Issue line in the same Project.',
      });
    }
    return source;
  }

  private assertQuantity(quantity: Prisma.Decimal) {
    if (
      !quantity.isFinite() ||
      quantity.lte(0) ||
      quantity.decimalPlaces() > 4 ||
      quantity.greaterThan('99999999999999.9999')
    ) {
      throw new UnprocessableEntityException({
        code: 'MATERIAL_RETURN_QUANTITY_INVALID',
      });
    }
  }
}
