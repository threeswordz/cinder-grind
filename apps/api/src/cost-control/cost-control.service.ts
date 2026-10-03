import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

export type CostControlFilters = {
  wbsId?: string;
  costCodeId?: string;
};

type BudgetSelectionCandidate = {
  revisionNo: number;
  approvalInstance: { completedAt: Date | null } | null;
};

type PurchaseOrderSelectionCandidate = {
  poNumber: string;
  revisionNo: number;
  cancelledAt: Date | null;
};

type DimensionContext = {
  wbsRows: Array<{
    id: string;
    parentId: string | null;
    wbsCode: string;
    wbsName: string;
  }>;
  costCodes: Array<{
    id: string;
    costCode: string;
    costName: string;
  }>;
  allowedWbsIds: Set<string> | null;
  costCodeId: string | null;
  selectedWbs:
    | { id: string; wbsCode: string; wbsName: string }
    | null;
  selectedCostCode:
    | { id: string; costCode: string; costName: string }
    | null;
};

type MeasureBucket = {
  originalBudget: Prisma.Decimal;
  revisedBudget: Prisma.Decimal;
  procurementCommitted: Prisma.Decimal;
  subcontractCommitted: Prisma.Decimal;
  supplierActual: Prisma.Decimal;
  subcontractActual: Prisma.Decimal;
  supplierPaid: Prisma.Decimal;
  subcontractPaid: Prisma.Decimal;
};

type MeasureKey = keyof MeasureBucket;

type DimensionBucket = MeasureBucket & {
  wbsId: string | null;
  costCodeId: string | null;
};

type EvidenceRecord = Record<string, unknown>;

export function sumCostControlDecimals(
  values: Prisma.Decimal[],
): Prisma.Decimal {
  return values.reduce(
    (sum, value) => sum.plus(value),
    new Prisma.Decimal(0),
  );
}

export function selectOriginalAndCurrentBudget<
  T extends BudgetSelectionCandidate,
>(revisions: T[]): { original: T | null; current: T | null } {
  const original =
    [...revisions]
      .filter((revision) => revision.approvalInstance?.completedAt)
      .sort((left, right) => {
        const leftAt =
          left.approvalInstance?.completedAt?.getTime() ??
          Number.MAX_SAFE_INTEGER;
        const rightAt =
          right.approvalInstance?.completedAt?.getTime() ??
          Number.MAX_SAFE_INTEGER;
        if (leftAt !== rightAt) return leftAt - rightAt;
        return left.revisionNo - right.revisionNo;
      })[0] ?? null;

  const current =
    [...revisions].sort(
      (left, right) => right.revisionNo - left.revisionNo,
    )[0] ?? null;

  return { original, current };
}

export function splitSubcontractCommitment(
  ceiling: Prisma.Decimal,
  workOrders: Array<{ amount: Prisma.Decimal }>,
) {
  const allocatedAmount = sumCostControlDecimals(
    workOrders.map((workOrder) => workOrder.amount),
  );
  if (ceiling.isNegative() || allocatedAmount.greaterThan(ceiling)) {
    throw new UnprocessableEntityException({
      code: 'COST_CONTROL_SUBCONTRACT_ALLOCATION_INVALID',
      detail:
        'Approved Work Order allocation cannot exceed the current approved Subcontract Agreement commitment ceiling.',
    });
  }
  return {
    allocatedAmount,
    unallocatedAmount: ceiling.minus(allocatedAmount),
  };
}

export function selectCurrentApprovedPurchaseOrders<
  T extends PurchaseOrderSelectionCandidate,
>(rows: T[]): T[] {
  const latestApproved = new Map<string, T>();
  for (const row of rows) {
    const current = latestApproved.get(row.poNumber);
    if (!current || row.revisionNo > current.revisionNo) {
      latestApproved.set(row.poNumber, row);
    }
  }
  return [...latestApproved.values()].filter(
    (row) => row.cancelledAt === null,
  );
}

@Injectable()
export class CostControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async projectCostControl(
    auth: AuthenticatedUserContext,
    projectId: string,
    filters: CostControlFilters = {},
  ) {
    await this.access.assertAccess(auth, projectId);

    const [project, company, wbsRows, costCodes] = await Promise.all([
      this.prisma.project.findFirstOrThrow({
        where: { id: projectId, companyId: auth.companyId },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
        },
      }),
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.wbsElement.findMany({
        where: { projectId },
        select: {
          id: true,
          parentId: true,
          wbsCode: true,
          wbsName: true,
        },
        orderBy: [{ wbsCode: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.costCode.findMany({
        where: { companyId: auth.companyId },
        select: {
          id: true,
          costCode: true,
          costName: true,
        },
        orderBy: [{ costCode: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const dimensions = this.dimensionContext(
      filters,
      wbsRows,
      costCodes,
    );

    const [
      budgetRevisions,
      approvedPurchaseOrders,
      agreements,
      supplierInvoices,
      certifications,
      outboundPayments,
    ] = await Promise.all([
      this.prisma.budgetRevision.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          approvalInstance: {
            is: { approvalState: 'APPROVED' },
          },
        },
        select: {
          id: true,
          revisionNo: true,
          revisionNumber: true,
          approvalInstance: {
            select: { completedAt: true },
          },
          lines: {
            select: {
              id: true,
              amount: true,
              wbsId: true,
              costCodeId: true,
            },
          },
        },
      }),
      this.prisma.purchaseOrder.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          approvalInstance: {
            is: { approvalState: 'APPROVED' },
          },
        },
        select: {
          id: true,
          poNumber: true,
          revisionNo: true,
          cancelledAt: true,
          lines: {
            select: {
              id: true,
              amount: true,
              wbsId: true,
              costCodeId: true,
            },
          },
        },
      }),
      this.prisma.subcontractAgreement.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          approvalState: 'APPROVED',
          cancelledAt: null,
        },
        select: {
          id: true,
          agreementNumber: true,
          originalValue: true,
          currencyCode: true,
          variations: {
            where: {
              state: 'APPROVED',
              reversedAt: null,
            },
            select: {
              id: true,
              variationNumber: true,
              valueDelta: true,
            },
          },
          workOrders: {
            where: { approvalState: 'APPROVED' },
            select: {
              id: true,
              workOrderNumber: true,
              amount: true,
              wbsElementId: true,
              costCodeId: true,
            },
          },
        },
      }),
      this.prisma.supplierInvoice.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          state: 'APPROVED',
        },
        select: {
          id: true,
          supplierInvoiceNumber: true,
          invoiceDate: true,
          currencyCode: true,
          items: {
            select: {
              id: true,
              amount: true,
              wbsId: true,
              costCodeId: true,
            },
          },
        },
      }),
      this.prisma.subcontractCertification.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          state: 'APPROVED',
          reversedAt: null,
        },
        select: {
          id: true,
          certificationNumber: true,
          approvedAt: true,
          certifiedGross: true,
          currencyCode: true,
        },
      }),
      this.prisma.payment.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          state: 'APPROVED',
          cancelledAt: null,
          paymentDirection: 'OUTBOUND',
        },
        select: {
          id: true,
          paymentNumber: true,
          paymentDate: true,
          currencyCode: true,
          supplierAllocations: {
            select: {
              id: true,
              allocatedAmount: true,
              supplierInvoiceId: true,
            },
          },
          subcontractAllocations: {
            select: {
              id: true,
              allocatedAmount: true,
              subcontractCertificationId: true,
            },
          },
        },
      }),
    ]);

    const dimensionMap = new Map<string, DimensionBucket>();
    const budgetSelection =
      selectOriginalAndCurrentBudget(budgetRevisions);

    const originalBudgetRecords: EvidenceRecord[] = [];
    const revisedBudgetRecords: EvidenceRecord[] = [];
    const procurementRecords: EvidenceRecord[] = [];
    const subcontractCommitmentRecords: EvidenceRecord[] = [];
    const supplierActualRecords: EvidenceRecord[] = [];
    const subcontractActualRecords: EvidenceRecord[] = [];
    const paidRecords: EvidenceRecord[] = [];

    const originalBudget = this.revisionContribution(
      budgetSelection.original,
      'originalBudget',
      dimensions,
      dimensionMap,
      originalBudgetRecords,
    );
    const revisedBudget = this.revisionContribution(
      budgetSelection.current,
      'revisedBudget',
      dimensions,
      dimensionMap,
      revisedBudgetRecords,
    );

    const currentPurchaseOrders =
      selectCurrentApprovedPurchaseOrders(approvedPurchaseOrders);
    let procurementCommitted = new Prisma.Decimal(0);
    for (const order of currentPurchaseOrders) {
      const matchingLines = order.lines.filter((line) =>
        this.matchesDimension(
          line.wbsId,
          line.costCodeId,
          dimensions,
        ),
      );
      if (matchingLines.length === 0) continue;
      const amount = sumCostControlDecimals(
        matchingLines.map((line) => line.amount),
      );
      procurementCommitted = procurementCommitted.plus(amount);
      for (const line of matchingLines) {
        this.addDimension(
          dimensionMap,
          line.wbsId,
          line.costCodeId,
          'procurementCommitted',
          line.amount,
        );
      }
      procurementRecords.push({
        id: order.id,
        number: order.poNumber,
        revisionNo: order.revisionNo,
        amount,
      });
    }

    let subcontractCommitted = new Prisma.Decimal(0);
    for (const agreement of agreements) {
      this.assertBaseCurrency(
        'Subcontract commitment',
        agreement.currencyCode,
        company.baseCurrencyCode,
      );
      const variationValue = sumCostControlDecimals(
        agreement.variations.map((variation) => variation.valueDelta),
      );
      const ceiling = agreement.originalValue.plus(variationValue);
      const allocation = splitSubcontractCommitment(
        ceiling,
        agreement.workOrders,
      );
      const matchingWorkOrders = agreement.workOrders.filter(
        (workOrder) =>
          this.matchesDimension(
            workOrder.wbsElementId,
            workOrder.costCodeId,
            dimensions,
          ),
      );
      const allocatedAmount = sumCostControlDecimals(
        matchingWorkOrders.map((workOrder) => workOrder.amount),
      );
      const includeUnallocated =
        this.matchesDimension(null, null, dimensions);
      const amount = includeUnallocated
        ? allocatedAmount.plus(allocation.unallocatedAmount)
        : allocatedAmount;
      if (amount.equals(0)) continue;

      subcontractCommitted = subcontractCommitted.plus(amount);
      for (const workOrder of matchingWorkOrders) {
        this.addDimension(
          dimensionMap,
          workOrder.wbsElementId,
          workOrder.costCodeId,
          'subcontractCommitted',
          workOrder.amount,
        );
      }
      if (
        includeUnallocated &&
        !allocation.unallocatedAmount.equals(0)
      ) {
        this.addDimension(
          dimensionMap,
          null,
          null,
          'subcontractCommitted',
          allocation.unallocatedAmount,
        );
      }
      subcontractCommitmentRecords.push({
        id: agreement.id,
        number: agreement.agreementNumber,
        originalValue: agreement.originalValue,
        approvedVariationValue: variationValue,
        currentCeiling: ceiling,
        approvedWorkOrderAllocation: allocation.allocatedAmount,
        unallocatedCommitment: allocation.unallocatedAmount,
        amount,
        workOrders: matchingWorkOrders.map((workOrder) => ({
          id: workOrder.id,
          number: workOrder.workOrderNumber,
          amount: workOrder.amount,
          wbsId: workOrder.wbsElementId,
          costCodeId: workOrder.costCodeId,
        })),
      });
    }

    let supplierActual = new Prisma.Decimal(0);
    for (const invoice of supplierInvoices) {
      const matchingItems = invoice.items.filter((item) =>
        this.matchesDimension(
          item.wbsId,
          item.costCodeId,
          dimensions,
        ),
      );
      if (matchingItems.length === 0) continue;
      this.assertBaseCurrency(
        'Supplier Actual Cost',
        invoice.currencyCode,
        company.baseCurrencyCode,
      );
      const amount = sumCostControlDecimals(
        matchingItems.map((item) => item.amount),
      );
      supplierActual = supplierActual.plus(amount);
      for (const item of matchingItems) {
        this.addDimension(
          dimensionMap,
          item.wbsId,
          item.costCodeId,
          'supplierActual',
          item.amount,
        );
      }
      supplierActualRecords.push({
        id: invoice.id,
        number: invoice.supplierInvoiceNumber,
        recognitionDate: invoice.invoiceDate,
        amount,
      });
    }

    let subcontractActual = new Prisma.Decimal(0);
    if (this.matchesDimension(null, null, dimensions)) {
      for (const certification of certifications) {
        this.assertBaseCurrency(
          'Subcontract Actual Cost',
          certification.currencyCode,
          company.baseCurrencyCode,
        );
        subcontractActual = subcontractActual.plus(
          certification.certifiedGross,
        );
        this.addDimension(
          dimensionMap,
          null,
          null,
          'subcontractActual',
          certification.certifiedGross,
        );
        subcontractActualRecords.push({
          id: certification.id,
          number: certification.certificationNumber,
          recognitionDate: certification.approvedAt,
          amount: certification.certifiedGross,
        });
      }
    }

    let supplierPaid = new Prisma.Decimal(0);
    let subcontractPaid = new Prisma.Decimal(0);
    if (this.matchesDimension(null, null, dimensions)) {
      for (const payment of outboundPayments) {
        const supplierAmount = sumCostControlDecimals(
          payment.supplierAllocations.map(
            (allocation) => allocation.allocatedAmount,
          ),
        );
        const subcontractAmount = sumCostControlDecimals(
          payment.subcontractAllocations.map(
            (allocation) => allocation.allocatedAmount,
          ),
        );
        const eligibleAmount = supplierAmount.plus(subcontractAmount);
        if (eligibleAmount.equals(0)) continue;
        this.assertBaseCurrency(
          'Paid Cost',
          payment.currencyCode,
          company.baseCurrencyCode,
        );
        supplierPaid = supplierPaid.plus(supplierAmount);
        subcontractPaid = subcontractPaid.plus(subcontractAmount);
        this.addDimension(
          dimensionMap,
          null,
          null,
          'supplierPaid',
          supplierAmount,
        );
        this.addDimension(
          dimensionMap,
          null,
          null,
          'subcontractPaid',
          subcontractAmount,
        );
        paidRecords.push({
          id: payment.id,
          number: payment.paymentNumber,
          recognitionDate: payment.paymentDate,
          supplierPaid: supplierAmount,
          subcontractPaid: subcontractAmount,
          amount: eligibleAmount,
        });
      }
    }

    const committedTotal =
      procurementCommitted.plus(subcontractCommitted);
    const actualTotal = supplierActual.plus(subcontractActual);
    const paidTotal = supplierPaid.plus(subcontractPaid);

    const wbsById = new Map(
      dimensions.wbsRows.map((row) => [row.id, row]),
    );
    const costCodeById = new Map(
      dimensions.costCodes.map((row) => [row.id, row]),
    );

    const dimensionBreakdown = [...dimensionMap.values()]
      .map((bucket) => {
        const wbs = bucket.wbsId
          ? wbsById.get(bucket.wbsId) ?? null
          : null;
        const costCode = bucket.costCodeId
          ? costCodeById.get(bucket.costCodeId) ?? null
          : null;
        return {
          wbs: wbs
            ? {
                id: wbs.id,
                wbsCode: wbs.wbsCode,
                wbsName: wbs.wbsName,
              }
            : null,
          costCode: costCode
            ? {
                id: costCode.id,
                costCode: costCode.costCode,
                costName: costCode.costName,
              }
            : null,
          allocationState:
            bucket.wbsId && bucket.costCodeId
              ? 'FULLY_ALLOCATED'
              : bucket.wbsId || bucket.costCodeId
                ? 'PARTIALLY_ALLOCATED'
                : 'UNALLOCATED',
          originalBudget: bucket.originalBudget,
          revisedBudget: bucket.revisedBudget,
          committedCost: {
            procurement: bucket.procurementCommitted,
            subcontract: bucket.subcontractCommitted,
            total: bucket.procurementCommitted.plus(
              bucket.subcontractCommitted,
            ),
          },
          actualCost: {
            supplier: bucket.supplierActual,
            subcontract: bucket.subcontractActual,
            total: bucket.supplierActual.plus(
              bucket.subcontractActual,
            ),
          },
          paidCost: {
            supplier: bucket.supplierPaid,
            subcontract: bucket.subcontractPaid,
            total: bucket.supplierPaid.plus(
              bucket.subcontractPaid,
            ),
          },
        };
      })
      .sort((left, right) => {
        const leftWbs = left.wbs?.wbsCode ?? '~~~~';
        const rightWbs = right.wbs?.wbsCode ?? '~~~~';
        if (leftWbs !== rightWbs) {
          return leftWbs.localeCompare(rightWbs);
        }
        const leftCost = left.costCode?.costCode ?? '~~~~';
        const rightCost = right.costCode?.costCode ?? '~~~~';
        return leftCost.localeCompare(rightCost);
      });

    return {
      project,
      baseCurrencyCode: company.baseCurrencyCode,
      filters: {
        wbs: dimensions.selectedWbs,
        costCode: dimensions.selectedCostCode,
        wbsIncludesDescendants: dimensions.selectedWbs !== null,
      },
      totals: {
        originalBudget,
        revisedBudget,
        committedCost: {
          procurement: procurementCommitted,
          subcontract: subcontractCommitted,
          total: committedTotal,
        },
        actualCost: {
          supplier: supplierActual,
          subcontract: subcontractActual,
          total: actualTotal,
        },
        paidCost: {
          supplier: supplierPaid,
          subcontract: subcontractPaid,
          total: paidTotal,
        },
      },
      dimensionBreakdown,
      sourceEvidence: {
        originalBudget: this.evidence(
          originalBudget,
          originalBudgetRecords,
          this.hasPermissions(auth, 'budget.revision.view'),
          'V0.3 Budget Revision',
          'First final-approved Budget Revision',
        ),
        revisedBudget: this.evidence(
          revisedBudget,
          revisedBudgetRecords,
          this.hasPermissions(auth, 'budget.revision.view'),
          'V0.3 Budget Revision',
          'Highest revisionNo final-approved Budget Revision',
        ),
        procurementCommitted: this.evidence(
          procurementCommitted,
          procurementRecords,
          this.hasPermissions(auth, 'procurement.po.view'),
          'V0.3 Purchase Order',
          'Latest final-approved revision per PO number unless that approved revision is cancelled',
        ),
        subcontractCommitted: this.evidence(
          subcontractCommitted,
          subcontractCommitmentRecords,
          this.hasPermissions(
            auth,
            'subcontracts.agreement.view',
            'subcontracts.variation.view',
            'subcontracts.work_order.view',
          ),
          'V0.5 Subcontract Agreement / Variation / Work Order',
          'Approved active Agreement original value plus approved non-reversed Variation deltas define the commitment ceiling; approved Work Orders allocate within that ceiling and never add a second commitment',
        ),
        supplierActual: this.evidence(
          supplierActual,
          supplierActualRecords,
          this.hasPermissions(
            auth,
            'finance.supplier_invoice.view',
          ),
          'V0.6 Supplier Invoice',
          'Final-approved Supplier Invoice item amount recognized on invoice date',
        ),
        subcontractActual: this.evidence(
          subcontractActual,
          subcontractActualRecords,
          this.hasPermissions(
            auth,
            'subcontracts.certification.view',
          ),
          'V0.5 Subcontract Certification',
          'Approved non-reversed certifiedGross recognized on certification approval date',
        ),
        paidCost: this.evidence(
          paidTotal,
          paidRecords,
          this.hasPermissions(auth, 'finance.payment.view'),
          'V0.6 Payment allocations',
          'Approved non-cancelled OUTBOUND allocations to Supplier Invoices or Subcontract Certifications on Payment date',
        ),
      },
      boundaries: {
        committedActualPaidSeparate: true,
        inventoryCreatesActualCost: false,
        sourceModulesRemainCanonical: true,
        syntheticDimensionalProration: false,
        financialAuthority: 'POSTGRESQL_PRISMA_DECIMAL',
        directCostPostingImplemented: false,
        forecastImplemented: false,
        projectVariationRevenueProfitImplemented: false,
      },
    };
  }

  private revisionContribution(
    revision:
      | {
          id: string;
          revisionNo: number;
          revisionNumber: string;
          lines: Array<{
            id: string;
            amount: Prisma.Decimal;
            wbsId: string | null;
            costCodeId: string | null;
          }>;
        }
      | null,
    measure: 'originalBudget' | 'revisedBudget',
    dimensions: DimensionContext,
    dimensionMap: Map<string, DimensionBucket>,
    records: EvidenceRecord[],
  ): Prisma.Decimal {
    if (!revision) return new Prisma.Decimal(0);
    const matchingLines = revision.lines.filter((line) =>
      this.matchesDimension(
        line.wbsId,
        line.costCodeId,
        dimensions,
      ),
    );
    if (matchingLines.length === 0) {
      return new Prisma.Decimal(0);
    }
    const amount = sumCostControlDecimals(
      matchingLines.map((line) => line.amount),
    );
    for (const line of matchingLines) {
      this.addDimension(
        dimensionMap,
        line.wbsId,
        line.costCodeId,
        measure,
        line.amount,
      );
    }
    records.push({
      id: revision.id,
      number: revision.revisionNumber,
      revisionNo: revision.revisionNo,
      amount,
    });
    return amount;
  }

  private dimensionContext(
    filters: CostControlFilters,
    wbsRows: DimensionContext['wbsRows'],
    costCodes: DimensionContext['costCodes'],
  ): DimensionContext {
    let selectedWbs: DimensionContext['selectedWbs'] = null;
    let allowedWbsIds: Set<string> | null = null;
    if (filters.wbsId) {
      const target = wbsRows.find((row) => row.id === filters.wbsId);
      if (!target) {
        throw new UnprocessableEntityException({
          code: 'COST_CONTROL_WBS_INVALID',
          detail:
            'Cost Control WBS filter must belong to the requested Project.',
        });
      }
      selectedWbs = {
        id: target.id,
        wbsCode: target.wbsCode,
        wbsName: target.wbsName,
      };
      allowedWbsIds = new Set([target.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const row of wbsRows) {
          if (
            row.parentId &&
            allowedWbsIds.has(row.parentId) &&
            !allowedWbsIds.has(row.id)
          ) {
            allowedWbsIds.add(row.id);
            changed = true;
          }
        }
      }
    }

    let selectedCostCode: DimensionContext['selectedCostCode'] = null;
    if (filters.costCodeId) {
      const target = costCodes.find(
        (row) => row.id === filters.costCodeId,
      );
      if (!target) {
        throw new UnprocessableEntityException({
          code: 'COST_CONTROL_COST_CODE_INVALID',
          detail:
            'Cost Control Cost Code filter must belong to the authenticated Company.',
        });
      }
      selectedCostCode = {
        id: target.id,
        costCode: target.costCode,
        costName: target.costName,
      };
    }

    return {
      wbsRows,
      costCodes,
      allowedWbsIds,
      costCodeId: filters.costCodeId ?? null,
      selectedWbs,
      selectedCostCode,
    };
  }

  private matchesDimension(
    wbsId: string | null,
    costCodeId: string | null,
    context: DimensionContext,
  ): boolean {
    if (
      context.allowedWbsIds &&
      (!wbsId || !context.allowedWbsIds.has(wbsId))
    ) {
      return false;
    }
    if (
      context.costCodeId &&
      costCodeId !== context.costCodeId
    ) {
      return false;
    }
    return true;
  }

  private emptyMeasures(): MeasureBucket {
    return {
      originalBudget: new Prisma.Decimal(0),
      revisedBudget: new Prisma.Decimal(0),
      procurementCommitted: new Prisma.Decimal(0),
      subcontractCommitted: new Prisma.Decimal(0),
      supplierActual: new Prisma.Decimal(0),
      subcontractActual: new Prisma.Decimal(0),
      supplierPaid: new Prisma.Decimal(0),
      subcontractPaid: new Prisma.Decimal(0),
    };
  }

  private addDimension(
    map: Map<string, DimensionBucket>,
    wbsId: string | null,
    costCodeId: string | null,
    field: MeasureKey,
    amount: Prisma.Decimal,
  ) {
    if (amount.equals(0)) return;
    const key =
      (wbsId ?? 'UNALLOCATED') +
      '|' +
      (costCodeId ?? 'UNALLOCATED');
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        wbsId,
        costCodeId,
        ...this.emptyMeasures(),
      };
      map.set(key, bucket);
    }
    bucket[field] = bucket[field].plus(amount);
  }

  private assertBaseCurrency(
    source: string,
    currencyCode: string,
    baseCurrencyCode: string,
  ) {
    if (currencyCode === baseCurrencyCode) return;
    throw new UnprocessableEntityException({
      code: 'COST_CONTROL_CURRENCY_UNSUPPORTED',
      detail:
        source +
        ' cannot be aggregated because its currency differs from the current Company base currency. V0.7 performs no FX conversion.',
    });
  }

  private hasPermissions(
    auth: AuthenticatedUserContext,
    ...permissions: string[]
  ): boolean {
    return permissions.every((permission) =>
      auth.permissions.includes(permission),
    );
  }

  private evidence(
    amount: Prisma.Decimal,
    records: EvidenceRecord[],
    revealRecords: boolean,
    canonicalOwner: string,
    recognitionRule: string,
  ) {
    return {
      canonicalOwner,
      recognitionRule,
      amount,
      recordCount: records.length,
      recordsVisible: revealRecords,
      ...(revealRecords ? { records } : {}),
    };
  }
}
