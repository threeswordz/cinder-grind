import {
  ConflictException,
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

    const poNumber = await this.numbers.next(
      context.auth.companyId,
      'PURCHASE_ORDER',
    );

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
              select: { id: true, companyId: true, isActive: true },
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

        const order = await tx.purchaseOrder.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            supplierId,
            poNumber,
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
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await this.orderForDraft(
        tx,
        context.auth,
        orderId,
      );
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
          },
          newValues: {
            remarks: updated.remarks,
            revisionReason: updated.revisionReason,
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

    const sourceLines = await this.prisma.purchaseRequestLine.findMany({
      where: {
        id: { in: order.purchaseRequestLineIds },
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
      sourceLines.length !== order.purchaseRequestLineIds.length ||
      sourceLines.some(
        (line) =>
          line.purchaseRequest.cancelledAt ||
          line.purchaseRequest.approvalInstance?.approvalState !==
            APPROVAL_STATE.APPROVED,
      )
    ) {
      throw new ConflictException({
        code: 'PO_SOURCE_DEMAND_INACTIVE',
        detail:
          'Purchase Order approval requires active approved Purchase Request demand.',
      });
    }

    const instance = await this.approvals.approve(
      order.approvalInstanceId,
      context.auth,
      order.submittedByUserId,
      comment,
      async (tx) => {
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

  async cancel(
    context: AuditContext,
    orderId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
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
        for (const line of [...order.lines].sort((a, b) => a.id.localeCompare(b.id))) {
          await tx.$executeRawUnsafe(
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'finance-source:po-line:' + line.id,
          );
        }
        const approvedInvoiceSource = await tx.supplierInvoiceItem.findFirst({
          where: {
            purchaseOrderLineId: { in: order.lines.map((line) => line.id) },
            supplierInvoice: { state: 'APPROVED' },
          },
          select: { id: true },
        });
        if (approvedInvoiceSource) {
          throw new ConflictException({
            code: 'PO_CANCEL_FINANCE_SOURCE_LOCKED',
            detail:
              'A Purchase Order referenced by an approved Supplier Invoice cannot be cancelled.',
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  async revise(
    context: AuditContext,
    orderId: string,
    revisionReason?: string | null,
  ) {
    return this.prisma.$transaction(
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

        const revision = await tx.purchaseOrder.create({
          data: {
            companyId: source.companyId,
            projectId: source.projectId,
            supplierId: source.supplierId,
            poNumber: source.poNumber,
            revisionNo: source.revisionNo + 1,
            previousRevisionId: source.id,
            revisionReason: revisionReason ?? null,
            remarks: source.remarks,
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
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
  }

  private async assertApprovedNumbering(companyId: string) {
    const sequence = await this.prisma.numberSequence.findFirst({
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
