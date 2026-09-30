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
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type SubcontractDb = Prisma.TransactionClient | PrismaService;

export type ClaimDraftInput = {
  periodStart: Date;
  periodEnd: Date;
};

export type ClaimDraftUpdate = Partial<ClaimDraftInput>;

export type ClaimLineInput = {
  amount: string;
  workOrderId?: string | null;
};

export type ClaimLineUpdate = Partial<ClaimLineInput>;

export type ClaimAssessmentInput = {
  assessedAmount: string;
  reason: string;
  actionKey: string;
};

@Injectable()
export class SubcontractsClaimsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
  ) {}

  async claimAgreementOptions(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth, this.prisma);
    return this.prisma.subcontractAgreement.findMany({
      where: {
        companyId: auth.companyId,
        project: scope,
        approvalState: 'APPROVED',
        cancelledAt: null,
      },
      select: {
        id: true,
        agreementNumber: true,
        projectId: true,
        originalValue: true,
        currencyCode: true,
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
        subcontractor: {
          select: {
            id: true,
            subcontractorCode: true,
            subcontractorName: true,
          },
        },
      },
      orderBy: { agreementNumber: 'asc' },
    });
  }

  async claimOptions(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    const agreement = await this.visibleAgreement(
      auth,
      agreementId,
      this.prisma,
    );
    this.assertApprovedAgreement(agreement);
    const workOrders = await this.prisma.subcontractWorkOrder.findMany({
      where: {
        companyId: auth.companyId,
        agreementId,
        approvalState: 'APPROVED',
      },
      select: {
        id: true,
        workOrderNumber: true,
        amount: true,
      },
      orderBy: { sequenceNo: 'asc' },
    });
    return {
      agreement: {
        id: agreement.id,
        agreementNumber: agreement.agreementNumber,
        originalValue: agreement.originalValue,
        currencyCode: agreement.currencyCode,
      },
      workOrders,
    };
  }

  async listClaims(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    await this.visibleAgreement(auth, agreementId, this.prisma);
    const claims = await this.prisma.subcontractClaim.findMany({
      where: { companyId: auth.companyId, agreementId },
      include: this.claimInclude(),
      orderBy: [{ periodStart: 'desc' }, { claimNumber: 'desc' }],
    });
    return claims.map((claim) => this.claimForRead(auth, claim));
  }

  async getClaim(auth: AuthenticatedUserContext, claimId: string) {
    const claim = await this.visibleClaim(auth, claimId, this.prisma);
    return this.claimForRead(auth, claim);
  }

  async createClaim(
    context: AuditContext,
    agreementId: string,
    input: ClaimDraftInput,
  ) {
    this.assertPeriod(input.periodStart, input.periodEnd);
    const visible = await this.visibleAgreement(
      context.auth,
      agreementId,
      this.prisma,
    );
    this.assertApprovedAgreement(visible);
    await this.ensureClaimSequence(context.auth.companyId);
    const claimNumber = await this.numbers.next(
      context.auth.companyId,
      'SUBCONTRACT_CLAIM',
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.visibleAgreement(context.auth, agreementId, tx);
          await this.lockAgreement(context.auth.companyId, agreementId, tx);
          const agreement = await this.agreementById(
            context.auth.companyId,
            agreementId,
            tx,
          );
          this.assertApprovedAgreement(agreement);

          const row = await tx.subcontractClaim.create({
            data: {
              companyId: agreement.companyId,
              projectId: agreement.projectId,
              agreementId: agreement.id,
              claimNumber,
              periodStart: input.periodStart,
              periodEnd: input.periodEnd,
              currencyCode: agreement.currencyCode,
              createdByUserId: context.auth.userId,
            },
            include: this.claimInclude(),
          });

          await this.audit.record(
            {
              ...context,
              entityType: 'SUBCONTRACT_CLAIM',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                agreementId,
                claimNumber,
                periodStart: input.periodStart,
                periodEnd: input.periodEnd,
                currencyCode: agreement.currencyCode,
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      this.throwClaimUnique(error);
      throw error;
    }
  }

  async createReplacement(
    context: AuditContext,
    sourceClaimId: string,
  ) {
    const source = await this.visibleClaim(
      context.auth,
      sourceClaimId,
      this.prisma,
    );
    if (!['WITHDRAWN', 'REJECTED'].includes(source.state)) {
      throw new ConflictException({
        code: 'CLAIM_NOT_REPLACEABLE',
        detail: 'Only a withdrawn or rejected Claim can be replaced.',
      });
    }
    await this.ensureClaimSequence(context.auth.companyId);
    const claimNumber = await this.numbers.next(
      context.auth.companyId,
      'SUBCONTRACT_CLAIM',
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.lockAgreement(
            context.auth.companyId,
            source.agreementId,
            tx,
          );
          await this.lockClaims(
            context.auth.companyId,
            [sourceClaimId],
            tx,
          );
          const current = await this.claimById(
            context.auth.companyId,
            sourceClaimId,
            tx,
          );
          if (!['WITHDRAWN', 'REJECTED'].includes(current.state)) {
            throw new ConflictException({
              code: 'CLAIM_NOT_REPLACEABLE',
              detail: 'Only a withdrawn or rejected Claim can be replaced.',
            });
          }
          const agreement = await this.agreementById(
            context.auth.companyId,
            current.agreementId,
            tx,
          );
          this.assertApprovedAgreement(agreement);

          const row = await tx.subcontractClaim.create({
            data: {
              companyId: current.companyId,
              projectId: current.projectId,
              agreementId: current.agreementId,
              claimNumber,
              periodStart: current.periodStart,
              periodEnd: current.periodEnd,
              currencyCode: current.currencyCode,
              replacementForClaimId: current.id,
              createdByUserId: context.auth.userId,
            },
            include: this.claimInclude(),
          });

          await this.audit.record(
            {
              ...context,
              entityType: 'SUBCONTRACT_CLAIM',
              entityId: row.id,
              action: 'CREATE_REPLACEMENT_DRAFT',
              newValues: {
                replacementForClaimId: current.id,
                claimNumber,
                periodStart: current.periodStart,
                periodEnd: current.periodEnd,
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      this.throwClaimUnique(error);
      throw error;
    }
  }

  async updateClaim(
    context: AuditContext,
    claimId: string,
    input: ClaimDraftUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleClaim(context.auth, claimId, tx);
      await this.lockClaims(context.auth.companyId, [claimId], tx);
      const current = await this.claimById(
        context.auth.companyId,
        claimId,
        tx,
      );
      if (current.state !== 'DRAFT') {
        throw new ConflictException({
          code: 'CLAIM_NOT_DRAFT',
          detail: 'Only a Draft Claim can be edited.',
        });
      }
      const periodStart = input.periodStart ?? current.periodStart;
      const periodEnd = input.periodEnd ?? current.periodEnd;
      this.assertPeriod(periodStart, periodEnd);

      try {
        const updated = await tx.subcontractClaim.update({
          where: { id: claimId },
          data: {
            ...(input.periodStart ? { periodStart: input.periodStart } : {}),
            ...(input.periodEnd ? { periodEnd: input.periodEnd } : {}),
          },
          include: this.claimInclude(),
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM',
            entityId: claimId,
            action: 'UPDATE_DRAFT',
            oldValues: {
              periodStart: visible.periodStart,
              periodEnd: visible.periodEnd,
            },
            newValues: {
              periodStart: updated.periodStart,
              periodEnd: updated.periodEnd,
            },
          },
          tx,
        );
        return updated;
      } catch (error) {
        this.throwClaimUnique(error);
        throw error;
      }
    });
  }

  async addLine(
    context: AuditContext,
    claimId: string,
    input: ClaimLineInput,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleClaim(context.auth, claimId, tx);
        await this.lockClaims(context.auth.companyId, [claimId], tx);
        const claim = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        this.assertDraftClaim(claim);
        await this.assertLineWorkOrder(
          context.auth.companyId,
          claim,
          input.workOrderId ?? null,
          tx,
        );
        const latest = await tx.subcontractClaimLine.aggregate({
          where: { claimId },
          _max: { lineNo: true },
        });
        const lineNo = (latest._max.lineNo ?? 0) + 1;
        const row = await tx.subcontractClaimLine.create({
          data: {
            companyId: claim.companyId,
            projectId: claim.projectId,
            agreementId: claim.agreementId,
            claimId: claim.id,
            lineNo,
            workOrderId: input.workOrderId ?? null,
            amount: input.amount,
          },
          include: {
            workOrder: {
              select: {
                id: true,
                workOrderNumber: true,
                amount: true,
                approvalState: true,
              },
            },
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM_LINE',
            entityId: row.id,
            action: 'CREATE_DRAFT_LINE',
            newValues: {
              claimId,
              lineNo,
              amount: row.amount.toString(),
              workOrderId: row.workOrderId,
            },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateLine(
    context: AuditContext,
    lineId: string,
    input: ClaimLineUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleLine(context.auth, lineId, tx);
      await this.lockClaims(
        context.auth.companyId,
        [visible.claimId],
        tx,
      );
      const claim = await this.claimById(
        context.auth.companyId,
        visible.claimId,
        tx,
      );
      this.assertDraftClaim(claim);
      const current = await tx.subcontractClaimLine.findFirstOrThrow({
        where: { id: lineId, companyId: context.auth.companyId },
      });
      const workOrderId =
        input.workOrderId === undefined
          ? current.workOrderId
          : input.workOrderId;
      await this.assertLineWorkOrder(
        context.auth.companyId,
        claim,
        workOrderId,
        tx,
      );
      const updated = await tx.subcontractClaimLine.update({
        where: { id: lineId },
        data: {
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.workOrderId !== undefined
            ? { workOrderId: input.workOrderId }
            : {}),
        },
        include: {
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              amount: true,
              approvalState: true,
            },
          },
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_CLAIM_LINE',
          entityId: lineId,
          action: 'UPDATE_DRAFT_LINE',
          oldValues: {
            amount: current.amount.toString(),
            workOrderId: current.workOrderId,
          },
          newValues: {
            amount: updated.amount.toString(),
            workOrderId: updated.workOrderId,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async deleteLine(context: AuditContext, lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleLine(context.auth, lineId, tx);
      await this.lockClaims(
        context.auth.companyId,
        [visible.claimId],
        tx,
      );
      const claim = await this.claimById(
        context.auth.companyId,
        visible.claimId,
        tx,
      );
      this.assertDraftClaim(claim);
      const deleted = await tx.subcontractClaimLine.delete({
        where: { id: lineId },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_CLAIM_LINE',
          entityId: lineId,
          action: 'DELETE_DRAFT_LINE',
          oldValues: {
            claimId: deleted.claimId,
            lineNo: deleted.lineNo,
            amount: deleted.amount.toString(),
            workOrderId: deleted.workOrderId,
          },
        },
        tx,
      );
      return { id: deleted.id };
    });
  }

  async submitClaim(
    context: AuditContext,
    claimId: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleClaim(context.auth, claimId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        const first = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        const claimIds = [
          first.id,
          ...(first.replacementForClaimId
            ? [first.replacementForClaimId]
            : []),
        ];
        await this.lockClaims(context.auth.companyId, claimIds, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CLAIM_SUBMIT',
          'SUBCONTRACT_CLAIM',
          claimId,
          [],
        );
        if (replay) {
          const current = await this.visibleClaim(context.auth, claimId, tx);
          return this.claimForRead(context.auth, current);
        }

        const claim = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        this.assertDraftClaim(claim);
        const agreement = await this.agreementById(
          context.auth.companyId,
          claim.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        const lines = await tx.subcontractClaimLine.findMany({
          where: { claimId: claim.id },
          orderBy: { lineNo: 'asc' },
        });
        if (lines.length === 0) {
          throw new UnprocessableEntityException({
            code: 'CLAIM_LINES_REQUIRED',
            detail: 'A Progress Claim requires at least one positive line.',
          });
        }
        await this.assertSubmissionWorkOrders(
          context.auth.companyId,
          claim.agreementId,
          lines,
          tx,
        );

        const claimTotal = lines.reduce(
          (sum, line) => sum.plus(line.amount),
          new Prisma.Decimal(0),
        );
        const existing = await tx.subcontractClaimLine.aggregate({
          where: {
            agreementId: claim.agreementId,
            claim: { state: { in: ['SUBMITTED', 'ASSESSED'] } },
          },
          _sum: { amount: true },
        });
        const existingTotal = existing._sum.amount ?? new Prisma.Decimal(0);
        const ceiling = agreement.originalValue;
        if (existingTotal.plus(claimTotal).gt(ceiling)) {
          throw new ConflictException({
            code: 'CLAIM_AGREEMENT_CEILING_EXCEEDED',
            detail:
              'Submitting this Claim would exceed the current approved agreement ceiling.',
          });
        }

        const grouped = new Map<string, Prisma.Decimal>();
        for (const line of lines) {
          if (!line.workOrderId) continue;
          grouped.set(
            line.workOrderId,
            (grouped.get(line.workOrderId) ?? new Prisma.Decimal(0)).plus(
              line.amount,
            ),
          );
        }
        for (const [workOrderId, currentAmount] of grouped) {
          const workOrder = await tx.subcontractWorkOrder.findFirst({
            where: {
              id: workOrderId,
              companyId: context.auth.companyId,
              agreementId: claim.agreementId,
              approvalState: 'APPROVED',
            },
            select: { id: true, amount: true, workOrderNumber: true },
          });
          if (!workOrder) {
            throw new ConflictException({
              code: 'CLAIM_WORK_ORDER_NOT_APPROVED',
              detail: 'Claim lines may reference only active approved Work Orders from the same agreement.',
            });
          }
          const prior = await tx.subcontractClaimLine.aggregate({
            where: {
              workOrderId,
              claim: { state: { in: ['SUBMITTED', 'ASSESSED'] } },
            },
            _sum: { amount: true },
          });
          const priorAmount = prior._sum.amount ?? new Prisma.Decimal(0);
          if (priorAmount.plus(currentAmount).gt(workOrder.amount)) {
            throw new ConflictException({
              code: 'CLAIM_WORK_ORDER_CEILING_EXCEEDED',
              detail:
                'Submitting this Claim would exceed approved Work Order ' +
                workOrder.workOrderNumber +
                '.',
            });
          }
        }

        if (claim.replacementForClaimId) {
          const source = await this.claimById(
            context.auth.companyId,
            claim.replacementForClaimId,
            tx,
          );
          if (
            source.agreementId !== claim.agreementId ||
            !['WITHDRAWN', 'REJECTED'].includes(source.state)
          ) {
            throw new ConflictException({
              code: 'CLAIM_REPLACEMENT_SOURCE_INVALID',
              detail:
                'A replacement Claim requires a retained withdrawn or rejected Claim from the same agreement.',
            });
          }
          await tx.subcontractClaim.update({
            where: { id: source.id },
            data: { state: 'REPLACED', replacedAt: new Date() },
          });
        }

        const submittedAt = new Date();
        await tx.subcontractClaim.update({
          where: { id: claim.id },
          data: {
            state: 'SUBMITTED',
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM',
            entityId: claim.id,
            action: 'SUBMIT',
            newValues: {
              claimNumber: claim.claimNumber,
              claimTotal: claimTotal.toFixed(2),
              submittedAt,
              replacementForClaimId: claim.replacementForClaimId,
            },
          },
          tx,
        );
        return this.visibleClaim(context.auth, claim.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async withdrawClaim(
    context: AuditContext,
    claimId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleClaim(context.auth, claimId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaims(context.auth.companyId, [claimId], tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CLAIM_WITHDRAW',
          'SUBCONTRACT_CLAIM',
          claimId,
          [reason],
        );
        if (replay) return this.visibleClaim(context.auth, claimId, tx);

        const claim = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        if (claim.state !== 'SUBMITTED') {
          throw new ConflictException({
            code: 'CLAIM_NOT_WITHDRAWABLE',
            detail: 'Only a submitted Claim can be withdrawn before assessment.',
          });
        }
        const assessment = await tx.subcontractClaimAssessment.findFirst({
          where: { claimId, companyId: context.auth.companyId },
          select: { id: true },
        });
        if (assessment) {
          throw new ConflictException({
            code: 'CLAIM_ALREADY_ASSESSED',
            detail: 'An assessed Claim must follow the assessment rejection and replacement path.',
          });
        }

        const withdrawnAt = new Date();
        await tx.subcontractClaim.update({
          where: { id: claim.id },
          data: {
            state: 'WITHDRAWN',
            withdrawnByUserId: context.auth.userId,
            withdrawnAt,
            withdrawalReason: reason,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM',
            entityId: claim.id,
            action: 'WITHDRAW',
            oldValues: { state: claim.state },
            newValues: { state: 'WITHDRAWN', reason, withdrawnAt },
          },
          tx,
        );
        return this.visibleClaim(context.auth, claim.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async assessClaim(
    context: AuditContext,
    claimId: string,
    input: ClaimAssessmentInput,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleClaim(context.auth, claimId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaims(context.auth.companyId, [claimId], tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          input.actionKey,
          'CLAIM_ASSESS',
          'SUBCONTRACT_CLAIM',
          claimId,
          [new Prisma.Decimal(input.assessedAmount).toFixed(2), input.reason],
        );
        if (replay) return this.visibleClaim(context.auth, claimId, tx);

        const claim = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        if (claim.state !== 'SUBMITTED') {
          throw new ConflictException({
            code: 'CLAIM_NOT_SUBMITTED',
            detail: 'Only a submitted Claim can be assessed.',
          });
        }
        const agreement = await this.agreementById(
          context.auth.companyId,
          claim.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);

        const total = await tx.subcontractClaimLine.aggregate({
          where: { claimId },
          _sum: { amount: true },
        });
        const claimTotal = total._sum.amount ?? new Prisma.Decimal(0);
        const assessedAmount = new Prisma.Decimal(input.assessedAmount);
        if (assessedAmount.gt(claimTotal)) {
          throw new UnprocessableEntityException({
            code: 'ASSESSMENT_EXCEEDS_CLAIM',
            detail: 'Assessed amount cannot exceed the submitted claimed amount.',
          });
        }

        const assessedAt = new Date();
        const assessment = await tx.subcontractClaimAssessment.create({
          data: {
            companyId: claim.companyId,
            projectId: claim.projectId,
            agreementId: claim.agreementId,
            claimId: claim.id,
            assessedAmount,
            reason: input.reason,
            assessedByUserId: context.auth.userId,
            assessedAt,
          },
        });
        await tx.subcontractClaim.update({
          where: { id: claim.id },
          data: { state: 'ASSESSED' },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM_ASSESSMENT',
            entityId: assessment.id,
            action: 'ASSESS',
            newValues: {
              claimId: claim.id,
              claimedAmount: claimTotal.toFixed(2),
              assessedAmount: assessedAmount.toFixed(2),
              reason: input.reason,
              assessedAt,
            },
          },
          tx,
        );
        return this.visibleClaim(context.auth, claim.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async rejectAssessment(
    context: AuditContext,
    claimId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleClaim(context.auth, claimId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaims(context.auth.companyId, [claimId], tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CLAIM_ASSESSMENT_REJECT',
          'SUBCONTRACT_CLAIM',
          claimId,
          [reason],
        );
        if (replay) return this.visibleClaim(context.auth, claimId, tx);

        const claim = await this.claimById(
          context.auth.companyId,
          claimId,
          tx,
        );
        if (claim.state !== 'ASSESSED') {
          throw new ConflictException({
            code: 'CLAIM_NOT_ASSESSED',
            detail: 'Only a currently assessed Claim can have its assessment rejected.',
          });
        }
        const agreement = await this.agreementById(
          context.auth.companyId,
          claim.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        const assessment = await tx.subcontractClaimAssessment.findFirst({
          where: { claimId, companyId: context.auth.companyId },
        });
        if (!assessment || assessment.state !== 'ASSESSED') {
          throw new ConflictException({
            code: 'ASSESSMENT_NOT_ACTIVE',
            detail: 'No active assessment exists for this Claim.',
          });
        }

        const rejectedAt = new Date();
        await tx.subcontractClaimAssessment.update({
          where: { id: assessment.id },
          data: {
            state: 'REJECTED',
            rejectedByUserId: context.auth.userId,
            rejectedAt,
            rejectionReason: reason,
          },
        });
        await tx.subcontractClaim.update({
          where: { id: claim.id },
          data: { state: 'REJECTED' },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_CLAIM_ASSESSMENT',
            entityId: assessment.id,
            action: 'REJECT',
            oldValues: {
              state: assessment.state,
              assessedAmount: assessment.assessedAmount.toString(),
            },
            newValues: { state: 'REJECTED', reason, rejectedAt },
          },
          tx,
        );
        return this.visibleClaim(context.auth, claim.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async assertSubmissionWorkOrders(
    companyId: string,
    agreementId: string,
    lines: Array<{ workOrderId: string | null }>,
    tx: Prisma.TransactionClient,
  ) {
    const approved = await tx.subcontractWorkOrder.findMany({
      where: { companyId, agreementId, approvalState: 'APPROVED' },
      select: { id: true },
    });
    const approvedIds = new Set(approved.map((row) => row.id));
    if (approvedIds.size > 0) {
      if (
        lines.some(
          (line) =>
            !line.workOrderId || !approvedIds.has(line.workOrderId),
        )
      ) {
        throw new UnprocessableEntityException({
          code: 'CLAIM_WORK_ORDER_REQUIRED',
          detail:
            'Every Claim line must reference an active approved Work Order when the agreement has approved Work Orders.',
        });
      }
      return;
    }
    if (lines.some((line) => line.workOrderId !== null)) {
      throw new UnprocessableEntityException({
        code: 'CLAIM_WORK_ORDER_NOT_AVAILABLE',
        detail:
          'Agreement-scope Claim lines must not reference a Work Order when no active approved Work Order exists.',
      });
    }
  }

  private async assertLineWorkOrder(
    companyId: string,
    claim: { projectId: string; agreementId: string },
    workOrderId: string | null | undefined,
    db: SubcontractDb,
  ) {
    if (!workOrderId) return;
    const workOrder = await db.subcontractWorkOrder.findFirst({
      where: {
        id: workOrderId,
        companyId,
        projectId: claim.projectId,
        agreementId: claim.agreementId,
        approvalState: 'APPROVED',
      },
      select: { id: true },
    });
    if (!workOrder) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CLAIM_WORK_ORDER',
        detail:
          'Claim Work Order must be approved and belong to the same Company, Project and agreement.',
      });
    }
  }

  private assertPeriod(periodStart: Date, periodEnd: Date) {
    if (periodStart.getTime() > periodEnd.getTime()) {
      throw new UnprocessableEntityException({
        code: 'INVALID_CLAIM_PERIOD',
        detail: 'Claim period start must be on or before period end.',
      });
    }
  }

  private assertDraftClaim(claim: { state: string }) {
    if (claim.state !== 'DRAFT') {
      throw new ConflictException({
        code: 'CLAIM_NOT_DRAFT',
        detail: 'Only a Draft Claim can be edited.',
      });
    }
  }

  private assertApprovedAgreement(agreement: {
    approvalState: string;
    cancelledAt: Date | null;
  }) {
    if (agreement.approvalState !== 'APPROVED' || agreement.cancelledAt) {
      throw new ConflictException({
        code: 'AGREEMENT_NOT_ACTIVE_APPROVED',
        detail: 'Claims require an approved, non-cancelled agreement.',
      });
    }
  }

  private async ensureClaimSequence(companyId: string) {
    await this.prisma.numberSequence.upsert({
      where: {
        companyId_sequenceCode: {
          companyId,
          sequenceCode: 'SUBCONTRACT_CLAIM',
        },
      },
      create: {
        companyId,
        entityType: 'SUBCONTRACT_CLAIM',
        sequenceCode: 'SUBCONTRACT_CLAIM',
        formatTemplate: 'SCLYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      },
      update: {},
    });
  }

  private async visibleAgreement(
    auth: AuthenticatedUserContext,
    agreementId: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractAgreement.findFirst({
      where: {
        id: agreementId,
        companyId: auth.companyId,
        project: scope,
      },
    });
    if (row) return row;
    const exists = await db.subcontractAgreement.findFirst({
      where: { id: agreementId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Subcontract agreement');
    throw this.projectDenied();
  }

  private async visibleClaim(
    auth: AuthenticatedUserContext,
    claimId: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractClaim.findFirst({
      where: {
        id: claimId,
        companyId: auth.companyId,
        project: scope,
      },
      include: this.claimInclude(),
    });
    if (row) return row;
    const exists = await db.subcontractClaim.findFirst({
      where: { id: claimId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Progress Claim');
    throw this.projectDenied();
  }

  private async visibleLine(
    auth: AuthenticatedUserContext,
    lineId: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractClaimLine.findFirst({
      where: {
        id: lineId,
        companyId: auth.companyId,
        claim: { project: scope },
      },
    });
    if (row) return row;
    const exists = await db.subcontractClaimLine.findFirst({
      where: { id: lineId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Progress Claim line');
    throw this.projectDenied();
  }

  private agreementById(
    companyId: string,
    agreementId: string,
    db: SubcontractDb,
  ) {
    return db.subcontractAgreement.findFirstOrThrow({
      where: { id: agreementId, companyId },
    });
  }

  private claimById(
    companyId: string,
    claimId: string,
    db: SubcontractDb,
  ) {
    return db.subcontractClaim.findFirstOrThrow({
      where: { id: claimId, companyId },
    });
  }

  private async lockAgreement(
    companyId: string,
    agreementId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "subcontract_agreements"
        WHERE "id" = ${agreementId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockClaims(
    companyId: string,
    claimIds: string[],
    tx: Prisma.TransactionClient,
  ) {
    const ids = [...new Set(claimIds)].sort();
    for (const claimId of ids) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id"
          FROM "subcontract_claims"
          WHERE "id" = ${claimId}::uuid
            AND "company_id" = ${companyId}::uuid
          FOR UPDATE`,
      );
    }
  }

  private async claimReplay(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    actionKey: string,
    actionType: string,
    entityType: string,
    entityId: string,
    payload: unknown[],
  ): Promise<boolean> {
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
    const matches = (existing: {
      actionType: string;
      entityType: string;
      entityId: string;
      payloadHash: string;
    }) =>
      existing.actionType === actionType &&
      existing.entityType === entityType &&
      existing.entityId === entityId &&
      existing.payloadHash === payloadHash;

    const existing = await tx.subcontractActionReplay.findUnique({
      where: key,
    });
    if (existing) {
      if (!matches(existing)) this.throwReplayConflict();
      return true;
    }
    const inserted = await tx.subcontractActionReplay.createMany({
      data: [{
        companyId: auth.companyId,
        userId: auth.userId,
        actionKey,
        actionType,
        entityType,
        entityId,
        payloadHash,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.subcontractActionReplay.findUnique({
      where: key,
    });
    if (!raced || !matches(raced)) this.throwReplayConflict();
    return true;
  }

  private throwReplayConflict(): never {
    throw new ConflictException({
      code: 'ACTION_KEY_REUSED',
      detail: 'This action key is already bound to a different action or payload.',
    });
  }

  private throwClaimUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CLAIM_IDENTITY_CONFLICT',
        detail:
          'A Claim already exists for this active agreement/period or replacement source.',
      });
    }
  }

  private claimForRead<T extends { assessment: unknown }>(
    auth: AuthenticatedUserContext,
    claim: T,
  ) {
    if (auth.permissions.includes('subcontracts.assessment.view')) {
      return claim;
    }
    return { ...claim, assessment: null };
  }

  private claimInclude() {
    return {
      agreement: {
        select: {
          id: true,
          agreementNumber: true,
          originalValue: true,
          currencyCode: true,
          approvalState: true,
          cancelledAt: true,
        },
      },
      lines: {
        orderBy: { lineNo: 'asc' as const },
        include: {
          workOrder: {
            select: {
              id: true,
              workOrderNumber: true,
              amount: true,
              approvalState: true,
            },
          },
        },
      },
      assessment: {
        include: {
          assessedBy: { select: { id: true, displayName: true } },
          rejectedBy: { select: { id: true, displayName: true } },
        },
      },
      replacementFor: {
        select: {
          id: true,
          claimNumber: true,
          state: true,
        },
      },
      replacementClaim: {
        select: {
          id: true,
          claimNumber: true,
          state: true,
        },
      },
      createdBy: { select: { id: true, displayName: true } },
      submittedBy: { select: { id: true, displayName: true } },
      withdrawnBy: { select: { id: true, displayName: true } },
    } satisfies Prisma.SubcontractClaimInclude;
  }

  private projectDenied() {
    return new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      detail: 'You do not have access to this Subcontracts Project.',
    });
  }

  private notFound(entity: string) {
    return new NotFoundException({
      code: 'NOT_FOUND',
      detail: entity + ' not found.',
    });
  }
}
