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

type LineInput = {
  lineType?: 'MATERIAL' | 'SERVICE';
  materialId?: string | null;
  description?: string;
  quantity?: Prisma.Decimal;
  uomId?: string;
  wbsId?: string | null;
  costCodeId?: string | null;
  activityId?: string | null;
  requiredOnSite?: Date | null;
};

type PurchaseRequestDb = Pick<
  Prisma.TransactionClient,
  | 'purchaseRequest'
  | 'purchaseRequestLine'
  | 'project'
  | 'material'
  | 'unitOfMeasure'
  | 'wbsElement'
  | 'costCode'
  | 'activity'
  | 'user'
>;

@Injectable()
export class ProcurementService {
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

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [wbs, costCodes, uoms, materials, activities] = await Promise.all([
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
      this.prisma.unitOfMeasure.findMany({
        where: { companyId: auth.companyId, isActive: true },
        select: { id: true, uomCode: true, uomName: true, decimalPlaces: true },
        orderBy: { uomCode: 'asc' },
      }),
      this.prisma.material.findMany({
        where: { companyId: auth.companyId, isActive: true },
        select: {
          id: true,
          materialCode: true,
          materialName: true,
          defaultUomId: true,
        },
        orderBy: { materialCode: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: {
          companyId: auth.companyId,
          projectId,
          isActive: true,
        },
        select: {
          id: true,
          activityCode: true,
          activityName: true,
          wbsId: true,
        },
        orderBy: { activityCode: 'asc' },
      }),
    ]);
    return { wbs, costCodes, uoms, materials, activities };
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'PURCHASE_REQUEST',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async listRequests(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.purchaseRequest.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        createdBy: { select: { id: true, displayName: true, email: true } },
        submittedBy: { select: { id: true, displayName: true, email: true } },
        cancelledBy: { select: { id: true, displayName: true, email: true } },
        sourceRequest: { select: { id: true, prNumber: true } },
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            currentStepNo: true,
            startedAt: true,
            completedAt: true,
          },
        },
        _count: { select: { lines: true, copies: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { prNumber: 'desc' }],
    });
    return rows.map((row) => this.withLifecycle(row));
  }

  async getRequest(auth: AuthenticatedUserContext, requestId: string) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id: requestId, companyId: auth.companyId },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
        createdBy: { select: { id: true, displayName: true, email: true } },
        submittedBy: { select: { id: true, displayName: true, email: true } },
        cancelledBy: { select: { id: true, displayName: true, email: true } },
        sourceRequest: { select: { id: true, prNumber: true } },
        copies: { select: { id: true, prNumber: true }, orderBy: { createdAt: 'asc' } },
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            currentStepNo: true,
            startedAt: true,
            completedAt: true,
          },
        },
        lines: {
          include: {
            material: {
              select: { id: true, materialCode: true, materialName: true },
            },
            uom: {
              select: { id: true, uomCode: true, uomName: true, decimalPlaces: true },
            },
            wbs: { select: { id: true, wbsCode: true, wbsName: true } },
            costCode: { select: { id: true, costCode: true, costName: true } },
            activity: {
              select: { id: true, activityCode: true, activityName: true },
            },
          },
          orderBy: { lineNo: 'asc' },
        },
      },
    });
    if (!row) throw this.requestNotFound();
    await this.access.assertAccess(auth, row.projectId);
    return this.withLifecycle(row);
  }

  async createRequest(
    context: AuditContext,
    projectId: string,
    remarks?: string | null,
    sourceRequestId?: string | null,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    await this.assertApprovedNumbering(context.auth.companyId);

    if (sourceRequestId) {
      const source = await this.prisma.purchaseRequest.findFirst({
        where: {
          id: sourceRequestId,
          companyId: context.auth.companyId,
          projectId,
        },
        include: { approvalInstance: { select: { approvalState: true } } },
      });
      if (!source || this.lifecycleOf(source) !== APPROVAL_STATE.REJECTED) {
        throw new ConflictException({
          code: 'PR_COPY_SOURCE_INVALID',
          detail: 'Only a rejected Purchase Request can be copied into a new Draft.',
        });
      }
    }

    const prNumber = await this.numbers.next(
      context.auth.companyId,
      'PURCHASE_REQUEST',
    );

    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        const project = await tx.project.findFirst({
          where: {
            id: projectId,
            companyId: context.auth.companyId,
            isActive: true,
          },
          select: { id: true },
        });
        if (!project) throw this.projectNotFound();

        const row = await tx.purchaseRequest.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            prNumber,
            remarks: remarks ?? null,
            sourceRequestId: sourceRequestId ?? null,
            createdByUserId: context.auth.userId,
          },
        });

        if (sourceRequestId) {
          const sourceLines = await tx.purchaseRequestLine.findMany({
            where: { purchaseRequestId: sourceRequestId },
            orderBy: { lineNo: 'asc' },
          });
          for (const line of sourceLines) {
            const normalized = await this.normalizeLine(
              tx,
              context.auth,
              { projectId, companyId: context.auth.companyId },
              {
                lineType: line.lineType as 'MATERIAL' | 'SERVICE',
                materialId: line.materialId,
                description: line.description,
                quantity: line.quantity,
                uomId: line.uomId,
                wbsId: line.wbsId,
                costCodeId: line.costCodeId,
                activityId: line.activityId,
                requiredOnSite: line.requiredOnSite,
              },
            );
            await tx.purchaseRequestLine.create({
              data: {
                purchaseRequestId: row.id,
                lineNo: line.lineNo,
                ...normalized,
              },
            });
          }
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_REQUEST',
            entityId: row.id,
            action: sourceRequestId ? 'COPY_REJECTED_TO_DRAFT' : 'CREATE_DRAFT',
            newValues: {
              projectId,
              prNumber,
              sourceRequestId: sourceRequestId ?? null,
            },
          },
          tx,
        );

        return { ...row, lifecycleState: 'DRAFT' as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async copyRejected(
    context: AuditContext,
    requestId: string,
    remarks?: string | null,
  ) {
    const source = await this.getRequest(context.auth, requestId);
    if (source.lifecycleState !== APPROVAL_STATE.REJECTED) {
      throw new ConflictException({
        code: 'PR_COPY_SOURCE_INVALID',
        detail: 'Only a rejected Purchase Request can be copied into a new Draft.',
      });
    }
    return this.createRequest(
      context,
      source.projectId,
      remarks === undefined ? source.remarks : remarks,
      source.id,
    );
  }

  async updateRequest(
    context: AuditContext,
    requestId: string,
    remarks: string | null,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.requestForDraft(tx, context.auth, requestId);
      const updated = await tx.purchaseRequest.update({
        where: { id: row.id },
        data: { remarks },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_REQUEST',
          entityId: row.id,
          action: 'UPDATE_DRAFT',
          oldValues: { remarks: row.remarks },
          newValues: { remarks },
        },
        tx,
      );
      return { ...updated, lifecycleState: 'DRAFT' as const };
    });
  }

  async createLine(
    context: AuditContext,
    requestId: string,
    input: LineInput,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await this.requestForDraft(tx, context.auth, requestId);
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'purchase-request:' + request.id,
        );
        const max = await tx.purchaseRequestLine.aggregate({
          where: { purchaseRequestId: request.id },
          _max: { lineNo: true },
        });
        const lineNo = (max._max.lineNo ?? 0) + 1;
        const normalized = await this.normalizeLine(
          tx,
          context.auth,
          request,
          input,
        );
        const line = await tx.purchaseRequestLine.create({
          data: {
            purchaseRequestId: request.id,
            lineNo,
            ...normalized,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_REQUEST_LINE',
            entityId: line.id,
            action: 'CREATE',
            newValues: {
              purchaseRequestId: request.id,
              lineNo,
              lineType: line.lineType,
              materialId: line.materialId,
              quantity: line.quantity.toString(),
              uomId: line.uomId,
              wbsId: line.wbsId,
              costCodeId: line.costCodeId,
              activityId: line.activityId,
              requiredOnSite: line.requiredOnSite,
            },
          },
          tx,
        );
        return line;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateLine(
    context: AuditContext,
    lineId: string,
    input: LineInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.purchaseRequestLine.findFirst({
        where: {
          id: lineId,
          purchaseRequest: { companyId: context.auth.companyId },
        },
        include: {
          purchaseRequest: {
            select: {
              id: true,
              companyId: true,
              projectId: true,
              approvalInstanceId: true,
              submittedAt: true,
              cancelledAt: true,
            },
          },
        },
      });
      if (!current) throw this.lineNotFound();
      await this.access.assertAccess(
        context.auth,
        current.purchaseRequest.projectId,
        tx,
      );
      this.assertDraft(current.purchaseRequest);

      const normalized = await this.normalizeLine(
        tx,
        context.auth,
        current.purchaseRequest,
        {
          lineType: input.lineType ?? (current.lineType as 'MATERIAL' | 'SERVICE'),
          materialId:
            input.materialId !== undefined ? input.materialId : current.materialId,
          description:
            input.description !== undefined ? input.description : current.description,
          quantity: input.quantity ?? current.quantity,
          uomId: input.uomId ?? current.uomId,
          wbsId: input.wbsId !== undefined ? input.wbsId : current.wbsId,
          costCodeId:
            input.costCodeId !== undefined ? input.costCodeId : current.costCodeId,
          activityId:
            input.activityId !== undefined ? input.activityId : current.activityId,
          requiredOnSite:
            input.requiredOnSite !== undefined
              ? input.requiredOnSite
              : current.requiredOnSite,
        },
      );

      const updated = await tx.purchaseRequestLine.update({
        where: { id: current.id },
        data: normalized,
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_REQUEST_LINE',
          entityId: current.id,
          action: 'UPDATE',
          oldValues: {
            lineType: current.lineType,
            materialId: current.materialId,
            description: current.description,
            quantity: current.quantity.toString(),
            uomId: current.uomId,
            wbsId: current.wbsId,
            costCodeId: current.costCodeId,
            activityId: current.activityId,
            requiredOnSite: current.requiredOnSite,
          },
          newValues: {
            lineType: updated.lineType,
            materialId: updated.materialId,
            description: updated.description,
            quantity: updated.quantity.toString(),
            uomId: updated.uomId,
            wbsId: updated.wbsId,
            costCodeId: updated.costCodeId,
            activityId: updated.activityId,
            requiredOnSite: updated.requiredOnSite,
          },
        },
        tx,
      );
      return updated;
    });
  }

  async deleteLine(context: AuditContext, lineId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.purchaseRequestLine.findFirst({
        where: {
          id: lineId,
          purchaseRequest: { companyId: context.auth.companyId },
        },
        include: {
          purchaseRequest: {
            select: {
              id: true,
              companyId: true,
              projectId: true,
              approvalInstanceId: true,
              submittedAt: true,
              cancelledAt: true,
            },
          },
        },
      });
      if (!current) throw this.lineNotFound();
      await this.access.assertAccess(
        context.auth,
        current.purchaseRequest.projectId,
        tx,
      );
      this.assertDraft(current.purchaseRequest);
      await tx.purchaseRequestLine.delete({ where: { id: current.id } });
      await this.audit.record(
        {
          ...context,
          entityType: 'PURCHASE_REQUEST_LINE',
          entityId: current.id,
          action: 'DELETE_DRAFT_LINE',
          oldValues: {
            purchaseRequestId: current.purchaseRequestId,
            lineNo: current.lineNo,
          },
        },
        tx,
      );
      return { id: current.id };
    });
  }

  async submitRequest(
    context: AuditContext,
    requestId: string,
    workflowCode: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.purchaseRequest.findFirst({
          where: { id: requestId, companyId: context.auth.companyId },
          include: {
            lines: {
              include: {
                material: true,
                uom: true,
                wbs: true,
                costCode: true,
                activity: true,
              },
              orderBy: { lineNo: 'asc' },
            },
          },
        });
        if (!request) throw this.requestNotFound();
        await this.access.assertAccess(context.auth, request.projectId, tx);
        this.assertDraft(request);
        if (!request.lines.length) {
          throw new UnprocessableEntityException({
            code: 'PR_LINES_REQUIRED',
            detail: 'A Purchase Request must contain at least one line before submission.',
          });
        }
        this.assertSubmissionReferences(request);

        const approvalInstance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'PURCHASE_REQUEST',
            entityId: request.id,
          },
          tx,
        );
        const submittedAt = new Date();
        const updated = await tx.purchaseRequest.update({
          where: { id: request.id },
          data: {
            approvalInstanceId: approvalInstance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_REQUEST',
            entityId: request.id,
            action: 'SUBMIT',
            newValues: {
              prNumber: request.prNumber,
              approvalInstanceId: approvalInstance.id,
              lineCount: request.lines.length,
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

  async approveRequest(
    context: AuditContext,
    requestId: string,
    comment?: string,
  ) {
    const request = await this.requestForApproval(context.auth, requestId);
    const instance = await this.approvals.approve(
      request.approvalInstanceId,
      context.auth,
      request.submittedByUserId,
      comment,
    );
    await this.audit.record({
      ...context,
      entityType: 'PURCHASE_REQUEST',
      entityId: request.id,
      action: 'APPROVAL_APPROVE',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });
    return this.getRequest(context.auth, request.id);
  }

  async rejectRequest(
    context: AuditContext,
    requestId: string,
    comment?: string,
  ) {
    const request = await this.requestForApproval(context.auth, requestId);
    const instance = await this.approvals.reject(
      request.approvalInstanceId,
      context.auth,
      request.submittedByUserId,
      comment,
    );
    await this.audit.record({
      ...context,
      entityType: 'PURCHASE_REQUEST',
      entityId: request.id,
      action: 'APPROVAL_REJECT',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });
    return this.getRequest(context.auth, request.id);
  }

  async cancelRequest(context: AuditContext, requestId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const request = await tx.purchaseRequest.findFirst({
          where: { id: requestId, companyId: context.auth.companyId },
          include: {
            approvalInstance: {
              select: { id: true, approvalState: true },
            },
          },
        });
        if (!request) throw this.requestNotFound();
        await this.access.assertAccess(context.auth, request.projectId, tx);
        const state = this.lifecycleOf(request);
        if (state === 'CANCELLED') {
          throw new ConflictException({
            code: 'PR_ALREADY_CANCELLED',
            detail: 'This Purchase Request is already cancelled.',
          });
        }
        if (state === APPROVAL_STATE.REJECTED) {
          throw new ConflictException({
            code: 'PR_REJECTED_IMMUTABLE',
            detail: 'A rejected Purchase Request is retained history and cannot be cancelled.',
          });
        }
        if (state === APPROVAL_STATE.SUBMITTED && request.approvalInstanceId) {
          await this.approvals.cancel(
            request.approvalInstanceId,
            context.auth,
            tx,
          );
        }

        const cancelledAt = new Date();
        await tx.purchaseRequest.update({
          where: { id: request.id },
          data: {
            cancelledByUserId: context.auth.userId,
            cancelledAt,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'PURCHASE_REQUEST',
            entityId: request.id,
            action: 'CANCEL',
            oldValues: { lifecycleState: state },
            newValues: { lifecycleState: 'CANCELLED', cancelledAt },
          },
          tx,
        );
        return { ...(await tx.purchaseRequest.findUniqueOrThrow({ where: { id: request.id } })), lifecycleState: 'CANCELLED' as const };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async assertApprovedNumbering(companyId: string) {
    const sequence = await this.prisma.numberSequence.findFirst({
      where: { companyId, sequenceCode: 'PURCHASE_REQUEST' },
      select: { entityType: true, formatTemplate: true, resetRule: true },
    });
    if (
      !sequence ||
      sequence.entityType !== 'PURCHASE_REQUEST' ||
      sequence.formatTemplate !== 'PRYYMM-###' ||
      sequence.resetRule !== 'MONTHLY'
    ) {
      throw new UnprocessableEntityException({
        code: 'PR_NUMBER_SEQUENCE_INVALID',
        detail:
          'Configure PURCHASE_REQUEST numbering as PRYYMM-### with MONTHLY reset before creating Purchase Requests.',
      });
    }
  }

  private async requestForDraft(
    db: PurchaseRequestDb,
    auth: AuthenticatedUserContext,
    requestId: string,
  ) {
    const row = await db.purchaseRequest.findFirst({
      where: { id: requestId, companyId: auth.companyId },
    });
    if (!row) throw this.requestNotFound();
    await this.access.assertAccess(auth, row.projectId, db);
    this.assertDraft(row);
    return row;
  }

  private assertDraft(row: {
    approvalInstanceId: string | null;
    submittedAt: Date | null;
    cancelledAt: Date | null;
  }) {
    if (row.approvalInstanceId || row.submittedAt || row.cancelledAt) {
      throw new ConflictException({
        code: 'PR_NOT_DRAFT',
        detail: 'Only a Draft Purchase Request is directly editable.',
      });
    }
  }

  private async requestForApproval(
    auth: AuthenticatedUserContext,
    requestId: string,
  ) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id: requestId, companyId: auth.companyId },
      select: {
        id: true,
        projectId: true,
        approvalInstanceId: true,
        submittedByUserId: true,
        cancelledAt: true,
      },
    });
    if (!row) throw this.requestNotFound();
    await this.access.assertAccess(auth, row.projectId);
    if (
      !row.approvalInstanceId ||
      !row.submittedByUserId ||
      row.cancelledAt
    ) {
      throw new ConflictException({
        code: 'PR_NOT_SUBMITTED',
        detail: 'This Purchase Request is not awaiting an approval action.',
      });
    }
    return {
      ...row,
      approvalInstanceId: row.approvalInstanceId,
      submittedByUserId: row.submittedByUserId,
    };
  }

  private async normalizeLine(
    db: PurchaseRequestDb,
    auth: AuthenticatedUserContext,
    request: { companyId: string; projectId: string },
    input: LineInput,
  ) {
    if (!input.lineType || !input.quantity || !input.uomId) {
      throw new UnprocessableEntityException({
        code: 'PR_LINE_REQUIRED_FIELDS',
        detail: 'Line type, quantity and UOM are required.',
      });
    }

    const uom = await db.unitOfMeasure.findFirst({
      where: {
        id: input.uomId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!uom) {
      throw new UnprocessableEntityException({
        code: 'PR_UOM_INVALID',
        detail: 'UOM must be active and belong to the same Company.',
      });
    }

    let description = input.description?.trim() ?? '';
    let materialId: string | null = null;
    if (input.lineType === 'MATERIAL') {
      if (!input.materialId) {
        throw new UnprocessableEntityException({
          code: 'PR_MATERIAL_REQUIRED',
          detail: 'A Material line must reference an active Material.',
        });
      }
      const material = await db.material.findFirst({
        where: {
          id: input.materialId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: { id: true, materialName: true },
      });
      if (!material) {
        throw new UnprocessableEntityException({
          code: 'PR_MATERIAL_INVALID',
          detail: 'Material must be active and belong to the same Company.',
        });
      }
      materialId = material.id;
      description = material.materialName;
    } else {
      if (input.materialId) {
        throw new UnprocessableEntityException({
          code: 'PR_SERVICE_MATERIAL_INVALID',
          detail: 'A Service line cannot reference a Material.',
        });
      }
      if (!description) {
        throw new UnprocessableEntityException({
          code: 'PR_SERVICE_DESCRIPTION_REQUIRED',
          detail: 'A Service line requires a controlled description.',
        });
      }
    }

    if (input.wbsId) {
      const wbs = await db.wbsElement.findFirst({
        where: { id: input.wbsId, projectId: request.projectId, isActive: true },
        select: { id: true },
      });
      if (!wbs) {
        throw new UnprocessableEntityException({
          code: 'PR_WBS_INVALID',
          detail: 'WBS must be active and belong to the same Project.',
        });
      }
    }

    if (input.costCodeId) {
      const cost = await db.costCode.findFirst({
        where: {
          id: input.costCodeId,
          companyId: request.companyId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!cost) {
        throw new UnprocessableEntityException({
          code: 'PR_COST_CODE_INVALID',
          detail: 'Cost Code must be active and belong to the same Company.',
        });
      }
    }

    if (input.activityId) {
      const activity = await db.activity.findFirst({
        where: {
          id: input.activityId,
          companyId: request.companyId,
          projectId: request.projectId,
          isActive: true,
        },
        select: { id: true },
      });
      if (!activity) {
        throw new UnprocessableEntityException({
          code: 'PR_ACTIVITY_INVALID',
          detail: 'Activity must be active and belong to the same Project.',
        });
      }
    }

    return {
      lineType: input.lineType,
      materialId,
      description,
      quantity: input.quantity,
      uomId: input.uomId,
      wbsId: input.wbsId ?? null,
      costCodeId: input.costCodeId ?? null,
      activityId: input.activityId ?? null,
      requiredOnSite: input.requiredOnSite ?? null,
    };
  }

  private assertSubmissionReferences(request: {
    companyId: string;
    projectId: string;
    lines: Array<{
      lineType: string;
      materialId: string | null;
      material: { companyId: string; isActive: boolean } | null;
      uom: { companyId: string; isActive: boolean };
      wbs: { projectId: string; isActive: boolean } | null;
      costCode: { companyId: string; isActive: boolean } | null;
      activity: { companyId: string; projectId: string; isActive: boolean } | null;
    }>;
  }) {
    const invalid = request.lines.some((line) =>
      !line.uom.isActive ||
      line.uom.companyId !== request.companyId ||
      (line.lineType === 'MATERIAL' &&
        (!line.material ||
          !line.material.isActive ||
          line.material.companyId !== request.companyId)) ||
      (line.wbs && (!line.wbs.isActive || line.wbs.projectId !== request.projectId)) ||
      (line.costCode &&
        (!line.costCode.isActive || line.costCode.companyId !== request.companyId)) ||
      (line.activity &&
        (!line.activity.isActive ||
          line.activity.companyId !== request.companyId ||
          line.activity.projectId !== request.projectId)),
    );
    if (invalid) {
      throw new UnprocessableEntityException({
        code: 'PR_LINE_REFERENCE_INACTIVE',
        detail:
          'One or more Purchase Request line references are no longer active or valid for this Project.',
      });
    }
  }

  private withLifecycle<T extends {
    cancelledAt: Date | null;
    approvalInstance?: { approvalState: string } | null;
  }>(row: T) {
    return { ...row, lifecycleState: this.lifecycleOf(row) };
  }

  private lifecycleOf(row: {
    cancelledAt: Date | null;
    approvalInstance?: { approvalState: string } | null;
  }) {
    if (row.cancelledAt) return 'CANCELLED';
    return row.approvalInstance?.approvalState ?? 'DRAFT';
  }

  private requestNotFound() {
    return new NotFoundException({
      code: 'PURCHASE_REQUEST_NOT_FOUND',
      detail: 'Purchase Request not found.',
    });
  }

  private lineNotFound() {
    return new NotFoundException({
      code: 'PURCHASE_REQUEST_LINE_NOT_FOUND',
      detail: 'Purchase Request line not found.',
    });
  }

  private projectNotFound() {
    return new NotFoundException({
      code: 'PROJECT_NOT_FOUND',
      detail: 'Project not found.',
    });
  }
}
