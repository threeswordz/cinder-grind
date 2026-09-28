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

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };
type Db = Prisma.TransactionClient | PrismaService;
type ReceiptLineInput = { purchaseOrderLineId: string; quantity: Prisma.Decimal };

@Injectable()
export class GoodsReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
    private readonly numbers: NumberSequenceService,
  ) {}

  async eligibleOrders(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const orders = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        cancelledAt: null,
        approvalInstance: { approvalState: APPROVAL_STATE.APPROVED },
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: { revisionNo: 'desc' },
    });
    const latest = new Map<string, (typeof orders)[number]>();
    for (const order of orders) {
      if (!latest.has(order.poNumber)) latest.set(order.poNumber, order);
    }
    return [...latest.values()].map((order) => ({
      ...order,
      lines: order.lines.filter((line) => line.lineType === 'MATERIAL'),
    }));
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.goodsReceipt.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        approvalInstance: { select: { approvalState: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
    const row = await db.goodsReceipt.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        items: { orderBy: { lineNo: 'asc' } },
        approvalInstance: {
          include: {
            actions: { orderBy: { actionAt: 'asc' } },
          },
        },
        stockTransactions: { orderBy: { postedAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'RECEIPT_NOT_FOUND' });
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId: auth.companyId, entityType: 'GOODS_RECEIPT', isActive: true },
      select: { id: true, workflowCode: true, workflowName: true },
    });
  }

  async create(
    context: AuditContext,
    input: {
      projectId: string;
      purchaseOrderId: string;
      warehouseId: string;
      remarks?: string | null;
      lines: ReceiptLineInput[];
    },
  ) {
    await this.access.assertAccess(context.auth, input.projectId);
    if (!input.lines.length || new Set(input.lines.map((line) => line.purchaseOrderLineId)).size !== input.lines.length) {
      throw new UnprocessableEntityException({ code: 'RECEIPT_LINES_INVALID' });
    }
    const sequence = await this.prisma.numberSequence.findFirst({
      where: { companyId: context.auth.companyId, sequenceCode: 'GOODS_RECEIPT' },
    });
    if (!sequence || sequence.formatTemplate !== 'GRNYYMM-###' || sequence.resetRule !== 'MONTHLY') {
      throw new ConflictException({ code: 'RECEIPT_NUMBERING_REQUIRED', detail: 'Configure GRNYYMM-### with a monthly reset.' });
    }
    const receiptNumber = await this.numbers.next(context.auth.companyId, 'GOODS_RECEIPT');
    return this.prisma.$transaction(async (tx) => {
      const order = await this.currentOrder(context.auth, input.projectId, input.purchaseOrderId, tx);
      const warehouse = await tx.warehouse.findFirst({
        where: { id: input.warehouseId, companyId: context.auth.companyId, isActive: true },
      });
      if (!warehouse || (warehouse.projectId && warehouse.projectId !== input.projectId)) {
        throw new UnprocessableEntityException({ code: 'RECEIPT_WAREHOUSE_INVALID' });
      }
      const lines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: order.id, id: { in: input.lines.map((line) => line.purchaseOrderLineId) } },
      });
      if (lines.length !== input.lines.length || lines.some((line) => line.lineType !== 'MATERIAL' || !line.materialId || !line.materialCodeSnapshot)) {
        throw new UnprocessableEntityException({ code: 'RECEIPT_SOURCE_INVALID', detail: 'Only approved PO material lines are receivable.' });
      }
      const receipt = await tx.goodsReceipt.create({
        data: {
          companyId: context.auth.companyId,
          projectId: input.projectId,
          supplierId: order.supplierId,
          warehouseId: input.warehouseId,
          purchaseOrderId: order.id,
          receiptNumber,
          createdByUserId: context.auth.userId,
          remarks: input.remarks ?? null,
        },
      });
      for (const [index, selected] of input.lines.entries()) {
        if (!selected.quantity.isFinite() || selected.quantity.lte(0) || selected.quantity.decimalPlaces() > 4 || selected.quantity.greaterThan('99999999999999.9999')) {
          throw new UnprocessableEntityException({ code: 'RECEIPT_QUANTITY_INVALID' });
        }
        const source = lines.find((line) => line.id === selected.purchaseOrderLineId)!;
        await tx.goodsReceiptItem.create({
          data: {
            goodsReceiptId: receipt.id,
            lineNo: index + 1,
            purchaseOrderLineId: source.id,
            quotationAwardId: source.quotationAwardId,
            materialId: source.materialId!,
            materialCodeSnapshot: source.materialCodeSnapshot!,
            description: source.description,
            quantity: selected.quantity,
            uomId: source.uomId,
            uomCodeSnapshot: source.uomCodeSnapshot,
          },
        });
      }
      await this.audit.record({
        ...context, entityType: 'GOODS_RECEIPT', entityId: receipt.id,
        action: 'CREATE', newValues: { receiptNumber, purchaseOrderId: order.id, lineCount: input.lines.length },
      }, tx);
      return receipt;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async submit(context: AuditContext, id: string, workflowCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await this.get(context.auth, id, tx);
      if (receipt.submittedAt || receipt.postedAt || receipt.reversedAt || !receipt.items.length) {
        throw new ConflictException({ code: 'RECEIPT_NOT_DRAFT' });
      }
      await this.currentOrder(context.auth, receipt.projectId, receipt.purchaseOrderId, tx);
      const approval = await this.approvals.start({
        companyId: context.auth.companyId, workflowCode,
        entityType: 'GOODS_RECEIPT', entityId: id,
      }, tx);
      const updated = await tx.goodsReceipt.update({
        where: { id },
        data: { approvalInstanceId: approval.id, submittedByUserId: context.auth.userId, submittedAt: new Date() },
      });
      await this.audit.record({ ...context, entityType: 'GOODS_RECEIPT', entityId: id, action: 'SUBMIT', newValues: { approvalInstanceId: approval.id } }, tx);
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async approve(context: AuditContext, id: string, postKey: string, comment?: string) {
    const receipt = await this.get(context.auth, id);
    if (receipt.postedAt && receipt.postKey === postKey) return receipt;
    if (!receipt.approvalInstanceId || !receipt.submittedByUserId || receipt.postedAt || receipt.reversedAt) {
      throw new ConflictException({ code: 'RECEIPT_NOT_SUBMITTED' });
    }
    await this.approvals.approve(
      receipt.approvalInstanceId,
      context.auth,
      receipt.createdByUserId,
      comment,
      async (tx) => {
        const current = await this.get(context.auth, id, tx);
        if (current.postedAt || current.reversedAt) throw new ConflictException({ code: 'RECEIPT_ALREADY_POSTED' });
        const order = await this.currentOrder(context.auth, current.projectId, current.purchaseOrderId, tx);
        for (const awardId of [...new Set(current.items.map((item) => item.quotationAwardId))].sort()) {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${'receipt-award:' + awardId}))`;
        }
        const warehouse = await tx.warehouse.findFirst({
          where: { id: current.warehouseId, companyId: context.auth.companyId, isActive: true },
        });
        if (!warehouse || (warehouse.projectId && warehouse.projectId !== current.projectId)) {
          throw new ConflictException({ code: 'RECEIPT_WAREHOUSE_INACTIVE' });
        }
        const poLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId: order.id } });
        for (const item of current.items) {
          const source = poLines.find((line) => line.quotationAwardId === item.quotationAwardId);
          if (!source || source.lineType !== 'MATERIAL' || source.materialId !== item.materialId || source.uomId !== item.uomId) {
            throw new ConflictException({ code: 'RECEIPT_PO_SOURCE_CHANGED' });
          }
          const posted = await tx.goodsReceiptItem.findMany({
            where: {
              quotationAwardId: item.quotationAwardId,
              goodsReceipt: { postedAt: { not: null }, reversedAt: null },
            },
            select: { quantity: true },
          });
          const total = posted.reduce((sum, row) => sum.plus(row.quantity), new Prisma.Decimal(0));
          if (total.plus(item.quantity).greaterThan(source.quantity)) {
            throw new ConflictException({ code: 'RECEIPT_OVER_PO_QUANTITY' });
          }
        }
        const now = new Date();
        await tx.goodsReceipt.update({
          where: { id },
          data: { postedAt: now, postedByUserId: context.auth.userId, postKey },
        });
        for (const item of current.items) {
          await tx.stockTransaction.create({
            data: {
              companyId: current.companyId, warehouseId: current.warehouseId,
              materialId: item.materialId, projectId: current.projectId, uomId: item.uomId,
              goodsReceiptId: id, goodsReceiptItemId: item.id,
              movementType: 'GOODS_RECEIPT', quantity: item.quantity,
              effectKey: 'receipt:' + item.id,
              postedByUserId: context.auth.userId,
            },
          });
        }
        await this.audit.record({
          ...context, entityType: 'GOODS_RECEIPT', entityId: id,
          action: 'APPROVE_POST', newValues: { postKey, postedAt: now, lineCount: current.items.length },
        }, tx);
      },
    );
    return this.get(context.auth, id);
  }

  async reject(context: AuditContext, id: string, comment?: string) {
    const receipt = await this.get(context.auth, id);
    if (!receipt.approvalInstanceId || !receipt.submittedByUserId || receipt.postedAt) {
      throw new ConflictException({ code: 'RECEIPT_NOT_SUBMITTED' });
    }
    const result = await this.approvals.reject(
      receipt.approvalInstanceId, context.auth, receipt.createdByUserId, comment,
    );
    await this.audit.record({
      ...context, entityType: 'GOODS_RECEIPT', entityId: id,
      action: 'REJECT', newValues: { approvalState: result.approvalState },
    });
    return this.get(context.auth, id);
  }

  async reverse(context: AuditContext, id: string, reversalKey: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'receipt-reverse:' + id}))`;
      const receipt = await this.get(context.auth, id, tx);
      if (receipt.reversedAt && receipt.reversalKey === reversalKey) return receipt;
      if (!receipt.postedAt || receipt.reversedAt) {
        throw new ConflictException({ code: 'RECEIPT_NOT_REVERSIBLE' });
      }
      const originals = receipt.stockTransactions.filter((row) => row.movementType === 'GOODS_RECEIPT');
      if (originals.length !== receipt.items.length) throw new ConflictException({ code: 'RECEIPT_LEDGER_INCOMPLETE' });
      const at = new Date();
      await tx.goodsReceipt.update({
        where: { id }, data: {
          reversedAt: at, reversedByUserId: context.auth.userId,
          reversalKey, reversalReason: reason,
        },
      });
      for (const row of originals) {
        await tx.stockTransaction.create({
          data: {
            companyId: row.companyId, warehouseId: row.warehouseId,
            materialId: row.materialId, projectId: row.projectId,
            uomId: row.uomId, goodsReceiptId: id, goodsReceiptItemId: row.goodsReceiptItemId,
            movementType: 'GOODS_RECEIPT_REVERSAL', quantity: row.quantity.negated(),
            effectKey: 'receipt-reversal:' + row.id, reversalOfId: row.id,
            postedByUserId: context.auth.userId,
          },
        });
      }
      await this.audit.record({
        ...context, entityType: 'GOODS_RECEIPT', entityId: id,
        action: 'REVERSE', newValues: { reversalKey, reason, reversedAt: at },
      }, tx);
      return this.get(context.auth, id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async currentOrder(
    auth: AuthenticatedUserContext,
    projectId: string,
    purchaseOrderId: string,
    db: Db,
  ) {
    await this.access.assertAccess(auth, projectId, db);
    const order = await db.purchaseOrder.findFirst({
      where: {
        id: purchaseOrderId, companyId: auth.companyId, projectId,
        cancelledAt: null,
        approvalInstance: { approvalState: APPROVAL_STATE.APPROVED },
      },
    });
    if (!order) throw new ConflictException({ code: 'RECEIPT_PO_NOT_APPROVED' });
    const newer = await db.purchaseOrder.findFirst({
      where: {
        companyId: auth.companyId, poNumber: order.poNumber,
        revisionNo: { gt: order.revisionNo }, cancelledAt: null,
        approvalInstance: { approvalState: APPROVAL_STATE.APPROVED },
      },
      select: { id: true },
    });
    if (newer) throw new ConflictException({ code: 'RECEIPT_PO_NOT_CURRENT' });
    return order;
  }
}
