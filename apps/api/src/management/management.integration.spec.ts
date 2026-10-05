import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { CostControlService } from '../cost-control/cost-control.service';
import { CashFlowService } from '../finance/cash-flow.service';
import { ClientInvoiceService } from '../finance/client-invoice.service';
import { FinanceService } from '../finance/finance.service';
import { InventoryReportService } from '../inventory/inventory-report.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ReportingService } from '../reporting/reporting.service';
import { ManagementController } from './management.controller';
import { ManagementService } from './management.service';

function auth(permissions: string[] = ['management.dashboard.view']): AuthenticatedUserContext {
  return {
    sessionId: 'session',
    userId: 'user',
    companyId: 'company',
    email: 'management@example.com',
    displayName: 'Management User',
    roleCodes: ['PROJECT_MANAGER'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

function decimal(value: string) {
  return new Prisma.Decimal(value);
}

function managementReportFixture(projectName = 'Management Project') {
  let receivedCostFilters: Record<string, string> | null = null;
  let receivedCashPeriod:
    | { fromDate?: Date; toDateExclusive?: Date }
    | null = null;

  const access = {
    assertAccess: async () => undefined,
  } as unknown as ProjectAccessService;

  const reporting = {
    projectEngineer: async () => ({
      project: {
        id: 'project-1',
        projectCode: 'P-001',
        projectName,
        plannedStartDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
        actualStartDate: null,
        actualCompletionDate: null,
      },
      asOfDate: '2026-10-10',
      schedule: {
        currentBaseline: null,
        summary: { total: 10, critical: 2, delayed: 1, completed: 4 },
        activities: [],
        lookahead: { window: { days: 14 }, activities: [{ id: 'a-1' }] },
      },
      siteExecution: { latestReports: [] },
      equipment: { assignedCount: 0, assignments: [] },
    }),
    procurement: async () => ({
      project: { id: 'project-1' },
      summary: {
        total: 5,
        AT_RISK: 2,
        ON_TIME: 2,
        UNAVAILABLE: 1,
        rfq: 4,
        awarded: 3,
        purchaseOrder: 2,
      },
      lines: [],
    }),
  } as unknown as ReportingService;

  const costControl = {
    projectCostControl: async (
      _auth: AuthenticatedUserContext,
      _projectId: string,
      filters: { wbsId?: string; costCodeId?: string } = {},
    ) => {
      receivedCostFilters = { ...filters };
      const filtered = Boolean(filters.wbsId || filters.costCodeId);
      return {
        project: {
          id: 'project-1',
          projectCode: 'P-001',
          projectName,
        },
        baseCurrencyCode: 'SGD',
        filters: {
          wbs: filters.wbsId
            ? {
                id: filters.wbsId,
                wbsCode: '1',
                wbsName: 'Root WBS',
              }
            : null,
          costCode: filters.costCodeId
            ? {
                id: filters.costCodeId,
                costCode: 'LAB',
                costName: 'Labour',
              }
            : null,
          wbsIncludesDescendants: Boolean(filters.wbsId),
        },
        totals: {
          originalBudget: decimal(filtered ? '500' : '1000'),
          revisedBudget: decimal(filtered ? '600' : '1200'),
          committedCost: {
            procurement: decimal('200'),
            subcontract: decimal('300'),
            total: decimal(filtered ? '250' : '500'),
          },
          actualCost: {
            supplier: decimal('100'),
            subcontract: decimal('80'),
            direct: decimal('20'),
            total: decimal(filtered ? '100' : '200'),
          },
          paidCost: {
            supplier: decimal('50'),
            subcontract: decimal('40'),
            total: decimal(filtered ? '45' : '90'),
          },
          remainingCommitment: {
            procurement: decimal('100'),
            subcontract: decimal('200'),
            total: decimal(filtered ? '150' : '300'),
          },
          uncommittedEtc: decimal(filtered ? '50' : '100'),
          costToComplete: decimal(filtered ? '200' : '400'),
          forecastCost: decimal(filtered ? '300' : '600'),
          variance: decimal(filtered ? '300' : '600'),
          commercial: {
            originalContractValue: decimal('1500'),
            approvedVariationValue: decimal('100'),
            revisedContractValue: decimal('1600'),
            actualRevenue: decimal('700'),
            cashReceived: decimal('650'),
            forecastRevenue: decimal('1600'),
            actualProfit: decimal(filtered ? '250' : '500'),
            forecastProfit: decimal(filtered ? '500' : '1000'),
          },
        },
      };
    },
  } as unknown as CostControlService;

  const cashFlow = {
    projectCashFlow: async (
      _auth: AuthenticatedUserContext,
      _projectId: string,
      period: { fromDate?: Date; toDateExclusive?: Date } = {},
    ) => {
      receivedCashPeriod = { ...period };
      const filtered = Boolean(period.fromDate || period.toDateExclusive);
      return {
        baseCurrencyCode: 'SGD',
        totals: {
          inflowAmount: decimal(filtered ? '10' : '650'),
          outflowAmount: decimal(filtered ? '3' : '90'),
          netCashFlow: decimal(filtered ? '7' : '560'),
        },
        rows: [],
      };
    },
  } as unknown as CashFlowService;

  const finance = {
    accountsPayable: async () => [
      { currencyCode: 'SGD', outstandingAmount: decimal('60') },
    ],
  } as unknown as FinanceService;

  const clientInvoices = {
    accountsReceivable: async () => [
      { currencyCode: 'SGD', outstandingAmount: decimal('120') },
    ],
  } as unknown as ClientInvoiceService;

  const inventory = {
    balanceSummary: async () => ({
      balanceRowCount: 3,
      warehouseCount: 1,
      materialCount: 2,
      uomCount: 1,
    }),
    balanceQuantitySummary: async () => ({
      positiveBalanceRowCount: 2,
      negativeBalanceRowCount: 1,
      zeroBalanceRowCount: 0,
    }),
    movementSummary: async () => ({
      movementRowCount: 4,
      latestPostedAt: new Date('2026-10-09T00:00:00.000Z'),
      goodsReceiptRowCount: 1,
      materialIssueRowCount: 1,
      materialReturnRowCount: 1,
      stockTransferRowCount: 1,
    }),
  } as unknown as InventoryReportService;

  return {
    service: new ManagementService(
      {} as PrismaService,
      access,
      reporting,
      costControl,
      cashFlow,
      finance,
      clientInvoices,
      inventory,
    ),
    getCostFilters: () => receivedCostFilters,
    getCashPeriod: () => receivedCashPeriod,
  };
}

test('V0.8 Management routes require explicit Management permissions', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ManagementController.prototype.projects,
    ),
    ['management.dashboard.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ManagementController.prototype.projectSummary,
    ),
    ['management.dashboard.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ManagementController.prototype.portfolio,
    ),
    ['management.portfolio.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ManagementController.prototype.report,
    ),
    ['management.dashboard.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ManagementController.prototype.reportCsv,
    ),
    ['management.dashboard.view', 'management.report.export'],
  );
});

test('V0.8-A Project summary composes aggregate-only canonical source contracts', async () => {
  let accessChecked = false;
  const access = {
    assertAccess: async () => {
      accessChecked = true;
    },
  } as unknown as ProjectAccessService;

  const reporting = {
    projectEngineer: async () => ({
      project: {
        id: 'project-1',
        projectCode: 'P-001',
        projectName,
        plannedStartDate: new Date('2026-01-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
        actualStartDate: null,
        actualCompletionDate: null,
      },
      asOfDate: '2026-10-04',
      schedule: {
        currentBaseline: null,
        summary: { total: 4, critical: 1, delayed: 2, completed: 1 },
        activities: [{ secretActivityDetail: 'must-not-leak' }],
        lookahead: {
          window: { days: 14 },
          activities: [{ secretLookaheadDetail: 'must-not-leak' }],
        },
      },
      siteExecution: {
        latestReports: [
          {
            id: 'report-1',
            reportDate: new Date('2026-10-03T00:00:00.000Z'),
            generalRemarks: 'must-not-leak',
            counts: {
              materialUsage: 1,
              equipmentUsage: 1,
              progress: 1,
              issues: 2,
              delays: 1,
              inspections: 3,
            },
          },
        ],
      },
      equipment: {
        assignedCount: 2,
        assignments: [{ secretEquipmentDetail: 'must-not-leak' }],
      },
    }),
    procurement: async () => ({
      project: { id: 'project-1' },
      summary: {
        total: 5,
        AT_RISK: 2,
        ON_TIME: 2,
        UNAVAILABLE: 1,
        rfq: 4,
        awarded: 3,
        purchaseOrder: 2,
      },
      lines: [{ secretProcurementDetail: 'must-not-leak' }],
    }),
  } as unknown as ReportingService;

  const costControl = {
    projectCostControl: async () => ({
      project: { id: 'project-1' },
      baseCurrencyCode: 'SGD',
      totals: {
        originalBudget: decimal('1000.00'),
        revisedBudget: decimal('1200.00'),
        committedCost: {
          procurement: decimal('200.00'),
          subcontract: decimal('300.00'),
          total: decimal('500.00'),
        },
        actualCost: {
          supplier: decimal('100.00'),
          subcontract: decimal('80.00'),
          direct: decimal('20.00'),
          total: decimal('200.00'),
        },
        paidCost: {
          supplier: decimal('50.00'),
          subcontract: decimal('40.00'),
          total: decimal('90.00'),
        },
        remainingCommitment: {
          procurement: decimal('100.00'),
          subcontract: decimal('200.00'),
          total: decimal('300.00'),
        },
        uncommittedEtc: decimal('100.00'),
        costToComplete: decimal('400.00'),
        forecastCost: decimal('600.00'),
        variance: decimal('600.00'),
        commercial: {
          originalContractValue: decimal('1500.00'),
          approvedVariationValue: decimal('100.00'),
          revisedContractValue: decimal('1600.00'),
          actualRevenue: decimal('700.00'),
          cashReceived: decimal('650.00'),
          forecastRevenue: decimal('1600.00'),
          actualProfit: decimal('500.00'),
          forecastProfit: decimal('1000.00'),
          profitAvailableAtCurrentFilter: true,
        },
      },
      sourceEvidence: {
        supplierActual: { records: [{ secretCostDetail: 'must-not-leak' }] },
      },
    }),
  } as unknown as CostControlService;

  const cashFlow = {
    projectCashFlow: async () => ({
      baseCurrencyCode: 'SGD',
      totals: {
        inflowAmount: decimal('650.00'),
        outflowAmount: decimal('90.00'),
        netCashFlow: decimal('560.00'),
      },
      rows: [{ secretPaymentDetail: 'must-not-leak' }],
    }),
  } as unknown as CashFlowService;

  const finance = {
    accountsPayable: async () => [
      {
        currencyCode: 'SGD',
        outstandingAmount: decimal('60.00'),
        secretSupplierInvoiceDetail: 'must-not-leak',
      },
      {
        currencyCode: 'SGD',
        outstandingAmount: decimal('0.00'),
      },
    ],
  } as unknown as FinanceService;

  const clientInvoices = {
    accountsReceivable: async () => [
      {
        currencyCode: 'SGD',
        outstandingAmount: decimal('120.00'),
        secretClientInvoiceDetail: 'must-not-leak',
      },
    ],
  } as unknown as ClientInvoiceService;

  const inventory = {
    balanceSummary: async () => ({
      balanceRowCount: 1250,
      warehouseCount: 12,
      materialCount: 347,
      uomCount: 5,
    }),
    balanceQuantitySummary: async () => ({
      positiveBalanceRowCount: 1200,
      negativeBalanceRowCount: 50,
      zeroBalanceRowCount: 0,
    }),
    movementSummary: async () => ({
      movementRowCount: 42,
      latestPostedAt: new Date('2026-10-03T10:00:00.000Z'),
      goodsReceiptRowCount: 10,
      materialIssueRowCount: 20,
      materialReturnRowCount: 5,
      stockTransferRowCount: 7,
      secretMovementDetail: 'must-not-leak',
    }),
    balanceReport: async () => {
      throw new Error(
        'Management must not derive KPIs from the capped inventory balance list.',
      );
    },
  } as unknown as InventoryReportService;

  const service = new ManagementService(
    {} as PrismaService,
    access,
    reporting,
    costControl,
    cashFlow,
    finance,
    clientInvoices,
    inventory,
  );

  const result = await service.projectSummary(
    auth(),
    'project-1',
    {
      asOf: new Date('2026-10-04T00:00:00.000Z'),
      days: 14,
    },
  );

  assert.equal(accessChecked, true);
  assert.equal(result.contractVersion, 'V0.8-A');
  assert.equal(result.project.projectCode, 'P-001');
  assert.equal(result.domains.schedule.currentBaseline.status, 'UNAVAILABLE');
  assert.equal(result.domains.schedule.lookaheadActivityCount, 1);
  assert.equal(result.domains.siteExecution.issueCount, 2);
  assert.equal(result.domains.procurement.summary.AT_RISK, 2);
  assert.equal(result.domains.inventory.balanceRowCount, 1250);
  assert.equal(result.domains.inventory.warehouseCount, 12);
  assert.equal(result.domains.inventory.materialCount, 347);
  assert.equal(result.domains.inventory.uomCount, 5);
  assert.equal(result.domains.inventory.positiveBalanceRowCount, 1200);
  assert.equal(result.domains.inventory.negativeBalanceRowCount, 50);
  assert.equal(result.domains.inventory.movementRowCount, 42);
  assert.equal(result.domains.inventory.latestMovementAt, '2026-10-03');
  assert.equal(result.domains.inventory.movementSources.materialIssue, 20);
  assert.equal(result.domains.cost.forecastCost, '600');
  assert.equal(result.domains.finance.accountsPayable.approvedInvoiceCount, 2);
  assert.equal(result.domains.finance.accountsPayable.outstandingInvoiceCount, 1);
  assert.equal(result.domains.finance.accountsPayable.outstandingAmount, '60');
  assert.equal(result.domains.finance.accountsReceivable.outstandingAmount, '120');
  assert.equal(result.domains.finance.netCashFlow, '560');
  assert.equal(result.sourceTraceability.cost.sourceViewAvailable, false);
  assert.equal(
    result.sourceTraceability.cost.protectedDetailPolicy,
    'OWNING_MODULE_PERMISSION_REQUIRED',
  );
  assert.equal(result.boundaries.readOnlyComposition, true);

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('must-not-leak'), false);
  assert.equal(serialized.includes('sourceEvidence'), false);
  assert.equal(serialized.includes('activities'), false);
  assert.equal(serialized.includes('rows'), false);
  assert.equal(serialized.includes('secretSupplierInvoiceDetail'), false);
  assert.equal(serialized.includes('secretClientInvoiceDetail'), false);
  assert.equal(serialized.includes('secretMovementDetail'), false);
});

test('V0.8-A Project summary fails before source composition when Project access is denied', async () => {
  let sourceCalled = false;
  const access = {
    assertAccess: async () => {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        detail: 'You do not have access to this project.',
      });
    },
  } as unknown as ProjectAccessService;
  const reporting = {
    projectEngineer: async () => {
      sourceCalled = true;
      throw new Error('must not be called');
    },
  } as unknown as ReportingService;

  const service = new ManagementService(
    {} as PrismaService,
    access,
    reporting,
    {} as CostControlService,
    {} as CashFlowService,
    {} as FinanceService,
    {} as ClientInvoiceService,
    {} as InventoryReportService,
  );

  await assert.rejects(
    () =>
      service.projectSummary(auth(), 'project-1', {
        asOf: new Date('2026-10-04T00:00:00.000Z'),
        days: 14,
      }),
    (error: unknown) => error instanceof ForbiddenException,
  );
  assert.equal(sourceCalled, false);
});

test('V0.8-C Portfolio uses bounded canonical source reads and exposes source signals without an unapproved severity policy', async () => {
  let receivedWhere: unknown = null;
  const prisma = {
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    project: {
      findMany: async (args: { where: unknown }) => {
        receivedWhere = args.where;
        return [
          {
            id: 'project-1',
            projectCode: 'P-001',
            projectName: 'Scoped Project One',
            plannedStartDate: new Date('2026-01-01T00:00:00.000Z'),
            plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
            actualStartDate: null,
            actualCompletionDate: null,
          },
          {
            id: 'project-2',
            projectCode: 'P-002',
            projectName: 'Scoped Project Two',
            plannedStartDate: new Date('2026-02-01T00:00:00.000Z'),
            plannedCompletionDate: new Date('2027-01-31T00:00:00.000Z'),
            actualStartDate: null,
            actualCompletionDate: null,
          },
        ];
      },
    },
  } as unknown as PrismaService;

  const access = {
    scopeWhere: async () => ({
      companyId: 'company',
      id: { in: ['project-1', 'project-2'] },
    }),
  } as unknown as ProjectAccessService;

  let receivedPortfolioDays: 14 | 28 | null = null;
  const reporting = {
    portfolioSignals: async (
      _auth: AuthenticatedUserContext,
      _projectIds: string[],
      _asOf: Date,
      days: 14 | 28,
    ) => {
      receivedPortfolioDays = days;
      return [
      {
        projectId: 'project-1',
        schedule: {
          total: 10,
          completed: 4,
          delayed: 1,
          critical: 2,
          lookahead: 3,
        },
        procurement: { total: 5, AT_RISK: 0, ON_TIME: 4, UNAVAILABLE: 1 },
        siteExecution: { recentReportCount: 1, issueCount: 0, delayCount: 0 },
      },
      {
        projectId: 'project-2',
        schedule: {
          total: 8,
          completed: 3,
          delayed: 2,
          critical: 1,
          lookahead: 4,
        },
        procurement: { total: 4, AT_RISK: 1, ON_TIME: 2, UNAVAILABLE: 1 },
        siteExecution: { recentReportCount: 1, issueCount: 2, delayCount: 1 },
      },
    ];
    },
    projectEngineer: async () => {
      throw new Error('portfolio must not fan out through projectEngineer');
    },
    procurement: async () => {
      throw new Error('portfolio must not fan out through procurement');
    },
  } as unknown as ReportingService;

  const inventory = {
    portfolioBalanceSummaries: async () => [
      {
        projectId: 'project-1',
        balanceRowCount: 1,
        warehouseCount: 1,
        materialCount: 2,
        uomCount: 1,
      },
      {
        projectId: 'project-2',
        balanceRowCount: 2,
        warehouseCount: 1,
        materialCount: 3,
        uomCount: 1,
      },
    ],
    balanceSummary: async () => {
      throw new Error('portfolio must not fan out through balanceSummary');
    },
  } as unknown as InventoryReportService;

  const costRow = (projectId: string, forecastCost: string, variance: string, forecastProfit: string) => ({
    projectId,
    baseCurrencyCode: 'SGD',
    totals: {
      originalBudget: decimal('1000'),
      revisedBudget: decimal('1200'),
      committedCost: decimal('500'),
      actualCost: decimal('200'),
      paidCost: decimal('90'),
      remainingCommitment: decimal('300'),
      uncommittedEtc: decimal('100'),
      costToComplete: decimal('400'),
      forecastCost: decimal(forecastCost),
      variance: decimal(variance),
      commercial: {
        originalContractValue: decimal('1500'),
        approvedVariationValue: decimal('100'),
        revisedContractValue: decimal('1600'),
        actualRevenue: decimal('700'),
        cashReceived: decimal('650'),
        forecastRevenue: decimal('1600'),
        actualProfit: decimal('500'),
        forecastProfit: decimal(forecastProfit),
      },
    },
  });

  const costControl = {
    portfolioProjectTotals: async () => [
      costRow('project-1', '600', '600', '1000'),
      costRow('project-2', '1300', '-100', '-25'),
    ],
    projectCostControl: async () => {
      throw new Error('portfolio must not fan out through projectCostControl');
    },
  } as unknown as CostControlService;

  const cashFlow = {
    portfolioProjectCashFlows: async () => [
      {
        projectId: 'project-1',
        baseCurrencyCode: 'SGD',
        totals: {
          inflowAmount: decimal('650'),
          outflowAmount: decimal('90'),
          netCashFlow: decimal('560'),
        },
      },
      {
        projectId: 'project-2',
        baseCurrencyCode: 'SGD',
        totals: {
          inflowAmount: decimal('300'),
          outflowAmount: decimal('120'),
          netCashFlow: decimal('180'),
        },
      },
    ],
    projectCashFlow: async () => {
      throw new Error('portfolio must not fan out through projectCashFlow');
    },
  } as unknown as CashFlowService;

  const service = new ManagementService(
    prisma,
    access,
    reporting,
    costControl,
    cashFlow,
    {} as FinanceService,
    {} as ClientInvoiceService,
    inventory,
  );

  const result = await service.portfolio(
    auth(['management.portfolio.view']),
    {
      asOf: new Date('2026-10-04T00:00:00.000Z'),
      days: 14,
    },
  );

  assert.deepEqual(receivedWhere, {
    AND: [
      { companyId: 'company', id: { in: ['project-1', 'project-2'] } },
      { isActive: true },
    ],
  });
  assert.equal(result.contractVersion, 'V0.8-C');
  assert.equal(result.projectCount, 2);
  assert.deepEqual(
    result.projects.map((row) => row.project.id),
    ['project-1', 'project-2'],
  );
  assert.equal(result.healthPolicy.overallSeverity, 'NOT_APPROVED');
  assert.equal(result.healthPolicy.presentation, 'SOURCE_SIGNALS_ONLY');
  assert.equal(
    result.projects[0]?.health.overallSeverity.status,
    'UNAVAILABLE',
  );
  assert.equal(
    result.projects[1]?.health.sourceSignals.procurement.atRiskLines,
    1,
  );
  assert.equal(receivedPortfolioDays, 14);
  assert.equal(result.totals.schedule.activities, 18);
  assert.equal(result.totals.schedule.completed, 7);
  assert.equal(result.totals.schedule.delayed, 3);
  assert.equal(result.totals.schedule.critical, 3);
  assert.equal(result.totals.schedule.lookahead, 7);
  assert.equal(
    result.projects[1]?.health.sourceSignals.progress.lookaheadActivities,
    4,
  );
  assert.equal(result.totals.procurement.atRisk, 1);
  assert.equal(result.totals.inventory.balanceRows, 3);
  assert.equal(result.totals.cost.revisedBudget, '2400');
  assert.equal(result.totals.cost.forecastCost, '1900');
  assert.equal(result.totals.commercial.forecastProfit.status, 'AVAILABLE');
  assert.equal(result.totals.commercial.forecastProfit.value, '975');
  assert.equal(
    result.scope.inaccessibleProjectsExcludedBeforeAggregation,
    true,
  );
  assert.equal(result.boundaries.boundedPortfolioSourceReads, true);
  assert.equal(result.boundaries.perProjectAuthorizationFanOut, false);
  assert.equal(result.boundaries.deterministicHealthSignals, true);
  assert.equal(result.boundaries.overallHealthSeverityPolicyApproved, false);
  assert.equal(result.deferredToLaterStages.domainDashboards, false);
  const serializedPortfolio = JSON.stringify(result);
  assert.equal(serializedPortfolio.includes('sourceEvidence'), false);
  assert.equal(serializedPortfolio.includes('generalRemarks'), false);
  assert.equal(serializedPortfolio.includes('currentBaseline'), false);
});

test('V0.8-B Management Project selector applies effective Project scope before listing choices', async () => {
  let receivedWhere: unknown = null;
  const prisma = {
    project: {
      findMany: async (args: { where: unknown }) => {
        receivedWhere = args.where;
        return [
          {
            id: 'project-1',
            projectCode: 'P-001',
            projectName: 'Scoped Project',
          },
        ];
      },
    },
  } as unknown as PrismaService;
  const access = {
    scopeWhere: async () => ({
      companyId: 'company',
      id: { in: ['project-1'] },
    }),
  } as unknown as ProjectAccessService;

  const service = new ManagementService(
    prisma,
    access,
    {} as ReportingService,
    {} as CostControlService,
    {} as CashFlowService,
    {} as FinanceService,
    {} as ClientInvoiceService,
    {} as InventoryReportService,
  );

  const result = await service.projects(auth());

  assert.deepEqual(result, [
    {
      id: 'project-1',
      projectCode: 'P-001',
      projectName: 'Scoped Project',
    },
  ]);
  assert.deepEqual(receivedWhere, {
    AND: [
      { companyId: 'company', id: { in: ['project-1'] } },
      { isActive: true },
    ],
  });
});


test('V0.8-E Management cost report reuses canonical WBS/Cost Code filters and CSV parity', async () => {
  const fixture = managementReportFixture();
  const wbsId = '11111111-1111-4111-8111-111111111111';
  const costCodeId = '22222222-2222-4222-8222-222222222222';
  const permissions = [
    'management.dashboard.view',
    'management.report.export',
    'cost.control.view',
  ];
  const options = {
    asOf: new Date('2026-10-10T00:00:00.000Z'),
    days: 14 as const,
    domain: 'COST' as const,
    wbsId,
    costCodeId,
  };

  const report = await fixture.service.projectReport(
    auth(permissions),
    'project-1',
    options,
  );

  assert.equal(report.contractVersion, 'V0.8-E');
  assert.equal(report.filters.wbs?.id, wbsId);
  assert.equal(report.filters.costCode?.id, costCodeId);
  assert.equal(report.filters.wbsIncludesDescendants, true);
  assert.deepEqual(fixture.getCostFilters(), { wbsId, costCodeId });
  assert.equal(report.rows.every((row) => row.domain === 'COST'), true);
  assert.equal(
    report.rows.find((row) => row.metric === 'REVISED_BUDGET')?.value,
    '600',
  );
  assert.equal(
    report.rows.find((row) => row.metric === 'REVISED_BUDGET')
      ?.sourceApiPath,
    '/projects/project-1/cost-control?wbsId=' +
      encodeURIComponent(wbsId) +
      '&costCodeId=' +
      encodeURIComponent(costCodeId),
  );
  assert.equal(report.boundaries.syntheticDimensionalAllocation, false);
  assert.equal(report.boundaries.persistedReportTruth, false);

  const csv = await fixture.service.projectReportCsv(
    auth(permissions),
    'project-1',
    options,
  );
  assert.equal(csv.split('\r\n').filter(Boolean).length, report.rowCount + 1);
  assert.match(
    csv,
    /COST,REVISED_BUDGET,Revised budget,AVAILABLE,600,MONEY,SGD/,
  );
  assert.equal(csv.includes('must-not-leak'), false);
});

test('V0.8-E Finance report applies date range only to canonical Project Cash Flow rows', async () => {
  const fixture = managementReportFixture();
  const report = await fixture.service.projectReport(
    auth([
      'management.dashboard.view',
      'finance.ap.view',
      'finance.ar.view',
      'finance.payment.view',
    ]),
    'project-1',
    {
      asOf: new Date('2026-10-10T00:00:00.000Z'),
      days: 14,
      domain: 'FINANCE',
      fromDate: new Date('2026-10-01T00:00:00.000Z'),
      toDateExclusive: new Date('2026-10-06T00:00:00.000Z'),
    },
  );

  assert.equal(report.filters.fromDate, '2026-10-01');
  assert.equal(report.filters.toDate, '2026-10-05');
  assert.deepEqual(report.filters.dateRangeAppliedDomains, ['FINANCE']);
  assert.equal(
    report.rows.find((row) => row.metric === 'CASH_INFLOW')?.value,
    '10',
  );
  assert.equal(
    report.rows.find(
      (row) => row.metric === 'ACCOUNTS_PAYABLE_OUTSTANDING',
    )?.value,
    '60',
  );
  assert.equal(
    fixture.getCashPeriod()?.fromDate?.toISOString().slice(0, 10),
    '2026-10-01',
  );
  assert.equal(
    fixture.getCashPeriod()?.toDateExclusive?.toISOString().slice(0, 10),
    '2026-10-06',
  );
  assert.equal(
    report.rows.find((row) => row.metric === 'CASH_INFLOW')?.sourceApiPath,
    '/finance/projects/project-1/cash-flow?fromDate=2026-10-01&toDate=2026-10-05',
  );
});

test('V0.8-E rejects WBS/Cost Code filters outside canonical Cost domain', async () => {
  const fixture = managementReportFixture();
  for (const domain of ['FINANCE', 'COMMERCIAL'] as const) {
    await assert.rejects(
      () =>
        fixture.service.projectReport(auth(), 'project-1', {
          asOf: new Date('2026-10-10T00:00:00.000Z'),
          days: 14,
          domain,
          wbsId: '11111111-1111-4111-8111-111111111111',
        }),
      (error: unknown) =>
        error instanceof UnprocessableEntityException &&
        (error.getResponse() as { code?: string }).code ===
          'MANAGEMENT_REPORT_DIMENSION_UNSUPPORTED',
    );
  }
});

test('V0.8-E CSV neutralizes spreadsheet formulas while preserving numeric values', async () => {
  const fixture = managementReportFixture('=HYPERLINK("https://example.invalid","x")');
  const csv = await fixture.service.projectReportCsv(
    auth([
      'management.dashboard.view',
      'management.report.export',
      'cost.control.view',
    ]),
    'project-1',
    {
      asOf: new Date('2026-10-10T00:00:00.000Z'),
      days: 14,
      domain: 'COST',
    },
  );

  assert.match(
    csv,
    /'\=HYPERLINK\("https:\/\/example\.invalid","x"\)/,
  );
  assert.match(
    csv,
    /COST,REVISED_BUDGET,Revised budget,AVAILABLE,1200,MONEY,SGD/,
  );
});
