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
import { APPROVAL_STATE, ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type SubcontractDb = Prisma.TransactionClient | PrismaService;

export type CertificationDraftInput = {
  certifiedGross: string;
};

export type CertificationDraftUpdate = Partial<CertificationDraftInput>;

@Injectable()
export class SubcontractsCertificationService {
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
        entityType: 'SUBCONTRACT_CERTIFICATION',
        isActive: true,
      },
      select: {
        id: true,
        workflowCode: true,
        workflowName: true,
      },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async listCertifications(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    await this.visibleAgreement(auth, agreementId, this.prisma);
    return this.prisma.subcontractCertification.findMany({
      where: { companyId: auth.companyId, agreementId },
      include: this.certificationInclude(),
      orderBy: [{ createdAt: 'desc' }, { certificationNumber: 'desc' }],
    });
  }

  getCertification(auth: AuthenticatedUserContext, certificationId: string) {
    return this.visibleCertification(auth, certificationId, this.prisma);
  }

  async createCertification(
    context: AuditContext,
    claimId: string,
    input: CertificationDraftInput,
  ) {
    const visible = await this.visibleClaim(context.auth, claimId, this.prisma);
    this.assertSourceEligible(visible, new Prisma.Decimal(input.certifiedGross));
    await this.assertNoPriorApprovedCorrection(
      context.auth.companyId,
      claimId,
      this.prisma,
    );
    await this.ensureCertificationSequence(context.auth.companyId);
    const certificationNumber = await this.numbers.next(
      context.auth.companyId,
      'SUBCONTRACT_CERTIFICATION',
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.lockAgreement(
            context.auth.companyId,
            visible.agreementId,
            tx,
          );
          await this.lockClaim(context.auth.companyId, claimId, tx);
          const claim = await this.claimById(
            context.auth.companyId,
            claimId,
            tx,
          );
          this.assertSourceEligible(
            claim,
            new Prisma.Decimal(input.certifiedGross),
          );
          await this.assertNoPriorApprovedCorrection(
            context.auth.companyId,
            claimId,
            tx,
          );

          const row = await tx.subcontractCertification.create({
            data: {
              companyId: claim.companyId,
              projectId: claim.projectId,
              agreementId: claim.agreementId,
              claimId: claim.id,
              assessmentId: claim.assessment!.id,
              certificationNumber,
              currencyCode: claim.currencyCode,
              certifiedGross: input.certifiedGross,
              createdByUserId: context.auth.userId,
            },
            include: this.certificationInclude(),
          });

          await this.audit.record(
            {
              ...context,
              entityType: 'SUBCONTRACT_CERTIFICATION',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                certificationNumber,
                claimId: claim.id,
                assessmentId: claim.assessment!.id,
                certifiedGross: row.certifiedGross.toFixed(2),
                currencyCode: row.currencyCode,
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
    } catch (error) {
      this.throwCertificationUnique(error);
      throw error;
    }
  }

  async updateCertification(
    context: AuditContext,
    certificationId: string,
    input: CertificationDraftUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleCertification(
        context.auth,
        certificationId,
        tx,
      );
      await this.lockAgreement(
        context.auth.companyId,
        visible.agreementId,
        tx,
      );
      await this.lockClaim(context.auth.companyId, visible.claimId, tx);
      await this.lockCertification(
        context.auth.companyId,
        certificationId,
        tx,
      );

      const current = await this.certificationById(
        context.auth.companyId,
        certificationId,
        tx,
      );
      if (current.state !== 'DRAFT') {
        throw new ConflictException({
          code: 'CERTIFICATION_NOT_DRAFT',
          detail: 'Only a Draft Certification can be edited.',
        });
      }
      const claim = await this.claimById(
        context.auth.companyId,
        current.claimId,
        tx,
      );
      const nextGross = new Prisma.Decimal(
        input.certifiedGross ?? current.certifiedGross,
      );
      this.assertSourceEligible(claim, nextGross);

      const updated = await tx.subcontractCertification.update({
        where: { id: current.id },
        data: {
          ...(input.certifiedGross !== undefined
            ? { certifiedGross: input.certifiedGross }
            : {}),
        },
        include: this.certificationInclude(),
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_CERTIFICATION',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: { certifiedGross: current.certifiedGross.toFixed(2) },
          newValues: { certifiedGross: updated.certifiedGross.toFixed(2) },
        },
        tx,
      );
      return updated;
    });
  }

  async submitCertification(
    context: AuditContext,
    certificationId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleCertification(
          context.auth,
          certificationId,
          tx,
        );
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaim(context.auth.companyId, visible.claimId, tx);
        await this.lockCertification(
          context.auth.companyId,
          certificationId,
          tx,
        );

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CERTIFICATION_SUBMIT',
          'SUBCONTRACT_CERTIFICATION',
          certificationId,
          [workflowCode],
        );
        if (replay) {
          return this.visibleCertification(
            context.auth,
            certificationId,
            tx,
          );
        }

        const certification = await this.certificationById(
          context.auth.companyId,
          certificationId,
          tx,
        );
        if (certification.state !== 'DRAFT') {
          throw new ConflictException({
            code: 'CERTIFICATION_NOT_DRAFT',
            detail: 'Only a Draft Certification can be submitted.',
          });
        }
        const claim = await this.claimById(
          context.auth.companyId,
          certification.claimId,
          tx,
        );
        this.assertSourceEligible(claim, certification.certifiedGross);
        await this.assertAgreementActive(
          context.auth.companyId,
          certification.agreementId,
          tx,
        );

        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUBCONTRACT_CERTIFICATION',
            entityId: certification.id,
          },
          tx,
        );
        const submittedAt = new Date();
        await tx.subcontractCertification.update({
          where: { id: certification.id },
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
            entityType: 'SUBCONTRACT_CERTIFICATION',
            entityId: certification.id,
            action: 'SUBMIT',
            newValues: {
              workflowCode,
              approvalInstanceId: instance.id,
              submittedAt,
            },
          },
          tx,
        );
        return this.visibleCertification(
          context.auth,
          certification.id,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  approveCertification(
    context: AuditContext,
    certificationId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideCertification(
      context,
      certificationId,
      'APPROVE',
      actionKey,
      comment,
    );
  }

  rejectCertification(
    context: AuditContext,
    certificationId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.decideCertification(
      context,
      certificationId,
      'REJECT',
      actionKey,
      reason,
    );
  }

  async reverseCertification(
    context: AuditContext,
    certificationId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleCertification(
          context.auth,
          certificationId,
          tx,
        );
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaim(context.auth.companyId, visible.claimId, tx);
        await this.lockCertification(
          context.auth.companyId,
          certificationId,
          tx,
        );

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CERTIFICATION_REVERSE',
          'SUBCONTRACT_CERTIFICATION',
          certificationId,
          [reason],
        );
        if (replay) {
          return this.visibleCertification(
            context.auth,
            certificationId,
            tx,
          );
        }

        const current = await this.certificationById(
          context.auth.companyId,
          certificationId,
          tx,
        );
        if (current.state !== 'APPROVED') {
          throw new ConflictException({
            code: 'CERTIFICATION_NOT_APPROVED',
            detail: 'Only an approved Certification can be reversed.',
          });
        }

        const activePaymentAllocation =
          await tx.subcontractPaymentAllocation.findFirst({
            where: {
              subcontractCertificationId: current.id,
              payment: {
                state: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
              },
            },
            select: { id: true },
          });
        if (activePaymentAllocation) {
          throw new ConflictException({
            code: 'SUBCONTRACT_CERTIFICATION_ACTIVE_PAYMENT_ALLOCATION',
            detail:
              'A Certification with an active Finance Payment allocation cannot be reversed. Cancel or otherwise release the Payment first.',
          });
        }

        const reversedAt = new Date();
        await tx.subcontractCertification.update({
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
            entityType: 'SUBCONTRACT_CERTIFICATION',
            entityId: current.id,
            action: 'REVERSE',
            oldValues: {
              state: current.state,
              certifiedGross: current.certifiedGross.toFixed(2),
              retainedAmount: current.retainedAmount?.toFixed(2) ?? null,
              netCertifiedAmount:
                current.netCertifiedAmount?.toFixed(2) ?? null,
            },
            newValues: { state: 'REVERSED', reason, reversedAt },
          },
          tx,
        );
        return this.visibleCertification(
          context.auth,
          current.id,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async decideCertification(
    context: AuditContext,
    certificationId: string,
    action: 'APPROVE' | 'REJECT',
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleCertification(
          context.auth,
          certificationId,
          tx,
        );
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockClaim(context.auth.companyId, visible.claimId, tx);
        await this.lockCertification(
          context.auth.companyId,
          certificationId,
          tx,
        );

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'CERTIFICATION_' + action,
          'SUBCONTRACT_CERTIFICATION',
          certificationId,
          [comment ?? null],
        );
        if (replay) {
          return this.visibleCertification(
            context.auth,
            certificationId,
            tx,
          );
        }

        const certification = await this.certificationById(
          context.auth.companyId,
          certificationId,
          tx,
        );
        this.assertSubmitted(certification);
        const claim = await this.claimById(
          context.auth.companyId,
          certification.claimId,
          tx,
        );
        this.assertSourceEligible(claim, certification.certifiedGross);
        await this.assertAgreementActive(
          context.auth.companyId,
          certification.agreementId,
          tx,
        );

        const instance =
          action === 'APPROVE'
            ? await this.approvals.approve(
                certification.approvalInstanceId!,
                context.auth,
                certification.createdByUserId!,
                comment,
                async (approvalTx) => {
                  const current = await this.certificationById(
                    context.auth.companyId,
                    certificationId,
                    approvalTx,
                  );
                  this.assertSubmitted(current);
                  const currentClaim = await this.claimById(
                    context.auth.companyId,
                    current.claimId,
                    approvalTx,
                  );
                  this.assertSourceEligible(
                    currentClaim,
                    current.certifiedGross,
                  );
                  const agreement = await this.assertAgreementActive(
                    context.auth.companyId,
                    current.agreementId,
                    approvalTx,
                  );

                  const priorGross =
                    await approvalTx.subcontractCertification.aggregate({
                      where: {
                        agreementId: current.agreementId,
                        state: 'APPROVED',
                        id: { not: current.id },
                      },
                      _sum: { certifiedGross: true },
                    });
                  const cumulativeGross = new Prisma.Decimal(
                    priorGross._sum.certifiedGross ?? 0,
                  ).plus(current.certifiedGross);
                  const currentCeiling =
                    await this.currentAgreementCeiling(
                      agreement,
                      approvalTx,
                    );
                  if (cumulativeGross.gt(currentCeiling)) {
                    throw new ConflictException({
                      code: 'CERTIFICATION_AGREEMENT_CEILING_EXCEEDED',
                      detail:
                        'Approving this Certification would exceed the current approved Agreement ceiling.',
                    });
                  }

                  const priorRetention =
                    await approvalTx.subcontractCertification.aggregate({
                      where: {
                        agreementId: current.agreementId,
                        state: 'APPROVED',
                        id: { not: current.id },
                      },
                      _sum: { retainedAmount: true },
                    });
                  const retainedBefore = new Prisma.Decimal(
                    priorRetention._sum.retainedAmount ?? 0,
                  );
                  const rawRetention = current.certifiedGross
                    .mul(agreement.retentionRate)
                    .div(100)
                    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
                  let retainedAmount = rawRetention;
                  if (agreement.retentionCap !== null) {
                    const remaining = Prisma.Decimal.max(
                      agreement.retentionCap.minus(retainedBefore),
                      new Prisma.Decimal(0),
                    );
                    retainedAmount = Prisma.Decimal.min(
                      rawRetention,
                      remaining,
                    );
                  }
                  retainedAmount = Prisma.Decimal.min(
                    retainedAmount,
                    current.certifiedGross,
                  );
                  const approvedAt = new Date();
                  await approvalTx.subcontractCertification.update({
                    where: { id: current.id },
                    data: {
                      state: 'APPROVED',
                      assessedAmountSnapshot:
                        currentClaim.assessment!.assessedAmount,
                      retentionRateSnapshot: agreement.retentionRate,
                      retentionCapSnapshot: agreement.retentionCap,
                      retainedBeforeSnapshot: retainedBefore,
                      retainedAmount,
                      netCertifiedAmount:
                        current.certifiedGross.minus(retainedAmount),
                      approvedByUserId: context.auth.userId,
                      approvedAt,
                      decidedAt: approvedAt,
                    },
                  });
                },
                tx,
              )
            : await this.approvals.reject(
                certification.approvalInstanceId!,
                context.auth,
                certification.createdByUserId!,
                comment,
                tx,
              );

        if (action === 'REJECT') {
          const rejectedAt = new Date();
          await tx.subcontractCertification.update({
            where: { id: certification.id },
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
            entityType: 'SUBCONTRACT_CERTIFICATION',
            entityId: certification.id,
            action: 'APPROVAL_' + action,
            newValues: {
              approvalInstanceId: instance.id,
              approvalState: instance.approvalState,
            },
          },
          tx,
        );
        return this.visibleCertification(
          context.auth,
          certification.id,
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private assertSourceEligible(
    claim: {
      state: string;
      assessment: {
        id: string;
        state: string;
        assessedAmount: Prisma.Decimal;
      } | null;
    },
    certifiedGross: Prisma.Decimal,
  ) {
    if (
      claim.state !== 'ASSESSED' ||
      !claim.assessment ||
      claim.assessment.state !== 'ASSESSED'
    ) {
      throw new ConflictException({
        code: 'CERTIFICATION_SOURCE_NOT_ASSESSED',
        detail:
          'Certification requires a currently assessed Claim with an active retained Assessment.',
      });
    }
    if (certifiedGross.lt(0) || certifiedGross.gt(claim.assessment.assessedAmount)) {
      throw new UnprocessableEntityException({
        code: 'CERTIFICATION_GROSS_OUT_OF_RANGE',
        detail:
          'Certified gross must be nonnegative and cannot exceed the retained assessed amount.',
      });
    }
  }

  private async assertNoPriorApprovedCorrection(
    companyId: string,
    claimId: string,
    db: SubcontractDb,
  ) {
    const prior = await db.subcontractCertification.findFirst({
      where: {
        companyId,
        claimId,
        state: { in: ['APPROVED', 'REVERSED'] },
      },
      select: { id: true, certificationNumber: true, state: true },
    });
    if (prior) {
      throw new ConflictException({
        code: 'CERTIFICATION_REPLACEMENT_REQUIRED',
        detail:
          'A Claim with approved or reversed Certification history must use the approved reversal and linked replacement Claim correction path.',
      });
    }
  }

  private async assertAgreementActive(
    companyId: string,
    agreementId: string,
    db: SubcontractDb,
  ) {
    const agreement = await db.subcontractAgreement.findFirstOrThrow({
      where: { id: agreementId, companyId },
    });
    if (
      agreement.approvalState !== 'APPROVED' ||
      !agreement.firstApprovedAt ||
      agreement.cancelledAt
    ) {
      throw new ConflictException({
        code: 'AGREEMENT_NOT_ACTIVE_APPROVED',
        detail:
          'Certification requires an approved, non-cancelled Agreement.',
      });
    }
    return agreement;
  }

  private async currentAgreementCeiling(
    agreement: { id: string; originalValue: Prisma.Decimal },
    db: SubcontractDb,
  ) {
    const variations = await db.subcontractVariation.aggregate({
      where: { agreementId: agreement.id, state: 'APPROVED' },
      _sum: { valueDelta: true },
    });
    return agreement.originalValue.plus(variations._sum.valueDelta ?? 0);
  }

  private async ensureCertificationSequence(companyId: string) {
    await this.prisma.numberSequence.createMany({
      data: [
        {
          companyId,
          entityType: 'SUBCONTRACT_CERTIFICATION',
          sequenceCode: 'SUBCONTRACT_CERTIFICATION',
          formatTemplate: 'SCTYYMM-###',
          resetRule: 'MONTHLY',
          nextValue: 1,
        },
      ],
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
      where: {
        id: agreementId,
        companyId: auth.companyId,
        project: scope,
      },
      select: { id: true },
    });
    if (row) return row;
    const exists = await db.subcontractAgreement.findFirst({
      where: { id: agreementId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Subcontract Agreement');
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
      include: { assessment: true },
    });
    if (row) return row;
    const exists = await db.subcontractClaim.findFirst({
      where: { id: claimId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Progress Claim');
    throw this.projectDenied();
  }

  private async visibleCertification(
    auth: AuthenticatedUserContext,
    certificationId: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractCertification.findFirst({
      where: {
        id: certificationId,
        companyId: auth.companyId,
        claim: { project: scope },
      },
      include: this.certificationInclude(),
    });
    if (row) return row;
    const exists = await db.subcontractCertification.findFirst({
      where: { id: certificationId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Payment Certification');
    throw this.projectDenied();
  }

  private claimById(
    companyId: string,
    claimId: string,
    db: SubcontractDb,
  ) {
    return db.subcontractClaim.findFirstOrThrow({
      where: { id: claimId, companyId },
      include: { assessment: true },
    });
  }

  private certificationById(
    companyId: string,
    certificationId: string,
    db: SubcontractDb,
  ) {
    return db.subcontractCertification.findFirstOrThrow({
      where: { id: certificationId, companyId },
    });
  }

  private async lockAgreement(
    companyId: string,
    agreementId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "subcontract_agreements"
        WHERE "id" = ${agreementId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockClaim(
    companyId: string,
    claimId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "subcontract_claims"
        WHERE "id" = ${claimId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockCertification(
    companyId: string,
    certificationId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "subcontract_certifications"
        WHERE "id" = ${certificationId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private assertSubmitted(certification: {
    state: string;
    approvalInstanceId: string | null;
    submittedByUserId: string | null;
  }) {
    if (
      certification.state !== 'SUBMITTED' ||
      !certification.approvalInstanceId ||
      !certification.submittedByUserId
    ) {
      throw new ConflictException({
        code: 'CERTIFICATION_NOT_SUBMITTED',
        detail:
          'This Certification is not awaiting an approval decision.',
      });
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
      detail:
        'This action key is already bound to a different action or payload.',
    });
  }

  private throwCertificationUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'CERTIFICATION_IDENTITY_CONFLICT',
        detail:
          'An active Certification already exists for this Claim or the generated identifier is already in use.',
      });
    }
  }

  private certificationInclude() {
    return {
      agreement: {
        select: {
          id: true,
          agreementNumber: true,
          originalValue: true,
          currencyCode: true,
          retentionRate: true,
          retentionCap: true,
          approvalState: true,
          cancelledAt: true,
        },
      },
      claim: {
        select: {
          id: true,
          claimNumber: true,
          state: true,
        },
      },
      assessment: {
        select: {
          id: true,
          assessedAmount: true,
          state: true,
          assessedAt: true,
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
            select: {
              id: true,
              workflowCode: true,
              workflowName: true,
            },
          },
          actions: {
            orderBy: { actionAt: 'asc' as const },
            include: {
              approvalStep: { select: { stepNo: true } },
              actionByUser: {
                select: { id: true, displayName: true },
              },
            },
          },
        },
      },
    } satisfies Prisma.SubcontractCertificationInclude;
  }

  private projectDenied() {
    return new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      detail:
        'You do not have access to this Certification Project.',
    });
  }

  private notFound(entity: string) {
    return new NotFoundException({
      code: 'NOT_FOUND',
      detail: entity + ' was not found.',
    });
  }
}
