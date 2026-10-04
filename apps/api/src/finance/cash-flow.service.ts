import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

export type CashFlowPeriod = {
  fromDate?: Date;
  toDateExclusive?: Date;
};

export type CashFlowSourceRow = {
  id: string;
  paymentNumber: string;
  paymentDirection: string;
  paymentDate: Date;
  amount: Prisma.Decimal;
  currencyCode: string;
  paymentMethod: string | null;
  reference: string | null;
  state: string;
  cancelledAt: Date | null;
  supplier: {
    id: string;
    supplierCode: string;
    supplierName: string;
  } | null;
  customer: {
    id: string;
    customerCode: string;
    customerName: string;
  } | null;
  subcontractor: {
    id: string;
    subcontractorCode: string;
    subcontractorName: string;
  } | null;
  supplierAllocations: Array<{
    allocatedAmount: Prisma.Decimal;
    supplierInvoice: {
      id: string;
      supplierInvoiceNumber: string;
      supplierReference: string;
    };
  }>;
  clientAllocations: Array<{
    allocatedAmount: Prisma.Decimal;
    clientInvoice: {
      id: string;
      clientInvoiceNumber: string;
    };
  }>;
  subcontractAllocations: Array<{
    allocatedAmount: Prisma.Decimal;
    subcontractCertification: {
      id: string;
      certificationNumber: string;
    };
  }>;
};

export function deriveProjectCashFlow(
  sourceRows: CashFlowSourceRow[],
  baseCurrencyCode: string,
) {
  const zero = new Prisma.Decimal(0);
  const includedRows = sourceRows.filter(
    (payment) => payment.state === 'APPROVED' && payment.cancelledAt === null,
  );
  const mismatchedCurrency = includedRows.find(
    (payment) => payment.currencyCode !== baseCurrencyCode,
  );
  if (mismatchedCurrency) {
    throw new UnprocessableEntityException({
      code: 'CASH_FLOW_CURRENCY_UNSUPPORTED',
      detail:
        'Project Cash Flow cannot aggregate Payments recorded in a currency different from the current Company base currency without approved FX accounting.',
    });
  }

  const rows = includedRows.map((payment) => {
      const supplierAllocated = payment.supplierAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.allocatedAmount),
        zero,
      );
      const clientAllocated = payment.clientAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.allocatedAmount),
        zero,
      );
      const subcontractAllocated = payment.subcontractAllocations.reduce(
        (sum, allocation) => sum.plus(allocation.allocatedAmount),
        zero,
      );
      const allocatedAmount = supplierAllocated
        .plus(clientAllocated)
        .plus(subcontractAllocated);
      const unallocatedAmount = payment.amount.minus(allocatedAmount);
      const settlementStatus = allocatedAmount.equals(0)
        ? 'UNALLOCATED'
        : unallocatedAmount.equals(0)
          ? 'FULLY_ALLOCATED'
          : 'PARTIALLY_ALLOCATED';
      const inbound = payment.paymentDirection === 'INBOUND';
      const counterparty = payment.supplier
        ? {
            type: 'SUPPLIER' as const,
            id: payment.supplier.id,
            code: payment.supplier.supplierCode,
            name: payment.supplier.supplierName,
          }
        : payment.customer
          ? {
              type: 'CUSTOMER' as const,
              id: payment.customer.id,
              code: payment.customer.customerCode,
              name: payment.customer.customerName,
            }
          : payment.subcontractor
            ? {
                type: 'SUBCONTRACTOR' as const,
                id: payment.subcontractor.id,
                code: payment.subcontractor.subcontractorCode,
                name: payment.subcontractor.subcontractorName,
              }
            : null;

      return {
        id: payment.id,
        paymentNumber: payment.paymentNumber,
        paymentDirection: payment.paymentDirection,
        paymentDate: payment.paymentDate,
        amount: payment.amount,
        currencyCode: payment.currencyCode,
        paymentMethod: payment.paymentMethod,
        reference: payment.reference,
        counterparty,
        inflowAmount: inbound ? payment.amount : zero,
        outflowAmount: inbound ? zero : payment.amount,
        signedAmount: inbound ? payment.amount : payment.amount.negated(),
        allocatedAmount,
        unallocatedAmount,
        settlementStatus,
        allocations: [
          ...payment.supplierAllocations.map((allocation) => ({
            targetType: 'SUPPLIER_INVOICE' as const,
            targetId: allocation.supplierInvoice.id,
            targetNumber: allocation.supplierInvoice.supplierInvoiceNumber,
            targetReference: allocation.supplierInvoice.supplierReference,
            allocatedAmount: allocation.allocatedAmount,
          })),
          ...payment.clientAllocations.map((allocation) => ({
            targetType: 'CLIENT_INVOICE' as const,
            targetId: allocation.clientInvoice.id,
            targetNumber: allocation.clientInvoice.clientInvoiceNumber,
            targetReference: null,
            allocatedAmount: allocation.allocatedAmount,
          })),
          ...payment.subcontractAllocations.map((allocation) => ({
            targetType: 'SUBCONTRACT_CERTIFICATION' as const,
            targetId: allocation.subcontractCertification.id,
            targetNumber:
              allocation.subcontractCertification.certificationNumber,
            targetReference: null,
            allocatedAmount: allocation.allocatedAmount,
          })),
        ],
      };
    });

  const totals = rows.reduce(
    (summary, row) => ({
      inflowAmount: summary.inflowAmount.plus(row.inflowAmount),
      outflowAmount: summary.outflowAmount.plus(row.outflowAmount),
      netCashFlow: summary.netCashFlow.plus(row.signedAmount),
    }),
    {
      inflowAmount: zero,
      outflowAmount: zero,
      netCashFlow: zero,
    },
  );

  return {
    baseCurrencyCode,
    totals,
    rows,
  };
}

@Injectable()
export class CashFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: scope,
      select: { id: true, projectCode: true, projectName: true, isActive: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async portfolioProjectCashFlows(
    auth: AuthenticatedUserContext,
    projectIds: string[],
    period: CashFlowPeriod = {},
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

    const paymentDate =
      period.fromDate || period.toDateExclusive
        ? {
            ...(period.fromDate ? { gte: period.fromDate } : {}),
            ...(period.toDateExclusive ? { lt: period.toDateExclusive } : {}),
          }
        : undefined;

    const [company, payments] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.payment.findMany({
        where: {
          companyId: auth.companyId,
          projectId: { in: allowedIds },
          state: { in: ['APPROVED', 'CANCELLED'] },
          ...(paymentDate ? { paymentDate } : {}),
        },
        select: {
          id: true,
          projectId: true,
          paymentNumber: true,
          paymentDirection: true,
          paymentDate: true,
          amount: true,
          currencyCode: true,
          paymentMethod: true,
          reference: true,
          state: true,
          cancelledAt: true,
          supplier: {
            select: { id: true, supplierCode: true, supplierName: true },
          },
          customer: {
            select: { id: true, customerCode: true, customerName: true },
          },
          subcontractor: {
            select: {
              id: true,
              subcontractorCode: true,
              subcontractorName: true,
            },
          },
          supplierAllocations: {
            select: {
              allocatedAmount: true,
              supplierInvoice: {
                select: {
                  id: true,
                  supplierInvoiceNumber: true,
                  supplierReference: true,
                },
              },
            },
          },
          clientAllocations: {
            select: {
              allocatedAmount: true,
              clientInvoice: {
                select: { id: true, clientInvoiceNumber: true },
              },
            },
          },
          subcontractAllocations: {
            select: {
              allocatedAmount: true,
              subcontractCertification: {
                select: { id: true, certificationNumber: true },
              },
            },
          },
        },
      }),
    ]);

    return allowedIds.map((projectId) => {
      const result = deriveProjectCashFlow(
        payments.filter((payment) => payment.projectId === projectId),
        company.baseCurrencyCode,
      );
      return {
        projectId,
        baseCurrencyCode: result.baseCurrencyCode,
        totals: result.totals,
      };
    });
  }

  async projectCashFlow(
    auth: AuthenticatedUserContext,
    projectId: string,
    period: CashFlowPeriod = {},
  ) {
    await this.access.assertAccess(auth, projectId);

    const paymentDate =
      period.fromDate || period.toDateExclusive
        ? {
            ...(period.fromDate ? { gte: period.fromDate } : {}),
            ...(period.toDateExclusive ? { lt: period.toDateExclusive } : {}),
          }
        : undefined;

    const [company, payments] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.payment.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          state: { in: ['APPROVED', 'CANCELLED'] },
          ...(paymentDate ? { paymentDate } : {}),
        },
        select: {
          id: true,
          paymentNumber: true,
          paymentDirection: true,
          paymentDate: true,
          amount: true,
          currencyCode: true,
          paymentMethod: true,
          reference: true,
          state: true,
          cancelledAt: true,
          supplier: {
            select: { id: true, supplierCode: true, supplierName: true },
          },
          customer: {
            select: { id: true, customerCode: true, customerName: true },
          },
          subcontractor: {
            select: {
              id: true,
              subcontractorCode: true,
              subcontractorName: true,
            },
          },
          supplierAllocations: {
            select: {
              allocatedAmount: true,
              supplierInvoice: {
                select: {
                  id: true,
                  supplierInvoiceNumber: true,
                  supplierReference: true,
                },
              },
            },
          },
          clientAllocations: {
            select: {
              allocatedAmount: true,
              clientInvoice: {
                select: { id: true, clientInvoiceNumber: true },
              },
            },
          },
          subcontractAllocations: {
            select: {
              allocatedAmount: true,
              subcontractCertification: {
                select: { id: true, certificationNumber: true },
              },
            },
          },
        },
        orderBy: [{ paymentDate: 'asc' }, { paymentNumber: 'asc' }],
      }),
    ]);

    return deriveProjectCashFlow(payments, company.baseCurrencyCode);
  }
}
