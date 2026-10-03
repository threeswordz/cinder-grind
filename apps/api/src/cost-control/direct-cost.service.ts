import { createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type CostDb = Prisma.TransactionClient | PrismaService;

export type DirectCostDraftInput = {
  postingDate: Date;
  description: string;
  reference?: string | null;
  amount: Prisma.Decimal;
  wbsId?: string | null;
  costCodeId: string;
  createKey: string;
};

export type DirectCostDraftUpdate = {
  postingDate?: Date;
  description?: string;
  reference?: string | null;
  amount?: Prisma.Decimal;
  wbsId?: string | null;
  costCodeId?: string;
};

export type DirectCostReversalInput = {
  postingDate: Date;
  reason: string;
  reference?: string | null;
  createKey: string;
};

@Injectable()
export class DirectCostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    const historicalProjects = await this.prisma.directCostPosting.findMany({
      where: { companyId: auth.companyId },
      select: { projectId: true },
      distinct: ['projectId'],
    });
    const historicalProjectIds = historicalProjects.map(
      (posting) => posting.projectId,
    );
    return this.prisma.project.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { isActive: true },
              { id: { in: historicalProjectIds } },
            ],
          },
        ],
      },
      select: { id: true, projectCode: true, projectName: true, isActive: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'DIRECT_COST_POSTING',
        isActive: true,
        steps: { some: {} },
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [company, project, wbs, costCodes] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.project.findFirst({
        where: {
          id: projectId,
          companyId: auth.companyId,
        },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          isActive: true,
        },
      }),
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
    if (!project) throw this.notFound();
    return {
      project,
      baseCurrencyCode: company.baseCurrencyCode,
      wbs,
      costCodes,
    };
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    this.assertSourcePermission(auth);
    await this.access.assertAccess(auth, projectId);
    return this.prisma.directCostPosting.findMany({
      where: { companyId: auth.companyId, projectId },
      orderBy: [{ postingDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async get(auth: AuthenticatedUserContext, postingId: string) {
    this.assertSourcePermission(auth);
    const posting = await this.visiblePosting(auth, postingId, this.prisma);
    return this.hydrate(posting, this.prisma);
  }

  async create(
    context: AuditContext,
    projectId: string,
    input: DirectCostDraftInput,
  ) {
    await this.access.assertAccess(context.auth, projectId);
    this.assertPositiveAmount(input.amount);
    const payloadHash = this.createPayloadHash(projectId, input);
    const existing = await this.prisma.directCostPosting.findFirst({
      where: {
        companyId: context.auth.companyId,
        createdByUserId: context.auth.userId,
        createKey: input.createKey,
      },
    });
    if (existing) {
      if (existing.createPayloadHash !== payloadHash) this.throwReplayConflict();
      return this.get(context.auth, existing.id);
    }

    const currencyCode = await this.assertDimensions(
      this.prisma,
      context.auth.companyId,
      projectId,
      input.wbsId ?? null,
      input.costCodeId,
    );

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          await this.access.assertAccess(context.auth, projectId, tx);
          await this.assertDimensions(
            tx,
            context.auth.companyId,
            projectId,
            input.wbsId ?? null,
            input.costCodeId,
            currencyCode,
          );
          const raced = await tx.directCostPosting.findFirst({
            where: {
              companyId: context.auth.companyId,
              createdByUserId: context.auth.userId,
              createKey: input.createKey,
            },
          });
          if (raced) {
            if (raced.createPayloadHash !== payloadHash) this.throwReplayConflict();
            return raced;
          }
          const row = await tx.directCostPosting.create({
            data: {
              companyId: context.auth.companyId,
              projectId,
              wbsId: input.wbsId ?? null,
              costCodeId: input.costCodeId,
              postingDate: input.postingDate,
              description: input.description,
              reference: input.reference ?? null,
              amount: input.amount,
              currencyCode,
              createKey: input.createKey,
              createPayloadHash: payloadHash,
              createdByUserId: context.auth.userId,
            },
          });
          await this.audit.record(
            {
              ...context,
              entityType: 'DIRECT_COST_POSTING',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                projectId,
                wbsId: row.wbsId,
                costCodeId: row.costCodeId,
                postingDate: row.postingDate,
                description: row.description,
                reference: row.reference,
                amount: row.amount.toFixed(2),
                currencyCode: row.currencyCode,
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      return this.get(context.auth, created.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.directCostPosting.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
        });
        if (replay) {
          if (replay.createPayloadHash !== payloadHash) this.throwReplayConflict();
          return this.get(context.auth, replay.id);
        }
      }
      throw error;
    }
  }

  async update(
    context: AuditContext,
    postingId: string,
    input: DirectCostDraftUpdate,
  ) {
    const updated = await this.prisma.$transaction(
      async (tx) => {
        await this.visiblePosting(context.auth, postingId, tx);
        await this.lockPosting(context.auth.companyId, postingId, tx);
        const current = await tx.directCostPosting.findUniqueOrThrow({
          where: { id: postingId },
        });
        this.assertDraft(current.state);
        if (current.createdByUserId !== context.auth.userId) {
          throw new ForbiddenException({
            code: 'DIRECT_COST_DRAFT_EDITOR_DENIED',
            detail:
              'Only the original Direct Cost maker may edit this Draft. A material editor cannot later be treated as an independent approver.',
          });
        }
        if (
          current.reversesPostingId &&
          (input.amount !== undefined ||
            input.wbsId !== undefined ||
            input.costCodeId !== undefined)
        ) {
          throw new ConflictException({
            code: 'DIRECT_COST_REVERSAL_DIMENSIONS_IMMUTABLE',
            detail:
              'A linked reversal must retain the original amount and dimensions.',
          });
        }
        const next = {
          postingDate: input.postingDate ?? current.postingDate,
          description: input.description ?? current.description,
          reference:
            input.reference !== undefined ? input.reference : current.reference,
          amount: input.amount ?? current.amount,
          wbsId: input.wbsId !== undefined ? input.wbsId : current.wbsId,
          costCodeId: input.costCodeId ?? current.costCodeId,
        };
        if (!current.reversesPostingId) this.assertPositiveAmount(next.amount);
        if (current.reversesPostingId) {
          await this.assertHistoricalReversalDimensions(
            tx,
            context.auth.companyId,
            current.projectId,
            next.wbsId,
            next.costCodeId,
          );
          await this.assertReversalIntegrity(tx, { ...current, ...next });
        } else {
          await this.assertDimensions(
            tx,
            context.auth.companyId,
            current.projectId,
            next.wbsId,
            next.costCodeId,
            current.currencyCode,
          );
        }
        const row = await tx.directCostPosting.update({
          where: { id: postingId },
          data: {
            postingDate: next.postingDate,
            description: next.description,
            reference: next.reference,
            amount: next.amount,
            wbsId: next.wbsId,
            costCodeId: next.costCodeId,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'DIRECT_COST_POSTING',
            entityId: postingId,
            action: 'UPDATE_DRAFT',
            oldValues: {
              postingDate: current.postingDate,
              description: current.description,
              reference: current.reference,
              amount: current.amount.toFixed(2),
              wbsId: current.wbsId,
              costCodeId: current.costCodeId,
            },
            newValues: {
              postingDate: row.postingDate,
              description: row.description,
              reference: row.reference,
              amount: row.amount.toFixed(2),
              wbsId: row.wbsId,
              costCodeId: row.costCodeId,
            },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.get(context.auth, updated.id);
  }

  async createReversal(
    context: AuditContext,
    sourcePostingId: string,
    input: DirectCostReversalInput,
  ) {
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify({
          sourcePostingId,
          postingDate: this.dateKey(input.postingDate),
          reason: input.reason,
          reference: input.reference ?? null,
        }),
      )
      .digest('hex');

    const created = await this.prisma.$transaction(
      async (tx) => {
        const source = await this.visiblePosting(
          context.auth,
          sourcePostingId,
          tx,
        );
        await this.lockPosting(context.auth.companyId, sourcePostingId, tx);
        const current = await tx.directCostPosting.findUniqueOrThrow({
          where: { id: sourcePostingId },
        });
        if (current.state !== 'APPROVED' || current.reversesPostingId) {
          throw new ConflictException({
            code: 'DIRECT_COST_REVERSAL_SOURCE_INVALID',
            detail:
              'Only an approved original Direct Cost Posting can be reversed.',
          });
        }

        const existingByKey = await tx.directCostPosting.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
        });
        if (existingByKey) {
          if (existingByKey.createPayloadHash !== payloadHash) {
            this.throwReplayConflict();
          }
          return existingByKey;
        }

        const activeReversal = await tx.directCostPosting.findFirst({
          where: {
            reversesPostingId: current.id,
            state: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          },
          select: { id: true },
        });
        if (activeReversal) {
          throw new ConflictException({
            code: 'DIRECT_COST_REVERSAL_EXISTS',
            detail:
              'This Direct Cost Posting already has an active or approved linked reversal.',
          });
        }

        await this.assertHistoricalReversalDimensions(
          tx,
          context.auth.companyId,
          current.projectId,
          current.wbsId,
          current.costCodeId,
        );
        const description = ('Reversal: ' + current.description).slice(0, 500);
        const row = await tx.directCostPosting.create({
          data: {
            companyId: current.companyId,
            projectId: current.projectId,
            wbsId: current.wbsId,
            costCodeId: current.costCodeId,
            postingDate: input.postingDate,
            description,
            reference: input.reference ?? current.reference,
            amount: current.amount.negated(),
            currencyCode: current.currencyCode,
            reversesPostingId: current.id,
            reversalReason: input.reason,
            createKey: input.createKey,
            createPayloadHash: payloadHash,
            createdByUserId: context.auth.userId,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'DIRECT_COST_POSTING',
            entityId: row.id,
            action: 'CREATE_REVERSAL_DRAFT',
            newValues: {
              reversesPostingId: current.id,
              reversalReason: input.reason,
              postingDate: row.postingDate,
              amount: row.amount.toFixed(2),
              wbsId: row.wbsId,
              costCodeId: row.costCodeId,
            },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.get(context.auth, created.id);
  }

  async submit(
    context: AuditContext,
    postingId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visiblePosting(context.auth, postingId, tx);
        await this.lockPosting(context.auth.companyId, postingId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'DIRECT_COST_SUBMIT',
            postingId,
            [workflowCode],
          )
        ) {
          return tx.directCostPosting.findUniqueOrThrow({ where: { id: postingId } });
        }
        const current = await tx.directCostPosting.findUniqueOrThrow({
          where: { id: postingId },
        });
        this.assertDraft(current.state);
        await this.revalidate(tx, current);
        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'DIRECT_COST_POSTING',
            entityId: postingId,
          },
          tx,
        );
        const submittedAt = new Date();
        const row = await tx.directCostPosting.update({
          where: { id: postingId },
          data: {
            state: 'SUBMITTED',
            approvalInstanceId: instance.id,
            submittedByUserId: context.auth.userId,
            submittedAt,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'DIRECT_COST_POSTING',
            entityId: postingId,
            action: 'SUBMIT',
            newValues: { workflowCode, approvalInstanceId: instance.id },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(context.auth, result.id);
  }

  async approve(
    context: AuditContext,
    postingId: string,
    actionKey: string,
    comment?: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visiblePosting(context.auth, postingId, tx);
        await this.lockPosting(context.auth.companyId, postingId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'DIRECT_COST_APPROVE',
            postingId,
            [comment ?? ''],
          )
        ) {
          return tx.directCostPosting.findUniqueOrThrow({ where: { id: postingId } });
        }
        const current = await tx.directCostPosting.findUniqueOrThrow({
          where: { id: postingId },
        });
        this.assertSubmitted(current);
        await this.revalidate(tx, current);
        await this.approvals.approve(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          async (approvalTx) => {
            const decision = await approvalTx.approvalAction.findFirst({
              where: {
                approvalInstanceId: current.approvalInstanceId!,
                action: 'APPROVE',
                directCostDecisionOrder: { not: null },
              },
              orderBy: { directCostDecisionOrder: 'desc' },
              select: { actionByUserId: true, actionAt: true },
            });
            if (!decision) {
              throw new ConflictException({
                code: 'DIRECT_COST_DECISION_EVIDENCE_MISSING',
                detail: 'Serialized Direct Cost approval evidence is missing.',
              });
            }
            await approvalTx.directCostPosting.update({
              where: { id: postingId },
              data: {
                state: 'APPROVED',
                approvedByUserId: decision.actionByUserId,
                approvedAt: decision.actionAt,
                decidedAt: decision.actionAt,
              },
            });
          },
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'DIRECT_COST_POSTING',
            entityId: postingId,
            action: 'APPROVE',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return tx.directCostPosting.findUniqueOrThrow({ where: { id: postingId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(context.auth, result.id);
  }

  async reject(
    context: AuditContext,
    postingId: string,
    actionKey: string,
    comment?: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visiblePosting(context.auth, postingId, tx);
        await this.lockPosting(context.auth.companyId, postingId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'DIRECT_COST_REJECT',
            postingId,
            [comment ?? ''],
          )
        ) {
          return tx.directCostPosting.findUniqueOrThrow({ where: { id: postingId } });
        }
        const current = await tx.directCostPosting.findUniqueOrThrow({
          where: { id: postingId },
        });
        this.assertSubmitted(current);
        await this.approvals.reject(
          current.approvalInstanceId!,
          context.auth,
          current.createdByUserId,
          comment,
          tx,
        );
        const decision = await tx.approvalAction.findFirst({
          where: {
            approvalInstanceId: current.approvalInstanceId!,
            action: 'REJECT',
            directCostDecisionOrder: { not: null },
          },
          orderBy: { directCostDecisionOrder: 'desc' },
          select: { actionByUserId: true, actionAt: true, comment: true },
        });
        if (!decision) {
          throw new ConflictException({
            code: 'DIRECT_COST_DECISION_EVIDENCE_MISSING',
            detail: 'Serialized Direct Cost rejection evidence is missing.',
          });
        }
        const row = await tx.directCostPosting.update({
          where: { id: postingId },
          data: {
            state: 'REJECTED',
            rejectedByUserId: decision.actionByUserId,
            rejectedAt: decision.actionAt,
            decidedAt: decision.actionAt,
            rejectionReason: decision.comment,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'DIRECT_COST_POSTING',
            entityId: postingId,
            action: 'REJECT',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(context.auth, result.id);
  }

  private async revalidate(
    tx: Prisma.TransactionClient,
    posting: {
      id: string;
      companyId: string;
      projectId: string;
      wbsId: string | null;
      costCodeId: string;
      amount: Prisma.Decimal;
      currencyCode: string;
      reversesPostingId: string | null;
      reversalReason: string | null;
    },
  ) {
    if (posting.reversesPostingId) {
      await this.assertHistoricalReversalDimensions(
        tx,
        posting.companyId,
        posting.projectId,
        posting.wbsId,
        posting.costCodeId,
      );
      await this.assertReversalIntegrity(tx, posting);
    } else {
      await this.assertDimensions(
        tx,
        posting.companyId,
        posting.projectId,
        posting.wbsId,
        posting.costCodeId,
        posting.currencyCode,
      );
      this.assertPositiveAmount(posting.amount);
    }
  }

  private async assertDimensions(
    db: CostDb,
    companyId: string,
    projectId: string,
    wbsId: string | null,
    costCodeId: string,
    expectedCurrency?: string,
  ): Promise<string> {
    const [company, project, wbs, costCode] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { baseCurrencyCode: true },
      }),
      db.project.findFirst({
        where: { id: projectId, companyId, isActive: true },
        select: { id: true },
      }),
      wbsId
        ? db.wbsElement.findFirst({
            where: { id: wbsId, projectId, isActive: true },
            select: { id: true },
          })
        : Promise.resolve(null),
      db.costCode.findFirst({
        where: { id: costCodeId, companyId, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!company || !project || (wbsId && !wbs) || !costCode) {
      throw new UnprocessableEntityException({
        code: 'DIRECT_COST_SCOPE_INVALID',
        detail:
          'Project, WBS and Cost Code must be active and remain within the authenticated Company and Project scope.',
      });
    }
    if (
      expectedCurrency &&
      expectedCurrency !== company.baseCurrencyCode
    ) {
      throw new UnprocessableEntityException({
        code: 'DIRECT_COST_CURRENCY_UNSUPPORTED',
        detail:
          'Direct Cost Posting currency must equal the current Company base currency. V0.7 performs no FX conversion.',
      });
    }
    return company.baseCurrencyCode;
  }

  private async assertHistoricalReversalDimensions(
    db: CostDb,
    companyId: string,
    projectId: string,
    wbsId: string | null,
    costCodeId: string,
  ): Promise<void> {
    const [company, project, wbs, costCode] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      }),
      db.project.findFirst({
        where: { id: projectId, companyId },
        select: { id: true },
      }),
      wbsId
        ? db.wbsElement.findFirst({
            where: { id: wbsId, projectId },
            select: { id: true },
          })
        : Promise.resolve(null),
      db.costCode.findFirst({
        where: { id: costCodeId, companyId },
        select: { id: true },
      }),
    ]);
    if (!company || !project || (wbsId && !wbs) || !costCode) {
      throw new UnprocessableEntityException({
        code: 'DIRECT_COST_REVERSAL_SCOPE_INVALID',
        detail:
          'A linked reversal must preserve historical Project, WBS and Cost Code identity within the original Company and Project.',
      });
    }
  }

  private async assertReversalIntegrity(
    db: CostDb,
    posting: {
      id: string;
      companyId: string;
      projectId: string;
      wbsId: string | null;
      costCodeId: string;
      amount: Prisma.Decimal;
      currencyCode: string;
      reversesPostingId: string | null;
      reversalReason: string | null;
    },
  ) {
    if (!posting.reversesPostingId) return;
    const original = await db.directCostPosting.findFirst({
      where: {
        id: posting.reversesPostingId,
        companyId: posting.companyId,
        projectId: posting.projectId,
        state: 'APPROVED',
        reversesPostingId: null,
      },
    });
    if (
      !original ||
      posting.amount.toFixed(2) !== original.amount.negated().toFixed(2) ||
      posting.currencyCode !== original.currencyCode ||
      posting.wbsId !== original.wbsId ||
      posting.costCodeId !== original.costCodeId ||
      !posting.reversalReason?.trim()
    ) {
      throw new ConflictException({
        code: 'DIRECT_COST_REVERSAL_INVALID',
        detail:
          'A linked reversal must exactly offset an approved original posting and preserve its dimensions and currency.',
      });
    }
  }

  private async visiblePosting(
    auth: AuthenticatedUserContext,
    postingId: string,
    db: CostDb,
  ) {
    const posting = await db.directCostPosting.findFirst({
      where: { id: postingId, companyId: auth.companyId },
    });
    if (!posting) throw this.notFound();
    await this.access.assertAccess(auth, posting.projectId, db);
    return posting;
  }

  private async hydrate(
    posting: Awaited<ReturnType<DirectCostService['visiblePosting']>>,
    db: CostDb,
  ) {
    const actorIds = [
      posting.createdByUserId,
      posting.submittedByUserId,
      posting.approvedByUserId,
      posting.rejectedByUserId,
    ].filter((value): value is string => Boolean(value));
    const [project, wbs, costCode, actors, approvalInstance] = await Promise.all([
      db.project.findFirst({
        where: { id: posting.projectId, companyId: posting.companyId },
        select: { id: true, projectCode: true, projectName: true },
      }),
      posting.wbsId
        ? db.wbsElement.findFirst({
            where: { id: posting.wbsId, projectId: posting.projectId },
            select: { id: true, wbsCode: true, wbsName: true },
          })
        : Promise.resolve(null),
      db.costCode.findFirst({
        where: { id: posting.costCodeId, companyId: posting.companyId },
        select: { id: true, costCode: true, costName: true },
      }),
      db.user.findMany({
        where: { id: { in: actorIds }, companyId: posting.companyId },
        select: { id: true, displayName: true },
      }),
      posting.approvalInstanceId
        ? db.approvalInstance.findUnique({
            where: { id: posting.approvalInstanceId },
            include: {
              workflow: {
                select: {
                  id: true,
                  workflowCode: true,
                  workflowName: true,
                },
              },
              actions: {
                orderBy: [
                  { directCostDecisionOrder: 'asc' },
                  { actionAt: 'asc' },
                ],
                include: {
                  approvalStep: {
                    select: { stepNo: true, stepName: true },
                  },
                  actionByUser: {
                    select: { id: true, displayName: true },
                  },
                },
              },
            },
          })
        : Promise.resolve(null),
    ]);
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      ...posting,
      project,
      wbs,
      costCode,
      createdBy: actorById.get(posting.createdByUserId) ?? null,
      submittedBy: posting.submittedByUserId
        ? actorById.get(posting.submittedByUserId) ?? null
        : null,
      approvedBy: posting.approvedByUserId
        ? actorById.get(posting.approvedByUserId) ?? null
        : null,
      rejectedBy: posting.rejectedByUserId
        ? actorById.get(posting.rejectedByUserId) ?? null
        : null,
      approvalInstance,
    };
  }

  private async lockPosting(
    companyId: string,
    postingId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "direct_cost_postings"
      WHERE "id" = ${postingId}::uuid
        AND "company_id" = ${companyId}::uuid
      FOR UPDATE
    `);
  }

  private async claimReplay(
    tx: Prisma.TransactionClient,
    auth: AuthenticatedUserContext,
    actionKey: string,
    actionType: string,
    entityId: string,
    payload: unknown[],
  ) {
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const key = {
      companyId_userId_actionKey: {
        companyId: auth.companyId,
        userId: auth.userId,
        actionKey,
      },
    } as const;
    const matches = (row: {
      actionType: string;
      entityType: string;
      entityId: string;
      payloadHash: string;
    }) =>
      row.actionType === actionType &&
      row.entityType === 'DIRECT_COST_POSTING' &&
      row.entityId === entityId &&
      row.payloadHash === payloadHash;

    const existing = await tx.costActionReplay.findUnique({ where: key });
    if (existing) {
      if (!matches(existing)) this.throwReplayConflict();
      return true;
    }
    const inserted = await tx.costActionReplay.createMany({
      data: [
        {
          companyId: auth.companyId,
          userId: auth.userId,
          actionKey,
          actionType,
          entityType: 'DIRECT_COST_POSTING',
          entityId,
          payloadHash,
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.costActionReplay.findUnique({ where: key });
    if (!raced || !matches(raced)) this.throwReplayConflict();
    return true;
  }

  private createPayloadHash(
    projectId: string,
    input: DirectCostDraftInput,
  ) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          projectId,
          postingDate: this.dateKey(input.postingDate),
          description: input.description,
          reference: input.reference ?? null,
          amount: input.amount.toFixed(2),
          wbsId: input.wbsId ?? null,
          costCodeId: input.costCodeId,
        }),
      )
      .digest('hex');
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  private assertPositiveAmount(amount: Prisma.Decimal) {
    if (!amount.isPositive() || amount.decimalPlaces() > 2) {
      throw new UnprocessableEntityException({
        code: 'DIRECT_COST_AMOUNT_INVALID',
        detail:
          'A normal Direct Cost Posting amount must be positive with at most 2 decimal places.',
      });
    }
  }

  private assertDraft(state: string) {
    if (state !== 'DRAFT') {
      throw new ConflictException({
        code: 'DIRECT_COST_NOT_DRAFT',
        detail: 'Only a Draft Direct Cost Posting can be edited or submitted.',
      });
    }
  }

  private assertSubmitted(posting: {
    state: string;
    approvalInstanceId: string | null;
  }) {
    if (posting.state !== 'SUBMITTED' || !posting.approvalInstanceId) {
      throw new ConflictException({
        code: 'DIRECT_COST_NOT_SUBMITTED',
        detail:
          'This Direct Cost Posting is not awaiting an approval action.',
      });
    }
  }

  private assertSourcePermission(auth: AuthenticatedUserContext) {
    if (
      !auth.permissions.some((permission) =>
        permission.startsWith('cost.direct_posting.'),
      )
    ) {
      throw new ForbiddenException({
        code: 'DIRECT_COST_SOURCE_FORBIDDEN',
        detail:
          'Direct Cost source records require an explicit Direct Cost action permission in addition to Cost Control aggregate visibility.',
      });
    }
  }

  private throwReplayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail:
        'This action key is already paired with a different Cost Control action, record, or payload.',
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'DIRECT_COST_NOT_FOUND',
      detail: 'Direct Cost Posting not found.',
    });
  }
}
