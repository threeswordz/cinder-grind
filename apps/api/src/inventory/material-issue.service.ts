import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { APPROVAL_STATE, ApprovalService } from '../approval/approval.service';
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

export type IssueLineInput = {
  materialId: string;
  quantity: Prisma.Decimal;
  uomId: string;
  reservationId?: string | null;
  wbsId?: string | null;
  costCodeId?: string | null;
  activityId?: string | null;
  remarks?: string | null;
};

@Injectable()
export class MaterialIssueService {
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
        entityType: 'MATERIAL_ISSUE',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: { workflowCode: 'asc' },
    });
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.materialIssue.findMany({
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
    const row = await db.materialIssue.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        items: {
          orderBy: { lineNo: 'asc' },
          include: {
            material: { select: { materialCode: true, materialName: true } },
            uom: { select: { uomCode: true } },
            reservation: {
              select: {
                id: true,
                reservationNumber: true,
                status: true,
                quantity: true,
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
    if (!row) throw new NotFoundException({ code: 'MATERIAL_ISSUE_NOT_FOUND' });
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  async create(
    context: AuditContext,
    input: {
      projectId: string;
      warehouseId: string;
      issueDate: Date;
      issuedToEmployeeId?: string | null;
      remarks?: string | null;
      lines: IssueLineInput[];
    },
  ) {
    await this.access.assertAccess(context.auth, input.projectId);
    if (!input.lines.length || input.lines.length > 200) {
      throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_LINES_INVALID' });
    }
    input.lines.forEach((line) => this.assertQuantity(line.quantity));
    const sequence = await this.prisma.numberSequence.findFirst({
      where: {
        companyId: context.auth.companyId,
        sequenceCode: 'MATERIAL_ISSUE',
      },
    });
    if (!sequence || sequence.formatTemplate !== 'MIYYMM-###' || sequence.resetRule !== 'MONTHLY') {
      throw new ConflictException({
        code: 'MATERIAL_ISSUE_NUMBERING_REQUIRED',
        detail: 'Configure MIYYMM-### with a monthly reset.',
      });
    }
    const issueNumber = await this.numbers.next(
      context.auth.companyId,
      'MATERIAL_ISSUE',
    );
    return this.prisma.$transaction(async (tx) => {
      await this.validateHeader(
        context.auth,
        input.projectId,
        input.warehouseId,
        input.issuedToEmployeeId ?? null,
        tx,
      );
      const issue = await tx.materialIssue.create({
        data: {
          companyId: context.auth.companyId,
          projectId: input.projectId,
          warehouseId: input.warehouseId,
          issueNumber,
          issueDate: input.issueDate,
          issuedToEmployeeId: input.issuedToEmployeeId ?? null,
          remarks: input.remarks ?? null,
          createdByUserId: context.auth.userId,
        },
      });
      for (const [index, line] of input.lines.entries()) {
        await this.validateLine(context.auth, issue, line, tx);
        await tx.materialIssueItem.create({
          data: {
            materialIssueId: issue.id,
            lineNo: index + 1,
            materialId: line.materialId,
            quantity: line.quantity,
            uomId: line.uomId,
            reservationId: line.reservationId ?? null,
            wbsId: line.wbsId ?? null,
            costCodeId: line.costCodeId ?? null,
            activityId: line.activityId ?? null,
            remarks: line.remarks ?? null,
          },
        });
      }
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE',
        entityId: issue.id,
        action: 'CREATE',
        newValues: {
          issueNumber,
          projectId: issue.projectId,
          warehouseId: issue.warehouseId,
          lineCount: input.lines.length,
        },
      }, tx);
      return issue;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateDraft(
    context: AuditContext,
    id: string,
    input: {
      issueDate?: Date;
      issuedToEmployeeId?: string | null;
      remarks?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.get(context.auth, id, tx);
      if (before.submittedAt || before.postedAt || before.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_DRAFT' });
      }
      await this.validateHeader(
        context.auth,
        before.projectId,
        before.warehouseId,
        input.issuedToEmployeeId !== undefined
          ? input.issuedToEmployeeId
          : before.issuedToEmployeeId,
        tx,
      );
      const row = await tx.materialIssue.update({
        where: { id },
        data: {
          ...(input.issueDate !== undefined ? { issueDate: input.issueDate } : {}),
          ...(input.issuedToEmployeeId !== undefined
            ? { issuedToEmployeeId: input.issuedToEmployeeId }
            : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE',
        entityId: id,
        action: 'UPDATE_DRAFT',
        oldValues: {
          issueDate: before.issueDate,
          issuedToEmployeeId: before.issuedToEmployeeId,
          remarks: before.remarks,
        },
        newValues: {
          issueDate: row.issueDate,
          issuedToEmployeeId: row.issuedToEmployeeId,
          remarks: row.remarks,
        },
      }, tx);
      return row;
    });
  }

  async updateDraftLine(
    context: AuditContext,
    itemId: string,
    input: Partial<IssueLineInput>,
  ) {
    if (input.quantity) this.assertQuantity(input.quantity);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.materialIssueItem.findFirst({
        where: {
          id: itemId,
          materialIssue: { companyId: context.auth.companyId },
        },
      });
      if (!item) throw new NotFoundException({ code: 'MATERIAL_ISSUE_ITEM_NOT_FOUND' });
      const issue = await this.get(context.auth, item.materialIssueId, tx);
      if (issue.submittedAt || issue.postedAt || issue.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_DRAFT' });
      }
      const next: IssueLineInput = {
        materialId: input.materialId ?? item.materialId,
        quantity: input.quantity ?? item.quantity,
        uomId: input.uomId ?? item.uomId,
        reservationId:
          input.reservationId !== undefined ? input.reservationId : item.reservationId,
        wbsId: input.wbsId !== undefined ? input.wbsId : item.wbsId,
        costCodeId:
          input.costCodeId !== undefined ? input.costCodeId : item.costCodeId,
        activityId:
          input.activityId !== undefined ? input.activityId : item.activityId,
        remarks: input.remarks !== undefined ? input.remarks : item.remarks,
      };
      await this.validateLine(context.auth, issue, next, tx);
      const row = await tx.materialIssueItem.update({
        where: { id: itemId },
        data: {
          materialId: next.materialId,
          quantity: next.quantity,
          uomId: next.uomId,
          reservationId: next.reservationId ?? null,
          wbsId: next.wbsId ?? null,
          costCodeId: next.costCodeId ?? null,
          activityId: next.activityId ?? null,
          remarks: next.remarks ?? null,
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE_ITEM',
        entityId: itemId,
        action: 'UPDATE_DRAFT',
        oldValues: { quantity: item.quantity.toString() },
        newValues: { quantity: row.quantity.toString() },
      }, tx);
      return row;
    });
  }

  async submit(context: AuditContext, id: string, workflowCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.get(context.auth, id, tx);
      if (
        issue.submittedAt ||
        issue.postedAt ||
        issue.reversedAt ||
        !issue.items.length
      ) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_DRAFT' });
      }
      for (const line of issue.items) {
        await this.validateLine(context.auth, issue, line, tx);
      }
      const approval = await this.approvals.start({
        companyId: context.auth.companyId,
        workflowCode,
        entityType: 'MATERIAL_ISSUE',
        entityId: id,
      }, tx);
      const row = await tx.materialIssue.update({
        where: { id },
        data: {
          approvalInstanceId: approval.id,
          submittedByUserId: context.auth.userId,
          submittedAt: new Date(),
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE',
        entityId: id,
        action: 'SUBMIT',
        newValues: { approvalInstanceId: approval.id },
      }, tx);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async approve(
    context: AuditContext,
    id: string,
    postKey: string,
    comment?: string,
  ) {
    const issue = await this.get(context.auth, id);
    if (issue.postedAt && issue.postKey === postKey) return issue;
    if (
      !issue.approvalInstanceId ||
      !issue.submittedByUserId ||
      issue.postedAt ||
      issue.reversedAt
    ) {
      throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_SUBMITTED' });
    }
    await this.approvals.approve(
      issue.approvalInstanceId,
      context.auth,
      issue.createdByUserId,
      comment,
      async (tx) => {
        const current = await this.get(context.auth, id, tx);
        if (current.postedAt || current.reversedAt) {
          throw new ConflictException({ code: 'MATERIAL_ISSUE_ALREADY_POSTED' });
        }
        await this.validateHeader(
          context.auth,
          current.projectId,
          current.warehouseId,
          current.issuedToEmployeeId,
          tx,
        );
        for (const item of current.items) {
          await this.validateLine(
            context.auth,
            current,
            {
              materialId: item.materialId,
              quantity: item.quantity,
              uomId: item.uomId,
              reservationId: item.reservationId,
              wbsId: item.wbsId,
              costCodeId: item.costCodeId,
              activityId: item.activityId,
              remarks: item.remarks,
            },
            tx,
          );
        }

        const dimensions = new Map<string, StockDimension>();
        for (const item of current.items) {
          const dimension = this.dimension(current, item);
          dimensions.set(this.quantities.key(dimension), dimension);
        }
        for (const key of [...dimensions.keys()].sort()) {
          await this.quantities.lock(tx, dimensions.get(key)!);
        }
        const reservationIds = current.items
          .map((item) => item.reservationId)
          .filter((value): value is string => Boolean(value))
          .sort();
        for (const reservationId of reservationIds) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'inventory-reservation:' + reservationId,
          );
        }

        const now = new Date();
        await tx.materialIssue.update({
          where: { id },
          data: {
            postedAt: now,
            postedByUserId: context.auth.userId,
            postKey,
          },
        });

        for (const item of current.items) {
          if (item.reservationId) {
            const reservation = await tx.materialReservation.findUnique({
              where: { id: item.reservationId },
            });
            if (
              !reservation ||
              reservation.status !== 'ACTIVE' ||
              reservation.companyId !== current.companyId ||
              reservation.projectId !== current.projectId ||
              reservation.warehouseId !== current.warehouseId ||
              reservation.materialId !== item.materialId ||
              reservation.uomId !== item.uomId ||
              !reservation.quantity.equals(item.quantity)
            ) {
              throw new ConflictException({
                code: 'MATERIAL_ISSUE_RESERVATION_CHANGED',
              });
            }
          }

          const dimension = this.dimension(current, item);
          const available = await this.quantities.available(
            tx,
            dimension,
            item.reservationId ?? undefined,
          );
          if (item.quantity.greaterThan(available.available)) {
            throw new ConflictException({
              code: 'MATERIAL_ISSUE_INSUFFICIENT_AVAILABLE',
              detail: 'Issue would consume negative or stock reserved for another active Reservation.',
            });
          }

          await tx.stockTransaction.create({
            data: {
              companyId: current.companyId,
              warehouseId: current.warehouseId,
              materialId: item.materialId,
              projectId: current.projectId,
              uomId: item.uomId,
              materialIssueId: current.id,
              materialIssueItemId: item.id,
              wbsId: item.wbsId,
              costCodeId: item.costCodeId,
              activityId: item.activityId,
              movementType: 'MATERIAL_ISSUE',
              quantity: item.quantity.negated(),
              effectKey: 'material-issue:' + item.id,
              postedByUserId: context.auth.userId,
            },
          });
          if (item.reservationId) {
            await tx.materialReservation.update({
              where: { id: item.reservationId },
              data: {
                status: 'FULFILLED',
                fulfilledAt: now,
                fulfilledByUserId: context.auth.userId,
              },
            });
          }
        }

        await this.audit.record({
          ...context,
          entityType: 'MATERIAL_ISSUE',
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
    return this.prisma.$transaction(async (tx) => {
      const issue = await this.get(context.auth, id, tx);
      if (!issue.approvalInstanceId || !issue.submittedByUserId || issue.postedAt) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_SUBMITTED' });
      }
      const result = await this.approvals.reject(
        issue.approvalInstanceId,
        context.auth,
        issue.createdByUserId,
        comment,
        tx,
      );
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE',
        entityId: id,
        action: 'REJECT',
        newValues: { approvalState: result.approvalState },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
        'material-issue-reverse:' + id,
      );
      const issue = await this.get(context.auth, id, tx);
      if (issue.reversedAt && issue.reversalKey === reversalKey) return issue;
      if (!issue.postedAt || issue.reversedAt) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_NOT_REVERSIBLE' });
      }
      for (const sourceId of issue.items.map((item) => item.id).sort()) {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'inventory-return-source:' + sourceId,
        );
      }
      const outstandingReturns = await tx.materialReturnItem.count({
        where: {
          materialIssueItem: { materialIssueId: id },
          materialReturn: { postedAt: { not: null }, reversedAt: null },
        },
      });
      if (outstandingReturns) {
        throw new ConflictException({
          code: 'MATERIAL_ISSUE_HAS_OUTSTANDING_RETURN',
          detail: 'Reverse posted Material Returns before reversing their source Issue.',
        });
      }
      const originals = issue.stockTransactions.filter(
        (row) => row.movementType === 'MATERIAL_ISSUE',
      );
      if (originals.length !== issue.items.length) {
        throw new ConflictException({ code: 'MATERIAL_ISSUE_LEDGER_INCOMPLETE' });
      }
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'inventory-warehouse:' + issue.warehouseId,
      );
      const activeWarehouse = await tx.warehouse.findFirst({
        where: {
          id: issue.warehouseId,
          companyId: issue.companyId,
          isActive: true,
          OR: [{ projectId: null }, { projectId: issue.projectId }],
        },
        select: { id: true },
      });
      if (!activeWarehouse) {
        throw new ConflictException({
          code: 'MATERIAL_ISSUE_REVERSAL_WAREHOUSE_INACTIVE',
          detail: 'Reactivate the Issue Warehouse before restoring stock.',
        });
      }

      const dimensions = new Map<string, StockDimension>();
      for (const row of originals) {
        const dimension: StockDimension = {
          companyId: row.companyId,
          warehouseId: row.warehouseId,
          materialId: row.materialId,
          projectId: row.projectId!,
          uomId: row.uomId,
        };
        dimensions.set(this.quantities.key(dimension), dimension);
      }
      for (const key of [...dimensions.keys()].sort()) {
        await this.quantities.lock(tx, dimensions.get(key)!);
      }

      const at = new Date();
      await tx.materialIssue.update({
        where: { id },
        data: {
          reversedAt: at,
          reversedByUserId: context.auth.userId,
          reversalKey,
          reversalReason: reason,
        },
      });
      for (const row of originals) {
        await tx.stockTransaction.create({
          data: {
            companyId: row.companyId,
            warehouseId: row.warehouseId,
            materialId: row.materialId,
            projectId: row.projectId,
            uomId: row.uomId,
            materialIssueId: row.materialIssueId,
            materialIssueItemId: row.materialIssueItemId,
            wbsId: row.wbsId,
            costCodeId: row.costCodeId,
            activityId: row.activityId,
            movementType: 'MATERIAL_ISSUE_REVERSAL',
            quantity: row.quantity.negated(),
            effectKey: 'material-issue-reversal:' + row.id,
            reversalOfId: row.id,
            postedByUserId: context.auth.userId,
          },
        });
      }
      await this.audit.record({
        ...context,
        entityType: 'MATERIAL_ISSUE',
        entityId: id,
        action: 'REVERSE',
        newValues: { reversalKey, reason, reversedAt: at },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async validateHeader(
    auth: AuthenticatedUserContext,
    projectId: string,
    warehouseId: string,
    issuedToEmployeeId: string | null,
    db: Db,
  ) {
    await this.access.assertAccess(auth, projectId, db);
    const warehouse = await db.warehouse.findFirst({
      where: { id: warehouseId, companyId: auth.companyId, isActive: true },
    });
    if (!warehouse || (warehouse.projectId && warehouse.projectId !== projectId)) {
      throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_WAREHOUSE_INVALID' });
    }
    if (issuedToEmployeeId) {
      const employee = await db.employee.findFirst({
        where: {
          id: issuedToEmployeeId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!employee) {
        throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_EMPLOYEE_INVALID' });
      }
    }
  }

  private async validateLine(
    auth: AuthenticatedUserContext,
    issue: { projectId: string; warehouseId: string },
    line: IssueLineInput,
    db: Db,
  ) {
    this.assertQuantity(line.quantity);
    const [material, uom] = await Promise.all([
      db.material.findFirst({
        where: { id: line.materialId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      }),
      db.unitOfMeasure.findFirst({
        where: { id: line.uomId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!material || !uom) {
      throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_MATERIAL_UOM_INVALID' });
    }
    if (line.wbsId) {
      const row = await db.wbsElement.findFirst({
        where: { id: line.wbsId, projectId: issue.projectId, isActive: true },
        select: { id: true },
      });
      if (!row) throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_WBS_INVALID' });
    }
    if (line.costCodeId) {
      const row = await db.costCode.findFirst({
        where: { id: line.costCodeId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      });
      if (!row) throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_COST_CODE_INVALID' });
    }
    if (line.activityId) {
      const row = await db.activity.findFirst({
        where: { id: line.activityId, projectId: issue.projectId, isActive: true },
        select: { id: true },
      });
      if (!row) throw new UnprocessableEntityException({ code: 'MATERIAL_ISSUE_ACTIVITY_INVALID' });
    }
    if (line.reservationId) {
      const reservation = await db.materialReservation.findFirst({
        where: {
          id: line.reservationId,
          companyId: auth.companyId,
          projectId: issue.projectId,
          warehouseId: issue.warehouseId,
          materialId: line.materialId,
          uomId: line.uomId,
          status: 'ACTIVE',
        },
      });
      if (!reservation || !reservation.quantity.equals(line.quantity)) {
        throw new UnprocessableEntityException({
          code: 'MATERIAL_ISSUE_RESERVATION_INVALID',
          detail: 'Linked Reservation must be Active and fully consumed by the Issue line.',
        });
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
        code: 'MATERIAL_ISSUE_QUANTITY_INVALID',
      });
    }
  }

  private dimension(
    issue: { companyId: string; warehouseId: string; projectId: string },
    item: { materialId: string; uomId: string },
  ): StockDimension {
    return {
      companyId: issue.companyId,
      warehouseId: issue.warehouseId,
      materialId: item.materialId,
      projectId: issue.projectId,
      uomId: item.uomId,
    };
  }
}
