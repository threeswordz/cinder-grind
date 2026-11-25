import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { APPROVAL_STATE, ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { completeSupplierCount, poQuoteBasis } from './purchase-order-quote-policy';
import { purchaseOrderCompanyPrefix, purchaseOrderPresentation } from './purchase-order-identity';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type LineUpdate = {
  quantity?: Prisma.Decimal;
  unitPrice?: Prisma.Decimal;
  wbsId?: string | null;
  costCodeId?: string | null;
  requiredOnSite?: Date | null;
  expectedDelivery?: Date | null;
  remarks?: string | null;
};

@Injectable()
export class PurchaseOrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
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

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'PURCHASE_ORDER',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const [wbs, costCodes] = await Promise.all([
      this.prisma.wbsElement.findMany({
        where: { projectId, isActive: true },
        select: { id: true, wbsCode: true, wbsName: true },
        orderBy: { wbsCode: 'asc' },
      }),
      this.prisma.costCode.findMany({
        where: { companyId: auth.companyId, isActive: true },
        select: { id: true, costCode: true, costName: true },
        orderBy: { costCode: 'asc' },
      }),
    ]);
    return { wbs, costCodes };
  }

  async availableAwards(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    const awards = await this.prisma.quotationAward.findMany({
      where: {
        rfq: {
          companyId: auth.companyId,
          projectId,
        },
        purchaseOrderLines: { none: {} },
      },
      include: {
        rfq: {
          select: {
            id: true,
            rfqNumber: true,
            projectId: true,
          },
        },
        rfqLine: {
          include: {
            purchaseRequestLine: {
              include: {
                purchaseRequest: {
                  include: {
                    approvalInstance: {
                      select: { approvalState: true },
                    },
                  },
                },
                material: {
                  select: {
                    id: true,
                    materialCode: true,
                    materialName: true,
                  },
                },
                uom: {
                  select: {
                    id: true,
                    uomCode: true,
                    uomName: true,
                  },
                },
                wbs: {
                  select: { id: true, wbsCode: true, wbsName: true },
                },
                costCode: {
                  select: { id: true, costCode: true, costName: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ selectedAt: 'asc' }, { id: 'asc' }],
    });

    return awards
      .filter((award) => {
        const request = award.rfqLine.purchaseRequestLine.purchaseRequest;
        return (
          !request.cancelledAt &&
          award.rfqLine.purchaseRequestLine.reviewDecision !== 'RETURNED' &&
          request.approvalInstance?.approvalState === APPROVAL_STATE.APPROVED
        );
      })
      .map((award) => ({
        id: award.id,
        rfqId: award.rfqId,
        rfqNumber: award.rfq.rfqNumber,
        rfqLineId: award.rfqLineId,
        purchaseRequestLineId:
          award.rfqLine.purchaseRequestLineId,
        prNumber:
          award.rfqLine.purchaseRequestLine.purchaseRequest.prNumber,
        supplierId: award.supplierId,
        supplierCodeSnapshot: award.supplierCodeSnapshot,
        supplierNameSnapshot: award.supplierNameSnapshot,
        lineType: award.rfqLine.purchaseRequestLine.lineType,
        material: award.rfqLine.purchaseRequestLine.material,
        description:
          award.rfqLine.purchaseRequestLine.description,
        quantity: award.quantity,
        uom: award.rfqLine.purchaseRequestLine.uom,
        unitPrice: award.unitPrice,
        amount: award.amount,
        wbs: award.rfqLine.purchaseRequestLine.wbs,
        costCode: award.rfqLine.purchaseRequestLine.costCode,
        requiredOnSite:
          award.rfqLine.purchaseRequestLine.requiredOnSite,
        selectedAt: award.selectedAt,
      }));
  }

  async listOrders(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
      },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
          },
        },
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            currentStepNo: true,
            startedAt: true,
            completedAt: true,
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: [
        { createdAt: 'desc' },
        { poNumber: 'desc' },
        { revisionNo: 'desc' },
      ],
    });
    return rows.map((row) => this.withLifecycle(row));
  }

  async getOrder(
    auth: AuthenticatedUserContext,
    orderId: string,
  ) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: orderId,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
          },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        cancelledBy: {
          select: { id: true, displayName: true, email: true },
        },
        previousRevision: {
          select: { id: true, poNumber: true, revisionNo: true },
        },
        nextRevision: {
          select: {
            id: true,
            poNumber: true,
            revisionNo: true,
            cancelledAt: true,
            approvalInstance: {
              select: { approvalState: true },
            },
          },
        },
        approvalInstance: {
          include: {
            workflow: {
              select: {
                id: true,
                workflowCode: true,
                workflowName: true,
              },
            },
            actions: {
              orderBy: { actionAt: 'asc' },
              include: {
                actionByUser: {
                  select: {
                    id: true,
                    displayName: true,
                    email: true,
                  },
                },
                approvalStep: {
                  select: {
                    id: true,
                    stepNo: true,
                    stepName: true,
                  },
                },
              },
            },
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
          include: {
            material: {
              select: {
                id: true,
                materialCode: true,
                materialName: true,
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
            quotationAward: {
              select: {
                id: true,
                selectedAt: true,
                supplierCodeSnapshot: true,
                supplierNameSnapshot: true,
              },
            },
            rfq: {
              select: { id: true, rfqNumber: true },
            },
            purchaseRequestLine: {
              include: {
                purchaseRequest: {
                  select: { id: true, prNumber: true },
                },
              },
            },
            supplierQuotation: {
              select: {
                id: true,
                supplierReference: true,
                quotationDate: true,
              },
            },
          },
        },
      },
    });

    if (!row) throw this.orderNotFound();
    await this.access.assertAccess(auth, row.projectId);
    return this.withLifecycle(row);
  }

  async revisions(
    auth: AuthenticatedUserContext,
    orderId: string,
  ) {
    const source = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, companyId: auth.companyId },
      select: { projectId: true, poNumber: true },
    });
    if (!source) throw this.orderNotFound();
    await this.access.assertAccess(auth, source.projectId);

    const rows = await this.prisma.purchaseOrder.findMany({
      where: {
        companyId: auth.companyId,
        poNumber: source.poNumber,
      },
      include: {
        approvalInstance: {
          select: {
            approvalState: true,
            startedAt: true,
            completedAt: true,
          },
        },
        createdBy: {
          select: { id: true, displayName: true, email: true },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        cancelledBy: {
          select: { id: true, displayName: true, email: true },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { revisionNo: 'asc' },
    });
    return rows.map((row) => this.withLifecycle(row));
  }

  async createOrder(
    context: AuditContext,
    projectId: string,
    awardIds: string[],
    remarks?: string | null,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    await this.assertApprovedNumbering(context.auth.companyId);

    const uniqueAwardIds = [...new Set(awardIds)];
    if (!uniqueAwardIds.length || uniqueAwardIds.length !== awardIds.length) {
      throw new UnprocessableEntityException({
        code: 'PO_AWARDS_INVALID',
        detail:
          'Select one or more distinct Supplier Award lines for the Purchase Order.',
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: context.auth.companyId },
      select: { companyCode: true },
    });
    if (!company) {
      throw new ConflictException({ code: 'PO_COMPANY_NOT_FOUND' });
    }
    // Keep missing-short-name refusals ahead of the legacy monthly allocator.
    if (purchaseOrderCompanyPrefix(company.companyCode)) {
      const candidate = await this.prisma.quotationAward.findFirst({
        where: {
          id: { in: uniqueAwardIds },
          rfq: { companyId: context.auth.companyId, projectId },
        },
        select: { supplier: { select: { shortName: true } } },
      });
      if (!candidate?.supplier.shortName?.trim()) {
        throw new UnprocessableEntityException({
          code: 'PO_SUPPLIER_SHORT_NAME_REQUIRED',
          detail: 'Configure the supplier short name separately from its code before preparing a new MKE/TCJ Purchase Order.',
        });
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);

        for (const awardId of [...uniqueAwardIds].sort()) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'po-award:' + awardId,
          );
        }

        const awards = await tx.quotationAward.findMany({
          where: {
            id: { in: uniqueAwardIds },
            rfq: {
              companyId: context.auth.companyId,
              projectId,
            },
          },
          include: {
            supplier: {
              select: { id: true, companyId: true, isActive: true, shortName: true },
            },
            rfq: {
              select: {
                id: true,
                companyId: true,
                projectId: true,
              },
            },
            rfqLine: {
              include: {
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
            },
          },
        });

        if (awards.length !== uniqueAwardIds.length) {
          throw new UnprocessableEntityException({
            code: 'PO_AWARDS_INVALID',
            detail:
              'Every selected Supplier Award must belong to this accessible Project.',
          });
        }

        const supplierId = awards[0]!.supplierId;
        if (awards.some((award) => award.supplierId !== supplierId)) {
          throw new UnprocessableEntityException({
            code: 'PO_SUPPLIER_MISMATCH',
            detail:
              'One Purchase Order can contain award lines from only one Supplier.',
          });
        }

        if (
          awards.some(
            (award) =>
              !award.supplier.isActive ||
              award.supplier.companyId !== context.auth.companyId,
          )
        ) {
          throw new ConflictException({
            code: 'PO_SUPPLIER_INACTIVE',
            detail:
              'A new Purchase Order cannot be created for an inactive Supplier.',
          });
        }

        for (const award of awards) {
          const request =
            award.rfqLine.purchaseRequestLine.purchaseRequest;
          if (
            request.cancelledAt ||
            award.rfqLine.purchaseRequestLine.reviewDecision === 'RETURNED' ||
            request.approvalInstance?.approvalState !==
              APPROVAL_STATE.APPROVED
          ) {
            throw new ConflictException({
              code: 'PO_SOURCE_DEMAND_INACTIVE',
              detail:
                'Purchase Order source awards require active approved Purchase Request demand.',
            });
          }
        }

        const prior = await tx.purchaseOrderLine.findFirst({
          where: {
            quotationAwardId: { in: uniqueAwardIds },
          },
          select: {
            quotationAwardId: true,
            purchaseOrder: {
              select: { poNumber: true },
            },
          },
        });
        if (prior) {
          throw new ConflictException({
            code: 'PO_AWARD_ALREADY_USED',
            detail:
              'A selected Supplier Award is already assigned to a Purchase Order.',
          });
        }

        const freshSupplier = await tx.supplier.findFirst({
          where: { id: supplierId, companyId: context.auth.companyId, isActive: true },
          select: { shortName: true },
        });
        if (!freshSupplier) {
          throw new ConflictException({ code: 'PO_SUPPLIER_INACTIVE' });
        }
        // Allocate within the same transaction as the validated source,
        // immutable display snapshot, lines and audit. A rejected draft must
        // not consume a canonical Company sequence value.
        const currentCompany = await tx.company.findUnique({
          where: { id: context.auth.companyId },
          select: { companyCode: true, isActive: true },
        });
        if (!currentCompany?.isActive)
          throw new ConflictException({ code: 'PO_COMPANY_NOT_FOUND' });
        await this.assertApprovedNumbering(context.auth.companyId, tx);
        const poNumber = await this.numbers.next(
          context.auth.companyId, 'PURCHASE_ORDER', new Date(), tx,
        );
        const identity = purchaseOrderPresentation(
          currentCompany.companyCode, poNumber, freshSupplier.shortName,
        );
        if (purchaseOrderCompanyPrefix(currentCompany.companyCode) && !identity.displayNumber) {
          throw new UnprocessableEntityException({
            code: 'PO_SUPPLIER_SHORT_NAME_REQUIRED',
            detail: 'The selected supplier needs a separately managed short name before a new MKE/TCJ PO.',
          });
        }
        const order = await tx.purchaseOrder.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            supplierId,
            poNumber,
            displayNumber: identity.displayNumber,
            supplierShortNameSnapshot: identity.supplierShortNameSnapshot,
            revisionNo: 0,
            remarks: remarks ?? null,
            createdByUserId: context.auth.userId,
          },
        });

        const sorted = [...awards].sort((a, b) =>
          a.rfqLineId.localeCompare(b.rfqLineId),
        );
        let lineNo = 1;
        for (const award of sorted) {
          const source = award.rfqLine.purchaseRequestLine;
          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: order.id,
              lineNo,
              quotationAwardId: award.id,
              purchaseRequestLineId: source.id,
              rfqId: award.rfqId,
              rfqLineId: award.rfqLineId,
              supplierQuotationId: award.supplierQuotationId,
              supplierQuotationLineId:
                award.supplierQuotationLineId,
              lineType: source.lineType,
              materialId: source.materialId,
              materialCodeSnapshot:
                source.materialCodeSnapshot,
              description: source.description,
              quantity: award.quantity,
              uomId: award.uomId,
              uomCodeSnapshot: award.uomCodeSnapshot,
              unitPrice: award.unitPrice,
              amount: award.amount,
              wbsId: source.wbsId,
              costCodeId: source.costCodeId,
              requiredOnSite: source.requiredOnSite,
            },
          });
          lineNo += 1;
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_ORDER',
            entityId: order.id,
            action: 'CREATE_DRAFT',
            newValues: {
              poNumber,
              displayNumber: identity.displayNumber,
              supplierShortNameSnapshot: identity.supplierShortNameSnapshot,
              revisionNo: 0,
              projectId,
              supplierId,
              awardIds: uniqueAwardIds,
            },
          },
          tx,
        );

        return this.getOrderWithClient(
          tx,
          context.auth.companyId,
          order.id,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateOrder(
    context: AuditContext,
    orderId: string,
    data: {
      remarks?: string | null;
      revisionReason?: string | null;
      deliveryLocation?: string | null;
      deliveryContact?: string | null;
      deliveryTerms?: string | null;
      paymentTerms?: string | null;
      creditTerms?: string | null;
      discountAmount?: Prisma.Decimal | null;
      freightAmount?: Prisma.Decimal | null;
      additionalChargeAmount?: Prisma.Decimal | null;
      vatRatePercent?: Prisma.Decimal | null;
      supplierQuoteExceptionReason?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.orderForDraft(
        tx,
        context.auth,
        orderId,
      );
      if (data.vatRatePercent != null &&
          (!data.vatRatePercent.isFinite() || data.vatRatePercent.lt(0) || data.vatRatePercent.gt(100))) {
        throw new UnprocessableEntityException({
          code: 'PO_VAT_PERCENT_INVALID',
          detail: 'VAT percentage must be between 0 and 100.',
        });
      }
      // PostgreSQL DECIMAL(18,2) would silently round a 3/4-decimal
      // amount from the shared procurement validator; reject instead.
      for (const [field, value] of [
        ['discountAmount', data.discountAmount],
        ['freightAmount', data.freightAmount],
        ['additionalChargeAmount', data.additionalChargeAmount],
        ['vatRatePercent', data.vatRatePercent],
      ] as const) {
        // Preserve explicit NULL (unknown) and undefined (unchanged). Validate
        // direct service callers as well as controller-validated requests.
        if (value == null) continue;
        if (!value.isFinite() || value.lt(0) || value.gte('10000000000000000')) {
          throw new UnprocessableEntityException({
            code: 'PO_COMMERCIAL_AMOUNT_INVALID',
            detail: field + ' must be nonnegative, finite and within storage range.',
          });
        }
        if (value.decimalPlaces() > 2) {
          throw new UnprocessableEntityException({
            code: 'PO_COMMERCIAL_PRECISION_INVALID',
            detail: field + ' may contain at most two decimal places.',
          });
        }
      }
      const updated = await tx.purchaseOrder.update({
        where: { id: current.id },
        data,
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_ORDER',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: {
            remarks: current.remarks,
            revisionReason: current.revisionReason,
            deliveryLocation: current.deliveryLocation,
            deliveryContact: current.deliveryContact,
            deliveryTerms: current.deliveryTerms,
            paymentTerms: current.paymentTerms,
            creditTerms: current.creditTerms,
            discountAmount: current.discountAmount,
            freightAmount: current.freightAmount,
            additionalChargeAmount: current.additionalChargeAmount,
            vatRatePercent: current.vatRatePercent,
            supplierQuoteExceptionReason: current.supplierQuoteExceptionReason,
          },
          newValues: {
            remarks: updated.remarks,
            revisionReason: updated.revisionReason,
            deliveryLocation: updated.deliveryLocation,
            deliveryContact: updated.deliveryContact,
            deliveryTerms: updated.deliveryTerms,
            paymentTerms: updated.paymentTerms,
            creditTerms: updated.creditTerms,
            discountAmount: updated.discountAmount,
            freightAmount: updated.freightAmount,
            additionalChargeAmount: updated.additionalChargeAmount,
            vatRatePercent: updated.vatRatePercent,
            supplierQuoteExceptionReason: updated.supplierQuoteExceptionReason,
          },
        },
        tx,
      );
      return { ...updated, lifecycleState: 'DRAFT' as const };
    });
  }

  async updateLine(
    context: AuditContext,
    lineId: string,
    input: LineUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.purchaseOrderLine.findFirst({
        where: {
          id: lineId,
          purchaseOrder: {
            companyId: context.auth.companyId,
          },
        },
        include: {
          purchaseOrder: true,
          quotationAward: { select: { quantity: true } },
        },
      });
      if (!current) throw this.lineNotFound();
      await this.access.assertAccess(
        context.auth,
        current.purchaseOrder.projectId,
        tx,
      );
      this.assertDraft(current.purchaseOrder);

      const wbsId =
        input.wbsId !== undefined ? input.wbsId : current.wbsId;
      const costCodeId =
        input.costCodeId !== undefined
          ? input.costCodeId
          : current.costCodeId;

      if (wbsId) {
        const wbs = await tx.wbsElement.findFirst({
          where: {
            id: wbsId,
            projectId: current.purchaseOrder.projectId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!wbs) {
          throw new UnprocessableEntityException({
            code: 'PO_WBS_INVALID',
            detail:
              'Purchase Order WBS must be active and belong to the same Project.',
          });
        }
      }

      if (costCodeId) {
        const cost = await tx.costCode.findFirst({
          where: {
            id: costCodeId,
            companyId: context.auth.companyId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!cost) {
          throw new UnprocessableEntityException({
            code: 'PO_COST_CODE_INVALID',
            detail:
              'Purchase Order Cost Code must be active and belong to the same Company.',
          });
        }
      }

      const quantity = input.quantity ?? current.quantity;
      if (quantity.gt(current.quotationAward.quantity)) {
        throw new UnprocessableEntityException({
          code: 'PO_QUANTITY_EXCEEDS_AWARD',
          detail:
            'Purchase Order quantity cannot exceed the selected Supplier Award quantity.',
        });
      }
      if (input.quantity !== undefined) {
        await this.assertReceivedQuantityFloor(
          tx, current.purchaseOrder, current.quotationAwardId, quantity,
        );
      }
      const unitPrice = input.unitPrice ?? current.unitPrice;
      const updated = await tx.purchaseOrderLine.update({
        where: { id: current.id },
        data: {
          ...(input.quantity !== undefined
            ? { quantity: input.quantity }
            : {}),
          ...(input.unitPrice !== undefined
            ? { unitPrice: input.unitPrice }
            : {}),
          ...(input.quantity !== undefined ||
          input.unitPrice !== undefined
            ? { amount: quantity.mul(unitPrice) }
            : {}),
          ...(input.wbsId !== undefined
            ? { wbsId: input.wbsId }
            : {}),
          ...(input.costCodeId !== undefined
            ? { costCodeId: input.costCodeId }
            : {}),
          ...(input.requiredOnSite !== undefined
            ? { requiredOnSite: input.requiredOnSite }
            : {}),
          ...(input.expectedDelivery !== undefined
            ? { expectedDelivery: input.expectedDelivery }
            : {}),
          ...(input.remarks !== undefined
            ? { remarks: input.remarks }
            : {}),
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_ORDER_LINE',
          entityId: current.id,
          action: 'UPDATE_DRAFT',
          oldValues: this.lineAuditValues(current),
          newValues: this.lineAuditValues(updated),
        },
        tx,
      );
      return updated;
    });
  }

  async deleteLine(
    context: AuditContext,
    lineId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.purchaseOrderLine.findFirst({
        where: {
          id: lineId,
          purchaseOrder: {
            companyId: context.auth.companyId,
          },
        },
        include: { purchaseOrder: true },
      });
      if (!current) throw this.lineNotFound();
      await this.access.assertAccess(
        context.auth,
        current.purchaseOrder.projectId,
        tx,
      );
      this.assertDraft(current.purchaseOrder);

      await this.assertReceivedQuantityFloor(
        tx, current.purchaseOrder, current.quotationAwardId, new Prisma.Decimal(0),
      );

      await tx.purchaseOrderLine.delete({
        where: { id: current.id },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_ORDER_LINE',
          entityId: current.id,
          action: 'DELETE_DRAFT_LINE',
          oldValues: {
            purchaseOrderId: current.purchaseOrderId,
            lineNo: current.lineNo,
            quotationAwardId: current.quotationAwardId,
          },
        },
        tx,
      );
      return { id: current.id };
    });
  }

  async submit(
    context: AuditContext,
    orderId: string,
    workflowCode: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.purchaseOrder.findFirst({
          where: {
            id: orderId,
            companyId: context.auth.companyId,
          },
          include: {
            lines: true,
            nextRevision: {
              select: { id: true },
            },
          },
        });
        if (!order) throw this.orderNotFound();
        await this.access.assertAccess(
          context.auth,
          order.projectId,
          tx,
        );
        this.assertDraft(order);

        if (!order.lines.length) {
          throw new UnprocessableEntityException({
            code: 'PO_LINES_REQUIRED',
            detail:
              'A Purchase Order revision must contain at least one line before submission.',
          });
        }
        if (order.nextRevision) {
          throw new ConflictException({
            code: 'PO_NOT_LATEST_REVISION',
            detail:
              'Only the latest Purchase Order revision can be submitted.',
          });
        }

        // PUR04: a nominal discount cannot exceed the authoritative PO
        // line subtotal. This does not implement PUR01 quote-count admission:
        // legacy NULL commercial fields remain UNKNOWN, not zero.
        const grossLineTotal = order.lines.reduce(
          (sum, line) => sum.plus(line.amount),
          new Prisma.Decimal(0),
        );
        if (order.discountAmount && order.discountAmount.gt(grossLineTotal)) {
          throw new UnprocessableEntityException({
            code: 'PO_DISCOUNT_EXCEEDS_SUBTOTAL',
            detail: 'PO header discount cannot exceed the line subtotal.',
          });
        }

        // PM02: active approved demand must be scoped to this Company/Project.
        await this.assertActiveDemand(tx, order);
        // Revalidate whole-PO commercial basis only after active-demand checks.
        const quotePolicy = await this.assertPoQuotePolicy(tx, order);

        const approvalInstance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'PURCHASE_ORDER',
            entityId: order.id,
          },
          tx,
        );

        const submittedAt = new Date();
        const updated = await tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            approvalInstanceId: approvalInstance.id,
            submittedByUserId: context.auth.userId,
            currencyCode: 'THB',
            submittedAt,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_ORDER',
            entityId: order.id,
            action: 'SUBMIT',
            newValues: {
              poNumber: order.poNumber,
              revisionNo: order.revisionNo,
              approvalInstanceId: approvalInstance.id,
              quotePolicy,
              lineCount: order.lines.length,
              submittedAt,
            },
          },
          tx,
        );

        return {
          ...updated,
          lifecycleState: approvalInstance.approvalState,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async approve(
    context: AuditContext,
    orderId: string,
    comment?: string,
  ) {
    const order = await this.orderForApproval(
      context.auth,
      orderId,
    );
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: order.supplierId,
        companyId: context.auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!supplier) {
      throw new ConflictException({
        code: 'PO_SUPPLIER_INACTIVE',
        detail:
          'This Purchase Order cannot be approved for an inactive Supplier.',
      });
    }

    await this.assertActiveDemand(this.prisma, {
      companyId: context.auth.companyId, projectId: order.projectId,
      lines: order.purchaseRequestLineIds.map(purchaseRequestLineId => ({ purchaseRequestLineId })),
    });

    const instance = await this.approvals.approve(
      order.approvalInstanceId,
      context.auth,
      order.submittedByUserId,
      comment,
      async (tx) => {
        const source = await tx.purchaseOrder.findFirst({
          where: { id: order.id, companyId: context.auth.companyId },
          include: { lines: true },
        });
        if (!source) throw this.orderNotFound();
        // The preflight read is not sufficient: demand, supplier or Project
        // access may have changed before the serializable final approval.
        await this.access.assertAccess(context.auth, source.projectId, tx);
        if (source.cancelledAt || source.approvalInstanceId !== order.approvalInstanceId ||
            source.submittedByUserId !== order.submittedByUserId)
          throw new ConflictException({ code: 'PO_NOT_SUBMITTED' });
        await this.assertActiveDemand(tx, source);
        const activeSupplier = await tx.supplier.findFirst({
          where: { id: source.supplierId, companyId: source.companyId, isActive: true },
          select: { id: true },
        });
        if (!activeSupplier) throw new ConflictException({ code: 'PO_SUPPLIER_INACTIVE' });
        const finalQuotePolicy = await this.assertPoQuotePolicy(tx, source, context.auth);
        const lines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrderId: order.id },
          select: { quotationAwardId: true, quantity: true },
        });
        for (const line of lines) {
          await this.assertReceivedQuantityFloor(
            tx,
            { companyId: context.auth.companyId, poNumber: order.poNumber },
            line.quotationAwardId,
            line.quantity,
          );
        }
        // Preserve final comparison evidence in the same approval transaction (#442).
        await this.audit.record({
          ...context,
          entityType: 'PURCHASE_ORDER',
          entityId: source.id,
          action: 'PUR01_FINAL_QUOTE_POLICY',
          newValues: {
            approvalInstanceId: source.approvalInstanceId,
            poNumber: source.poNumber,
            revisionNo: source.revisionNo,
            projectId: source.projectId,
            supplierId: source.supplierId,
            ...finalQuotePolicy,
          },
        }, tx);
      },
    );
    await this.audit.record({
      ...context,
      entityType: 'PURCHASE_ORDER',
      entityId: order.id,
      action: 'APPROVAL_APPROVE',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });
    return this.getOrder(context.auth, order.id);
  }

  async reject(
    context: AuditContext,
    orderId: string,
    comment?: string,
  ) {
    const order = await this.orderForApproval(
      context.auth,
      orderId,
    );
    const instance = await this.approvals.reject(
      order.approvalInstanceId,
      context.auth,
      order.submittedByUserId,
      comment,
    );
    await this.audit.record({
      ...context,
      entityType: 'PURCHASE_ORDER',
      entityId: order.id,
      action: 'APPROVAL_REJECT',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });
    return this.getOrder(context.auth, order.id);
  }

  // PUR10: prevent any controller, test helper, script or internal caller from
  // bypassing the independently recorded cancellation decision.
  async cancel(_context: AuditContext, _orderId: string, _reason: string): Promise<never> {
    throw new ConflictException({
      code: 'PUR10_INDEPENDENT_CANCELLATION_REVIEW_REQUIRED',
    });
  }

  /**
   * The ONLY PO cancellation writer. Must be invoked inside an already-open
   * PUR10 advisory-locked transaction after independent Ben case replay and
   * canonical receipt/Finance checks. It re-admits the exact recorded Ben
   * decision itself and retains the original PO/receipt/AP/revision guards.
   */
  async cancelForReviewedCase(
    context: AuditContext,
    orderId: string,
    reason: string,
    caseId: string,
    benEventId: string,
    expectedPoUpdatedAt: string,
    tx: Prisma.TransactionClient,
  ) {
    const recorded = await tx.auditLog.findFirst({
      where: {
        id: benEventId, companyId: context.auth.companyId,
        entityType: 'PURCHASE_ORDER_CANCELLATION', entityId: orderId,
        action: 'BEN_APPROVE', actorUserId: context.auth.userId,
      },
      select: { newValues: true },
    });
    const values = recorded?.newValues;
    if (!values || typeof values !== 'object' || Array.isArray(values) ||
        values.caseId !== caseId || values.status !== 'BEN_APPROVED' ||
        values.orderId !== orderId || values.orderUpdatedAt !== expectedPoUpdatedAt ||
        values.benUserId !== context.auth.userId) {
      throw new ConflictException({ code: 'PUR10_VERIFIED_BEN_EVENT_REQUIRED' });
    }
    // Match the existing revision lock order BEFORE taking the row lock;
    // otherwise an already-started revise() could create a later revision.
    const initial = await tx.purchaseOrder.findFirst({
      where: { id: orderId, companyId: context.auth.companyId },
      select: { poNumber: true },
    });
    if (!initial) throw this.orderNotFound();
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'purchase-order:' + initial.poNumber,
    );
    // Lock the PO source row to prevent concurrent edits/cancel writes while
    // retaining the original receipt and Finance advisory guards.
    const locked = await tx.$queryRaw<Array<{id: string}>>(Prisma.sql`
      SELECT "id" FROM "purchase_orders"
      WHERE "id" = ${orderId}::uuid
        AND "company_id" = ${context.auth.companyId}::uuid
      FOR UPDATE
    `);
    if (locked.length !== 1) throw this.orderNotFound();
    const pinned = await tx.purchaseOrder.findFirst({
      where: { id: orderId, companyId: context.auth.companyId },
      select: { updatedAt: true },
    });
    if (pinned?.updatedAt.toISOString() !== expectedPoUpdatedAt) {
      throw new ConflictException({ code: 'PUR10_SOURCE_CHANGED_SINCE_BEN_REVIEW' });
    }
        const order = await tx.purchaseOrder.findFirst({
          where: {
            id: orderId,
            companyId: context.auth.companyId,
          },
          include: {
            approvalInstance: {
              select: {
                id: true,
                approvalState: true,
              },
            },
            nextRevision: {
              select: { id: true },
            },
            lines: {
              orderBy: { lineNo: 'asc' },
            },
          },
        });
        if (!order) throw this.orderNotFound();
        await this.access.assertAccess(
          context.auth,
          order.projectId,
          tx,
        );

        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'receipt-po:' + order.companyId + ':' + order.poNumber,
        );
        // Finance can source invoices from a historical revision of this
        // PO number. Lock every family line in stable order, not only current
        // lines, before checking the absence of any invoice source.
        const familyLines = await tx.purchaseOrderLine.findMany({
          where: { purchaseOrder: {
            companyId: order.companyId, poNumber: order.poNumber,
          } },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        for (const line of familyLines) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'finance-source:po-line:' + line.id,
          );
        }
        // PUR10 denies any invoice source, even a draft or one linked to an
        // earlier revision of this PO number. Cancelling must not orphan AP.
        const anyInvoiceSource = await tx.supplierInvoiceItem.findFirst({
          where: {
            purchaseOrderLine: { purchaseOrder: {
              companyId: order.companyId, poNumber: order.poNumber,
            } },
          },
          select: { id: true },
        });
        if (anyInvoiceSource) {
          throw new ConflictException({
            code: 'PO_CANCEL_FINANCE_SOURCE_LOCKED',
            detail: 'A Purchase Order referenced by any Supplier Invoice cannot be cancelled.',
          });
        }
        const outstandingReceipt = await tx.goodsReceipt.findFirst({
          where: {
            postedAt: { not: null },
            reversedAt: null,
            purchaseOrder: {
              companyId: order.companyId,
              poNumber: order.poNumber,
            },
          },
          select: { id: true },
        });
        if (outstandingReceipt) {
          throw new ConflictException({
            code: 'PO_HAS_OUTSTANDING_RECEIPT',
            detail: 'Reverse all posted Goods Receipts before cancelling this Purchase Order.',
          });
        }

        // Reversal does not erase the receipt/delivery record. PUR10 exception
        // policies remain unapproved, so even unposted/reversed sources block.
        const anyReceipt = await tx.goodsReceipt.findFirst({
          where: {
            purchaseOrder: {
              companyId: order.companyId, poNumber: order.poNumber,
            },
          },
          select: { id: true },
        });
        const anyDelivery = await tx.receivingDelivery.findFirst({
          where: {
            companyId: order.companyId,
            purchaseOrder: { companyId: order.companyId, poNumber: order.poNumber },
          },
          select: { id: true },
        });
        if (anyReceipt || anyDelivery) {
          throw new ConflictException({
            code: 'PUR10_RECEIPT_OR_DELIVERY_EXCEPTION_REQUIRES_DECISION',
            detail: 'Receipt/delivery source exists; explicit exception policy is required.',
          });
        }

        const state = this.lifecycleOf(order);
        if (state === 'CANCELLED') {
          throw new ConflictException({
            code: 'PO_ALREADY_CANCELLED',
            detail:
              'This Purchase Order revision is already cancelled.',
          });
        }
        if (state === APPROVAL_STATE.REJECTED) {
          throw new ConflictException({
            code: 'PO_REJECTED_IMMUTABLE',
            detail:
              'A rejected Purchase Order revision is retained history and cannot be cancelled.',
          });
        }
        const blockingNewerRevision =
          await tx.purchaseOrder.findFirst({
            where: {
              companyId: order.companyId,
              poNumber: order.poNumber,
              revisionNo: { gt: order.revisionNo },
              cancelledAt: null,
              OR: [
                { approvalInstanceId: null },
                {
                  approvalInstance: {
                    approvalState: {
                      not: APPROVAL_STATE.REJECTED,
                    },
                  },
                },
              ],
            },
            select: { id: true },
          });
        if (blockingNewerRevision) {
          throw new ConflictException({
            code: 'PO_HAS_NEWER_REVISION',
            detail:
              'A Purchase Order revision with a newer active revision cannot be cancelled directly.',
          });
        }
        if (
          state === APPROVAL_STATE.SUBMITTED &&
          order.approvalInstanceId
        ) {
          await this.approvals.cancel(
            order.approvalInstanceId,
            context.auth,
            tx,
          );
        }

        const cancelledAt = new Date();
        const updated = await tx.purchaseOrder.update({
          where: { id: order.id },
          data: {
            cancelledByUserId: context.auth.userId,
            cancelledAt,
            cancellationReason: reason,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_ORDER',
            entityId: order.id,
            action: 'CANCEL',
            oldValues: { lifecycleState: state },
            newValues: {
              lifecycleState: 'CANCELLED',
              cancelledAt,
              cancellationReason: reason,
            },
          },
          tx,
        );
        return {
          ...updated,
          lifecycleState: 'CANCELLED' as const,
        };
  }

  async revise(
    context: AuditContext,
    orderId: string,
    revisionReason?: string | null,
  ) {
    // Both competing PO lifecycle writers must participate in PostgreSQL SSI.
    // The family lock alone cannot refresh a SERIALIZABLE finalizer's earlier
    // snapshot when the revision inserts a child without updating the parent.
    try {
      return await this.prisma.$transaction(
      async (tx) => {
        const source = await tx.purchaseOrder.findFirst({
          where: {
            id: orderId,
            companyId: context.auth.companyId,
          },
          include: {
            approvalInstance: {
              select: { approvalState: true },
            },
            nextRevision: {
              select: { id: true },
            },
            lines: {
              orderBy: { lineNo: 'asc' },
            },
          },
        });
        if (!source) throw this.orderNotFound();
        await this.access.assertAccess(
          context.auth,
          source.projectId,
          tx,
        );

        const sourceApprovalState =
          source.approvalInstance?.approvalState;
        if (
          source.cancelledAt ||
          (sourceApprovalState !== APPROVAL_STATE.APPROVED &&
            sourceApprovalState !== APPROVAL_STATE.REJECTED)
        ) {
          throw new ConflictException({
            code: 'PO_REVISION_SOURCE_INVALID',
            detail:
              'A new Purchase Order revision must originate from an active approved or retained rejected revision.',
          });
        }
        if (source.nextRevision) {
          throw new ConflictException({
            code: 'PO_REVISION_ALREADY_EXISTS',
            detail:
              'This Purchase Order revision already has a newer revision.',
          });
        }

        const activeSupplier = await tx.supplier.findFirst({
          where: {
            id: source.supplierId,
            companyId: source.companyId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!activeSupplier) {
          throw new ConflictException({
            code: 'PO_SUPPLIER_INACTIVE',
            detail:
              'A Purchase Order revision cannot be created for an inactive Supplier.',
          });
        }

        const sourceRequestLines = await tx.purchaseRequestLine.findMany({
          where: {
            id: {
              in: source.lines.map(
                (line) => line.purchaseRequestLineId,
              ),
            },
          },
          include: {
            purchaseRequest: {
              include: {
                approvalInstance: {
                  select: { approvalState: true },
                },
              },
            },
          },
        });
        if (
          sourceRequestLines.length !== source.lines.length ||
          sourceRequestLines.some(
            (line) =>
              line.reviewDecision === 'RETURNED' ||
              line.purchaseRequest.cancelledAt ||
              line.purchaseRequest.approvalInstance?.approvalState !==
                APPROVAL_STATE.APPROVED,
          )
        ) {
          throw new ConflictException({
            code: 'PO_SOURCE_DEMAND_INACTIVE',
            detail:
              'A Purchase Order revision requires active approved Purchase Request demand.',
          });
        }

        if (sourceApprovalState === APPROVAL_STATE.REJECTED) {
          const cancelledApprovedRevision =
            await tx.purchaseOrder.findFirst({
              where: {
                companyId: source.companyId,
                poNumber: source.poNumber,
                cancelledAt: { not: null },
                approvalInstance: {
                  approvalState: APPROVAL_STATE.APPROVED,
                },
              },
              select: { id: true },
            });
          if (cancelledApprovedRevision) {
            throw new ConflictException({
              code: 'PO_COMMITMENT_CANCELLED',
              detail:
                'A rejected Purchase Order cannot be retried after the approved commitment has been cancelled.',
            });
          }
        }

        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'purchase-order:' + source.poNumber,
        );
        for (const line of [...source.lines].sort((a, b) => a.id.localeCompare(b.id))) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'finance-source:po-line:' + line.id,
          );
        }
        const approvedInvoiceSource = await tx.supplierInvoiceItem.findFirst({
          where: {
            purchaseOrderLineId: { in: source.lines.map((line) => line.id) },
            supplierInvoice: { state: 'APPROVED' },
          },
          select: { id: true },
        });
        if (approvedInvoiceSource) {
          throw new ConflictException({
            code: 'PO_REVISION_FINANCE_SOURCE_LOCKED',
            detail:
              'A Purchase Order revision cannot supersede lines referenced by an approved Supplier Invoice.',
          });
        }

        const afterLock = await tx.purchaseOrder.findFirst({
          where: { id: source.id },
          include: {
            nextRevision: { select: { id: true } },
          },
        });
        if (!afterLock || afterLock.nextRevision) {
          throw new ConflictException({
            code: 'PO_REVISION_ALREADY_EXISTS',
            detail:
              'This Purchase Order revision already has a newer revision.',
          });
        }

        // A cancellation may have committed while this revision waited on
        // the shared PO-family lock. Never create a successor from that stale
        // pre-lock read, even when no other revision has been inserted.
        if (afterLock.cancelledAt) {
          throw new ConflictException({
            code: 'PO_REVISION_SOURCE_INVALID',
            detail: 'A cancelled Purchase Order cannot be revised.',
          });
        }

        const revision = await tx.purchaseOrder.create({
          data: {
            companyId: source.companyId,
            projectId: source.projectId,
            supplierId: source.supplierId,
            poNumber: source.poNumber,
            displayNumber: source.displayNumber,
            supplierShortNameSnapshot: source.supplierShortNameSnapshot,
            currencyCode: source.currencyCode,
            revisionNo: source.revisionNo + 1,
            previousRevisionId: source.id,
            revisionReason: revisionReason ?? null,
            remarks: source.remarks,
            deliveryLocation: source.deliveryLocation,
            deliveryContact: source.deliveryContact,
            deliveryTerms: source.deliveryTerms,
            paymentTerms: source.paymentTerms,
            creditTerms: source.creditTerms,
            discountAmount: source.discountAmount,
            freightAmount: source.freightAmount,
            additionalChargeAmount: source.additionalChargeAmount,
            vatRatePercent: source.vatRatePercent,
            supplierQuoteExceptionReason: source.supplierQuoteExceptionReason,
            createdByUserId: context.auth.userId,
          },
        });

        for (const line of source.lines) {
          await tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: revision.id,
              lineNo: line.lineNo,
              quotationAwardId: line.quotationAwardId,
              purchaseRequestLineId:
                line.purchaseRequestLineId,
              rfqId: line.rfqId,
              rfqLineId: line.rfqLineId,
              supplierQuotationId:
                line.supplierQuotationId,
              supplierQuotationLineId:
                line.supplierQuotationLineId,
              lineType: line.lineType,
              materialId: line.materialId,
              materialCodeSnapshot:
                line.materialCodeSnapshot,
              description: line.description,
              quantity: line.quantity,
              uomId: line.uomId,
              uomCodeSnapshot: line.uomCodeSnapshot,
              unitPrice: line.unitPrice,
              amount: line.amount,
              wbsId: line.wbsId,
              costCodeId: line.costCodeId,
              requiredOnSite: line.requiredOnSite,
              expectedDelivery: line.expectedDelivery,
              remarks: line.remarks,
            },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_ORDER',
            entityId: revision.id,
            action: 'CREATE_REVISION',
            oldValues: {
              previousRevisionId: source.id,
              revisionNo: source.revisionNo,
            },
            newValues: {
              poNumber: revision.poNumber,
              revisionNo: revision.revisionNo,
              previousRevisionId: source.id,
              revisionReason: revision.revisionReason,
            },
          },
          tx,
        );

        return {
          ...revision,
          lifecycleState: 'DRAFT' as const,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
           (error.code === 'P2010' && ['40001','40P01'].includes(String(error.meta?.code))))) {
        throw new ConflictException({ code: 'PO_REVISION_CONCURRENT_SOURCE_CHANGE',
          detail: 'The Purchase Order source changed concurrently. Reload it before revising.' });
      }
      throw error;
    }
  }

  /**
   * PUR01: whole-PO comparable supplier count, not the union of incomplete
   * per-RFQ invitations. Only active, source-linked THB quotation responses
   * covering each selected PO line qualify. No approval based on NULL fields.
   */
  private async assertPoQuotePolicy(
    tx: Prisma.TransactionClient,
    order: {
      companyId: string;
      projectId: string;
      supplierId: string;
      discountAmount: Prisma.Decimal | null;
      freightAmount: Prisma.Decimal | null;
      additionalChargeAmount: Prisma.Decimal | null;
      vatRatePercent: Prisma.Decimal | null;
      supplierQuoteExceptionReason: string | null;
      lines: Array<{
        rfqLineId: string;
        supplierQuotationId: string;
        supplierQuotationLineId: string;
        uomId: string;
        quantity: Prisma.Decimal;
        amount: Prisma.Decimal;
      }>;
    },
    approver?: AuthenticatedUserContext,
  ) {
    const subtotal = order.lines.reduce(
      (sum, line) => sum.plus(line.amount), new Prisma.Decimal(0),
    );
    const basis = poQuoteBasis(
      subtotal, order.discountAmount, order.freightAmount,
      order.additionalChargeAmount, order.vatRatePercent,
    );
    // The awarded/selected supplier's *own* quotation must be verified THB;
    // otherwise unrelated THB bids could make an unknown-currency award pass.
    const selectedQuotationIds = [...new Set(
      order.lines.map((line) => line.supplierQuotationId),
    )];
    const selectedTHB = await tx.supplierQuotation.count({
      where: {
        id: { in: selectedQuotationIds },
        companyId: order.companyId,
        supplierId: order.supplierId,
        currencyCode: 'THB',
        rfq: { companyId: order.companyId, projectId: order.projectId },
      },
    });
    if (selectedTHB !== selectedQuotationIds.length) {
      throw new UnprocessableEntityException({
        code: 'PO_SELECTED_QUOTE_THB_PROVENANCE_REQUIRED',
        detail: 'Every selected award must have verifiable THB quotation provenance.',
      });
    }
    const selectedOfferLines = await tx.supplierQuotationLine.findMany({
      where: {
        supplierQuotationId: { in: selectedQuotationIds },
        rfqLineId: { in: order.lines.map((line) => line.rfqLineId) },
      },
      select: { id: true, supplierQuotationId: true, rfqLineId: true, uomId: true, quantity: true },
    });
    if (order.lines.some((line) => !selectedOfferLines.some(
      (offer) => offer.id === line.supplierQuotationLineId &&
        offer.supplierQuotationId === line.supplierQuotationId &&
        offer.rfqLineId === line.rfqLineId && offer.uomId === line.uomId &&
        offer.quantity.isFinite() && offer.quantity.gte(line.quantity),
    ))) {
      throw new ConflictException({
        code: 'PO_SELECTED_QUOTE_QUANTITY_INCOMPLETE',
        detail: 'Selected supplier quotation must cover every PO source line quantity.',
      });
    }

    const offers = await tx.supplierQuotationLine.findMany({
      where: {
        rfqLineId: { in: order.lines.map((line) => line.rfqLineId) },
        supplierQuotation: {
          companyId: order.companyId,
          currencyCode: 'THB',
          rfq: { companyId: order.companyId, projectId: order.projectId },
          supplier: { companyId: order.companyId, isActive: true },
        },
      },
      select: {
        rfqLineId: true,
        uomId: true,
        quantity: true,
        supplierQuotation: { select: { supplierId: true } },
      },
    });
    const comparableSuppliers = completeSupplierCount(
      order.lines,
      offers.map((offer) => ({
        rfqLineId: offer.rfqLineId,
        uomId: offer.uomId,
        supplierId: offer.supplierQuotation.supplierId,
        quantity: offer.quantity,
      })),
    );
    const exceptionReason = order.supplierQuoteExceptionReason?.trim() || null;
    if (comparableSuppliers < basis.requiredSuppliers) {
      if (!exceptionReason || exceptionReason.length < 10) {
        throw new UnprocessableEntityException({
          code: 'PO_QUOTE_SUPPLIERS_INSUFFICIENT',
          detail: 'Required comparable THB suppliers for this whole-PO amount: ' +
            basis.requiredSuppliers + '; eligible: ' + comparableSuppliers +
            '. A specific exceptional supplier reason requires Ben review.',
        });
      }
      // Configured maker-checker approval remains mandatory. Shortage
      // exceptions additionally require the MANAGEMENT business approver;
      // SYS_ADMIN, buyer and delegated generic workflow grants are not enough.
      if (approver && !approver.roleCodes.includes('MANAGEMENT')) {
        throw new ForbiddenException({ code: 'PO_QUOTE_EXCEPTION_BEN_REQUIRED' });
      }
    }
    return {
      netExVatTHB: basis.netExVat.toFixed(2),
      requiredSuppliers: basis.requiredSuppliers,
      comparableSuppliers,
      exceptionReason,
    };
  }

  private async assertApprovedNumbering(companyId: string, db: Prisma.TransactionClient = this.prisma) {
    const sequence = await db.numberSequence.findFirst({
      where: {
        companyId,
        sequenceCode: 'PURCHASE_ORDER',
      },
      select: {
        entityType: true,
        formatTemplate: true,
        resetRule: true,
      },
    });
    if (
      !sequence ||
      sequence.entityType !== 'PURCHASE_ORDER' ||
      sequence.formatTemplate !== 'POYYMM-###' ||
      sequence.resetRule !== 'MONTHLY'
    ) {
      throw new UnprocessableEntityException({
        code: 'PO_NUMBER_SEQUENCE_INVALID',
        detail:
          'Configure PURCHASE_ORDER numbering as POYYMM-### with MONTHLY reset before creating Purchase Orders.',
      });
    }
  }

  private async orderForDraft(
    db: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    orderId: string,
  ) {
    const row = await db.purchaseOrder.findFirst({
      where: {
        id: orderId,
        companyId: auth.companyId,
      },
    });
    if (!row) throw this.orderNotFound();
    await this.access.assertAccess(auth, row.projectId, db);
    this.assertDraft(row);
    return row;
  }

  private assertDraft(row: {
    approvalInstanceId: string | null;
    submittedAt: Date | null;
    cancelledAt: Date | null;
  }) {
    if (
      row.approvalInstanceId ||
      row.submittedAt ||
      row.cancelledAt
    ) {
      throw new ConflictException({
        code: 'PO_NOT_DRAFT',
        detail:
          'Only a Draft Purchase Order revision is directly editable.',
      });
    }
  }

  private async assertActiveDemand(
    tx: Prisma.TransactionClient,
    order: {
      companyId: string;
      projectId: string;
      lines: Array<{ purchaseRequestLineId: string }>;
    },
  ) {
    const sourceIds = [...new Set(order.lines.map(line => line.purchaseRequestLineId))];
    const sources = await tx.purchaseRequestLine.findMany({
      where: {
        id: { in: sourceIds },
        purchaseRequest: { companyId: order.companyId, projectId: order.projectId },
      },
      include: { purchaseRequest: {
        include: { approvalInstance: { select: { approvalState: true } } },
      } },
    });
    if (!sourceIds.length || sources.length !== sourceIds.length ||
        sources.some(line => line.reviewDecision === 'RETURNED' ||
          line.purchaseRequest.cancelledAt !== null ||
          line.purchaseRequest.companyId !== order.companyId ||
          line.purchaseRequest.projectId !== order.projectId ||
          line.purchaseRequest.approvalInstance?.approvalState !== APPROVAL_STATE.APPROVED)) {
      throw new ConflictException({
        code: 'PO_SOURCE_DEMAND_INACTIVE',
        detail: 'Purchase Order requires active approved Purchase Request line demand in the same Company and Project.',
      });
    }
  }

  private async orderForApproval(
    auth: AuthenticatedUserContext,
    orderId: string,
  ) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: orderId,
        companyId: auth.companyId,
      },
      select: {
        id: true,
        poNumber: true,
        projectId: true,
        supplierId: true,
        approvalInstanceId: true,
        submittedByUserId: true,
        cancelledAt: true,
        lines: {
          select: { purchaseRequestLineId: true },
        },
      },
    });
    if (!row) throw this.orderNotFound();
    await this.access.assertAccess(auth, row.projectId);
    if (
      !row.approvalInstanceId ||
      !row.submittedByUserId ||
      row.cancelledAt
    ) {
      throw new ConflictException({
        code: 'PO_NOT_SUBMITTED',
        detail:
          'This Purchase Order revision is not awaiting an approval action.',
      });
    }
    return {
      ...row,
      approvalInstanceId: row.approvalInstanceId,
      submittedByUserId: row.submittedByUserId,
      purchaseRequestLineIds: [
        ...new Set(
          row.lines.map((line) => line.purchaseRequestLineId),
        ),
      ],
    };
  }

  private async assertReceivedQuantityFloor(
    tx: Prisma.TransactionClient,
    order: { companyId: string; poNumber: string },
    awardId: string,
    quantity: Prisma.Decimal,
  ) {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'receipt-po:' + order.companyId + ':' + order.poNumber,
    );
    const received = await tx.goodsReceiptItem.aggregate({
      where: {
        quotationAwardId: awardId,
        goodsReceipt: {
          postedAt: { not: null },
          reversedAt: null,
          purchaseOrder: {
            companyId: order.companyId,
            poNumber: order.poNumber,
          },
        },
      },
      _sum: { quantity: true },
    });
    if (quantity.lt(received._sum.quantity ?? 0)) {
      throw new ConflictException({
        code: 'PO_BELOW_RECEIVED_QUANTITY',
        detail: 'Purchase Order quantity cannot be lower than outstanding received quantity.',
      });
    }
  }

  private lifecycleOf(row: {
    cancelledAt: Date | null;
    approvalInstance?: {
      approvalState: string;
    } | null;
  }) {
    if (row.cancelledAt) return 'CANCELLED';
    return row.approvalInstance?.approvalState ?? 'DRAFT';
  }

  private withLifecycle<T extends {
    cancelledAt: Date | null;
    approvalInstance?: {
      approvalState: string;
    } | null;
  }>(row: T) {
    return {
      ...row,
      lifecycleState: this.lifecycleOf(row),
    };
  }

  private lineAuditValues(row: {
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    amount: Prisma.Decimal;
    wbsId: string | null;
    costCodeId: string | null;
    requiredOnSite: Date | null;
    expectedDelivery: Date | null;
    remarks: string | null;
  }) {
    return {
      quantity: row.quantity.toString(),
      unitPrice: row.unitPrice.toString(),
      amount: row.amount.toString(),
      wbsId: row.wbsId,
      costCodeId: row.costCodeId,
      requiredOnSite: row.requiredOnSite,
      expectedDelivery: row.expectedDelivery,
      remarks: row.remarks,
    };
  }

  private getOrderWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
    orderId: string,
  ) {
    return tx.purchaseOrder.findFirstOrThrow({
      where: { id: orderId, companyId },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
        },
      },
    });
  }

  private orderNotFound() {
    return new NotFoundException({
      code: 'PURCHASE_ORDER_NOT_FOUND',
      detail: 'Purchase Order revision not found.',
    });
  }

  private lineNotFound() {
    return new NotFoundException({
      code: 'PURCHASE_ORDER_LINE_NOT_FOUND',
      detail: 'Purchase Order line not found.',
    });
  }
}
