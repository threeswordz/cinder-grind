import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CostControlController } from './cost-control.controller';
import { costPositiveDecimal } from './cost-control-validation';
import { DirectCostController } from './direct-cost.controller';
import { DirectCostService } from './direct-cost.service';
import { ForecastController } from './forecast.controller';
import { ForecastService } from './forecast.service';
import { ProjectVariationService } from './project-variation.service';
import {
  activeProjectVariationValue,
  remainingCostCommitment,
  selectCurrentApprovedPurchaseOrders,
  selectOriginalAndCurrentBudget,
  splitSubcontractCommitment,
  sumCostControlDecimals,
  CostControlService,
} from './cost-control.service';

test('V0.7-A Budget and PO currency checks work without other Finance sources', async () => {
  for (const source of ['budget', 'po']) {
    for (const currencyCode of ['SGD', 'USD', null]) {
      const sourceRow = source === 'budget'
        ? { id: 'budget', revisionNo: 1, revisionNumber: 'BR-1', currencyCode,
            approvalInstance: { completedAt: new Date() }, lines: [] }
        : { id: 'po', poNumber: 'PO-1', revisionNo: 0, currencyCode, cancelledAt: null, lines: [] };
      const prisma = {
        project: { findFirstOrThrow: async () => ({ id: 'project' }) },
        company: { findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }) },
        wbsElement: { findMany: async () => [] },
        costCode: { findMany: async () => [] },
        budgetRevision: { findMany: async () => source === 'budget' ? [sourceRow] : [] },
        purchaseOrder: { findMany: async () => source === 'po' ? [sourceRow] : [] },
        subcontractAgreement: { findMany: async () => [] },
        supplierInvoice: { findMany: async () => [] },
        subcontractCertification: { findMany: async () => [] },
        payment: { findMany: async () => [] },
        directCostPosting: { findMany: async () => [] },
        projectVariation: { findMany: async () => [] },
        clientInvoice: { findMany: async () => [] },
    costForecast: { findFirst: async () => null },
      };
      const service = new CostControlService(prisma as unknown as PrismaService,
        { assertAccess: async () => {} } as never);
      const read = () => service.projectCostControl({ companyId: 'company', permissions: [] } as never, 'project');
      if (currencyCode === 'SGD') {
        assert.equal((await read()).baseCurrencyCode, 'SGD');
      } else {
        await assert.rejects(read, (error: unknown) => {
          if (!(error instanceof UnprocessableEntityException)) return false;
          return (error.getResponse() as { code: string }).code ===
            (currencyCode === null ? 'COST_CONTROL_CURRENCY_UNVERIFIED' : 'COST_CONTROL_CURRENCY_UNSUPPORTED');
        }, source + ' must independently fail closed for mismatched/unknown provenance');
      }
    }
  }
});

test('V0.7-A source currency is captured, retained and inherited across Company changes', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({ data: {
      companyCode: 'CC-' + suffix, companyName: 'Currency provenance', baseCurrencyCode: 'SGD',
    } });
    const customer = await prisma.customer.create({ data: {
      companyId: company.id, customerCode: 'C-' + suffix, customerName: 'Currency customer',
    } });
    const user = await prisma.user.create({ data: {
      companyId: company.id, email: suffix + '@example.com', displayName: 'Currency maker', passwordHash: 'x',
    } });
    const supplier = await prisma.supplier.create({ data: {
      companyId: company.id, supplierCode: 'S-' + suffix, supplierName: 'Currency supplier',
    } });
    const project = await prisma.project.create({ data: {
      companyId: company.id, projectCode: 'P-' + suffix, projectName: 'Currency project', customerId: customer.id,
      contractValue: '100', plannedStartDate: new Date('2026-10-01'), plannedCompletionDate: new Date('2027-01-01'),
    } });
    const budget = await prisma.budgetRevision.create({ data: {
      companyId: company.id, projectId: project.id, revisionNo: 1, revisionNumber: 'BR-' + suffix, createdByUserId: user.id,
    } });
    const po = await prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'PO-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(budget.currencyCode, 'SGD');
    assert.equal(po.currencyCode, 'SGD');
    await prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode: 'USD' } });
    assert.equal((await prisma.budgetRevision.findUniqueOrThrow({ where: { id: budget.id } })).currencyCode, 'SGD');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } })).currencyCode, 'SGD');
    await assert.rejects(() => prisma.purchaseOrder.update({ where: { id: po.id }, data: { currencyCode: 'USD' } }));
    await assert.rejects(() => prisma.budgetRevision.update({ where: { id: budget.id }, data: { currencyCode: 'USD' } }));
    const budgetRevision = await prisma.budgetRevision.create({ data: {
      companyId: company.id, projectId: project.id, revisionNo: 2, revisionNumber: 'BR2-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(budgetRevision.currencyCode, 'SGD');
    await assert.rejects(() => prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'FORGED-' + suffix,
      createdByUserId: user.id, currencyCode: 'SGD',
    } }));
    const newPo = await prisma.purchaseOrder.create({ data: {
      companyId: company.id, projectId: project.id, supplierId: supplier.id, poNumber: 'NEW-' + suffix, createdByUserId: user.id,
    } });
    assert.equal(newPo.currencyCode, 'USD');
  } finally {
    await prisma.$disconnect();
  }
});

test('V0.7-A route requires explicit Cost Control permission', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      CostControlController.prototype.projectCostControl,
    ),
    ['cost.control.view'],
  );
});

test('V0.7-A Budget selector preserves first approval and highest approved revision', () => {
  const revisions = [
    {
      id: 'revision-2',
      revisionNo: 2,
      approvalInstance: {
        completedAt: new Date('2026-10-03T02:00:00.000Z'),
      },
    },
    {
      id: 'revision-1',
      revisionNo: 1,
      approvalInstance: {
        completedAt: new Date('2026-10-03T01:00:00.000Z'),
      },
    },
  ];
  const selected = selectOriginalAndCurrentBudget(revisions);
  assert.equal(selected.original?.id, 'revision-1');
  assert.equal(selected.current?.id, 'revision-2');
});

test('V0.7-A PO selector uses latest approved revision and does not revive cancelled commitment', () => {
  const selected = selectCurrentApprovedPurchaseOrders([
    {
      id: 'po-a-0',
      poNumber: 'PO-A',
      revisionNo: 0,
      cancelledAt: null,
    },
    {
      id: 'po-a-1',
      poNumber: 'PO-A',
      revisionNo: 1,
      cancelledAt: null,
    },
    {
      id: 'po-b-0',
      poNumber: 'PO-B',
      revisionNo: 0,
      cancelledAt: null,
    },
    {
      id: 'po-b-1',
      poNumber: 'PO-B',
      revisionNo: 1,
      cancelledAt: new Date('2026-10-03T03:00:00.000Z'),
    },
  ]);
  assert.deepEqual(
    selected.map((row) => row.id),
    ['po-a-1'],
  );
});

test('V0.7-A Work Orders allocate within the subcontract ceiling without double counting', () => {
  const allocation = splitSubcontractCommitment(
    new Prisma.Decimal('125000.00'),
    [
      { amount: new Prisma.Decimal('75000.00') },
      { amount: new Prisma.Decimal('10000.00') },
    ],
  );
  assert.equal(allocation.allocatedAmount.toString(), '85000');
  assert.equal(allocation.unallocatedAmount.toString(), '40000');
  assert.throws(
    () =>
      splitSubcontractCommitment(
        new Prisma.Decimal('100.00'),
        [{ amount: new Prisma.Decimal('100.01') }],
      ),
    (error: unknown) => {
      if (!(error instanceof UnprocessableEntityException)) return false;
      const response = error.getResponse() as { code?: string };
      return (
        response.code ===
        'COST_CONTROL_SUBCONTRACT_ALLOCATION_INVALID'
      );
    },
  );
});

test('V0.7-A Decimal helper preserves exact financial arithmetic beyond Decimal.js default precision', () => {
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('0.1'),
      new Prisma.Decimal('0.2'),
      new Prisma.Decimal('123456789.12345678'),
    ]).toFixed(),
    '123456789.42345678',
  );
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('9999999999999999.9999'),
      new Prisma.Decimal('0.0001'),
    ]).toFixed(),
    '10000000000000000',
  );
  assert.equal(
    sumCostControlDecimals([
      new Prisma.Decimal('999999999999999999999999999999.99999999'),
      new Prisma.Decimal('0.00000001'),
    ]).toFixed(),
    '1000000000000000000000000000000',
  );
});


test('V0.7-C Remaining Commitment uses exact Decimal arithmetic and floors at zero', () => {
  assert.equal(
    remainingCostCommitment(
      new Prisma.Decimal('100.00'),
      new Prisma.Decimal('40.00'),
    ).toFixed(2),
    '60.00',
  );
  assert.equal(
    remainingCostCommitment(
      new Prisma.Decimal('100.00'),
      new Prisma.Decimal('100.01'),
    ).toFixed(2),
    '0.00',
  );
  assert.equal(
    remainingCostCommitment(
      new Prisma.Decimal('9999999999999999.99'),
      new Prisma.Decimal('0.01'),
    ).toFixed(2),
    '9999999999999999.98',
  );
});

test('V0.7-E reporting keeps descendant WBS values and explicit Unallocated dimensions', async () => {
  const prisma = {
    project: {
      findFirstOrThrow: async () => ({
        id: 'project',
        projectCode: 'P-RPT',
        projectName: 'Reporting project',
        contractValue: new Prisma.Decimal('1000.00'),
      }),
    },
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    wbsElement: {
      findMany: async () => [
        { id: 'wbs-parent', parentId: null, wbsCode: '1', wbsName: 'Parent' },
        {
          id: 'wbs-child',
          parentId: 'wbs-parent',
          wbsCode: '1.1',
          wbsName: 'Child',
        },
      ],
    },
    costCode: {
      findMany: async () => [
        { id: 'cc-1', costCode: 'LAB', costName: 'Labour' },
      ],
    },
    budgetRevision: {
      findMany: async () => [
        {
          id: 'budget-1',
          revisionNo: 1,
          revisionNumber: 'BUD-1',
          currencyCode: 'SGD',
          approvalInstance: { completedAt: new Date('2026-10-01T00:00:00Z') },
          lines: [
            {
              id: 'budget-child',
              amount: new Prisma.Decimal('100.00'),
              wbsId: 'wbs-child',
              costCodeId: 'cc-1',
            },
            {
              id: 'budget-unallocated',
              amount: new Prisma.Decimal('20.00'),
              wbsId: null,
              costCodeId: null,
            },
          ],
        },
      ],
    },
    purchaseOrder: { findMany: async () => [] },
    subcontractAgreement: { findMany: async () => [] },
    supplierInvoice: { findMany: async () => [] },
    subcontractCertification: { findMany: async () => [] },
    payment: { findMany: async () => [] },
    directCostPosting: {
      findMany: async () => [
        {
          id: 'direct-child',
          postingDate: new Date('2026-10-02'),
          description: 'Child direct cost',
          reference: null,
          amount: new Prisma.Decimal('50.00'),
          currencyCode: 'SGD',
          wbsId: 'wbs-child',
          costCodeId: 'cc-1',
          reversesPostingId: null,
          reversalReason: null,
        },
        {
          id: 'direct-unallocated-wbs',
          postingDate: new Date('2026-10-02'),
          description: 'Unallocated WBS direct cost',
          reference: null,
          amount: new Prisma.Decimal('10.00'),
          currencyCode: 'SGD',
          wbsId: null,
          costCodeId: 'cc-1',
          reversesPostingId: null,
          reversalReason: null,
        },
      ],
    },
    projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: { findFirst: async () => null },
  };
  const service = new CostControlService(
    prisma as unknown as PrismaService,
    { assertAccess: async () => {} } as never,
  );
  const auth = {
    companyId: 'company',
    permissions: ['cost.control.view', 'cost.direct_posting.create'],
  } as never;

  const full = await service.projectCostControl(auth, 'project');
  assert.equal(full.totals.revisedBudget.toFixed(2), '120.00');
  assert.equal(full.totals.actualCost.direct.toFixed(2), '60.00');
  assert.equal(full.reportDimensions.wbs.length, 2);
  assert.equal(full.reportDimensions.costCodes.length, 1);
  assert.ok(
    full.dimensionBreakdown.some(
      (row) =>
        row.wbs === null &&
        row.costCode === null &&
        row.allocationState === 'UNALLOCATED' &&
        row.revisedBudget.toFixed(2) === '20.00',
    ),
  );
  assert.ok(
    full.dimensionBreakdown.some(
      (row) =>
        row.wbs === null &&
        row.costCode?.id === 'cc-1' &&
        row.allocationState === 'PARTIALLY_ALLOCATED' &&
        row.actualCost.direct.toFixed(2) === '10.00',
    ),
  );

  const parent = await service.projectCostControl(auth, 'project', {
    wbsId: 'wbs-parent',
  });
  assert.equal(parent.filters.wbs?.id, 'wbs-parent');
  assert.equal(parent.filters.wbsIncludesDescendants, true);
  assert.equal(parent.totals.revisedBudget.toFixed(2), '100.00');
  assert.equal(parent.totals.actualCost.direct.toFixed(2), '50.00');
  assert.equal(parent.dimensionBreakdown.length, 1);
  assert.equal(parent.dimensionBreakdown[0]?.wbs?.id, 'wbs-child');
  assert.equal(parent.dimensionBreakdown[0]?.costCode?.id, 'cc-1');
});

test('V0.7-C integrated forecast reduces only canonically linked PO commitment', async () => {
  const prisma = {
    project: {
      findFirstOrThrow: async () => ({
        id: 'project',
        projectCode: 'P-1',
        projectName: 'Project',
      }),
    },
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    wbsElement: { findMany: async () => [] },
    costCode: { findMany: async () => [] },
    budgetRevision: { findMany: async () => [] },
    purchaseOrder: {
      findMany: async () => [
        {
          id: 'po',
          poNumber: 'PO-1',
          revisionNo: 0,
          currencyCode: 'SGD',
          cancelledAt: null,
          lines: [
            {
              id: 'po-line-1',
              amount: new Prisma.Decimal('100.00'),
              wbsId: null,
              costCodeId: null,
              quotationAwardId: 'award-1',
            },
          ],
        },
      ],
    },
    subcontractAgreement: { findMany: async () => [] },
    supplierInvoice: {
      findMany: async () => [
        {
          id: 'invoice',
          supplierInvoiceNumber: 'SI-1',
          invoiceDate: new Date('2026-10-03'),
          currencyCode: 'SGD',
          items: [
            {
              id: 'invoice-line',
              amount: new Prisma.Decimal('40.00'),
              wbsId: null,
              costCodeId: null,
              purchaseOrderLine: {
                quotationAwardId: 'award-1',
                purchaseOrder: { poNumber: 'PO-1' },
              },
              goodsReceiptItem: null,
            },
          ],
        },
      ],
    },
    subcontractCertification: { findMany: async () => [] },
    payment: { findMany: async () => [] },
    directCostPosting: { findMany: async () => [] },
    projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: {
      findFirst: async () => ({
        id: 'forecast',
        versionNo: 3,
        forecastDate: new Date('2026-10-03'),
        currencyCode: 'SGD',
        approvedAt: new Date('2026-10-03T12:00:00Z'),
        lines: [
          {
            id: 'forecast-line',
            lineNo: 1,
            wbsId: null,
            costCodeId: null,
            uncommittedEtcAmount: new Prisma.Decimal('25.00'),
            remarks: null,
          },
        ],
      }),
    },
  };
  const service = new CostControlService(
    prisma as unknown as PrismaService,
    { assertAccess: async () => {} } as never,
  );

  const result = await service.projectCostControl(
    {
      companyId: 'company',
      permissions: ['cost.forecast.view'],
    } as never,
    'project',
  );

  assert.equal(result.totals.committedCost.procurement.toFixed(2), '100.00');
  assert.equal(result.totals.actualCost.supplier.toFixed(2), '40.00');
  assert.equal(
    result.totals.remainingCommitment.procurement.toFixed(2),
    '60.00',
  );
  assert.equal(result.totals.uncommittedEtc.toFixed(2), '25.00');
  assert.equal(result.totals.costToComplete.toFixed(2), '85.00');
  assert.equal(result.totals.forecastCost.toFixed(2), '125.00');
  assert.equal(result.currentForecast?.versionNo, 3);

  const aggregateOnly = await service.projectCostControl(
    {
      companyId: 'company',
      permissions: ['cost.control.view'],
    } as never,
    'project',
  );
  assert.equal(aggregateOnly.totals.uncommittedEtc.toFixed(2), '25.00');
  assert.equal(aggregateOnly.currentForecast, null);
  assert.equal(
    aggregateOnly.sourceEvidence.uncommittedEtc.recordsVisible,
    false,
  );
  assert.equal(
    'records' in aggregateOnly.sourceEvidence.uncommittedEtc,
    false,
  );
});

test('V0.7-C Remaining Commitment validates currency for linked Actual even when invoice dimensions are filtered out', async () => {
  const prisma = {
    project: {
      findFirstOrThrow: async () => ({
        id: 'project',
        projectCode: 'P-CURRENCY',
        projectName: 'Currency regression',
      }),
    },
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    wbsElement: {
      findMany: async () => [
        {
          id: 'wbs-selected',
          parentId: null,
          wbsCode: 'SELECTED',
          wbsName: 'Selected WBS',
        },
        {
          id: 'wbs-other',
          parentId: null,
          wbsCode: 'OTHER',
          wbsName: 'Other WBS',
        },
      ],
    },
    costCode: { findMany: async () => [] },
    budgetRevision: { findMany: async () => [] },
    purchaseOrder: {
      findMany: async () => [
        {
          id: 'po',
          poNumber: 'PO-CURRENCY',
          revisionNo: 0,
          currencyCode: 'SGD',
          cancelledAt: null,
          lines: [
            {
              id: 'po-line',
              amount: new Prisma.Decimal('100.00'),
              wbsId: 'wbs-selected',
              costCodeId: null,
              quotationAwardId: 'award-currency',
            },
          ],
        },
      ],
    },
    subcontractAgreement: { findMany: async () => [] },
    supplierInvoice: {
      findMany: async () => [
        {
          id: 'invoice',
          supplierInvoiceNumber: 'SI-FOREIGN',
          invoiceDate: new Date('2026-10-03'),
          currencyCode: 'USD',
          items: [
            {
              id: 'invoice-line',
              amount: new Prisma.Decimal('40.00'),
              wbsId: 'wbs-other',
              costCodeId: null,
              purchaseOrderLine: {
                quotationAwardId: 'award-currency',
                purchaseOrder: { poNumber: 'PO-CURRENCY' },
              },
              goodsReceiptItem: null,
            },
          ],
        },
      ],
    },
    subcontractCertification: { findMany: async () => [] },
    payment: { findMany: async () => [] },
    directCostPosting: { findMany: async () => [] },
    projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: { findFirst: async () => null },
  };
  const service = new CostControlService(
    prisma as unknown as PrismaService,
    { assertAccess: async () => {} } as never,
  );

  await assert.rejects(
    () =>
      service.projectCostControl(
        { companyId: 'company', permissions: [] } as never,
        'project',
        { wbsId: 'wbs-selected' },
      ),
    (error: unknown) => {
      if (!(error instanceof UnprocessableEntityException)) return false;
      return (
        (error.getResponse() as { code?: string }).code ===
        'COST_CONTROL_CURRENCY_UNSUPPORTED'
      );
    },
  );
});

test('V0.7-C Forecast routes require explicit view/manage/approve permissions', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ForecastController.prototype.list,
    ),
    ['cost.forecast.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ForecastController.prototype.create,
    ),
    ['cost.forecast.manage'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      ForecastController.prototype.approve,
    ),
    ['cost.forecast.approve'],
  );
});

test('V0.7-C Forecast service creates a versioned draft with real PostgreSQL guards', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({
      data: {
        companyCode: 'FC-' + suffix,
        companyName: 'Forecast create company',
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'FC-C-' + suffix,
        customerName: 'Forecast create customer',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'FC-E-' + suffix,
        employeeName: 'Forecast maker employee',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'forecast-maker-' + suffix + '@example.com',
        displayName: 'Forecast maker',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'FC-P-' + suffix,
        projectName: 'Forecast create project',
        customerId: customer.id,
        contractValue: '1000.00',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-10-01'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Forecast Maker',
      },
    });
    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: 'FC-' + suffix,
        wbsName: 'Forecast WBS',
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'FC-' + suffix,
        costName: 'Forecast Cost Code',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'FC-MAKER-' + suffix,
        roleName: 'Forecast Maker',
      },
    });
    const managePermission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: 'cost.forecast.manage' },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: managePermission.id },
    });
    await prisma.userRole.create({
      data: {
        companyId: company.id,
        userId: maker.id,
        roleId: role.id,
      },
    });

    const service = new ForecastService(
      prisma,
      { assertAccess: async () => {} } as never,
      {} as never,
      new AuditService(prisma),
    );
    const auth = {
      companyId: company.id,
      userId: maker.id,
      permissions: ['cost.forecast.manage'],
    } as never;
    const created = await service.create(
      { auth },
      project.id,
      {
        forecastDate: new Date('2027-04-05T00:00:00.000Z'),
        description: 'Real PostgreSQL Forecast draft',
        createKey: 'forecast-create-' + suffix,
        lines: [
          {
            wbsId: wbs.id,
            costCodeId: costCode.id,
            uncommittedEtcAmount: new Prisma.Decimal('35.00'),
            remarks: 'Dimensioned ETC',
            inputOrder: 1,
          },
          {
            wbsId: null,
            costCodeId: null,
            uncommittedEtcAmount: new Prisma.Decimal('10.00'),
            remarks: 'Unallocated ETC',
            inputOrder: 2,
          },
        ],
      },
    );

    assert.equal(created.state, 'DRAFT');
    assert.equal(created.versionNo, 1);
    assert.equal(created.totalUncommittedEtc.toFixed(2), '45.00');
    assert.equal(created.lines.length, 2);

    const concurrent = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        service.create(
          { auth },
          project.id,
          {
            forecastDate: new Date('2027-04-06T00:00:00.000Z'),
            description: 'Concurrent Forecast draft ' + index,
            createKey: 'forecast-concurrent-' + index + '-' + suffix,
            lines: [
              {
                wbsId: null,
                costCodeId: null,
                uncommittedEtcAmount: new Prisma.Decimal(
                  (index + 1).toFixed(2),
                ),
                remarks: 'Concurrent version regression',
                inputOrder: 1,
              },
            ],
          },
        ),
      ),
    );
    assert.deepEqual(
      concurrent
        .map((forecast) => forecast.versionNo)
        .sort((left, right) => left - right),
      [2, 3, 4, 5],
    );

    const sourceWithLine = await service.create(
      { auth },
      project.id,
      {
        forecastDate: new Date('2027-04-08T00:00:00.000Z'),
        description: 'Forecast line parent immutability source',
        createKey: 'forecast-line-source-' + suffix,
        lines: [
          {
            wbsId: null,
            costCodeId: null,
            uncommittedEtcAmount: new Prisma.Decimal('12.00'),
            remarks: 'Must remain attached to its original Forecast',
            inputOrder: 1,
          },
        ],
      },
    );
    const alternateDraft = await service.create(
      { auth },
      project.id,
      {
        forecastDate: new Date('2027-04-09T00:00:00.000Z'),
        description: 'Forecast line parent immutability target',
        createKey: 'forecast-line-target-' + suffix,
        lines: [],
      },
    );

    await assert.rejects(() =>
      prisma.costForecastLine.update({
        where: { id: sourceWithLine.lines[0]!.id },
        data: { forecastId: alternateDraft.id },
      }),
    );
    const retainedLine = await prisma.costForecastLine.findUniqueOrThrow({
      where: { id: sourceWithLine.lines[0]!.id },
      select: { forecastId: true },
    });
    assert.equal(retainedLine.forecastId, sourceWithLine.id);
  } finally {
    await prisma.$disconnect();
  }
});

test('V0.7-C Forecast create returns controlled conflict after concurrency retry exhaustion', async () => {
  for (const code of ['P2002', 'P2034'] as const) {
    let attempts = 0;
    const prisma = {
      projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: {
        findFirst: async () => null,
      },
      $transaction: async () => {
        attempts += 1;
        throw new Prisma.PrismaClientKnownRequestError(
          'Synthetic Forecast concurrency failure',
          {
            code,
            clientVersion: 'test',
          },
        );
      },
    };
    const service = new ForecastService(
      prisma as unknown as PrismaService,
      { assertAccess: async () => {} } as never,
      {} as never,
      {} as never,
    );
    const auth = {
      companyId: 'company',
      userId: 'maker',
      permissions: ['cost.forecast.manage'],
    } as never;

    await assert.rejects(
      () =>
        service.create(
          { auth },
          'project',
          {
            forecastDate: new Date('2027-04-07T00:00:00.000Z'),
            description: 'Retry exhaustion regression',
            createKey: 'retry-exhaustion-' + code,
            lines: [],
          },
        ),
      (error: unknown) => {
        if (!(error instanceof ConflictException)) return false;
        return (
          (error.getResponse() as { code?: string }).code ===
          'COST_FORECAST_CREATE_CONCURRENCY_RETRY_EXHAUSTED'
        );
      },
    );
    assert.equal(attempts, 5, code + ' should exhaust exactly five attempts');
  }
});

test('V0.7-C serialized Forecast writes retry P2034 and fail as controlled conflicts after exhaustion', async () => {
  const operations = [
    {
      name: 'update',
      permission: 'cost.forecast.manage',
      invoke: (service: ForecastService, auth: never) =>
        service.update({ auth }, 'forecast', { description: 'retry' }),
    },
    {
      name: 'submit',
      permission: 'cost.forecast.manage',
      invoke: (service: ForecastService, auth: never) =>
        service.submit({ auth }, 'forecast', 'WF-1', 'submit-key'),
    },
    {
      name: 'approve',
      permission: 'cost.forecast.approve',
      invoke: (service: ForecastService, auth: never) =>
        service.approve({ auth }, 'forecast', 'approve-key', 'retry'),
    },
    {
      name: 'reject',
      permission: 'cost.forecast.approve',
      invoke: (service: ForecastService, auth: never) =>
        service.reject({ auth }, 'forecast', 'reject-key', 'retry'),
    },
  ] as const;

  for (const operation of operations) {
    let attempts = 0;
    const prisma = {
      projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: {
        findFirst: async () => ({
          id: 'forecast',
          companyId: 'company',
          projectId: 'project',
          lines: [],
        }),
      },
      $transaction: async () => {
        attempts += 1;
        throw new Prisma.PrismaClientKnownRequestError(
          'Synthetic serialized Forecast write conflict',
          {
            code: 'P2034',
            clientVersion: 'test',
          },
        );
      },
    };
    const service = new ForecastService(
      prisma as unknown as PrismaService,
      { assertAccess: async () => {} } as never,
      {} as never,
      {} as never,
    );
    const auth = {
      companyId: 'company',
      userId: 'user',
      permissions: [operation.permission],
    } as never;

    await assert.rejects(
      () => operation.invoke(service, auth),
      (error: unknown) => {
        if (!(error instanceof ConflictException)) return false;
        return (
          (error.getResponse() as { code?: string }).code ===
          'COST_FORECAST_WRITE_CONCURRENCY_RETRY_EXHAUSTED'
        );
      },
    );
    assert.equal(
      attempts,
      5,
      operation.name + ' should retry the full serialized transaction five times',
    );
  }
});

test('V0.7-C Forecast permissions are seeded without implicit SYS_ADMIN grants', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const codes = [
      'cost.forecast.view',
      'cost.forecast.manage',
      'cost.forecast.approve',
    ];
    const permissions = await prisma.permission.findMany({
      where: { permissionCode: { in: codes } },
      select: { id: true, permissionCode: true, moduleCode: true },
    });
    assert.deepEqual(
      permissions.map((row) => row.permissionCode).sort(),
      [...codes].sort(),
    );
    assert.ok(permissions.every((row) => row.moduleCode === 'COST_CONTROL'));
    const implicitTechnicalGrant = await prisma.rolePermission.count({
      where: {
        permissionId: { in: permissions.map((row) => row.id) },
        role: { roleCode: 'SYS_ADMIN' },
      },
    });
    assert.equal(implicitTechnicalGrant, 0);
  } finally {
    await prisma.$disconnect();
  }
});

test('V0.7-A permission is seeded without implicit SYS_ADMIN grant', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const permission = await prisma.permission.findUnique({
      where: { permissionCode: 'cost.control.view' },
      select: { id: true, moduleCode: true },
    });
    assert.ok(permission);
    assert.equal(permission.moduleCode, 'COST_CONTROL');
    const implicitTechnicalGrant = await prisma.rolePermission.count({
      where: {
        permissionId: permission.id,
        role: { roleCode: 'SYS_ADMIN' },
      },
    });
    assert.equal(implicitTechnicalGrant, 0);
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.7-B Direct Cost routes require the approved explicit permissions', () => {
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      DirectCostController.prototype.projects,
    ),
    ['cost.control.view'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      DirectCostController.prototype.create,
    ),
    ['cost.direct_posting.create'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      DirectCostController.prototype.submit,
    ),
    ['cost.direct_posting.submit'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      DirectCostController.prototype.approve,
    ),
    ['cost.direct_posting.approve'],
  );
  assert.deepEqual(
    Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      DirectCostController.prototype.reject,
    ),
    ['cost.direct_posting.approve'],
  );
});

test('V0.7-B Direct Cost permissions are seeded without implicit SYS_ADMIN grants', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const codes = [
      'cost.direct_posting.create',
      'cost.direct_posting.submit',
      'cost.direct_posting.approve',
    ];
    const permissions = await prisma.permission.findMany({
      where: { permissionCode: { in: codes } },
      select: { id: true, permissionCode: true, moduleCode: true },
    });
    assert.deepEqual(
      permissions.map((row) => row.permissionCode).sort(),
      [...codes].sort(),
    );
    assert.ok(permissions.every((row) => row.moduleCode === 'COST_CONTROL'));
    const implicitTechnicalGrant = await prisma.rolePermission.count({
      where: {
        permissionId: { in: permissions.map((row) => row.id) },
        role: { roleCode: 'SYS_ADMIN' },
      },
    });
    assert.equal(implicitTechnicalGrant, 0);
  } finally {
    await prisma.$disconnect();
  }
});

test('V0.7-B database guards Direct Cost dimensional scope and normal-posting sign', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({
      data: {
        companyCode: 'DC-' + suffix,
        companyName: 'Direct Cost company',
        baseCurrencyCode: 'SGD',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'DX-' + suffix,
        companyName: 'Other Direct Cost company',
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'DC-C-' + suffix,
        customerName: 'Direct Cost customer',
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'dc-' + suffix + '@example.com',
        displayName: 'Direct Cost maker',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'DC-P-' + suffix,
        projectName: 'Direct Cost project',
        customerId: customer.id,
        contractValue: '100',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'DC-' + suffix,
        costName: 'Direct Cost',
      },
    });
    const otherCostCode = await prisma.costCode.create({
      data: {
        companyId: otherCompany.id,
        costCode: 'DX-' + suffix,
        costName: 'Other Direct Cost',
      },
    });

    const valid = await prisma.directCostPosting.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        costCodeId: costCode.id,
        postingDate: new Date('2026-10-03'),
        description: 'Manual approved-scope expense draft',
        amount: '123.45',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: 'a'.repeat(64),
        createdByUserId: user.id,
      },
    });
    assert.equal(valid.amount.toFixed(2), '123.45');

    await assert.rejects(() =>
      prisma.directCostPosting.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          costCodeId: costCode.id,
          postingDate: new Date('2026-10-03'),
          description: 'Negative normal posting must fail closed',
          amount: '-1.00',
          currencyCode: 'SGD',
          createKey: randomUUID(),
          createPayloadHash: 'b'.repeat(64),
          createdByUserId: user.id,
        },
      }),
    );

    await assert.rejects(() =>
      prisma.directCostPosting.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          costCodeId: otherCostCode.id,
          postingDate: new Date('2026-10-03'),
          description: 'Cross-company Cost Code must fail closed',
          amount: '1.00',
          currencyCode: 'SGD',
          createKey: randomUUID(),
          createPayloadHash: 'c'.repeat(64),
          createdByUserId: user.id,
        },
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.7-B Direct Cost financial input rejects JSON numbers before Decimal conversion', () => {
  assert.equal(
    costPositiveDecimal(
      { amount: '9007199254740993' },
      'amount',
    ).toFixed(0),
    '9007199254740993',
  );
  assert.throws(
    () =>
      costPositiveDecimal(
        { amount: 9007199254740993 },
        'amount',
      ),
    (error: unknown) => {
      if (!(error instanceof UnprocessableEntityException)) return false;
      const response = error.getResponse() as { code?: string };
      return response.code === 'VALIDATION_ERROR';
    },
  );
});

test('V0.7-B database freezes terminal evidence and permits exact reversal after Cost Code deactivation', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({
      data: {
        companyCode: 'DH-' + suffix,
        companyName: 'Direct Cost hardening company',
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'DH-C-' + suffix,
        customerName: 'Direct Cost hardening customer',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'dh-maker-' + suffix + '@example.com',
        displayName: 'Direct Cost hardening maker',
        passwordHash: 'x',
      },
    });
    const approverEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'DH-E-' + suffix,
        employeeName: 'Direct Cost hardening approver employee',
      },
    });
    const approver = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: approverEmployee.id,
        email: 'dh-approver-' + suffix + '@example.com',
        displayName: 'Direct Cost hardening approver',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'DH-P-' + suffix,
        projectName: 'Direct Cost hardening project',
        customerId: customer.id,
        contractValue: '100',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: approverEmployee.id,
        projectRole: 'Cost Control Approver',
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'DH-' + suffix,
        costName: 'Direct Cost hardening',
      },
    });
    const original = await prisma.directCostPosting.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        costCodeId: costCode.id,
        postingDate: new Date('2026-10-03'),
        description: 'Hardening source posting',
        amount: '88.75',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: 'd'.repeat(64),
        createdByUserId: maker.id,
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'DH-WF-' + suffix,
        entityType: 'DIRECT_COST_POSTING',
        workflowName: 'Direct Cost hardening workflow',
      },
    });
    const step = await prisma.approvalStep.create({
      data: {
        approvalWorkflowId: workflow.id,
        stepNo: 1,
        stepName: 'Approve Direct Cost',
        requiredApprovals: 1,
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'DH-APPROVER-' + suffix,
        roleName: 'Direct Cost Hardening Approver',
      },
    });
    const approvePermission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: 'cost.direct_posting.approve' },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: approvePermission.id },
    });
    await prisma.userRole.create({
      data: {
        companyId: company.id,
        userId: approver.id,
        roleId: role.id,
      },
    });
    await prisma.approvalStepRole.create({
      data: { approvalStepId: step.id, roleId: role.id },
    });
    const instance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: 'DIRECT_COST_POSTING',
        entityId: original.id,
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });
    const submittedAt = new Date('2026-10-03T01:00:00.000Z');
    await prisma.directCostPosting.update({
      where: { id: original.id },
      data: {
        state: 'SUBMITTED',
        approvalInstanceId: instance.id,
        submittedByUserId: maker.id,
        submittedAt,
      },
    });
    const hardeningDecision = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: instance.id,
        approvalStepId: step.id,
        action: 'APPROVE',
        actionByUserId: approver.id,
        comment: 'Authorized hardening approval evidence',
      },
    });
    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: {
        approvalState: 'APPROVED',
        completedAt: hardeningDecision.actionAt,
      },
    });
    const approvedAt = hardeningDecision.actionAt;
    await prisma.directCostPosting.update({
      where: { id: original.id },
      data: {
        state: 'APPROVED',
        approvedByUserId: approver.id,
        approvedAt,
        decidedAt: approvedAt,
      },
    });

    await assert.rejects(() =>
      prisma.directCostPosting.update({
        where: { id: original.id },
        data: {
          approvedByUserId: maker.id,
          approvedAt: new Date('2026-10-04T02:00:00.000Z'),
        },
      }),
    );

    await prisma.costCode.update({
      where: { id: costCode.id },
      data: { isActive: false },
    });
    await assert.rejects(() =>
      prisma.directCostPosting.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          costCodeId: costCode.id,
          postingDate: new Date('2026-10-04'),
          description: 'New normal posting cannot use inactive dimensions',
          amount: '1.00',
          currencyCode: 'SGD',
          createKey: randomUUID(),
          createPayloadHash: 'e'.repeat(64),
          createdByUserId: maker.id,
        },
      }),
    );

    await prisma.company.update({
      where: { id: company.id },
      data: { baseCurrencyCode: 'USD' },
    });
    const directCost = new DirectCostService(
      prisma,
      { assertAccess: async () => {} } as never,
      {} as never,
      { record: async () => {} } as never,
    );
    const reversal = await directCost.createReversal(
      {
        auth: {
          companyId: company.id,
          userId: maker.id,
          permissions: ['cost.direct_posting.create'],
          roleCodes: [],
        } as never,
      },
      original.id,
      {
        postingDate: new Date('2026-10-04'),
        reason:
          'Historical correction after Cost Code deactivation and base-currency change',
        reference: 'HISTORICAL-REVERSAL',
        createKey: randomUUID(),
      },
    );
    assert.equal(reversal.amount.toFixed(2), '-88.75');
    assert.equal(reversal.currencyCode, 'SGD');
    assert.equal(reversal.reversesPostingId, original.id);
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.7-E Project selector retains scoped archived Projects with any V0.7-owned history', async () => {
  let projectWhere: unknown;
  const prisma = {
    budgetRevision: {
      findMany: async () => [{ projectId: 'budget-only-project' }],
    },
    purchaseOrder: {
      findMany: async () => [{ projectId: 'po-only-project' }],
    },
    subcontractAgreement: {
      findMany: async () => [{ projectId: 'subcontract-only-project' }],
    },
    supplierInvoice: {
      findMany: async () => [{ projectId: 'supplier-invoice-only-project' }],
    },
    subcontractCertification: {
      findMany: async () => [{ projectId: 'certification-only-project' }],
    },
    payment: {
      findMany: async () => [{ projectId: 'payment-only-project' }],
    },
    clientInvoice: {
      findMany: async () => [{ projectId: 'client-invoice-only-project' }],
    },
    directCostPosting: {
      findMany: async () => [{ projectId: 'archived-project' }],
    },
    projectVariation: {
      findMany: async () => [{ projectId: 'variation-only-project' }],
    },
    clientInvoice: { findMany: async () => [] },
    costForecast: {
      findMany: async () => [
        { projectId: 'archived-project' },
        { projectId: 'forecast-only-project' },
      ],
    },
    project: {
      findMany: async (args: { where: unknown }) => {
        projectWhere = args.where;
        return [
          {
            id: 'archived-project',
            projectCode: 'ARCH-1',
            projectName: 'Archived project',
            isActive: false,
          },
          {
            id: 'forecast-only-project',
            projectCode: 'ARCH-2',
            projectName: 'Forecast-only archived project',
            isActive: false,
          },
          {
            id: 'variation-only-project',
            projectCode: 'ARCH-3',
            projectName: 'Variation-only archived project',
            isActive: false,
          },
          {
            id: 'budget-only-project',
            projectCode: 'ARCH-4',
            projectName: 'Budget-only archived project',
            isActive: false,
          },
          {
            id: 'payment-only-project',
            projectCode: 'ARCH-5',
            projectName: 'Payment-only archived project',
            isActive: false,
          },
        ];
      },
    },
  };
  const service = new DirectCostService(
    prisma as unknown as PrismaService,
    {
      scopeWhere: async () => ({ companyId: 'company' }),
    } as never,
    {} as never,
    {} as never,
  );

  const projects = await service.projects({
    companyId: 'company',
  } as never);

  assert.deepEqual(projects, [
    {
      id: 'archived-project',
      projectCode: 'ARCH-1',
      projectName: 'Archived project',
      isActive: false,
    },
    {
      id: 'forecast-only-project',
      projectCode: 'ARCH-2',
      projectName: 'Forecast-only archived project',
      isActive: false,
    },
    {
      id: 'variation-only-project',
      projectCode: 'ARCH-3',
      projectName: 'Variation-only archived project',
      isActive: false,
    },
    {
      id: 'budget-only-project',
      projectCode: 'ARCH-4',
      projectName: 'Budget-only archived project',
      isActive: false,
    },
    {
      id: 'payment-only-project',
      projectCode: 'ARCH-5',
      projectName: 'Payment-only archived project',
      isActive: false,
    },
  ]);
  assert.deepEqual(projectWhere, {
    AND: [
      { companyId: 'company' },
      {
        OR: [
          { isActive: true },
          {
            id: {
              in: [
                'budget-only-project',
                'po-only-project',
                'subcontract-only-project',
                'supplier-invoice-only-project',
                'certification-only-project',
                'payment-only-project',
                'client-invoice-only-project',
                'archived-project',
                'forecast-only-project',
                'variation-only-project',
              ],
            },
          },
        ],
      },
    ],
  });
});

test('V0.7-B terminal Direct Cost approval requires authorized retained evidence and remains immutable', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({
      data: {
        companyCode: 'DA-' + suffix,
        companyName: 'Direct Cost approval evidence company',
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'DA-C-' + suffix,
        customerName: 'Direct Cost approval evidence customer',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'da-maker-' + suffix + '@example.com',
        displayName: 'Direct Cost maker',
        passwordHash: 'x',
      },
    });
    const approverEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'DA-E-' + suffix,
        employeeName: 'Direct Cost approver employee',
      },
    });
    const approver = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: approverEmployee.id,
        email: 'da-approver-' + suffix + '@example.com',
        displayName: 'Direct Cost approver',
        passwordHash: 'x',
      },
    });
    const finalApproverEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'DA-E2-' + suffix,
        employeeName: 'Direct Cost final approver employee',
      },
    });
    const finalApprover = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: finalApproverEmployee.id,
        email: 'da-final-approver-' + suffix + '@example.com',
        displayName: 'Direct Cost final approver',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'DA-P-' + suffix,
        projectName: 'Direct Cost approval evidence project',
        customerId: customer.id,
        contractValue: '100',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          employeeId: approverEmployee.id,
          projectRole: 'Cost Control Approver',
        },
        {
          projectId: project.id,
          employeeId: finalApproverEmployee.id,
          projectRole: 'Cost Control Final Approver',
        },
      ],
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'DA-' + suffix,
        costName: 'Direct Cost approval evidence',
      },
    });
    const posting = await prisma.directCostPosting.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        costCodeId: costCode.id,
        postingDate: new Date('2026-10-03'),
        description: 'Approval evidence posting',
        amount: '25.00',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: '9'.repeat(64),
        createdByUserId: maker.id,
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'DA-APPROVER-' + suffix,
        roleName: 'Direct Cost Approver',
      },
    });
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: 'cost.direct_posting.approve' },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });
    await prisma.userRole.createMany({
      data: [
        {
          companyId: company.id,
          userId: approver.id,
          roleId: role.id,
        },
        {
          companyId: company.id,
          userId: finalApprover.id,
          roleId: role.id,
        },
      ],
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'DA-WF-' + suffix,
        entityType: 'DIRECT_COST_POSTING',
        workflowName: 'Direct Cost approval evidence workflow',
      },
    });
    const step = await prisma.approvalStep.create({
      data: {
        approvalWorkflowId: workflow.id,
        stepNo: 1,
        stepName: 'First Direct Cost approval',
        requiredApprovals: 1,
      },
    });
    const finalStep = await prisma.approvalStep.create({
      data: {
        approvalWorkflowId: workflow.id,
        stepNo: 2,
        stepName: 'Final Direct Cost approval',
        requiredApprovals: 2,
      },
    });
    await prisma.approvalStepRole.createMany({
      data: [
        { approvalStepId: step.id, roleId: role.id },
        { approvalStepId: finalStep.id, roleId: role.id },
      ],
    });
    const instance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: 'DIRECT_COST_POSTING',
        entityId: posting.id,
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });
    const submittedAt = new Date('2026-10-03T02:00:00.000Z');
    await prisma.directCostPosting.update({
      where: { id: posting.id },
      data: {
        state: 'SUBMITTED',
        approvalInstanceId: instance.id,
        submittedByUserId: maker.id,
        submittedAt,
      },
    });

    await assert.rejects(() =>
      prisma.approvalInstance.update({
        where: { id: instance.id },
        data: {
          approvalState: 'APPROVED',
          completedAt: new Date('2026-10-03T03:00:00.000Z'),
        },
      }),
    );

    await assert.rejects(() =>
      prisma.approvalAction.create({
        data: {
          approvalInstanceId: instance.id,
          approvalStepId: finalStep.id,
          action: 'APPROVE',
          actionByUserId: approver.id,
          comment: 'Future-step action must not be preinserted',
        },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalInstance.update({
        where: { id: instance.id },
        data: { currentStepNo: 2 },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.create({
        data: {
          approvalInstanceId: instance.id,
          approvalStepId: step.id,
          action: 'APPROVE',
          actionByUserId: maker.id,
          comment: 'Maker must not self-approve',
        },
      }),
    );

    // Regression for the DEC-022 concurrency finding: once the current-step
    // approval threshold is satisfied, an uncommitted REJECT insertion must
    // serialize with an attempted step advance. Without the approval-instance
    // row lock both transactions can commit, leaving old-step reject evidence
    // behind an already-advanced instance.
    const racePosting = await prisma.directCostPosting.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        costCodeId: costCode.id,
        postingDate: new Date('2026-10-03'),
        description: 'Concurrent Direct Cost approval race',
        amount: '26.00',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: '8'.repeat(64),
        createdByUserId: maker.id,
      },
    });
    const raceInstance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: 'DIRECT_COST_POSTING',
        entityId: racePosting.id,
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });
    await prisma.directCostPosting.update({
      where: { id: racePosting.id },
      data: {
        state: 'SUBMITTED',
        approvalInstanceId: raceInstance.id,
        submittedByUserId: maker.id,
        submittedAt: new Date('2026-10-03T02:30:00.000Z'),
      },
    });
    await prisma.approvalAction.create({
      data: {
        approvalInstanceId: raceInstance.id,
        approvalStepId: step.id,
        action: 'APPROVE',
        actionByUserId: approver.id,
        comment: 'Committed threshold evidence before concurrency race',
      },
    });

    let releaseConcurrentReject!: () => void;
    let signalConcurrentRejectInserted!: () => void;
    const concurrentRejectInserted = new Promise<void>((resolve) => {
      signalConcurrentRejectInserted = resolve;
    });
    const releaseConcurrentRejectPromise = new Promise<void>((resolve) => {
      releaseConcurrentReject = resolve;
    });
    const concurrentRejectTx = prisma.$transaction(async (tx) => {
      await tx.approvalAction.create({
        data: {
          approvalInstanceId: raceInstance.id,
          approvalStepId: step.id,
          action: 'REJECT',
          actionByUserId: approver.id,
          comment: 'Concurrent reject must serialize with progression',
        },
      });
      signalConcurrentRejectInserted();
      await releaseConcurrentRejectPromise;
    }, { timeout: 10_000 });

    await concurrentRejectInserted;

    let concurrentProgressionError: unknown;
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '250ms'");
        await tx.approvalInstance.update({
          where: { id: raceInstance.id },
          data: { currentStepNo: 2 },
        });
      }, { timeout: 5_000 });
    } catch (error) {
      concurrentProgressionError = error;
    }

    releaseConcurrentReject();
    await concurrentRejectTx;

    assert.ok(
      concurrentProgressionError,
      'step progression must block behind an in-flight Direct Cost approval action',
    );
    assert.match(
      String(concurrentProgressionError),
      /lock timeout|canceling statement due to lock timeout/i,
    );
    await assert.rejects(() =>
      prisma.approvalInstance.update({
        where: { id: raceInstance.id },
        data: { currentStepNo: 2 },
      }),
    );

    const firstAction = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: instance.id,
        approvalStepId: step.id,
        action: 'APPROVE',
        actionByUserId: approver.id,
        comment: 'Authorized first-step approval evidence',
      },
    });
    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: { currentStepNo: 2 },
    });
    await assert.rejects(() =>
      prisma.approvalAction.update({
        where: { id: firstAction.id },
        data: { comment: 'Submitted approval evidence is append-only' },
      }),
    );

    const firstFinalAction = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: instance.id,
        approvalStepId: finalStep.id,
        action: 'APPROVE',
        actionByUserId: approver.id,
        actionAt: new Date('2000-01-01T00:00:00.000Z'),
        comment: 'First final-step approval evidence',
      },
    });
    const action = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: instance.id,
        approvalStepId: finalStep.id,
        action: 'APPROVE',
        actionByUserId: finalApprover.id,
        actionAt: new Date('1999-01-01T00:00:00.000Z'),
        comment: 'Threshold-completing final approval evidence',
      },
    });
    assert.ok(firstFinalAction.directCostDecisionOrder);
    assert.ok(action.directCostDecisionOrder);
    assert.ok(
      action.directCostDecisionOrder > firstFinalAction.directCostDecisionOrder,
      'serialized decision order must identify the threshold-completing action',
    );
    assert.notEqual(
      action.actionAt.toISOString(),
      '1999-01-01T00:00:00.000Z',
      'database must override caller-supplied Direct Cost decision time',
    );

    const completedAt = action.actionAt;
    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: {
        approvalState: 'APPROVED',
        completedAt,
      },
    });
    await assert.rejects(() =>
      prisma.directCostPosting.update({
        where: { id: posting.id },
        data: {
          state: 'APPROVED',
          approvedByUserId: approver.id,
          approvedAt: firstFinalAction.actionAt,
          decidedAt: firstFinalAction.actionAt,
        },
      }),
    );
    await prisma.directCostPosting.update({
      where: { id: posting.id },
      data: {
        state: 'APPROVED',
        approvedByUserId: finalApprover.id,
        approvedAt: completedAt,
        decidedAt: completedAt,
      },
    });

    await assert.rejects(() =>
      prisma.approvalInstance.update({
        where: { id: instance.id },
        data: { currentStepNo: 2 },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalInstance.delete({
        where: { id: instance.id },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.update({
        where: { id: action.id },
        data: { comment: 'Forged approval evidence' },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.delete({
        where: { id: action.id },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.create({
        data: {
          approvalInstanceId: instance.id,
          approvalStepId: step.id,
          action: 'REJECT',
          actionByUserId: approver.id,
          comment: 'Late forged action',
        },
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.7-D active Project Variation value excludes approved compensating reversals', () => {
  assert.equal(
    activeProjectVariationValue([
      {
        id: 'positive',
        valueDelta: new Prisma.Decimal('100.00'),
        reversesVariationId: null,
      },
      {
        id: 'negative',
        valueDelta: new Prisma.Decimal('-20.00'),
        reversesVariationId: null,
      },
      {
        id: 'reverse-positive',
        valueDelta: new Prisma.Decimal('-100.00'),
        reversesVariationId: 'positive',
      },
    ]).toFixed(2),
    '-20.00',
  );
});

test('V0.7-D commercial measures keep revenue, cash and Project-level profit separate', async () => {
  const prisma = {
    project: {
      findFirstOrThrow: async () => ({
        id: 'project',
        projectCode: 'P-1',
        projectName: 'Project',
        contractValue: new Prisma.Decimal('1000.00'),
      }),
    },
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    wbsElement: { findMany: async () => [] },
    costCode: { findMany: async () => [] },
    budgetRevision: { findMany: async () => [] },
    purchaseOrder: { findMany: async () => [] },
    subcontractAgreement: { findMany: async () => [] },
    supplierInvoice: { findMany: async () => [] },
    subcontractCertification: { findMany: async () => [] },
    payment: {
      findMany: async (args: { where?: { paymentDirection?: string } }) =>
        args.where?.paymentDirection === 'INBOUND'
          ? [
              {
                id: 'receipt',
                paymentNumber: 'RCPT-1',
                paymentDirection: 'INBOUND',
                paymentDate: new Date('2026-10-04'),
                amount: new Prisma.Decimal('500.00'),
                currencyCode: 'SGD',
              },
            ]
          : [],
    },
    directCostPosting: { findMany: async () => [] },
    projectVariation: {
      findMany: async () => [
        {
          id: 'pv-1',
          variationNumber: 'PV-1',
          description: 'Client addition',
          reason: null,
          valueDelta: new Prisma.Decimal('100.00'),
          currencyCode: 'SGD',
          approvedAt: new Date('2026-10-04T01:00:00Z'),
          reversesVariationId: null,
          reversalReason: null,
        },
      ],
    },
    clientInvoice: {
      findMany: async () => [
        {
          id: 'ci-1',
          clientInvoiceNumber: 'CI-1',
          invoiceDate: new Date('2026-10-04'),
          totalAmount: new Prisma.Decimal('700.00'),
          currencyCode: 'SGD',
          approvedAt: new Date('2026-10-04T02:00:00Z'),
        },
      ],
    },
    costForecast: { findFirst: async () => null },
  };
  const service = new CostControlService(
    prisma as unknown as PrismaService,
    { assertAccess: async () => {} } as never,
  );
  const result = await service.projectCostControl(
    {
      companyId: 'company',
      permissions: [
        'cost.control.view',
        'cost.variation.view',
        'finance.client_invoice.view',
        'finance.payment.view',
      ],
    } as never,
    'project',
  );
  assert.equal(result.totals.commercial.originalContractValue.toFixed(2), '1000.00');
  assert.equal(result.totals.commercial.approvedVariationValue.toFixed(2), '100.00');
  assert.equal(result.totals.commercial.revisedContractValue.toFixed(2), '1100.00');
  assert.equal(result.totals.commercial.actualRevenue.toFixed(2), '700.00');
  assert.equal(result.totals.commercial.cashReceived.toFixed(2), '500.00');
  assert.equal(result.totals.commercial.forecastRevenue.toFixed(2), '1100.00');
  assert.equal(result.totals.commercial.actualProfit?.toFixed(2), '700.00');
  assert.equal(result.totals.commercial.forecastProfit?.toFixed(2), '1100.00');
  assert.equal(result.boundaries.revenueProfitProjectLevelOnly, true);
});

test('V0.7-D refuses to fabricate WBS or Cost Code profitability', async () => {
  const prisma = {
    project: {
      findFirstOrThrow: async () => ({
        id: 'project',
        projectCode: 'P-1',
        projectName: 'Project',
        contractValue: new Prisma.Decimal('1000.00'),
      }),
    },
    company: {
      findUniqueOrThrow: async () => ({ baseCurrencyCode: 'SGD' }),
    },
    wbsElement: { findMany: async () => [] },
    costCode: {
      findMany: async () => [
        { id: 'cc-1', costCode: 'CC-1', costName: 'Cost Code' },
      ],
    },
    budgetRevision: { findMany: async () => [] },
    purchaseOrder: { findMany: async () => [] },
    subcontractAgreement: { findMany: async () => [] },
    supplierInvoice: { findMany: async () => [] },
    subcontractCertification: { findMany: async () => [] },
    payment: { findMany: async () => [] },
    directCostPosting: { findMany: async () => [] },
    projectVariation: { findMany: async () => [] },
    clientInvoice: { findMany: async () => [] },
    costForecast: { findFirst: async () => null },
  };
  const service = new CostControlService(
    prisma as unknown as PrismaService,
    { assertAccess: async () => {} } as never,
  );
  const result = await service.projectCostControl(
    { companyId: 'company', permissions: ['cost.control.view'] } as never,
    'project',
    { costCodeId: 'cc-1' },
  );
  assert.equal(result.totals.commercial.allocationLevel, 'PROJECT');
  assert.equal(result.totals.commercial.actualProfit, null);
  assert.equal(result.totals.commercial.forecastProfit, null);
  assert.equal(result.totals.commercial.profitAvailableAtCurrentFilter, false);
});


test('V0.7-D Project Variation database guards approval authority and terminal history', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID();
    const company = await prisma.company.create({
      data: {
        companyCode: 'PVH-' + suffix,
        companyName: 'Project Variation hardening company',
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'PVH-C-' + suffix,
        customerName: 'Project Variation hardening customer',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'pvh-maker-' + suffix + '@example.com',
        displayName: 'Project Variation maker',
        passwordHash: 'x',
      },
    });
    const approverEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PVH-E-' + suffix,
        employeeName: 'Project Variation approver employee',
      },
    });
    const approver = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: approverEmployee.id,
        email: 'pvh-approver-' + suffix + '@example.com',
        displayName: 'Project Variation approver',
        passwordHash: 'x',
      },
    });
    const unauthorized = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'pvh-unauthorized-' + suffix + '@example.com',
        displayName: 'Project Variation unauthorized actor',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'PVH-P-' + suffix,
        projectName: 'Project Variation hardening project',
        customerId: customer.id,
        contractValue: '1000.00',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: approverEmployee.id,
        projectRole: 'Commercial Approver',
      },
    });

    const variation = await prisma.projectVariation.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        variationNumber: 'PV-' + suffix,
        description: 'Hardening variation',
        valueDelta: '125.50',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: 'a'.repeat(64),
        createdByUserId: maker.id,
      },
    });

    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: variation.id },
        data: { state: 'SUBMITTED' },
      }),
    );

    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PVH-WF-' + suffix,
        entityType: 'PROJECT_VARIATION',
        workflowName: 'Project Variation hardening workflow',
      },
    });
    const step = await prisma.approvalStep.create({
      data: {
        approvalWorkflowId: workflow.id,
        stepNo: 1,
        stepName: 'Approve Project Variation',
        requiredApprovals: 1,
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PVH-APPROVER-' + suffix,
        roleName: 'Project Variation Approver',
      },
    });
    const approvePermission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: 'cost.variation.approve' },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: approvePermission.id },
    });
    await prisma.userRole.create({
      data: {
        companyId: company.id,
        userId: approver.id,
        roleId: role.id,
      },
    });
    await prisma.approvalStepRole.create({
      data: { approvalStepId: step.id, roleId: role.id },
    });
    const instance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: 'PROJECT_VARIATION',
        entityId: variation.id,
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });
    const submittedAt = new Date('2026-10-04T01:00:00.000Z');
    await prisma.projectVariation.update({
      where: { id: variation.id },
      data: {
        state: 'SUBMITTED',
        approvalInstanceId: instance.id,
        submittedByUserId: maker.id,
        submittedAt,
      },
    });

    await assert.rejects(() =>
      prisma.approvalInstance.update({
        where: { id: instance.id },
        data: {
          approvalState: 'APPROVED',
          completedAt: new Date('2026-10-04T01:01:00.000Z'),
        },
      }),
    );

    await assert.rejects(() =>
      prisma.approvalAction.create({
        data: {
          approvalInstanceId: instance.id,
          approvalStepId: step.id,
          action: 'APPROVE',
          actionByUserId: maker.id,
        },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.create({
        data: {
          approvalInstanceId: instance.id,
          approvalStepId: step.id,
          action: 'APPROVE',
          actionByUserId: unauthorized.id,
        },
      }),
    );

    const decision = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: instance.id,
        approvalStepId: step.id,
        action: 'APPROVE',
        actionByUserId: approver.id,
        comment: 'Authorized commercial approval',
      },
    });
    assert.ok(decision.projectVariationDecisionOrder);

    await prisma.approvalInstance.update({
      where: { id: instance.id },
      data: {
        approvalState: 'APPROVED',
        completedAt: decision.actionAt,
      },
    });

    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: variation.id },
        data: { state: 'APPROVED' },
      }),
    );
    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: variation.id },
        data: {
          state: 'APPROVED',
          approvedByUserId: maker.id,
          approvedAt: new Date(decision.actionAt.getTime() + 1_000),
          decidedAt: new Date(decision.actionAt.getTime() + 1_000),
        },
      }),
    );

    await prisma.projectVariation.update({
      where: { id: variation.id },
      data: {
        state: 'APPROVED',
        approvedByUserId: approver.id,
        approvedAt: decision.actionAt,
        decidedAt: decision.actionAt,
      },
    });

    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: variation.id },
        data: { description: 'Forbidden approved edit' },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.update({
        where: { id: decision.id },
        data: { comment: 'Forbidden history rewrite' },
      }),
    );
    await assert.rejects(() =>
      prisma.approvalAction.delete({ where: { id: decision.id } }),
    );

    const rejectedVariation = await prisma.projectVariation.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        variationNumber: 'PV-REJECT-' + suffix,
        description: 'Rejected evidence binding variation',
        valueDelta: '-10.00',
        currencyCode: 'SGD',
        createKey: randomUUID(),
        createPayloadHash: 'd'.repeat(64),
        createdByUserId: maker.id,
      },
    });
    const rejectedInstance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: 'PROJECT_VARIATION',
        entityId: rejectedVariation.id,
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });
    await prisma.projectVariation.update({
      where: { id: rejectedVariation.id },
      data: {
        state: 'SUBMITTED',
        approvalInstanceId: rejectedInstance.id,
        submittedByUserId: maker.id,
        submittedAt: new Date('2026-10-04T01:10:00.000Z'),
      },
    });
    const rejectionDecision = await prisma.approvalAction.create({
      data: {
        approvalInstanceId: rejectedInstance.id,
        approvalStepId: step.id,
        action: 'REJECT',
        actionByUserId: approver.id,
        comment: 'Retain exact rejection reason',
      },
    });
    await prisma.approvalInstance.update({
      where: { id: rejectedInstance.id },
      data: {
        approvalState: 'REJECTED',
        completedAt: rejectionDecision.actionAt,
      },
    });
    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: rejectedVariation.id },
        data: {
          state: 'REJECTED',
          rejectedByUserId: maker.id,
          rejectedAt: rejectionDecision.actionAt,
          decidedAt: rejectionDecision.actionAt,
          rejectionReason: 'Forged rejection reason',
        },
      }),
    );
    await prisma.projectVariation.update({
      where: { id: rejectedVariation.id },
      data: {
        state: 'REJECTED',
        rejectedByUserId: approver.id,
        rejectedAt: rejectionDecision.actionAt,
        decidedAt: rejectionDecision.actionAt,
        rejectionReason: rejectionDecision.comment,
      },
    });
    await assert.rejects(() =>
      prisma.projectVariation.update({
        where: { id: rejectedVariation.id },
        data: { rejectionReason: 'Forbidden rejected-history rewrite' },
      }),
    );

    const duplicateNumber = 'PV-DUP-' + suffix;
    const outcomes = await Promise.allSettled([
      prisma.projectVariation.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          variationNumber: duplicateNumber,
          description: 'Concurrent A',
          valueDelta: '1.00',
          currencyCode: 'SGD',
          createKey: randomUUID(),
          createPayloadHash: 'b'.repeat(64),
          createdByUserId: maker.id,
        },
      }),
      prisma.projectVariation.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          variationNumber: duplicateNumber,
          description: 'Concurrent B',
          valueDelta: '2.00',
          currencyCode: 'SGD',
          createKey: randomUUID(),
          createPayloadHash: 'c'.repeat(64),
          createdByUserId: maker.id,
        },
      }),
    ]);
    assert.equal(
      outcomes.filter((outcome) => outcome.status === 'fulfilled').length,
      1,
    );
    assert.equal(
      await prisma.projectVariation.count({
        where: {
          companyId: company.id,
          projectId: project.id,
          variationNumber: duplicateNumber,
        },
      }),
      1,
    );
  } finally {
    await prisma.$disconnect();
  }
});


test('V0.7-D serialized Project Variation writes retry P2034 and fail as controlled conflicts after exhaustion', async () => {
  const operations = [
    {
      name: 'update',
      invoke: (service: ProjectVariationService, auth: never) =>
        service.update({ auth }, 'variation', { description: 'retry' }),
    },
    {
      name: 'submit',
      invoke: (service: ProjectVariationService, auth: never) =>
        service.submit({ auth }, 'variation', 'PV-WF', 'submit-key'),
    },
    {
      name: 'approve',
      invoke: (service: ProjectVariationService, auth: never) =>
        service.approve({ auth }, 'variation', 'approve-key', 'approve'),
    },
    {
      name: 'reject',
      invoke: (service: ProjectVariationService, auth: never) =>
        service.reject({ auth }, 'variation', 'reject-key', 'reject'),
    },
    {
      name: 'reversal',
      invoke: (service: ProjectVariationService, auth: never) =>
        service.createReversal(
          { auth },
          'variation',
          {
            variationNumber: 'PV-REV',
            reason: 'retry reversal',
            createKey: 'reversal-key',
          },
        ),
    },
  ];

  for (const operation of operations) {
    let attempts = 0;
    const prisma = {
      projectVariation: {
        findFirst: async () => ({
          id: 'variation',
          companyId: 'company',
          projectId: 'project',
        }),
      },
      $transaction: async () => {
        attempts += 1;
        throw new Prisma.PrismaClientKnownRequestError(
          'Synthetic Project Variation serialized write conflict',
          {
            code: 'P2034',
            clientVersion: 'test',
          },
        );
      },
    };
    const service = new ProjectVariationService(
      prisma as unknown as PrismaService,
      { assertAccess: async () => {} } as never,
      {} as never,
      {} as never,
    );
    const auth = {
      companyId: 'company',
      userId: 'user',
      permissions: ['cost.variation.view'],
    } as never;

    await assert.rejects(
      () => operation.invoke(service, auth),
      (error: unknown) => {
        if (!(error instanceof ConflictException)) return false;
        return (
          (error.getResponse() as { code?: string }).code ===
          'PROJECT_VARIATION_WRITE_CONCURRENCY_RETRY_EXHAUSTED'
        );
      },
    );
    assert.equal(
      attempts,
      5,
      operation.name + ' should retry the full serialized transaction five times',
    );
  }
});
