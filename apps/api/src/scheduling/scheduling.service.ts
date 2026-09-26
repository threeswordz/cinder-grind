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
import {
  ScheduleEngineError,
  ScheduleMode,
  assertDependencyGraphAcyclic,
  calculateScheduleAnalysis,
} from './schedule-engine';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type CalendarInput = {
  projectId?: string | null;
  calendarName?: string;
  description?: string | null;
  timezoneName?: string;
  isDefault?: boolean;
};

type WeekdayInput = {
  weekdayNo: number;
  isWorking: boolean;
  startTime: Date | null;
  endTime: Date | null;
};

type ExceptionInput = {
  exceptionDate: Date;
  isWorkingOverride: boolean;
  startTime: Date | null;
  endTime: Date | null;
  reason?: string | null;
};

type ActivityInput = {
  wbsId?: string;
  parentActivityId?: string | null;
  activityTypeId?: string | null;
  workingCalendarId?: string;
  statusDefinitionId?: string | null;
  activityCode?: string;
  activityName?: string;
  description?: string | null;
  isSummary?: boolean;
  isMilestone?: boolean;
  plannedDurationWorkDays?: Prisma.Decimal;
  plannedStartDate?: Date;
  plannedFinishDate?: Date;
  actualStartDate?: Date | null;
  actualFinishDate?: Date | null;
  forecastStartDate?: Date | null;
  forecastFinishDate?: Date | null;
  responsibleEmployeeId?: string | null;
  ownerUserId?: string | null;
};

type DependencyInput = {
  predecessorActivityId?: string;
  successorActivityId?: string;
  dependencyType?: string;
  lagWorkDays?: Prisma.Decimal;
};

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { ...scope, isActive: true },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async listCalendars(
    auth: AuthenticatedUserContext,
    projectId?: string,
    active?: boolean,
  ) {
    let projectIds: string[] | undefined;
    if (projectId) {
      await this.access.assertAccess(auth, projectId);
      projectIds = [projectId];
    } else if (!this.access.canAccessAll(auth)) {
      const scope = await this.access.scopeWhere(auth);
      const projects = await this.prisma.project.findMany({
        where: scope,
        select: { id: true },
      });
      projectIds = projects.map((row) => row.id);
    }

    return this.prisma.workingCalendar.findMany({
      where: {
        companyId: auth.companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(projectIds
          ? {
              OR: [
                { projectId: null },
                { projectId: { in: projectIds } },
              ],
            }
          : {}),
      },
      include: {
        project: { select: { id: true, projectCode: true, projectName: true } },
        weekdays: { orderBy: { weekdayNo: 'asc' } },
        exceptions: { orderBy: { exceptionDate: 'asc' } },
      },
      orderBy: [{ isDefault: 'desc' }, { calendarName: 'asc' }],
    });
  }

  async createCalendar(context: AuditContext, data: CalendarInput) {
    if (data.projectId) {
      await this.access.assertAccess(context.auth, data.projectId);
    }

    return this.prisma.$transaction(async (tx) => {
      if (data.projectId) {
        await this.access.assertAccess(context.auth, data.projectId, tx);
      }
      const created = await tx.workingCalendar.create({
        data: {
          companyId: context.auth.companyId,
          ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
          calendarName: data.calendarName!,
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          timezoneName: data.timezoneName!,
          ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WORKING_CALENDAR',
          entityId: created.id,
          action: 'CREATE',
          newValues: created,
        },
        tx,
      );
      return created;
    });
  }

  async updateCalendar(
    context: AuditContext,
    id: string,
    data: CalendarInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.workingCalendar.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('WORKING_CALENDAR_NOT_FOUND', 'Working Calendar');

      if (before.projectId) {
        await this.access.assertAccess(context.auth, before.projectId, tx);
      }
      if (data.projectId) {
        await this.access.assertAccess(context.auth, data.projectId, tx);
      }

      const after = await tx.workingCalendar.update({
        where: { id },
        data,
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WORKING_CALENDAR',
          entityId: id,
          action: 'UPDATE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );
      return after;
    });
  }

  async setCalendarActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.workingCalendar.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('WORKING_CALENDAR_NOT_FOUND', 'Working Calendar');
      if (before.projectId) {
        await this.access.assertAccess(context.auth, before.projectId, tx);
      }
      const after = await tx.workingCalendar.update({
        where: { id },
        data: { isActive },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WORKING_CALENDAR',
          entityId: id,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );
      return after;
    });
  }

  async replaceWeekdays(
    context: AuditContext,
    calendarId: string,
    weekdays: WeekdayInput[],
  ) {
    if (new Set(weekdays.map((row) => row.weekdayNo)).size !== weekdays.length) {
      throw new UnprocessableEntityException({
        code: 'DUPLICATE_WEEKDAY',
        detail: 'Each weekday may appear only once per Working Calendar.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const calendar = await this.assertCalendarAccess(context.auth, calendarId, tx);
      const before = await tx.workingCalendarWeekday.findMany({
        where: { workingCalendarId: calendarId },
        orderBy: { weekdayNo: 'asc' },
      });
      await tx.workingCalendarWeekday.deleteMany({
        where: { workingCalendarId: calendarId },
      });
      if (weekdays.length) {
        await tx.workingCalendarWeekday.createMany({
          data: weekdays.map((row) => ({
            workingCalendarId: calendarId,
            ...row,
          })),
        });
      }
      const after = await tx.workingCalendarWeekday.findMany({
        where: { workingCalendarId: calendarId },
        orderBy: { weekdayNo: 'asc' },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WORKING_CALENDAR',
          entityId: calendar.id,
          action: 'REPLACE_WEEKDAYS',
          oldValues: { weekdays: before },
          newValues: { weekdays: after },
        },
        tx,
      );
      return after;
    });
  }

  async replaceExceptions(
    context: AuditContext,
    calendarId: string,
    exceptions: ExceptionInput[],
  ) {
    const keys = exceptions.map((row) => row.exceptionDate.toISOString().slice(0, 10));
    if (new Set(keys).size !== keys.length) {
      throw new UnprocessableEntityException({
        code: 'DUPLICATE_CALENDAR_EXCEPTION',
        detail: 'Each exception date may appear only once per Working Calendar.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const calendar = await this.assertCalendarAccess(context.auth, calendarId, tx);
      const before = await tx.workingCalendarException.findMany({
        where: { workingCalendarId: calendarId },
        orderBy: { exceptionDate: 'asc' },
      });
      await tx.workingCalendarException.deleteMany({
        where: { workingCalendarId: calendarId },
      });
      if (exceptions.length) {
        await tx.workingCalendarException.createMany({
          data: exceptions.map((row) => ({
            workingCalendarId: calendarId,
            ...row,
          })),
        });
      }
      const after = await tx.workingCalendarException.findMany({
        where: { workingCalendarId: calendarId },
        orderBy: { exceptionDate: 'asc' },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WORKING_CALENDAR',
          entityId: calendar.id,
          action: 'REPLACE_EXCEPTIONS',
          oldValues: { exceptions: before },
          newValues: { exceptions: after },
        },
        tx,
      );
      return after;
    });
  }

  listActivityTypes(companyId: string, active?: boolean) {
    return this.prisma.activityType.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
      },
      orderBy: [{ activityTypeName: 'asc' }, { activityTypeCode: 'asc' }],
    });
  }

  async createActivityType(
    context: AuditContext,
    data: { activityTypeCode: string; activityTypeName: string },
  ) {
    try {
      const created = await this.prisma.activityType.create({
        data: { companyId: context.auth.companyId, ...data },
      });
      await this.audit.record({
        ...context,
        entityType: 'ACTIVITY_TYPE',
        entityId: created.id,
        action: 'CREATE',
        newValues: created,
      });
      return created;
    } catch (error) {
      this.throwDuplicate(error, 'Activity Type code is already in use.');
      throw error;
    }
  }

  async updateActivityType(
    context: AuditContext,
    id: string,
    data: { activityTypeCode?: string; activityTypeName?: string },
  ) {
    try {
      const before = await this.prisma.activityType.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('ACTIVITY_TYPE_NOT_FOUND', 'Activity Type');
      const after = await this.prisma.activityType.update({ where: { id }, data });
      await this.audit.record({
        ...context,
        entityType: 'ACTIVITY_TYPE',
        entityId: id,
        action: 'UPDATE',
        oldValues: before,
        newValues: after,
      });
      return after;
    } catch (error) {
      this.throwDuplicate(error, 'Activity Type code is already in use.');
      throw error;
    }
  }

  async setActivityTypeActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    const before = await this.prisma.activityType.findFirst({
      where: { id, companyId: context.auth.companyId },
    });
    if (!before) throw this.notFound('ACTIVITY_TYPE_NOT_FOUND', 'Activity Type');
    const after = await this.prisma.activityType.update({
      where: { id },
      data: { isActive },
    });
    await this.audit.record({
      ...context,
      entityType: 'ACTIVITY_TYPE',
      entityId: id,
      action: isActive ? 'REACTIVATE' : 'ARCHIVE',
      oldValues: before,
      newValues: after,
    });
    return after;
  }

  async activityOptions(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [wbs, activityTypes, calendars, statuses, employees, users, parents] =
      await Promise.all([
        this.prisma.wbsElement.findMany({
          where: { projectId, isActive: true },
          select: { id: true, parentId: true, wbsCode: true, wbsName: true },
          orderBy: { wbsCode: 'asc' },
        }),
        this.prisma.activityType.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: {
            id: true,
            activityTypeCode: true,
            activityTypeName: true,
          },
          orderBy: { activityTypeName: 'asc' },
        }),
        this.prisma.workingCalendar.findMany({
          where: {
            companyId: auth.companyId,
            isActive: true,
            OR: [{ projectId: null }, { projectId }],
          },
          select: {
            id: true,
            projectId: true,
            calendarName: true,
            timezoneName: true,
            isDefault: true,
          },
          orderBy: [{ isDefault: 'desc' }, { calendarName: 'asc' }],
        }),
        this.prisma.statusDefinition.findMany({
          where: {
            companyId: auth.companyId,
            entityType: 'ACTIVITY',
            isActive: true,
          },
          select: { id: true, statusCode: true, statusLabel: true },
          orderBy: [{ sortOrder: 'asc' }, { statusLabel: 'asc' }],
        }),
        this.prisma.employee.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: {
            id: true,
            employeeCode: true,
            employeeName: true,
            jobTitle: true,
          },
          orderBy: { employeeName: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: { id: true, displayName: true, email: true },
          orderBy: { displayName: 'asc' },
        }),
        this.prisma.activity.findMany({
          where: { projectId, isActive: true },
          select: {
            id: true,
            parentActivityId: true,
            wbsId: true,
            activityCode: true,
            activityName: true,
            isSummary: true,
          },
          orderBy: { activityCode: 'asc' },
        }),
      ]);

    return { wbs, activityTypes, calendars, statuses, employees, users, parents };
  }

  async listActivities(
    auth: AuthenticatedUserContext,
    projectId: string,
    active?: boolean,
  ) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.activity.findMany({
      where: {
        projectId,
        companyId: auth.companyId,
        ...(active !== undefined ? { isActive: active } : {}),
      },
      include: {
        wbs: { select: { id: true, wbsCode: true, wbsName: true } },
        activityType: true,
        workingCalendar: {
          select: { id: true, calendarName: true, timezoneName: true, isActive: true },
        },
        statusDefinition: true,
        responsibleEmployee: {
          select: { id: true, employeeCode: true, employeeName: true },
        },
        owner: { select: { id: true, displayName: true, email: true } },
      },
      orderBy: { activityCode: 'asc' },
    });
  }

  async createActivity(
    context: AuditContext,
    projectId: string,
    data: Required<
      Pick<
        ActivityInput,
        | 'wbsId'
        | 'workingCalendarId'
        | 'activityCode'
        | 'activityName'
        | 'plannedDurationWorkDays'
        | 'plannedStartDate'
        | 'plannedFinishDate'
      >
    > &
      ActivityInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await this.assertActivityReferences(
          tx,
          context.auth.companyId,
          projectId,
          data,
        );
        this.assertDateOrder(data.plannedStartDate, data.plannedFinishDate, 'plannedFinishDate');
        this.assertMilestoneRule(
          data.isMilestone ?? false,
          data.plannedDurationWorkDays,
          data.plannedStartDate,
          data.plannedFinishDate,
        );
        this.assertOptionalDateOrder(data.actualStartDate, data.actualFinishDate, 'actualFinishDate');
        this.assertOptionalDateOrder(data.forecastStartDate, data.forecastFinishDate, 'forecastFinishDate');

        const created = await tx.activity.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            wbsId: data.wbsId,
            workingCalendarId: data.workingCalendarId,
            activityCode: data.activityCode,
            activityName: data.activityName,
            plannedDurationWorkDays: data.plannedDurationWorkDays,
            plannedStartDate: data.plannedStartDate,
            plannedFinishDate: data.plannedFinishDate,
            ...(data.parentActivityId !== undefined
              ? { parentActivityId: data.parentActivityId }
              : {}),
            ...(data.activityTypeId !== undefined
              ? { activityTypeId: data.activityTypeId }
              : {}),
            ...(data.statusDefinitionId !== undefined
              ? { statusDefinitionId: data.statusDefinitionId }
              : {}),
            ...(data.description !== undefined
              ? { description: data.description }
              : {}),
            ...(data.isSummary !== undefined ? { isSummary: data.isSummary } : {}),
            ...(data.isMilestone !== undefined ? { isMilestone: data.isMilestone } : {}),
            ...(data.actualStartDate !== undefined
              ? { actualStartDate: data.actualStartDate }
              : {}),
            ...(data.actualFinishDate !== undefined
              ? { actualFinishDate: data.actualFinishDate }
              : {}),
            ...(data.forecastStartDate !== undefined
              ? { forecastStartDate: data.forecastStartDate }
              : {}),
            ...(data.forecastFinishDate !== undefined
              ? { forecastFinishDate: data.forecastFinishDate }
              : {}),
            ...(data.responsibleEmployeeId !== undefined
              ? { responsibleEmployeeId: data.responsibleEmployeeId }
              : {}),
            ...(data.ownerUserId !== undefined ? { ownerUserId: data.ownerUserId } : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Activity code is already in use for this Project.');
      throw error;
    }
  }

  async updateActivity(
    context: AuditContext,
    id: string,
    data: ActivityInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.activity.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound('ACTIVITY_NOT_FOUND', 'Activity');
        const projectId = before.projectId;
        await this.access.assertAccess(context.auth, projectId, tx);

        if (data.parentActivityId === id) {
          throw new UnprocessableEntityException({
            code: 'ACTIVITY_INVALID_PARENT',
            detail: 'An Activity cannot be its own parent.',
          });
        }

        await this.assertActivityReferences(
          tx,
          context.auth.companyId,
          projectId,
          data,
        );
        if (data.parentActivityId) {
          await this.assertNoActivityHierarchyCycle(tx, projectId, id, data.parentActivityId);
        }

        const plannedStartDate = data.plannedStartDate ?? before.plannedStartDate;
        const plannedFinishDate = data.plannedFinishDate ?? before.plannedFinishDate;
        const plannedDurationWorkDays =
          data.plannedDurationWorkDays ?? before.plannedDurationWorkDays;
        const isMilestone = data.isMilestone ?? before.isMilestone;
        this.assertDateOrder(plannedStartDate, plannedFinishDate, 'plannedFinishDate');
        this.assertMilestoneRule(
          isMilestone,
          plannedDurationWorkDays,
          plannedStartDate,
          plannedFinishDate,
        );

        const actualStartDate =
          data.actualStartDate === undefined ? before.actualStartDate : data.actualStartDate;
        const actualFinishDate =
          data.actualFinishDate === undefined ? before.actualFinishDate : data.actualFinishDate;
        this.assertOptionalDateOrder(actualStartDate, actualFinishDate, 'actualFinishDate');

        const forecastStartDate =
          data.forecastStartDate === undefined
            ? before.forecastStartDate
            : data.forecastStartDate;
        const forecastFinishDate =
          data.forecastFinishDate === undefined
            ? before.forecastFinishDate
            : data.forecastFinishDate;
        this.assertOptionalDateOrder(
          forecastStartDate,
          forecastFinishDate,
          'forecastFinishDate',
        );

        const after = await tx.activity.update({ where: { id }, data });
        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Activity code is already in use for this Project.');
      throw error;
    }
  }

  async setActivityActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.activity.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('ACTIVITY_NOT_FOUND', 'Activity');
      await this.access.assertAccess(context.auth, before.projectId, tx);
      const after = await tx.activity.update({ where: { id }, data: { isActive } });
      await this.audit.record(
        {
          ...context,
          entityType: 'ACTIVITY',
          entityId: id,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );
      return after;
    });
  }

  async listDependencies(
    auth: AuthenticatedUserContext,
    projectId: string,
    active?: boolean,
  ) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.activityDependency.findMany({
      where: {
        projectId,
        ...(active !== undefined ? { isActive: active } : {}),
      },
      include: {
        predecessor: {
          select: { id: true, activityCode: true, activityName: true, isActive: true },
        },
        successor: {
          select: { id: true, activityCode: true, activityName: true, isActive: true },
        },
      },
      orderBy: [{ predecessor: { activityCode: 'asc' } }, { successor: { activityCode: 'asc' } }],
    });
  }

  async scheduleAnalysis(
    auth: AuthenticatedUserContext,
    projectId: string,
    mode: ScheduleMode,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [activities, dependencies] = await Promise.all([
      this.prisma.activity.findMany({
        where: {
          projectId,
          companyId: auth.companyId,
          isActive: true,
        },
        include: {
          workingCalendar: {
            include: {
              weekdays: { orderBy: { weekdayNo: 'asc' } },
              exceptions: { orderBy: { exceptionDate: 'asc' } },
            },
          },
        },
        orderBy: { activityCode: 'asc' },
      }),
      this.prisma.activityDependency.findMany({
        where: {
          projectId,
          isActive: true,
          predecessor: { isActive: true },
          successor: { isActive: true },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const calendars = new Map(
      activities.map((activity) => [
        activity.workingCalendar.id,
        activity.workingCalendar,
      ]),
    );

    try {
      const analysis = calculateScheduleAnalysis({
        mode,
        activities: activities.map((activity) => ({
          id: activity.id,
          activityCode: activity.activityCode,
          activityName: activity.activityName,
          workingCalendarId: activity.workingCalendarId,
          plannedDurationWorkDays:
            activity.plannedDurationWorkDays.toNumber(),
          plannedStartDate: activity.plannedStartDate,
          plannedFinishDate: activity.plannedFinishDate,
          forecastStartDate: activity.forecastStartDate,
          forecastFinishDate: activity.forecastFinishDate,
          isMilestone: activity.isMilestone,
        })),
        dependencies: dependencies.map((dependency) => ({
          id: dependency.id,
          predecessorActivityId: dependency.predecessorActivityId,
          successorActivityId: dependency.successorActivityId,
          dependencyType: dependency.dependencyType as
            | 'FS'
            | 'SS'
            | 'FF'
            | 'SF',
          lagWorkDays: dependency.lagWorkDays.toNumber(),
        })),
        calendars: [...calendars.values()].map((calendar) => ({
          id: calendar.id,
          weekdays: calendar.weekdays.map((weekday) => ({
            weekdayNo: weekday.weekdayNo,
            isWorking: weekday.isWorking,
          })),
          exceptions: calendar.exceptions.map((exception) => ({
            exceptionDate: exception.exceptionDate,
            isWorkingOverride: exception.isWorkingOverride,
          })),
        })),
      });

      return { projectId, ...analysis };
    } catch (error) {
      if (error instanceof ScheduleEngineError) {
        throw new UnprocessableEntityException({
          code: error.code,
          detail: error.message,
        });
      }
      throw error;
    }
  }

  async createDependency(
    context: AuditContext,
    projectId: string,
    data: Required<
      Pick<
        DependencyInput,
        'predecessorActivityId' | 'successorActivityId' | 'dependencyType' | 'lagWorkDays'
      >
    >,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await this.assertDependencyActivities(
          tx,
          projectId,
          data.predecessorActivityId,
          data.successorActivityId,
        );
        await this.assertNoDependencyCycle(
          tx,
          projectId,
          {
            predecessorActivityId: data.predecessorActivityId,
            successorActivityId: data.successorActivityId,
            dependencyType: data.dependencyType,
            lagWorkDays: data.lagWorkDays,
          },
        );
        const created = await tx.activityDependency.create({
          data: { projectId, ...data },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY_DEPENDENCY',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'This Activity dependency already exists.');
      throw error;
    }
  }

  async updateDependency(
    context: AuditContext,
    id: string,
    data: DependencyInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.activityDependency.findFirst({
          where: { id },
        });
        if (!before) throw this.notFound('ACTIVITY_DEPENDENCY_NOT_FOUND', 'Activity Dependency');
        const projectId = before.projectId;
        await this.access.assertAccess(context.auth, projectId, tx);

        const predecessorActivityId =
          data.predecessorActivityId ?? before.predecessorActivityId;
        const successorActivityId =
          data.successorActivityId ?? before.successorActivityId;
        await this.assertDependencyActivities(
          tx,
          projectId,
          predecessorActivityId,
          successorActivityId,
        );
        if (before.isActive) {
          await this.assertNoDependencyCycle(
            tx,
            projectId,
            {
              predecessorActivityId,
              successorActivityId,
              dependencyType: data.dependencyType ?? before.dependencyType,
              lagWorkDays: data.lagWorkDays ?? before.lagWorkDays,
            },
            id,
          );
        }

        const after = await tx.activityDependency.update({ where: { id }, data });
        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY_DEPENDENCY',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'This Activity dependency already exists.');
      throw error;
    }
  }

  async setDependencyActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.activityDependency.findFirst({
        where: { id },
      });
      if (!before) throw this.notFound('ACTIVITY_DEPENDENCY_NOT_FOUND', 'Activity Dependency');
      await this.access.assertAccess(context.auth, before.projectId, tx);
      if (isActive && !before.isActive) {
        await this.assertNoDependencyCycle(
          tx,
          before.projectId,
          {
            predecessorActivityId: before.predecessorActivityId,
            successorActivityId: before.successorActivityId,
            dependencyType: before.dependencyType,
            lagWorkDays: before.lagWorkDays,
          },
          id,
        );
      }
      const after = await tx.activityDependency.update({
        where: { id },
        data: { isActive },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'ACTIVITY_DEPENDENCY',
          entityId: id,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );
      return after;
    });
  }

  private async assertCalendarAccess(
    auth: AuthenticatedUserContext,
    calendarId: string,
    tx: Prisma.TransactionClient,
  ) {
    const calendar = await tx.workingCalendar.findFirst({
      where: { id: calendarId, companyId: auth.companyId },
    });
    if (!calendar) {
      throw this.notFound('WORKING_CALENDAR_NOT_FOUND', 'Working Calendar');
    }
    if (calendar.projectId) {
      await this.access.assertAccess(auth, calendar.projectId, tx);
    }
    return calendar;
  }

  private async assertActivityReferences(
    tx: Prisma.TransactionClient,
    companyId: string,
    projectId: string,
    data: ActivityInput,
  ) {
    if (data.wbsId !== undefined) {
      const wbs = await tx.wbsElement.findFirst({
        where: { id: data.wbsId, projectId, isActive: true },
        select: { id: true },
      });
      if (!wbs) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_WBS',
          'Activity WBS must be active and belong to the same Project.',
        );
      }
    }

    if (data.parentActivityId) {
      const parent = await tx.activity.findFirst({
        where: { id: data.parentActivityId, projectId, isActive: true },
        select: { id: true },
      });
      if (!parent) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_PARENT',
          'Parent Activity must be active and belong to the same Project.',
        );
      }
    }

    if (data.activityTypeId) {
      const type = await tx.activityType.findFirst({
        where: { id: data.activityTypeId, companyId, isActive: true },
        select: { id: true },
      });
      if (!type) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_TYPE',
          'Activity Type must be active and belong to the same company.',
        );
      }
    }

    if (data.workingCalendarId !== undefined) {
      const calendar = await tx.workingCalendar.findFirst({
        where: {
          id: data.workingCalendarId,
          companyId,
          isActive: true,
          OR: [{ projectId: null }, { projectId }],
        },
        select: { id: true },
      });
      if (!calendar) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_CALENDAR',
          'Working Calendar must be active and valid for the Activity Project.',
        );
      }
    }

    if (data.statusDefinitionId) {
      const status = await tx.statusDefinition.findFirst({
        where: {
          id: data.statusDefinitionId,
          companyId,
          entityType: 'ACTIVITY',
          isActive: true,
        },
        select: { id: true },
      });
      if (!status) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_STATUS',
          'Activity Status must be an active ACTIVITY status belonging to the same company.',
        );
      }
    }

    if (data.responsibleEmployeeId) {
      const employee = await tx.employee.findFirst({
        where: { id: data.responsibleEmployeeId, companyId, isActive: true },
        select: { id: true },
      });
      if (!employee) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_EMPLOYEE',
          'Responsible Employee must be active and belong to the same company.',
        );
      }
    }

    if (data.ownerUserId) {
      const user = await tx.user.findFirst({
        where: { id: data.ownerUserId, companyId, isActive: true },
        select: { id: true },
      });
      if (!user) {
        throw this.invalidReference(
          'INVALID_ACTIVITY_OWNER',
          'Activity Owner must be active and belong to the same company.',
        );
      }
    }
  }

  private async assertNoActivityHierarchyCycle(
    tx: Prisma.TransactionClient,
    projectId: string,
    id: string,
    parentId: string,
  ) {
    let current: string | null = parentId;
    const seen = new Set<string>();
    while (current) {
      if (current === id || seen.has(current)) {
        throw new UnprocessableEntityException({
          code: 'ACTIVITY_HIERARCHY_CYCLE',
          detail: 'Activity hierarchy cannot contain a cycle.',
        });
      }
      seen.add(current);
      const row: { parentActivityId: string | null } | null =
        await tx.activity.findFirst({
          where: { id: current, projectId },
          select: { parentActivityId: true },
        });
      current = row?.parentActivityId ?? null;
    }
  }

  private async assertDependencyActivities(
    tx: Prisma.TransactionClient,
    projectId: string,
    predecessorId: string,
    successorId: string,
  ) {
    if (predecessorId === successorId) {
      throw new UnprocessableEntityException({
        code: 'ACTIVITY_DEPENDENCY_SELF_REFERENCE',
        detail: 'An Activity cannot depend on itself.',
      });
    }
    const count = await tx.activity.count({
      where: {
        id: { in: [predecessorId, successorId] },
        projectId,
        isActive: true,
      },
    });
    if (count !== 2) {
      throw new UnprocessableEntityException({
        code: 'ACTIVITY_DEPENDENCY_PROJECT_MISMATCH',
        detail: 'Dependency Activities must be active and belong to the same Project.',
      });
    }
  }

  private async assertNoDependencyCycle(
    tx: Prisma.TransactionClient,
    projectId: string,
    candidate: {
      predecessorActivityId: string;
      successorActivityId: string;
      dependencyType: string;
      lagWorkDays: Prisma.Decimal;
    },
    excludeId?: string,
  ) {
    const [activities, dependencies] = await Promise.all([
      tx.activity.findMany({
        where: { projectId, isActive: true },
        select: { id: true },
      }),
      tx.activityDependency.findMany({
        where: {
          projectId,
          isActive: true,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
        select: {
          id: true,
          predecessorActivityId: true,
          successorActivityId: true,
          dependencyType: true,
          lagWorkDays: true,
        },
      }),
    ]);

    try {
      assertDependencyGraphAcyclic(
        activities.map((activity) => activity.id),
        [
          ...dependencies.map((dependency) => ({
            id: dependency.id,
            predecessorActivityId: dependency.predecessorActivityId,
            successorActivityId: dependency.successorActivityId,
            dependencyType: dependency.dependencyType as
              | 'FS'
              | 'SS'
              | 'FF'
              | 'SF',
            lagWorkDays: dependency.lagWorkDays.toNumber(),
          })),
          {
            predecessorActivityId: candidate.predecessorActivityId,
            successorActivityId: candidate.successorActivityId,
            dependencyType: candidate.dependencyType as
              | 'FS'
              | 'SS'
              | 'FF'
              | 'SF',
            lagWorkDays: candidate.lagWorkDays.toNumber(),
          },
        ],
      );
    } catch (error) {
      if (
        error instanceof ScheduleEngineError &&
        error.code === 'ACTIVITY_DEPENDENCY_CYCLE'
      ) {
        throw new UnprocessableEntityException({
          code: error.code,
          detail: error.message,
        });
      }
      throw error;
    }
  }

  private assertMilestoneRule(
    isMilestone: boolean,
    duration: Prisma.Decimal,
    start: Date,
    finish: Date,
  ) {
    if (!isMilestone) return;
    if (!duration.isZero()) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MILESTONE_DURATION',
        detail: 'A milestone must have zero work-day duration.',
      });
    }
    if (start.getTime() !== finish.getTime()) {
      throw new UnprocessableEntityException({
        code: 'INVALID_MILESTONE_DATES',
        detail: 'A milestone planned start and planned finish must be the same date.',
      });
    }
  }

  private assertDateOrder(start: Date, finish: Date, field: string) {
    if (finish.getTime() < start.getTime()) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        detail: 'One or more fields are invalid.',
        errors: [{ field, message: 'Must not be earlier than the start date.' }],
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

  private invalidReference(code: string, detail: string) {
    return new UnprocessableEntityException({ code, detail });
  }

  private throwDuplicate(error: unknown, detail: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({ code: 'DUPLICATE_SCHEDULE_RECORD', detail });
    }
  }

  private notFound(code: string, entity: string) {
    return new NotFoundException({ code, detail: entity + ' not found.' });
  }
}
