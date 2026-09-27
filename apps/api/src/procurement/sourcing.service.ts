import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type RfqSourceInput = {
  purchaseRequestLineId: string;
  quantity: Prisma.Decimal;
};

type QuotationHeaderInput = {
  supplierReference?: string | null;
  quotationDate?: Date;
  validityDate?: Date | null;
  remarks?: string | null;
};

@Injectable()
export class SourcingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async approvedDemand(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const lines = await this.prisma.purchaseRequestLine.findMany({
      where: {
        purchaseRequest: {
          companyId: auth.companyId,
          projectId,
          cancelledAt: null,
          approvalInstance: {
            is: { approvalState: 'APPROVED' },
          },
        },
      },
      include: {
        purchaseRequest: {
          select: {
            id: true,
            prNumber: true,
          },
        },
        uom: {
          select: {
            id: true,
            uomCode: true,
            uomName: true,
            decimalPlaces: true,
          },
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
          select: {
            id: true,
            rfqId: true,
            quantity: true,
            award: {
              select: {
                id: true,
                quantity: true,
                supplierCodeSnapshot: true,
                supplierNameSnapshot: true,
              },
            },
          },
        },
      },
      orderBy: [
        { purchaseRequest: { createdAt: 'asc' } },
        { lineNo: 'asc' },
      ],
    });

    return lines.map((line) => {
      const awardedQuantity = line.rfqLines.reduce(
        (sum, rfqLine) =>
          rfqLine.award ? sum.plus(rfqLine.award.quantity) : sum,
        new Prisma.Decimal(0),
      );
      return {
        ...line,
        awardedQuantity,
        remainingAwardQuantity: Prisma.Decimal.max(
          new Prisma.Decimal(0),
          line.quantity.minus(awardedQuantity),
        ),
      };
    });
  }

  async supplierOptions(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.supplier.findMany({
      where: {
        companyId: auth.companyId,
        isActive: true,
      },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
        contactName: true,
        email: true,
        phone: true,
      },
      orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }],
    });
  }

  async listRfqs(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.rfq.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
      },
      include: {
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        _count: {
          select: {
            lines: true,
            suppliers: true,
            quotations: true,
            awards: true,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { rfqNumber: 'desc' }],
    });
  }

  async getRfq(auth: AuthenticatedUserContext, rfqId: string) {
    const row = await this.prisma.rfq.findFirst({
      where: {
        id: rfqId,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        lines: {
          include: {
            uom: {
              select: {
                id: true,
                uomCode: true,
                uomName: true,
                decimalPlaces: true,
              },
            },
            purchaseRequestLine: {
              include: {
                purchaseRequest: {
                  select: {
                    id: true,
                    prNumber: true,
                    cancelledAt: true,
                    approvalInstance: {
                      select: { approvalState: true },
                    },
                  },
                },
                wbs: {
                  select: { id: true, wbsCode: true, wbsName: true },
                },
                costCode: {
                  select: { id: true, costCode: true, costName: true },
                },
                activity: {
                  select: {
                    id: true,
                    activityCode: true,
                    activityName: true,
                  },
                },
              },
            },
            award: {
              include: {
                selectedBy: {
                  select: { id: true, displayName: true, email: true },
                },
              },
            },
          },
          orderBy: { lineNo: 'asc' },
        },
        suppliers: {
          orderBy: { invitedAt: 'asc' },
        },
        quotations: {
          include: {
            lines: {
              include: {
                award: {
                  select: { id: true },
                },
              },
              orderBy: { lineNo: 'asc' },
            },
          },
          orderBy: [{ quotationDate: 'asc' }, { createdAt: 'asc' }],
        },
        awards: {
          include: {
            selectedBy: {
              select: { id: true, displayName: true, email: true },
            },
          },
          orderBy: { selectedAt: 'asc' },
        },
      },
    });
    if (!row) throw this.rfqNotFound();
    await this.access.assertAccess(auth, row.projectId);
    return row;
  }

  async createRfq(
    context: AuditContext,
    projectId: string,
    input: {
      closingDate?: Date | null;
      remarks?: string | null;
      lines: RfqSourceInput[];
    },
  ) {
    await this.access.assertAccess(context.auth, projectId);
    await this.assertApprovedNumbering(context.auth.companyId);
    if (!input.lines.length) {
      throw new UnprocessableEntityException({
        code: 'RFQ_LINES_REQUIRED',
        detail: 'At least one approved Purchase Request line is required.',
      });
    }

    const distinct = new Set(
      input.lines.map((line) => line.purchaseRequestLineId),
    );
    if (distinct.size !== input.lines.length) {
      throw new UnprocessableEntityException({
        code: 'RFQ_SOURCE_DUPLICATE',
        detail: 'The same Purchase Request line cannot appear twice in one RFQ.',
      });
    }

    const rfqNumber = await this.numbers.next(
      context.auth.companyId,
      'RFQ',
    );

    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        const sources = await tx.purchaseRequestLine.findMany({
          where: {
            id: { in: [...distinct] },
            purchaseRequest: {
              companyId: context.auth.companyId,
              projectId,
              cancelledAt: null,
              approvalInstance: {
                is: { approvalState: 'APPROVED' },
              },
            },
          },
          include: {
            purchaseRequest: {
              select: {
                id: true,
                prNumber: true,
              },
            },
            uom: {
              select: {
                id: true,
                uomCode: true,
              },
            },
          },
        });

        if (sources.length !== input.lines.length) {
          throw new UnprocessableEntityException({
            code: 'RFQ_SOURCE_INVALID',
            detail:
              'Every RFQ source line must be an active APPROVED Purchase Request line from the selected Project.',
          });
        }
        const sourceMap = new Map(
          sources.map((source) => [source.id, source]),
        );

        for (const requested of input.lines) {
          const source = sourceMap.get(requested.purchaseRequestLineId)!;
          if (requested.quantity.gt(source.quantity)) {
            throw new UnprocessableEntityException({
              code: 'RFQ_QUANTITY_EXCEEDS_DEMAND',
              detail:
                'RFQ line quantity cannot exceed the approved Purchase Request demand quantity.',
            });
          }
        }

        const rfq = await tx.rfq.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            rfqNumber,
            closingDate: input.closingDate ?? null,
            remarks: input.remarks ?? null,
            createdByUserId: context.auth.userId,
          },
        });

        for (const [index, requested] of input.lines.entries()) {
          const source = sourceMap.get(requested.purchaseRequestLineId)!;
          await tx.rfqLine.create({
            data: {
              rfqId: rfq.id,
              lineNo: index + 1,
              purchaseRequestLineId: source.id,
              lineType: source.lineType,
              materialCodeSnapshot: source.materialCodeSnapshot,
              description: source.description,
              quantity: requested.quantity,
              uomId: source.uomId,
              uomCodeSnapshot: source.uom.uomCode,
              requiredOnSite: source.requiredOnSite,
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'RFQ',
            entityId: rfq.id,
            action: 'CREATE',
            newValues: {
              projectId,
              rfqNumber,
              closingDate: input.closingDate ?? null,
              lineCount: input.lines.length,
              sourcePurchaseRequestLineIds: [...distinct],
            },
          },
          tx,
        );

        return tx.rfq.findUniqueOrThrow({
          where: { id: rfq.id },
          include: {
            lines: {
              orderBy: { lineNo: 'asc' },
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async inviteSupplier(
    context: AuditContext,
    rfqId: string,
    supplierId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rfq = await tx.rfq.findFirst({
          where: {
            id: rfqId,
            companyId: context.auth.companyId,
          },
          select: {
            id: true,
            projectId: true,
          },
        });
        if (!rfq) throw this.rfqNotFound();
        await this.access.assertAccess(
          context.auth,
          rfq.projectId,
          tx,
        );

        const supplier = await tx.supplier.findFirst({
          where: {
            id: supplierId,
            companyId: context.auth.companyId,
            isActive: true,
          },
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
          },
        });
        if (!supplier) {
          throw new UnprocessableEntityException({
            code: 'RFQ_SUPPLIER_INVALID',
            detail:
              'Invited Supplier must be active and belong to the same Company.',
          });
        }

        const invitation = await tx.rfqSupplier.create({
          data: {
            rfqId: rfq.id,
            supplierId: supplier.id,
            supplierCodeSnapshot: supplier.supplierCode,
            supplierNameSnapshot: supplier.supplierName,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'RFQ_SUPPLIER',
            entityId: invitation.id,
            action: 'INVITE',
            newValues: {
              rfqId: rfq.id,
              supplierId: supplier.id,
              supplierCode: supplier.supplierCode,
            },
          },
          tx,
        );
        return invitation;
      });
    } catch (error) {
      this.translateUnique(error, 'RFQ_SUPPLIER_ALREADY_INVITED');
      throw error;
    }
  }

  async createQuotation(
    context: AuditContext,
    rfqId: string,
    supplierId: string,
    input: Required<Pick<QuotationHeaderInput, 'quotationDate'>> &
      Omit<QuotationHeaderInput, 'quotationDate'>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const rfq = await tx.rfq.findFirst({
          where: {
            id: rfqId,
            companyId: context.auth.companyId,
          },
          select: { id: true, projectId: true },
        });
        if (!rfq) throw this.rfqNotFound();
        await this.access.assertAccess(
          context.auth,
          rfq.projectId,
          tx,
        );

        const invitation = await tx.rfqSupplier.findFirst({
          where: {
            rfqId,
            supplierId,
          },
          select: { id: true },
        });
        if (!invitation) {
          throw new UnprocessableEntityException({
            code: 'QUOTATION_SUPPLIER_NOT_INVITED',
            detail:
              'Supplier must be invited to the RFQ before quotation capture.',
          });
        }

        const quotation = await tx.supplierQuotation.create({
          data: {
            companyId: context.auth.companyId,
            rfqId,
            supplierId,
            supplierReference: input.supplierReference ?? null,
            quotationDate: input.quotationDate,
            validityDate: input.validityDate ?? null,
            remarks: input.remarks ?? null,
            createdByUserId: context.auth.userId,
            updatedByUserId: context.auth.userId,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER_QUOTATION',
            entityId: quotation.id,
            action: 'CREATE',
            newValues: {
              rfqId,
              supplierId,
              supplierReference: quotation.supplierReference,
              quotationDate: quotation.quotationDate,
              validityDate: quotation.validityDate,
            },
          },
          tx,
        );
        return quotation;
      });
    } catch (error) {
      this.translateUnique(error, 'QUOTATION_ALREADY_EXISTS');
      throw error;
    }
  }

  async updateQuotation(
    context: AuditContext,
    quotationId: string,
    input: QuotationHeaderInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.supplierQuotation.findFirst({
        where: {
          id: quotationId,
          companyId: context.auth.companyId,
        },
        include: {
          rfq: {
            select: { projectId: true },
          },
          _count: {
            select: { awards: true },
          },
        },
      });
      if (!current) throw this.quotationNotFound();
      await this.access.assertAccess(
        context.auth,
        current.rfq.projectId,
        tx,
      );
      if (current._count.awards > 0) {
        throw new ConflictException({
          code: 'QUOTATION_HEADER_FROZEN',
          detail:
            'Quotation header is frozen after one of its lines has been awarded.',
        });
      }

      const data: Prisma.SupplierQuotationUpdateInput = {
        updatedBy: { connect: { id: context.auth.userId } },
        ...(input.supplierReference !== undefined
          ? { supplierReference: input.supplierReference }
          : {}),
        ...(input.quotationDate !== undefined
          ? { quotationDate: input.quotationDate }
          : {}),
        ...(input.validityDate !== undefined
          ? { validityDate: input.validityDate }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: input.remarks }
          : {}),
      };

      const updated = await tx.supplierQuotation.update({
        where: { id: current.id },
        data,
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUPPLIER_QUOTATION',
          entityId: current.id,
          action: 'CORRECT_HEADER',
          oldValues: {
            supplierReference: current.supplierReference,
            quotationDate: current.quotationDate,
            validityDate: current.validityDate,
            remarks: current.remarks,
          },
          newValues: {
            supplierReference: updated.supplierReference,
            quotationDate: updated.quotationDate,
            validityDate: updated.validityDate,
            remarks: updated.remarks,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async upsertQuotationLine(
    context: AuditContext,
    quotationId: string,
    rfqLineId: string,
    input: {
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      remarks?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.supplierQuotation.findFirst({
        where: {
          id: quotationId,
          companyId: context.auth.companyId,
        },
        include: {
          rfq: {
            select: {
              id: true,
              projectId: true,
            },
          },
        },
      });
      if (!quotation) throw this.quotationNotFound();
      await this.access.assertAccess(
        context.auth,
        quotation.rfq.projectId,
        tx,
      );

      const rfqLine = await tx.rfqLine.findFirst({
        where: {
          id: rfqLineId,
          rfqId: quotation.rfqId,
        },
      });
      if (!rfqLine) {
        throw new UnprocessableEntityException({
          code: 'QUOTATION_RFQ_LINE_INVALID',
          detail:
            'Quotation line must reference a line from the same RFQ.',
        });
      }
      if (input.quantity.gt(rfqLine.quantity)) {
        throw new UnprocessableEntityException({
          code: 'QUOTATION_QUANTITY_EXCEEDS_RFQ',
          detail:
            'Supplier Quotation quantity cannot exceed the RFQ requested quantity.',
        });
      }

      const existing = await tx.supplierQuotationLine.findFirst({
        where: {
          supplierQuotationId: quotation.id,
          rfqLineId,
        },
      });
      if (existing) {
        const award = await tx.quotationAward.findFirst({
          where: {
            supplierQuotationLineId: existing.id,
          },
          select: { id: true },
        });
        if (award) {
          throw new ConflictException({
            code: 'QUOTATION_LINE_AWARDED',
            detail:
              'An awarded Supplier Quotation line is frozen and cannot be corrected.',
          });
        }
      }

      const amount = input.quantity.mul(input.unitPrice);
      const line = existing
        ? await tx.supplierQuotationLine.update({
            where: { id: existing.id },
            data: {
              quantity: input.quantity,
              unitPrice: input.unitPrice,
              amount,
              remarks: input.remarks ?? null,
            },
          })
        : await tx.supplierQuotationLine.create({
            data: {
              supplierQuotationId: quotation.id,
              rfqLineId,
              lineNo: rfqLine.lineNo,
              quantity: input.quantity,
              uomId: rfqLine.uomId,
              uomCodeSnapshot: rfqLine.uomCodeSnapshot,
              unitPrice: input.unitPrice,
              amount,
              remarks: input.remarks ?? null,
            },
          });

      await tx.supplierQuotation.update({
        where: { id: quotation.id },
        data: {
          updatedByUserId: context.auth.userId,
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'SUPPLIER_QUOTATION_LINE',
          entityId: line.id,
          action: existing ? 'CORRECT_LINE' : 'CREATE_LINE',
          ...(existing
            ? {
                oldValues: {
                  quantity: existing.quantity.toString(),
                  unitPrice: existing.unitPrice.toString(),
                  amount: existing.amount.toString(),
                  remarks: existing.remarks,
                },
              }
            : {}),
          newValues: {
            quotationId: quotation.id,
            rfqLineId,
            quantity: line.quantity.toString(),
            unitPrice: line.unitPrice.toString(),
            amount: line.amount.toString(),
            remarks: line.remarks,
          },
        },
        tx,
      );
      return line;
    });
  }

  async comparison(auth: AuthenticatedUserContext, rfqId: string) {
    const rfq = await this.getRfq(auth, rfqId);
    const quotationBySupplier = new Map(
      rfq.quotations.map((quotation) => [
        quotation.supplierId,
        quotation,
      ]),
    );

    return {
      rfq: {
        id: rfq.id,
        projectId: rfq.projectId,
        rfqNumber: rfq.rfqNumber,
        rfqDate: rfq.rfqDate,
        closingDate: rfq.closingDate,
      },
      lines: rfq.lines.map((line) => ({
        id: line.id,
        lineNo: line.lineNo,
        purchaseRequestLineId: line.purchaseRequestLineId,
        sourcePrNumber: line.purchaseRequestLine.purchaseRequest.prNumber,
        lineType: line.lineType,
        materialCodeSnapshot: line.materialCodeSnapshot,
        description: line.description,
        quantity: line.quantity,
        uomId: line.uomId,
        uomCodeSnapshot: line.uomCodeSnapshot,
        requiredOnSite: line.requiredOnSite,
        award: line.award,
        offers: rfq.suppliers.map((invitation) => {
          const quotation = quotationBySupplier.get(
            invitation.supplierId,
          );
          const quoteLine = quotation?.lines.find(
            (candidate) => candidate.rfqLineId === line.id,
          );
          return {
            supplierId: invitation.supplierId,
            supplierCodeSnapshot: invitation.supplierCodeSnapshot,
            supplierNameSnapshot: invitation.supplierNameSnapshot,
            quotationId: quotation?.id ?? null,
            supplierReference:
              quotation?.supplierReference ?? null,
            quotationDate: quotation?.quotationDate ?? null,
            validityDate: quotation?.validityDate ?? null,
            quotationLineId: quoteLine?.id ?? null,
            quotedQuantity: quoteLine?.quantity ?? null,
            unitPrice: quoteLine?.unitPrice ?? null,
            amount: quoteLine?.amount ?? null,
            remarks: quoteLine?.remarks ?? null,
          };
        }),
      })),
      suppliers: rfq.suppliers.map((invitation) => {
        const quotation = quotationBySupplier.get(
          invitation.supplierId,
        );
        const total = quotation
          ? quotation.lines.reduce(
              (sum, line) => sum.plus(line.amount),
              new Prisma.Decimal(0),
            )
          : null;
        return {
          ...invitation,
          quotationId: quotation?.id ?? null,
          supplierReference:
            quotation?.supplierReference ?? null,
          quotationDate: quotation?.quotationDate ?? null,
          validityDate: quotation?.validityDate ?? null,
          totalAmount: total,
        };
      }),
    };
  }

  async selectAward(
    context: AuditContext,
    rfqLineId: string,
    supplierQuotationLineId: string,
    decisionReason?: string | null,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const initialLine = await tx.rfqLine.findFirst({
          where: {
            id: rfqLineId,
            rfq: { companyId: context.auth.companyId },
          },
          include: {
            rfq: {
              select: {
                id: true,
                projectId: true,
              },
            },
          },
        });
        if (!initialLine) throw this.rfqLineNotFound();
        await this.access.assertAccess(
          context.auth,
          initialLine.rfq.projectId,
          tx,
        );

        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'pr-demand-award:' + initialLine.purchaseRequestLineId,
        );

        const rfqLine = await tx.rfqLine.findFirst({
          where: { id: rfqLineId },
          include: {
            award: { select: { id: true } },
            purchaseRequestLine: {
              include: {
                purchaseRequest: {
                  include: {
                    approvalInstance: {
                      select: { approvalState: true },
                    },
                  },
                },
              },
            },
          },
        });
        if (!rfqLine) throw this.rfqLineNotFound();
        if (rfqLine.award) {
          throw new ConflictException({
            code: 'RFQ_LINE_ALREADY_AWARDED',
            detail: 'This RFQ line already has a Supplier Award.',
          });
        }
        if (
          rfqLine.purchaseRequestLine.purchaseRequest.cancelledAt ||
          rfqLine.purchaseRequestLine.purchaseRequest
            .approvalInstance?.approvalState !== 'APPROVED'
        ) {
          throw new ConflictException({
            code: 'AWARD_SOURCE_DEMAND_INACTIVE',
            detail:
              'Supplier Award requires active approved Purchase Request demand.',
          });
        }

        const quoteLine = await tx.supplierQuotationLine.findFirst({
          where: {
            id: supplierQuotationLineId,
            rfqLineId: rfqLine.id,
          },
          include: {
            supplierQuotation: {
              include: {
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
        });
        if (
          !quoteLine ||
          quoteLine.supplierQuotation.rfqId !==
            initialLine.rfq.id
        ) {
          throw new UnprocessableEntityException({
            code: 'AWARD_QUOTATION_LINE_INVALID',
            detail:
              'Award must select a quotation line from this RFQ line.',
          });
        }

        const invitation = await tx.rfqSupplier.findFirst({
          where: {
            rfqId: initialLine.rfq.id,
            supplierId:
              quoteLine.supplierQuotation.supplierId,
          },
        });
        if (!invitation) {
          throw new UnprocessableEntityException({
            code: 'AWARD_SUPPLIER_NOT_INVITED',
            detail:
              'Award source Supplier is not an invited RFQ Supplier.',
          });
        }

        const alreadyAwarded =
          await tx.quotationAward.aggregate({
            where: {
              rfqLine: {
                purchaseRequestLineId:
                  rfqLine.purchaseRequestLineId,
              },
            },
            _sum: { quantity: true },
          });
        const awarded =
          alreadyAwarded._sum.quantity ??
          new Prisma.Decimal(0);
        if (
          awarded
            .plus(quoteLine.quantity)
            .gt(rfqLine.purchaseRequestLine.quantity)
        ) {
          throw new ConflictException({
            code: 'AWARD_EXCEEDS_APPROVED_DEMAND',
            detail:
              'Supplier Award would exceed the approved Purchase Request demand quantity.',
          });
        }

        const award = await tx.quotationAward.create({
          data: {
            rfqId: initialLine.rfq.id,
            rfqLineId: rfqLine.id,
            supplierQuotationId:
              quoteLine.supplierQuotationId,
            supplierQuotationLineId: quoteLine.id,
            supplierId:
              quoteLine.supplierQuotation.supplierId,
            supplierCodeSnapshot:
              invitation.supplierCodeSnapshot,
            supplierNameSnapshot:
              invitation.supplierNameSnapshot,
            supplierReferenceSnapshot:
              quoteLine.supplierQuotation.supplierReference,
            quotationDateSnapshot:
              quoteLine.supplierQuotation.quotationDate,
            quantity: quoteLine.quantity,
            uomId: quoteLine.uomId,
            uomCodeSnapshot: quoteLine.uomCodeSnapshot,
            unitPrice: quoteLine.unitPrice,
            amount: quoteLine.amount,
            decisionReason: decisionReason ?? null,
            selectedByUserId: context.auth.userId,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'QUOTATION_AWARD',
            entityId: award.id,
            action: 'SELECT',
            newValues: {
              rfqId: award.rfqId,
              rfqLineId: award.rfqLineId,
              purchaseRequestLineId:
                rfqLine.purchaseRequestLineId,
              supplierQuotationId:
                award.supplierQuotationId,
              supplierQuotationLineId:
                award.supplierQuotationLineId,
              supplierId: award.supplierId,
              quantity: award.quantity.toString(),
              unitPrice: award.unitPrice.toString(),
              amount: award.amount.toString(),
              decisionReason: award.decisionReason,
            },
          },
          tx,
        );
        return award;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertApprovedNumbering(companyId: string) {
    const sequence = await this.prisma.numberSequence.findFirst({
      where: {
        companyId,
        sequenceCode: 'RFQ',
      },
      select: {
        entityType: true,
        formatTemplate: true,
        resetRule: true,
      },
    });
    if (
      !sequence ||
      sequence.entityType !== 'RFQ' ||
      sequence.formatTemplate !== 'RFQYYMM-###' ||
      sequence.resetRule !== 'MONTHLY'
    ) {
      throw new UnprocessableEntityException({
        code: 'RFQ_NUMBER_SEQUENCE_INVALID',
        detail:
          'Configure RFQ numbering as RFQYYMM-### with MONTHLY reset before creating RFQs.',
      });
    }
  }

  private translateUnique(error: unknown, code: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code,
        detail:
          code === 'QUOTATION_ALREADY_EXISTS'
            ? 'The invited Supplier already has a current quotation for this RFQ.'
            : 'The Supplier is already invited to this RFQ.',
      });
    }
  }

  private rfqNotFound() {
    return new NotFoundException({
      code: 'RFQ_NOT_FOUND',
      detail: 'RFQ not found.',
    });
  }

  private rfqLineNotFound() {
    return new NotFoundException({
      code: 'RFQ_LINE_NOT_FOUND',
      detail: 'RFQ line not found.',
    });
  }

  private quotationNotFound() {
    return new NotFoundException({
      code: 'SUPPLIER_QUOTATION_NOT_FOUND',
      detail: 'Supplier Quotation not found.',
    });
  }
}
