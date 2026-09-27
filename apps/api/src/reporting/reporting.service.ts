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

  async procurement(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [project, requests] = await Promise.all([
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

        const rowsByPoNumber = new Map<
          string,
          typeof poRows
        >();
        for (const row of poRows) {
          const group = rowsByPoNumber.get(row.poNumber) ?? [];
          group.push(row);
          rowsByPoNumber.set(row.poNumber, group);
        }

        const currentPoRows = [...rowsByPoNumber.values()].flatMap(
          (group) => {
            const revisions = [...group].sort(
              (a, b) => b.revisionNo - a.revisionNo,
            );
            const newest = revisions[0];
            if (!newest || newest.lifecycleState === 'CANCELLED') {
              return [];
            }
            if (newest.lifecycleState === 'REJECTED') {
              const latestApproved = revisions.find(
                (row) => row.lifecycleState === 'APPROVED',
              );
              return latestApproved ? [latestApproved] : [];
            }
            return [newest];
          },
        );

        const currentRisks = currentPoRows.map(
          (row) => row.scheduleRisk,
        );
        const scheduleRisk:
          | 'AT_RISK'
          | 'ON_TIME'
          | 'UNAVAILABLE' = currentRisks.includes('AT_RISK')
          ? 'AT_RISK'
          : currentRisks.length > 0 &&
              currentRisks.every((value) => value === 'ON_TIME')
            ? 'ON_TIME'
            : 'UNAVAILABLE';

        const currentDeliveryDates = currentPoRows
          .map((row) => row.expectedDelivery)
          .filter((value): value is string => Boolean(value))
          .sort();
        const expectedDelivery =
          currentDeliveryDates.length > 0
            ? currentDeliveryDates[currentDeliveryDates.length - 1]!
            : null;

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
          requiredOnSite: dateKey(line.requiredOnSite),
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
