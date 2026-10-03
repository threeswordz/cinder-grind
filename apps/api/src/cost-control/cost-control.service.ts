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
  directActual: Prisma.Decimal;
  supplierPaid: Prisma.Decimal;
  subcontractPaid: Prisma.Decimal;
  remainingProcurement: Prisma.Decimal;
  remainingSubcontract: Prisma.Decimal;
  uncommittedEtc: Prisma.Decimal;
};

type MeasureKey = keyof MeasureBucket;

type DimensionBucket = MeasureBucket & {
  wbsId: string | null;
  costCodeId: string | null;
};

type EvidenceRecord = Record<string, unknown>;

type ExactDecimalTerm = {
  value: Prisma.Decimal;
  multiplier: 1n | -1n;
};

function fixedDecimalParts(value: Prisma.Decimal) {
  const text = value.toFixed();
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [whole = '0', fraction = ''] = unsigned.split('.');
  const digits = (whole + fraction).replace(/^0+(?=\d)/, '') || '0';
  return {
    units: BigInt(digits) * (negative ? -1n : 1n),
    scale: fraction.length,
  };
}

function exactCostDecimal(terms: ExactDecimalTerm[]): Prisma.Decimal {
  if (terms.length === 0) return new Prisma.Decimal(0);
  const parsed = terms.map((term) => ({
    ...fixedDecimalParts(term.value),
    multiplier: term.multiplier,
  }));
  const scale = Math.max(...parsed.map((term) => term.scale));
  const units = parsed.reduce(
    (sum, term) =>
      sum +
      term.units *
        term.multiplier *
        10n ** BigInt(scale - term.scale),
    0n,
  );
  if (units === 0n) return new Prisma.Decimal(0);

  const negative = units < 0n;
  const absolute = (negative ? -units : units)
    .toString()
    .padStart(scale + 1, '0');
  const whole =
    scale === 0 ? absolute : absolute.slice(0, -scale);
  const rawFraction =
    scale === 0 ? '' : absolute.slice(-scale);
  const fraction = rawFraction.replace(/0+$/, '');
  const text =
    (negative ? '-' : '') +
    whole +
    (fraction ? '.' + fraction : '');
  return new Prisma.Decimal(text);
}

export function sumCostControlDecimals(
  values: Prisma.Decimal[],
): Prisma.Decimal {
  return exactCostDecimal(
    values.map((value) => ({ value, multiplier: 1n })),
  );
}

function subtractCostControlDecimals(
  left: Prisma.Decimal,
  right: Prisma.Decimal,
): Prisma.Decimal {
  return exactCostDecimal([
    { value: left, multiplier: 1n },
    { value: right, multiplier: -1n },
  ]);
}

export function remainingCostCommitment(
  committed: Prisma.Decimal,
  attributableActual: Prisma.Decimal,
): Prisma.Decimal {
  const remaining = subtractCostControlDecimals(committed, attributableActual);
  return remaining.isNegative() ? new Prisma.Decimal(0) : remaining;
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
    unallocatedAmount: subtractCostControlDecimals(ceiling, allocatedAmount),
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
      directCostPostings,
      currentForecast,
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
          currencyCode: true,
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
          currencyCode: true,
          revisionNo: true,
          cancelledAt: true,
          lines: {
            select: {
              id: true,
              amount: true,
              wbsId: true,
              costCodeId: true,
              quotationAwardId: true,
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
              purchaseOrderLine: {
                select: {
                  quotationAwardId: true,
                  purchaseOrder: {
                    select: { poNumber: true },
                  },
                },
              },
              goodsReceiptItem: {
                select: {
                  purchaseOrderLine: {
                    select: {
                      quotationAwardId: true,
                      purchaseOrder: {
                        select: { poNumber: true },
                      },
                    },
                  },
                },
              },
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
          agreementId: true,
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
      this.prisma.directCostPosting.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          state: 'APPROVED',
        },
        select: {
          id: true,
          postingDate: true,
          description: true,
          reference: true,
          amount: true,
          currencyCode: true,
          wbsId: true,
          costCodeId: true,
          reversesPostingId: true,
          reversalReason: true,
        },
      }),
      this.prisma.costForecast.findFirst({
        where: {
          companyId: auth.companyId,
          projectId,
          state: 'APPROVED',
        },
        select: {
          id: true,
          versionNo: true,
          forecastDate: true,
          currencyCode: true,
          approvedAt: true,
          lines: {
            select: {
              id: true,
              lineNo: true,
              wbsId: true,
              costCodeId: true,
              uncommittedEtcAmount: true,
              remarks: true,
            },
            orderBy: { lineNo: 'asc' },
          },
        },
        orderBy: [{ versionNo: 'desc' }, { approvedAt: 'desc' }, { id: 'desc' }],
      }),
    ]);

    const dimensionMap = new Map<string, DimensionBucket>();
    const budgetSelection =
      selectOriginalAndCurrentBudget(budgetRevisions);

    for (const revision of [budgetSelection.original, budgetSelection.current]) {
      if (revision) {
        this.assertBaseCurrency('Budget', revision.currencyCode, company.baseCurrencyCode);
      }
    }

    const originalBudgetRecords: EvidenceRecord[] = [];
    const revisedBudgetRecords: EvidenceRecord[] = [];
    const procurementRecords: EvidenceRecord[] = [];
    const subcontractCommitmentRecords: EvidenceRecord[] = [];
    const supplierActualRecords: EvidenceRecord[] = [];
    const subcontractActualRecords: EvidenceRecord[] = [];
    const directActualRecords: EvidenceRecord[] = [];
    const paidRecords: EvidenceRecord[] = [];
    const remainingCommitmentRecords: EvidenceRecord[] = [];
    const forecastRecords: EvidenceRecord[] = [];

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
      this.assertBaseCurrency('Procurement commitment', order.currencyCode, company.baseCurrencyCode);
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
      procurementCommitted = sumCostControlDecimals([procurementCommitted, amount]);
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
      const ceiling = sumCostControlDecimals([agreement.originalValue, variationValue]);
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
        ? sumCostControlDecimals([allocatedAmount, allocation.unallocatedAmount])
        : allocatedAmount;
      if (amount.equals(0)) continue;

      subcontractCommitted = sumCostControlDecimals([subcontractCommitted, amount]);
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


    const supplierActualByPoLineage = new Map<string, Prisma.Decimal>();
    for (const invoice of supplierInvoices) {
      for (const item of invoice.items) {
        const purchaseOrderLine =
          item.purchaseOrderLine ?? item.goodsReceiptItem?.purchaseOrderLine ?? null;
        if (!purchaseOrderLine) continue;
        const lineageKey =
          purchaseOrderLine.purchaseOrder.poNumber +
          '|' +
          purchaseOrderLine.quotationAwardId;
        const current =
          supplierActualByPoLineage.get(lineageKey) ?? new Prisma.Decimal(0);
        supplierActualByPoLineage.set(
          lineageKey,
          sumCostControlDecimals([current, item.amount]),
        );
      }
    }

    let remainingProcurement = new Prisma.Decimal(0);
    for (const order of currentPurchaseOrders) {
      this.assertBaseCurrency(
        'Procurement remaining commitment',
        order.currencyCode,
        company.baseCurrencyCode,
      );
      for (const line of order.lines) {
        if (
          !this.matchesDimension(
            line.wbsId,
            line.costCodeId,
            dimensions,
          )
        ) {
          continue;
        }
        const lineageKey = order.poNumber + '|' + line.quotationAwardId;
        const attributableActual =
          supplierActualByPoLineage.get(lineageKey) ?? new Prisma.Decimal(0);
        const remaining = remainingCostCommitment(
          line.amount,
          attributableActual,
        );
        remainingProcurement = sumCostControlDecimals([
          remainingProcurement,
          remaining,
        ]);
        this.addDimension(
          dimensionMap,
          line.wbsId,
          line.costCodeId,
          'remainingProcurement',
          remaining,
        );
        if (!remaining.equals(0) || !attributableActual.equals(0)) {
          remainingCommitmentRecords.push({
            sourceType: 'PURCHASE_ORDER_LINE',
            purchaseOrderNumber: order.poNumber,
            purchaseOrderLineId: line.id,
            quotationAwardId: line.quotationAwardId,
            committedAmount: line.amount,
            attributableActual,
            remainingCommitment: remaining,
            wbsId: line.wbsId,
            costCodeId: line.costCodeId,
          });
        }
      }
    }

    const certificationActualByAgreement = new Map<string, Prisma.Decimal>();
    for (const certification of certifications) {
      const current =
        certificationActualByAgreement.get(certification.agreementId) ??
        new Prisma.Decimal(0);
      certificationActualByAgreement.set(
        certification.agreementId,
        sumCostControlDecimals([current, certification.certifiedGross]),
      );
    }

    let remainingSubcontract = new Prisma.Decimal(0);
    if (this.matchesDimension(null, null, dimensions)) {
      for (const agreement of agreements) {
        this.assertBaseCurrency(
          'Subcontract remaining commitment',
          agreement.currencyCode,
          company.baseCurrencyCode,
        );
        const variationValue = sumCostControlDecimals(
          agreement.variations.map((variation) => variation.valueDelta),
        );
        const ceiling = sumCostControlDecimals([
          agreement.originalValue,
          variationValue,
        ]);
        const attributableActual =
          certificationActualByAgreement.get(agreement.id) ??
          new Prisma.Decimal(0);
        const remaining = remainingCostCommitment(
          ceiling,
          attributableActual,
        );
        remainingSubcontract = sumCostControlDecimals([
          remainingSubcontract,
          remaining,
        ]);
        this.addDimension(
          dimensionMap,
          null,
          null,
          'remainingSubcontract',
          remaining,
        );
        if (!remaining.equals(0) || !attributableActual.equals(0)) {
          remainingCommitmentRecords.push({
            sourceType: 'SUBCONTRACT_AGREEMENT',
            agreementId: agreement.id,
            agreementNumber: agreement.agreementNumber,
            committedAmount: ceiling,
            attributableActual,
            remainingCommitment: remaining,
            allocationState: 'UNALLOCATED',
          });
        }
      }
    }

    let uncommittedEtc = new Prisma.Decimal(0);
    if (currentForecast) {
      this.assertBaseCurrency(
        'Cost Forecast',
        currentForecast.currencyCode,
        company.baseCurrencyCode,
      );
      const matchingForecastLines = currentForecast.lines.filter((line) =>
        this.matchesDimension(
          line.wbsId,
          line.costCodeId,
          dimensions,
        ),
      );
      for (const line of matchingForecastLines) {
        uncommittedEtc = sumCostControlDecimals([
          uncommittedEtc,
          line.uncommittedEtcAmount,
        ]);
        this.addDimension(
          dimensionMap,
          line.wbsId,
          line.costCodeId,
          'uncommittedEtc',
          line.uncommittedEtcAmount,
        );
      }
      forecastRecords.push({
        id: currentForecast.id,
        versionNo: currentForecast.versionNo,
        forecastDate: currentForecast.forecastDate,
        approvedAt: currentForecast.approvedAt,
        amount: uncommittedEtc,
        lines: matchingForecastLines.map((line) => ({
          id: line.id,
          lineNo: line.lineNo,
          wbsId: line.wbsId,
          costCodeId: line.costCodeId,
          uncommittedEtcAmount: line.uncommittedEtcAmount,
          remarks: line.remarks,
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
      supplierActual = sumCostControlDecimals([supplierActual, amount]);
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
        subcontractActual = sumCostControlDecimals([
          subcontractActual,
          certification.certifiedGross,
        ]);
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

    let directActual = new Prisma.Decimal(0);
    for (const posting of directCostPostings) {
      if (
        !this.matchesDimension(
          posting.wbsId,
          posting.costCodeId,
          dimensions,
        )
      ) {
        continue;
      }
      this.assertBaseCurrency(
        'Direct Actual Cost',
        posting.currencyCode,
        company.baseCurrencyCode,
      );
      directActual = sumCostControlDecimals([directActual, posting.amount]);
      this.addDimension(
        dimensionMap,
        posting.wbsId,
        posting.costCodeId,
        'directActual',
        posting.amount,
      );
      directActualRecords.push({
        id: posting.id,
        recognitionDate: posting.postingDate,
        description: posting.description,
        reference: posting.reference,
        amount: posting.amount,
        reversesPostingId: posting.reversesPostingId,
        reversalReason: posting.reversalReason,
      });
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
        const eligibleAmount = sumCostControlDecimals([supplierAmount, subcontractAmount]);
        if (eligibleAmount.equals(0)) continue;
        this.assertBaseCurrency(
          'Paid Cost',
          payment.currencyCode,
          company.baseCurrencyCode,
        );
        supplierPaid = sumCostControlDecimals([supplierPaid, supplierAmount]);
        subcontractPaid = sumCostControlDecimals([subcontractPaid, subcontractAmount]);
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

    const committedTotal = sumCostControlDecimals([
      procurementCommitted,
      subcontractCommitted,
    ]);
    const actualTotal = sumCostControlDecimals([
      supplierActual,
      subcontractActual,
      directActual,
    ]);
    const paidTotal = sumCostControlDecimals([
      supplierPaid,
      subcontractPaid,
    ]);
    const remainingCommitmentTotal = sumCostControlDecimals([
      remainingProcurement,
      remainingSubcontract,
    ]);
    const costToComplete = sumCostControlDecimals([
      remainingCommitmentTotal,
      uncommittedEtc,
    ]);
    const forecastCost = sumCostControlDecimals([
      actualTotal,
      costToComplete,
    ]);
    const variance = subtractCostControlDecimals(
      revisedBudget,
      forecastCost,
    );

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
            total: sumCostControlDecimals([
              bucket.procurementCommitted,
              bucket.subcontractCommitted,
            ]),
          },
          actualCost: {
            supplier: bucket.supplierActual,
            subcontract: bucket.subcontractActual,
            direct: bucket.directActual,
            total: sumCostControlDecimals([
              bucket.supplierActual,
              bucket.subcontractActual,
              bucket.directActual,
            ]),
          },
          paidCost: {
            supplier: bucket.supplierPaid,
            subcontract: bucket.subcontractPaid,
            total: sumCostControlDecimals([
              bucket.supplierPaid,
              bucket.subcontractPaid,
            ]),
          },
          remainingCommitment: {
            procurement: bucket.remainingProcurement,
            subcontract: bucket.remainingSubcontract,
            total: sumCostControlDecimals([
              bucket.remainingProcurement,
              bucket.remainingSubcontract,
            ]),
          },
          uncommittedEtc: bucket.uncommittedEtc,
          costToComplete: sumCostControlDecimals([
            bucket.remainingProcurement,
            bucket.remainingSubcontract,
            bucket.uncommittedEtc,
          ]),
          forecastCost: sumCostControlDecimals([
            bucket.supplierActual,
            bucket.subcontractActual,
            bucket.directActual,
            bucket.remainingProcurement,
            bucket.remainingSubcontract,
            bucket.uncommittedEtc,
          ]),
          variance: subtractCostControlDecimals(
            bucket.revisedBudget,
            sumCostControlDecimals([
              bucket.supplierActual,
              bucket.subcontractActual,
              bucket.directActual,
              bucket.remainingProcurement,
              bucket.remainingSubcontract,
              bucket.uncommittedEtc,
            ]),
          ),
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
          direct: directActual,
          total: actualTotal,
        },
        paidCost: {
          supplier: supplierPaid,
          subcontract: subcontractPaid,
          total: paidTotal,
        },
        remainingCommitment: {
          procurement: remainingProcurement,
          subcontract: remainingSubcontract,
          total: remainingCommitmentTotal,
        },
        uncommittedEtc,
        costToComplete,
        forecastCost,
        variance,
      },
      currentForecast: currentForecast
        ? {
            id: currentForecast.id,
            versionNo: currentForecast.versionNo,
            forecastDate: currentForecast.forecastDate,
            approvedAt: currentForecast.approvedAt,
          }
        : null,
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
        directActual: this.evidence(
          directActual,
          directActualRecords,
          auth.permissions.some((permission) =>
            permission.startsWith('cost.direct_posting.'),
          ),
          'V0.7 Direct Cost Posting',
          'Final-approved Direct Cost Posting recognized on posting date; an approved linked reversal contributes the exact signed offset',
        ),
        paidCost: this.evidence(
          paidTotal,
          paidRecords,
          this.hasPermissions(auth, 'finance.payment.view'),
          'V0.6 Payment allocations',
          'Approved non-cancelled OUTBOUND allocations to Supplier Invoices or Subcontract Certifications on Payment date',
        ),
        remainingCommitment: this.evidence(
          remainingCommitmentTotal,
          remainingCommitmentRecords,
          true,
          'Derived Cost Control measure',
          'Current commitment less only canonically attributable recognized Actual, floored at zero. Procurement follows PO lineage; subcontract certification reduction remains Unallocated because no approved WBS/Cost Code allocation exists.',
        ),
        uncommittedEtc: this.evidence(
          uncommittedEtc,
          forecastRecords,
          this.hasPermissions(auth, 'cost.forecast.view'),
          'V0.7 Cost Forecast',
          'Highest-version final-approved Forecast only; lines store Uncommitted ETC and never total Cost to Complete.',
        ),
      },
      boundaries: {
        committedActualPaidSeparate: true,
        inventoryCreatesActualCost: false,
        sourceModulesRemainCanonical: true,
        syntheticDimensionalProration: false,
        financialAuthority: 'POSTGRESQL_PRISMA_DECIMAL',
        directCostPostingImplemented: true,
        forecastImplemented: true,
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
      directActual: new Prisma.Decimal(0),
      supplierPaid: new Prisma.Decimal(0),
      subcontractPaid: new Prisma.Decimal(0),
      remainingProcurement: new Prisma.Decimal(0),
      remainingSubcontract: new Prisma.Decimal(0),
      uncommittedEtc: new Prisma.Decimal(0),
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
    bucket[field] = sumCostControlDecimals([bucket[field], amount]);
  }

  private assertBaseCurrency(
    source: string,
    currencyCode: string | null,
    baseCurrencyCode: string,
  ) {
    if (currencyCode === null) {
      throw new UnprocessableEntityException({
        code: 'COST_CONTROL_CURRENCY_UNVERIFIED',
        detail: source + ' cannot be aggregated because its historical currency is unverified. No currency is inferred or converted.',
      });
    }
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
