import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { PurchaseOrderService } from './purchase-order.service';
import {
  Pur10PolicyError, planPur10Decision, assertPur10ReadyToCancel, type Pur10Action, type Pur10Actor,
  type Pur10Case, type Pur10Order, type Pur10Status,
} from './purchase-order-cancellation-contract';

type Tx = Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
const ENTITY = 'PURCHASE_ORDER_CANCELLATION';
const SETTING = 'PUR10_NAMED_ACTORS_V1';
const ACTIONS: readonly Pur10Action[] = [
  'PROPOSE', 'PM_FORWARD', 'PM_RETURN', 'BEN_APPROVE', 'BEN_REJECT',
];
const uuid = (s: unknown): s is string =>
  typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const fail = (code: string): never => { throw new ConflictException({ code }); };
const denied = (code: string): never => { throw new ForbiddenException({ code }); };
type ActorMapping = { jai: string; khaimook: string; ben: string };
type Event = {
  id: string; action: string; actorUserId: string; newValues: Prisma.JsonValue | null;
};
type Latest = { state: Pur10Case; eventId: string };

/**
 * PUR10 staging: audit-backed, nonposting Jai → Khaimook → Ben decisions.
 * NO PO cancellation happens in this class. Existing direct cancel API remains
 * an explicit release blocker until transaction-safe integration replaces it.
 */
@Injectable()
export class PurchaseOrderCancellationCaseService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService, private readonly orders: PurchaseOrderService) {}

  private async liveActor(auth: AuthenticatedUserContext, db: Tx | PrismaService) {
    const session = await db.userSession.findFirst({
      where: {
        id: auth.sessionId, userId: auth.userId, revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { companyId: auth.companyId, isActive: true, company: { isActive: true } },
      },
      select: { user: { select: {
        employee: { select: { companyId: true, isActive: true } },
        userRoles: { select: { role: { select: {
          companyId: true, isActive: true, roleCode: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
        } } } },
      } } },
    });
    const employee = session?.user.employee;
    const roles = session?.user.userRoles
      .map(row => row.role)
      .filter(role => role.isActive && role.companyId === auth.companyId) ?? [];
    const allPermissions = new Set(roles.flatMap(role =>
      role.rolePermissions.map(p => p.permission.permissionCode)));
    if (!session || !employee?.isActive || employee.companyId !== auth.companyId) {
      return denied('PUR10_LIVE_SESSION_AND_EMPLOYEE_REQUIRED');
    }
    const result: Pur10Actor = {
      userId: auth.userId, companyId: auth.companyId,
      roleCodes: roles.map(role => role.roleCode),
      permissions: auth.permissions.filter(p => allPermissions.has(p)),
      sessionActive: true, employeeActive: true,
    };
    return result;
  }

  private async mappedActors(companyId: string, db: Tx | PrismaService): Promise<ActorMapping> {
    const setting = await db.systemSetting.findUnique({
      where: { companyId_settingKey: { companyId, settingKey: SETTING } },
      select: { settingValue: true },
    });
    const raw = setting?.settingValue;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return fail('PUR10_NAMED_ACTORS_NOT_CONFIGURED');
    }
    const config = raw as Record<string, unknown>;
    const ids = [config.jai, config.khaimook, config.ben];
    if (!ids.every(uuid) || new Set(ids).size !== 3) {
      return fail('PUR10_NAMED_ACTORS_CONFIGURATION_INVALID');
    }
    const [jai, khaimook, ben] = ids as [string, string, string];
    const users = await db.user.findMany({
      where: { companyId, id: { in: [jai, khaimook, ben] }, isActive: true },
      select: {
        id: true, employee: { select: { companyId: true, isActive: true } },
        userRoles: { select: { role: { select: {
          companyId: true, isActive: true, roleCode: true,
        } } } },
      },
    });
    const expected: readonly [string, string][] = [
      [jai, 'PROCUREMENT_OFFICER'], [khaimook, 'PROJECT_MANAGER'], [ben, 'MANAGEMENT'],
    ];
    if (users.length !== 3 || expected.some(([id, requiredRole]) => {
      const user = users.find(u => u.id === id);
      return !user?.employee?.isActive || user.employee.companyId !== companyId ||
        !user.userRoles.some(ur => ur.role.isActive &&
          ur.role.companyId === companyId && ur.role.roleCode === requiredRole);
    })) return fail('PUR10_NAMED_ACTORS_NOT_CURRENT');
    return { jai, khaimook, ben };
  }

  private async source(auth: AuthenticatedUserContext, id: string, db: Tx | PrismaService, allowFinalized = false) {
    const row = await db.purchaseOrder.findFirst({
      where: { id, companyId: auth.companyId },
      select: {
        id: true, companyId: true, projectId: true, poNumber: true,
        revisionNo: true, updatedAt: true, cancelledAt: true,
        nextRevision: { select: { id: true } },
        approvalInstance: { select: { approvalState: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'PUR10_PO_NOT_FOUND' });
    await this.access.assertAccess(auth, row.projectId, db);
    // Only an actually approved, most recent PO revision can enter this
    // cancellation review. Draft/rejected/newer-revision cases fail closed.
    if (row.approvalInstance?.approvalState !== 'APPROVED' ||
        row.nextRevision || (!allowFinalized && row.cancelledAt)) return fail('PUR10_APPROVED_LATEST_PO_REQUIRED');
    return row;
  }

  private async history(companyId: string, id: string, db: Tx | PrismaService): Promise<Latest | null> {
    const rows = await db.auditLog.findMany({
      where: { companyId, entityType: ENTITY, entityId: id },
      select: { id: true, action: true, actorUserId: true, newValues: true },
      take: 101,
    });
    if (rows.length > 100) return fail('PUR10_HISTORY_LIMIT_EXCEEDED');
    if (!rows.length) return null;
    const seen = new Set<string>();
    let prior: string | null = null;
    let state: Pur10Case | null = null;
    // Chain by explicit previous event, NEVER by timestamp/UUID sort order.
    for (let expected = 1; expected <= rows.length; expected += 1) {
      const candidates = rows.filter(row => {
        const v = row.newValues;
        return v !== null && typeof v === 'object' && !Array.isArray(v) &&
          (v as Record<string, Prisma.JsonValue>).previousEventId === prior;
      });
      if (candidates.length !== 1) return fail('PUR10_HISTORY_FORK_OR_MISSING_LINK');
      const row = candidates[0];
      if (!row) return fail('PUR10_HISTORY_FORK_OR_MISSING_LINK');
      if (seen.has(row.id)) return fail('PUR10_HISTORY_REPLAY_DETECTED');
      seen.add(row.id);
      const v = row.newValues as Record<string, Prisma.JsonValue>;
      if (!uuid(v.caseId) || typeof v.orderUpdatedAt !== 'string' ||
          v.version !== expected || (v.effect !== 'NO_PO_CHANGE' && v.effect !== 'PO_CANCELLED') ||
          typeof v.orderId !== 'string' || v.orderId !== id ||
          typeof v.companyId !== 'string' || v.companyId !== companyId ||
          typeof v.projectId !== 'string' || typeof v.poNumber !== 'string' ||
          typeof v.revisionNo !== 'number' || typeof v.makerUserId !== 'string' ||
          (v.pmUserId !== null && typeof v.pmUserId !== 'string') ||
          (v.benUserId !== null && typeof v.benUserId !== 'string') ||
          !['PM_PENDING','BEN_PENDING','RETURNED','REJECTED','BEN_APPROVED','FINALIZED'].includes(String(v.status)) ||
          !(ACTIONS.includes(row.action as Pur10Action) || row.action === 'FINALIZE') ||
          ((row.action === 'FINALIZE') !== (v.effect === 'PO_CANCELLED'))) return fail('PUR10_HISTORY_INVALID');
      if (state && (state.caseId !== v.caseId || state.makerUserId !== v.makerUserId ||
          state.orderUpdatedAt !== v.orderUpdatedAt || state.projectId !== v.projectId ||
          state.poNumber !== v.poNumber || state.revisionNo !== v.revisionNo))
        return fail('PUR10_HISTORY_SOURCE_MUTATED');
      const before = state?.status ?? null;
      const target = v.status as Pur10Status;
      if (!(
        (before === null && row.action === 'PROPOSE' && target === 'PM_PENDING' &&
          v.makerUserId === row.actorUserId && v.pmUserId === null && v.benUserId === null) ||
        (before === 'PM_PENDING' && row.action === 'PM_FORWARD' && target === 'BEN_PENDING' &&
          v.pmUserId === row.actorUserId && v.benUserId === null && row.actorUserId !== state?.makerUserId) ||
        (before === 'PM_PENDING' && row.action === 'PM_RETURN' && target === 'RETURNED' &&
          v.pmUserId === row.actorUserId && v.benUserId === null && row.actorUserId !== state?.makerUserId) ||
        (before === 'BEN_PENDING' && row.action === 'BEN_APPROVE' && target === 'BEN_APPROVED' &&
          v.benUserId === row.actorUserId && row.actorUserId !== state?.pmUserId &&
          row.actorUserId !== state?.makerUserId) ||
        (before === 'BEN_PENDING' && row.action === 'BEN_REJECT' && target === 'REJECTED' &&
          v.benUserId === row.actorUserId && row.actorUserId !== state?.pmUserId &&
          row.actorUserId !== state?.makerUserId) ||
        (before === 'BEN_APPROVED' && row.action === 'FINALIZE' &&
          target === 'FINALIZED' && v.effect === 'PO_CANCELLED' &&
          v.benUserId === row.actorUserId && row.actorUserId === state?.benUserId &&
          v.pmUserId === state?.pmUserId && v.makerUserId === state?.makerUserId &&
          v.poCancelled === true && v.financePosted === false)
      )) return fail('PUR10_HISTORY_STAGE_INVALID');
      state = {
        caseId: v.caseId, companyId: v.companyId, projectId: v.projectId,
        orderId: id, poNumber: v.poNumber, revisionNo: v.revisionNo,
        orderUpdatedAt: v.orderUpdatedAt, makerUserId: v.makerUserId,
        pmUserId: v.pmUserId as string | null, benUserId: v.benUserId as string | null,
        version: expected, status: target,
      };
      prior = row.id;
    }
    if (!state || !prior) return fail('PUR10_HISTORY_INVALID');
    return { state, eventId: prior };
  }

  async read(auth: AuthenticatedUserContext, orderId: string) {
    const actor = await this.liveActor(auth, this.prisma);
    if (!actor.permissions.includes('procurement.po.view') ||
        !actor.roleCodes.some(role =>
          ['PROCUREMENT_OFFICER', 'PROJECT_MANAGER', 'MANAGEMENT'].includes(role)))
      return denied('PUR10_VIEW_PERMISSION_DENIED');
    const source = await this.source(auth, orderId, this.prisma, true);
    await this.mappedActors(auth.companyId, this.prisma);
    const current = await this.history(auth.companyId, orderId, this.prisma);
    if (Boolean(source.cancelledAt) !== (current?.state.status === 'FINALIZED'))
      return fail('PUR10_SOURCE_AND_FINAL_AUDIT_MISMATCH');
    return { orderId, case: current?.state ?? null,
      expectedPreviousEventId: current?.eventId ?? null };
  }

  async transition(context: Context, orderId: string, action: Pur10Action,
    expectedVersion: number, expectedPreviousEventId: string | null, note: string) {
    if (!ACTIONS.includes(action) || !Number.isSafeInteger(expectedVersion) ||
        expectedVersion < 0 || (expectedPreviousEventId !== null && !uuid(expectedPreviousEventId)))
      return fail('PUR10_REQUEST_INVALID');
    return this.prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'pur10:'+context.auth.companyId+':'+orderId);
      const actor = await this.liveActor(context.auth, tx);
      const source = await this.source(context.auth, orderId, tx);
      const named = await this.mappedActors(context.auth.companyId, tx);
      const current = await this.history(context.auth.companyId, orderId, tx);
      if ((current?.eventId ?? null) !== expectedPreviousEventId)
        return fail('PUR10_STALE_EVENT');
      const order: Pur10Order = {
        id: source.id, companyId: source.companyId, projectId: source.projectId,
        poNumber: source.poNumber, revisionNo: source.revisionNo,
        updatedAt: source.updatedAt.toISOString(),
        isLatestRevision: source.nextRevision === null, isCancelled: source.cancelledAt !== null,
        isRejected: source.approvalInstance?.approvalState === 'REJECTED',
        configuredJaiUserId: named.jai, configuredKhaimookUserId: named.khaimook,
        configuredBenUserId: named.ben,
      };
      let decision;
      try {
        decision = planPur10Decision({
          action, actor, order, projectAuthorized: true,
          current: current?.state ?? null, expectedVersion, note,
        });
      } catch (error) {
        if (error instanceof Pur10PolicyError) return fail(error.code);
        throw error;
      }
      const caseId = current?.state.caseId ?? randomUUID();
      const event = await tx.auditLog.create({
        data: {
          companyId: source.companyId, entityType: ENTITY, entityId: source.id,
          action, actorUserId: actor.userId,
          ...(context.correlationId ? { correlationId: context.correlationId } : {}),
          newValues: {
            caseId, orderId: source.id, companyId: source.companyId,
            projectId: source.projectId, poNumber: source.poNumber,
            revisionNo: source.revisionNo, orderUpdatedAt: source.updatedAt.toISOString(),
            makerUserId: decision.makerUserId, pmUserId: decision.pmUserId,
            benUserId: decision.benUserId, version: decision.version,
            status: decision.nextStatus, previousEventId: current?.eventId ?? null,
            effect: decision.effect, note,
          },
        },
        select: { id: true },
      });
      return {
        orderId, caseId, status: decision.nextStatus,
        version: decision.version, expectedPreviousEventId: event.id,
        poCancelled: false, financePosted: false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  /**
   * Finalization is a distinct, explicit Ben confirmation. It is the only
   * transaction allowed to transition an approved reviewed PO to cancelled.
   * All receipt, invoice and delivery evidence must be absent; exception cases
   * remain blocked pending their separate Ben/Nancy/Accounting decisions.
   */
  async finalize(context: Context, orderId: string,
    expectedVersion: number, expectedPreviousEventId: string,
    attestation: {
      supplierAgreementEvidence: string;
      supplierAgreed: boolean;
      noDepositOrPenalty: boolean;
      noDeliveryOrInvoice: boolean;
    }) {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 ||
        !uuid(expectedPreviousEventId) ||
        typeof attestation.supplierAgreementEvidence !== 'string' ||
        attestation.supplierAgreementEvidence.trim() !== attestation.supplierAgreementEvidence ||
        attestation.supplierAgreementEvidence.length < 10 ||
        attestation.supplierAgreementEvidence.length > 1200 ||
        !attestation.supplierAgreed ||
        !attestation.noDepositOrPenalty || !attestation.noDeliveryOrInvoice)
      return fail('PUR10_EXPLICIT_BEN_SUPPLIER_AND_NO_EXCEPTION_ATTESTATION_REQUIRED');

    return this.prisma.$transaction(async tx => {
      // Case lock before any receipt/Finance locks. Competing finalizers or
      // stage updates to the same PO cannot both observe an earlier version.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'pur10:' + context.auth.companyId + ':' + orderId);
      const actor = await this.liveActor(context.auth, tx);
      const source = await this.source(context.auth, orderId, tx);
      const named = await this.mappedActors(context.auth.companyId, tx);
      if (actor.userId !== named.ben ||
          !actor.roleCodes.includes('MANAGEMENT') ||
          !actor.permissions.includes('procurement.po.approve') ||
          !actor.permissions.includes('procurement.po.cancel'))
        return denied('PUR10_NAMED_BEN_FINALIZATION_PERMISSION_REQUIRED');

      const reviewed = await this.history(context.auth.companyId, orderId, tx);
      if (!reviewed || reviewed.eventId !== expectedPreviousEventId ||
          reviewed.state.version !== expectedVersion ||
          reviewed.state.status !== 'BEN_APPROVED' ||
          reviewed.state.benUserId !== actor.userId)
        return fail('PUR10_FINALIZATION_REVIEW_STALE_OR_NOT_APPROVED');

      const order: Pur10Order = {
        id: source.id, companyId: source.companyId,
        projectId: source.projectId, poNumber: source.poNumber,
        revisionNo: source.revisionNo, updatedAt: source.updatedAt.toISOString(),
        configuredJaiUserId: named.jai, configuredKhaimookUserId: named.khaimook,
        configuredBenUserId: named.ben, isLatestRevision: source.nextRevision === null,
        isCancelled: source.cancelledAt !== null, isRejected: false,
      };
      const lines = await tx.purchaseOrderLine.findMany({
        where: { purchaseOrderId: orderId }, select: { id: true },
      });
      if (!lines.length) return fail('PUR10_SOURCE_LINES_REQUIRED');
      const lineIds = lines.map(row => row.id);
      const [anyReceipt, anyInvoice, anyDelivery, postedReceipt, approvedInvoice] = await Promise.all([
        tx.goodsReceipt.findFirst({
          where: { purchaseOrder: { companyId: source.companyId, poNumber: source.poNumber } },
          select: { id: true },
        }),
        tx.supplierInvoiceItem.findFirst({
          where: { purchaseOrderLineId: { in: lineIds } }, select: { id: true },
        }),
        tx.receivingDelivery.findFirst({
          where: { companyId: source.companyId, purchaseOrderId: orderId },
          select: { id: true },
        }),
        tx.goodsReceipt.findFirst({
          where: { purchaseOrder: { companyId: source.companyId, poNumber: source.poNumber },
            postedAt: { not: null }, reversedAt: null },
          select: { id: true },
        }),
        tx.supplierInvoiceItem.findFirst({
          where: { purchaseOrderLineId: { in: lineIds },
            supplierInvoice: { state: 'APPROVED' } }, select: { id: true },
        }),
      ]);
      try {
        assertPur10ReadyToCancel(reviewed.state, order, {
          postedUnreversedReceipt: Boolean(postedReceipt),
          approvedInvoiceSource: Boolean(approvedInvoice),
          supplierRefusesCancellation: !attestation.supplierAgreed,
          depositOrPenaltyUnresolved: !attestation.noDepositOrPenalty,
          partialDeliveryOrInvoice:
            Boolean(anyReceipt || anyInvoice || anyDelivery || !attestation.noDeliveryOrInvoice),
        });
      } catch (error) {
        if (error instanceof Pur10PolicyError) return fail(error.code);
        throw error;
      }

      // Never mutate a PO or Finance source unless the complete independent
      // case still matches. This existing writer ALSO checks live GR/AP locks
      // and PO revision state after its own row lock in this same transaction.
      const cancelled = await this.orders.cancelForReviewedCase(
        context, orderId,
        'PUR10 verified Ben cancellation; supplier evidence: ' +
          attestation.supplierAgreementEvidence,
        reviewed.state.caseId, reviewed.eventId, reviewed.state.orderUpdatedAt, tx,
      );
      const final = await tx.auditLog.create({
        data: {
          companyId: source.companyId, entityType: ENTITY, entityId: orderId,
          action: 'FINALIZE', actorUserId: actor.userId,
          ...(context.correlationId ? { correlationId: context.correlationId } : {}),
          newValues: {
            caseId: reviewed.state.caseId, companyId: source.companyId,
            projectId: source.projectId, orderId, poNumber: source.poNumber,
            revisionNo: source.revisionNo,
            orderUpdatedAt: reviewed.state.orderUpdatedAt,
            makerUserId: reviewed.state.makerUserId,
            pmUserId: reviewed.state.pmUserId, benUserId: reviewed.state.benUserId,
            version: reviewed.state.version + 1,
            status: 'FINALIZED', previousEventId: reviewed.eventId,
            effect: 'PO_CANCELLED', poCancelled: true, financePosted: false,
            supplierAgreementEvidence: attestation.supplierAgreementEvidence,
            supplierAgreed: true, noDepositOrPenalty: true,
            noDeliveryOrInvoice: true,
          },
        },
        select: { id: true },
      });
      return {
        orderId, caseId: reviewed.state.caseId, status: 'FINALIZED' as const,
        version: reviewed.state.version + 1,
        expectedPreviousEventId: final.id,
        poCancelled: cancelled.lifecycleState === 'CANCELLED',
        financePosted: false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

}
