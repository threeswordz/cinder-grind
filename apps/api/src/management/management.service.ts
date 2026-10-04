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

  async portfolio(
    auth: AuthenticatedUserContext,
    options?: ManagementSummaryOptions,
  ) {
    const resolvedOptions =
      options ??
      ({
        asOf: new Date(
          new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z',
        ),
        days: 14,
      } satisfies ManagementSummaryOptions);

    const scope = await this.access.scopeWhere(auth);
    const [company, projects] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.project.findMany({
        where: { AND: [scope, { isActive: true }] },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          plannedStartDate: true,
          plannedCompletionDate: true,
          actualStartDate: true,
          actualCompletionDate: true,
        },
        orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
      }),
    ]);
    const projectIds = projects.map((project) => project.id);

    const [reportingRows, inventoryRows, costRows, cashFlowRows] =
      await Promise.all([
        this.reporting.portfolioSignals(
          auth,
          projectIds,
          resolvedOptions.asOf,
          resolvedOptions.days,
        ),
        this.inventory.portfolioBalanceSummaries(auth, projectIds),
        this.costControl.portfolioProjectTotals(auth, projectIds),
        this.cashFlow.portfolioProjectCashFlows(auth, projectIds),
      ]);

    const reportingByProject = new Map(
      reportingRows.map((row) => [row.projectId, row]),
    );
    const inventoryByProject = new Map(
      inventoryRows.map((row) => [row.projectId, row]),
    );
    const costByProject = new Map(
      costRows.map((row) => [row.projectId, row]),
    );
    const cashFlowByProject = new Map(
      cashFlowRows.map((row) => [row.projectId, row]),
    );

    const rows = projects.map((project) => {
      const reporting = reportingByProject.get(project.id);
      const cost = costByProject.get(project.id);
      const cashFlow = cashFlowByProject.get(project.id);
      if (!reporting || !cost || !cashFlow) {
        throw new Error(
          'Canonical Management portfolio source did not return an authorized Project.',
        );
      }
      if (
        cost.baseCurrencyCode !== company.baseCurrencyCode ||
        cashFlow.baseCurrencyCode !== company.baseCurrencyCode
      ) {
        throw new Error(
          'Canonical Management portfolio sources returned inconsistent Company base currencies.',
        );
      }
      const inventory =
        inventoryByProject.get(project.id) ?? {
          projectId: project.id,
          balanceRowCount: 0,
          warehouseCount: 0,
          materialCount: 0,
          uomCount: 0,
        };

      const forecastProfit =
        cost.totals.commercial.forecastProfit.toFixed();

      return {
        project: {
          id: project.id,
          projectCode: project.projectCode,
          projectName: project.projectName,
          plannedStartDate: this.day(project.plannedStartDate),
          plannedCompletionDate: this.day(
            project.plannedCompletionDate,
          ),
          actualStartDate: this.day(project.actualStartDate),
          actualCompletionDate: this.day(
            project.actualCompletionDate,
          ),
        },
        health: {
          overallSeverity: {
            status: 'UNAVAILABLE' as const,
            reason:
              'NO_APPROVED_OVERALL_HEALTH_SEVERITY_POLICY' as const,
          },
          sourceSignals: {
            progress: {
              completedActivities:
                reporting.schedule.completed,
              totalActivities: reporting.schedule.total,
              delayedActivities: reporting.schedule.delayed,
              criticalActivities: reporting.schedule.critical,
              lookaheadActivities: reporting.schedule.lookahead,
            },
            procurement: {
              atRiskLines: reporting.procurement.AT_RISK,
              unavailableLines:
                reporting.procurement.UNAVAILABLE,
            },
            site: {
              issueCount: reporting.siteExecution.issueCount,
              delayCount: reporting.siteExecution.delayCount,
            },
            cost: {
              variance: cost.totals.variance.toFixed(),
            },
            commercial: {
              forecastProfit,
            },
          },
        },
        domains: {
          schedule: {
            status: 'AVAILABLE' as const,
            summary: reporting.schedule,
          },
          siteExecution: {
            status: 'AVAILABLE' as const,
            recentReportCount:
              reporting.siteExecution.recentReportCount,
            issueCount: reporting.siteExecution.issueCount,
            delayCount: reporting.siteExecution.delayCount,
          },
          procurement: {
            status: 'AVAILABLE' as const,
            summary: reporting.procurement,
          },
          inventory: {
            status: 'AVAILABLE' as const,
            balanceRowCount: inventory.balanceRowCount,
            warehouseCount: inventory.warehouseCount,
            materialCount: inventory.materialCount,
            uomCount: inventory.uomCount,
            quantityAggregation:
              'NOT_APPLICABLE_MIXED_MATERIAL_AND_UOM_DIMENSIONS' as const,
          },
          cost: {
            status: 'AVAILABLE' as const,
            originalBudget:
              cost.totals.originalBudget.toFixed(),
            revisedBudget:
              cost.totals.revisedBudget.toFixed(),
            committedCost:
              cost.totals.committedCost.toFixed(),
            actualCost: cost.totals.actualCost.toFixed(),
            paidCost: cost.totals.paidCost.toFixed(),
            remainingCommitment:
              cost.totals.remainingCommitment.toFixed(),
            uncommittedEtc:
              cost.totals.uncommittedEtc.toFixed(),
            costToComplete:
              cost.totals.costToComplete.toFixed(),
            forecastCost: cost.totals.forecastCost.toFixed(),
            variance: cost.totals.variance.toFixed(),
            commercial: {
              originalContractValue:
                cost.totals.commercial.originalContractValue.toFixed(),
              approvedVariationValue:
                cost.totals.commercial.approvedVariationValue.toFixed(),
              revisedContractValue:
                cost.totals.commercial.revisedContractValue.toFixed(),
              actualRevenue:
                cost.totals.commercial.actualRevenue.toFixed(),
              cashReceived:
                cost.totals.commercial.cashReceived.toFixed(),
              forecastRevenue:
                cost.totals.commercial.forecastRevenue.toFixed(),
              actualProfit:
                cost.totals.commercial.actualProfit.toFixed(),
              forecastProfit,
            },
          },
          finance: {
            status: 'AVAILABLE' as const,
            inflowAmount:
              cashFlow.totals.inflowAmount.toFixed(),
            outflowAmount:
              cashFlow.totals.outflowAmount.toFixed(),
            netCashFlow:
              cashFlow.totals.netCashFlow.toFixed(),
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
      };
    });

    return {
      contractVersion: 'V0.8-C',
      asOfDate: resolvedOptions.asOf.toISOString().slice(0, 10),
      lookaheadDays: resolvedOptions.days,
      baseCurrencyCode: company.baseCurrencyCode,
      projectCount: rows.length,
      healthPolicy: {
        overallSeverity: 'NOT_APPROVED' as const,
        presentation: 'SOURCE_SIGNALS_ONLY' as const,
      },
      totals: {
        schedule: {
          activities: rows.reduce(
            (sum, row) =>
              sum + row.domains.schedule.summary.total,
            0,
          ),
          completed: rows.reduce(
            (sum, row) =>
              sum + row.domains.schedule.summary.completed,
            0,
          ),
          delayed: rows.reduce(
            (sum, row) =>
              sum + row.domains.schedule.summary.delayed,
            0,
          ),
          critical: rows.reduce(
            (sum, row) =>
              sum + row.domains.schedule.summary.critical,
            0,
          ),
          lookahead: rows.reduce(
            (sum, row) =>
              sum + row.domains.schedule.summary.lookahead,
            0,
          ),
        },
        procurement: {
          demandLines: rows.reduce(
            (sum, row) =>
              sum + row.domains.procurement.summary.total,
            0,
          ),
          atRisk: rows.reduce(
            (sum, row) =>
              sum + row.domains.procurement.summary.AT_RISK,
            0,
          ),
          onTime: rows.reduce(
            (sum, row) =>
              sum + row.domains.procurement.summary.ON_TIME,
            0,
          ),
          unavailable: rows.reduce(
            (sum, row) =>
              sum + row.domains.procurement.summary.UNAVAILABLE,
            0,
          ),
        },
        siteExecution: {
          recentReports: rows.reduce(
            (sum, row) =>
              sum + row.domains.siteExecution.recentReportCount,
            0,
          ),
          issues: rows.reduce(
            (sum, row) =>
              sum + row.domains.siteExecution.issueCount,
            0,
          ),
          delays: rows.reduce(
            (sum, row) =>
              sum + row.domains.siteExecution.delayCount,
            0,
          ),
        },
        inventory: {
          balanceRows: rows.reduce(
            (sum, row) =>
              sum + row.domains.inventory.balanceRowCount,
            0,
          ),
          projectsWithStock: rows.filter(
            (row) =>
              row.domains.inventory.balanceRowCount > 0,
          ).length,
        },
        cost: {
          originalBudget: this.sumMoney(
            rows.map(
              (row) => row.domains.cost.originalBudget,
            ),
          ),
          revisedBudget: this.sumMoney(
            rows.map(
              (row) => row.domains.cost.revisedBudget,
            ),
          ),
          committedCost: this.sumMoney(
            rows.map(
              (row) => row.domains.cost.committedCost,
            ),
          ),
          actualCost: this.sumMoney(
            rows.map((row) => row.domains.cost.actualCost),
          ),
          paidCost: this.sumMoney(
            rows.map((row) => row.domains.cost.paidCost),
          ),
          forecastCost: this.sumMoney(
            rows.map(
              (row) => row.domains.cost.forecastCost,
            ),
          ),
          variance: this.sumMoney(
            rows.map((row) => row.domains.cost.variance),
          ),
        },
        finance: {
          inflowAmount: this.sumMoney(
            rows.map(
              (row) => row.domains.finance.inflowAmount,
            ),
          ),
          outflowAmount: this.sumMoney(
            rows.map(
              (row) => row.domains.finance.outflowAmount,
            ),
          ),
          netCashFlow: this.sumMoney(
            rows.map(
              (row) => row.domains.finance.netCashFlow,
            ),
          ),
        },
        commercial: {
          revisedContractValue: this.sumMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial
                  .revisedContractValue,
            ),
          ),
          actualRevenue: this.sumMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial.actualRevenue,
            ),
          ),
          cashReceived: this.sumMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial.cashReceived,
            ),
          ),
          forecastRevenue: this.sumMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial.forecastRevenue,
            ),
          ),
          actualProfit: this.sumOptionalMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial.actualProfit,
            ),
          ),
          forecastProfit: this.sumOptionalMoney(
            rows.map(
              (row) =>
                row.domains.cost.commercial.forecastProfit,
            ),
          ),
        },
      },
      projects: rows,
      scope: {
        companyIsolated: true,
        inaccessibleProjectsExcludedBeforeAggregation: true,
        projectAccessAllIsSeparateFromManagementPermission: true,
        portfolioPermissionRequired: true,
      },
      boundaries: {
        readOnlyComposition: true,
        sourceModulesRemainCanonical: true,
        boundedPortfolioSourceReads: true,
        perProjectAuthorizationFanOut: false,
        deterministicHealthSignals: true,
        overallHealthSeverityPolicyApproved: false,
        manualHealthOverride: false,
        financialAuthority: 'POSTGRESQL_PRISMA_DECIMAL',
        baseCurrencyOnly: true,
        protectedDetailRequiresSourcePermission: true,
      },
      deferredToLaterStages: {
        domainDashboards: true,
        reportingExport: true,
      },
    };
  }

  private sumMoney(values: string[]): string {
    return values
      .reduce(
        (total, value) => total.plus(value),
        new Prisma.Decimal(0),
      )
      .toFixed();
  }

  private sumOptionalMoney(values: Array<string | null>) {
    if (values.some((value) => value === null)) {
      return {
        status: 'UNAVAILABLE' as const,
        value: null,
        reason: 'ONE_OR_MORE_PROJECT_VALUES_UNAVAILABLE' as const,
      };
    }
    return {
      status: 'AVAILABLE' as const,
      value: this.sumMoney(values as string[]),
      reason: null,
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
