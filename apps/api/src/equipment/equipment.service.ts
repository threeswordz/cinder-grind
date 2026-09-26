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
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

export type EquipmentTypeInput = {
  equipmentTypeCode: string;
  equipmentTypeName: string;
  description?: string | null;
  isActive?: boolean;
};

export type EquipmentInput = {
  equipmentTypeId: string;
  equipmentCode: string;
  equipmentName: string;
  description?: string | null;
  operationalStatus: 'AVAILABLE' | 'UNAVAILABLE';
  isActive?: boolean;
};

export type EquipmentAssignmentInput = {
  projectId: string;
  assignedFrom: Date;
  remarks?: string | null;
};

export type EquipmentUsageInput = {
  equipmentId: string;
  projectId: string;
  usageDate: Date;
  operatingHours?: Prisma.Decimal | null;
  activityId?: string | null;
  wbsId?: string | null;
  remarks?: string | null;
};

@Injectable()
export class EquipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async listTypes(auth: AuthenticatedUserContext, includeInactive = true) {
    return this.prisma.equipmentType.findMany({
      where: {
        companyId: auth.companyId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ equipmentTypeCode: 'asc' }],
    });
  }

  async createType(context: AuditContext, input: EquipmentTypeInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.equipmentType.create({
          data: {
            companyId: context.auth.companyId,
            equipmentTypeCode: input.equipmentTypeCode,
            equipmentTypeName: input.equipmentTypeName,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EQUIPMENT_TYPE',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error, 'EQUIPMENT_TYPE_DUPLICATE', 'Equipment Type code already exists.');
      throw error;
    }
  }

  async updateType(
    context: AuditContext,
    id: string,
    input: Partial<EquipmentTypeInput>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.equipmentType.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.typeNotFound();
        const row = await tx.equipmentType.update({
          where: { id },
          data: {
            ...(input.equipmentTypeCode !== undefined
              ? { equipmentTypeCode: input.equipmentTypeCode }
              : {}),
            ...(input.equipmentTypeName !== undefined
              ? { equipmentTypeName: input.equipmentTypeName }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EQUIPMENT_TYPE',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error, 'EQUIPMENT_TYPE_DUPLICATE', 'Equipment Type code already exists.');
      throw error;
    }
  }

  async listEquipment(auth: AuthenticatedUserContext, asOf: Date) {
    const rows = await this.prisma.equipment.findMany({
      where: { companyId: auth.companyId },
      include: {
        equipmentType: true,
        assignments: {
          where: {
            assignedFrom: { lte: asOf },
            OR: [{ assignedTo: null }, { assignedTo: { gte: asOf } }],
          },
          select: { id: true, projectId: true, assignedFrom: true, assignedTo: true },
          orderBy: { assignedFrom: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ equipmentCode: 'asc' }],
    });

    const assignmentProjectIds = [
      ...new Set(
        rows
          .map((row) => row.assignments[0]?.projectId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const scope = await this.access.scopeWhere(auth);
    const visibleProjects = assignmentProjectIds.length
      ? await this.prisma.project.findMany({
          where: { AND: [scope, { id: { in: assignmentProjectIds } }] },
          select: { id: true, projectCode: true, projectName: true },
        })
      : [];
    const projectMap = new Map(visibleProjects.map((project) => [project.id, project]));

    return rows.map((row) => {
      const effectiveAssignment = row.assignments[0] ?? null;
      const availability =
        !row.isActive || row.operationalStatus === 'UNAVAILABLE'
          ? 'UNAVAILABLE'
          : effectiveAssignment
            ? 'ASSIGNED'
            : 'AVAILABLE';
      const visibleProject = effectiveAssignment
        ? projectMap.get(effectiveAssignment.projectId)
        : undefined;
      return {
        id: row.id,
        companyId: row.companyId,
        equipmentTypeId: row.equipmentTypeId,
        equipmentCode: row.equipmentCode,
        equipmentName: row.equipmentName,
        description: row.description,
        operationalStatus: row.operationalStatus,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        equipmentType: row.equipmentType,
        availability,
        currentAssignment: effectiveAssignment
          ? {
              id: effectiveAssignment.id,
              assignedFrom: effectiveAssignment.assignedFrom,
              assignedTo: effectiveAssignment.assignedTo,
              project: visibleProject ?? null,
              restrictedProject: !visibleProject,
            }
          : null,
      };
    });
  }

  async createEquipment(context: AuditContext, input: EquipmentInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertActiveType(tx, context.auth.companyId, input.equipmentTypeId);
        const row = await tx.equipment.create({
          data: {
            companyId: context.auth.companyId,
            equipmentTypeId: input.equipmentTypeId,
            equipmentCode: input.equipmentCode,
            equipmentName: input.equipmentName,
            operationalStatus: input.operationalStatus,
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EQUIPMENT',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error, 'EQUIPMENT_DUPLICATE', 'Equipment code already exists.');
      throw error;
    }
  }

  async updateEquipment(
    context: AuditContext,
    id: string,
    input: Partial<EquipmentInput>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.equipment.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.equipmentNotFound();
        if (
          input.equipmentTypeId !== undefined &&
          input.equipmentTypeId !== before.equipmentTypeId
        ) {
          await this.assertActiveType(
            tx,
            context.auth.companyId,
            input.equipmentTypeId,
          );
        }
        if (input.isActive === true && !before.isActive) {
          await this.assertActiveType(
            tx,
            context.auth.companyId,
            input.equipmentTypeId ?? before.equipmentTypeId,
          );
        }
        const row = await tx.equipment.update({
          where: { id },
          data: {
            ...(input.equipmentTypeId !== undefined
              ? { equipmentTypeId: input.equipmentTypeId }
              : {}),
            ...(input.equipmentCode !== undefined
              ? { equipmentCode: input.equipmentCode }
              : {}),
            ...(input.equipmentName !== undefined
              ? { equipmentName: input.equipmentName }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.operationalStatus !== undefined
              ? { operationalStatus: input.operationalStatus }
              : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EQUIPMENT',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error, 'EQUIPMENT_DUPLICATE', 'Equipment code already exists.');
      throw error;
    }
  }

  async projectEquipment(
    auth: AuthenticatedUserContext,
    projectId: string,
    asOf: Date,
  ) {
    await this.access.assertAccess(auth, projectId);
    const assignments = await this.prisma.equipmentAssignment.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        assignedFrom: { lte: asOf },
        OR: [{ assignedTo: null }, { assignedTo: { gte: asOf } }],
        equipment: {
          companyId: auth.companyId,
          isActive: true,
          operationalStatus: 'AVAILABLE',
        },
      },
      include: {
        equipment: {
          include: { equipmentType: true },
        },
      },
      orderBy: [{ equipment: { equipmentCode: 'asc' } }],
    });
    return assignments.map((assignment) => ({
      assignmentId: assignment.id,
      assignedFrom: assignment.assignedFrom,
      assignedTo: assignment.assignedTo,
      equipment: assignment.equipment,
    }));
  }

  async assignments(auth: AuthenticatedUserContext, equipmentId: string) {
    await this.assertEquipmentCompany(auth, equipmentId);
    const scope = await this.access.scopeWhere(auth);
    const projects = await this.prisma.project.findMany({
      where: scope,
      select: { id: true },
    });
    const projectIds = projects.map((project) => project.id);
    return this.prisma.equipmentAssignment.findMany({
      where: {
        companyId: auth.companyId,
        equipmentId,
        projectId: { in: projectIds },
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
      },
      orderBy: [{ assignedFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async assign(
    context: AuditContext,
    equipmentId: string,
    input: EquipmentAssignmentInput,
  ) {
    try {
      const assignmentId = await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, input.projectId, tx);
        const equipment = await tx.equipment.findFirst({
          where: { id: equipmentId, companyId: context.auth.companyId },
        });
        if (!equipment) throw this.equipmentNotFound();

        const open = await tx.equipmentAssignment.findFirst({
          where: {
            companyId: context.auth.companyId,
            equipmentId,
            assignedTo: null,
          },
          orderBy: { assignedFrom: 'desc' },
        });

        if (open?.projectId === input.projectId) {
          throw new ConflictException({
            code: 'EQUIPMENT_ALREADY_ASSIGNED',
            detail: 'Equipment is already openly assigned to this Project.',
          });
        }
        if (open) {
          if (input.assignedFrom <= open.assignedFrom) {
            throw new ConflictException({
              code: 'EQUIPMENT_REASSIGNMENT_DATE_INVALID',
              detail:
                'A reassignment start date must be after the current open assignment start date.',
            });
          }
          const closeDate = new Date(input.assignedFrom.getTime() - 86_400_000);
          await tx.equipmentAssignment.update({
            where: { id: open.id },
            data: { assignedTo: closeDate },
          });
          await this.audit.record(
            {
              ...context,
              entityType: 'EQUIPMENT_ASSIGNMENT',
              entityId: open.id,
              action: 'RELEASE_FOR_REASSIGNMENT',
              oldValues: { assignedTo: null },
              newValues: { assignedTo: closeDate },
            },
            tx,
          );
        }

        const row = await tx.equipmentAssignment.create({
          data: {
            companyId: context.auth.companyId,
            equipmentId,
            projectId: input.projectId,
            assignedFrom: input.assignedFrom,
            ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EQUIPMENT_ASSIGNMENT',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row.id;
      });

      return this.prisma.equipmentAssignment.findUnique({
        where: { id: assignmentId },
        include: {
          project: { select: { id: true, projectCode: true, projectName: true } },
          equipment: {
            select: { id: true, equipmentCode: true, equipmentName: true },
          },
        },
      });
    } catch (error) {
      this.throwOpenAssignment(error);
      throw error;
    }
  }

  async release(
    context: AuditContext,
    assignmentId: string,
    assignedTo: Date,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.equipmentAssignment.findFirst({
        where: { id: assignmentId, companyId: context.auth.companyId },
      });
      if (!before) throw this.assignmentNotFound();
      await this.access.assertAccess(context.auth, before.projectId, tx);
      if (before.assignedTo) {
        throw new ConflictException({
          code: 'EQUIPMENT_ASSIGNMENT_ALREADY_CLOSED',
          detail: 'Equipment assignment is already closed.',
        });
      }
      if (assignedTo < before.assignedFrom) {
        throw new UnprocessableEntityException({
          code: 'EQUIPMENT_ASSIGNMENT_DATE_INVALID',
          detail: 'Release date cannot be earlier than assignment start date.',
        });
      }
      const row = await tx.equipmentAssignment.update({
        where: { id: assignmentId },
        data: { assignedTo },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'EQUIPMENT_ASSIGNMENT',
          entityId: assignmentId,
          action: 'RELEASE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  async usage(
    auth: AuthenticatedUserContext,
    filters: {
      projectId?: string;
      equipmentId?: string;
      from?: Date;
      to?: Date;
    },
  ) {
    let projectIds: string[];
    if (filters.projectId) {
      await this.access.assertAccess(auth, filters.projectId);
      projectIds = [filters.projectId];
    } else {
      const scope = await this.access.scopeWhere(auth);
      projectIds = (
        await this.prisma.project.findMany({
          where: scope,
          select: { id: true },
        })
      ).map((project) => project.id);
    }

    return this.prisma.equipmentUsage.findMany({
      where: {
        companyId: auth.companyId,
        projectId: { in: projectIds },
        ...(filters.equipmentId ? { equipmentId: filters.equipmentId } : {}),
        ...(filters.from || filters.to
          ? {
              usageDate: {
                ...(filters.from ? { gte: filters.from } : {}),
                ...(filters.to ? { lte: filters.to } : {}),
              },
            }
          : {}),
      },
      include: {
        equipment: {
          select: { id: true, equipmentCode: true, equipmentName: true },
        },
        project: { select: { id: true, projectCode: true, projectName: true } },
        activity: {
          select: { id: true, activityCode: true, activityName: true },
        },
        wbs: { select: { id: true, wbsCode: true, wbsName: true } },
        recordedBy: { select: { id: true, displayName: true } },
      },
      orderBy: [{ usageDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createUsage(context: AuditContext, input: EquipmentUsageInput) {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.validateUsage(tx, context.auth, input);
      const row = await tx.equipmentUsage.create({
        data: {
          companyId: context.auth.companyId,
          equipmentId: input.equipmentId,
          projectId: input.projectId,
          usageDate: input.usageDate,
          ...(input.operatingHours !== undefined
            ? { operatingHours: input.operatingHours }
            : {}),
          ...(input.activityId !== undefined ? { activityId: input.activityId } : {}),
          ...(input.wbsId !== undefined ? { wbsId: input.wbsId } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
          sourceType: 'MANUAL',
          recordedByUserId: context.auth.userId,
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'EQUIPMENT_USAGE',
          entityId: row.id,
          action: 'CREATE',
          newValues: row,
        },
        tx,
      );
      return row.id;
    });
    return (await this.usage(context.auth, { equipmentId: input.equipmentId })).find(
      (row) => row.id === id,
    );
  }

  async updateUsage(
    context: AuditContext,
    id: string,
    input: Partial<EquipmentUsageInput>,
  ) {
    const usageId = await this.prisma.$transaction(async (tx) => {
      const before = await tx.equipmentUsage.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.usageNotFound();
      if (before.sourceType !== 'MANUAL') {
        throw new ConflictException({
          code: 'EQUIPMENT_USAGE_SOURCE_IMMUTABLE',
          detail:
            'Daily Site Report-origin Equipment Usage must be corrected through the report correction path.',
        });
      }

      const merged: EquipmentUsageInput = {
        equipmentId: input.equipmentId ?? before.equipmentId,
        projectId: input.projectId ?? before.projectId,
        usageDate: input.usageDate ?? before.usageDate,
        operatingHours:
          input.operatingHours !== undefined
            ? input.operatingHours
            : before.operatingHours,
        activityId:
          input.activityId !== undefined ? input.activityId : before.activityId,
        wbsId: input.wbsId !== undefined ? input.wbsId : before.wbsId,
        remarks: input.remarks !== undefined ? input.remarks : before.remarks,
      };
      await this.validateUsage(tx, context.auth, merged);
      const row = await tx.equipmentUsage.update({
        where: { id },
        data: {
          equipmentId: merged.equipmentId,
          projectId: merged.projectId,
          usageDate: merged.usageDate,
          operatingHours: merged.operatingHours,
          activityId: merged.activityId,
          wbsId: merged.wbsId,
          remarks: merged.remarks,
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'EQUIPMENT_USAGE',
          entityId: id,
          action: 'UPDATE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return id;
    });
    const rows = await this.usage(context.auth, {});
    return rows.find((row) => row.id === usageId) ?? null;
  }

  private async validateUsage(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    input: EquipmentUsageInput,
  ) {
    await this.access.assertAccess(auth, input.projectId, tx);
    const equipment = await tx.equipment.findFirst({
      where: { id: input.equipmentId, companyId: auth.companyId },
    });
    if (!equipment) throw this.equipmentNotFound();
    if (!equipment.isActive || equipment.operationalStatus !== 'AVAILABLE') {
      throw new ConflictException({
        code: 'EQUIPMENT_NOT_OPERATIONALLY_AVAILABLE',
        detail:
          'New Equipment Usage requires active Equipment with AVAILABLE operational status.',
      });
    }
    const assignment = await tx.equipmentAssignment.findFirst({
      where: {
        companyId: auth.companyId,
        equipmentId: input.equipmentId,
        projectId: input.projectId,
        assignedFrom: { lte: input.usageDate },
        OR: [{ assignedTo: null }, { assignedTo: { gte: input.usageDate } }],
      },
      select: { id: true },
    });
    if (!assignment) {
      throw new ConflictException({
        code: 'EQUIPMENT_NOT_ASSIGNED',
        detail: 'Equipment must be assigned to the Project on the usage date.',
      });
    }
    let activityWbsId: string | null = null;
    if (input.activityId) {
      const activity = await tx.activity.findFirst({
        where: {
          id: input.activityId,
          companyId: auth.companyId,
          projectId: input.projectId,
          isActive: true,
        },
        select: { wbsId: true },
      });
      if (!activity) {
        throw this.invalidReference(
          'Activity must be active and belong to the Equipment Usage Project.',
        );
      }
      activityWbsId = activity.wbsId;
    }
    if (input.wbsId) {
      const wbs = await tx.wbsElement.findFirst({
        where: { id: input.wbsId, projectId: input.projectId, isActive: true },
        select: { id: true },
      });
      if (!wbs) {
        throw this.invalidReference(
          'WBS must be active and belong to the Equipment Usage Project.',
        );
      }
    }
    if (input.activityId && input.wbsId && activityWbsId !== input.wbsId) {
      throw this.invalidReference(
        'When both Activity and WBS are supplied, the Activity must belong to that WBS.',
      );
    }
  }

  private async assertActiveType(
    tx: Prisma.TransactionClient,
    companyId: string,
    equipmentTypeId: string,
  ) {
    const type = await tx.equipmentType.findFirst({
      where: { id: equipmentTypeId, companyId, isActive: true },
      select: { id: true },
    });
    if (!type) {
      throw new UnprocessableEntityException({
        code: 'EQUIPMENT_TYPE_INVALID',
        detail: 'Active Equipment must reference an active Equipment Type.',
      });
    }
  }

  private async assertEquipmentCompany(
    auth: AuthenticatedUserContext,
    equipmentId: string,
  ) {
    const row = await this.prisma.equipment.findFirst({
      where: { id: equipmentId, companyId: auth.companyId },
      select: { id: true },
    });
    if (!row) throw this.equipmentNotFound();
  }

  private throwUnique(error: unknown, code: string, detail: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({ code, detail });
    }
  }

  private throwOpenAssignment(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'EQUIPMENT_OPEN_ASSIGNMENT_EXISTS',
        detail: 'Equipment already has an open Project assignment.',
      });
    }
  }

  private invalidReference(detail: string) {
    return new UnprocessableEntityException({
      code: 'EQUIPMENT_REFERENCE_INVALID',
      detail,
    });
  }

  private typeNotFound() {
    return new NotFoundException({
      code: 'EQUIPMENT_TYPE_NOT_FOUND',
      detail: 'Equipment Type not found.',
    });
  }

  private equipmentNotFound() {
    return new NotFoundException({
      code: 'EQUIPMENT_NOT_FOUND',
      detail: 'Equipment not found.',
    });
  }

  private assignmentNotFound() {
    return new NotFoundException({
      code: 'EQUIPMENT_ASSIGNMENT_NOT_FOUND',
      detail: 'Equipment assignment not found.',
    });
  }

  private usageNotFound() {
    return new NotFoundException({
      code: 'EQUIPMENT_USAGE_NOT_FOUND',
      detail: 'Equipment Usage not found.',
    });
  }
}
