import { createHash } from 'node:crypto';

import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };
type CostDb = Prisma.TransactionClient | PrismaService;

type DraftInput = {
  variationNumber: string; description: string; reason?: string | null;
  valueDelta: Prisma.Decimal; createKey: string;
};
type DraftUpdate = { description?: string; reason?: string | null; valueDelta?: Prisma.Decimal };
type ReversalInput = { variationNumber: string; reason: string; createKey: string };

@Injectable()
export class ProjectVariationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: { companyId: auth.companyId, entityType: 'PROJECT_VARIATION', isActive: true, steps: { some: {} } },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    this.assertSourcePermission(auth);
    await this.access.assertAccess(auth, projectId);
    return this.prisma.projectVariation.findMany({
      where: { companyId: auth.companyId, projectId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async get(auth: AuthenticatedUserContext, variationId: string) {
    this.assertSourcePermission(auth);
    const row = await this.visible(auth, variationId, this.prisma);
    return this.hydrate(row, this.prisma);
  }

  async create(context: AuditContext, projectId: string, input: DraftInput) {
    await this.access.assertAccess(context.auth, projectId);
    this.assertNonZero(input.valueDelta);
    const hash = this.payloadHash(projectId, input);
    const replay = await this.prisma.projectVariation.findFirst({
      where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
    });
    if (replay) {
      if (replay.createPayloadHash !== hash) this.replayConflict();
      return this.get(context.auth, replay.id);
    }
    const currencyCode = await this.assertActiveScope(this.prisma, context.auth.companyId, projectId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, projectId, tx);
        await this.assertActiveScope(tx, context.auth.companyId, projectId, currencyCode);
        const raced = await tx.projectVariation.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (raced) {
          if (raced.createPayloadHash !== hash) this.replayConflict();
          return raced;
        }
        const row = await tx.projectVariation.create({
          data: {
            companyId: context.auth.companyId, projectId,
            variationNumber: input.variationNumber, description: input.description,
            reason: input.reason ?? null, valueDelta: input.valueDelta, currencyCode,
            createKey: input.createKey, createPayloadHash: hash,
            createdByUserId: context.auth.userId,
          },
        });
        await this.audit.record({
          ...context, entityType: 'PROJECT_VARIATION', entityId: row.id, action: 'CREATE_DRAFT',
          newValues: {
            projectId, variationNumber: row.variationNumber, description: row.description,
            reason: row.reason, valueDelta: row.valueDelta.toFixed(2), currencyCode,
          },
        }, tx);
          return row;
        },
      );
      return this.get(context.auth, created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const retry = await this.prisma.projectVariation.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (retry) {
          if (retry.createPayloadHash !== hash) this.replayConflict();
          return this.get(context.auth, retry.id);
        }
        throw new ConflictException({ code: 'PROJECT_VARIATION_NUMBER_EXISTS', detail: 'Variation number must be unique within the Project.' });
      }
      throw error;
    }
  }

  async update(context: AuditContext, variationId: string, input: DraftUpdate) {
    const row = await this.serializedVariationWrite(
      context.auth,
      variationId,
      async (tx) => {
        const current = await tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
        this.assertDraft(current.state);
        if (current.createdByUserId !== context.auth.userId) {
          throw new ForbiddenException({ code: 'PROJECT_VARIATION_DRAFT_EDITOR_DENIED', detail: 'Only the original maker may edit this Draft.' });
        }
        if (current.reversesVariationId && (input.valueDelta !== undefined || input.reason !== undefined)) {
          throw new ConflictException({ code: 'PROJECT_VARIATION_REVERSAL_VALUE_IMMUTABLE', detail: 'A linked reversal must retain the exact offset and reversal reason.' });
        }
        const next = {
          description: input.description ?? current.description,
          reason: input.reason !== undefined ? input.reason : current.reason,
          valueDelta: input.valueDelta ?? current.valueDelta,
        };
        this.assertNonZero(next.valueDelta);
        if (current.reversesVariationId) await this.assertReversal(tx, { ...current, ...next });
        else await this.assertActiveScope(tx, current.companyId, current.projectId, current.currencyCode);
        const updated = await tx.projectVariation.update({ where: { id: variationId }, data: next });
        await this.audit.record({
          ...context, entityType: 'PROJECT_VARIATION', entityId: variationId, action: 'UPDATE_DRAFT',
          oldValues: { description: current.description, reason: current.reason, valueDelta: current.valueDelta.toFixed(2) },
          newValues: { description: updated.description, reason: updated.reason, valueDelta: updated.valueDelta.toFixed(2) },
        }, tx);
        return updated;
      },
    );
    return this.get(context.auth, row.id);
  }

  async createReversal(context: AuditContext, sourceId: string, input: ReversalInput) {
    const hash = createHash('sha256').update(JSON.stringify({
      sourceId, variationNumber: input.variationNumber, reason: input.reason,
    })).digest('hex');
    try {
      const created = await this.serializedVariationWrite(
        context.auth,
        sourceId,
        async (tx) => {
          const source = await tx.projectVariation.findUniqueOrThrow({ where: { id: sourceId } });
        if (source.state !== 'APPROVED' || source.reversesVariationId) {
          throw new ConflictException({ code: 'PROJECT_VARIATION_REVERSAL_SOURCE_INVALID', detail: 'Only an approved original Project Variation can be reversed.' });
        }
        const replay = await tx.projectVariation.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (replay) {
          if (replay.createPayloadHash !== hash) this.replayConflict();
          return replay;
        }
        if (await tx.projectVariation.findFirst({
          where: { reversesVariationId: source.id, state: { in: ['DRAFT','SUBMITTED','APPROVED'] } },
          select: { id: true },
        })) {
          throw new ConflictException({ code: 'PROJECT_VARIATION_REVERSAL_EXISTS', detail: 'This variation already has an active or approved compensating reversal.' });
        }
        await this.assertHistoricalScope(tx, source.companyId, source.projectId);
        const row = await tx.projectVariation.create({
          data: {
            companyId: source.companyId, projectId: source.projectId,
            variationNumber: input.variationNumber,
            description: ('Reversal: ' + source.description).slice(0, 500),
            reason: input.reason, valueDelta: source.valueDelta.negated(),
            currencyCode: source.currencyCode, reversesVariationId: source.id,
            reversalReason: input.reason, createKey: input.createKey,
            createPayloadHash: hash, createdByUserId: context.auth.userId,
          },
        });
        await this.audit.record({
          ...context, entityType: 'PROJECT_VARIATION', entityId: row.id, action: 'CREATE_REVERSAL_DRAFT',
          newValues: { reversesVariationId: source.id, variationNumber: row.variationNumber, reversalReason: input.reason, valueDelta: row.valueDelta.toFixed(2) },
        }, tx);
        return row;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.get(context.auth, created.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const replay = await this.prisma.projectVariation.findFirst({
          where: { companyId: context.auth.companyId, createdByUserId: context.auth.userId, createKey: input.createKey },
        });
        if (replay) {
          if (replay.createPayloadHash !== hash) this.replayConflict();
          return this.get(context.auth, replay.id);
        }
        throw new ConflictException({ code: 'PROJECT_VARIATION_NUMBER_EXISTS', detail: 'Variation number must be unique within the Project.' });
      }
      throw error;
    }
  }

  async submit(context: AuditContext, variationId: string, workflowCode: string, actionKey: string) {
    const row = await this.serializedVariationWrite(
      context.auth,
      variationId,
      async (tx) => {
        if (await this.claimReplay(tx, context.auth, actionKey, 'PROJECT_VARIATION_SUBMIT', variationId, [workflowCode])) {
          return tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
        }
        const current = await tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
        this.assertDraft(current.state);
        await this.revalidate(tx, current);
        const instance = await this.approvals.start({
          companyId: context.auth.companyId, workflowCode,
          entityType: 'PROJECT_VARIATION', entityId: variationId,
        }, tx);
        const updated = await tx.projectVariation.update({
          where: { id: variationId },
          data: { state: 'SUBMITTED', approvalInstanceId: instance.id, submittedByUserId: context.auth.userId, submittedAt: new Date() },
        });
        await this.audit.record({
          ...context, entityType: 'PROJECT_VARIATION', entityId: variationId, action: 'SUBMIT',
          newValues: { workflowCode, approvalInstanceId: instance.id },
        }, tx);
        return updated;
      },
    );
    return this.get(context.auth, row.id);
  }

  async approve(context: AuditContext, variationId: string, actionKey: string, comment?: string) {
    const row = await this.serializedVariationWrite(
      context.auth,
      variationId,
      async (tx) => {
        if (await this.claimReplay(tx, context.auth, actionKey, 'PROJECT_VARIATION_APPROVE', variationId, [comment ?? ''])) {
        return tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
      }
      const current = await tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
      this.assertSubmitted(current);
      await this.revalidate(tx, current);
      await this.approvals.approve(
        current.approvalInstanceId!, context.auth, current.createdByUserId, comment,
        async (approvalTx) => {
          const decision = await approvalTx.approvalAction.findFirst({
            where: { approvalInstanceId: current.approvalInstanceId!, action: 'APPROVE', projectVariationDecisionOrder: { not: null } },
            orderBy: { projectVariationDecisionOrder: 'desc' },
            select: { actionByUserId: true, actionAt: true },
          });
          if (!decision) throw new ConflictException({ code: 'PROJECT_VARIATION_DECISION_EVIDENCE_MISSING', detail: 'Serialized approval evidence is missing.' });
          await approvalTx.projectVariation.update({
            where: { id: variationId },
            data: { state: 'APPROVED', approvedByUserId: decision.actionByUserId, approvedAt: decision.actionAt, decidedAt: decision.actionAt },
          });
        }, tx,
      );
      await this.audit.record({
        ...context, entityType: 'PROJECT_VARIATION', entityId: variationId, action: 'APPROVE',
        newValues: { comment: comment ?? null },
      }, tx);
        return tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
      },
    );
    return this.get(context.auth, row.id);
  }

  async reject(context: AuditContext, variationId: string, actionKey: string, comment?: string) {
    const row = await this.serializedVariationWrite(
      context.auth,
      variationId,
      async (tx) => {
        if (await this.claimReplay(tx, context.auth, actionKey, 'PROJECT_VARIATION_REJECT', variationId, [comment ?? ''])) {
        return tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
      }
      const current = await tx.projectVariation.findUniqueOrThrow({ where: { id: variationId } });
      this.assertSubmitted(current);
      await this.approvals.reject(current.approvalInstanceId!, context.auth, current.createdByUserId, comment, tx);
      const decision = await tx.approvalAction.findFirst({
        where: { approvalInstanceId: current.approvalInstanceId!, action: 'REJECT', projectVariationDecisionOrder: { not: null } },
        orderBy: { projectVariationDecisionOrder: 'desc' },
        select: { actionByUserId: true, actionAt: true, comment: true },
      });
      if (!decision) throw new ConflictException({ code: 'PROJECT_VARIATION_DECISION_EVIDENCE_MISSING', detail: 'Serialized rejection evidence is missing.' });
      const updated = await tx.projectVariation.update({
        where: { id: variationId },
        data: {
          state: 'REJECTED', rejectedByUserId: decision.actionByUserId,
          rejectedAt: decision.actionAt, decidedAt: decision.actionAt,
          rejectionReason: decision.comment,
        },
      });
      await this.audit.record({
        ...context, entityType: 'PROJECT_VARIATION', entityId: variationId, action: 'REJECT',
        newValues: { comment: comment ?? null },
      }, tx);
        return updated;
      },
    );
    return this.get(context.auth, row.id);
  }

  private async serializedVariationWrite<T>(
    auth: AuthenticatedUserContext,
    variationId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    // Preflight authorization outside SERIALIZABLE so access checks do not
    // establish a stale transactional snapshot before the row lock.
    await this.visible(auth, variationId, this.prisma);

    const maxWriteAttempts = 5;
    for (let attempt = 1; attempt <= maxWriteAttempts; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            // The Project Variation row is the serialization boundary for all
            // mutable lifecycle actions. Lock first on a fresh snapshot, then
            // revalidate visibility/access before executing the action.
            await this.lock(auth.companyId, variationId, tx);
            await this.visible(auth, variationId, tx);
            return operation(tx);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt < maxWriteAttempts) continue;
          break;
        }
        throw error;
      }
    }

    throw new ConflictException({
      code: 'PROJECT_VARIATION_WRITE_CONCURRENCY_RETRY_EXHAUSTED',
      detail:
        'Project Variation action could not serialize after repeated concurrent attempts.',
    });
  }

  private async revalidate(tx: Prisma.TransactionClient, row: {
    id: string; companyId: string; projectId: string; valueDelta: Prisma.Decimal;
    currencyCode: string; reversesVariationId: string | null; reversalReason: string | null;
  }) {
    this.assertNonZero(row.valueDelta);
    if (row.reversesVariationId) {
      await this.assertHistoricalScope(tx, row.companyId, row.projectId);
      await this.assertReversal(tx, row);
    } else {
      await this.assertActiveScope(tx, row.companyId, row.projectId, row.currencyCode);
    }
  }

  private async assertActiveScope(db: CostDb, companyId: string, projectId: string, currency?: string) {
    const [company, project] = await Promise.all([
      db.company.findUnique({ where: { id: companyId }, select: { baseCurrencyCode: true } }),
      db.project.findFirst({ where: { id: projectId, companyId, isActive: true }, select: { id: true } }),
    ]);
    if (!company || !project) throw new UnprocessableEntityException({
      code: 'PROJECT_VARIATION_SCOPE_INVALID', detail: 'Project Variation requires an active Project in the authenticated Company.',
    });
    if (currency && currency !== company.baseCurrencyCode) throw new UnprocessableEntityException({
      code: 'PROJECT_VARIATION_CURRENCY_UNSUPPORTED',
      detail: 'Project Variation currency must equal the current Company base currency. V0.7 performs no FX conversion.',
    });
    return company.baseCurrencyCode;
  }

  private async assertHistoricalScope(db: CostDb, companyId: string, projectId: string) {
    if (!await db.project.findFirst({ where: { id: projectId, companyId }, select: { id: true } })) {
      throw new UnprocessableEntityException({
        code: 'PROJECT_VARIATION_REVERSAL_SCOPE_INVALID',
        detail: 'A compensating reversal must retain the original historical Company and Project identity.',
      });
    }
  }

  private async assertReversal(db: CostDb, row: {
    companyId: string; projectId: string; valueDelta: Prisma.Decimal; currencyCode: string;
    reversesVariationId: string | null; reversalReason: string | null;
  }) {
    if (!row.reversesVariationId) return;
    const source = await db.projectVariation.findFirst({
      where: {
        id: row.reversesVariationId, companyId: row.companyId, projectId: row.projectId,
        state: 'APPROVED', reversesVariationId: null,
      },
    });
    if (!source ||
        row.valueDelta.toFixed(2) !== source.valueDelta.negated().toFixed(2) ||
        row.currencyCode !== source.currencyCode || !row.reversalReason?.trim()) {
      throw new ConflictException({
        code: 'PROJECT_VARIATION_REVERSAL_INVALID',
        detail: 'A compensating reversal must exactly offset an approved original Project Variation and preserve its currency.',
      });
    }
  }

  private async visible(auth: AuthenticatedUserContext, id: string, db: CostDb) {
    const row = await db.projectVariation.findFirst({ where: { id, companyId: auth.companyId } });
    if (!row) throw this.notFound();
    await this.access.assertAccess(auth, row.projectId, db);
    return row;
  }

  private async hydrate(row: Awaited<ReturnType<ProjectVariationService['visible']>>, db: CostDb) {
    const actorIds = [row.createdByUserId, row.submittedByUserId, row.approvedByUserId, row.rejectedByUserId]
      .filter((value): value is string => Boolean(value));
    const [project, actors, approvalInstance] = await Promise.all([
      db.project.findFirst({
        where: { id: row.projectId, companyId: row.companyId },
        select: { id: true, projectCode: true, projectName: true, isActive: true },
      }),
      db.user.findMany({
        where: { id: { in: actorIds }, companyId: row.companyId },
        select: { id: true, displayName: true },
      }),
      row.approvalInstanceId ? db.approvalInstance.findUnique({
        where: { id: row.approvalInstanceId },
        include: {
          workflow: { select: { id: true, workflowCode: true, workflowName: true } },
          actions: {
            orderBy: [{ projectVariationDecisionOrder: 'asc' }, { actionAt: 'asc' }],
            select: {
              id: true, action: true, actionAt: true, comment: true,
              approvalStep: { select: { stepNo: true, stepName: true } },
              actionByUser: { select: { id: true, displayName: true } },
            },
          },
        },
      }) : Promise.resolve(null),
    ]);
    const byId = new Map(actors.map((actor) => [actor.id, actor]));
    return {
      ...row, project,
      createdBy: byId.get(row.createdByUserId) ?? null,
      submittedBy: row.submittedByUserId ? byId.get(row.submittedByUserId) ?? null : null,
      approvedBy: row.approvedByUserId ? byId.get(row.approvedByUserId) ?? null : null,
      rejectedBy: row.rejectedByUserId ? byId.get(row.rejectedByUserId) ?? null : null,
      approvalInstance,
    };
  }

  private async lock(companyId: string, id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "project_variations"
      WHERE "id" = ${id}::uuid AND "company_id" = ${companyId}::uuid
      FOR UPDATE
    `);
  }

  private async claimReplay(
    tx: Prisma.TransactionClient, auth: AuthenticatedUserContext,
    actionKey: string, actionType: string, entityId: string, payload: unknown[],
  ) {
    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const key = { companyId_userId_actionKey: { companyId: auth.companyId, userId: auth.userId, actionKey } } as const;
    const matches = (row: { actionType: string; entityType: string; entityId: string; payloadHash: string }) =>
      row.actionType === actionType && row.entityType === 'PROJECT_VARIATION' &&
      row.entityId === entityId && row.payloadHash === payloadHash;
    const existing = await tx.costActionReplay.findUnique({ where: key });
    if (existing) {
      if (!matches(existing)) this.replayConflict();
      return true;
    }
    const inserted = await tx.costActionReplay.createMany({
      data: [{ companyId: auth.companyId, userId: auth.userId, actionKey, actionType, entityType: 'PROJECT_VARIATION', entityId, payloadHash }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) return false;
    const raced = await tx.costActionReplay.findUnique({ where: key });
    if (!raced || !matches(raced)) this.replayConflict();
    return true;
  }

  private payloadHash(projectId: string, input: DraftInput) {
    return createHash('sha256').update(JSON.stringify({
      projectId, variationNumber: input.variationNumber, description: input.description,
      reason: input.reason ?? null, valueDelta: input.valueDelta.toFixed(2),
    })).digest('hex');
  }

  private assertNonZero(value: Prisma.Decimal) {
    if (value.isZero() || value.decimalPlaces() > 2) throw new UnprocessableEntityException({
      code: 'PROJECT_VARIATION_VALUE_INVALID',
      detail: 'Project Variation value delta must be non-zero with at most 2 decimal places.',
    });
  }
  private assertDraft(state: string) {
    if (state !== 'DRAFT') throw new ConflictException({
      code: 'PROJECT_VARIATION_NOT_DRAFT', detail: 'Only a Draft Project Variation can be edited or submitted.',
    });
  }
  private assertSubmitted(row: { state: string; approvalInstanceId: string | null }) {
    if (row.state !== 'SUBMITTED' || !row.approvalInstanceId) throw new ConflictException({
      code: 'PROJECT_VARIATION_NOT_SUBMITTED', detail: 'This Project Variation is not awaiting an approval action.',
    });
  }
  private assertSourcePermission(auth: AuthenticatedUserContext) {
    if (!auth.permissions.some((permission) => permission.startsWith('cost.variation.'))) {
      throw new ForbiddenException({
        code: 'PROJECT_VARIATION_SOURCE_FORBIDDEN',
        detail: 'Project Variation source records require an explicit cost.variation.* permission.',
      });
    }
  }
  private replayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail: 'This action key is already paired with a different Cost Control action, record, or payload.',
    });
  }
  private notFound() {
    return new NotFoundException({ code: 'PROJECT_VARIATION_NOT_FOUND', detail: 'Project Variation not found.' });
  }
}
