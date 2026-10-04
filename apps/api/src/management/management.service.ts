import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { CostControlService } from '../cost-control/cost-control.service';
import { CashFlowService } from '../finance/cash-flow.service';
import { InventoryReportService } from '../inventory/inventory-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ReportingService } from '../reporting/reporting.service';

export type ManagementSummaryOptions = {
  asOf: Date;
  days: 14 | 28;
};

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly reporting: ReportingService,
    private readonly costControl: CostControlService,
    private readonly cashFlow: CashFlowService,
    private readonly inventory: InventoryReportService,
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

  async projectSummary(
    auth: AuthenticatedUserContext,
    projectId: string,
    options: ManagementSummaryOptions,
  ) {
    await this.access.assertAccess(auth, projectId);

    const [engineer, procurement, cost, cashFlow, inventorySummary] =
      await Promise.all([
        this.reporting.projectEngineer(
          auth,
          projectId,
          options.asOf,
          options.days,
        ),
        this.reporting.procurement(auth, projectId),
        this.costControl.projectCostControl(auth, projectId),
        this.cashFlow.projectCashFlow(auth, projectId),
        this.inventory.balanceSummary(auth, { projectId }),
      ]);

    if (cost.baseCurrencyCode !== cashFlow.baseCurrencyCode) {
      throw new Error(
        'Canonical Management financial sources returned inconsistent Company base currencies.',
      );
    }

    const recentReports = engineer.siteExecution.latestReports;
    const siteCounts = recentReports.reduce(
      (result, report) => ({
        issues: result.issues + report.counts.issues,
        delays: result.delays + report.counts.delays,
        inspections: result.inspections + report.counts.inspections,
      }),
      { issues: 0, delays: 0, inspections: 0 },
    );

    return {
      contractVersion: 'V0.8-A',
      project: {
        id: engineer.project.id,
        projectCode: engineer.project.projectCode,
        projectName: engineer.project.projectName,
        plannedStartDate: this.day(engineer.project.plannedStartDate),
        plannedCompletionDate: this.day(
          engineer.project.plannedCompletionDate,
        ),
        actualStartDate: this.day(engineer.project.actualStartDate),
        actualCompletionDate: this.day(
          engineer.project.actualCompletionDate,
        ),
      },
      asOfDate: engineer.asOfDate,
      lookaheadDays: options.days,
      baseCurrencyCode: cost.baseCurrencyCode,
      domains: {
        schedule: {
          status: 'AVAILABLE' as const,
          currentBaseline:
            engineer.schedule.currentBaseline === null
              ? {
                  status: 'UNAVAILABLE' as const,
                  reason: 'NO_APPROVED_BASELINE',
                }
              : {
                  status: 'AVAILABLE' as const,
                  id: engineer.schedule.currentBaseline.id,
                  versionNo:
                    engineer.schedule.currentBaseline.versionNo,
                  approvedAt:
                    engineer.schedule.currentBaseline.approvedAt,
                },
          summary: engineer.schedule.summary,
          lookaheadActivityCount:
            engineer.schedule.lookahead.activities.length,
        },
        siteExecution: {
          status: 'AVAILABLE' as const,
          recentReportCount: recentReports.length,
          latestReportDate:
            recentReports[0] === undefined
              ? null
              : this.day(recentReports[0].reportDate),
          issueCount: siteCounts.issues,
          delayCount: siteCounts.delays,
          inspectionCount: siteCounts.inspections,
          assignedEquipmentCount: engineer.equipment.assignedCount,
        },
        procurement: {
          status: 'AVAILABLE' as const,
          summary: procurement.summary,
        },
        inventory: {
          status: 'AVAILABLE' as const,
          balanceRowCount: inventorySummary.balanceRowCount,
          warehouseCount: inventorySummary.warehouseCount,
          materialCount: inventorySummary.materialCount,
          uomCount: inventorySummary.uomCount,
          quantityAggregation:
            'NOT_APPLICABLE_MIXED_MATERIAL_AND_UOM_DIMENSIONS' as const,
        },
        cost: {
          status: 'AVAILABLE' as const,
          originalBudget: this.money(cost.totals.originalBudget),
          revisedBudget: this.money(cost.totals.revisedBudget),
          committedCost: this.money(
            cost.totals.committedCost.total,
          ),
          actualCost: this.money(cost.totals.actualCost.total),
          paidCost: this.money(cost.totals.paidCost.total),
          remainingCommitment: this.money(
            cost.totals.remainingCommitment.total,
          ),
          uncommittedEtc: this.money(cost.totals.uncommittedEtc),
          costToComplete: this.money(cost.totals.costToComplete),
          forecastCost: this.money(cost.totals.forecastCost),
          variance: this.money(cost.totals.variance),
          commercial: {
            originalContractValue: this.money(
              cost.totals.commercial.originalContractValue,
            ),
            approvedVariationValue: this.money(
              cost.totals.commercial.approvedVariationValue,
            ),
            revisedContractValue: this.money(
              cost.totals.commercial.revisedContractValue,
            ),
            actualRevenue: this.money(
              cost.totals.commercial.actualRevenue,
            ),
            cashReceived: this.money(
              cost.totals.commercial.cashReceived,
            ),
            forecastRevenue: this.money(
              cost.totals.commercial.forecastRevenue,
            ),
            actualProfit: this.optionalMoney(
              cost.totals.commercial.actualProfit,
            ),
            forecastProfit: this.optionalMoney(
              cost.totals.commercial.forecastProfit,
            ),
          },
        },
        finance: {
          status: 'AVAILABLE' as const,
          inflowAmount: this.money(cashFlow.totals.inflowAmount),
          outflowAmount: this.money(cashFlow.totals.outflowAmount),
          netCashFlow: this.money(cashFlow.totals.netCashFlow),
        },
      },
      sourceTraceability: {
        scheduleSite: this.sourceContract(
          auth,
          'V0.2 Scheduling / Site Execution',
          ['schedule.programme.view', 'site.daily_report.view'],
        ),
        procurement: this.sourceContract(
          auth,
          'V0.3 Procurement',
          [
            'procurement.pr.view',
            'procurement.rfq.view',
            'procurement.po.view',
          ],
        ),
        inventory: this.sourceContract(
          auth,
          'V0.4 Inventory',
          ['inventory.report.view'],
        ),
        cost: this.sourceContract(
          auth,
          'V0.7 Cost Control',
          ['cost.control.view'],
        ),
        finance: this.sourceContract(
          auth,
          'V0.6 Finance',
          ['finance.payment.view'],
        ),
      },
      boundaries: {
        readOnlyComposition: true,
        sourceModulesRemainCanonical: true,
        syntheticDimensionalAllocation: false,
        financialAuthority: 'POSTGRESQL_PRISMA_DECIMAL',
        baseCurrencyOnly: true,
        protectedDetailRequiresSourcePermission: true,
      },
    };
  }

  async portfolio(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    const projects = await this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        plannedStartDate: true,
        plannedCompletionDate: true,
        actualStartDate: true,
        actualCompletionDate: true,
        statusDefinition: {
          select: {
            statusCode: true,
            statusLabel: true,
          },
        },
      },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });

    return {
      contractVersion: 'V0.8-A',
      projectCount: projects.length,
      projects: projects.map((project) => ({
        id: project.id,
        projectCode: project.projectCode,
        projectName: project.projectName,
        status: project.statusDefinition,
        plannedStartDate: this.day(project.plannedStartDate),
        plannedCompletionDate: this.day(
          project.plannedCompletionDate,
        ),
        actualStartDate: this.day(project.actualStartDate),
        actualCompletionDate: this.day(
          project.actualCompletionDate,
        ),
      })),
      scope: {
        companyIsolated: true,
        inaccessibleProjectsExcludedBeforeAggregation: true,
        projectAccessAllIsSeparateFromManagementPermission: true,
      },
      deferredToStageC: {
        financialPortfolioAggregation: true,
        crossProjectHealthScoring: true,
      },
    };
  }

  private sourceContract(
    auth: AuthenticatedUserContext,
    canonicalSource: string,
    detailPermissionCodes: string[],
  ) {
    return {
      canonicalSource,
      sourceViewPermissionCodes: detailPermissionCodes,
      sourceViewAvailable: detailPermissionCodes.every((permission) =>
        auth.permissions.includes(permission),
      ),
      protectedDetailPolicy: 'OWNING_MODULE_PERMISSION_REQUIRED' as const,
    };
  }

  private money(value: Prisma.Decimal): string {
    return value.toFixed();
  }

  private optionalMoney(value: Prisma.Decimal | null): string | null {
    return value === null ? null : value.toFixed();
  }

  private day(value: Date | null | undefined): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
}
