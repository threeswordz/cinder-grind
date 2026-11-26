import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { GoodsReceiptService } from './goods-receipt.service';
import { MaterialIssueService } from './material-issue.service';
import { MaterialReturnService } from './material-return.service';
import { StockTransferService } from './stock-transfer.service';
import { correctionAuthority, type CorrectionAction, type MovementKind } from './movement-correction-authority';

const entityType = 'MOVEMENT_CORRECTION';
const workflowCode = 'SS16_MOVEMENT_CORRECTION';
const kinds = new Set<string>(['GOODS_RECEIPT','MATERIAL_ISSUE','MATERIAL_RETURN','STOCK_TRANSFER']);
type Tx = Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type Source = { companyId: string; kind: MovementKind; projectIds: string[]; postedAt: Date | null; reversedAt: Date | null; reversalKey: string | null };
const conflict = (code: string): never => { throw new ConflictException({ code }); };
const deny = (): never => { throw new ForbiddenException({ code: 'SS16_CORRECTION_AUTHORITY_DENIED' }); };
const invalid = (): never => { throw new UnprocessableEntityException({ code: 'SS16_CORRECTION_INPUT_INVALID' }); };
const uuid = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);

// Posted-source transaction core; HTTP access must go through the scoped maker/checker methods.
// Retained workflow grants, submitted-but-unposted cancellation and UI remain separate exits.
@Injectable()
export class MovementCorrectionService {
  constructor(private readonly prisma: PrismaService, private readonly approval: ApprovalService,
    private readonly audit: AuditService, private readonly receipts: GoodsReceiptService,
    private readonly issues: MaterialIssueService, private readonly returns: MaterialReturnService,
    private readonly transfers: StockTransferService) {}

  private async source(auth: AuthenticatedUserContext, kind: MovementKind, id: string, tx: Tx): Promise<Source> {
    if (kind === 'STOCK_TRANSFER') {
      const row = await this.transfers.get(auth, id, tx);
      return { companyId: row.companyId, kind, projectIds: [...new Set(row.items.flatMap(i => [i.sourceProjectId, i.destinationProjectId]))],
        postedAt: row.postedAt, reversedAt: row.reversedAt, reversalKey: row.reversalKey };
    }
    const row = kind === 'GOODS_RECEIPT' ? await this.receipts.get(auth, id, tx)
      : kind === 'MATERIAL_ISSUE' ? await this.issues.get(auth, id, tx)
      : await this.returns.get(auth, id, tx);
    return { companyId: row.companyId, kind, projectIds: [row.projectId], postedAt: row.postedAt, reversedAt: row.reversedAt, reversalKey: row.reversalKey };
  }

  private async authorize(auth: AuthenticatedUserContext, source: Source, action: CorrectionAction, tx: Tx, requesterUserId?: string) {
    const session = await tx.userSession.findFirst({
      where: { id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
        user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } },
      select: { user: { select: { employee: { select: { id: true, companyId: true, isActive: true } },
        userRoles: { select: { companyId: true, role: { select: { id: true, companyId: true, isActive: true, roleCode: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } } } } },
    });
    const employee = session?.user.employee;
    if (!session || !employee) return deny();
    const projects = await tx.project.findMany({ where: { companyId: auth.companyId, isActive: true, id: { in: source.projectIds },
      members: { some: { employeeId: employee.id, isActive: true } } }, select: { id: true } });
    const live = { assignments: session.user.userRoles, employeeCompanyId: employee.companyId,
      employeeActive: employee.isActive, assignedProjectIds: projects.map(p => p.id) };
    if (correctionAuthority({ auth, source, live, action, ...(requesterUserId ? { requesterUserId } : {}) }) !== 'ALLOW') return deny();
    return session.user.userRoles;
  }

  private async configured(companyId: string, tx: Tx) {
    const workflow = await tx.approvalWorkflow.findUnique({
      where: { companyId_workflowCode: { companyId, workflowCode } },
      include: { steps: { include: { stepRoles: { include: { role: true } } } } },
    });
    const step = workflow?.steps[0];
    if (!workflow?.isActive || workflow.entityType !== entityType || workflow.steps.length !== 1 ||
        !step || step.requiredApprovals !== 1 || step.stepRoles.length !== 1 ||
        !step.stepRoles[0]?.role.isActive || step.stepRoles[0].role.companyId !== companyId ||
        step.stepRoles[0].role.roleCode !== 'PROJECT_MANAGER') return conflict('SS16_CONFIGURED_PM_STEP_REQUIRED');
    return { workflow, roleId: step.stepRoles[0].role.id };
  }

  private async lock(tx: Tx, companyId: string, kind: MovementKind, id: string) {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'ss16:' + companyId + ':' + kind + ':' + id);
  }

  // Source-scoped read projection: Store sees only own requests; a live PM
  // with source-specific checker grants can see all requests for that source.
  // No read action confers a right to decide or bypass maker/checker separation.
  async listForSource(context: Context, kind: MovementKind, id: string) {
    if (!kinds.has(kind) || !uuid(id)) return invalid();
    return this.prisma.$transaction(async tx => {
      const source = await this.source(context.auth, kind, id, tx);
      let reviewer = false;
      try {
        await this.authorize(context.auth, source, 'READ_REVIEW', tx);
        reviewer = true;
      } catch (error) {
        if (!(error instanceof ForbiddenException)) throw error;
        await this.authorize(context.auth, source, 'READ_OWN', tx);
      }
      return tx.movementCorrectionRequest.findMany({
        where: { companyId: context.auth.companyId, sourceKind: kind, sourceId: id,
          ...(reviewer ? {} : { requestedByUserId: context.auth.userId }) },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        take: 100,
        select: { id: true, sourceKind: true, sourceId: true, reason: true,
          requestedByUserId: true, requestedAt: true,
          approvalInstance: { select: { approvalState: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async request(context: Context, kind: MovementKind, id: string, key: string, reason: string) {
    if (!kinds.has(kind) || !uuid(id) || typeof key !== 'string' || !key.trim() || key.length > 120 ||
        typeof reason !== 'string' || !reason.trim() || reason.length > 1000) return invalid();
    return this.prisma.$transaction(async tx => {
      await this.lock(tx, context.auth.companyId, kind, id);
      const source = await this.source(context.auth, kind, id, tx);
      await this.authorize(context.auth, source, 'REQUEST', tx);
      const existing = await tx.movementCorrectionRequest.findUnique({
        where: { companyId_sourceKind_sourceId_requestKey: { companyId: context.auth.companyId, sourceKind: kind, sourceId: id, requestKey: key } },
        include: { approvalInstance: true },
      });
      if (existing) {
        if (existing.requestedByUserId !== context.auth.userId || existing.reason !== reason) return conflict('SS16_REQUEST_REPLAY_CONFLICT');
        return existing;
      }
      if (!source.postedAt || source.reversedAt) return conflict('SS16_POSTED_SOURCE_REQUIRED');
      await this.configured(context.auth.companyId, tx);
      const pending = await tx.movementCorrectionRequest.findFirst({ where: {
        companyId: context.auth.companyId, sourceKind: kind, sourceId: id,
        approvalInstance: { approvalState: 'SUBMITTED' } }, select: { id: true } });
      if (pending) return conflict('SS16_CORRECTION_ALREADY_PENDING');
      const requestId = randomUUID();
      const approval = await this.approval.start({ companyId: context.auth.companyId, workflowCode, entityType, entityId: requestId }, tx);
      const row = await tx.movementCorrectionRequest.create({ data: {
        id: requestId, companyId: context.auth.companyId, sourceKind: kind, sourceId: id, sourcePostedAt: source.postedAt,
        requestKey: key, reason, requestedByUserId: context.auth.userId, approvalInstanceId: approval.id },
        include: { approvalInstance: true } });
      await this.audit.record({ ...context, entityType, entityId: requestId, action: 'REQUEST',
        newValues: { sourceKind: kind, sourceId: id, reason, approvalInstanceId: approval.id } }, tx);
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async decide(context: Context, requestId: string, decision: 'APPROVE'|'REJECT', comment: string) {
    if (!uuid(requestId) || !['APPROVE','REJECT'].includes(decision) || typeof comment !== 'string' ||
        !comment.trim() || comment.length > 1000) return invalid();
    return this.prisma.$transaction(async tx => {
      const row = await tx.movementCorrectionRequest.findFirst({ where: { id: requestId, companyId: context.auth.companyId },
        include: { approvalInstance: true } });
      if (!row || !kinds.has(row.sourceKind)) throw new NotFoundException({ code: 'SS16_REQUEST_NOT_FOUND' });
      const kind = row.sourceKind as MovementKind;
      await this.lock(tx, row.companyId, kind, row.sourceId);
      const source = await this.source(context.auth, kind, row.sourceId, tx);
      const assignments = await this.authorize(context.auth, source, decision, tx, row.requestedByUserId);
      const config = await this.configured(row.companyId, tx);
      if (row.approvalInstance.companyId !== row.companyId || row.approvalInstance.entityId !== row.id ||
          row.approvalInstance.entityType !== entityType || row.approvalInstance.approvalWorkflowId !== config.workflow.id ||
          !assignments.some(a => a.companyId === row.companyId && a.role.id === config.roleId)) return deny();
      if (row.approvalInstance.approvalState !== 'SUBMITTED') return conflict('SS16_DECISION_ALREADY_RECORDED');
      if (decision === 'APPROVE') {
        if (!source.postedAt || source.postedAt.getTime() !== row.sourcePostedAt.getTime() || source.reversedAt)
          return conflict('SS16_SOURCE_CHANGED');
        await this.approval.approve(row.approvalInstanceId, context.auth, row.requestedByUserId, comment, async finalTx => {
          // Stable key derived from persisted request, never caller controlled.
          const key = 'ss16:' + row.id;
          if (kind === 'GOODS_RECEIPT') await this.receipts.reverse(context, row.sourceId, key, row.reason, finalTx);
          else if (kind === 'MATERIAL_ISSUE') await this.issues.reverse(context, row.sourceId, key, row.reason, finalTx);
          else if (kind === 'MATERIAL_RETURN') await this.returns.reverse(context, row.sourceId, key, row.reason, finalTx);
          else await this.transfers.reverse(context, row.sourceId, key, row.reason, finalTx);
        }, tx);
      } else await this.approval.reject(row.approvalInstanceId, context.auth, row.requestedByUserId, comment, tx);
      await this.audit.record({ ...context, entityType, entityId: row.id, action: decision,
        newValues: { sourceKind: kind, sourceId: row.sourceId, comment } }, tx);
      return tx.movementCorrectionRequest.findUniqueOrThrow({ where: { id: row.id }, include: { approvalInstance: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
