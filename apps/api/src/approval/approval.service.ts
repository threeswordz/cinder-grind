import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export const APPROVAL_STATE = {
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

@Injectable()
export class ApprovalService {
  constructor(private readonly prisma: PrismaService) {}

  async start(
    input: {
      companyId: string;
      workflowCode: string;
      entityType: string;
      entityId: string;
    },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? this.prisma;
    const workflow = await db.approvalWorkflow.findFirst({
      where: {
        companyId: input.companyId,
        workflowCode: input.workflowCode,
        entityType: input.entityType,
        isActive: true,
      },
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          take: 1,
        },
      },
    });

    if (!workflow || workflow.steps.length === 0) {
      throw new UnprocessableEntityException({
        code: 'APPROVAL_WORKFLOW_NOT_AVAILABLE',
        detail: 'No active approval workflow is configured for this record.',
      });
    }

    const existing = await db.approvalInstance.findFirst({
      where: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        approvalState: APPROVAL_STATE.SUBMITTED,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'APPROVAL_ALREADY_IN_PROGRESS',
        detail: 'An approval process is already in progress for this record.',
      });
    }

    return db.approvalInstance.create({
      data: {
        companyId: input.companyId,
        approvalWorkflowId: workflow.id,
        entityType: input.entityType,
        entityId: input.entityId,
        currentStepNo: workflow.steps[0]!.stepNo,
        approvalState: APPROVAL_STATE.SUBMITTED,
      },
    });
  }

  async approve(
    instanceId: string,
    auth: AuthenticatedUserContext,
    makerUserId: string,
    comment?: string,
  ) {
    this.assertMakerChecker(makerUserId, auth.userId);

    return this.prisma.$transaction(
      async (tx) => {
        const context = await this.loadActionContext(
          tx,
          instanceId,
          auth.companyId,
        );
        this.assertSubmitted(context.instance.approvalState);
        this.assertStepRole(context.currentStep, auth);
        await this.assertNoPriorAction(
          tx,
          instanceId,
          context.currentStep.id,
          auth.userId,
        );

        await tx.approvalAction.create({
          data: {
            approvalInstanceId: instanceId,
            approvalStepId: context.currentStep.id,
            action: 'APPROVE',
            actionByUserId: auth.userId,
            ...(comment ? { comment } : {}),
          },
        });

        const approvalCount = await tx.approvalAction.count({
          where: {
            approvalInstanceId: instanceId,
            approvalStepId: context.currentStep.id,
            action: 'APPROVE',
          },
        });

        if (approvalCount < context.currentStep.requiredApprovals) {
          return context.instance;
        }

        const nextStep = context.steps.find(
          (step) => step.stepNo > context.currentStep.stepNo,
        );

        if (nextStep) {
          return tx.approvalInstance.update({
            where: { id: instanceId },
            data: { currentStepNo: nextStep.stepNo },
          });
        }

        return tx.approvalInstance.update({
          where: { id: instanceId },
          data: {
            approvalState: APPROVAL_STATE.APPROVED,
            completedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reject(
    instanceId: string,
    auth: AuthenticatedUserContext,
    makerUserId: string,
    comment?: string,
  ) {
    this.assertMakerChecker(makerUserId, auth.userId);

    return this.prisma.$transaction(
      async (tx) => {
        const context = await this.loadActionContext(
          tx,
          instanceId,
          auth.companyId,
        );
        this.assertSubmitted(context.instance.approvalState);
        this.assertStepRole(context.currentStep, auth);
        await this.assertNoPriorAction(
          tx,
          instanceId,
          context.currentStep.id,
          auth.userId,
        );

        await tx.approvalAction.create({
          data: {
            approvalInstanceId: instanceId,
            approvalStepId: context.currentStep.id,
            action: 'REJECT',
            actionByUserId: auth.userId,
            ...(comment ? { comment } : {}),
          },
        });

        return tx.approvalInstance.update({
          where: { id: instanceId },
          data: {
            approvalState: APPROVAL_STATE.REJECTED,
            completedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async cancel(
    instanceId: string,
    auth: AuthenticatedUserContext,
    existingTx?: Prisma.TransactionClient,
  ) {
    const cancelIn = async (tx: Prisma.TransactionClient) => {
      const context = await this.loadActionContext(
        tx,
        instanceId,
        auth.companyId,
      );
      this.assertSubmitted(context.instance.approvalState);

      await tx.approvalAction.create({
        data: {
          approvalInstanceId: instanceId,
          approvalStepId: context.currentStep.id,
          action: 'CANCEL',
          actionByUserId: auth.userId,
        },
      });

      return tx.approvalInstance.update({
        where: { id: instanceId },
        data: {
          approvalState: APPROVAL_STATE.CANCELLED,
          completedAt: new Date(),
        },
      });
    };

    if (existingTx) return cancelIn(existingTx);
    return this.prisma.$transaction(cancelIn);
  }

  assertMakerChecker(makerUserId: string, approverUserId: string): void {
    if (makerUserId === approverUserId) {
      throw new ForbiddenException({
        code: 'MAKER_CHECKER_VIOLATION',
        detail: 'The maker cannot approve or reject the same record.',
      });
    }
  }

  private assertSubmitted(state: string): void {
    if (state !== APPROVAL_STATE.SUBMITTED) {
      throw new ConflictException({
        code: 'APPROVAL_STATE_INVALID',
        detail: 'This approval process is no longer awaiting approval.',
      });
    }
  }

  private assertStepRole(
    step: {
      stepRoles: Array<{ role: { roleCode: string; isActive: boolean } }>;
    },
    auth: AuthenticatedUserContext,
  ): void {
    const allowed = step.stepRoles.some(
      (assignment) =>
        assignment.role.isActive &&
        auth.roleCodes.includes(assignment.role.roleCode),
    );

    if (!allowed) {
      throw new ForbiddenException({
        code: 'APPROVAL_ROLE_DENIED',
        detail: 'Your role is not authorized for the current approval step.',
      });
    }
  }

  private async assertNoPriorAction(
    tx: Prisma.TransactionClient,
    instanceId: string,
    stepId: string,
    userId: string,
  ): Promise<void> {
    const existing = await tx.approvalAction.findFirst({
      where: {
        approvalInstanceId: instanceId,
        approvalStepId: stepId,
        actionByUserId: userId,
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: 'APPROVAL_ACTION_ALREADY_RECORDED',
        detail: 'You have already acted on the current approval step.',
      });
    }
  }

  private async loadActionContext(
    tx: Prisma.TransactionClient,
    instanceId: string,
    companyId: string,
  ) {
    const instance = await tx.approvalInstance.findFirst({
      where: { id: instanceId, companyId },
      include: {
        workflow: {
          include: {
            steps: {
              orderBy: { stepNo: 'asc' },
              include: {
                stepRoles: {
                  include: { role: true },
                },
              },
            },
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException({
        code: 'APPROVAL_NOT_FOUND',
        detail: 'Approval process not found.',
      });
    }

    const steps = instance.workflow.steps;
    const currentStep = steps.find(
      (step) => step.stepNo === instance.currentStepNo,
    );

    if (!currentStep) {
      throw new ConflictException({
        code: 'APPROVAL_CONFIGURATION_INVALID',
        detail: 'The approval workflow configuration is inconsistent.',
      });
    }

    return { instance, steps, currentStep };
  }
}
