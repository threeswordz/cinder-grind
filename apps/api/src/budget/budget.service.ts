import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import {
  APPROVAL_STATE,
  ApprovalService,
} from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type SectionInput = {
  sectionCode?: string;
  sectionName?: string;
  description?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

type ItemInput = {
  sectionId?: string;
  itemCode?: string;
  description?: string;
  quantity?: Prisma.Decimal;
  uomId?: string;
  rate?: Prisma.Decimal;
  wbsId?: string | null;
  costCodeId?: string | null;
  sortOrder?: number;
  isActive?: boolean;
};

@Injectable()
export class BudgetService {
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
      select: {
        id: true,
        projectCode: true,
        projectName: true,
      },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [wbs, costCodes, uoms] = await Promise.all([
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
        select: {
          id: true,
          uomCode: true,
          uomName: true,
          decimalPlaces: true,
        },
        orderBy: { uomCode: 'asc' },
      }),
    ]);
    return { wbs, costCodes, uoms };
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'BUDGET_REVISION',
        isActive: true,
      },
      select: {
        id: true,
        workflowCode: true,
        workflowName: true,
      },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async getBoq(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.boq.findFirst({
      where: {
        companyId: auth.companyId,
        projectId,
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
        sections: {
          orderBy: [{ sortOrder: 'asc' }, { sectionCode: 'asc' }],
        },
        items: {
          include: {
            section: {
              select: {
                id: true,
                sectionCode: true,
                sectionName: true,
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
          },
          orderBy: [
            { section: { sortOrder: 'asc' } },
            { sortOrder: 'asc' },
            { itemCode: 'asc' },
          ],
        },
      },
    });
  }

  async createBoq(
    context: AuditContext,
    projectId: string,
    boqName: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
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

        const row = await tx.boq.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            boqName,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'BOQ',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.duplicate(
        error,
        'A canonical BOQ already exists for this Project.',
      );
      throw error;
    }
  }

  async updateBoq(
    context: AuditContext,
    projectId: string,
    boqName: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAccess(context.auth, projectId, tx);
      const before = await tx.boq.findFirst({
        where: {
          companyId: context.auth.companyId,
          projectId,
        },
      });
      if (!before) throw this.boqNotFound();
      const row = await tx.boq.update({
        where: { id: before.id },
        data: { boqName },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'BOQ',
          entityId: row.id,
          action: 'UPDATE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  async createSection(
    context: AuditContext,
    boqId: string,
    input: Required<
      Pick<SectionInput, 'sectionCode' | 'sectionName' | 'sortOrder'>
    > &
      Pick<SectionInput, 'description'>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const boq = await this.boqForAction(
          context.auth,
          boqId,
          tx,
        );
        const row = await tx.boqSection.create({
          data: {
            boqId,
            sectionCode: input.sectionCode,
            sectionName: input.sectionName,
            description: input.description ?? null,
            sortOrder: input.sortOrder,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'BOQ_SECTION',
            entityId: row.id,
            action: 'CREATE',
            newValues: { ...row, projectId: boq.projectId },
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.duplicate(
        error,
        'BOQ Section code is already in use for this Project BOQ.',
      );
      throw error;
    }
  }

  async updateSection(
    context: AuditContext,
    sectionId: string,
    input: SectionInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.boqSection.findFirst({
          where: {
            id: sectionId,
            boq: { companyId: context.auth.companyId },
          },
          include: {
            boq: { select: { projectId: true } },
          },
        });
        if (!before) throw this.sectionNotFound();
        await this.access.assertAccess(
          context.auth,
          before.boq.projectId,
          tx,
        );
        const row = await tx.boqSection.update({
          where: { id: sectionId },
          data: input,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'BOQ_SECTION',
            entityId: row.id,
            action:
              input.isActive === false
                ? 'ARCHIVE'
                : input.isActive === true
                  ? 'REACTIVATE'
                  : 'UPDATE',
            oldValues: before,
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.duplicate(
        error,
        'BOQ Section code is already in use for this Project BOQ.',
      );
      throw error;
    }
  }

  async createItem(
    context: AuditContext,
    boqId: string,
    input: Required<
      Pick<
        ItemInput,
        | 'sectionId'
        | 'itemCode'
        | 'description'
        | 'quantity'
        | 'uomId'
        | 'rate'
        | 'sortOrder'
      >
    > &
      Pick<ItemInput, 'wbsId' | 'costCodeId'>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const boq = await this.boqForAction(
          context.auth,
          boqId,
          tx,
        );
        await this.validateItemReferences(
          tx,
          context.auth.companyId,
          boq.projectId,
          boqId,
          input,
        );
        const row = await tx.boqItem.create({
          data: {
            boqId,
            sectionId: input.sectionId,
            itemCode: input.itemCode,
            description: input.description,
            quantity: input.quantity,
            uomId: input.uomId,
            rate: input.rate,
            amount: this.amount(input.quantity, input.rate),
            wbsId: input.wbsId ?? null,
            costCodeId: input.costCodeId ?? null,
            sortOrder: input.sortOrder,
          },
          include: this.itemInclude(),
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'BOQ_ITEM',
            entityId: row.id,
            action: 'CREATE',
            newValues: { ...row, projectId: boq.projectId },
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.duplicate(
        error,
        'BOQ Item code is already in use for this Project BOQ.',
      );
      throw error;
    }
  }

  async updateItem(
    context: AuditContext,
    itemId: string,
    input: ItemInput,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.boqItem.findFirst({
          where: {
            id: itemId,
            boq: { companyId: context.auth.companyId },
          },
          include: {
            boq: { select: { id: true, projectId: true } },
          },
        });
        if (!before) throw this.itemNotFound();
        await this.access.assertAccess(
          context.auth,
          before.boq.projectId,
          tx,
        );

        const merged = {
          sectionId: input.sectionId ?? before.sectionId,
          itemCode: input.itemCode ?? before.itemCode,
          description: input.description ?? before.description,
          quantity: input.quantity ?? before.quantity,
          uomId: input.uomId ?? before.uomId,
          rate: input.rate ?? before.rate,
          wbsId:
            input.wbsId === undefined ? before.wbsId : input.wbsId,
          costCodeId:
            input.costCodeId === undefined
              ? before.costCodeId
              : input.costCodeId,
          sortOrder: input.sortOrder ?? before.sortOrder,
        };

        await this.validateItemReferences(
          tx,
          context.auth.companyId,
          before.boq.projectId,
          before.boq.id,
          merged,
        );

        const row = await tx.boqItem.update({
          where: { id: itemId },
          data: {
            ...(input.sectionId !== undefined
              ? { sectionId: input.sectionId }
              : {}),
            ...(input.itemCode !== undefined
              ? { itemCode: input.itemCode }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.quantity !== undefined
              ? { quantity: input.quantity }
              : {}),
            ...(input.uomId !== undefined ? { uomId: input.uomId } : {}),
            ...(input.rate !== undefined ? { rate: input.rate } : {}),
            ...(input.wbsId !== undefined ? { wbsId: input.wbsId } : {}),
            ...(input.costCodeId !== undefined
              ? { costCodeId: input.costCodeId }
              : {}),
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
            amount: this.amount(merged.quantity, merged.rate),
          },
          include: this.itemInclude(),
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'BOQ_ITEM',
            entityId: row.id,
            action:
              input.isActive === false
                ? 'ARCHIVE'
                : input.isActive === true
                  ? 'REACTIVATE'
                  : 'UPDATE',
            oldValues: before,
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.duplicate(
        error,
        'BOQ Item code is already in use for this Project BOQ.',
      );
      throw error;
    }
  }

  async listRevisions(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.budgetRevision.findMany({
      where: { companyId: auth.companyId, projectId },
      include: {
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            currentStepNo: true,
            startedAt: true,
            completedAt: true,
          },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { revisionNo: 'desc' },
    });
    const approved = rows.filter(
      (row) =>
        row.approvalInstance?.approvalState ===
        APPROVAL_STATE.APPROVED,
    );
    const originalId = approved.at(-1)?.id;
    const currentId = approved[0]?.id;

    return rows.map((row) => ({
      ...row,
      isOriginal: row.id === originalId,
      isCurrent: row.id === currentId,
    }));
  }

  async getRevision(
    auth: AuthenticatedUserContext,
    revisionId: string,
  ) {
    const row = await this.prisma.budgetRevision.findFirst({
      where: {
        id: revisionId,
        companyId: auth.companyId,
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
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
              },
            },
          },
        },
        submittedBy: {
          select: { id: true, displayName: true, email: true },
        },
        lines: {
          orderBy: [
            { sectionCode: 'asc' },
            { sortOrder: 'asc' },
            { itemCode: 'asc' },
          ],
        },
      },
    });
    if (!row) throw this.revisionNotFound();
    await this.access.assertAccess(auth, row.projectId);

    const approved = await this.prisma.budgetRevision.findMany({
      where: {
        companyId: auth.companyId,
        projectId: row.projectId,
        approvalInstance: {
          is: { approvalState: APPROVAL_STATE.APPROVED },
        },
      },
      select: { id: true },
      orderBy: { revisionNo: 'asc' },
    });

    return {
      ...row,
      isOriginal: row.id === approved[0]?.id,
      isCurrent: row.id === approved.at(-1)?.id,
    };
  }

  async submitRevision(
    context: AuditContext,
    projectId: string,
    workflowCode: string,
    revisionNote?: string | null,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    const revisionNumber = await this.numbers.next(
      context.auth.companyId,
      'BUDGET_REVISION',
    );

    return this.prisma.$transaction(
      async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'budget:' + projectId,
        );

        const boq = await tx.boq.findFirst({
          where: {
            companyId: context.auth.companyId,
            projectId,
          },
          include: {
            items: {
              where: { isActive: true, section: { isActive: true } },
              include: {
                section: true,
                uom: true,
                wbs: true,
                costCode: true,
              },
              orderBy: [
                { section: { sortOrder: 'asc' } },
                { sortOrder: 'asc' },
                { itemCode: 'asc' },
              ],
            },
          },
        });
        if (!boq) throw this.boqNotFound();
        if (!boq.items.length) {
          throw new UnprocessableEntityException({
            code: 'BUDGET_REVISION_EMPTY',
            detail:
              'At least one active BOQ Item is required before submitting a Budget revision.',
          });
        }

        const max = await tx.budgetRevision.aggregate({
          where: { projectId },
          _max: { revisionNo: true },
        });
        const revisionNo = (max._max.revisionNo ?? 0) + 1;

        const revision = await tx.budgetRevision.create({
          data: {
            companyId: context.auth.companyId,
            projectId,
            revisionNo,
            revisionNumber,
            submittedByUserId: context.auth.userId,
            revisionNote: revisionNote ?? null,
          },
        });

        await tx.budgetRevisionLine.createMany({
          data: boq.items.map((item) => ({
            budgetRevisionId: revision.id,
            boqItemId: item.id,
            sectionCode: item.section.sectionCode,
            sectionName: item.section.sectionName,
            itemCode: item.itemCode,
            description: item.description,
            quantity: item.quantity,
            uomId: item.uomId,
            uomCode: item.uom.uomCode,
            uomName: item.uom.uomName,
            rate: item.rate,
            amount: item.amount,
            wbsId: item.wbsId,
            wbsCode: item.wbs?.wbsCode ?? null,
            wbsName: item.wbs?.wbsName ?? null,
            costCodeId: item.costCodeId,
            costCode: item.costCode?.costCode ?? null,
            costName: item.costCode?.costName ?? null,
            sortOrder: item.sortOrder,
          })),
        });

        const approvalInstance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'BUDGET_REVISION',
            entityId: revision.id,
          },
          tx,
        );

        const submitted = await tx.budgetRevision.update({
          where: { id: revision.id },
          data: { approvalInstanceId: approvalInstance.id },
          include: {
            approvalInstance: true,
            _count: { select: { lines: true } },
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'BUDGET_REVISION',
            entityId: revision.id,
            action: 'SUBMIT',
            newValues: {
              projectId,
              revisionNo,
              revisionNumber,
              approvalInstanceId: approvalInstance.id,
              lineCount: boq.items.length,
            },
          },
          tx,
        );

        return {
          ...submitted,
          isOriginal: false,
          isCurrent: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async approveRevision(
    context: AuditContext,
    revisionId: string,
    comment?: string,
  ) {
    const revision = await this.revisionForAction(
      context.auth,
      revisionId,
    );
    const instance = await this.approvals.approve(
      revision.approvalInstanceId,
      context.auth,
      revision.submittedByUserId,
      comment,
    );

    await this.audit.record({
      ...context,
      entityType: 'BUDGET_REVISION',
      entityId: revision.id,
      action: 'APPROVAL_APPROVE',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });

    return this.getRevision(context.auth, revisionId);
  }

  async rejectRevision(
    context: AuditContext,
    revisionId: string,
    comment?: string,
  ) {
    const revision = await this.revisionForAction(
      context.auth,
      revisionId,
    );
    const instance = await this.approvals.reject(
      revision.approvalInstanceId,
      context.auth,
      revision.submittedByUserId,
      comment,
    );

    await this.audit.record({
      ...context,
      entityType: 'BUDGET_REVISION',
      entityId: revision.id,
      action: 'APPROVAL_REJECT',
      newValues: {
        approvalInstanceId: instance.id,
        approvalState: instance.approvalState,
      },
    });

    return this.getRevision(context.auth, revisionId);
  }

  async summary(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const revisions = await this.prisma.budgetRevision.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        approvalInstance: {
          is: { approvalState: APPROVAL_STATE.APPROVED },
        },
      },
      include: {
        approvalInstance: {
          select: { completedAt: true },
        },
        lines: true,
      },
      orderBy: { revisionNo: 'asc' },
    });

    const original = revisions[0] ?? null;
    const current = revisions.at(-1) ?? null;

    return {
      projectId,
      original: original ? this.revisionSummary(original) : null,
      current: current ? this.revisionSummary(current) : null,
    };
  }

  async approvedBudget(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const current = await this.prisma.budgetRevision.findFirst({
      where: {
        companyId: auth.companyId,
        projectId,
        approvalInstance: {
          is: { approvalState: APPROVAL_STATE.APPROVED },
        },
      },
      include: {
        approvalInstance: {
          select: {
            id: true,
            approvalState: true,
            completedAt: true,
          },
        },
        lines: {
          orderBy: [
            { sectionCode: 'asc' },
            { sortOrder: 'asc' },
            { itemCode: 'asc' },
          ],
        },
      },
      orderBy: { revisionNo: 'desc' },
    });
    return current;
  }

  private revisionSummary(revision: {
    id: string;
    revisionNo: number;
    revisionNumber: string;
    approvalInstance: { completedAt: Date | null } | null;
    lines: Array<{
      amount: Prisma.Decimal;
      wbsId: string | null;
      wbsCode: string | null;
      wbsName: string | null;
      costCodeId: string | null;
      costCode: string | null;
      costName: string | null;
    }>;
  }) {
    const total = revision.lines.reduce(
      (sum, line) => sum.plus(line.amount),
      new Prisma.Decimal(0),
    );
    const byWbs = new Map<
      string,
      {
        wbsId: string | null;
        wbsCode: string | null;
        wbsName: string | null;
        amount: Prisma.Decimal;
      }
    >();
    const byCostCode = new Map<
      string,
      {
        costCodeId: string | null;
        costCode: string | null;
        costName: string | null;
        amount: Prisma.Decimal;
      }
    >();

    for (const line of revision.lines) {
      const wbsKey = line.wbsId ?? '__UNALLOCATED__';
      const wbs = byWbs.get(wbsKey) ?? {
        wbsId: line.wbsId,
        wbsCode: line.wbsCode,
        wbsName: line.wbsName,
        amount: new Prisma.Decimal(0),
      };
      wbs.amount = wbs.amount.plus(line.amount);
      byWbs.set(wbsKey, wbs);

      const costKey = line.costCodeId ?? '__UNALLOCATED__';
      const cost = byCostCode.get(costKey) ?? {
        costCodeId: line.costCodeId,
        costCode: line.costCode,
        costName: line.costName,
        amount: new Prisma.Decimal(0),
      };
      cost.amount = cost.amount.plus(line.amount);
      byCostCode.set(costKey, cost);
    }

    return {
      id: revision.id,
      revisionNo: revision.revisionNo,
      revisionNumber: revision.revisionNumber,
      approvedAt: revision.approvalInstance?.completedAt ?? null,
      total,
      byWbs: [...byWbs.values()],
      byCostCode: [...byCostCode.values()],
    };
  }

  private amount(quantity: Prisma.Decimal, rate: Prisma.Decimal) {
    return quantity.mul(rate).toDecimalPlaces(4);
  }

  private async validateItemReferences(
    tx: Prisma.TransactionClient,
    companyId: string,
    projectId: string,
    boqId: string,
    input: {
      sectionId: string;
      uomId: string;
      wbsId?: string | null;
      costCodeId?: string | null;
    },
  ) {
    const [section, uom, wbs, costCode] = await Promise.all([
      tx.boqSection.findFirst({
        where: { id: input.sectionId, boqId, isActive: true },
        select: { id: true },
      }),
      tx.unitOfMeasure.findFirst({
        where: {
          id: input.uomId,
          companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      input.wbsId
        ? tx.wbsElement.findFirst({
            where: {
              id: input.wbsId,
              projectId,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      input.costCodeId
        ? tx.costCode.findFirst({
            where: {
              id: input.costCodeId,
              companyId,
              isActive: true,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
    ]);

    if (!section) {
      throw new UnprocessableEntityException({
        code: 'BOQ_SECTION_INVALID',
        detail: 'BOQ Item Section must be active and belong to the same BOQ.',
      });
    }
    if (!uom) {
      throw new UnprocessableEntityException({
        code: 'BOQ_UOM_INVALID',
        detail: 'BOQ Item UOM must be active and belong to the same Company.',
      });
    }
    if (input.wbsId && !wbs) {
      throw new UnprocessableEntityException({
        code: 'BOQ_WBS_INVALID',
        detail: 'BOQ Item WBS must be active and belong to the same Project.',
      });
    }
    if (input.costCodeId && !costCode) {
      throw new UnprocessableEntityException({
        code: 'BOQ_COST_CODE_INVALID',
        detail:
          'BOQ Item Cost Code must be active and belong to the same Company.',
      });
    }
  }

  private async boqForAction(
    auth: AuthenticatedUserContext,
    boqId: string,
    tx: Prisma.TransactionClient,
  ) {
    const boq = await tx.boq.findFirst({
      where: { id: boqId, companyId: auth.companyId },
      select: { id: true, projectId: true },
    });
    if (!boq) throw this.boqNotFound();
    await this.access.assertAccess(auth, boq.projectId, tx);
    return boq;
  }

  private async revisionForAction(
    auth: AuthenticatedUserContext,
    revisionId: string,
  ) {
    const revision = await this.prisma.budgetRevision.findFirst({
      where: { id: revisionId, companyId: auth.companyId },
      select: {
        id: true,
        projectId: true,
        approvalInstanceId: true,
        submittedByUserId: true,
      },
    });
    if (!revision || !revision.approvalInstanceId) {
      throw this.revisionNotFound();
    }
    await this.access.assertAccess(auth, revision.projectId);
    return {
      ...revision,
      approvalInstanceId: revision.approvalInstanceId,
    };
  }

  private itemInclude() {
    return {
      section: {
        select: { id: true, sectionCode: true, sectionName: true },
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
    } as const;
  }

  private duplicate(error: unknown, detail: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_CODE',
        detail,
      });
    }
  }

  private projectNotFound() {
    return new NotFoundException({
      code: 'PROJECT_NOT_FOUND',
      detail: 'Project not found.',
    });
  }

  private boqNotFound() {
    return new NotFoundException({
      code: 'BOQ_NOT_FOUND',
      detail: 'Project BOQ not found.',
    });
  }

  private sectionNotFound() {
    return new NotFoundException({
      code: 'BOQ_SECTION_NOT_FOUND',
      detail: 'BOQ Section not found.',
    });
  }

  private itemNotFound() {
    return new NotFoundException({
      code: 'BOQ_ITEM_NOT_FOUND',
      detail: 'BOQ Item not found.',
    });
  }

  private revisionNotFound() {
    return new NotFoundException({
      code: 'BUDGET_REVISION_NOT_FOUND',
      detail: 'Budget Revision not found.',
    });
  }
}
