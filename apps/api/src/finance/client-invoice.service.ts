import { createHash } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type Db = Prisma.TransactionClient | PrismaService;
type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };

export type ClientInvoiceLineInput = { description: string; amount: Prisma.Decimal };
export type ClientInvoiceDraftUpdate = { invoiceDate?: Date; dueDate?: Date | null };
export type ClientInvoiceLineUpdate = Partial<ClientInvoiceLineInput>;
export type ClientInvoiceDraftInput = {
  customerId: string;
  invoiceDate: Date;
  dueDate?: Date | null;
  createKey: string;
  lines: ClientInvoiceLineInput[];
};

@Injectable()
export class ClientInvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId: auth.companyId, entityType: 'CLIENT_INVOICE', isActive: true },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [company, project, customers] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({ where: { id: auth.companyId }, select: { baseCurrencyCode: true } }),
      this.prisma.project.findFirst({
        where: { id: projectId, companyId: auth.companyId, isActive: true },
        select: { id: true },
      }),
      this.prisma.customer.findMany({
        where: { companyId: auth.companyId, isActive: true },
        select: { id: true, customerCode: true, customerName: true },
        orderBy: [{ customerName: 'asc' }, { customerCode: 'asc' }],
      }),
    ]);
    if (!project) throw this.notFound();
    return { baseCurrencyCode: company.baseCurrencyCode, customers };
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.clientInvoice.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        customer: { select: { id: true, customerCode: true, customerName: true } },
        approvalInstance: { select: { approvalState: true } },
        _count: { select: { items: true } },
      },
      orderBy: [{ invoiceDate: 'desc' }, { clientInvoiceNumber: 'desc' }],
    });
  }

  get(auth: AuthenticatedUserContext, invoiceId: string) {
    return this.visible(auth, invoiceId, this.prisma);
  }

  async accountsReceivable(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.clientInvoice.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        state: 'APPROVED',
      },
      select: {
        id: true,
        clientInvoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        currencyCode: true,
        totalAmount: true,
        customer: {
          select: { id: true, customerCode: true, customerName: true },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { invoiceDate: 'asc' }, { clientInvoiceNumber: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      allocatedAmount: new Prisma.Decimal(0),
      outstandingAmount: row.totalAmount,
    }));
  }

  async create(context: AuditContext, projectId: string, input: ClientInvoiceDraftInput) {
    await this.access.assertAccess(context.auth, projectId);
    if (!input.lines.length) throw new UnprocessableEntityException({ code: 'CLIENT_INVOICE_LINES_REQUIRED', detail: 'A Client Invoice requires at least one line.' });
    this.assertDates(input.invoiceDate, input.dueDate);
    for (const line of input.lines) this.assertLine(line);

    const hash = this.payloadHash(projectId, input);
    const replay = await this.prisma.clientInvoice.findFirst({
      where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
    });
    if (replay) {
      if (replay.createPayloadHash !== hash) this.replayConflict();
      return this.visible(context.auth, replay.id, this.prisma);
    }

    const [company, project, customer] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: context.auth.companyId }, select: { baseCurrencyCode: true } }),
      this.prisma.project.findFirst({
        where: { id: projectId, companyId: context.auth.companyId, isActive: true },
        select: { id: true },
      }),
      this.prisma.customer.findFirst({
        where: { id: input.customerId, companyId: context.auth.companyId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!company || !project || !customer) throw new UnprocessableEntityException({
      code: 'CLIENT_INVOICE_SCOPE_INVALID',
      detail: 'Client Invoice requires an active same-Company Project and Customer.',
    });

    await this.prisma.numberSequence.createMany({
      data: [{ companyId: context.auth.companyId, entityType: 'CLIENT_INVOICE', sequenceCode: 'CLIENT_INVOICE', formatTemplate: 'CIYYMM-###', resetRule: 'MONTHLY', nextValue: 1 }],
      skipDuplicates: true,
    });
    const number = await this.numbers.next(context.auth.companyId, 'CLIENT_INVOICE', input.invoiceDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await this.assertScope(tx, context.auth.companyId, projectId, input.customerId);

        const raced = await tx.clientInvoice.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (raced) {
          if (raced.createPayloadHash !== hash) this.replayConflict();
          return this.visible(context.auth, raced.id, tx);
        }

        const header = await tx.clientInvoice.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            customerId: input.customerId,
            clientInvoiceNumber: number,
            invoiceDate: input.invoiceDate,
            ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
            currencyCode: company.baseCurrencyCode,
            createKey: input.createKey,
            createPayloadHash: hash,
            createdByUserId: context.auth.userId,
          },
        });
        await tx.clientInvoiceItem.createMany({
          data: input.lines.map((line, i) => ({
            companyId: context.auth.companyId, projectId, clientInvoiceId: header.id,
            lineNo: i + 1, description: line.description.trim(), amount: line.amount,
          })),
        });
        await this.audit.record({
          ...context, entityType: 'CLIENT_INVOICE', entityId: header.id, action: 'CREATE_DRAFT',
          newValues: { clientInvoiceNumber: number, projectId, customerId: input.customerId },
        }, tx);
        return this.visible(context.auth, header.id, tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.prisma.clientInvoice.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (raced) {
          if (raced.createPayloadHash !== hash) this.replayConflict();
          return this.visible(context.auth, raced.id, this.prisma);
        }
      }
      throw error;
    }
  }

  async update(context: AuditContext, invoiceId: string, input: ClientInvoiceDraftUpdate) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.visible(context.auth, invoiceId, tx);
      await this.lock(context.auth.companyId, invoiceId, tx);
      this.assertDraft(current.state);
      const invoiceDate = input.invoiceDate ?? current.invoiceDate;
      const dueDate = input.dueDate === undefined ? current.dueDate : input.dueDate;
      this.assertDates(invoiceDate, dueDate);
      const updated = await tx.clientInvoice.update({
        where: { id: invoiceId },
        data: {
          ...(input.invoiceDate !== undefined ? { invoiceDate: input.invoiceDate } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        },
      });
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: invoiceId, action: 'UPDATE_DRAFT' }, tx);
      return this.visible(context.auth, updated.id, tx);
    });
  }

  async addLine(context: AuditContext, invoiceId: string, input: ClientInvoiceLineInput) {
    this.assertLine(input);
    return this.prisma.$transaction(async (tx) => {
      const current = await this.visible(context.auth, invoiceId, tx);
      await this.lock(context.auth.companyId, invoiceId, tx);
      this.assertDraft(current.state);
      const max = await tx.clientInvoiceItem.aggregate({ where: { clientInvoiceId: invoiceId }, _max: { lineNo: true } });
      const item = await tx.clientInvoiceItem.create({ data: {
        companyId: current.companyId, projectId: current.projectId, clientInvoiceId: invoiceId,
        lineNo: (max._max.lineNo ?? 0) + 1, description: input.description.trim(), amount: input.amount,
      }});
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: invoiceId, action: 'ADD_LINE', newValues: { lineId: item.id, lineNo: item.lineNo } }, tx);
      return this.visible(context.auth, invoiceId, tx);
    });
  }

  async updateLine(context: AuditContext, itemId: string, input: ClientInvoiceLineUpdate) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.clientInvoiceItem.findFirst({ where: { id: itemId, clientInvoice: { companyId: context.auth.companyId } }, include: { clientInvoice: true } });
      if (!item) throw this.notFound();
      await this.access.assertAccess(context.auth, item.projectId, tx);
      await this.lock(context.auth.companyId, item.clientInvoiceId, tx);
      this.assertDraft(item.clientInvoice.state);
      const merged = { description: input.description ?? item.description, amount: input.amount ?? item.amount };
      this.assertLine(merged);
      await tx.clientInvoiceItem.update({ where: { id: itemId }, data: {
        ...(input.description !== undefined ? { description: input.description.trim() } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
      }});
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: item.clientInvoiceId, action: 'UPDATE_LINE', newValues: { lineId: itemId } }, tx);
      return this.visible(context.auth, item.clientInvoiceId, tx);
    });
  }

  async deleteLine(context: AuditContext, itemId: string) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.clientInvoiceItem.findFirst({ where: { id: itemId, clientInvoice: { companyId: context.auth.companyId } }, include: { clientInvoice: true } });
      if (!item) throw this.notFound();
      await this.access.assertAccess(context.auth, item.projectId, tx);
      await this.lock(context.auth.companyId, item.clientInvoiceId, tx);
      this.assertDraft(item.clientInvoice.state);
      await tx.clientInvoiceItem.delete({ where: { id: itemId } });
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: item.clientInvoiceId, action: 'DELETE_LINE', oldValues: { lineId: itemId, lineNo: item.lineNo } }, tx);
      return this.visible(context.auth, item.clientInvoiceId, tx);
    });
  }

  async submit(context: AuditContext, invoiceId: string, workflowCode: string, actionKey: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.visible(context.auth, invoiceId, tx);
      await this.lock(context.auth.companyId, invoiceId, tx);
      if (await this.claimReplay(tx, context.auth, actionKey, 'CLIENT_INVOICE_SUBMIT', invoiceId, [workflowCode])) return this.visible(context.auth, invoiceId, tx);
      const current = await tx.clientInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
      this.assertDraft(current.state);
      if (!current.items.length) throw new UnprocessableEntityException({ code: 'CLIENT_INVOICE_LINES_REQUIRED', detail: 'A Client Invoice requires at least one line before submission.' });
      const total = current.items.reduce((sum, line) => sum.plus(line.amount), new Prisma.Decimal(0));
      if (!total.equals(current.totalAmount)) throw new ConflictException({ code: 'CLIENT_INVOICE_TOTAL_MISMATCH', detail: 'Client Invoice header total must equal retained line total.' });
      const instance = await this.approvals.start({ companyId: context.auth.companyId, workflowCode, entityType: 'CLIENT_INVOICE', entityId: invoiceId }, tx);
      await tx.clientInvoice.update({ where: { id: invoiceId }, data: { state: 'SUBMITTED', approvalInstanceId: instance.id, submittedByUserId: context.auth.userId, submittedAt: new Date() } });
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: invoiceId, action: 'SUBMIT', newValues: { workflowCode, approvalInstanceId: instance.id } }, tx);
      return this.visible(context.auth, invoiceId, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async approve(context: AuditContext, invoiceId: string, actionKey: string, comment?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.visible(context.auth, invoiceId, tx);
      await this.lock(context.auth.companyId, invoiceId, tx);
      if (await this.claimReplay(tx, context.auth, actionKey, 'CLIENT_INVOICE_APPROVE', invoiceId, [comment ?? ''])) return this.visible(context.auth, invoiceId, tx);
      const current = await tx.clientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
      this.assertSubmitted(current);
      await this.approvals.approve(current.approvalInstanceId!, context.auth, current.createdByUserId, comment, async (approvalTx) => {
        const now = new Date();
        await approvalTx.clientInvoice.update({ where: { id: invoiceId }, data: { state: 'APPROVED', approvedByUserId: context.auth.userId, approvedAt: now, decidedAt: now } });
      }, tx);
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: invoiceId, action: 'APPROVE', newValues: { comment: comment ?? null } }, tx);
      return this.visible(context.auth, invoiceId, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async reject(context: AuditContext, invoiceId: string, actionKey: string, comment?: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.visible(context.auth, invoiceId, tx);
      await this.lock(context.auth.companyId, invoiceId, tx);
      if (await this.claimReplay(tx, context.auth, actionKey, 'CLIENT_INVOICE_REJECT', invoiceId, [comment ?? ''])) return this.visible(context.auth, invoiceId, tx);
      const current = await tx.clientInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
      this.assertSubmitted(current);
      await this.approvals.reject(current.approvalInstanceId!, context.auth, current.createdByUserId, comment, tx);
      const now = new Date();
      await tx.clientInvoice.update({ where: { id: invoiceId }, data: { state: 'REJECTED', rejectedByUserId: context.auth.userId, rejectedAt: now, decidedAt: now, rejectionReason: comment ?? null } });
      await this.audit.record({ ...context, entityType: 'CLIENT_INVOICE', entityId: invoiceId, action: 'REJECT', newValues: { comment: comment ?? null } }, tx);
      return this.visible(context.auth, invoiceId, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async visible(auth: AuthenticatedUserContext, id: string, db: Db) {
    const row = await db.clientInvoice.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        customer: { select: { id: true, customerCode: true, customerName: true } },
        createdBy: { select: { id: true, displayName: true } },
        submittedBy: { select: { id: true, displayName: true } },
        approvedBy: { select: { id: true, displayName: true } },
        rejectedBy: { select: { id: true, displayName: true } },
        items: { orderBy: { lineNo: 'asc' } },
        approvalInstance: { include: { workflow: { select: { workflowCode: true, workflowName: true } }, actions: { orderBy: { actionAt: 'asc' }, include: { approvalStep: true, actionByUser: { select: { id: true, displayName: true } } } } } },
      },
    });
    if (!row) throw this.notFound();
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private async lock(companyId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "client_invoices" WHERE "id"=${id}::uuid AND "company_id"=${companyId}::uuid FOR UPDATE`);
  }

  private async claimReplay(tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, key: string, actionType: string, entityId: string, payload: unknown[]) {
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const where = { companyId_userId_actionKey: { companyId: auth.companyId, userId: auth.userId, actionKey: key } } as const;
    const matches = (r: { actionType: string; entityType: string; entityId: string; payloadHash: string }) =>
      r.actionType === actionType && r.entityType === 'CLIENT_INVOICE' && r.entityId === entityId && r.payloadHash === payloadHash;
    const existing = await tx.financeActionReplay.findUnique({ where });
    if (existing) { if (!matches(existing)) this.replayConflict(); return true; }
    const inserted = await tx.financeActionReplay.createMany({ data: [{ companyId: auth.companyId, userId: auth.userId, actionKey: key, actionType, entityType: 'CLIENT_INVOICE', entityId, payloadHash }], skipDuplicates: true });
    if (inserted.count === 1) return false;
    const raced = await tx.financeActionReplay.findUnique({ where });
    if (!raced || !matches(raced)) this.replayConflict();
    return true;
  }

  private async assertScope(db: Db, companyId: string, projectId: string, customerId: string) {
    const [project, customer] = await Promise.all([
      db.project.findFirst({ where: { id: projectId, companyId, isActive: true }, select: { id: true } }),
      db.customer.findFirst({ where: { id: customerId, companyId, isActive: true }, select: { id: true } }),
    ]);
    if (!project || !customer) {
      throw new UnprocessableEntityException({
        code: 'CLIENT_INVOICE_SCOPE_INVALID',
        detail: 'Client Invoice requires an active same-Company Project and Customer.',
      });
    }
  }

  private payloadHash(projectId: string, input: ClientInvoiceDraftInput) {
    return createHash('sha256').update(JSON.stringify({
      projectId, customerId: input.customerId, invoiceDate: input.invoiceDate.toISOString().slice(0,10),
      dueDate: input.dueDate ? input.dueDate.toISOString().slice(0,10) : null,
      lines: input.lines.map(x => ({ description: x.description.trim(), amount: x.amount.toFixed(2) })),
    })).digest('hex');
  }
  private assertLine(line: ClientInvoiceLineInput) {
    if (!line.description.trim()) throw new UnprocessableEntityException({ code: 'CLIENT_INVOICE_DESCRIPTION_REQUIRED', detail: 'Client Invoice line description is required.' });
    if (!line.amount.isPositive()) throw new UnprocessableEntityException({ code: 'CLIENT_INVOICE_AMOUNT_INVALID', detail: 'Client Invoice line amount must be greater than zero.' });
  }
  private assertDates(invoice?: Date, due?: Date | null) {
    if (invoice && due && due.getTime() < invoice.getTime()) throw new UnprocessableEntityException({ code: 'CLIENT_INVOICE_DATE_INVALID', detail: 'Due date must not be earlier than invoice date.' });
  }
  private assertDraft(state: string) {
    if (state !== 'DRAFT') throw new ConflictException({ code: 'CLIENT_INVOICE_NOT_DRAFT', detail: 'Only a Draft Client Invoice can be edited or submitted.' });
  }
  private assertSubmitted(row: { state: string; approvalInstanceId: string | null }) {
    if (row.state !== 'SUBMITTED' || !row.approvalInstanceId) throw new ConflictException({ code: 'CLIENT_INVOICE_NOT_SUBMITTED', detail: 'This Client Invoice is not awaiting an approval action.' });
  }
  private replayConflict(): never { throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED', detail: 'This action key is already paired with a different Finance action, record, or payload.' }); }
  private notFound() { return new NotFoundException({ code: 'CLIENT_INVOICE_NOT_FOUND', detail: 'Client Invoice was not found or is outside your authorized scope.' }); }
}
