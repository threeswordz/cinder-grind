import { createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
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

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type FinanceDb = Prisma.TransactionClient | PrismaService;

export type SupplierInvoiceLineInput = {
  description: string;
  amount: Prisma.Decimal;
  purchaseOrderLineId?: string | null;
  goodsReceiptItemId?: string | null;
  wbsId?: string | null;
  costCodeId?: string | null;
};

export type SupplierInvoiceDraftInput = {
  supplierId: string;
  supplierReference: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  createKey: string;
  lines: SupplierInvoiceLineInput[];
};

export type SupplierInvoiceDraftUpdate = {
  supplierReference?: string;
  invoiceDate?: Date;
  dueDate?: Date | null;
};

export type SupplierInvoiceLineUpdate = Partial<SupplierInvoiceLineInput>;

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'SUPPLIER_INVOICE',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [company, suppliers, wbs, costCodes, poLines, grItems] =
      await Promise.all([
        this.prisma.company.findUniqueOrThrow({
          where: { id: auth.companyId },
          select: { baseCurrencyCode: true },
        }),
        this.prisma.supplier.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: { id: true, supplierCode: true, supplierName: true },
          orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }],
        }),
        this.prisma.wbsElement.findMany({
          where: { projectId, isActive: true },
          select: { id: true, wbsCode: true, wbsName: true },
          orderBy: { wbsCode: 'asc' },
        }),
        this.prisma.costCode.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: { id: true, costCode: true, costName: true },
          orderBy: { costCode: 'asc' },
        }),
        this.prisma.purchaseOrderLine.findMany({
          where: {
            purchaseOrder: {
              companyId: auth.companyId,
              projectId,
              cancelledAt: null,
              nextRevision: null,
              approvalInstance: { approvalState: 'APPROVED' },
            },
          },
          select: {
            id: true,
            lineNo: true,
            description: true,
            amount: true,
            purchaseOrder: {
              select: {
                id: true,
                supplierId: true,
                poNumber: true,
                revisionNo: true,
              },
            },
          },
          orderBy: [{ purchaseOrder: { poNumber: 'asc' } }, { lineNo: 'asc' }],
        }),
        this.prisma.goodsReceiptItem.findMany({
          where: {
            goodsReceipt: {
              companyId: auth.companyId,
              projectId,
              postedAt: { not: null },
              reversedAt: null,
            },
          },
          select: {
            id: true,
            lineNo: true,
            description: true,
            purchaseOrderLineId: true,
            goodsReceipt: {
              select: {
                id: true,
                supplierId: true,
                receiptNumber: true,
              },
            },
          },
          orderBy: [
            { goodsReceipt: { receiptNumber: 'asc' } },
            { lineNo: 'asc' },
          ],
        }),
      ]);
    return {
      baseCurrencyCode: company.baseCurrencyCode,
      suppliers,
      wbs,
      costCodes,
      purchaseOrderLines: poLines,
      goodsReceiptItems: grItems,
    };
  }

  async listInvoices(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.supplierInvoice.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        supplier: {
          select: { id: true, supplierCode: true, supplierName: true },
        },
        approvalInstance: { select: { approvalState: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { supplierInvoiceNumber: 'desc' }],
    });
  }

  async getInvoice(auth: AuthenticatedUserContext, invoiceId: string) {
    return this.visibleInvoice(auth, invoiceId, this.prisma);
  }

  async createInvoice(
    context: AuditContext,
    projectId: string,
    input: SupplierInvoiceDraftInput,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    if (input.lines.length === 0) {
      throw new UnprocessableEntityException({
        code: 'SUPPLIER_INVOICE_LINES_REQUIRED',
        detail: 'A Supplier Invoice requires at least one line.',
      });
    }
    this.assertDateOrder(input.invoiceDate, input.dueDate);
    const payloadHash = this.createPayloadHash(projectId, input);
    const existing = await this.prisma.supplierInvoice.findFirst({
      where: {
        companyId: context.auth.companyId,
        createdByUserId: context.auth.userId,
        createKey: input.createKey,
      },
    });
    if (existing) {
      if (existing.createPayloadHash !== payloadHash) this.throwReplayConflict();
      return this.visibleInvoice(context.auth, existing.id, this.prisma);
    }

    const [project, company] = await Promise.all([
      this.prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: context.auth.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      this.prisma.company.findUnique({
        where: { id: context.auth.companyId },
        select: { baseCurrencyCode: true },
      }),
    ]);
    if (!project || !company) throw this.notFound();
    await this.assertActiveSupplier(
      this.prisma,
      context.auth.companyId,
      input.supplierId,
    );
    for (const line of input.lines) {
      await this.assertLineReferences(
        this.prisma,
        context.auth.companyId,
        projectId,
        input.supplierId,
        line,
      );
    }

    await this.ensureInvoiceSequence(context.auth.companyId);
    const invoiceNumber = await this.numbers.next(
      context.auth.companyId,
      'SUPPLIER_INVOICE',
      input.invoiceDate,
    );
    const total = input.lines.reduce(
      (sum, line) => sum.plus(line.amount),
      new Prisma.Decimal(0),
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.access.assertAccess(context.auth, projectId, tx);
          await this.assertActiveSupplier(
            tx,
            context.auth.companyId,
            input.supplierId,
          );
          for (const line of input.lines) {
            await this.assertLineReferences(
              tx,
              context.auth.companyId,
              projectId,
              input.supplierId,
              line,
            );
          }

          const raced = await tx.supplierInvoice.findFirst({
            where: {
              companyId: context.auth.companyId,
              createdByUserId: context.auth.userId,
              createKey: input.createKey,
            },
          });
          if (raced) {
            if (raced.createPayloadHash !== payloadHash) this.throwReplayConflict();
            return this.visibleInvoice(context.auth, raced.id, tx);
          }

          const created = await tx.supplierInvoice.create({
            data: {
              companyId: context.auth.companyId,
              projectId,
              supplierId: input.supplierId,
              supplierInvoiceNumber: invoiceNumber,
              supplierReference: input.supplierReference,
              invoiceDate: input.invoiceDate,
              ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
              currencyCode: company.baseCurrencyCode,
              totalAmount: total,
              createKey: input.createKey,
              createPayloadHash: payloadHash,
              createdByUserId: context.auth.userId,
              items: {
                create: input.lines.map((line, index) => ({
                  companyId: context.auth.companyId,
                  projectId,
                  lineNo: index + 1,
                  description: line.description,
                  amount: line.amount,
                  ...(line.purchaseOrderLineId
                    ? { purchaseOrderLineId: line.purchaseOrderLineId }
                    : {}),
                  ...(line.goodsReceiptItemId
                    ? { goodsReceiptItemId: line.goodsReceiptItemId }
                    : {}),
                  ...(line.wbsId ? { wbsId: line.wbsId } : {}),
                  ...(line.costCodeId ? { costCodeId: line.costCodeId } : {}),
                })),
              },
            },
            include: this.invoiceInclude(),
          });

          await this.audit.record(
            {
              ...context,
              entityType: 'SUPPLIER_INVOICE',
              entityId: created.id,
              action: 'CREATE_DRAFT',
              newValues: {
                supplierInvoiceNumber: created.supplierInvoiceNumber,
                supplierReference: created.supplierReference,
                projectId,
                supplierId: input.supplierId,
                totalAmount: created.totalAmount.toFixed(2),
                currencyCode: created.currencyCode,
              },
            },
            tx,
          );
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.supplierInvoice.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
        });
        if (replay) {
          if (replay.createPayloadHash !== payloadHash) this.throwReplayConflict();
          return this.visibleInvoice(context.auth, replay.id, this.prisma);
        }
        throw new ConflictException({
          code: 'SUPPLIER_REFERENCE_DUPLICATE',
          detail:
            'Supplier reference must be unique for this Supplier within the Company.',
        });
      }
      throw error;
    }
  }

  async updateInvoice(
    context: AuditContext,
    invoiceId: string,
    input: SupplierInvoiceDraftUpdate,
  ) {
    this.assertDateOrder(input.invoiceDate, input.dueDate);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const visible = await this.visibleInvoice(context.auth, invoiceId, tx);
        await this.lockInvoice(context.auth.companyId, invoiceId, tx);
        const current = await tx.supplierInvoice.findFirst({
          where: { id: invoiceId, companyId: context.auth.companyId },
        });
        if (!current) throw this.notFound();
        this.assertDraft(current.state);
        const invoiceDate = input.invoiceDate ?? current.invoiceDate;
        const dueDate =
          input.dueDate === undefined ? current.dueDate : input.dueDate;
        this.assertDateOrder(invoiceDate, dueDate);
        const updated = await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: {
            ...(input.supplierReference !== undefined
              ? { supplierReference: input.supplierReference }
              : {}),
            ...(input.invoiceDate !== undefined
              ? { invoiceDate: input.invoiceDate }
              : {}),
            ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
          },
          include: this.invoiceInclude(),
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId,
            action: 'UPDATE_DRAFT',
            oldValues: {
              supplierReference: visible.supplierReference,
              invoiceDate: visible.invoiceDate,
              dueDate: visible.dueDate,
            },
            newValues: {
              supplierReference: updated.supplierReference,
              invoiceDate: updated.invoiceDate,
              dueDate: updated.dueDate,
            },
          },
          tx,
        );
        return updated;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SUPPLIER_REFERENCE_DUPLICATE',
          detail:
            'Supplier reference must be unique for this Supplier within the Company.',
        });
      }
      throw error;
    }
  }

  async addLine(
    context: AuditContext,
    invoiceId: string,
    input: SupplierInvoiceLineInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await this.visibleInvoice(context.auth, invoiceId, tx);
      await this.lockInvoice(context.auth.companyId, invoiceId, tx);
      this.assertDraft(invoice.state);
      await this.assertLineReferences(
        tx,
        invoice.companyId,
        invoice.projectId,
        invoice.supplierId,
        input,
      );
      const max = await tx.supplierInvoiceItem.aggregate({
        where: { supplierInvoiceId: invoiceId },
        _max: { lineNo: true },
      });
      const created = await tx.supplierInvoiceItem.create({
        data: {
          companyId: invoice.companyId,
          projectId: invoice.projectId,
          supplierInvoiceId: invoiceId,
          lineNo: (max._max.lineNo ?? 0) + 1,
          description: input.description,
          amount: input.amount,
          ...(input.purchaseOrderLineId
            ? { purchaseOrderLineId: input.purchaseOrderLineId }
            : {}),
          ...(input.goodsReceiptItemId
            ? { goodsReceiptItemId: input.goodsReceiptItemId }
            : {}),
          ...(input.wbsId ? { wbsId: input.wbsId } : {}),
          ...(input.costCodeId ? { costCodeId: input.costCodeId } : {}),
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUPPLIER_INVOICE',
          entityId: invoiceId,
          action: 'ADD_LINE',
          newValues: { lineId: created.id, lineNo: created.lineNo },
        },
        tx,
      );
      return this.visibleInvoice(context.auth, invoiceId, tx);
    });
  }

  async updateLine(
    context: AuditContext,
    itemId: string,
    input: SupplierInvoiceLineUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.supplierInvoiceItem.findFirst({
        where: {
          id: itemId,
          supplierInvoice: { companyId: context.auth.companyId },
        },
        include: { supplierInvoice: true },
      });
      if (!item) throw this.lineNotFound();
      await this.access.assertAccess(context.auth, item.projectId, tx);
      await this.lockInvoice(context.auth.companyId, item.supplierInvoiceId, tx);
      const invoice = await tx.supplierInvoice.findUniqueOrThrow({
        where: { id: item.supplierInvoiceId },
      });
      this.assertDraft(invoice.state);
      const merged: SupplierInvoiceLineInput = {
        description: input.description ?? item.description,
        amount: input.amount ?? item.amount,
        purchaseOrderLineId:
          input.purchaseOrderLineId === undefined
            ? item.purchaseOrderLineId
            : input.purchaseOrderLineId,
        goodsReceiptItemId:
          input.goodsReceiptItemId === undefined
            ? item.goodsReceiptItemId
            : input.goodsReceiptItemId,
        wbsId: input.wbsId === undefined ? item.wbsId : input.wbsId,
        costCodeId:
          input.costCodeId === undefined ? item.costCodeId : input.costCodeId,
      };
      await this.assertLineReferences(
        tx,
        invoice.companyId,
        invoice.projectId,
        invoice.supplierId,
        merged,
      );
      await tx.supplierInvoiceItem.update({
        where: { id: itemId },
        data: {
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.purchaseOrderLineId !== undefined
            ? { purchaseOrderLineId: input.purchaseOrderLineId }
            : {}),
          ...(input.goodsReceiptItemId !== undefined
            ? { goodsReceiptItemId: input.goodsReceiptItemId }
            : {}),
          ...(input.wbsId !== undefined ? { wbsId: input.wbsId } : {}),
          ...(input.costCodeId !== undefined
            ? { costCodeId: input.costCodeId }
            : {}),
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUPPLIER_INVOICE',
          entityId: invoice.id,
          action: 'UPDATE_LINE',
          oldValues: { lineId: item.id, amount: item.amount.toFixed(2) },
          newValues: {
            lineId: item.id,
            amount: merged.amount.toFixed(2),
          },
        },
        tx,
      );
      return this.visibleInvoice(context.auth, invoice.id, tx);
    });
  }

  async deleteLine(
    context: AuditContext,
    itemId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.supplierInvoiceItem.findFirst({
        where: {
          id: itemId,
          supplierInvoice: { companyId: context.auth.companyId },
        },
        include: { supplierInvoice: true },
      });
      if (!item) throw this.lineNotFound();
      await this.access.assertAccess(context.auth, item.projectId, tx);
      await this.lockInvoice(context.auth.companyId, item.supplierInvoiceId, tx);
      this.assertDraft(item.supplierInvoice.state);
      await tx.supplierInvoiceItem.delete({ where: { id: itemId } });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUPPLIER_INVOICE',
          entityId: item.supplierInvoiceId,
          action: 'DELETE_LINE',
          oldValues: { lineId: item.id, lineNo: item.lineNo },
        },
        tx,
      );
      return this.visibleInvoice(
        context.auth,
        item.supplierInvoiceId,
        tx,
      );
    });
  }

  async submit(
    context: AuditContext,
    invoiceId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleInvoice(context.auth, invoiceId, tx);
        await this.lockInvoice(context.auth.companyId, invoiceId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'SUPPLIER_INVOICE_SUBMIT',
            invoiceId,
            [workflowCode],
          )
        ) {
          return this.visibleInvoice(context.auth, invoiceId, tx);
        }
        const current = await tx.supplierInvoice.findUniqueOrThrow({
          where: { id: invoiceId },
          include: { items: true },
        });
        this.assertDraft(current.state);
        if (current.items.length === 0) {
          throw new UnprocessableEntityException({
            code: 'SUPPLIER_INVOICE_LINES_REQUIRED',
            detail: 'A Supplier Invoice requires at least one line before submission.',
          });
        }
        const total = current.items.reduce(
          (sum, line) => sum.plus(line.amount),
          new Prisma.Decimal(0),
        );
        if (!total.equals(current.totalAmount)) {
          throw new ConflictException({
            code: 'SUPPLIER_INVOICE_TOTAL_MISMATCH',
            detail: 'Supplier Invoice header total must equal retained line total.',
          });
        }
        for (const line of current.items) {
          await this.assertLineReferences(
            tx,
            current.companyId,
            current.projectId,
            current.supplierId,
            line,
          );
        }
        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId,
          },
          tx,
        );
        const submittedAt = new Date();
        await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: {
            state: 'SUBMITTED',
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId,
            action: 'SUBMIT',
            newValues: {
              workflowCode,
              approvalInstanceId: instance.id,
              totalAmount: current.totalAmount.toFixed(2),
            },
          },
          tx,
        );
        return this.visibleInvoice(context.auth, invoiceId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async approve(
    context: AuditContext,
    invoiceId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleInvoice(context.auth, invoiceId, tx);
        await this.lockInvoice(context.auth.companyId, invoiceId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'SUPPLIER_INVOICE_APPROVE',
            invoiceId,
            [comment ?? ''],
          )
        ) {
          return this.visibleInvoice(context.auth, invoiceId, tx);
        }
        const current = await tx.supplierInvoice.findUniqueOrThrow({
          where: { id: invoiceId },
        });
        this.assertSubmitted(current);
        await this.approvals.approve(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          async (approvalTx) => {
            const now = new Date();
            await approvalTx.supplierInvoice.update({
              where: { id: invoiceId },
              data: {
                state: 'APPROVED',
                approvedByUserId: context.auth.userId,
                approvedAt: now,
                decidedAt: now,
              },
            });
          },
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId,
            action: 'APPROVE',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return this.visibleInvoice(context.auth, invoiceId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reject(
    context: AuditContext,
    invoiceId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleInvoice(context.auth, invoiceId, tx);
        await this.lockInvoice(context.auth.companyId, invoiceId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'SUPPLIER_INVOICE_REJECT',
            invoiceId,
            [comment ?? ''],
          )
        ) {
          return this.visibleInvoice(context.auth, invoiceId, tx);
        }
        const current = await tx.supplierInvoice.findUniqueOrThrow({
          where: { id: invoiceId },
        });
        this.assertSubmitted(current);
        await this.approvals.reject(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          tx,
        );
        const now = new Date();
        await tx.supplierInvoice.update({
          where: { id: invoiceId },
          data: {
            state: 'REJECTED',
            rejectedByUserId: context.auth.userId,
            rejectedAt: now,
            decidedAt: now,
            rejectionReason: comment ?? null,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER_INVOICE',
            entityId: invoiceId,
            action: 'REJECT',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return this.visibleInvoice(context.auth, invoiceId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertLineReferences(
    db: FinanceDb,
    companyId: string,
    projectId: string,
    supplierId: string,
    line: SupplierInvoiceLineInput,
  ) {
    if (!line.description.trim()) {
      throw new UnprocessableEntityException({
        code: 'SUPPLIER_INVOICE_DESCRIPTION_REQUIRED',
        detail: 'Supplier Invoice line description is required.',
      });
    }
    if (!line.amount.isPositive()) {
      throw new UnprocessableEntityException({
        code: 'SUPPLIER_INVOICE_AMOUNT_INVALID',
        detail: 'Supplier Invoice line amount must be greater than zero.',
      });
    }
    if (line.wbsId) {
      const wbs = await db.wbsElement.findFirst({
        where: { id: line.wbsId, projectId, isActive: true },
        select: { id: true },
      });
      if (!wbs) throw this.scopeError('WBS must belong to the Supplier Invoice Project.');
    }
    if (line.costCodeId) {
      const costCode = await db.costCode.findFirst({
        where: { id: line.costCodeId, companyId, isActive: true },
        select: { id: true },
      });
      if (!costCode) throw this.scopeError('Cost Code must belong to the Supplier Invoice Company.');
    }
    let poLineId: string | null = null;
    if (line.purchaseOrderLineId) {
      const poLine = await db.purchaseOrderLine.findFirst({
        where: { id: line.purchaseOrderLineId },
        select: {
          id: true,
          purchaseOrder: {
            select: {
              companyId: true,
              projectId: true,
              supplierId: true,
              cancelledAt: true,
              nextRevision: { select: { id: true } },
              approvalInstance: { select: { approvalState: true } },
            },
          },
        },
      });
      if (
        !poLine ||
        poLine.purchaseOrder.companyId !== companyId ||
        poLine.purchaseOrder.projectId !== projectId ||
        poLine.purchaseOrder.supplierId !== supplierId ||
        poLine.purchaseOrder.cancelledAt ||
        poLine.purchaseOrder.nextRevision ||
        poLine.purchaseOrder.approvalInstance?.approvalState !== 'APPROVED'
      ) {
        throw this.scopeError(
          'PO source must be a current approved PO line for the same Company, Supplier and Project.',
        );
      }
      poLineId = poLine.id;
    }
    if (line.goodsReceiptItemId) {
      const grItem = await db.goodsReceiptItem.findFirst({
        where: { id: line.goodsReceiptItemId },
        select: {
          purchaseOrderLineId: true,
          goodsReceipt: {
            select: {
              companyId: true,
              projectId: true,
              supplierId: true,
              postedAt: true,
              reversedAt: true,
            },
          },
        },
      });
      if (
        !grItem ||
        grItem.goodsReceipt.companyId !== companyId ||
        grItem.goodsReceipt.projectId !== projectId ||
        grItem.goodsReceipt.supplierId !== supplierId ||
        !grItem.goodsReceipt.postedAt ||
        grItem.goodsReceipt.reversedAt
      ) {
        throw this.scopeError(
          'Goods Receipt source must be a posted, non-reversed item for the same Company, Supplier and Project.',
        );
      }
      if (poLineId && grItem.purchaseOrderLineId !== poLineId) {
        throw this.scopeError(
          'PO and Goods Receipt references must preserve the same source-line lineage.',
        );
      }
    }
  }

  private async assertActiveSupplier(
    db: FinanceDb,
    companyId: string,
    supplierId: string,
  ) {
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, companyId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      throw this.scopeError(
        'Supplier must be active and belong to the Supplier Invoice Company.',
      );
    }
  }

  private async visibleInvoice(
    auth: AuthenticatedUserContext,
    invoiceId: string,
    db: FinanceDb,
  ) {
    const invoice = await db.supplierInvoice.findFirst({
      where: { id: invoiceId, companyId: auth.companyId },
      include: this.invoiceInclude(),
    });
    if (!invoice) throw this.notFound();
    await this.access.assertAccess(auth, invoice.projectId, db);
    return invoice;
  }

  private invoiceInclude() {
    return {
      project: {
        select: { id: true, projectCode: true, projectName: true },
      },
      supplier: {
        select: { id: true, supplierCode: true, supplierName: true },
      },
      createdBy: { select: { id: true, displayName: true } },
      submittedBy: { select: { id: true, displayName: true } },
      approvedBy: { select: { id: true, displayName: true } },
      rejectedBy: { select: { id: true, displayName: true } },
      items: {
        orderBy: { lineNo: 'asc' as const },
        include: {
          wbs: { select: { id: true, wbsCode: true, wbsName: true } },
          costCode: { select: { id: true, costCode: true, costName: true } },
          purchaseOrderLine: {
            select: {
              id: true,
              lineNo: true,
              description: true,
              purchaseOrder: {
                select: { id: true, poNumber: true, revisionNo: true },
              },
            },
          },
          goodsReceiptItem: {
            select: {
              id: true,
              lineNo: true,
              description: true,
              goodsReceipt: {
                select: { id: true, receiptNumber: true },
              },
            },
          },
        },
      },
      approvalInstance: {
        include: {
          workflow: {
            select: { id: true, workflowCode: true, workflowName: true },
          },
          actions: {
            orderBy: { actionAt: 'asc' as const },
            include: {
              approvalStep: { select: { stepNo: true, stepName: true } },
              actionByUser: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    } satisfies Prisma.SupplierInvoiceInclude;
  }

  private async lockInvoice(
    companyId: string,
    invoiceId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "supplier_invoices"
      WHERE "id" = ${invoiceId}::uuid
        AND "company_id" = ${companyId}::uuid
      FOR UPDATE
    `);
  }

  private async ensureInvoiceSequence(companyId: string) {
    await this.prisma.numberSequence.createMany({
      data: [{
        companyId,
        entityType: 'SUPPLIER_INVOICE',
        sequenceCode: 'SUPPLIER_INVOICE',
        formatTemplate: 'SIYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      }],
      skipDuplicates: true,
    });
  }

  private async claimReplay(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    actionKey: string,
    actionType: string,
    entityId: string,
    payload: unknown[],
  ) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const key = {
      companyId_userId_actionKey: {
        companyId: auth.companyId,
        userId: auth.userId,
        actionKey,
      },
    } as const;
    const matches = (row: {
      actionType: string;
      entityType: string;
      entityId: string;
      payloadHash: string;
    }) =>
      row.actionType === actionType &&
      row.entityType === 'SUPPLIER_INVOICE' &&
      row.entityId === entityId &&
      row.payloadHash === payloadHash;

    const existing = await tx.financeActionReplay.findUnique({ where: key });
    if (existing) {
      if (!matches(existing)) this.throwReplayConflict();
      return true;
    }
    const inserted = await tx.financeActionReplay.createMany({
      data: [{
        companyId: auth.companyId,
        userId: auth.userId,
        actionKey,
        actionType,
        entityType: 'SUPPLIER_INVOICE',
        entityId,
        payloadHash,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.financeActionReplay.findUnique({ where: key });
    if (!raced || !matches(raced)) this.throwReplayConflict();
    return true;
  }

  private createPayloadHash(
    projectId: string,
    input: SupplierInvoiceDraftInput,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          projectId,
          supplierId: input.supplierId,
          supplierReference: input.supplierReference,
          invoiceDate: input.invoiceDate.toISOString().slice(0, 10),
          dueDate: input.dueDate
            ? input.dueDate.toISOString().slice(0, 10)
            : null,
          lines: input.lines.map((line) => ({
            description: line.description,
            amount: line.amount.toFixed(2),
            purchaseOrderLineId: line.purchaseOrderLineId ?? null,
            goodsReceiptItemId: line.goodsReceiptItemId ?? null,
            wbsId: line.wbsId ?? null,
            costCodeId: line.costCodeId ?? null,
          })),
        }),
      )
      .digest('hex');
  }

  private assertDateOrder(invoiceDate?: Date, dueDate?: Date | null) {
    if (invoiceDate && dueDate && dueDate.getTime() < invoiceDate.getTime()) {
      throw new UnprocessableEntityException({
        code: 'SUPPLIER_INVOICE_DATE_INVALID',
        detail: 'Due date must not be earlier than invoice date.',
      });
    }
  }

  private assertDraft(state: string) {
    if (state !== 'DRAFT') {
      throw new ConflictException({
        code: 'SUPPLIER_INVOICE_NOT_DRAFT',
        detail: 'Only a Draft Supplier Invoice can be edited or submitted.',
      });
    }
  }

  private assertSubmitted(invoice: {
    state: string;
    approvalInstanceId: string | null;
  }) {
    if (invoice.state !== 'SUBMITTED' || !invoice.approvalInstanceId) {
      throw new ConflictException({
        code: 'SUPPLIER_INVOICE_NOT_SUBMITTED',
        detail: 'This Supplier Invoice is not awaiting an approval action.',
      });
    }
  }

  private throwReplayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail:
        'This action key is already paired with a different Finance action, record, or payload.',
    });
  }

  private scopeError(detail: string) {
    return new UnprocessableEntityException({
      code: 'SUPPLIER_INVOICE_SCOPE_INVALID',
      detail,
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'SUPPLIER_INVOICE_NOT_FOUND',
      detail: 'Supplier Invoice not found.',
    });
  }

  private lineNotFound() {
    return new NotFoundException({
      code: 'SUPPLIER_INVOICE_LINE_NOT_FOUND',
      detail: 'Supplier Invoice line not found.',
    });
  }
}
