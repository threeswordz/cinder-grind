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

export type CostForecastLineInput = {
  wbsId: string | null;
  costCodeId: string | null;
  uncommittedEtcAmount: Prisma.Decimal;
  remarks: string | null;
  inputOrder: number;
};

export type CostForecastDraftInput = {
  forecastDate: Date;
  description: string | null;
  lines: CostForecastLineInput[];
  createKey: string;
};

export type CostForecastDraftUpdate = {
  forecastDate?: Date;
  description?: string | null;
  lines?: CostForecastLineInput[];
};

@Injectable()
export class ForecastService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly approvals: ApprovalService,
    private readonly audit: AuditService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    this.assertPermission(auth, 'cost.forecast.manage');
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'COST_FORECAST',
        isActive: true,
        steps: { some: {} },
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: [{ workflowName: 'asc' }, { workflowCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    this.assertPermission(auth, 'cost.forecast.view');
    await this.access.assertAccess(auth, projectId);
    const [company, project, wbs, costCodes] = await Promise.all([
      this.prisma.company.findUniqueOrThrow({
        where: { id: auth.companyId },
        select: { baseCurrencyCode: true },
      }),
      this.prisma.project.findFirst({
        where: { id: projectId, companyId: auth.companyId },
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
    this.assertPermission(auth, 'cost.forecast.view');
    await this.access.assertAccess(auth, projectId);
    return this.prisma.costForecast.findMany({
      where: { companyId: auth.companyId, projectId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
      orderBy: [{ versionNo: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async get(auth: AuthenticatedUserContext, forecastId: string) {
    this.assertPermission(auth, 'cost.forecast.view');
    const forecast = await this.visibleForecast(auth, forecastId, this.prisma);
    return this.hydrate(forecast, this.prisma);
  }

  async create(
    context: AuditContext,
    projectId: string,
    input: CostForecastDraftInput,
  ) {
    this.assertPermission(context.auth, 'cost.forecast.manage');
    await this.access.assertAccess(context.auth, projectId);
    this.assertLineAmounts(input.lines);
    const payloadHash = this.createPayloadHash(projectId, input);

    const existing = await this.prisma.costForecast.findFirst({
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

    try {
      const created = await this.prisma.$transaction(
        async (tx) => {
          await this.access.assertAccess(context.auth, projectId, tx);
          await this.lockProject(context.auth.companyId, projectId, tx);
          const raced = await tx.costForecast.findFirst({
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

          const currencyCode = await this.assertDimensions(
            tx,
            context.auth.companyId,
            projectId,
            input.lines,
          );
          const row = await tx.costForecast.create({
            data: {
              companyId: context.auth.companyId,
              projectId,
              forecastDate: input.forecastDate,
              versionNo: 0,
              description: input.description,
              currencyCode,
              createKey: input.createKey,
              createPayloadHash: payloadHash,
              createdByUserId: context.auth.userId,
              lines: {
                create: input.lines.map((line, index) => ({
                  companyId: context.auth.companyId,
                  projectId,
                  lineNo: index + 1,
                  wbsId: line.wbsId,
                  costCodeId: line.costCodeId,
                  uncommittedEtcAmount: line.uncommittedEtcAmount,
                  remarks: line.remarks,
                })),
              },
            },
          });
          await this.audit.record(
            {
              ...context,
              entityType: 'COST_FORECAST',
              entityId: row.id,
              action: 'CREATE_DRAFT',
              newValues: {
                projectId,
                forecastDate: row.forecastDate,
                versionNo: row.versionNo,
                currencyCode,
                lineCount: input.lines.length,
                uncommittedEtc: this.sumLines(input.lines).toFixed(2),
              },
            },
            tx,
          );
          return row;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return this.get(context.auth, created.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.costForecast.findFirst({
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
    forecastId: string,
    input: CostForecastDraftUpdate,
  ) {
    this.assertPermission(context.auth, 'cost.forecast.manage');
    if (input.lines) this.assertLineAmounts(input.lines);
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visibleForecast(context.auth, forecastId, tx);
        await this.lockForecast(context.auth.companyId, forecastId, tx);
        const current = await tx.costForecast.findUniqueOrThrow({
          where: { id: forecastId },
        });
        this.assertDraft(current.state);
        if (current.createdByUserId !== context.auth.userId) {
          throw new ForbiddenException({
            code: 'COST_FORECAST_MAKER_EDIT_REQUIRED',
            detail: 'Only the Forecast maker may edit its draft.',
          });
        }

        const lines = input.lines;
        if (lines) {
          await this.assertDimensions(
            tx,
            context.auth.companyId,
            current.projectId,
            lines,
            current.currencyCode,
          );
          await tx.costForecastLine.deleteMany({
            where: { forecastId },
          });
          if (lines.length) {
            await tx.costForecastLine.createMany({
              data: lines.map((line, index) => ({
                companyId: current.companyId,
                projectId: current.projectId,
                forecastId,
                lineNo: index + 1,
                wbsId: line.wbsId,
                costCodeId: line.costCodeId,
                uncommittedEtcAmount: line.uncommittedEtcAmount,
                remarks: line.remarks,
              })),
            });
          }
        }

        const row = await tx.costForecast.update({
          where: { id: forecastId },
          data: {
            ...(input.forecastDate !== undefined
              ? { forecastDate: input.forecastDate }
              : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'COST_FORECAST',
            entityId: forecastId,
            action: 'UPDATE_DRAFT',
            newValues: {
              forecastDate: row.forecastDate,
              description: row.description,
              ...(lines
                ? {
                    lineCount: lines.length,
                    uncommittedEtc: this.sumLines(lines).toFixed(2),
                  }
                : {}),
            },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(context.auth, result.id);
  }

  async submit(
    context: AuditContext,
    forecastId: string,
    workflowCode: string,
    actionKey: string,
  ) {
    this.assertPermission(context.auth, 'cost.forecast.manage');
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visibleForecast(context.auth, forecastId, tx);
        await this.lockForecast(context.auth.companyId, forecastId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'COST_FORECAST_SUBMIT',
            forecastId,
            [workflowCode],
          )
        ) {
          return tx.costForecast.findUniqueOrThrow({ where: { id: forecastId } });
        }
        const current = await tx.costForecast.findUniqueOrThrow({
          where: { id: forecastId },
          include: { lines: true },
        });
        this.assertDraft(current.state);
        await this.assertDimensions(
          tx,
          context.auth.companyId,
          current.projectId,
          current.lines.map((line) => ({
            wbsId: line.wbsId,
            costCodeId: line.costCodeId,
            uncommittedEtcAmount: line.uncommittedEtcAmount,
            remarks: line.remarks,
            inputOrder: line.lineNo,
          })),
          current.currencyCode,
        );
        const instance = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'COST_FORECAST',
            entityId: forecastId,
          },
          tx,
        );
        const submittedAt = new Date();
        const row = await tx.costForecast.update({
          where: { id: forecastId },
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
            entityType: 'COST_FORECAST',
            entityId: forecastId,
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
    forecastId: string,
    actionKey: string,
    comment?: string,
  ) {
    this.assertPermission(context.auth, 'cost.forecast.approve');
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visibleForecast(context.auth, forecastId, tx);
        await this.lockForecast(context.auth.companyId, forecastId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'COST_FORECAST_APPROVE',
            forecastId,
            [comment ?? ''],
          )
        ) {
          return tx.costForecast.findUniqueOrThrow({ where: { id: forecastId } });
        }
        const current = await tx.costForecast.findUniqueOrThrow({
          where: { id: forecastId },
          include: { lines: true },
        });
        this.assertSubmitted(current.state, current.approvalInstanceId);
        await this.assertDimensions(
          tx,
          context.auth.companyId,
          current.projectId,
          current.lines.map((line) => ({
            wbsId: line.wbsId,
            costCodeId: line.costCodeId,
            uncommittedEtcAmount: line.uncommittedEtcAmount,
            remarks: line.remarks,
            inputOrder: line.lineNo,
          })),
          current.currencyCode,
        );
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
                forecastDecisionOrder: { not: null },
              },
              orderBy: { forecastDecisionOrder: 'desc' },
              select: { actionByUserId: true, actionAt: true },
            });
            if (!decision) this.throwDecisionEvidenceMissing();
            await approvalTx.costForecast.update({
              where: { id: forecastId },
              data: {
                state: 'APPROVED',
                approvedByUserId: decision!.actionByUserId,
                approvedAt: decision!.actionAt,
                decidedAt: decision!.actionAt,
              },
            });
          },
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'COST_FORECAST',
            entityId: forecastId,
            action: 'APPROVE',
            newValues: { comment: comment ?? null },
          },
          tx,
        );
        return tx.costForecast.findUniqueOrThrow({ where: { id: forecastId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.get(context.auth, result.id);
  }

  async reject(
    context: AuditContext,
    forecastId: string,
    actionKey: string,
    comment?: string,
  ) {
    this.assertPermission(context.auth, 'cost.forecast.approve');
    const result = await this.prisma.$transaction(
      async (tx) => {
        await this.visibleForecast(context.auth, forecastId, tx);
        await this.lockForecast(context.auth.companyId, forecastId, tx);
        if (
          await this.claimReplay(
            tx,
            context.auth,
            actionKey,
            'COST_FORECAST_REJECT',
            forecastId,
            [comment ?? ''],
          )
        ) {
          return tx.costForecast.findUniqueOrThrow({ where: { id: forecastId } });
        }
        const current = await tx.costForecast.findUniqueOrThrow({
          where: { id: forecastId },
        });
        this.assertSubmitted(current.state, current.approvalInstanceId);
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
            forecastDecisionOrder: { not: null },
          },
          orderBy: { forecastDecisionOrder: 'desc' },
          select: { actionByUserId: true, actionAt: true, comment: true },
        });
        if (!decision) this.throwDecisionEvidenceMissing();
        const row = await tx.costForecast.update({
          where: { id: forecastId },
          data: {
            state: 'REJECTED',
            rejectedByUserId: decision!.actionByUserId,
            rejectedAt: decision!.actionAt,
            decidedAt: decision!.actionAt,
            rejectionReason: decision!.comment,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'COST_FORECAST',
            entityId: forecastId,
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

  private async visibleForecast(
    auth: AuthenticatedUserContext,
    forecastId: string,
    db: CostDb,
  ) {
    const forecast = await db.costForecast.findFirst({
      where: { id: forecastId, companyId: auth.companyId },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    });
    if (!forecast) throw this.notFound();
    await this.access.assertAccess(auth, forecast.projectId, db);
    return forecast;
  }

  private async hydrate(
    forecast: Awaited<ReturnType<ForecastService['visibleForecast']>>,
    db: CostDb,
  ) {
    const actorIds = [
      forecast.createdByUserId,
      forecast.submittedByUserId,
      forecast.approvedByUserId,
      forecast.rejectedByUserId,
    ].filter((value): value is string => Boolean(value));
    const wbsIds = forecast.lines
      .map((line) => line.wbsId)
      .filter((value): value is string => Boolean(value));
    const costCodeIds = forecast.lines
      .map((line) => line.costCodeId)
      .filter((value): value is string => Boolean(value));

    const [project, actors, wbs, costCodes, approvalInstance] =
      await Promise.all([
        db.project.findFirst({
          where: { id: forecast.projectId, companyId: forecast.companyId },
          select: {
            id: true,
            projectCode: true,
            projectName: true,
            isActive: true,
          },
        }),
        db.user.findMany({
          where: { id: { in: actorIds }, companyId: forecast.companyId },
          select: { id: true, displayName: true },
        }),
        db.wbsElement.findMany({
          where: { id: { in: wbsIds }, projectId: forecast.projectId },
          select: { id: true, wbsCode: true, wbsName: true },
        }),
        db.costCode.findMany({
          where: { id: { in: costCodeIds }, companyId: forecast.companyId },
          select: { id: true, costCode: true, costName: true },
        }),
        forecast.approvalInstanceId
          ? db.approvalInstance.findUnique({
              where: { id: forecast.approvalInstanceId },
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
                  select: {
                    id: true,
                    action: true,
                    actionAt: true,
                    comment: true,
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
    const wbsById = new Map(wbs.map((row) => [row.id, row]));
    const costCodeById = new Map(costCodes.map((row) => [row.id, row]));
    return {
      ...forecast,
      project,
      totalUncommittedEtc: this.sumLines(
        forecast.lines.map((line) => ({
          wbsId: line.wbsId,
          costCodeId: line.costCodeId,
          uncommittedEtcAmount: line.uncommittedEtcAmount,
          remarks: line.remarks,
          inputOrder: line.lineNo,
        })),
      ),
      lines: forecast.lines.map((line) => ({
        ...line,
        wbs: line.wbsId ? wbsById.get(line.wbsId) ?? null : null,
        costCode: line.costCodeId
          ? costCodeById.get(line.costCodeId) ?? null
          : null,
        allocationState:
          line.wbsId && line.costCodeId
            ? 'FULLY_ALLOCATED'
            : line.wbsId || line.costCodeId
              ? 'PARTIALLY_ALLOCATED'
              : 'UNALLOCATED',
      })),
      createdBy: actorById.get(forecast.createdByUserId) ?? null,
      submittedBy: forecast.submittedByUserId
        ? actorById.get(forecast.submittedByUserId) ?? null
        : null,
      approvedBy: forecast.approvedByUserId
        ? actorById.get(forecast.approvedByUserId) ?? null
        : null,
      rejectedBy: forecast.rejectedByUserId
        ? actorById.get(forecast.rejectedByUserId) ?? null
        : null,
      approvalInstance,
    };
  }

  private async assertDimensions(
    db: CostDb,
    companyId: string,
    projectId: string,
    lines: CostForecastLineInput[],
    expectedCurrency?: string,
  ): Promise<string> {
    const [company, project, wbs, costCodes] = await Promise.all([
      db.company.findUnique({
        where: { id: companyId },
        select: { baseCurrencyCode: true },
      }),
      db.project.findFirst({
        where: { id: projectId, companyId, isActive: true },
        select: { id: true },
      }),
      db.wbsElement.findMany({
        where: {
          projectId,
          id: {
            in: lines
              .map((line) => line.wbsId)
              .filter((value): value is string => Boolean(value)),
          },
          isActive: true,
        },
        select: { id: true },
      }),
      db.costCode.findMany({
        where: {
          companyId,
          id: {
            in: lines
              .map((line) => line.costCodeId)
              .filter((value): value is string => Boolean(value)),
          },
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!company || !project) {
      throw new UnprocessableEntityException({
        code: 'COST_FORECAST_SCOPE_INVALID',
        detail: 'Forecast Project must be active and belong to the authenticated Company.',
      });
    }
    if (
      expectedCurrency !== undefined &&
      expectedCurrency !== company.baseCurrencyCode
    ) {
      throw new UnprocessableEntityException({
        code: 'COST_FORECAST_BASE_CURRENCY_INVALID',
        detail: 'Forecast retained currency must equal the Company base currency.',
      });
    }

    const validWbs = new Set(wbs.map((row) => row.id));
    const validCostCodes = new Set(costCodes.map((row) => row.id));
    for (const line of lines) {
      if (line.wbsId && !validWbs.has(line.wbsId)) {
        throw new UnprocessableEntityException({
          code: 'COST_FORECAST_WBS_INVALID',
          detail: 'Forecast WBS must be active and belong to the Forecast Project.',
        });
      }
      if (line.costCodeId && !validCostCodes.has(line.costCodeId)) {
        throw new UnprocessableEntityException({
          code: 'COST_FORECAST_COST_CODE_INVALID',
          detail: 'Forecast Cost Code must be active and belong to the authenticated Company.',
        });
      }
    }
    return company.baseCurrencyCode;
  }

  private async lockProject(
    companyId: string,
    projectId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "projects"
      WHERE "id" = ${projectId}::uuid
        AND "company_id" = ${companyId}::uuid
      FOR UPDATE
    `);
  }

  private async lockForecast(
    companyId: string,
    forecastId: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "cost_forecasts"
      WHERE "id" = ${forecastId}::uuid
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
      row.entityType === 'COST_FORECAST' &&
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
          entityType: 'COST_FORECAST',
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

  private createPayloadHash(projectId: string, input: CostForecastDraftInput) {
    return createHash('sha256')
      .update(
        JSON.stringify({
          projectId,
          forecastDate: this.dateKey(input.forecastDate),
          description: input.description,
          lines: input.lines.map((line) => ({
            wbsId: line.wbsId,
            costCodeId: line.costCodeId,
            uncommittedEtcAmount: line.uncommittedEtcAmount.toFixed(2),
            remarks: line.remarks,
          })),
        }),
      )
      .digest('hex');
  }

  private sumLines(lines: CostForecastLineInput[]): Prisma.Decimal {
    return lines.reduce(
      (sum, line) => sum.plus(line.uncommittedEtcAmount),
      new Prisma.Decimal(0),
    );
  }

  private assertLineAmounts(lines: CostForecastLineInput[]) {
    for (const line of lines) {
      if (line.uncommittedEtcAmount.isNegative()) {
        throw new UnprocessableEntityException({
          code: 'COST_FORECAST_ETC_NEGATIVE',
          detail: 'Uncommitted ETC cannot be negative.',
        });
      }
    }
  }

  private assertPermission(auth: AuthenticatedUserContext, permission: string) {
    if (!auth.permissions.includes(permission)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        detail: 'Permission ' + permission + ' is required.',
      });
    }
  }

  private assertDraft(state: string) {
    if (state !== 'DRAFT') {
      throw new ConflictException({
        code: 'COST_FORECAST_STATE_INVALID',
        detail: 'Forecast must be in DRAFT state.',
      });
    }
  }

  private assertSubmitted(state: string, approvalInstanceId: string | null) {
    if (state !== 'SUBMITTED' || !approvalInstanceId) {
      throw new ConflictException({
        code: 'COST_FORECAST_STATE_INVALID',
        detail: 'Forecast must be awaiting approval.',
      });
    }
  }

  private throwDecisionEvidenceMissing(): never {
    throw new ConflictException({
      code: 'COST_FORECAST_DECISION_EVIDENCE_MISSING',
      detail: 'Serialized Forecast approval evidence is missing.',
    });
  }

  private throwReplayConflict(): never {
    throw new ConflictException({
      code: 'IDEMPOTENCY_KEY_REUSED',
      detail: 'The idempotency key was already used with different Forecast input.',
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'COST_FORECAST_NOT_FOUND',
      detail: 'Cost Forecast not found.',
    });
  }

  private dateKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }
}
