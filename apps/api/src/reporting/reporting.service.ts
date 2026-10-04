import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

  async portfolioSignals(
    auth: AuthenticatedUserContext,
    projectIds: string[],
    asOf: Date,
    days: 14 | 28,
  ) {
    const requestedIds = [...new Set(projectIds)];
    if (requestedIds.length === 0) return [];

    const scope = await this.access.scopeWhere(auth);
    const allowedProjects = await this.prisma.project.findMany({
      where: {
        AND: [
          scope,
          { id: { in: requestedIds }, isActive: true },
        ],
      },
      select: { id: true },
    });
    const allowedIds = allowedProjects.map((row) => row.id);
    if (allowedIds.length === 0) return [];

    const [scheduleRows, requests, siteRows] = await Promise.all([
      this.scheduling.portfolioScheduleSignals(
        auth,
        allowedIds,
        asOf,
        days,
      ),
      this.prisma.purchaseRequest.findMany({
        where: {
          companyId: auth.companyId,
          projectId: { in: allowedIds },
        },
        select: {
          projectId: true,
          lines: {
            select: {
              id: true,
              requiredOnSite: true,
              purchaseOrderLines: {
                select: {
                  requiredOnSite: true,
                  expectedDelivery: true,
                  purchaseOrder: {
                    select: {
                      id: true,
                      poNumber: true,
                      revisionNo: true,
                      cancelledAt: true,
                      approvalInstance: {
                        select: { approvalState: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.$queryRaw<Array<{
        projectId: string;
        recentReportCount: number;
        issueCount: number;
        delayCount: number;
      }>>(Prisma.sql`
        WITH ranked_reports AS (
          SELECT
            dsr.id,
            dsr.project_id,
            ROW_NUMBER() OVER (
              PARTITION BY dsr.project_id
              ORDER BY dsr.report_date DESC, dsr.created_at DESC
            ) AS rn
          FROM daily_site_reports dsr
          WHERE dsr.company_id = ${auth.companyId}::uuid
            AND dsr.project_id IN (${Prisma.join(
              allowedIds.map((id) => Prisma.sql`${id}::uuid`),
            )})
            AND dsr.report_date <= ${asOf}
        )
        SELECT
          rr.project_id AS "projectId",
          COUNT(*)::INTEGER AS "recentReportCount",
          COALESCE(SUM((
            SELECT COUNT(*) FROM daily_site_report_issues i
            WHERE i.report_id = rr.id
          )), 0)::INTEGER AS "issueCount",
          COALESCE(SUM((
            SELECT COUNT(*) FROM daily_site_report_delays d
            WHERE d.report_id = rr.id
          )), 0)::INTEGER AS "delayCount"
        FROM ranked_reports rr
        WHERE rr.rn <= 7
        GROUP BY rr.project_id
      `),
    ]);

    const poByProjectAndNumber = new Map<
      string,
      Map<string, Array<{
        id: string;
        revisionNo: number;
        cancelledAt: Date | null;
        approvalState: string | null;
      }>>
    >();
    for (const request of requests) {
      let byNumber = poByProjectAndNumber.get(request.projectId);
      if (!byNumber) {
        byNumber = new Map();
        poByProjectAndNumber.set(request.projectId, byNumber);
      }
      for (const line of request.lines) {
        for (const poLine of line.purchaseOrderLines) {
          const order = poLine.purchaseOrder;
          const rows = byNumber.get(order.poNumber) ?? [];
          if (!rows.some((row) => row.id === order.id)) {
            rows.push({
              id: order.id,
              revisionNo: order.revisionNo,
              cancelledAt: order.cancelledAt,
              approvalState:
                order.approvalInstance?.approvalState ?? null,
            });
            byNumber.set(order.poNumber, rows);
          }
        }
      }
    }

    const currentPoIdsByProject = new Map<string, Set<string>>();
    for (const projectId of allowedIds) {
      const ids = new Set<string>();
      for (const revisions of (
        poByProjectAndNumber.get(projectId) ?? new Map()
      ).values()) {
        const ordered = [...revisions].sort(
          (left, right) => right.revisionNo - left.revisionNo,
        );
        const newest = ordered[0];
        if (!newest || newest.cancelledAt) continue;
        if (newest.approvalState === 'REJECTED') {
          const approved = ordered.find(
            (row) =>
              !row.cancelledAt &&
              row.approvalState === 'APPROVED',
          );
          if (approved) ids.add(approved.id);
        } else {
          ids.add(newest.id);
        }
      }
      currentPoIdsByProject.set(projectId, ids);
    }

    const procurementByProject = new Map(
      allowedIds.map((projectId) => [
        projectId,
        {
          total: 0,
          AT_RISK: 0,
          ON_TIME: 0,
          UNAVAILABLE: 0,
        },
      ]),
    );
    for (const request of requests) {
      const summary = procurementByProject.get(request.projectId)!;
      const currentIds =
        currentPoIdsByProject.get(request.projectId) ??
        new Set<string>();
      for (const line of request.lines) {
        summary.total += 1;
        const currentLines = line.purchaseOrderLines.filter((poLine) =>
          currentIds.has(poLine.purchaseOrder.id),
        );
        const risks = currentLines.map((poLine) => {
          if (!poLine.requiredOnSite || !poLine.expectedDelivery) {
            return 'UNAVAILABLE' as const;
          }
          return poLine.expectedDelivery.getTime() >
            poLine.requiredOnSite.getTime()
            ? ('AT_RISK' as const)
            : ('ON_TIME' as const);
        });
        const risk =
          risks.includes('AT_RISK')
            ? 'AT_RISK'
            : risks.includes('UNAVAILABLE')
              ? 'UNAVAILABLE'
              : risks[0] ?? 'UNAVAILABLE';
        summary[risk] += 1;
      }
    }

    const scheduleByProject = new Map(
      scheduleRows.map((row) => [row.projectId, row.schedule]),
    );
    const siteByProject = new Map(
      siteRows.map((row) => [row.projectId, row]),
    );

    return allowedIds.map((projectId) => ({
      projectId,
      schedule:
        scheduleByProject.get(projectId) ?? {
          total: 0,
          completed: 0,
          critical: 0,
          delayed: 0,
          lookahead: 0,
        },
      procurement: procurementByProject.get(projectId)!,
      siteExecution:
        siteByProject.get(projectId) ?? {
          projectId,
          recentReportCount: 0,
          issueCount: 0,
          delayCount: 0,
        },
    }));
  }

  async procurement(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [project, requests, purchaseOrders] = await Promise.all([
      this.prisma.project.findFirstOrThrow({
        where: { id: projectId, companyId: auth.companyId },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
        },
      }),
      this.prisma.purchaseRequest.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
        },
        include: {
          approvalInstance: {
            select: { approvalState: true },
          },
          lines: {
            include: {
              uom: {
                select: { id: true, uomCode: true, uomName: true },
              },
              wbs: {
                select: { id: true, wbsCode: true, wbsName: true },
              },
              costCode: {
                select: { id: true, costCode: true, costName: true },
              },
              activity: {
                select: { id: true, activityCode: true, activityName: true },
              },
              rfqLines: {
                include: {
                  rfq: {
                    select: {
                      id: true,
                      rfqNumber: true,
                      rfqDate: true,
                      closingDate: true,
                      _count: {
                        select: { suppliers: true, quotations: true },
                      },
                      quotations: {
                        select: {
                          id: true,
                          supplierReference: true,
                          quotationDate: true,
                          validityDate: true,
                          supplier: {
                            select: {
                              id: true,
                              supplierCode: true,
                              supplierName: true,
                            },
                          },
                        },
                        orderBy: { quotationDate: 'asc' },
                      },
                    },
                  },
                  award: {
                    select: {
                      id: true,
                      supplierId: true,
                      supplierCodeSnapshot: true,
                      supplierNameSnapshot: true,
                      supplierQuotationId: true,
                      supplierQuotationLineId: true,
                      supplierReferenceSnapshot: true,
                      quotationDateSnapshot: true,
                      selectedAt: true,
                    },
                  },
                },
                orderBy: [{ rfq: { rfqNumber: 'asc' } }, { lineNo: 'asc' }],
              },
              purchaseOrderLines: {
                include: {
                  purchaseOrder: {
                    include: {
                      approvalInstance: {
                        select: { approvalState: true },
                      },
                      supplier: {
                        select: {
                          id: true,
                          supplierCode: true,
                          supplierName: true,
                        },
                      },
                    },
                  },
                },
                orderBy: [
                  { purchaseOrder: { poNumber: 'asc' } },
                  { purchaseOrder: { revisionNo: 'asc' } },
                ],
              },
            },
            orderBy: { lineNo: 'asc' },
          },
        },
        orderBy: [{ createdAt: 'asc' }, { prNumber: 'asc' }],
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
        },
        select: {
          id: true,
          poNumber: true,
          revisionNo: true,
          cancelledAt: true,
          approvalInstance: {
            select: { approvalState: true },
          },
        },
        orderBy: [{ poNumber: 'asc' }, { revisionNo: 'desc' }],
      }),
    ]);

    const lifecycle = (row: {
      cancelledAt?: Date | null;
      approvalInstance?: { approvalState: string } | null;
    }) =>
      row.cancelledAt
        ? 'CANCELLED'
        : (row.approvalInstance?.approvalState ?? 'DRAFT');

    const dateKey = (value: Date | null | undefined) =>
      value ? value.toISOString().slice(0, 10) : null;

    const risk = (
      requiredOnSite: Date | null,
      expectedDelivery: Date | null,
    ): 'AT_RISK' | 'ON_TIME' | 'UNAVAILABLE' => {
      if (!requiredOnSite || !expectedDelivery) return 'UNAVAILABLE';
      return expectedDelivery.getTime() > requiredOnSite.getTime()
        ? 'AT_RISK'
        : 'ON_TIME';
    };

    const revisionsByPoNumber = new Map<
      string,
      typeof purchaseOrders
    >();
    for (const order of purchaseOrders) {
      const revisions =
        revisionsByPoNumber.get(order.poNumber) ?? [];
      revisions.push(order);
      revisionsByPoNumber.set(order.poNumber, revisions);
    }

    const currentRevisionByPoNumber = new Map<string, string>();
    for (const [poNumber, revisions] of revisionsByPoNumber) {
      const ordered = [...revisions].sort(
        (a, b) => b.revisionNo - a.revisionNo,
      );
      const newest = ordered[0];
      if (!newest || newest.cancelledAt) continue;
      const newestState =
        newest.approvalInstance?.approvalState ?? 'DRAFT';
      if (newestState === 'REJECTED') {
        const latestApproved = ordered.find(
          (order) =>
            !order.cancelledAt &&
            order.approvalInstance?.approvalState === 'APPROVED',
        );
        if (latestApproved) {
          currentRevisionByPoNumber.set(
            poNumber,
            latestApproved.id,
          );
        }
        continue;
      }
      currentRevisionByPoNumber.set(poNumber, newest.id);
    }

    const lines = requests.flatMap((request) =>
      request.lines.map((line) => {
        const poRows = line.purchaseOrderLines.map((poLine) => ({
          id: poLine.id,
          purchaseOrderId: poLine.purchaseOrder.id,
          poNumber: poLine.purchaseOrder.poNumber,
          revisionNo: poLine.purchaseOrder.revisionNo,
          lifecycleState: lifecycle(poLine.purchaseOrder),
          supplier: poLine.purchaseOrder.supplier,
          requiredOnSite: dateKey(poLine.requiredOnSite),
          expectedDelivery: dateKey(poLine.expectedDelivery),
          scheduleRisk: risk(
            poLine.requiredOnSite,
            poLine.expectedDelivery,
          ),
          quotationAwardId: poLine.quotationAwardId,
          supplierQuotationId: poLine.supplierQuotationId,
          supplierQuotationLineId: poLine.supplierQuotationLineId,
          rfqId: poLine.rfqId,
          rfqLineId: poLine.rfqLineId,
        }));

        const currentPoRows = poRows.filter(
          (row) =>
            currentRevisionByPoNumber.get(row.poNumber) ===
            row.purchaseOrderId,
        );

        const riskDriver =
          currentPoRows.find(
            (row) => row.scheduleRisk === 'AT_RISK',
          ) ??
          currentPoRows.find(
            (row) => row.scheduleRisk === 'UNAVAILABLE',
          ) ??
          currentPoRows[0] ??
          null;

        const scheduleRisk:
          | 'AT_RISK'
          | 'ON_TIME'
          | 'UNAVAILABLE' =
          riskDriver?.scheduleRisk ?? 'UNAVAILABLE';
        const requiredOnSite =
          riskDriver?.requiredOnSite ??
          dateKey(line.requiredOnSite);
        const expectedDelivery =
          riskDriver?.expectedDelivery ?? null;

        return {
          id: line.id,
          pr: {
            id: request.id,
            prNumber: request.prNumber,
            lineNo: line.lineNo,
            lifecycleState: lifecycle(request),
          },
          lineType: line.lineType,
          materialCode: line.materialCodeSnapshot,
          description: line.description,
          quantity: line.quantity.toString(),
          uom: line.uom,
          requiredOnSite,
          expectedDelivery,
          scheduleRisk,
          context: {
            wbs: line.wbs,
            costCode: line.costCode,
            activity: line.activity,
          },
          rfqs: line.rfqLines.map((rfqLine) => ({
            rfqLineId: rfqLine.id,
            rfqId: rfqLine.rfq.id,
            rfqNumber: rfqLine.rfq.rfqNumber,
            rfqDate: dateKey(rfqLine.rfq.rfqDate),
            closingDate: dateKey(rfqLine.rfq.closingDate),
            invitedSupplierCount: rfqLine.rfq._count.suppliers,
            quotationCount: rfqLine.rfq._count.quotations,
            quotations: rfqLine.rfq.quotations.map(
              (quotation) => ({
                id: quotation.id,
                supplierReference: quotation.supplierReference,
                quotationDate: dateKey(quotation.quotationDate)!,
                validityDate: dateKey(quotation.validityDate),
                supplier: quotation.supplier,
              }),
            ),
            award: rfqLine.award,
          })),
          purchaseOrders: poRows,
        };
      }),
    );

    const summary = lines.reduce(
      (result, line) => {
        result.total += 1;
        result[line.scheduleRisk] += 1;
        if (line.rfqs.length > 0) result.rfq += 1;
        if (line.rfqs.some((item) => item.award)) result.awarded += 1;
        if (line.purchaseOrders.length > 0) result.purchaseOrder += 1;
        return result;
      },
      {
        total: 0,
        AT_RISK: 0,
        ON_TIME: 0,
        UNAVAILABLE: 0,
        rfq: 0,
        awarded: 0,
        purchaseOrder: 0,
      },
    );

    return { project, summary, lines };
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
