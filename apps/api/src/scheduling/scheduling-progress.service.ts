import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  APPROVAL_STATE,
  ApprovalService,
} from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  EngineCalendar,
  ScheduleEngineError,
  calculateWorkingDayVariance,
} from './schedule-engine';
import { SchedulingService } from './scheduling.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

@Injectable()
export class SchedulingProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
    private readonly scheduling: SchedulingService,
  ) {}

  baselineWorkflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'SCHEDULE_BASELINE',
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

  async listBaselines(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.scheduleBaseline.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
      },
      include: {
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            currentStepNo: true,
            startedAt: true,
            completedAt: true,
          },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        _count: { select: { activities: true } },
      },
      orderBy: { versionNo: 'desc' },
    });

    const currentApprovedId = rows.find(
      (row) =>
        row.approvalInstance?.approvalState === APPROVAL_STATE.APPROVED,
    )?.id;

    return rows.map((row) => ({
      ...row,
      isCurrent: row.id === currentApprovedId,
    }));
  }

  async getBaseline(
    auth: AuthenticatedUserContext,
    baselineId: string,
  ) {
    const row = await this.prisma.scheduleBaseline.findFirst({
      where: { id: baselineId, companyId: auth.companyId },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
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
              orderBy: { actionAt: 'asc' },
              include: {
                actionByUser: {
                  select: { id: true, displayName: true, email: true },
                },
              },
            },
          },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        activities: {
          orderBy: { activityCode: 'asc' },
        },
      },
    });
    if (!row) throw this.baselineNotFound();
    await this.access.assertAccess(auth, row.projectId);

    const current = await this.prisma.scheduleBaseline.findFirst({
      where: {
        companyId: auth.companyId,
        projectId: row.projectId,
        approvalInstance: {
          is: { approvalState: APPROVAL_STATE.APPROVED },
        },
      },
      select: { id: true },
      orderBy: { versionNo: 'desc' },
    });

    return { ...row, isCurrent: current?.id === row.id };
  }

  async submitBaseline(
    context: AuditContext,
    projectId: string,
    workflowCode: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);

        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          projectId,
        );

        const analysis = await this.scheduling.scheduleAnalysisInTransaction(
          context.auth,
          projectId,
          'planned',
          tx,
        );

        const activities = await tx.activity.findMany({
          where: {
            companyId: context.auth.companyId,
            projectId,
            isActive: true,
          },
          include: {
            wbs: {
              select: { id: true, wbsCode: true, wbsName: true },
            },
          },
          orderBy: { activityCode: 'asc' },
        });

        const analysisById = new Map(
          analysis.activities.map((row) => [row.id, row]),
        );
        const max = await tx.scheduleBaseline.aggregate({
          where: { projectId },
          _max: { versionNo: true },
        });
        const versionNo = (max._max.versionNo ?? 0) + 1;

        const baseline = await tx.scheduleBaseline.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            versionNo,
            submittedByUserId: context.auth.userId,
          },
        });

        if (activities.length) {
          await tx.scheduleBaselineActivity.createMany({
            data: activities.map((activity) => {
              const calculated = analysisById.get(activity.id);
              if (!calculated) {
                throw new UnprocessableEntityException({
                  code: 'BASELINE_SCHEDULE_ANALYSIS_MISSING',
                  detail:
                    'A current Activity could not be represented in the planned schedule analysis.',
                });
              }
              return {
                scheduleBaselineId: baseline.id,
                activityId: activity.id,
                wbsId: activity.wbsId,
                activityCode: activity.activityCode,
                activityName: activity.activityName,
                wbsCode: activity.wbs.wbsCode,
                wbsName: activity.wbs.wbsName,
                isSummary: activity.isSummary,
                isMilestone: activity.isMilestone,
                plannedDurationWorkDays:
                  activity.plannedDurationWorkDays,
                plannedStartDate: this.date(
                  calculated.calculatedStartDate,
                ),
                plannedFinishDate: this.date(
                  calculated.calculatedFinishDate,
                ),
              };
            }),
          });
        }

        const approvalInstance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'SCHEDULE_BASELINE',
            entityId: baseline.id,
          },
          tx,
        );

        const submitted = await tx.scheduleBaseline.update({
          where: { id: baseline.id },
          data: { approvalInstanceId: approvalInstance.id },
          include: {
            approvalInstance: true,
            _count: { select: { activities: true } },
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SCHEDULE_BASELINE',
            entityId: baseline.id,
            action: 'SUBMIT',
            newValues: {
              projectId,
              versionNo,
              approvalInstanceId: approvalInstance.id,
              activityCount: activities.length,
            },
          },
          tx,
        );

        return { ...submitted, isCurrent: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async approveBaseline(
    context: AuditContext,
    baselineId: string,
    comment?: string,
  ) {
    const baseline = await this.baselineForAction(
      context.auth,
      baselineId,
    );
    const instance = await this.approvals.approve(
      baseline.approvalInstanceId,
      context.auth,
      baseline.submittedByUserId,
      comment,
    );

    await this.audit.record({
      ...context,
      entityType: 'SCHEDULE_BASELINE',
      entityId: baseline.id,
      action: 'APPROVAL_APPROVE',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });

    return this.getBaseline(context.auth, baselineId);
  }

  async rejectBaseline(
    context: AuditContext,
    baselineId: string,
    comment?: string,
  ) {
    const baseline = await this.baselineForAction(
      context.auth,
      baselineId,
    );
    const instance = await this.approvals.reject(
      baseline.approvalInstanceId,
      context.auth,
      baseline.submittedByUserId,
      comment,
    );

    await this.audit.record({
      ...context,
      entityType: 'SCHEDULE_BASELINE',
      entityId: baseline.id,
      action: 'APPROVAL_REJECT',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });

    return this.getBaseline(context.auth, baselineId);
  }

  async recordProgress(
    context: AuditContext,
    activityId: string,
    input: {
      progressDate: Date;
      percentComplete: Prisma.Decimal;
      note?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const activity = await tx.activity.findFirst({
        where: {
          id: activityId,
          companyId: context.auth.companyId,
          isActive: true,
        },
        select: { id: true, projectId: true },
      });
      if (!activity) {
        throw new NotFoundException({
          code: 'ACTIVITY_NOT_FOUND',
          detail: 'Activity not found.',
        });
      }
      await this.access.assertAccess(
        context.auth,
        activity.projectId,
        tx,
      );

      const created = await tx.activityProgress.create({
        data: {
          companyId: context.auth.companyId,
          projectId: activity.projectId,
          activityId,
          progressDate: input.progressDate,
          percentComplete: input.percentComplete,
          ...(input.note !== undefined ? { note: input.note } : {}),
          recordedByUserId: context.auth.userId,
        },
        include: {
          recordedBy: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'ACTIVITY_PROGRESS',
          entityId: created.id,
          action: 'CREATE',
          newValues: created,
        },
        tx,
      );

      return created;
    });
  }

  async progressHistory(
    auth: AuthenticatedUserContext,
    activityId: string,
  ) {
    const activity = await this.prisma.activity.findFirst({
      where: {
        id: activityId,
        companyId: auth.companyId,
      },
      select: { projectId: true },
    });
    if (!activity) {
      throw new NotFoundException({
        code: 'ACTIVITY_NOT_FOUND',
        detail: 'Activity not found.',
      });
    }
    await this.access.assertAccess(auth, activity.projectId);

    return this.prisma.activityProgress.findMany({
      where: { activityId, companyId: auth.companyId },
      include: {
        recordedBy: {
          select: { id: true, displayName: true, email: true },
        },
      },
      orderBy: [
        { progressDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async comparison(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [baseline, forecast, activities] = await Promise.all([
      this.prisma.scheduleBaseline.findFirst({
        where: {
          companyId: auth.companyId,
          projectId,
          approvalInstance: {
            is: { approvalState: APPROVAL_STATE.APPROVED },
          },
        },
        include: {
          approvalInstance: {
            select: {
              id: true,
              approvalState: true,
              completedAt: true,
            },
          },
          activities: true,
        },
        orderBy: { versionNo: 'desc' },
      }),
      this.scheduling.scheduleAnalysis(auth, projectId, 'forecast'),
      this.prisma.activity.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          isActive: true,
        },
        include: {
          wbs: {
            select: { id: true, wbsCode: true, wbsName: true },
          },
          workingCalendar: {
            include: {
              weekdays: { orderBy: { weekdayNo: 'asc' } },
              exceptions: { orderBy: { exceptionDate: 'asc' } },
            },
          },
          progressHistory: {
            orderBy: [
              { progressDate: 'desc' },
              { createdAt: 'desc' },
            ],
            take: 1,
          },
        },
        orderBy: { activityCode: 'asc' },
      }),
    ]);

    const baselineByActivity = new Map(
      baseline?.activities.map((row) => [row.activityId, row]) ?? [],
    );
    const forecastByActivity = new Map(
      forecast.activities.map((row) => [row.id, row]),
    );

    const rows = activities.map((activity) => {
      const baselineRow = baselineByActivity.get(activity.id);
      const calculated = forecastByActivity.get(activity.id);
      const forecastStartDate =
        activity.forecastStartDate ??
        (calculated
          ? this.date(calculated.calculatedStartDate)
          : null);
      const forecastFinishDate =
        activity.forecastFinishDate ??
        (calculated
          ? this.date(calculated.calculatedFinishDate)
          : null);

      let startVarianceWorkDays: number | null = null;
      let finishVarianceWorkDays: number | null = null;
      let delayWorkDays: number | null = null;
      let delayStatus:
        | 'DELAYED'
        | 'ON_TIME'
        | 'AHEAD'
        | 'UNAVAILABLE' = 'UNAVAILABLE';

      if (
        baselineRow &&
        forecastStartDate &&
        forecastFinishDate
      ) {
        const calendar = this.engineCalendar(activity.workingCalendar);
        try {
          startVarianceWorkDays = calculateWorkingDayVariance(
            calendar,
            baselineRow.plannedStartDate,
            forecastStartDate,
          );
          finishVarianceWorkDays = calculateWorkingDayVariance(
            calendar,
            baselineRow.plannedFinishDate,
            forecastFinishDate,
          );
          delayWorkDays = finishVarianceWorkDays;
          delayStatus =
            finishVarianceWorkDays > 0
              ? 'DELAYED'
              : finishVarianceWorkDays < 0
                ? 'AHEAD'
                : 'ON_TIME';
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

      const latestProgress = activity.progressHistory[0] ?? null;

      return {
        activityId: activity.id,
        activityCode: activity.activityCode,
        activityName: activity.activityName,
        wbs: activity.wbs,
        isSummary: activity.isSummary,
        isMilestone: activity.isMilestone,
        currentPercentComplete:
          latestProgress?.percentComplete.toNumber() ?? null,
        actualStartDate: activity.actualStartDate,
        actualFinishDate: activity.actualFinishDate,
        baselineStartDate: baselineRow?.plannedStartDate ?? null,
        baselineFinishDate: baselineRow?.plannedFinishDate ?? null,
        forecastStartDate,
        forecastFinishDate,
        startVarianceWorkDays,
        finishVarianceWorkDays,
        delayWorkDays,
        delayStatus,
      };
    });

    return {
      projectId,
      currentBaseline: baseline
        ? {
            id: baseline.id,
            versionNo: baseline.versionNo,
            approvedAt:
              baseline.approvalInstance?.completedAt ?? null,
          }
        : null,
      activities: rows,
    };
  }

  private async baselineForAction(
    auth: AuthenticatedUserContext,
    baselineId: string,
  ) {
    const baseline = await this.prisma.scheduleBaseline.findFirst({
      where: { id: baselineId, companyId: auth.companyId },
      select: {
        id: true,
        projectId: true,
        submittedByUserId: true,
        approvalInstanceId: true,
      },
    });
    if (!baseline) throw this.baselineNotFound();
    await this.access.assertAccess(auth, baseline.projectId);
    if (!baseline.approvalInstanceId) {
      throw new ConflictException({
        code: 'BASELINE_APPROVAL_NOT_STARTED',
        detail: 'Schedule Baseline approval has not started.',
      });
    }
    return {
      ...baseline,
      approvalInstanceId: baseline.approvalInstanceId,
    };
  }

  private engineCalendar(calendar: {
    id: string;
    timezoneName: string;
    weekdays: Array<{
      weekdayNo: number;
      isWorking: boolean;
      startTime: Date | null;
      endTime: Date | null;
    }>;
    exceptions: Array<{
      exceptionDate: Date;
      isWorkingOverride: boolean;
      startTime: Date | null;
      endTime: Date | null;
    }>;
  }): EngineCalendar {
    return {
      id: calendar.id,
      timezoneName: calendar.timezoneName,
      weekdays: calendar.weekdays.map((row) => ({
        weekdayNo: row.weekdayNo,
        isWorking: row.isWorking,
        startMinute: this.timeMinute(row.startTime),
        endMinute: this.timeMinute(row.endTime),
      })),
      exceptions: calendar.exceptions.map((row) => ({
        exceptionDate: row.exceptionDate,
        isWorkingOverride: row.isWorkingOverride,
        startMinute: this.timeMinute(row.startTime),
        endMinute: this.timeMinute(row.endTime),
      })),
    };
  }

  private timeMinute(value: Date | null): number | null {
    if (!value) return null;
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  private date(value: string): Date {
    return new Date(value + 'T00:00:00.000Z');
  }

  private baselineNotFound() {
    return new NotFoundException({
      code: 'SCHEDULE_BASELINE_NOT_FOUND',
      detail: 'Schedule Baseline not found.',
    });
  }
}
