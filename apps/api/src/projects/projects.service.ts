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
import { ProjectAccessService } from './project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type ProjectUpdate = {
  projectCode?: string;
  projectName?: string;
  customerId?: string;
  statusDefinitionId?: string;
  contractValue?: Prisma.Decimal;
  location?: string | null;
  description?: string | null;
  plannedStartDate?: Date;
  plannedCompletionDate?: Date;
};

type MemberInput = {
  projectRole?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  isActive?: boolean;
};

type ContactInput = {
  contactName?: string;
  organizationName?: string | null;
  roleOrTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async listProjects(
    auth: AuthenticatedUserContext,
    search?: string,
    active?: boolean,
    statusDefinitionId?: string,
  ) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: {
        ...scope,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(statusDefinitionId ? { statusDefinitionId } : {}),
        ...(search
          ? {
              OR: [
                { projectCode: { contains: search, mode: 'insensitive' } },
                { projectName: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                {
                  customer: {
                    customerName: {
                      contains: search,
                      mode: 'insensitive',
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            customerName: true,
            isActive: true,
          },
        },
        statusDefinition: true,
      },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async getProject(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.project.findFirstOrThrow({
      where: { id: projectId, companyId: auth.companyId },
      include: {
        customer: true,
        statusDefinition: true,
      },
    });
  }

  statusOptions(auth: AuthenticatedUserContext) {
    return this.prisma.statusDefinition.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'PROJECT',
        isActive: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { statusLabel: 'asc' }],
      select: {
        id: true,
        statusCode: true,
        statusLabel: true,
        isActive: true,
      },
    });
  }

  async editOptions(auth: AuthenticatedUserContext) {
    const [customers, statuses] = await Promise.all([
      this.prisma.customer.findMany({
        where: { companyId: auth.companyId, isActive: true },
        orderBy: [{ customerName: 'asc' }, { customerCode: 'asc' }],
        select: {
          id: true,
          customerCode: true,
          customerName: true,
          isActive: true,
        },
      }),
      this.prisma.statusDefinition.findMany({
        where: {
          companyId: auth.companyId,
          entityType: 'PROJECT',
          isActive: true,
        },
        orderBy: [{ sortOrder: 'asc' }, { statusLabel: 'asc' }],
        select: {
          id: true,
          statusCode: true,
          statusLabel: true,
          isActive: true,
        },
      }),
    ]);

    return { customers, statuses };
  }

  async updateProject(
    context: AuditContext,
    projectId: string,
    data: ProjectUpdate,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);

        const before = await tx.project.findFirst({
          where: {
            id: projectId,
            companyId: context.auth.companyId,
          },
        });
        if (!before) throw this.notFound();

        if (data.customerId !== undefined) {
          await this.assertActiveCustomer(
            tx,
            context.auth.companyId,
            data.customerId,
          );
        }
        if (data.statusDefinitionId !== undefined) {
          await this.assertActiveProjectStatus(
            tx,
            context.auth.companyId,
            data.statusDefinitionId,
          );
        }

        const plannedStartDate =
          data.plannedStartDate ?? before.plannedStartDate;
        const plannedCompletionDate =
          data.plannedCompletionDate ?? before.plannedCompletionDate;
        this.assertDateOrder(
          plannedStartDate,
          plannedCompletionDate,
          'plannedCompletionDate',
        );

        const updateData: Prisma.ProjectUncheckedUpdateInput = {
          ...(data.projectCode !== undefined
            ? { projectCode: data.projectCode }
            : {}),
          ...(data.projectName !== undefined
            ? { projectName: data.projectName }
            : {}),
          ...(data.customerId !== undefined
            ? { customerId: data.customerId }
            : {}),
          ...(data.statusDefinitionId !== undefined
            ? { statusDefinitionId: data.statusDefinitionId }
            : {}),
          ...(data.contractValue !== undefined
            ? { contractValue: data.contractValue }
            : {}),
          ...(data.location !== undefined ? { location: data.location } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.plannedStartDate !== undefined
            ? { plannedStartDate: data.plannedStartDate }
            : {}),
          ...(data.plannedCompletionDate !== undefined
            ? { plannedCompletionDate: data.plannedCompletionDate }
            : {}),
        };

        const after = await tx.project.update({
          where: { id: projectId },
          data: updateData,
          include: {
            customer: true,
            statusDefinition: true,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'PROJECT',
            entityId: projectId,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );

        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Project code is already in use.');
      throw error;
    }
  }

  async setProjectActive(
    context: AuditContext,
    projectId: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAccess(context.auth, projectId, tx);
      const before = await tx.project.findFirst({
        where: { id: projectId, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound();

      const after = await tx.project.update({
        where: { id: projectId },
        data: { isActive },
        include: {
          customer: true,
          statusDefinition: true,
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'PROJECT',
          entityId: projectId,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );

      return after;
    });
  }

  async listMembers(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.projectMember.findMany({
      where: { projectId },
      include: {
        employee: true,
      },
      orderBy: [
        { isActive: 'desc' },
        { projectRole: 'asc' },
        { employee: { employeeName: 'asc' } },
      ],
    });
  }

  async memberOptions(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.employee.findMany({
      where: {
        companyId: auth.companyId,
        isActive: true,
      },
      orderBy: [{ employeeName: 'asc' }, { employeeCode: 'asc' }],
      select: {
        id: true,
        employeeCode: true,
        employeeName: true,
        jobTitle: true,
      },
    });
  }

  async addMember(
    context: AuditContext,
    projectId: string,
    data: {
      employeeId: string;
      projectRole: string;
      startDate?: Date | null;
      endDate?: Date | null;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await this.assertActiveEmployee(
          tx,
          context.auth.companyId,
          data.employeeId,
        );
        this.assertOptionalDateOrder(
          data.startDate,
          data.endDate,
          'endDate',
        );

        const created = await tx.projectMember.create({
          data: {
            projectId,
            employeeId: data.employeeId,
            projectRole: data.projectRole,
            ...(data.startDate !== undefined
              ? { startDate: data.startDate }
              : {}),
            ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
          },
          include: { employee: true },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'PROJECT_MEMBER',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );

        return created;
      });
    } catch (error) {
      this.throwDuplicate(
        error,
        'This Employee already has the same Project Role on this Project.',
      );
      throw error;
    }
  }

  async updateMember(
    context: AuditContext,
    projectId: string,
    memberId: string,
    data: MemberInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);

        const before = await tx.projectMember.findFirst({
          where: { id: memberId, projectId },
        });
        if (!before) throw this.memberNotFound();

        const startDate =
          data.startDate === undefined ? before.startDate : data.startDate;
        const endDate =
          data.endDate === undefined ? before.endDate : data.endDate;
        this.assertOptionalDateOrder(startDate, endDate, 'endDate');

        const updateData: Prisma.ProjectMemberUncheckedUpdateInput = {
          ...(data.projectRole !== undefined
            ? { projectRole: data.projectRole }
            : {}),
          ...(data.startDate !== undefined
            ? { startDate: data.startDate }
            : {}),
          ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.projectMember.update({
          where: { id: memberId },
          data: updateData,
          include: { employee: true },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'PROJECT_MEMBER',
            entityId: memberId,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );

        return after;
      });
    } catch (error) {
      this.throwDuplicate(
        error,
        'This Employee already has the same Project Role on this Project.',
      );
      throw error;
    }
  }

  async listContacts(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.projectContact.findMany({
      where: { projectId },
      orderBy: [{ isActive: 'desc' }, { contactName: 'asc' }],
    });
  }

  async addContact(
    context: AuditContext,
    projectId: string,
    data: {
      contactName: string;
      organizationName?: string | null;
      roleOrTitle?: string | null;
      email?: string | null;
      phone?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAccess(context.auth, projectId, tx);

      const created = await tx.projectContact.create({
        data: {
          projectId,
          contactName: data.contactName,
          ...(data.organizationName !== undefined
            ? { organizationName: data.organizationName }
            : {}),
          ...(data.roleOrTitle !== undefined
            ? { roleOrTitle: data.roleOrTitle }
            : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'PROJECT_CONTACT',
          entityId: created.id,
          action: 'CREATE',
          newValues: created,
        },
        tx,
      );

      return created;
    });
  }

  async updateContact(
    context: AuditContext,
    projectId: string,
    contactId: string,
    data: ContactInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAccess(context.auth, projectId, tx);

      const before = await tx.projectContact.findFirst({
        where: { id: contactId, projectId },
      });
      if (!before) throw this.contactNotFound();

      const updateData: Prisma.ProjectContactUncheckedUpdateInput = {
        ...(data.contactName !== undefined
          ? { contactName: data.contactName }
          : {}),
        ...(data.organizationName !== undefined
          ? { organizationName: data.organizationName }
          : {}),
        ...(data.roleOrTitle !== undefined
          ? { roleOrTitle: data.roleOrTitle }
          : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      };

      const after = await tx.projectContact.update({
        where: { id: contactId },
        data: updateData,
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'PROJECT_CONTACT',
          entityId: contactId,
          action: 'UPDATE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );

      return after;
    });
  }

  private async assertActiveCustomer(
    tx: Prisma.TransactionClient,
    companyId: string,
    customerId: string,
  ) {
    const customer = await tx.customer.findFirst({
      where: { id: customerId, companyId, isActive: true },
      select: { id: true },
    });
    if (!customer) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PROJECT_CUSTOMER',
        detail: 'Project Customer must be active and belong to the same company.',
      });
    }
  }

  private async assertActiveProjectStatus(
    tx: Prisma.TransactionClient,
    companyId: string,
    statusDefinitionId: string,
  ) {
    const status = await tx.statusDefinition.findFirst({
      where: {
        id: statusDefinitionId,
        companyId,
        entityType: 'PROJECT',
        isActive: true,
      },
      select: { id: true },
    });
    if (!status) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PROJECT_STATUS',
        detail:
          'Project Status must be an active PROJECT status belonging to the same company.',
      });
    }
  }

  private async assertActiveEmployee(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId: string,
  ) {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId, isActive: true },
      select: { id: true },
    });
    if (!employee) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PROJECT_EMPLOYEE',
        detail:
          'Project Team Employee must be active and belong to the same company.',
      });
    }
  }

  private assertDateOrder(start: Date, finish: Date, field: string) {
    if (finish.getTime() < start.getTime()) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        detail: 'One or more fields are invalid.',
        errors: [
          {
            field,
            message: 'Must not be earlier than the start date.',
          },
        ],
      });
    }
  }

  private assertOptionalDateOrder(
    start: Date | null | undefined,
    finish: Date | null | undefined,
    field: string,
  ) {
    if (start && finish) this.assertDateOrder(start, finish, field);
  }

  private throwDuplicate(error: unknown, detail: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_PROJECT_RECORD',
        detail,
      });
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'PROJECT_NOT_FOUND',
      detail: 'Project not found.',
    });
  }

  private memberNotFound() {
    return new NotFoundException({
      code: 'PROJECT_MEMBER_NOT_FOUND',
      detail: 'Project Team member not found.',
    });
  }

  private contactNotFound() {
    return new NotFoundException({
      code: 'PROJECT_CONTACT_NOT_FOUND',
      detail: 'Project Contact not found.',
    });
  }
}
