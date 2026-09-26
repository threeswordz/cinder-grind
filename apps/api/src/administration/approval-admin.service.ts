import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type ApprovalStepInput = {
  stepNo: number;
  stepName: string;
  requiredApprovals: number;
  roleIds: string[];
};

@Injectable()
export class ApprovalAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listRoleOptions(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId, isActive: true },
      orderBy: { roleName: 'asc' },
      select: {
        id: true,
        roleCode: true,
        roleName: true,
        isActive: true,
      },
    });
  }

  listWorkflows(companyId: string) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId },
      orderBy: [{ entityType: 'asc' }, { workflowCode: 'asc' }],
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          include: {
            stepRoles: {
              include: {
                role: {
                  select: {
                    id: true,
                    roleCode: true,
                    roleName: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async createWorkflow(
    context: AuditContext,
    input: {
      workflowCode: string;
      entityType: string;
      workflowName: string;
      steps: ApprovalStepInput[];
    },
  ) {
    this.validateSteps(input.steps);

    return this.prisma.$transaction(async (tx) => {
      await this.assertRolesCompany(
        tx,
        context.auth.companyId,
        input.steps.flatMap((step) => step.roleIds),
      );

      try {
        const workflow = await tx.approvalWorkflow.create({
          data: {
            companyId: context.auth.companyId,
            workflowCode: input.workflowCode,
            entityType: input.entityType,
            workflowName: input.workflowName,
          },
        });

        for (const step of input.steps) {
          await tx.approvalStep.create({
            data: {
              approvalWorkflowId: workflow.id,
              stepNo: step.stepNo,
              stepName: step.stepName,
              requiredApprovals: step.requiredApprovals,
              stepRoles: {
                create: [...new Set(step.roleIds)].map((roleId) => ({
                  roleId,
                })),
              },
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'APPROVAL_WORKFLOW',
            entityId: workflow.id,
            action: 'CREATE',
            newValues: input,
          },
          tx,
        );

        return this.getWorkflowWithClient(
          tx,
          context.auth.companyId,
          workflow.id,
        );
      } catch (error) {
        this.throwUniqueConflict(
          error,
          'Approval workflow code is already in use.',
        );
        throw error;
      }
    });
  }

  async updateWorkflow(
    context: AuditContext,
    id: string,
    input: {
      workflowName?: string;
      isActive?: boolean;
    },
  ) {
    const before = await this.prisma.approvalWorkflow.findFirst({
      where: { id, companyId: context.auth.companyId },
    });
    if (!before) throw this.notFound();

    const after = await this.prisma.approvalWorkflow.update({
      where: { id },
      data: input,
    });

    await this.audit.record({
      ...context,
      entityType: 'APPROVAL_WORKFLOW',
      entityId: id,
      action: 'UPDATE',
      oldValues: before,
      newValues: after,
    });

    return after;
  }

  async replaceSteps(
    context: AuditContext,
    workflowId: string,
    steps: ApprovalStepInput[],
  ) {
    this.validateSteps(steps);

    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.approvalWorkflow.findFirst({
        where: {
          id: workflowId,
          companyId: context.auth.companyId,
        },
        include: {
          steps: {
            orderBy: { stepNo: 'asc' },
            include: {
              stepRoles: true,
            },
          },
        },
      });
      if (!workflow) throw this.notFound();

      const instanceCount = await tx.approvalInstance.count({
        where: { approvalWorkflowId: workflowId },
      });
      if (instanceCount > 0) {
        throw new ConflictException({
          code: 'APPROVAL_WORKFLOW_IN_USE',
          detail:
            'Approval steps cannot be rewritten after the workflow has approval history. Deactivate it and create a new workflow instead.',
        });
      }

      await this.assertRolesCompany(
        tx,
        context.auth.companyId,
        steps.flatMap((step) => step.roleIds),
      );

      const before = workflow.steps.map((step) => ({
        stepNo: step.stepNo,
        stepName: step.stepName,
        requiredApprovals: step.requiredApprovals,
        roleIds: step.stepRoles.map((role) => role.roleId).sort(),
      }));

      const oldStepIds = workflow.steps.map((step) => step.id);
      if (oldStepIds.length > 0) {
        await tx.approvalStepRole.deleteMany({
          where: { approvalStepId: { in: oldStepIds } },
        });
        await tx.approvalStep.deleteMany({
          where: { id: { in: oldStepIds } },
        });
      }

      for (const step of steps) {
        await tx.approvalStep.create({
          data: {
            approvalWorkflowId: workflowId,
            stepNo: step.stepNo,
            stepName: step.stepName,
            requiredApprovals: step.requiredApprovals,
            stepRoles: {
              create: [...new Set(step.roleIds)].map((roleId) => ({
                roleId,
              })),
            },
          },
        });
      }

      await this.audit.record(
        {
          ...context,
          entityType: 'APPROVAL_WORKFLOW',
          entityId: workflowId,
          action: 'REPLACE_STEPS',
          oldValues: { steps: before },
          newValues: { steps },
        },
        tx,
      );

      return this.getWorkflowWithClient(
        tx,
        context.auth.companyId,
        workflowId,
      );
    });
  }

  private validateSteps(steps: ApprovalStepInput[]): void {
    if (steps.length < 1 || steps.length > 20) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        detail: 'Approval workflow must have between 1 and 20 steps.',
      });
    }

    const sorted = [...steps].sort((a, b) => a.stepNo - b.stepNo);
    for (let index = 0; index < sorted.length; index += 1) {
      const step = sorted[index]!;
      if (step.stepNo !== index + 1) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          detail: 'Approval step numbers must start at 1 and be consecutive.',
        });
      }
      const uniqueRoles = new Set(step.roleIds);
      if (
        step.requiredApprovals < 1 ||
        step.requiredApprovals > uniqueRoles.size
      ) {
        throw new UnprocessableEntityException({
          code: 'VALIDATION_ERROR',
          detail:
            'Required approvals must be at least 1 and cannot exceed the number of distinct authorized Roles.',
        });
      }
    }
  }

  private async assertRolesCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    roleIds: string[],
  ) {
    const unique = [...new Set(roleIds)];
    if (unique.length === 0) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        detail: 'Each approval step requires at least one authorized Role.',
      });
    }

    const count = await tx.role.count({
      where: {
        id: { in: unique },
        companyId,
        isActive: true,
      },
    });
    if (count !== unique.length) {
      throw new UnprocessableEntityException({
        code: 'INVALID_APPROVAL_ROLE',
        detail:
          'All approval Roles must be active and belong to the same company.',
      });
    }
  }

  private getWorkflowWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    return tx.approvalWorkflow.findFirstOrThrow({
      where: { id, companyId },
      include: {
        steps: {
          orderBy: { stepNo: 'asc' },
          include: {
            stepRoles: {
              include: {
                role: {
                  select: {
                    id: true,
                    roleCode: true,
                    roleName: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private throwUniqueConflict(error: unknown, detail: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_APPROVAL_CONFIGURATION',
        detail,
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: 'APPROVAL_WORKFLOW_NOT_FOUND',
      detail: 'Approval workflow not found.',
    });
  }
}
