import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  planSupplierDeliveryTransition, SupplierDeliveryPolicyError,
  type SupplierAction, type SupplierDeliveryActor, type SupplierDeliveryCase,
  type SupplierDeliveryRequest,
} from './supplier-delivery-lifecycle';

/**
 * PUR08/PUR14. An auditable *reported-evidence* lifecycle, NEVER a second
 * supplier dispatch, canonical goods receipt, stock movement, or Finance post.
 *
 * PUR07 PO dispatch acknowledgment and approved PO/GR/Document are the actual
 * persisted sources. This workflow only links those independently verified
 * records to a scoped human review/claim chain.
 */
type Db = PrismaService | Prisma.TransactionClient;
type Ctx = { auth: AuthenticatedUserContext; correlationId?: string };
export type SupplierCaseInput = Pick<SupplierDeliveryRequest,
  'action' | 'expectedVersion' | 'evidenceDocumentId' | 'note' |
  'discrepancyKind' | 'pmDecision' | 'recordedGoodsReceiptId' | 'newSupplierExpectedDate'
> & {
  expectedPreviousEventId: string | null;
  recordedPoAcknowledgmentEventId?: string;
};
const ENTITY = 'SUPPLIER_DELIVERY_CASE';
const actions: SupplierAction[] = [
  'ACKNOWLEDGE', 'CONFIRM_IN_TRANSIT', 'REPORT_DELAY',
  'REPORT_DISCREPANCY', 'PM_REVIEW_DISCREPANCY', 'JAI_RECORD_CLAIM',
  'STORE_RECORD_RETURN_DISPATCH', 'STORE_RECORD_REPLACEMENT_RECEIPT',
];
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function conflict(code: string): never { throw new ConflictException({ code }); }
function denied(code: string): never { throw new ForbiddenException({ code }); }
function invalid(code: string): never { throw new UnprocessableEntityException({ code }); }

@Injectable()
export class SupplierDeliveryCaseService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService) {}

  private async actor(auth: AuthenticatedUserContext, db: Db) {
    const session = await db.userSession.findFirst({
      where: {
        id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
        user: { companyId: auth.companyId, isActive: true, company: { isActive: true } },
      },
      select: { user: { select: {
        employee: { select: { companyId: true, isActive: true } },
        userRoles: { select: { role: { select: {
          companyId: true, roleCode: true, isActive: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
        } } } },
      } } },
    });
    if (!session?.user.employee?.isActive || session.user.employee.companyId !== auth.companyId)
      return denied('SUPPLIER_CASE_LIVE_EMPLOYEE_REQUIRED');
    const roles = session.user.userRoles.map(r => r.role)
      .filter(role => role.isActive && role.companyId === auth.companyId);
    const granted = new Set(roles.flatMap(role => role.rolePermissions.map(p => p.permission.permissionCode)));
    const permissions = auth.permissions.filter(code => granted.has(code));
    const result: SupplierDeliveryActor = {
      userId: auth.userId, companyId: auth.companyId,
      roleCodes: roles.map(r => r.roleCode), permissions,
      activeSession: true, activeEmployee: true,
    };
    const isJai = result.roleCodes.includes('PROCUREMENT_OFFICER') &&
      permissions.includes('procurement.po.view');
    const isPm = result.roleCodes.includes('PROJECT_MANAGER') &&
      permissions.includes('inventory.receipt.view');
    const isStore = result.roleCodes.includes('STOREKEEPER') &&
      permissions.includes('inventory.receiving.view');
    if (!isJai && !isPm && !isStore) return denied('SUPPLIER_CASE_BUSINESS_VIEW_DENIED');
    return result;
  }

  private async order(auth: AuthenticatedUserContext, id: string, db: Db) {
    const order = await db.purchaseOrder.findFirst({
      where: { id, companyId: auth.companyId },
      select: {
        id: true, companyId: true, projectId: true, supplierId: true,
        poNumber: true, revisionNo: true, cancelledAt: true,
        nextRevision: { select: { id: true } },
        approvalInstance: { select: { approvalState: true } },
      },
    });
    if (!order) throw new NotFoundException({ code: 'SUPPLIER_CASE_PO_NOT_FOUND' });
    await this.access.assertAccess(auth, order.projectId, db);
    return order;
  }

  private async history(companyId: string, orderId: string, db: Db) {
    const rows = await db.auditLog.findMany({
      where: { companyId, entityType: ENTITY, entityId: orderId },
      select: { id: true, action: true, actorUserId: true, newValues: true },
      take: 101,
    });
    if (rows.length > 100) return conflict('SUPPLIER_CASE_HISTORY_BOUND_EXCEEDED');
    let lastId: string | null = null;
    let state: SupplierDeliveryCase | null = null;
    const processed = new Set<string>();
    for (let version = 1; version <= rows.length; version++) {
      const links = rows.filter(row => {
        const values = row.newValues;
        return values !== null && typeof values === 'object' && !Array.isArray(values) &&
          (values as Record<string, Prisma.JsonValue>).previousEventId === lastId;
      });
      if (links.length !== 1) return conflict('SUPPLIER_CASE_HISTORY_FORK');
      const e = links[0]!;
      if (processed.has(e.id) || !actions.includes(e.action as SupplierAction))
        return conflict('SUPPLIER_CASE_HISTORY_ACTION_INVALID');
      processed.add(e.id);
      const values = e.newValues as Record<string, Prisma.JsonValue>;
      const s = values.state;
      if (!s || typeof s !== 'object' || Array.isArray(s) || values.effect !== 'NO_PO_GR_STOCK_FINANCE_MUTATION')
        return conflict('SUPPLIER_CASE_HISTORY_STATE_INVALID');
      const obj = s as Record<string, Prisma.JsonValue>;
      if (obj.purchaseOrderId !== orderId || obj.companyId !== companyId ||
          !uuid(obj.projectId) || !uuid(obj.revisionId) ||
          obj.version !== version || typeof obj.stage !== 'string' ||
          !['ACKNOWLEDGED','IN_TRANSIT','DELAY_REPORTED','DISCREPANCY_REPORTED','PM_REVIEWED',
            'CLAIM_RECORDED','RETURN_DISPATCH_RECORDED','REPLACEMENT_RECEIPT_RECORDED'].includes(obj.stage))
        return conflict('SUPPLIER_CASE_HISTORY_STATE_INVALID');
      if (state && (state.projectId !== obj.projectId || state.revisionId !== obj.revisionId))
        return conflict('SUPPLIER_CASE_HISTORY_SOURCE_CHANGED');
      // Preserve exact actor and first event, rather than trusting time/UUID sort.
      if (version === 1 && (e.action !== 'ACKNOWLEDGE' || obj.stage !== 'ACKNOWLEDGED'))
        return conflict('SUPPLIER_CASE_HISTORY_INVALID_START');
      if (typeof values.actorUserId !== 'string' || values.actorUserId !== e.actorUserId ||
          typeof values.evidenceDocumentId !== 'string' || !uuid(values.evidenceDocumentId))
        return conflict('SUPPLIER_CASE_HISTORY_EVIDENCE_INVALID');
      state = obj as unknown as SupplierDeliveryCase;
      lastId = e.id;
    }
    return { state, eventId: lastId };
  }

  async read(auth: AuthenticatedUserContext, orderId: string) {
    const actor = await this.actor(auth, this.prisma);
    const scoped = { ...auth, roleCodes: actor.roleCodes, permissions: actor.permissions };
    const source = await this.order(scoped, orderId, this.prisma);
    const current = await this.history(auth.companyId, source.id, this.prisma);
    return {
      purchaseOrderId: source.id, projectId: source.projectId,
      approvedLatest: source.approvalInstance?.approvalState === 'APPROVED' && !source.nextRevision && !source.cancelledAt,
      case: current.state, expectedPreviousEventId: current.eventId,
      advisoryOnly: true, stockEffect: false, financeEffect: false,
      // PUR07 acknowledgment is an independent source, not implied by a PO date.
      supplierAcknowledgmentFrom: 'PUR07_DOCUMENTED_EXTERNAL_ACK_ONLY',
    };
  }

  async transition(context: Ctx, orderId: string, input: SupplierCaseInput) {
    if (!actions.includes(input.action) || !Number.isSafeInteger(input.expectedVersion) ||
        input.expectedVersion < 0 ||
        (input.expectedPreviousEventId !== null && !uuid(input.expectedPreviousEventId)) ||
        !uuid(input.evidenceDocumentId) ||
        (input.recordedPoAcknowledgmentEventId !== undefined && !uuid(input.recordedPoAcknowledgmentEventId)) ||
        (input.recordedGoodsReceiptId !== undefined && !uuid(input.recordedGoodsReceiptId)))
      return invalid('SUPPLIER_CASE_INVALID_INPUT');
    return this.prisma.$transaction(async tx => {
      // Same-Company PO-specific serialization: simultaneous Store/Jai/PM actions
      // cannot both insert a "next" event from a stale version.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'supplier_case:' + context.auth.companyId + ':' + orderId);
      const actor = await this.actor(context.auth, tx);
      const scoped = { ...context.auth, roleCodes: actor.roleCodes, permissions: actor.permissions };
      const order = await this.order(scoped, orderId, tx);
      const current = await this.history(order.companyId, orderId, tx);
      if (current.eventId !== input.expectedPreviousEventId)
        return conflict('SUPPLIER_CASE_STALE_EVENT');
      if (!order.approvalInstance || order.approvalInstance.approvalState !== 'APPROVED' ||
          order.nextRevision || order.cancelledAt)
        return conflict('SUPPLIER_CASE_APPROVED_LATEST_SOURCE_REQUIRED');
      const doc = await tx.document.findFirst({
        where: { id: input.evidenceDocumentId, companyId: order.companyId, isActive: true,
          links: { some: { entityType: 'PROJECT', entityId: order.projectId } } },
        select: { id: true },
      });
      if (!doc || !actor.permissions.includes('documents.document.view'))
        return denied('SUPPLIER_CASE_SCOPED_DOCUMENT_EVIDENCE_REQUIRED');
      if (input.action === 'ACKNOWLEDGE') {
        // Prior PUR07 recorded acknowledgment MUST point to an actual reported
        // external dispatch of THIS approved PO. No substitute synthetic ack.
        if (!input.recordedPoAcknowledgmentEventId)
          return conflict('SUPPLIER_CASE_EXISTING_PUR07_ACK_REQUIRED');
        const ack = await tx.poDispatchEvent.findFirst({
          where: {
            id: input.recordedPoAcknowledgmentEventId, companyId: order.companyId,
            projectId: order.projectId, purchaseOrderId: order.id,
            kind: 'ACKNOWLEDGMENT',
            acknowledges: {
              kind: 'DISPATCH', companyId: order.companyId,
              projectId: order.projectId, purchaseOrderId: order.id,
            },
          },
          select: { id: true },
        });
        if (!ack) return conflict('SUPPLIER_CASE_PUR07_ACK_NOT_FOUND');
      }
      if (input.action === 'STORE_RECORD_REPLACEMENT_RECEIPT') {
        const gr = await tx.goodsReceipt.findFirst({
          where: {
            id: input.recordedGoodsReceiptId ?? '',
            companyId: order.companyId, projectId: order.projectId,
            supplierId: order.supplierId,
            purchaseOrder: { companyId: order.companyId, projectId: order.projectId, poNumber: order.poNumber },
            postedAt: { not: null }, reversedAt: null,
          },
          select: { id: true },
        });
        if (!gr) return conflict('SUPPLIER_CASE_ACTUAL_POSTED_GR_REQUIRED');
      }
      let decision;
      try {
        decision = planSupplierDeliveryTransition({
          ...input, actor, current: current.state, projectAuthorized: true,
          source: {
            purchaseOrderId: order.id, companyId: order.companyId, projectId: order.projectId,
            latestApprovedRevisionId: order.id, isLatestApprovedRevision: true, cancelled: false,
          },
        });
      } catch (error) {
        if (error instanceof SupplierDeliveryPolicyError) return conflict(error.code);
        throw error;
      }
      const event = await tx.auditLog.create({
        data: {
          companyId: order.companyId, entityType: ENTITY, entityId: order.id,
          action: input.action, actorUserId: context.auth.userId,
          ...(context.correlationId ? { correlationId: context.correlationId } : {}),
          newValues: {
            previousEventId: current.eventId, state: decision.case,
            actorUserId: context.auth.userId, evidenceDocumentId: doc.id,
            reportedOnly: true, note: decision.note,
            ...(input.action === 'ACKNOWLEDGE' ?
              { referencedPur07AcknowledgmentEventId: input.recordedPoAcknowledgmentEventId } : {}),
            ...(input.action === 'REPORT_DELAY' ?
              { newSupplierExpectedDate: input.newSupplierExpectedDate } : {}),
            ...(input.action === 'STORE_RECORD_REPLACEMENT_RECEIPT' ?
              { recordedGoodsReceiptId: input.recordedGoodsReceiptId } : {}),
            effect: 'NO_PO_GR_STOCK_FINANCE_MUTATION',
          },
        },
        select: { id: true },
      });
      return {
        purchaseOrderId: order.id, case: decision.case,
        expectedPreviousEventId: event.id,
        stockEffect: false, financeEffect: false,
        supplierNoticeSent: false,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
