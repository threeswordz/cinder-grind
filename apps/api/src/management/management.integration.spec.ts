import assert from 'node:assert/strict';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { CostControlService } from '../cost-control/cost-control.service';
import { CashFlowService } from '../finance/cash-flow.service';
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
        projectName: 'Management Project',
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

  const inventory = {
    balanceSummary: async () => ({
      balanceRowCount: 1250,
      warehouseCount: 12,
      materialCount: 347,
      uomCount: 5,
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
  assert.equal(result.domains.cost.forecastCost, '600');
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

test('V0.8-A Portfolio applies effective Project scope before aggregation', async () => {
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
            isActive: true,
            plannedStartDate: new Date('2026-01-01T00:00:00.000Z'),
            plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
            actualStartDate: null,
            actualCompletionDate: null,
            statusDefinition: {
              statusCode: 'ACTIVE',
              statusLabel: 'Active',
            },
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
    {} as InventoryReportService,
  );

  const result = await service.portfolio(
    auth(['management.portfolio.view']),
  );

  assert.equal(result.projectCount, 1);
  assert.deepEqual(
    result.projects.map((project) => project.id),
    ['project-1'],
  );
  assert.deepEqual(receivedWhere, {
    AND: [
      { companyId: 'company', id: { in: ['project-1'] } },
      { isActive: true },
    ],
  });
  assert.equal(
    result.scope.inaccessibleProjectsExcludedBeforeAggregation,
    true,
  );
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
