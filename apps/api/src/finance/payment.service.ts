import { createHash } from 'node:crypto';

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

type Db = Prisma.TransactionClient | PrismaService;
type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };

export type PaymentDirection = 'OUTBOUND' | 'INBOUND';
export type PaymentAllocationTarget =
  | 'SUPPLIER_INVOICE'
  | 'CLIENT_INVOICE'
  | 'SUBCONTRACT_CERTIFICATION';

export type PaymentDraftInput = {
  direction: PaymentDirection;
  paymentDate: Date;
  supplierId?: string | null;
  customerId?: string | null;
  subcontractorId?: string | null;
  amount: Prisma.Decimal;
  paymentMethod?: string | null;
  reference?: string | null;
  createKey: string;
};

export type PaymentDraftUpdate = {
  paymentDate?: Date;
  amount?: Prisma.Decimal;
  paymentMethod?: string | null;
  reference?: string | null;
};

export type PaymentAllocationInput = {
  targetType: PaymentAllocationTarget;
  targetId: string;
  amount: Prisma.Decimal;
  actionKey: string;
};

@Injectable()
export class PaymentService {
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
      where: scope,
      select: { id: true, projectCode: true, projectName: true, isActive: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'PAYMENT',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [company, project, suppliers, customers, subcontractors, supplierInvoices, clientInvoices, certifications] =
      await Promise.all([
        this.prisma.company.findUniqueOrThrow({
          where: { id: auth.companyId },
          select: { baseCurrencyCode: true },
        }),
        this.prisma.project.findFirst({
          where: { id: projectId, companyId: auth.companyId, isActive: true },
          select: { id: true },
        }),
        this.prisma.supplier.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: { id: true, supplierCode: true, supplierName: true },
          orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }],
        }),
        this.prisma.customer.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: { id: true, customerCode: true, customerName: true },
          orderBy: [{ customerName: 'asc' }, { customerCode: 'asc' }],
        }),
        this.prisma.subcontractor.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: {
            id: true,
            subcontractorCode: true,
            subcontractorName: true,
            supplierId: true,
          },
          orderBy: [{ subcontractorName: 'asc' }, { subcontractorCode: 'asc' }],
        }),
        this.prisma.supplierInvoice.findMany({
          where: { companyId: auth.companyId, projectId, state: 'APPROVED' },
          select: {
            id: true,
            supplierId: true,
            supplierInvoiceNumber: true,
            supplierReference: true,
            currencyCode: true,
            totalAmount: true,
          },
          orderBy: [{ invoiceDate: 'asc' }, { supplierInvoiceNumber: 'asc' }],
        }),
        this.prisma.clientInvoice.findMany({
          where: { companyId: auth.companyId, projectId, state: 'APPROVED' },
          select: {
            id: true,
            customerId: true,
            clientInvoiceNumber: true,
            currencyCode: true,
            totalAmount: true,
          },
          orderBy: [{ invoiceDate: 'asc' }, { clientInvoiceNumber: 'asc' }],
        }),
        this.prisma.subcontractCertification.findMany({
          where: {
            companyId: auth.companyId,
            projectId,
            state: 'APPROVED',
            reversedAt: null,
            netCertifiedAmount: { not: null },
          },
          select: {
            id: true,
            certificationNumber: true,
            currencyCode: true,
            netCertifiedAmount: true,
            agreement: {
              select: {
                subcontractorId: true,
                subcontractor: {
                  select: {
                    id: true,
                    subcontractorCode: true,
                    subcontractorName: true,
                  },
                },
              },
            },
          },
          orderBy: [{ approvedAt: 'asc' }, { certificationNumber: 'asc' }],
        }),
      ]);
    if (!project) throw this.notFound();
    return {
      baseCurrencyCode: company.baseCurrencyCode,
      suppliers,
      customers,
      subcontractors,
      supplierInvoices,
      clientInvoices,
      certifications,
    };
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.payment.findMany({
      where: { companyId: auth.companyId, projectId },
      include: this.include(),
      orderBy: [{ paymentDate: 'desc' }, { paymentNumber: 'desc' }],
    });
  }

  get(auth: AuthenticatedUserContext, paymentId: string) {
    return this.visible(auth, paymentId, this.prisma);
  }

  async create(
    context: AuditContext,
    projectId: string,
    input: PaymentDraftInput,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    this.assertDirection(input.direction);
    this.assertAmount(input.amount);
    const payloadHash = this.payloadHash(projectId, input);
    const existing = await this.prisma.payment.findFirst({
      where: {
        companyId: context.auth.companyId,
        createdByUserId: context.auth.userId,
        createKey: input.createKey,
      },
    });
    if (existing) {
      if (existing.createPayloadHash !== payloadHash) this.replayConflict();
      return this.visible(context.auth, existing.id, this.prisma);
    }

    await this.ensureSequence(context.auth.companyId);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.access.assertAccess(context.auth, projectId, tx);
          const company = await tx.company.findUniqueOrThrow({
            where: { id: context.auth.companyId },
            select: { baseCurrencyCode: true },
          });
          await this.assertCounterparty(
            tx,
            context.auth.companyId,
            projectId,
            input,
          );
          const raced = await tx.payment.findFirst({
            where: {
              companyId: context.auth.companyId,
              createdByUserId: context.auth.userId,
              createKey: input.createKey,
            },
          });
          if (raced) {
            if (raced.createPayloadHash !== payloadHash) this.replayConflict();
            return this.visible(context.auth, raced.id, tx);
          }

          const paymentNumber = await this.numbers.next(
            context.auth.companyId,
            'PAYMENT',
            input.paymentDate,
            tx,
          );
          const row = await tx.payment.create({
            data: {
              companyId: context.auth.companyId,
              projectId,
              paymentNumber,
              paymentDirection: input.direction,
              paymentDate: input.paymentDate,
              ...(input.supplierId ? { supplierId: input.supplierId } : {}),
              ...(input.customerId ? { customerId: input.customerId } : {}),
              ...(input.subcontractorId
                ? { subcontractorId: input.subcontractorId }
                : {}),
              amount: input.amount,
              currencyCode: company.baseCurrencyCode,
              ...(input.paymentMethod
                ? { paymentMethod: input.paymentMethod.trim() }
                : {}),
              ...(input.reference ? { reference: input.reference.trim() } : {}),
              createKey: input.createKey,
              createPayloadHash: payloadHash,
              createdByUserId: context.auth.userId,
            },
          });
          await this.audit.record(
            {
              ...context,
              entityType: 'PAYMENT',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                paymentNumber,
                projectId,
                direction: input.direction,
                amount: input.amount.toFixed(2),
              },
            },
            tx,
          );
          return this.visible(context.auth, row.id, tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const raced = await this.prisma.payment.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
        });
        if (raced) {
          if (raced.createPayloadHash !== payloadHash) this.replayConflict();
          return this.visible(context.auth, raced.id, this.prisma);
        }
      }
      throw error;
    }
  }

  async update(
    context: AuditContext,
    paymentId: string,
    input: PaymentDraftUpdate,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertDraft(current.state);
        if (input.amount) this.assertAmount(input.amount);
        const nextDate = input.paymentDate ?? current.paymentDate;
        this.assertNumberPeriod(current.paymentNumber, nextDate);
        const allocated = await this.totalAllocated(tx, paymentId);
        const nextAmount = input.amount ?? current.amount;
        if (nextAmount.lessThan(allocated)) {
          throw new ConflictException({
            code: 'PAYMENT_AMOUNT_BELOW_ALLOCATIONS',
            detail:
              'Payment amount cannot be lower than its current Draft allocations.',
          });
        }
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            ...(input.paymentDate ? { paymentDate: input.paymentDate } : {}),
            ...(input.amount ? { amount: input.amount } : {}),
            ...(input.paymentMethod !== undefined
              ? { paymentMethod: input.paymentMethod?.trim() || null }
              : {}),
            ...(input.reference !== undefined
              ? { reference: input.reference?.trim() || null }
              : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'UPDATE_DRAFT',
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async addAllocation(
    context: AuditContext,
    paymentId: string,
    input: PaymentAllocationInput,
  ) {
    this.assertTargetType(input.targetType);
    this.assertAmount(input.amount);
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertDraft(payment.state);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            input.actionKey,
            'PAYMENT_ADD_' + input.targetType,
            paymentId,
            [input.targetId, input.amount.toFixed(2)],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }

        await this.assertTargetCapacity(
          tx,
          payment,
          input.targetType,
          input.targetId,
          input.amount,
        );
        const total = await this.totalAllocated(tx, paymentId);
        if (total.plus(input.amount).greaterThan(payment.amount)) {
          throw new ConflictException({
            code: 'PAYMENT_ALLOCATION_EXCEEDS_PAYMENT',
            detail: 'Cumulative allocations cannot exceed the Payment amount.',
          });
        }

        if (input.targetType === 'SUPPLIER_INVOICE') {
          await tx.supplierPaymentAllocation.create({
            data: {
              paymentId,
              supplierInvoiceId: input.targetId,
              allocatedAmount: input.amount,
            },
          });
        } else if (input.targetType === 'CLIENT_INVOICE') {
          await tx.clientReceiptAllocation.create({
            data: {
              paymentId,
              clientInvoiceId: input.targetId,
              allocatedAmount: input.amount,
            },
          });
        } else {
          await tx.subcontractPaymentAllocation.create({
            data: {
              paymentId,
              subcontractCertificationId: input.targetId,
              allocatedAmount: input.amount,
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'ADD_ALLOCATION',
            newValues: {
              targetType: input.targetType,
              targetId: input.targetId,
              amount: input.amount.toFixed(2),
            },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async removeAllocation(
    context: AuditContext,
    paymentId: string,
    targetType: PaymentAllocationTarget,
    allocationId: string,
    actionKey: string,
  ) {
    this.assertTargetType(targetType);
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        const payment = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertDraft(payment.state);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'PAYMENT_REMOVE_' + targetType,
            paymentId,
            [allocationId],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }

        let found = false;
        if (targetType === 'SUPPLIER_INVOICE') {
          const row = await tx.supplierPaymentAllocation.findFirst({
            where: { id: allocationId, paymentId },
          });
          if (row) {
            await tx.supplierPaymentAllocation.delete({
              where: { id: allocationId },
            });
            found = true;
          }
        } else if (targetType === 'CLIENT_INVOICE') {
          const row = await tx.clientReceiptAllocation.findFirst({
            where: { id: allocationId, paymentId },
          });
          if (row) {
            await tx.clientReceiptAllocation.delete({
              where: { id: allocationId },
            });
            found = true;
          }
        } else {
          const row = await tx.subcontractPaymentAllocation.findFirst({
            where: { id: allocationId, paymentId },
          });
          if (row) {
            await tx.subcontractPaymentAllocation.delete({
              where: { id: allocationId },
            });
            found = true;
          }
        }
        if (!found) {
          throw new NotFoundException({
            code: 'PAYMENT_ALLOCATION_NOT_FOUND',
            detail: 'Payment allocation was not found.',
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'REMOVE_ALLOCATION',
            oldValues: { targetType, allocationId },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async submit(
    context: AuditContext,
    paymentId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'PAYMENT_SUBMIT',
            paymentId,
            [workflowCode],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertDraft(current.state);
        await this.assertAllAllocationsValid(tx, current);
        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'PAYMENT',
            entityId: paymentId,
          },
          tx,
        );
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            state: 'SUBMITTED',
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'SUBMIT',
            newValues: {
              workflowCode,
              approvalInstanceId: instance.id,
            },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async approve(
    context: AuditContext,
    paymentId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'PAYMENT_APPROVE',
            paymentId,
            [comment ?? ''],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertSubmitted(current);
        await this.approvals.approve(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          async (approvalTx) => {
            const locked = await approvalTx.payment.findUniqueOrThrow({
              where: { id: paymentId },
            });
            await this.assertAllAllocationsValid(approvalTx, locked);
            const decision = await this.retainedDecisionEvidence(
              approvalTx,
              current.approvalInstanceId!,
              context.auth.userId,
              'APPROVE',
            );
            await approvalTx.payment.update({
              where: { id: paymentId },
              data: {
                state: 'APPROVED',
                approvedByUserId: decision.actionByUserId,
                approvedAt: decision.actionAt,
                decidedAt: decision.actionAt,
              },
            });
          },
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'APPROVE',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async reject(
    context: AuditContext,
    paymentId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'PAYMENT_REJECT',
            paymentId,
            [comment ?? ''],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        this.assertSubmitted(current);
        await this.approvals.reject(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          tx,
        );
        const decision = await this.retainedDecisionEvidence(
          tx,
          current.approvalInstanceId!,
          context.auth.userId,
          'REJECT',
        );
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            state: 'REJECTED',
            rejectedByUserId: decision.actionByUserId,
            rejectedAt: decision.actionAt,
            decidedAt: decision.actionAt,
            rejectionReason: decision.comment,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'REJECT',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async cancel(
    context: AuditContext,
    paymentId: string,
    actionKey: string,
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visible(context.auth, paymentId, tx);
        await this.lockPayment(context.auth.companyId, paymentId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'PAYMENT_CANCEL',
            paymentId,
            [reason],
          )
        ) {
          return this.visible(context.auth, paymentId, tx);
        }
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: paymentId },
        });
        if (current.state !== 'APPROVED') {
          throw new ConflictException({
            code: 'PAYMENT_NOT_APPROVED',
            detail: 'Only an approved Payment can be cancelled.',
          });
        }
        const now = new Date();
        await tx.payment.update({
          where: { id: paymentId },
          data: {
            state: 'CANCELLED',
            cancelledByUserId: context.auth.userId,
            cancelledAt: now,
            cancellationReason: reason.trim(),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PAYMENT',
            entityId: paymentId,
            action: 'CANCEL',
            newValues: { reason: reason.trim() },
          },
          tx,
        );
        return this.visible(context.auth, paymentId, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async assertAllAllocationsValid(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      companyId: string;
      projectId: string;
      paymentDirection: string;
      supplierId: string | null;
      customerId: string | null;
      subcontractorId: string | null;
      amount: Prisma.Decimal;
      currencyCode: string;
    },
  ) {
    const [supplier, client, subcontract] = await Promise.all([
      tx.supplierPaymentAllocation.findMany({
        where: { paymentId: payment.id },
        orderBy: { supplierInvoiceId: 'asc' },
      }),
      tx.clientReceiptAllocation.findMany({
        where: { paymentId: payment.id },
        orderBy: { clientInvoiceId: 'asc' },
      }),
      tx.subcontractPaymentAllocation.findMany({
        where: { paymentId: payment.id },
        orderBy: { subcontractCertificationId: 'asc' },
      }),
    ]);
    const allocations = [
      ...supplier.map((x) => ({
        type: 'SUPPLIER_INVOICE' as const,
        id: x.supplierInvoiceId,
        amount: x.allocatedAmount,
      })),
      ...client.map((x) => ({
        type: 'CLIENT_INVOICE' as const,
        id: x.clientInvoiceId,
        amount: x.allocatedAmount,
      })),
      ...subcontract.map((x) => ({
        type: 'SUBCONTRACT_CERTIFICATION' as const,
        id: x.subcontractCertificationId,
        amount: x.allocatedAmount,
      })),
    ].sort((a, b) => (a.type + a.id).localeCompare(b.type + b.id));

    const total = allocations.reduce(
      (sum, allocation) => sum.plus(allocation.amount),
      new Prisma.Decimal(0),
    );
    if (total.greaterThan(payment.amount)) {
      throw new ConflictException({
        code: 'PAYMENT_ALLOCATION_EXCEEDS_PAYMENT',
        detail: 'Cumulative allocations cannot exceed the Payment amount.',
      });
    }

    for (const allocation of allocations) {
      await this.assertTargetCapacity(
        tx,
        payment,
        allocation.type,
        allocation.id,
        allocation.amount,
        payment.id,
      );
    }
  }

  private async assertTargetCapacity(
    tx: Prisma.TransactionClient,
    payment: {
      id: string;
      companyId: string;
      projectId: string;
      paymentDirection: string;
      supplierId: string | null;
      customerId: string | null;
      subcontractorId: string | null;
      amount: Prisma.Decimal;
      currencyCode: string;
    },
    targetType: PaymentAllocationTarget,
    targetId: string,
    amount: Prisma.Decimal,
    currentPaymentId?: string,
  ) {
    if (targetType === 'SUPPLIER_INVOICE') {
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "supplier_invoices" WHERE "id"=$1::uuid FOR UPDATE',
        targetId,
      );
      const target = await tx.supplierInvoice.findUnique({
        where: { id: targetId },
      });
      if (
        !target ||
        target.companyId !== payment.companyId ||
        target.projectId !== payment.projectId ||
        target.state !== 'APPROVED' ||
        target.currencyCode !== payment.currencyCode ||
        payment.paymentDirection !== 'OUTBOUND' ||
        !payment.supplierId ||
        target.supplierId !== payment.supplierId
      ) {
        throw new UnprocessableEntityException({
          code: 'PAYMENT_SUPPLIER_TARGET_INVALID',
          detail:
            'Supplier allocation requires an approved same-Company, same-Project, same-Supplier invoice in base currency.',
        });
      }
      const rows = await tx.supplierPaymentAllocation.findMany({
        where: {
          supplierInvoiceId: targetId,
          payment: {
            state: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
            ...(currentPaymentId
              ? { id: { not: currentPaymentId } }
              : {}),
          },
        },
        select: { allocatedAmount: true },
      });
      const reserved = rows.reduce(
        (sum, row) => sum.plus(row.allocatedAmount),
        new Prisma.Decimal(0),
      );
      if (reserved.plus(amount).greaterThan(target.totalAmount)) {
        this.targetCeiling();
      }
      return;
    }

    if (targetType === 'CLIENT_INVOICE') {
      await tx.$queryRawUnsafe(
        'SELECT "id" FROM "client_invoices" WHERE "id"=$1::uuid FOR UPDATE',
        targetId,
      );
      const target = await tx.clientInvoice.findUnique({
        where: { id: targetId },
      });
      if (
        !target ||
        target.companyId !== payment.companyId ||
        target.projectId !== payment.projectId ||
        target.state !== 'APPROVED' ||
        target.currencyCode !== payment.currencyCode ||
        payment.paymentDirection !== 'INBOUND' ||
        !payment.customerId ||
        target.customerId !== payment.customerId
      ) {
        throw new UnprocessableEntityException({
          code: 'PAYMENT_CLIENT_TARGET_INVALID',
          detail:
            'Client allocation requires an approved same-Company, same-Project, same-Customer invoice in base currency.',
        });
      }
      const rows = await tx.clientReceiptAllocation.findMany({
        where: {
          clientInvoiceId: targetId,
          payment: {
            state: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
            ...(currentPaymentId
              ? { id: { not: currentPaymentId } }
              : {}),
          },
        },
        select: { allocatedAmount: true },
      });
      const reserved = rows.reduce(
        (sum, row) => sum.plus(row.allocatedAmount),
        new Prisma.Decimal(0),
      );
      if (reserved.plus(amount).greaterThan(target.totalAmount)) {
        this.targetCeiling();
      }
      return;
    }

    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "subcontract_certifications" WHERE "id"=$1::uuid FOR UPDATE',
      targetId,
    );
    const target = await tx.subcontractCertification.findUnique({
      where: { id: targetId },
      include: { agreement: { select: { subcontractorId: true } } },
    });
    if (
      !target ||
      target.companyId !== payment.companyId ||
      target.projectId !== payment.projectId ||
      target.state !== 'APPROVED' ||
      target.reversedAt ||
      !target.netCertifiedAmount ||
      target.currencyCode !== payment.currencyCode ||
      payment.paymentDirection !== 'OUTBOUND' ||
      !payment.subcontractorId ||
      target.agreement.subcontractorId !== payment.subcontractorId
    ) {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_SUBCONTRACT_TARGET_INVALID',
        detail:
          'Subcontract allocation requires an approved active same-Project certification for the Payment subcontractor in Company base currency.',
      });
    }
    const rows = await tx.subcontractPaymentAllocation.findMany({
      where: {
        subcontractCertificationId: targetId,
        payment: {
          state: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          ...(currentPaymentId
            ? { id: { not: currentPaymentId } }
            : {}),
        },
      },
      select: { allocatedAmount: true },
    });
    const reserved = rows.reduce(
      (sum, row) => sum.plus(row.allocatedAmount),
      new Prisma.Decimal(0),
    );
    if (reserved.plus(amount).greaterThan(target.netCertifiedAmount)) {
      this.targetCeiling();
    }
  }

  private async assertCounterparty(
    db: Db,
    companyId: string,
    projectId: string,
    input: Pick<
      PaymentDraftInput,
      'direction' | 'supplierId' | 'customerId' | 'subcontractorId'
    >,
  ) {
    const project = await db.project.findFirst({
      where: { id: projectId, companyId, isActive: true },
      select: { id: true },
    });
    if (!project) throw this.notFound();

    if (input.direction === 'INBOUND') {
      if (!input.customerId || input.supplierId || input.subcontractorId) {
        this.counterpartyInvalid();
      }
      const customer = await db.customer.findFirst({
        where: { id: input.customerId, companyId, isActive: true },
        select: { id: true },
      });
      if (!customer) this.counterpartyInvalid();
      return;
    }

    const count =
      Number(Boolean(input.supplierId)) +
      Number(Boolean(input.subcontractorId));
    if (count !== 1 || input.customerId) this.counterpartyInvalid();

    if (input.supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: input.supplierId, companyId, isActive: true },
        select: { id: true },
      });
      if (!supplier) this.counterpartyInvalid();
    } else {
      const subcontractor = await db.subcontractor.findFirst({
        where: { id: input.subcontractorId!, companyId, isActive: true },
        select: { id: true },
      });
      if (!subcontractor) this.counterpartyInvalid();
    }
  }

  private async totalAllocated(db: Db, paymentId: string) {
    const [supplier, client, subcontract] = await Promise.all([
      db.supplierPaymentAllocation.aggregate({
        where: { paymentId },
        _sum: { allocatedAmount: true },
      }),
      db.clientReceiptAllocation.aggregate({
        where: { paymentId },
        _sum: { allocatedAmount: true },
      }),
      db.subcontractPaymentAllocation.aggregate({
        where: { paymentId },
        _sum: { allocatedAmount: true },
      }),
    ]);
    return new Prisma.Decimal(0)
      .plus(supplier._sum.allocatedAmount ?? 0)
      .plus(client._sum.allocatedAmount ?? 0)
      .plus(subcontract._sum.allocatedAmount ?? 0);
  }

  private async visible(
    auth: AuthenticatedUserContext,
    paymentId: string,
    db: Db,
  ) {
    const row = await db.payment.findFirst({
      where: { id: paymentId, companyId: auth.companyId },
      include: this.include(),
    });
    if (!row) throw this.notFound();
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private include() {
    return {
      project: {
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          isActive: true,
        },
      },
      supplier: {
        select: { id: true, supplierCode: true, supplierName: true },
      },
      customer: {
        select: { id: true, customerCode: true, customerName: true },
      },
      subcontractor: {
        select: {
          id: true,
          subcontractorCode: true,
          subcontractorName: true,
        },
      },
      createdBy: { select: { id: true, displayName: true } },
      submittedBy: { select: { id: true, displayName: true } },
      approvedBy: { select: { id: true, displayName: true } },
      rejectedBy: { select: { id: true, displayName: true } },
      cancelledBy: { select: { id: true, displayName: true } },
      supplierAllocations: {
        include: {
          supplierInvoice: {
            select: {
              id: true,
              supplierInvoiceNumber: true,
              supplierReference: true,
              totalAmount: true,
              state: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      clientAllocations: {
        include: {
          clientInvoice: {
            select: {
              id: true,
              clientInvoiceNumber: true,
              totalAmount: true,
              state: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      subcontractAllocations: {
        include: {
          subcontractCertification: {
            select: {
              id: true,
              certificationNumber: true,
              netCertifiedAmount: true,
              state: true,
              reversedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      approvalInstance: {
        include: {
          workflow: {
            select: { workflowCode: true, workflowName: true },
          },
          actions: {
            orderBy: [
              { paymentDecisionOrder: 'asc' as const },
              { actionAt: 'asc' as const },
              { id: 'asc' as const },
            ],
            select: {
              id: true,
              action: true,
              actionAt: true,
              comment: true,
              actionByUser: {
                select: { id: true, displayName: true },
              },
              approvalStep: {
                select: {
                  id: true,
                  stepNo: true,
                  stepName: true,
                  requiredApprovals: true,
                },
              },
            },
          },
        },
      },
    };
  }

  private async retainedDecisionEvidence(
    tx: Prisma.TransactionClient,
    approvalInstanceId: string,
    actorUserId: string,
    action: 'APPROVE' | 'REJECT',
  ) {
    const instance = await tx.approvalInstance.findUniqueOrThrow({
      where: { id: approvalInstanceId },
      select: { approvalWorkflowId: true, currentStepNo: true },
    });
    const step = await tx.approvalStep.findFirstOrThrow({
      where: {
        approvalWorkflowId: instance.approvalWorkflowId,
        stepNo: instance.currentStepNo,
      },
      select: { id: true },
    });
    return tx.approvalAction.findFirstOrThrow({
      where: {
        approvalInstanceId,
        approvalStepId: step.id,
        action,
        actionByUserId: actorUserId,
        paymentDecisionOrder: { not: null },
      },
      orderBy: [
        { paymentDecisionOrder: 'desc' },
        { actionAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        actionByUserId: true,
        actionAt: true,
        comment: true,
      },
    });
  }

  private async lockPayment(
    companyId: string,
    paymentId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRawUnsafe(
      'SELECT "id" FROM "payments" WHERE "id"=$1::uuid AND "company_id"=$2::uuid FOR UPDATE',
      paymentId,
      companyId,
    );
  }

  private async claimReplay(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    key: string,
    actionType: string,
    entityId: string,
    payload: unknown[],
  ) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const where = {
      companyId_userId_actionKey: {
        companyId: auth.companyId,
        userId: auth.userId,
        actionKey: key,
      },
    } as const;
    const matches = (row: {
      actionType: string;
      entityType: string;
      entityId: string;
      payloadHash: string;
    }) =>
      row.actionType === actionType &&
      row.entityType === 'PAYMENT' &&
      row.entityId === entityId &&
      row.payloadHash === payloadHash;

    const existing = await tx.financeActionReplay.findUnique({ where });
    if (existing) {
      if (!matches(existing)) this.replayConflict();
      return true;
    }
    const inserted = await tx.financeActionReplay.createMany({
      data: [
        {
          companyId: auth.companyId,
          userId: auth.userId,
          actionKey: key,
          actionType,
          entityType: 'PAYMENT',
          entityId,
          payloadHash,
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.financeActionReplay.findUnique({ where });
    if (!raced || !matches(raced)) this.replayConflict();
    return true;
  }

  private payloadHash(projectId: string, input: PaymentDraftInput) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          projectId,
          direction: input.direction,
          paymentDate: input.paymentDate.toISOString().slice(0, 10),
          supplierId: input.supplierId ?? null,
          customerId: input.customerId ?? null,
          subcontractorId: input.subcontractorId ?? null,
          amount: input.amount.toFixed(2),
          paymentMethod: input.paymentMethod?.trim() || null,
          reference: input.reference?.trim() || null,
        }),
      )
      .digest('hex');
  }

  private async ensureSequence(companyId: string) {
    await this.prisma.numberSequence.createMany({
      data: [
        {
          companyId,
          entityType: 'PAYMENT',
          sequenceCode: 'PAYMENT',
          formatTemplate: 'PAYYYMM-###',
          resetRule: 'MONTHLY',
          nextValue: 1,
        },
      ],
      skipDuplicates: true,
    });
  }

  private assertDirection(value: string): asserts value is PaymentDirection {
    if (value !== 'OUTBOUND' && value !== 'INBOUND') {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_DIRECTION_INVALID',
        detail: 'Payment direction must be OUTBOUND or INBOUND.',
      });
    }
  }

  private assertTargetType(
    value: string,
  ): asserts value is PaymentAllocationTarget {
    if (
      ![
        'SUPPLIER_INVOICE',
        'CLIENT_INVOICE',
        'SUBCONTRACT_CERTIFICATION',
      ].includes(value)
    ) {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_TARGET_TYPE_INVALID',
        detail: 'Unsupported Payment allocation target type.',
      });
    }
  }

  private assertAmount(amount: Prisma.Decimal) {
    if (!amount.isPositive() || amount.decimalPlaces() > 2) {
      throw new UnprocessableEntityException({
        code: 'PAYMENT_AMOUNT_INVALID',
        detail:
          'Payment amounts must be positive with at most two decimal places.',
      });
    }
  }

  private assertNumberPeriod(paymentNumber: string, paymentDate: Date) {
    const yy = String(paymentDate.getUTCFullYear()).slice(-2);
    const mm = String(paymentDate.getUTCMonth() + 1).padStart(2, '0');
    if (!paymentNumber.startsWith('PAY' + yy + mm + '-')) {
      throw new ConflictException({
        code: 'PAYMENT_NUMBER_PERIOD_MISMATCH',
        detail:
          'Payment date must remain within the month and year encoded in the immutable Payment number.',
      });
    }
  }

  private assertDraft(state: string) {
    if (state !== 'DRAFT') {
      throw new ConflictException({
        code: 'PAYMENT_NOT_DRAFT',
        detail:
          'Only a Draft Payment can be edited, allocated, or submitted.',
      });
    }
  }

  private assertSubmitted(row: {
    state: string;
    approvalInstanceId: string | null;
  }) {
    if (row.state !== 'SUBMITTED' || !row.approvalInstanceId) {
      throw new ConflictException({
        code: 'PAYMENT_NOT_SUBMITTED',
        detail: 'This Payment is not awaiting an approval action.',
      });
    }
  }

  private counterpartyInvalid(): never {
    throw new UnprocessableEntityException({
      code: 'PAYMENT_COUNTERPARTY_INVALID',
      detail:
        'INBOUND Payments require exactly one Customer; OUTBOUND Payments require exactly one Supplier or Subcontractor.',
    });
  }

  private targetCeiling(): never {
    throw new ConflictException({
      code: 'PAYMENT_TARGET_OUTSTANDING_EXCEEDED',
      detail:
        'Cumulative active allocations cannot exceed the target outstanding approved amount.',
    });
  }

  private replayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail:
        'This action key is already paired with a different Finance action, record, or payload.',
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'PAYMENT_NOT_FOUND',
      detail:
        'Payment was not found or is outside your authorized scope.',
    });
  }
}
