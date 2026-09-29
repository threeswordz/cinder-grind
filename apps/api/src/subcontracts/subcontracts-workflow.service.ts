import { createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

export type AgreementRevisionInput = {
  operationalStatusId?: string | null;
  reason: string;
};

export type AgreementRevisionUpdate = {
  operationalStatusId?: string | null;
  reason?: string;
};

export type WorkOrderDraftInput = {
  scopeOfWork: string;
  amount: string;
  wbsElementId?: string | null;
  costCodeId?: string | null;
};

export type WorkOrderDraftUpdate = Partial<WorkOrderDraftInput>;

@Injectable()
export class SubcontractsWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  workflowOptions(
    auth: AuthenticatedUserContext,
    entityType: 'SUBCONTRACT_AGREEMENT' | 'SUBCONTRACT_WORK_ORDER',
  ) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType,
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

  async agreementVersions(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    await this.visibleAgreement(auth, agreementId, this.prisma);
    return this.prisma.subcontractAgreementVersion.findMany({
      where: {
        companyId: auth.companyId,
        agreementId,
      },
      include: this.versionInclude(),
      orderBy: { versionNo: 'asc' },
    });
  }

  async submitInitialAgreement(
    context: AuditContext,
    agreementId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visibleAgreement(context.auth, agreementId, tx);
        await this.lockAgreement(context.auth.companyId, agreementId, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'AGREEMENT_SUBMIT',
          'SUBCONTRACT_AGREEMENT',
          agreementId,
          [workflowCode],
        );
        if (replay) {
          return this.visibleAgreement(context.auth, agreementId, tx);
        }

        const agreement = await this.agreementById(
          context.auth.companyId,
          agreementId,
          tx,
        );
        if (
          agreement.approvalState !== 'DRAFT' ||
          agreement.cancelledAt ||
          agreement.firstApprovedAt
        ) {
          throw new ConflictException({
            code: 'AGREEMENT_NOT_DRAFT',
            detail: 'Only an unsubmitted Draft agreement can be submitted.',
          });
        }

        await this.assertCurrentAgreementReferences(agreement, tx);

        const prior = await tx.subcontractAgreementVersion.findFirst({
          where: { agreementId },
          select: { id: true },
        });
        if (prior) {
          throw new ConflictException({
            code: 'AGREEMENT_VERSION_ALREADY_EXISTS',
            detail: 'The original agreement submission already has retained version history.',
          });
        }

        const version = await tx.subcontractAgreementVersion.create({
          data: {
            companyId: agreement.companyId,
            projectId: agreement.projectId,
            agreementId: agreement.id,
            versionNo: 1,
            originalValue: agreement.originalValue,
            scopeOfWork: agreement.scopeOfWork,
            currencyCode: agreement.currencyCode,
            operationalStatusId: agreement.operationalStatusId,
            createdByUserId: context.auth.userId,
          },
        });

        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: version.id,
          },
          tx,
        );
        const submittedAt = new Date();

        await tx.subcontractAgreementVersion.update({
          where: { id: version.id },
          data: {
            approvalState: APPROVAL_STATE.SUBMITTED,
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
        });
        await tx.subcontractAgreement.update({
          where: { id: agreement.id },
          data: { approvalState: APPROVAL_STATE.SUBMITTED },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: agreement.id,
            action: 'SUBMIT',
            newValues: {
              versionId: version.id,
              versionNo: 1,
              workflowCode,
              approvalInstanceId: instance.id,
              submittedAt,
            },
          },
          tx,
        );

        return this.visibleAgreement(context.auth, agreement.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  approveInitialAgreement(
    context: AuditContext,
    agreementId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideInitialAgreement(
      context,
      agreementId,
      'APPROVE',
      actionKey,
      comment,
    );
  }

  rejectInitialAgreement(
    context: AuditContext,
    agreementId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideInitialAgreement(
      context,
      agreementId,
      'REJECT',
      actionKey,
      comment,
    );
  }

  async createRevision(
    context: AuditContext,
    agreementId: string,
    input: AgreementRevisionInput,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visibleAgreement(context.auth, agreementId, tx);
        await this.lockAgreement(context.auth.companyId, agreementId, tx);
        const agreement = await this.agreementById(
          context.auth.companyId,
          agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);

        const activeRevision = await tx.subcontractAgreementVersion.findFirst({
          where: {
            agreementId,
            versionNo: { gt: 1 },
            approvalState: { in: ['DRAFT', APPROVAL_STATE.SUBMITTED] },
          },
          select: { id: true },
        });
        if (activeRevision) {
          throw new ConflictException({
            code: 'AGREEMENT_REVISION_ALREADY_ACTIVE',
            detail: 'Complete or reject the current administrative revision before creating another.',
          });
        }

        if (input.operationalStatusId !== undefined) {
          await this.assertStatus(
            context.auth.companyId,
            input.operationalStatusId,
            tx,
          );
        }

        const latest = await tx.subcontractAgreementVersion.aggregate({
          where: { agreementId },
          _max: { versionNo: true },
        });
        const versionNo = (latest._max.versionNo ?? 1) + 1;

        const version = await tx.subcontractAgreementVersion.create({
          data: {
            companyId: agreement.companyId,
            projectId: agreement.projectId,
            agreementId: agreement.id,
            versionNo,
            originalValue: agreement.originalValue,
            scopeOfWork: agreement.scopeOfWork,
            currencyCode: agreement.currencyCode,
            operationalStatusId:
              input.operationalStatusId === undefined
                ? agreement.operationalStatusId
                : input.operationalStatusId,
            reason: input.reason,
            createdByUserId: context.auth.userId,
          },
          include: this.versionInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT_VERSION',
            entityId: version.id,
            action: 'CREATE_REVISION',
            newValues: {
              agreementId,
              versionNo,
              operationalStatusId: version.operationalStatusId,
              reason: version.reason,
            },
          },
          tx,
        );

        return version;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateRevision(
    context: AuditContext,
    versionId: string,
    input: AgreementRevisionUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const version = await this.visibleVersion(context.auth, versionId, tx);
      await this.lockAgreement(
        context.auth.companyId,
        version.agreementId,
        tx,
      );
      await this.lockVersion(context.auth.companyId, versionId, tx);
      const current = await this.versionById(
        context.auth.companyId,
        versionId,
        tx,
      );

      if (current.versionNo <= 1 || current.approvalState !== 'DRAFT') {
        throw new ConflictException({
          code: 'AGREEMENT_REVISION_NOT_DRAFT',
          detail: 'Only a Draft administrative revision can be edited.',
        });
      }
      if (input.operationalStatusId !== undefined) {
        await this.assertStatus(
          context.auth.companyId,
          input.operationalStatusId,
          tx,
        );
      }

      const updated = await tx.subcontractAgreementVersion.update({
        where: { id: current.id },
        data: {
          ...(input.operationalStatusId !== undefined
            ? { operationalStatusId: input.operationalStatusId }
            : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
        },
        include: this.versionInclude(),
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_AGREEMENT_VERSION',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: {
            operationalStatusId: current.operationalStatusId,
            reason: current.reason,
          },
          newValues: {
            operationalStatusId: updated.operationalStatusId,
            reason: updated.reason,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async submitRevision(
    context: AuditContext,
    versionId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleVersion(context.auth, versionId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockVersion(context.auth.companyId, versionId, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'AGREEMENT_REVISION_SUBMIT',
          'SUBCONTRACT_AGREEMENT_VERSION',
          versionId,
          [workflowCode],
        );
        if (replay) {
          return this.visibleVersion(context.auth, versionId, tx);
        }

        const version = await this.versionById(
          context.auth.companyId,
          versionId,
          tx,
        );
        if (version.versionNo <= 1 || version.approvalState !== 'DRAFT') {
          throw new ConflictException({
            code: 'AGREEMENT_REVISION_NOT_DRAFT',
            detail: 'Only a Draft administrative revision can be submitted.',
          });
        }
        if (!version.reason?.trim()) {
          throw new UnprocessableEntityException({
            code: 'AGREEMENT_REVISION_REASON_REQUIRED',
            detail: 'Administrative revisions require a reason.',
          });
        }

        const agreement = await this.agreementById(
          context.auth.companyId,
          version.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        this.assertCommercialSnapshot(agreement, version);
        await this.assertStatus(
          context.auth.companyId,
          version.operationalStatusId,
          tx,
        );

        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: version.id,
          },
          tx,
        );
        const submittedAt = new Date();
        const updated = await tx.subcontractAgreementVersion.update({
          where: { id: version.id },
          data: {
            approvalState: APPROVAL_STATE.SUBMITTED,
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
          include: this.versionInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT_VERSION',
            entityId: version.id,
            action: 'SUBMIT',
            newValues: {
              agreementId: version.agreementId,
              versionNo: version.versionNo,
              workflowCode,
              approvalInstanceId: instance.id,
              submittedAt,
            },
          },
          tx,
        );
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  approveRevision(
    context: AuditContext,
    versionId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideRevision(
      context,
      versionId,
      'APPROVE',
      actionKey,
      comment,
    );
  }

  rejectRevision(
    context: AuditContext,
    versionId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideRevision(
      context,
      versionId,
      'REJECT',
      actionKey,
      comment,
    );
  }

  async cancelAgreement(
    context: AuditContext,
    agreementId: string,
    reason: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visibleAgreement(context.auth, agreementId, tx);
        await this.lockAgreement(context.auth.companyId, agreementId, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'AGREEMENT_CANCEL',
          'SUBCONTRACT_AGREEMENT',
          agreementId,
          [reason],
        );
        if (replay) {
          return this.visibleAgreement(context.auth, agreementId, tx);
        }

        const agreement = await this.agreementById(
          context.auth.companyId,
          agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);

        const pendingRevision = await tx.subcontractAgreementVersion.findFirst({
          where: {
            agreementId,
            approvalState: APPROVAL_STATE.SUBMITTED,
          },
          select: { id: true },
        });
        if (pendingRevision) {
          throw new ConflictException({
            code: 'AGREEMENT_REVISION_PENDING',
            detail: 'Resolve the submitted administrative revision before cancelling the agreement.',
          });
        }

        const blockingWorkOrder = await tx.subcontractWorkOrder.findFirst({
          where: {
            agreementId,
            approvalState: {
              in: [APPROVAL_STATE.SUBMITTED, APPROVAL_STATE.APPROVED],
            },
          },
          select: { id: true, workOrderNumber: true },
        });
        if (blockingWorkOrder) {
          throw new ConflictException({
            code: 'AGREEMENT_HAS_ACTIVE_WORK_ORDER',
            detail: 'An agreement with a submitted or approved Work Order cannot be cancelled.',
          });
        }

        const cancelledAt = new Date();
        const updated = await tx.subcontractAgreement.update({
          where: { id: agreement.id },
          data: {
            approvalState: APPROVAL_STATE.CANCELLED,
            cancelledAt,
            cancelledByUserId: context.auth.userId,
            cancellationReason: reason,
          },
          include: this.agreementInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: agreement.id,
            action: 'CANCEL',
            oldValues: { approvalState: agreement.approvalState },
            newValues: {
              approvalState: APPROVAL_STATE.CANCELLED,
              cancelledAt,
              cancellationReason: reason,
            },
          },
          tx,
        );
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async workOrderOptions(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    const agreement = await this.visibleAgreement(
      auth,
      agreementId,
      this.prisma,
    );
    this.assertApprovedAgreement(agreement);

    const [wbs, costCodes] = await Promise.all([
      this.prisma.wbsElement.findMany({
        where: { projectId: agreement.projectId, isActive: true },
        select: { id: true, wbsCode: true, wbsName: true },
        orderBy: { wbsCode: 'asc' },
      }),
      this.prisma.costCode.findMany({
        where: { companyId: auth.companyId, isActive: true },
        select: { id: true, costCode: true, costName: true },
        orderBy: { costCode: 'asc' },
      }),
    ]);

    return {
      agreement: {
        id: agreement.id,
        agreementNumber: agreement.agreementNumber,
        currencyCode: agreement.currencyCode,
        originalValue: agreement.originalValue,
      },
      wbs,
      costCodes,
    };
  }

  async listWorkOrders(
    auth: AuthenticatedUserContext,
    agreementId: string,
  ) {
    await this.visibleAgreement(auth, agreementId, this.prisma);
    return this.prisma.subcontractWorkOrder.findMany({
      where: { companyId: auth.companyId, agreementId },
      include: this.workOrderInclude(),
      orderBy: { sequenceNo: 'asc' },
    });
  }

  getWorkOrder(auth: AuthenticatedUserContext, workOrderId: string) {
    return this.visibleWorkOrder(auth, workOrderId, this.prisma);
  }

  async createWorkOrder(
    context: AuditContext,
    agreementId: string,
    input: WorkOrderDraftInput,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visibleAgreement(context.auth, agreementId, tx);
        await this.lockAgreement(context.auth.companyId, agreementId, tx);
        const agreement = await this.agreementById(
          context.auth.companyId,
          agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        await this.assertWorkOrderReferences(
          context.auth.companyId,
          agreement.projectId,
          input.wbsElementId,
          input.costCodeId,
          tx,
        );

        const latest = await tx.subcontractWorkOrder.aggregate({
          where: { agreementId },
          _max: { sequenceNo: true },
        });
        const sequenceNo = (latest._max.sequenceNo ?? 0) + 1;
        if (sequenceNo > 999) {
          throw new ConflictException({
            code: 'WORK_ORDER_SEQUENCE_EXHAUSTED',
            detail: 'This agreement has exhausted the approved WO-### sequence.',
          });
        }
        const workOrderNumber = 'WO-' + String(sequenceNo).padStart(3, '0');

        const row = await tx.subcontractWorkOrder.create({
          data: {
            companyId: agreement.companyId,
            projectId: agreement.projectId,
            agreementId: agreement.id,
            sequenceNo,
            workOrderNumber,
            scopeOfWork: input.scopeOfWork,
            amount: input.amount,
            wbsElementId: input.wbsElementId ?? null,
            costCodeId: input.costCodeId ?? null,
            createdByUserId: context.auth.userId,
          },
          include: this.workOrderInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_WORK_ORDER',
            entityId: row.id,
            action: 'CREATE_DRAFT',
            newValues: {
              agreementId,
              workOrderNumber,
              amount: row.amount.toString(),
              wbsElementId: row.wbsElementId,
              costCodeId: row.costCodeId,
            },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async updateWorkOrder(
    context: AuditContext,
    workOrderId: string,
    input: WorkOrderDraftUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const visible = await this.visibleWorkOrder(
        context.auth,
        workOrderId,
        tx,
      );
      await this.lockWorkOrder(context.auth.companyId, workOrderId, tx);
      const current = await this.workOrderById(
        context.auth.companyId,
        workOrderId,
        tx,
      );
      if (current.approvalState !== 'DRAFT') {
        throw new ConflictException({
          code: 'WORK_ORDER_NOT_DRAFT',
          detail: 'Only a Draft Work Order can be edited.',
        });
      }

      await this.assertWorkOrderReferences(
        context.auth.companyId,
        visible.projectId,
        input.wbsElementId === undefined
          ? current.wbsElementId
          : input.wbsElementId,
        input.costCodeId === undefined
          ? current.costCodeId
          : input.costCodeId,
        tx,
      );

      const updated = await tx.subcontractWorkOrder.update({
        where: { id: current.id },
        data: {
          ...(input.scopeOfWork !== undefined
            ? { scopeOfWork: input.scopeOfWork }
            : {}),
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.wbsElementId !== undefined
            ? { wbsElementId: input.wbsElementId }
            : {}),
          ...(input.costCodeId !== undefined
            ? { costCodeId: input.costCodeId }
            : {}),
        },
        include: this.workOrderInclude(),
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_WORK_ORDER',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: {
            scopeOfWork: current.scopeOfWork,
            amount: current.amount.toString(),
            wbsElementId: current.wbsElementId,
            costCodeId: current.costCodeId,
          },
          newValues: {
            scopeOfWork: updated.scopeOfWork,
            amount: updated.amount.toString(),
            wbsElementId: updated.wbsElementId,
            costCodeId: updated.costCodeId,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async submitWorkOrder(
    context: AuditContext,
    workOrderId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleWorkOrder(
          context.auth,
          workOrderId,
          tx,
        );
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockWorkOrder(
          context.auth.companyId,
          workOrderId,
          tx,
        );

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'WORK_ORDER_SUBMIT',
          'SUBCONTRACT_WORK_ORDER',
          workOrderId,
          [workflowCode],
        );
        if (replay) {
          return this.visibleWorkOrder(context.auth, workOrderId, tx);
        }

        const workOrder = await this.workOrderById(
          context.auth.companyId,
          workOrderId,
          tx,
        );
        if (workOrder.approvalState !== 'DRAFT') {
          throw new ConflictException({
            code: 'WORK_ORDER_NOT_DRAFT',
            detail: 'Only a Draft Work Order can be submitted.',
          });
        }

        const agreement = await this.agreementById(
          context.auth.companyId,
          workOrder.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        await this.assertWorkOrderReferences(
          context.auth.companyId,
          workOrder.projectId,
          workOrder.wbsElementId,
          workOrder.costCodeId,
          tx,
        );

        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SUBCONTRACT_WORK_ORDER',
            entityId: workOrder.id,
          },
          tx,
        );
        const submittedAt = new Date();
        const updated = await tx.subcontractWorkOrder.update({
          where: { id: workOrder.id },
          data: {
            approvalState: APPROVAL_STATE.SUBMITTED,
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
          include: this.workOrderInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_WORK_ORDER',
            entityId: workOrder.id,
            action: 'SUBMIT',
            newValues: {
              workflowCode,
              approvalInstanceId: instance.id,
              submittedAt,
            },
          },
          tx,
        );
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  approveWorkOrder(
    context: AuditContext,
    workOrderId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideWorkOrder(
      context,
      workOrderId,
      'APPROVE',
      actionKey,
      comment,
    );
  }

  rejectWorkOrder(
    context: AuditContext,
    workOrderId: string,
    actionKey: string,
    comment?: string,
  ) {
    return this.decideWorkOrder(
      context,
      workOrderId,
      'REJECT',
      actionKey,
      comment,
    );
  }

  private async decideInitialAgreement(
    context: AuditContext,
    agreementId: string,
    action: 'APPROVE' | 'REJECT',
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.visibleAgreement(context.auth, agreementId, tx);
        await this.lockAgreement(context.auth.companyId, agreementId, tx);

        const version = await tx.subcontractAgreementVersion.findFirst({
          where: {
            companyId: context.auth.companyId,
            agreementId,
            versionNo: 1,
          },
        });
        if (!version) throw this.notFound('Agreement version');
        await this.lockVersion(context.auth.companyId, version.id, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'AGREEMENT_' + action,
          'SUBCONTRACT_AGREEMENT_VERSION',
          version.id,
          [comment ?? null],
        );
        if (replay) {
          return this.visibleAgreement(context.auth, agreementId, tx);
        }

        const current = await this.versionById(
          context.auth.companyId,
          version.id,
          tx,
        );
        this.assertVersionSubmitted(current);

        const agreement = await this.agreementById(
          context.auth.companyId,
          agreementId,
          tx,
        );
        if (agreement.approvalState !== APPROVAL_STATE.SUBMITTED) {
          throw new ConflictException({
            code: 'AGREEMENT_NOT_SUBMITTED',
            detail: 'The original agreement is not awaiting approval.',
          });
        }
        this.assertCommercialSnapshot(agreement, current);

        const instance =
          action === 'APPROVE'
            ? await this.approvals.approve(
                current.approvalInstanceId!,
                context.auth,
                current.submittedByUserId!,
                comment,
                async (approvalTx) => {
                  await this.assertCurrentAgreementReferences(
                    agreement,
                    approvalTx,
                  );
                  const decidedAt = new Date();
                  await approvalTx.subcontractAgreementVersion.update({
                    where: { id: current.id },
                    data: {
                      approvalState: APPROVAL_STATE.APPROVED,
                      decidedAt,
                    },
                  });
                  await approvalTx.subcontractAgreement.update({
                    where: { id: agreement.id },
                    data: {
                      approvalState: APPROVAL_STATE.APPROVED,
                      firstApprovedAt: decidedAt,
                      operationalStatusId: current.operationalStatusId,
                    },
                  });
                },
                tx,
              )
            : await this.approvals.reject(
                current.approvalInstanceId!,
                context.auth,
                current.submittedByUserId!,
                comment,
                tx,
              );

        if (action === 'REJECT') {
          const decidedAt = new Date();
          await tx.subcontractAgreementVersion.update({
            where: { id: current.id },
            data: {
              approvalState: APPROVAL_STATE.REJECTED,
              decidedAt,
            },
          });
          await tx.subcontractAgreement.update({
            where: { id: agreement.id },
            data: { approvalState: APPROVAL_STATE.REJECTED },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: agreement.id,
            action: 'APPROVAL_' + action,
            newValues: {
              versionId: current.id,
              approvalInstanceId: instance.id,
              approvalState: instance.approvalState,
            },
          },
          tx,
        );

        return this.visibleAgreement(context.auth, agreement.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async decideRevision(
    context: AuditContext,
    versionId: string,
    action: 'APPROVE' | 'REJECT',
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleVersion(context.auth, versionId, tx);
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockVersion(context.auth.companyId, versionId, tx);

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'AGREEMENT_REVISION_' + action,
          'SUBCONTRACT_AGREEMENT_VERSION',
          versionId,
          [comment ?? null],
        );
        if (replay) {
          return this.visibleVersion(context.auth, versionId, tx);
        }

        const version = await this.versionById(
          context.auth.companyId,
          versionId,
          tx,
        );
        if (version.versionNo <= 1) {
          throw new ConflictException({
            code: 'AGREEMENT_REVISION_REQUIRED',
            detail: 'Use the original agreement approval action for Version 1.',
          });
        }
        this.assertVersionSubmitted(version);

        const agreement = await this.agreementById(
          context.auth.companyId,
          version.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);
        this.assertCommercialSnapshot(agreement, version);

        const instance =
          action === 'APPROVE'
            ? await this.approvals.approve(
                version.approvalInstanceId!,
                context.auth,
                version.submittedByUserId!,
                comment,
                async (approvalTx) => {
                  const lockedAgreement = await this.agreementById(
                    context.auth.companyId,
                    agreement.id,
                    approvalTx,
                  );
                  this.assertApprovedAgreement(lockedAgreement);
                  this.assertCommercialSnapshot(lockedAgreement, version);
                  await this.assertStatus(
                    context.auth.companyId,
                    version.operationalStatusId,
                    approvalTx,
                  );
                  const decidedAt = new Date();
                  await approvalTx.subcontractAgreementVersion.update({
                    where: { id: version.id },
                    data: {
                      approvalState: APPROVAL_STATE.APPROVED,
                      decidedAt,
                    },
                  });
                  await approvalTx.subcontractAgreement.update({
                    where: { id: agreement.id },
                    data: {
                      operationalStatusId: version.operationalStatusId,
                    },
                  });
                },
                tx,
              )
            : await this.approvals.reject(
                version.approvalInstanceId!,
                context.auth,
                version.submittedByUserId!,
                comment,
                tx,
              );

        if (action === 'REJECT') {
          await tx.subcontractAgreementVersion.update({
            where: { id: version.id },
            data: {
              approvalState: APPROVAL_STATE.REJECTED,
              decidedAt: new Date(),
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT_VERSION',
            entityId: version.id,
            action: 'APPROVAL_' + action,
            newValues: {
              agreementId: agreement.id,
              versionNo: version.versionNo,
              approvalInstanceId: instance.id,
              approvalState: instance.approvalState,
            },
          },
          tx,
        );

        return this.visibleVersion(context.auth, version.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async decideWorkOrder(
    context: AuditContext,
    workOrderId: string,
    action: 'APPROVE' | 'REJECT',
    actionKey: string,
    comment?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const visible = await this.visibleWorkOrder(
          context.auth,
          workOrderId,
          tx,
        );
        await this.lockAgreement(
          context.auth.companyId,
          visible.agreementId,
          tx,
        );
        await this.lockWorkOrder(
          context.auth.companyId,
          workOrderId,
          tx,
        );

        const replay = await this.claimReplay(
          tx,
          context.auth,
          actionKey,
          'WORK_ORDER_' + action,
          'SUBCONTRACT_WORK_ORDER',
          workOrderId,
          [comment ?? null],
        );
        if (replay) {
          return this.visibleWorkOrder(context.auth, workOrderId, tx);
        }

        const workOrder = await this.workOrderById(
          context.auth.companyId,
          workOrderId,
          tx,
        );
        this.assertWorkOrderSubmitted(workOrder);

        const agreement = await this.agreementById(
          context.auth.companyId,
          workOrder.agreementId,
          tx,
        );
        this.assertApprovedAgreement(agreement);

        const instance =
          action === 'APPROVE'
            ? await this.approvals.approve(
                workOrder.approvalInstanceId!,
                context.auth,
                workOrder.submittedByUserId!,
                comment,
                async (approvalTx) => {
                  const lockedAgreement = await this.agreementById(
                    context.auth.companyId,
                    agreement.id,
                    approvalTx,
                  );
                  this.assertApprovedAgreement(lockedAgreement);
                  const currentWorkOrder = await this.workOrderById(
                    context.auth.companyId,
                    workOrder.id,
                    approvalTx,
                  );
                  this.assertWorkOrderSubmitted(currentWorkOrder);
                  await this.assertWorkOrderReferences(
                    context.auth.companyId,
                    currentWorkOrder.projectId,
                    currentWorkOrder.wbsElementId,
                    currentWorkOrder.costCodeId,
                    approvalTx,
                  );

                  const allocated = await approvalTx.subcontractWorkOrder.aggregate({
                    where: {
                      agreementId: agreement.id,
                      approvalState: APPROVAL_STATE.APPROVED,
                    },
                    _sum: { amount: true },
                  });
                  const total = new Prisma.Decimal(
                    allocated._sum.amount ?? 0,
                  ).plus(currentWorkOrder.amount);
                  if (total.gt(lockedAgreement.originalValue)) {
                    throw new ConflictException({
                      code: 'WORK_ORDER_CEILING_EXCEEDED',
                      detail: 'Approved Work Orders cannot exceed the current agreement commercial ceiling.',
                    });
                  }

                  await approvalTx.subcontractWorkOrder.update({
                    where: { id: currentWorkOrder.id },
                    data: {
                      approvalState: APPROVAL_STATE.APPROVED,
                      decidedAt: new Date(),
                    },
                  });
                },
                tx,
              )
            : await this.approvals.reject(
                workOrder.approvalInstanceId!,
                context.auth,
                workOrder.submittedByUserId!,
                comment,
                tx,
              );

        if (action === 'REJECT') {
          await tx.subcontractWorkOrder.update({
            where: { id: workOrder.id },
            data: {
              approvalState: APPROVAL_STATE.REJECTED,
              decidedAt: new Date(),
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_WORK_ORDER',
            entityId: workOrder.id,
            action: 'APPROVAL_' + action,
            newValues: {
              agreementId: agreement.id,
              workOrderNumber: workOrder.workOrderNumber,
              approvalInstanceId: instance.id,
              approvalState: instance.approvalState,
            },
          },
          tx,
        );

        return this.visibleWorkOrder(context.auth, workOrder.id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
      data: [
        {
          companyId: auth.companyId,
          userId: auth.userId,
          actionKey,
          actionType,
          entityType,
          entityId,
          payloadHash,
        },
      ],
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
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail:
        'This action key is already paired with a different Subcontracts action, record, or payload.',
    });
  }

  private async visibleAgreement(
    auth: AuthenticatedUserContext,
    id: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractAgreement.findFirst({
      where: {
        id,
        companyId: auth.companyId,
        project: scope,
      },
      include: this.agreementInclude(),
    });
    if (row) return row;

    const exists = await db.subcontractAgreement.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Subcontract agreement');
    throw this.projectDenied();
  }

  private async visibleVersion(
    auth: AuthenticatedUserContext,
    id: string,
    db: SubcontractDb,
  ) {
    const row = await db.subcontractAgreementVersion.findFirst({
      where: { id, companyId: auth.companyId },
      include: this.versionInclude(),
    });
    if (!row) throw this.notFound('Agreement version');
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private async visibleWorkOrder(
    auth: AuthenticatedUserContext,
    id: string,
    db: SubcontractDb,
  ) {
    const row = await db.subcontractWorkOrder.findFirst({
      where: { id, companyId: auth.companyId },
      include: this.workOrderInclude(),
    });
    if (!row) throw this.notFound('Work Order');
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private agreementById(
    companyId: string,
    id: string,
    db: SubcontractDb,
  ) {
    return db.subcontractAgreement.findFirstOrThrow({
      where: { id, companyId },
    });
  }

  private versionById(
    companyId: string,
    id: string,
    db: SubcontractDb,
  ) {
    return db.subcontractAgreementVersion.findFirstOrThrow({
      where: { id, companyId },
    });
  }

  private workOrderById(
    companyId: string,
    id: string,
    db: SubcontractDb,
  ) {
    return db.subcontractWorkOrder.findFirstOrThrow({
      where: { id, companyId },
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

  private async lockVersion(
    companyId: string,
    versionId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "subcontract_agreement_versions"
        WHERE "id" = ${versionId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockWorkOrder(
    companyId: string,
    workOrderId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "subcontract_work_orders"
        WHERE "id" = ${workOrderId}::uuid
          AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async assertCurrentAgreementReferences(
    agreement: {
      companyId: string;
      projectId: string;
      subcontractorId: string;
      operationalStatusId: string | null;
    },
    db: SubcontractDb,
  ) {
    const [project, subcontractor] = await Promise.all([
      db.project.findFirst({
        where: {
          id: agreement.projectId,
          companyId: agreement.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      db.subcontractor.findFirst({
        where: {
          id: agreement.subcontractorId,
          companyId: agreement.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!project || !subcontractor) {
      throw new ConflictException({
        code: 'AGREEMENT_REFERENCE_INACTIVE',
        detail: 'Agreement approval requires an active Project and Subcontractor.',
      });
    }
    await this.assertStatus(
      agreement.companyId,
      agreement.operationalStatusId,
      db,
    );
  }

  private async assertStatus(
    companyId: string,
    statusId: string | null | undefined,
    db: SubcontractDb,
  ) {
    if (!statusId) return;
    const row = await db.statusDefinition.findFirst({
      where: {
        id: statusId,
        companyId,
        entityType: 'SUBCONTRACT_AGREEMENT',
        isActive: true,
      },
      select: { id: true },
    });
    if (!row) {
      throw new UnprocessableEntityException({
        code: 'INVALID_AGREEMENT_STATUS',
        detail: 'Operational status must be active and belong to the same Company.',
      });
    }
  }

  private async assertWorkOrderReferences(
    companyId: string,
    projectId: string,
    wbsElementId: string | null | undefined,
    costCodeId: string | null | undefined,
    db: SubcontractDb,
  ) {
    const [wbs, costCode] = await Promise.all([
      wbsElementId
        ? db.wbsElement.findFirst({
            where: {
              id: wbsElementId,
              projectId,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      costCodeId
        ? db.costCode.findFirst({
            where: {
              id: costCodeId,
              companyId,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);
    if (wbsElementId && !wbs) {
      throw new UnprocessableEntityException({
        code: 'WORK_ORDER_WBS_INVALID',
        detail: 'Work Order WBS must be active and belong to the same Project.',
      });
    }
    if (costCodeId && !costCode) {
      throw new UnprocessableEntityException({
        code: 'WORK_ORDER_COST_CODE_INVALID',
        detail: 'Work Order Cost Code must be active and belong to the same Company.',
      });
    }
  }

  private assertApprovedAgreement(agreement: {
    approvalState: string;
    firstApprovedAt: Date | null;
    cancelledAt: Date | null;
  }) {
    if (
      agreement.approvalState !== APPROVAL_STATE.APPROVED ||
      !agreement.firstApprovedAt ||
      agreement.cancelledAt
    ) {
      throw new ConflictException({
        code: 'AGREEMENT_NOT_APPROVED',
        detail: 'This action requires an approved, non-cancelled agreement.',
      });
    }
  }

  private assertCommercialSnapshot(
    agreement: {
      originalValue: Prisma.Decimal;
      scopeOfWork: string;
      currencyCode: string;
    },
    version: {
      originalValue: Prisma.Decimal;
      scopeOfWork: string;
      currencyCode: string;
    },
  ) {
    if (
      !agreement.originalValue.equals(version.originalValue) ||
      agreement.scopeOfWork !== version.scopeOfWork ||
      agreement.currencyCode !== version.currencyCode
    ) {
      throw new ConflictException({
        code: 'AGREEMENT_COMMERCIAL_SNAPSHOT_MISMATCH',
        detail: 'Administrative revisions cannot alter approved commercial fields.',
      });
    }
  }

  private assertVersionSubmitted(version: {
    approvalState: string;
    approvalInstanceId: string | null;
    submittedByUserId: string | null;
  }) {
    if (
      version.approvalState !== APPROVAL_STATE.SUBMITTED ||
      !version.approvalInstanceId ||
      !version.submittedByUserId
    ) {
      throw new ConflictException({
        code: 'AGREEMENT_VERSION_NOT_SUBMITTED',
        detail: 'This agreement version is not awaiting an approval action.',
      });
    }
  }

  private assertWorkOrderSubmitted(workOrder: {
    approvalState: string;
    approvalInstanceId: string | null;
    submittedByUserId: string | null;
  }) {
    if (
      workOrder.approvalState !== APPROVAL_STATE.SUBMITTED ||
      !workOrder.approvalInstanceId ||
      !workOrder.submittedByUserId
    ) {
      throw new ConflictException({
        code: 'WORK_ORDER_NOT_SUBMITTED',
        detail: 'This Work Order is not awaiting an approval action.',
      });
    }
  }

  private agreementInclude() {
    return {
      project: {
        select: { id: true, projectCode: true, projectName: true },
      },
      subcontractor: {
        select: {
          id: true,
          subcontractorCode: true,
          subcontractorName: true,
          isActive: true,
        },
      },
      operationalStatus: {
        select: { id: true, statusCode: true, statusLabel: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
      cancelledBy: {
        select: { id: true, displayName: true },
      },
    } satisfies Prisma.SubcontractAgreementInclude;
  }

  private versionInclude() {
    return {
      operationalStatus: {
        select: { id: true, statusCode: true, statusLabel: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
      submittedBy: {
        select: { id: true, displayName: true },
      },
      approvalInstance: {
        include: {
          workflow: {
            select: { id: true, workflowCode: true, workflowName: true },
          },
          actions: {
            orderBy: { actionAt: 'asc' as const },
            include: {
              approvalStep: {
                select: { stepNo: true },
              },
              actionByUser: {
                select: { id: true, displayName: true },
              },
            },
          },
        },
      },
    } satisfies Prisma.SubcontractAgreementVersionInclude;
  }

  private workOrderInclude() {
    return {
      agreement: {
        select: {
          id: true,
          agreementNumber: true,
          currencyCode: true,
          originalValue: true,
          approvalState: true,
          cancelledAt: true,
        },
      },
      wbsElement: {
        select: { id: true, wbsCode: true, wbsName: true },
      },
      costCode: {
        select: { id: true, costCode: true, costName: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
      submittedBy: {
        select: { id: true, displayName: true },
      },
      approvalInstance: {
        include: {
          workflow: {
            select: { id: true, workflowCode: true, workflowName: true },
          },
          actions: {
            orderBy: { actionAt: 'asc' as const },
            include: {
              approvalStep: {
                select: { stepNo: true },
              },
              actionByUser: {
                select: { id: true, displayName: true },
              },
            },
          },
        },
      },
    } satisfies Prisma.SubcontractWorkOrderInclude;
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
