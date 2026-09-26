import { Injectable } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SchedulingProgressService } from '../scheduling/scheduling-progress.service';

@Injectable()
export class ReportingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly scheduling: SchedulingProgressService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
      },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async projectEngineer(
    auth: AuthenticatedUserContext,
    projectId: string,
    asOf: Date,
    days: 14 | 28,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [project, presentation, lookahead, reports, assignments] =
      await Promise.all([
        this.prisma.project.findFirstOrThrow({
          where: {
            id: projectId,
            companyId: auth.companyId,
          },
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            plannedStartDate: true,
            plannedCompletionDate: true,
            actualStartDate: true,
            actualCompletionDate: true,
          },
        }),
        this.scheduling.presentation(auth, projectId),
        this.scheduling.lookahead(auth, projectId, asOf, days),
        this.prisma.dailySiteReport.findMany({
          where: {
            companyId: auth.companyId,
            projectId,
            reportDate: { lte: asOf },
          },
          include: {
            createdBy: {
              select: { id: true, displayName: true },
            },
            _count: {
              select: {
                manpowerLines: true,
                materialUsage: true,
                equipmentUsage: true,
                progressLines: true,
                issues: true,
                delays: true,
                inspections: true,
              },
            },
            manpowerLines: {
              select: { headcount: true },
            },
          },
          orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
          take: 7,
        }),
        this.prisma.equipmentAssignment.findMany({
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
              include: {
                equipmentType: {
                  select: {
                    id: true,
                    equipmentTypeCode: true,
                    equipmentTypeName: true,
                  },
                },
              },
            },
          },
          orderBy: [{ equipment: { equipmentCode: 'asc' } }],
        }),
      ]);

    const scheduleSummary = presentation.activities.reduce(
      (summary, activity) => {
        summary.total += 1;
        if (activity.isCritical) summary.critical += 1;
        if (activity.delayStatus === 'DELAYED') summary.delayed += 1;
        if (activity.currentPercentComplete === 100) summary.completed += 1;
        return summary;
      },
      { total: 0, critical: 0, delayed: 0, completed: 0 },
    );

    const latestReports = reports.map((report) => ({
      id: report.id,
      reportDate: report.reportDate,
      status: report.status,
      weatherObservation: report.weatherObservation,
      generalRemarks: report.generalRemarks,
      createdBy: report.createdBy,
      totalManpower: report.manpowerLines.reduce(
        (sum, line) => sum + line.headcount,
        0,
      ),
      counts: {
        materialUsage: report._count.materialUsage,
        equipmentUsage: report._count.equipmentUsage,
        progress: report._count.progressLines,
        issues: report._count.issues,
        delays: report._count.delays,
        inspections: report._count.inspections,
      },
    }));

    return {
      project,
      asOfDate: asOf.toISOString().slice(0, 10),
      schedule: {
        currentBaseline: presentation.currentBaseline,
        summary: scheduleSummary,
        activities: presentation.activities,
        lookahead: {
          window: lookahead.window,
          activities: lookahead.activities,
        },
      },
      siteExecution: {
        latestReports,
      },
      equipment: {
        assignedCount: assignments.length,
        assignments: assignments.map((assignment) => ({
          assignmentId: assignment.id,
          assignedFrom: assignment.assignedFrom,
          assignedTo: assignment.assignedTo,
          equipment: {
            id: assignment.equipment.id,
            equipmentCode: assignment.equipment.equipmentCode,
            equipmentName: assignment.equipment.equipmentName,
            operationalStatus: assignment.equipment.operationalStatus,
            equipmentType: assignment.equipment.equipmentType,
          },
        })),
      },
    };
  }
}
