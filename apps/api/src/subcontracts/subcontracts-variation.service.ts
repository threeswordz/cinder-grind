import { createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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

type SubcontractDb = Prisma.TransactionClient | PrismaService;

export type VariationDraftInput = {
  valueDelta: string;
  scopeChange: string;
  reason: string;
  createKey: string;
};

export type VariationDraftUpdate = Partial<
  Pick<VariationDraftInput, 'valueDelta' | 'scopeChange' | 'reason'>
>;

@Injectable()
export class SubcontractsVariationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'SUBCONTRACT_VARIATION',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async listVariations(auth: AuthenticatedUserContext, agreementId: string) {
    await this.visibleAgreement(auth, agreementId, this.prisma);
    return this.prisma.subcontractVariation.findMany({
      where: { companyId: auth.companyId, agreementId },
      include: this.variationInclude(),
      orderBy: [{ createdAt: 'desc' }, { variationNumber: 'desc' }],
    });
  }

  getVariation(auth: AuthenticatedUserContext, variationId: string) {
    return this.visibleVariation(auth, variationId, this.prisma);
  }

  async createVariation(
    context: AuditContext,
    agreementId: string,
    input: VariationDraftInput,
  ) {
    const visible = await this.visibleAgreement(
      context.auth,
      agreementId,
      this.prisma,
    );
    this.assertAgreementActive(visible);
    const payloadHash = this.createPayloadHash(agreementId, input);
    const existing = await this.prisma.subcontractVariation.findFirst({
      where: {
        companyId: context.auth.companyId,
        createdByUserId: context.auth.userId,
        createKey: input.createKey,
      },
    });
    if (existing) {
      if (existing.createPayloadHash !== payloadHash) this.throwReplayConflict();
      return this.visibleVariation(context.auth, existing.id, this.prisma);
    }

    await this.ensureVariationSequence(context.auth.companyId);
    const variationNumber = await this.numbers.next(
      context.auth.companyId,
      'SUBCONTRACT_VARIATION',
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.lockAgreement(context.auth.companyId, agreementId, tx);
          const agreement = await this.agreementById(
            context.auth.companyId,
            agreementId,
            tx,
          );
          this.assertAgreementActive(agreement);
          const raced = await tx.subcontractVariation.findFirst({
            where: {
              companyId: context.auth.companyId,
              createdByUserId: context.auth.userId,
              createKey: input.createKey,
            },
          });
          if (raced) {
            if (raced.createPayloadHash !== payloadHash) this.throwReplayConflict();
            return this.visibleVariation(context.auth, raced.id, tx);
          }

          const row = await tx.subcontractVariation.create({
            data: {
              companyId: agreement.companyId,
              projectId: agreement.projectId,
              agreementId: agreement.id,
              variationNumber,
              currencyCode: agreement.currencyCode,
              valueDelta: input.valueDelta,
              scopeChange: input.scopeChange,
              reason: input.reason,
              createKey: input.createKey,
              createPayloadHash: payloadHash,
              createdByUserId: context.auth.userId,
            },
            include: this.variationInclude(),
          });
          await this.audit.record(
            {
              ...context,
              entityType: 'SUBCONTRACT_VARIATION',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                variationNumber,
                agreementId,
                valueDelta: row.valueDelta.toFixed(2),
                scopeChange: row.scopeChange,
                reason: row.reason,
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.subcontractVariation.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
        });
        if (replay) {
          if (replay.createPayloadHash !== payloadHash) this.throwReplayConflict();
          return this.visibleVariation(context.auth, replay.id, this.prisma);
        }
      }
      throw error;
    }
  }

  async updateVariation(
    context: AuditContext,
    variationId: string,
    input: VariationDraftUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleVariation(context.auth, variationId, tx);
      await this.lockAgreement(context.auth.companyId, visible.agreementId, tx);
      await this.lockVariation(context.auth.companyId, variationId, tx);
      const current = await this.variationById(
        context.auth.companyId,
        variationId,
        tx,
      );
      if (current.state !== 'DRAFT') {
        throw new ConflictException({
          code: 'VARIATION_NOT_DRAFT',
          detail: 'Only a Draft Variation can be edited.',
        });
      }
      const agreement = await this.agreementById(
        context.auth.companyId,
        current.agreementId,
        tx,
      );
      this.assertAgreementActive(agreement);
      const updated = await tx.subcontractVariation.update({
        where: { id: current.id },
        data: {
          ...(input.valueDelta !== undefined ? { valueDelta: input.valueDelta } : {}),
          ...(input.scopeChange !== undefined ? { scopeChange: input.scopeChange } : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
        },
        include: this.variationInclude(),
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_VARIATION',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: {
            valueDelta: current.valueDelta.toFixed(2),
            scopeChange: current.scopeChange,
            reason: current.reason,
          },
          newValues: {
            valueDelta: updated.valueDelta.toFixed(2),
            scopeChange: updated.scopeChange,
            reason: updated.reason,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async submitVariation(
    context: AuditContext,
    variationId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleVariation(context.auth, variationId, tx);
        await this.lockAgreement(context.auth.companyId, visible.agreementId, tx);
        await this.lockVariation(context.auth.companyId, variationId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'VARIATION_SUBMIT',
            variationId,
            [workflowCode],
          )
        ) {
          return this.visibleVariation(context.auth, variationId, tx);
        }

        const variation = await this.variationById(
          context.auth.companyId,
          variationId,
          tx,
        );
        if (variation.state !== 'DRAFT') {
          throw new ConflictException({
            code: 'VARIATION_NOT_DRAFT',
            detail: 'Only a Draft Variation can be submitted.',
          });
        }
        const agreement = await this.agreementById(
          context.auth.companyId,
          variation.agreementId,
          tx,
        );
        this.assertAgreementActive(agreement);

        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUBCONTRACT_VARIATION',
            entityId: variation.id,
          },
          tx,
        );
        const submittedAt = new Date();
        await tx.subcontractVariation.update({
          where: { id: variation.id },
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
            entityType: 'SUBCONTRACT_VARIATION',
            entityId: variation.id,
            action: 'SUBMIT',
            newValues: { workflowCode, approvalInstanceId: instance.id, submittedAt },
          },
          tx,
        );
        return this.visibleVariation(context.auth, variation.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  approveVariation(
    context: AuditContext,
    variationId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideVariation(
      context,
      variationId,
      'APPROVE',
      actionKey,
      comment,
    );
  }

  rejectVariation(
    context: AuditContext,
    variationId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.decideVariation(
      context,
      variationId,
      'REJECT',
      actionKey,
      reason,
    );
  }

  async reverseVariation(
    context: AuditContext,
    variationId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleVariation(context.auth, variationId, tx);
        await this.lockAgreement(context.auth.companyId, visible.agreementId, tx);
        await this.lockVariation(context.auth.companyId, variationId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'VARIATION_REVERSE',
            variationId,
            [reason],
          )
        ) {
          return this.visibleVariation(context.auth, variationId, tx);
        }

        const current = await this.variationById(
          context.auth.companyId,
          variationId,
          tx,
        );
        if (current.state !== 'APPROVED') {
          throw new ConflictException({
            code: 'VARIATION_NOT_APPROVED',
            detail: 'Only an approved Variation can be reversed.',
          });
        }
        const agreement = await this.agreementById(
          context.auth.companyId,
          current.agreementId,
          tx,
        );
        this.assertAgreementActive(agreement);
        const currentCeiling = await this.currentCeiling(agreement, tx);
        const nextCeiling = currentCeiling.minus(current.valueDelta);
        await this.assertProtectedCeiling(
          context.auth.companyId,
          current.agreementId,
          nextCeiling,
          tx,
        );

        const reversedAt = new Date();
        await tx.subcontractVariation.update({
          where: { id: current.id },
          data: {
            state: 'REVERSED',
            reversedByUserId: context.auth.userId,
            reversedAt,
            reversalReason: reason,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_VARIATION',
            entityId: current.id,
            action: 'REVERSE',
            oldValues: {
              state: current.state,
              valueDelta: current.valueDelta.toFixed(2),
              currentCeiling: currentCeiling.toFixed(2),
            },
            newValues: {
              state: 'REVERSED',
              nextCeiling: nextCeiling.toFixed(2),
              reason,
              reversedAt,
            },
          },
          tx,
        );
        return this.visibleVariation(context.auth, current.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async reportAgreements(
    auth: AuthenticatedUserContext,
    projectId?: string,
  ) {
    if (projectId) await this.access.assertAccess(auth, projectId, this.prisma);
    const scope = await this.access.scopeWhere(auth, this.prisma);
    const agreements = await this.prisma.subcontractAgreement.findMany({
      where: {
        companyId: auth.companyId,
        project: scope,
        ...(projectId ? { projectId } : {}),
        approvalState: { in: ['APPROVED', 'CANCELLED'] },
      },
      select: {
        id: true,
        agreementNumber: true,
        projectId: true,
        originalValue: true,
        currencyCode: true,
        approvalState: true,
        cancelledAt: true,
        project: { select: { id: true, projectCode: true, projectName: true } },
        subcontractor: {
          select: { id: true, subcontractorCode: true, subcontractorName: true },
        },
      },
      orderBy: [{ project: { projectCode: 'asc' } }, { agreementNumber: 'asc' }],
    });

    return Promise.all(
      agreements.map(async (agreement) => {
        const [variations, workOrders, claims, assessments, certifications] =
          await Promise.all([
            this.prisma.subcontractVariation.aggregate({
              where: { agreementId: agreement.id, state: 'APPROVED' },
              _sum: { valueDelta: true },
            }),
            this.prisma.subcontractWorkOrder.aggregate({
              where: { agreementId: agreement.id, approvalState: 'APPROVED' },
              _sum: { amount: true },
            }),
            this.prisma.subcontractClaimLine.aggregate({
              where: {
                agreementId: agreement.id,
                claim: { state: { in: ['SUBMITTED', 'ASSESSED'] } },
              },
              _sum: { amount: true },
            }),
            this.prisma.subcontractClaimAssessment.aggregate({
              where: {
                agreementId: agreement.id,
                state: 'ASSESSED',
                claim: { state: 'ASSESSED' },
              },
              _sum: { assessedAmount: true },
            }),
            this.prisma.subcontractCertification.aggregate({
              where: { agreementId: agreement.id, state: 'APPROVED' },
              _sum: {
                certifiedGross: true,
                retainedAmount: true,
                netCertifiedAmount: true,
              },
            }),
          ]);
        const variationDelta = new Prisma.Decimal(
          variations._sum.valueDelta ?? 0,
        );
        const currentCeiling = agreement.originalValue.plus(variationDelta);
        return {
          ...agreement,
          originalValue: agreement.originalValue.toFixed(2),
          approvedVariationDelta: variationDelta.toFixed(2),
          currentCeiling: currentCeiling.toFixed(2),
          approvedWorkOrderAllocation: new Prisma.Decimal(
            workOrders._sum.amount ?? 0,
          ).toFixed(2),
          activeClaimedValue: new Prisma.Decimal(
            claims._sum.amount ?? 0,
          ).toFixed(2),
          assessedValue: new Prisma.Decimal(
            assessments._sum.assessedAmount ?? 0,
          ).toFixed(2),
          certifiedGross: new Prisma.Decimal(
            certifications._sum.certifiedGross ?? 0,
          ).toFixed(2),
          withheldRetention: new Prisma.Decimal(
            certifications._sum.retainedAmount ?? 0,
          ).toFixed(2),
          netCertification: new Prisma.Decimal(
            certifications._sum.netCertifiedAmount ?? 0,
          ).toFixed(2),
        };
      }),
    );
  }

  private async decideVariation(
    context: AuditContext,
    variationId: string,
    action: 'APPROVE' | 'REJECT',
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleVariation(context.auth, variationId, tx);
        await this.lockAgreement(context.auth.companyId, visible.agreementId, tx);
        await this.lockVariation(context.auth.companyId, variationId, tx);

        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'VARIATION_' + action,
            variationId,
            [comment ?? null],
          )
        ) {
          return this.visibleVariation(context.auth, variationId, tx);
        }

        const variation = await this.variationById(
          context.auth.companyId,
          variationId,
          tx,
        );
        this.assertSubmitted(variation);
        const agreement = await this.agreementById(
          context.auth.companyId,
          variation.agreementId,
          tx,
        );
        this.assertAgreementActive(agreement);

        const instance =
          action === 'APPROVE'
            ? await this.approvals.approve(
                variation.approvalInstanceId!,
                context.auth,
                variation.createdByUserId,
                comment,
                async (approvalTx) => {
                  const current = await this.variationById(
                    context.auth.companyId,
                    variationId,
                    approvalTx,
                  );
                  this.assertSubmitted(current);
                  const lockedAgreement = await this.agreementById(
                    context.auth.companyId,
                    current.agreementId,
                    approvalTx,
                  );
                  this.assertAgreementActive(lockedAgreement);
                  const ceilingBefore = await this.currentCeiling(
                    lockedAgreement,
                    approvalTx,
                  );
                  const nextCeiling = ceilingBefore.plus(current.valueDelta);
                  await this.assertProtectedCeiling(
                    context.auth.companyId,
                    current.agreementId,
                    nextCeiling,
                    approvalTx,
                  );
                  const approvedAt = new Date();
                  await approvalTx.subcontractVariation.update({
                    where: { id: current.id },
                    data: {
                      state: 'APPROVED',
                      approvedByUserId: context.auth.userId,
                      approvedAt,
                      decidedAt: approvedAt,
                    },
                  });
                },
                tx,
              )
            : await this.approvals.reject(
                variation.approvalInstanceId!,
                context.auth,
                variation.createdByUserId,
                comment,
                tx,
              );

        if (action === 'REJECT') {
          const rejectedAt = new Date();
          await tx.subcontractVariation.update({
            where: { id: variation.id },
            data: {
              state: 'REJECTED',
              rejectedByUserId: context.auth.userId,
              rejectedAt,
              rejectionReason: comment ?? 'Rejected.',
              decidedAt: rejectedAt,
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_VARIATION',
            entityId: variation.id,
            action: 'APPROVAL_' + action,
            newValues: {
              approvalInstanceId: instance.id,
              approvalState: instance.approvalState,
            },
          },
          tx,
        );
        return this.visibleVariation(context.auth, variation.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async currentCeiling(
    agreement: { id: string; originalValue: Prisma.Decimal },
    db: SubcontractDb,
  ) {
    const approved = await db.subcontractVariation.aggregate({
      where: { agreementId: agreement.id, state: 'APPROVED' },
      _sum: { valueDelta: true },
    });
    return agreement.originalValue.plus(approved._sum.valueDelta ?? 0);
  }

  private async assertProtectedCeiling(
    companyId: string,
    agreementId: string,
    nextCeiling: Prisma.Decimal,
    db: SubcontractDb,
  ) {
    const [workOrders, claims, certifications] = await Promise.all([
      db.subcontractWorkOrder.aggregate({
        where: {
          companyId,
          agreementId,
          approvalState: 'APPROVED',
        },
        _sum: { amount: true },
      }),
      db.subcontractClaimLine.aggregate({
        where: {
          companyId,
          agreementId,
          claim: { state: { in: ['SUBMITTED', 'ASSESSED'] } },
        },
        _sum: { amount: true },
      }),
      db.subcontractCertification.aggregate({
        where: { companyId, agreementId, state: 'APPROVED' },
        _sum: { certifiedGross: true },
      }),
    ]);
    const floor = Prisma.Decimal.max(
      new Prisma.Decimal(0),
      new Prisma.Decimal(workOrders._sum.amount ?? 0),
      new Prisma.Decimal(claims._sum.amount ?? 0),
      new Prisma.Decimal(certifications._sum.certifiedGross ?? 0),
    );
    if (nextCeiling.lt(floor)) {
      throw new ConflictException({
        code: 'VARIATION_PROTECTED_CEILING',
        detail:
          'This Variation would reduce the Agreement ceiling below protected Work Order, Claim, or Certification value.',
      });
    }
  }

  private createPayloadHash(agreementId: string, input: VariationDraftInput) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          agreementId.toLowerCase(),
          new Prisma.Decimal(input.valueDelta).toFixed(2),
          input.scopeChange,
          input.reason,
        ]),
      )
      .digest('hex');
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
      row.entityType === 'SUBCONTRACT_VARIATION' &&
      row.entityId === entityId &&
      row.payloadHash === payloadHash;

    const existing = await tx.subcontractActionReplay.findUnique({ where: key });
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
        entityType: 'SUBCONTRACT_VARIATION',
        entityId,
        payloadHash,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.subcontractActionReplay.findUnique({ where: key });
    if (!raced || !matches(raced)) this.throwReplayConflict();
    return true;
  }

  private throwReplayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail:
        'This action key is already paired with a different Subcontracts action, record, or payload.',
    });
  }

  private assertAgreementActive(agreement: {
    approvalState: string;
    firstApprovedAt: Date | null;
    cancelledAt: Date | null;
  }) {
    if (
      agreement.approvalState !== 'APPROVED' ||
      !agreement.firstApprovedAt ||
      agreement.cancelledAt
    ) {
      throw new ConflictException({
        code: 'AGREEMENT_NOT_ACTIVE_APPROVED',
        detail: 'Variations require an approved, non-cancelled Agreement.',
      });
    }
  }

  private assertSubmitted(variation: {
    state: string;
    approvalInstanceId: string | null;
    submittedByUserId: string | null;
  }) {
    if (
      variation.state !== 'SUBMITTED' ||
      !variation.approvalInstanceId ||
      !variation.submittedByUserId
    ) {
      throw new ConflictException({
        code: 'VARIATION_NOT_SUBMITTED',
        detail: 'This Variation is not awaiting an approval action.',
      });
    }
  }

  private async ensureVariationSequence(companyId: string) {
    await this.prisma.numberSequence.createMany({
      data: [{
        companyId,
        entityType: 'SUBCONTRACT_VARIATION',
        sequenceCode: 'SUBCONTRACT_VARIATION',
        formatTemplate: 'SVOYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      }],
      skipDuplicates: true,
    });
  }

  private async visibleAgreement(
    auth: AuthenticatedUserContext,
    agreementId: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractAgreement.findFirst({
      where: { id: agreementId, companyId: auth.companyId, project: scope },
    });
    if (row) return row;
    const exists = await db.subcontractAgreement.findFirst({
      where: { id: agreementId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Subcontract agreement');
    throw this.projectDenied();
  }

  private async visibleVariation(
    auth: AuthenticatedUserContext,
    variationId: string,
    db: SubcontractDb,
  ) {
    const row = await db.subcontractVariation.findFirst({
      where: { id: variationId, companyId: auth.companyId },
      include: this.variationInclude(),
    });
    if (!row) throw this.notFound('Variation');
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private agreementById(companyId: string, agreementId: string, db: SubcontractDb) {
    return db.subcontractAgreement.findFirstOrThrow({
      where: { id: agreementId, companyId },
    });
  }

  private variationById(companyId: string, variationId: string, db: SubcontractDb) {
    return db.subcontractVariation.findFirstOrThrow({
      where: { id: variationId, companyId },
    });
  }

  private async lockAgreement(
    companyId: string,
    agreementId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "subcontract_agreements"
        WHERE "id" = ${agreementId}::uuid AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockVariation(
    companyId: string,
    variationId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "subcontract_variations"
        WHERE "id" = ${variationId}::uuid AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private variationInclude() {
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
      createdBy: { select: { id: true, displayName: true } },
      submittedBy: { select: { id: true, displayName: true } },
      approvedBy: { select: { id: true, displayName: true } },
      rejectedBy: { select: { id: true, displayName: true } },
      reversedBy: { select: { id: true, displayName: true } },
      approvalInstance: {
        include: {
          workflow: {
            select: { id: true, workflowCode: true, workflowName: true },
          },
          actions: {
            orderBy: { actionAt: 'asc' as const },
            include: {
              approvalStep: { select: { stepNo: true } },
              actionByUser: { select: { id: true, displayName: true } },
            },
          },
        },
      },
    } satisfies Prisma.SubcontractVariationInclude;
  }

  private notFound(entity: string) {
    return new NotFoundException({
      code: 'NOT_FOUND',
      detail: entity + ' not found.',
    });
  }

  private projectDenied() {
    return new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      detail: 'You do not have access to this Subcontracts Project.',
    });
  }
}
