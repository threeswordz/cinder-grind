import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { CostControlService } from '../cost-control/cost-control.service';
import { CashFlowService } from '../finance/cash-flow.service';
import { ClientInvoiceService } from '../finance/client-invoice.service';
import { FinanceService } from '../finance/finance.service';
import { InventoryReportService } from '../inventory/inventory-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ReportingService } from '../reporting/reporting.service';

export type ManagementSummaryOptions = {
  asOf: Date;
  days: 14 | 28;
};

export type ManagementReportDomain =
  | 'ALL'
  | 'SCHEDULE'
  | 'PROCUREMENT'
  | 'INVENTORY'
  | 'COST'
  | 'COMMERCIAL'
  | 'FINANCE';

export type ManagementReportStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'COMPLETED'
  | 'DELAYED'
  | 'CRITICAL'
  | 'LOOKAHEAD'
  | 'AT_RISK'
  | 'ON_TIME';

export type ManagementReportOptions = ManagementSummaryOptions & {
  domain: ManagementReportDomain;
  status?: ManagementReportStatus;
  fromDate?: Date;
  toDateExclusive?: Date;
  wbsId?: string;
  costCodeId?: string;
};

export type ManagementReportRow = {
  domain: Exclude<ManagementReportDomain, 'ALL'>;
  metric: string;
  label: string;
  status: ManagementReportStatus;
  value: string | number | null;
  unit: 'COUNT' | 'MONEY';
  currencyCode: string | null;
  canonicalSource: string;
  sourceViewAvailable: boolean;
  sourceApiPath: string | null;
};

@Injectable()
export class ManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly reporting: ReportingService,
    private readonly costControl: CostControlService,
    private readonly cashFlow: CashFlowService,
    private readonly finance: FinanceService,
    private readonly clientInvoices: ClientInvoiceService,
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

    const [
      engineer,
      procurement,
      cost,
      cashFlow,
      accountsPayable,
      accountsReceivable,
      inventorySummary,
      inventoryQuantities,
      inventoryMovements,
    ] = await Promise.all([
      this.reporting.projectEngineer(
        auth,
        projectId,
        options.asOf,
        options.days,
      ),
      this.reporting.procurement(auth, projectId),
      this.costControl.projectCostControl(auth, projectId),
      this.cashFlow.projectCashFlow(auth, projectId),
      this.finance.accountsPayable(auth, projectId),
      this.clientInvoices.accountsReceivable(auth, projectId),
      this.inventory.balanceSummary(auth, { projectId }),
      this.inventory.balanceQuantitySummary(auth, projectId),
      this.inventory.movementSummary(auth, projectId),
    ]);

    if (
      cost.baseCurrencyCode !== cashFlow.baseCurrencyCode ||
      [...accountsPayable, ...accountsReceivable].some(
        (row) => row.currencyCode !== cost.baseCurrencyCode,
      )
    ) {
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
          positiveBalanceRowCount:
            inventoryQuantities.positiveBalanceRowCount,
          negativeBalanceRowCount:
            inventoryQuantities.negativeBalanceRowCount,
          zeroBalanceRowCount:
            inventoryQuantities.zeroBalanceRowCount,
          movementRowCount: inventoryMovements.movementRowCount,
          latestMovementAt: this.day(inventoryMovements.latestPostedAt),
          movementSources: {
            goodsReceipt: inventoryMovements.goodsReceiptRowCount,
            materialIssue: inventoryMovements.materialIssueRowCount,
            materialReturn: inventoryMovements.materialReturnRowCount,
            stockTransfer: inventoryMovements.stockTransferRowCount,
          },
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
          accountsPayable: this.invoicePosition(accountsPayable),
          accountsReceivable: this.invoicePosition(accountsReceivable),
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
          ['finance.ap.view', 'finance.ar.view', 'finance.payment.view'],
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

  async projectReport(
    auth: AuthenticatedUserContext,
    projectId: string,
    options: ManagementReportOptions,
  ) {
    const dimensionFilter = Boolean(options.wbsId || options.costCodeId);
    if (dimensionFilter && options.domain !== 'COST') {
      throw new UnprocessableEntityException({
        code: 'MANAGEMENT_REPORT_DIMENSION_UNSUPPORTED',
        detail:
          'WBS/Cost Code filters are supported only for COST Management reports because commercial/revenue values remain Project-level under the approved V0.7 semantics.',
      });
    }

    const periodFilter = Boolean(
      options.fromDate || options.toDateExclusive,
    );
    if (
      periodFilter &&
      options.domain !== 'ALL' &&
      options.domain !== 'FINANCE'
    ) {
      throw new UnprocessableEntityException({
        code: 'MANAGEMENT_REPORT_DATE_RANGE_UNSUPPORTED',
        detail:
          'fromDate/toDate are supported only for FINANCE or ALL Management reports.',
      });
    }

    const summary = await this.projectSummary(auth, projectId, {
      asOf: options.asOf,
      days: options.days,
    });

    const [dimensionCost, periodCashFlow] = await Promise.all([
      dimensionFilter
        ? this.costControl.projectCostControl(auth, projectId, {
            ...(options.wbsId ? { wbsId: options.wbsId } : {}),
            ...(options.costCodeId
              ? { costCodeId: options.costCodeId }
              : {}),
          })
        : null,
      periodFilter
        ? this.cashFlow.projectCashFlow(auth, projectId, {
            ...(options.fromDate ? { fromDate: options.fromDate } : {}),
            ...(options.toDateExclusive
              ? { toDateExclusive: options.toDateExclusive }
              : {}),
          })
        : null,
    ]);

    const cost = dimensionCost
      ? {
          status: 'AVAILABLE' as const,
          originalBudget: this.money(dimensionCost.totals.originalBudget),
          revisedBudget: this.money(dimensionCost.totals.revisedBudget),
          committedCost: this.money(
            dimensionCost.totals.committedCost.total,
          ),
          actualCost: this.money(dimensionCost.totals.actualCost.total),
          paidCost: this.money(dimensionCost.totals.paidCost.total),
          remainingCommitment: this.money(
            dimensionCost.totals.remainingCommitment.total,
          ),
          uncommittedEtc: this.money(
            dimensionCost.totals.uncommittedEtc,
          ),
          costToComplete: this.money(
            dimensionCost.totals.costToComplete,
          ),
          forecastCost: this.money(dimensionCost.totals.forecastCost),
          variance: this.money(dimensionCost.totals.variance),
          commercial: {
            originalContractValue: this.money(
              dimensionCost.totals.commercial.originalContractValue,
            ),
            approvedVariationValue: this.money(
              dimensionCost.totals.commercial.approvedVariationValue,
            ),
            revisedContractValue: this.money(
              dimensionCost.totals.commercial.revisedContractValue,
            ),
            actualRevenue: this.money(
              dimensionCost.totals.commercial.actualRevenue,
            ),
            cashReceived: this.money(
              dimensionCost.totals.commercial.cashReceived,
            ),
            forecastRevenue: this.money(
              dimensionCost.totals.commercial.forecastRevenue,
            ),
            actualProfit: this.optionalMoney(
              dimensionCost.totals.commercial.actualProfit,
            ),
            forecastProfit: this.optionalMoney(
              dimensionCost.totals.commercial.forecastProfit,
            ),
          },
        }
      : summary.domains.cost;

    if (
      (dimensionCost &&
        dimensionCost.baseCurrencyCode !== summary.baseCurrencyCode) ||
      (periodCashFlow &&
        periodCashFlow.baseCurrencyCode !== summary.baseCurrencyCode)
    ) {
      throw new Error(
        'Canonical Management financial sources returned inconsistent Company base currencies.',
      );
    }

    const finance = periodCashFlow
      ? {
          ...summary.domains.finance,
          inflowAmount: this.money(periodCashFlow.totals.inflowAmount),
          outflowAmount: this.money(periodCashFlow.totals.outflowAmount),
          netCashFlow: this.money(periodCashFlow.totals.netCashFlow),
        }
      : summary.domains.finance;

    const costQuery = [
      options.wbsId ? 'wbsId=' + encodeURIComponent(options.wbsId) : '',
      options.costCodeId
        ? 'costCodeId=' + encodeURIComponent(options.costCodeId)
        : '',
    ]
      .filter(Boolean)
      .join('&');
    const costSourcePath =
      '/projects/' +
      projectId +
      '/cost-control' +
      (costQuery ? '?' + costQuery : '');

    const toDateInclusive = options.toDateExclusive
      ? new Date(options.toDateExclusive.getTime() - 86_400_000)
      : undefined;
    const financeQuery = [
      options.fromDate
        ? 'fromDate=' + encodeURIComponent(this.day(options.fromDate)!)
        : '',
      toDateInclusive
        ? 'toDate=' + encodeURIComponent(this.day(toDateInclusive)!)
        : '',
    ]
      .filter(Boolean)
      .join('&');
    const financeSourcePath =
      '/finance/projects/' +
      projectId +
      '/cash-flow' +
      (financeQuery ? '?' + financeQuery : '');

    const sourcePaths: Record<
      Exclude<ManagementReportDomain, 'ALL'>,
      string
    > = {
      SCHEDULE:
        '/reporting/projects/' +
        projectId +
        '/project-engineer?asOf=' +
        summary.asOfDate +
        '&days=' +
        summary.lookaheadDays,
      PROCUREMENT: '/reporting/projects/' + projectId + '/procurement',
      INVENTORY: '/inventory/reports/balances?projectId=' + projectId,
      COST: costSourcePath,
      COMMERCIAL: '/projects/' + projectId + '/cost-control',
      FINANCE: financeSourcePath,
    };

    const sources = {
      SCHEDULE: this.sourceContract(
        auth,
        'V0.2 Scheduling / Site Execution',
        ['reporting.operational.view'],
      ),
      PROCUREMENT: this.sourceContract(
        auth,
        'V0.3 Procurement',
        ['reporting.operational.view'],
      ),
      INVENTORY: summary.sourceTraceability.inventory,
      COST: summary.sourceTraceability.cost,
      COMMERCIAL: summary.sourceTraceability.cost,
      FINANCE: this.sourceContract(
        auth,
        'V0.6 Finance Cash Flow',
        ['finance.payment.view'],
      ),
    };

    const rows: ManagementReportRow[] = [];
    const add = (
      domain: Exclude<ManagementReportDomain, 'ALL'>,
      metric: string,
      label: string,
      status: ManagementReportStatus,
      value: string | number | null,
      unit: 'COUNT' | 'MONEY',
      sourceOverride?: {
        canonicalSource: string;
        permissionCodes: string[];
        apiPath: string;
      },
    ) => {
      const source = sourceOverride
        ? this.sourceContract(
            auth,
            sourceOverride.canonicalSource,
            sourceOverride.permissionCodes,
          )
        : sources[domain];
      const sourceApiPath =
        sourceOverride?.apiPath ?? sourcePaths[domain];
      rows.push({
        domain,
        metric,
        label,
        status,
        value,
        unit,
        currencyCode:
          unit === 'MONEY' ? summary.baseCurrencyCode : null,
        canonicalSource: source.canonicalSource,
        sourceViewAvailable: source.sourceViewAvailable,
        sourceApiPath: source.sourceViewAvailable
          ? sourceApiPath
          : null,
      });
    };

    add(
      'SCHEDULE',
      'ACTIVITY_TOTAL',
      'Activities',
      'AVAILABLE',
      summary.domains.schedule.summary.total,
      'COUNT',
    );
    add(
      'SCHEDULE',
      'ACTIVITY_COMPLETED',
      'Completed activities',
      'COMPLETED',
      summary.domains.schedule.summary.completed,
      'COUNT',
    );
    add(
      'SCHEDULE',
      'ACTIVITY_DELAYED',
      'Delayed activities',
      'DELAYED',
      summary.domains.schedule.summary.delayed,
      'COUNT',
    );
    add(
      'SCHEDULE',
      'ACTIVITY_CRITICAL',
      'Critical activities',
      'CRITICAL',
      summary.domains.schedule.summary.critical,
      'COUNT',
    );
    add(
      'SCHEDULE',
      'ACTIVITY_LOOKAHEAD',
      'Lookahead activities',
      'LOOKAHEAD',
      summary.domains.schedule.lookaheadActivityCount,
      'COUNT',
    );

    add(
      'PROCUREMENT',
      'DEMAND_LINE_TOTAL',
      'Procurement demand lines',
      'AVAILABLE',
      summary.domains.procurement.summary.total,
      'COUNT',
    );
    add(
      'PROCUREMENT',
      'DEMAND_LINE_AT_RISK',
      'At-risk procurement lines',
      'AT_RISK',
      summary.domains.procurement.summary.AT_RISK,
      'COUNT',
    );
    add(
      'PROCUREMENT',
      'DEMAND_LINE_ON_TIME',
      'On-time procurement lines',
      'ON_TIME',
      summary.domains.procurement.summary.ON_TIME,
      'COUNT',
    );
    add(
      'PROCUREMENT',
      'DEMAND_LINE_UNAVAILABLE',
      'Procurement lines with unavailable schedule risk',
      'UNAVAILABLE',
      summary.domains.procurement.summary.UNAVAILABLE,
      'COUNT',
    );

    add(
      'INVENTORY',
      'BALANCE_ROW_COUNT',
      'Inventory balance rows',
      'AVAILABLE',
      summary.domains.inventory.balanceRowCount,
      'COUNT',
    );
    add(
      'INVENTORY',
      'POSITIVE_BALANCE_ROW_COUNT',
      'Positive inventory balance rows',
      'AVAILABLE',
      summary.domains.inventory.positiveBalanceRowCount,
      'COUNT',
    );
    add(
      'INVENTORY',
      'NEGATIVE_BALANCE_ROW_COUNT',
      'Negative inventory balance rows',
      'AVAILABLE',
      summary.domains.inventory.negativeBalanceRowCount,
      'COUNT',
    );
    add(
      'INVENTORY',
      'MOVEMENT_ROW_COUNT',
      'Inventory movement rows',
      'AVAILABLE',
      summary.domains.inventory.movementRowCount,
      'COUNT',
      {
        canonicalSource: 'V0.4 Inventory Movement Reporting',
        permissionCodes: ['inventory.report.view'],
        apiPath:
          '/inventory/reports/movement-summary?projectId=' + projectId,
      },
    );

    const costRows: Array<
      [string, string, string | null]
    > = [
      ['ORIGINAL_BUDGET', 'Original budget', cost.originalBudget],
      ['REVISED_BUDGET', 'Revised budget', cost.revisedBudget],
      ['COMMITTED_COST', 'Committed cost', cost.committedCost],
      ['ACTUAL_COST', 'Actual cost', cost.actualCost],
      ['PAID_COST', 'Paid cost', cost.paidCost],
      [
        'REMAINING_COMMITMENT',
        'Remaining commitment',
        cost.remainingCommitment,
      ],
      ['UNCOMMITTED_ETC', 'Uncommitted ETC', cost.uncommittedEtc],
      ['COST_TO_COMPLETE', 'Cost to complete', cost.costToComplete],
      ['FORECAST_COST', 'Forecast cost', cost.forecastCost],
      ['VARIANCE', 'Variance', cost.variance],
    ];
    for (const [metric, label, value] of costRows) {
      add('COST', metric, label, 'AVAILABLE', value, 'MONEY');
    }

    const commercialRows: Array<
      [string, string, string | null]
    > = [
      [
        'ORIGINAL_CONTRACT_VALUE',
        'Original contract value',
        cost.commercial.originalContractValue,
      ],
      [
        'APPROVED_VARIATION_VALUE',
        'Approved variation value',
        cost.commercial.approvedVariationValue,
      ],
      [
        'REVISED_CONTRACT_VALUE',
        'Revised contract value',
        cost.commercial.revisedContractValue,
      ],
      ['ACTUAL_REVENUE', 'Actual revenue', cost.commercial.actualRevenue],
      ['CASH_RECEIVED', 'Cash received', cost.commercial.cashReceived],
      [
        'FORECAST_REVENUE',
        'Forecast revenue',
        cost.commercial.forecastRevenue,
      ],
      ['ACTUAL_PROFIT', 'Actual profit', cost.commercial.actualProfit],
      [
        'FORECAST_PROFIT',
        'Forecast profit',
        cost.commercial.forecastProfit,
      ],
    ];
    for (const [metric, label, value] of commercialRows) {
      add(
        'COMMERCIAL',
        metric,
        label,
        value === null ? 'UNAVAILABLE' : 'AVAILABLE',
        value,
        'MONEY',
      );
    }

    add(
      'FINANCE',
      'ACCOUNTS_PAYABLE_OUTSTANDING',
      'Accounts payable outstanding',
      'AVAILABLE',
      finance.accountsPayable.outstandingAmount,
      'MONEY',
      {
        canonicalSource: 'V0.6 Finance Accounts Payable',
        permissionCodes: ['finance.ap.view'],
        apiPath: '/finance/projects/' + projectId + '/accounts-payable',
      },
    );
    add(
      'FINANCE',
      'ACCOUNTS_RECEIVABLE_OUTSTANDING',
      'Accounts receivable outstanding',
      'AVAILABLE',
      finance.accountsReceivable.outstandingAmount,
      'MONEY',
      {
        canonicalSource: 'V0.6 Finance Accounts Receivable',
        permissionCodes: ['finance.ar.view'],
        apiPath:
          '/finance/projects/' + projectId + '/accounts-receivable',
      },
    );
    add(
      'FINANCE',
      'CASH_INFLOW',
      'Cash inflow',
      'AVAILABLE',
      finance.inflowAmount,
      'MONEY',
    );
    add(
      'FINANCE',
      'CASH_OUTFLOW',
      'Cash outflow',
      'AVAILABLE',
      finance.outflowAmount,
      'MONEY',
    );
    add(
      'FINANCE',
      'NET_CASH_FLOW',
      'Net cash flow',
      'AVAILABLE',
      finance.netCashFlow,
      'MONEY',
    );

    const filteredRows = rows.filter(
      (row) =>
        (options.domain === 'ALL' || row.domain === options.domain) &&
        (!options.status || row.status === options.status),
    );

    return {
      contractVersion: 'V0.8-E' as const,
      project: summary.project,
      asOfDate: summary.asOfDate,
      lookaheadDays: summary.lookaheadDays,
      baseCurrencyCode: summary.baseCurrencyCode,
      filters: {
        domain: options.domain,
        status: options.status ?? null,
        fromDate: this.day(options.fromDate),
        toDate: this.day(toDateInclusive),
        wbs: dimensionCost?.filters.wbs ?? null,
        costCode: dimensionCost?.filters.costCode ?? null,
        wbsIncludesDescendants:
          dimensionCost?.filters.wbsIncludesDescendants ?? false,
        dateRangeAppliedDomains: periodFilter
          ? (['FINANCE'] as const)
          : ([] as const),
      },
      rowCount: filteredRows.length,
      rows: filteredRows,
      scope: {
        companyIsolated: true,
        effectiveProjectAccessRequired: true,
        inaccessibleProjectsExcluded: true,
        managementDashboardPermissionRequired: true,
      },
      boundaries: {
        readOnlyComposition: true,
        sourceModulesRemainCanonical: true,
        exportUsesSameAuthorizedResult: true,
        protectedDetailRequiresSourcePermission: true,
        financialAuthority: 'POSTGRESQL_PRISMA_DECIMAL' as const,
        baseCurrencyOnly: true,
        syntheticDimensionalAllocation: false,
        predictiveAnalytics: false,
        persistedReportTruth: false,
      },
    };
  }

  async projectReportCsv(
    auth: AuthenticatedUserContext,
    projectId: string,
    options: ManagementReportOptions,
  ) {
    const report = await this.projectReport(auth, projectId, options);
    const header = [
      'project_code',
      'project_name',
      'as_of_date',
      'domain',
      'metric',
      'label',
      'status',
      'value',
      'unit',
      'currency_code',
      'canonical_source',
      'source_view_available',
      'source_api_path',
    ];
    const lines = report.rows.map((row) =>
      [
        report.project.projectCode,
        report.project.projectName,
        report.asOfDate,
        row.domain,
        row.metric,
        row.label,
        row.status,
        row.value,
        row.unit,
        row.currencyCode,
        row.canonicalSource,
        row.sourceViewAvailable ? 'true' : 'false',
        row.sourceApiPath,
      ]
        .map((value) => this.csvCell(value))
        .join(','),
    );
    return [header.join(','), ...lines].join('\r\n') + '\r\n';
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
        domainDashboards: false,
        reportingExport: false,
      },
    };
  }

  private invoicePosition(
    rows: Array<{
      outstandingAmount: Prisma.Decimal;
    }>,
  ) {
    const zero = new Prisma.Decimal(0);
    return {
      approvedInvoiceCount: rows.length,
      outstandingInvoiceCount: rows.filter((row) =>
        row.outstandingAmount.greaterThan(0),
      ).length,
      outstandingAmount: rows
        .reduce(
          (total, row) => total.plus(row.outstandingAmount),
          zero,
        )
        .toFixed(),
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

  private csvCell(value: string | number | boolean | null): string {
    const raw = value === null ? '' : String(value);
    const numericString =
      typeof value === 'string' &&
      /^-?\d+(?:\.\d+)?$/.test(value);
    const formulaLike =
      typeof value === 'string' &&
      !numericString &&
      /^[=+@-]/.test(raw.trimStart());
    const text = formulaLike ? "'" + raw : raw;
    return /[",\r\n]/.test(text)
      ? '"' + text.replaceAll('"', '""') + '"'
      : text;
  }

  private day(value: Date | null | undefined): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
}
