import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { verifySupplierReplacementProof, SupplierReplacementProofError } from './supplier-replacement-proof';
import { verifySupplierReturnCustody, SupplierReturnCustodyError } from './supplier-return-custody-proof';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { DocumentsService } from '../documents/documents.service';
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
  originalReceivingDeliveryLineId?: string;
  recordedGoodsReceiptItemId?: string;
  returnQuantity?: string;
  supplierSignatory?: string;
  supplierSignatureConfirmed?: boolean;
};
const ENTITY = 'SUPPLIER_DELIVERY_CASE';
const actions: SupplierAction[] = [
  'ACKNOWLEDGE', 'CONFIRM_IN_TRANSIT', 'REPORT_DELAY',
  'REPORT_DISCREPANCY', 'PM_REVIEW_DISCREPANCY', 'JAI_RECORD_CLAIM',
  'STORE_RECORD_RETURN_DISPATCH', 'STORE_RECORD_REPLACEMENT_RECEIPT',
];
const stageForAction: Record<SupplierAction, SupplierDeliveryCase['stage']> = {
  ACKNOWLEDGE: 'ACKNOWLEDGED',
  CONFIRM_IN_TRANSIT: 'IN_TRANSIT',
  REPORT_DELAY: 'DELAY_REPORTED',
  REPORT_DISCREPANCY: 'DISCREPANCY_REPORTED',
  PM_REVIEW_DISCREPANCY: 'PM_REVIEWED',
  JAI_RECORD_CLAIM: 'CLAIM_RECORDED',
  STORE_RECORD_RETURN_DISPATCH: 'RETURN_DISPATCH_RECORDED',
  STORE_RECORD_REPLACEMENT_RECEIPT: 'REPLACEMENT_RECEIPT_RECORDED',
};
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function conflict(code: string): never { throw new ConflictException({ code }); }
function denied(code: string): never { throw new ForbiddenException({ code }); }
function invalid(code: string): never { throw new UnprocessableEntityException({ code }); }

@Injectable()
export class SupplierDeliveryCaseService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService,
    private readonly documents: DocumentsService) {}

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
      select: { id: true, action: true, actorUserId: true, occurredAt: true, newValues: true },
      take: 101,
    });
    if (rows.length > 100) return conflict('SUPPLIER_CASE_HISTORY_BOUND_EXCEEDED');
    let lastId: string | null = null;
    let state: SupplierDeliveryCase | null = null;
    let origin: { eventId: string; evidenceDocumentId: string } | null = null;
    let claim: { eventId: string; claimedAt: string } | null = null;
    let replacementTrace: Prisma.JsonValue | null = null;
    let returnCustodyTrace: Prisma.JsonValue | null = null;
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
          obj.stage !== stageForAction[e.action as SupplierAction])
        return conflict('SUPPLIER_CASE_HISTORY_STATE_INVALID');
      if (state && (state.projectId !== obj.projectId || state.revisionId !== obj.revisionId))
        return conflict('SUPPLIER_CASE_HISTORY_SOURCE_CHANGED');
      // Preserve exact actor and first event, rather than trusting time/UUID sort.
      if (version === 1 && !((e.action === 'ACKNOWLEDGE' && obj.stage === 'ACKNOWLEDGED') ||
          (e.action === 'REPORT_DISCREPANCY' && obj.stage === 'DISCREPANCY_REPORTED')))
        return conflict('SUPPLIER_CASE_HISTORY_INVALID_START');
      if (typeof values.actorUserId !== 'string' || values.actorUserId !== e.actorUserId ||
          typeof values.evidenceDocumentId !== 'string' || !uuid(values.evidenceDocumentId))
        return conflict('SUPPLIER_CASE_HISTORY_EVIDENCE_INVALID');
      if (e.action === 'REPORT_DISCREPANCY')
        origin = { eventId: e.id, evidenceDocumentId: values.evidenceDocumentId as string };
      if (e.action === 'JAI_RECORD_CLAIM')
        claim = { eventId: e.id, claimedAt: e.occurredAt.toISOString() };
      if (e.action === 'STORE_RECORD_REPLACEMENT_RECEIPT')
        replacementTrace = values.replacementTrace ?? null;
      if (e.action === 'STORE_RECORD_RETURN_DISPATCH')
        returnCustodyTrace = values.returnCustodyTrace ?? null;
      state = obj as unknown as SupplierDeliveryCase;
      lastId = e.id;
    }
    return { state, eventId: lastId, origin, claim, replacementTrace, returnCustodyTrace };
  }

  /**
   * A historical supplier evidence event is immutable; a later canonical GR
   * reversal must NOT be disguised as a currently posted replacement.
   * This is a bounded read-side reconciliation, never a new inventory/Finance
   * transaction and never a rewrite of the signed supplier-case history.
   */
  private async currentReplacementReceipt(
    source: { id: string; companyId: string; projectId: string; supplierId: string },
    trace: Prisma.JsonValue | null, db: Db,
  ): Promise<'POSTED' | 'REVERSED' | 'SOURCE_UNVERIFIED' | null> {
    if (trace === null) return null;
    if (typeof trace !== 'object' || Array.isArray(trace)) return 'SOURCE_UNVERIFIED';
    const t = trace as Record<string, Prisma.JsonValue>;
    if (!uuid(t.replacementGoodsReceiptId) || !uuid(t.replacementGoodsReceiptItemId) ||
        !uuid(t.replacementDeliveryId) || !uuid(t.originalDeliveryId) ||
        !uuid(t.originalDeliveryLineId) || !uuid(t.purchaseOrderLineId) ||
        !uuid(t.materialId) || !uuid(t.uomId) ||
        typeof t.quantity !== 'string' ||
        t.effect !== 'TRACE_ONLY_NO_STOCK_FINANCE_MUTATION')
      return 'SOURCE_UNVERIFIED';

    const gr = await db.goodsReceipt.findFirst({
      where: {
        id: t.replacementGoodsReceiptId, companyId: source.companyId,
        projectId: source.projectId, supplierId: source.supplierId,
        purchaseOrderId: source.id,
      },
      select: {
        id: true, postedAt: true, reversedAt: true,
        approvalInstance: { select: { approvalState: true } },
        items: { where: { id: t.replacementGoodsReceiptItemId },
          select: { purchaseOrderLineId: true, materialId: true,
            uomId: true, quantity: true } },
        delivery: { select: { id: true, status: true, companyId: true,
          projectId: true, supplierId: true, purchaseOrderId: true } },
      },
    });
    const item = gr?.items[0];
    const d = gr?.delivery;
    const orig = await db.receivingDeliveryLine.findFirst({
      where: {
        id: t.originalDeliveryLineId, deliveryId: t.originalDeliveryId,
        purchaseOrderLineId: t.purchaseOrderLineId,
        materialId: t.materialId, uomId: t.uomId,
        delivery: { companyId: source.companyId, projectId: source.projectId,
          supplierId: source.supplierId, purchaseOrderId: source.id },
      },
      select: { delivery: { select: { status: true } } },
    });
    if (!gr || !item || !d || !orig || orig.delivery.status !== 'CHECKED' ||
        d.id !== t.replacementDeliveryId || d.status !== 'CHECKED' ||
        d.companyId !== source.companyId || d.projectId !== source.projectId ||
        d.supplierId !== source.supplierId || d.purchaseOrderId !== source.id ||
        item.purchaseOrderLineId !== t.purchaseOrderLineId ||
        item.materialId !== t.materialId || item.uomId !== t.uomId ||
        item.quantity.toFixed(4) !== t.quantity ||
        !gr.postedAt || gr.approvalInstance?.approvalState !== 'APPROVED')
      return 'SOURCE_UNVERIFIED';
    return gr.reversedAt ? 'REVERSED' : 'POSTED';
  }

  // Preserve business custody history while applying current document access.
  // Never mutate the immutable event or treat a historical link as entitlement.
  private async visibleReturnCustodyTrace(
    auth: AuthenticatedUserContext, projectId: string,
    trace: Prisma.JsonValue | null,
  ): Promise<Prisma.JsonValue | null> {
    if (trace === null || typeof trace !== 'object' || Array.isArray(trace)) return null;
    const { signedHandoverDocumentId, signedHandoverChecksum, ...business } = trace;
    const redacted = { ...business, signedHandoverDocumentId: null, signedHandoverChecksum: null };
    if (!auth.permissions.includes('documents.document.view') ||
        !uuid(signedHandoverDocumentId) || !uuid(business.originalDeliveryId) ||
        typeof signedHandoverChecksum !== 'string' ||
        !/^[a-f0-9]{64}$/i.test(signedHandoverChecksum)) return redacted;
    const doc = await this.prisma.document.findFirst({
      where: { id: signedHandoverDocumentId, companyId: auth.companyId, isActive: true,
        AND: [
          { links: { some: { entityType: 'PROJECT', entityId: projectId } } },
          { links: { some: { entityType: 'RECEIVING_DELIVERY', entityId: business.originalDeliveryId } } },
        ],
      },
      select: { checksum: true, links: { select: { entityType: true, entityId: true } } },
    });
    if (!doc?.checksum || doc.checksum.toLowerCase() !== signedHandoverChecksum.toLowerCase()) return redacted;
    try {
      const visible = await this.documents.filterSourceDocuments(auth, projectId, [doc]);
      return visible.length === 1 ? { ...business, signedHandoverDocumentId, signedHandoverChecksum } : redacted;
    } catch (error) {
      // A linked source may require a live grant beyond the supplier-case view.
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return redacted;
      throw error;
    }
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
      replacementTrace: current.replacementTrace,
      returnCustodyTrace: await this.visibleReturnCustodyTrace(scoped, source.projectId, current.returnCustodyTrace),
      financeResolution: 'REPLACEMENT_ONLY_NO_AP_CREDIT',
      nonDamagedResolution: 'DISCREPANCY_EVIDENCE_ONLY',
      replacementReceiptLiveStatus: await this.currentReplacementReceipt(source, current.replacementTrace, this.prisma),
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
        (input.recordedGoodsReceiptId !== undefined && !uuid(input.recordedGoodsReceiptId)) ||
        (input.recordedGoodsReceiptItemId !== undefined && !uuid(input.recordedGoodsReceiptItemId)) ||
        (input.originalReceivingDeliveryLineId !== undefined && !uuid(input.originalReceivingDeliveryLineId)) ||
        (input.returnQuantity !== undefined && typeof input.returnQuantity !== 'string') ||
        (input.supplierSignatory !== undefined && typeof input.supplierSignatory !== 'string') ||
        (input.supplierSignatureConfirmed !== undefined && typeof input.supplierSignatureConfirmed !== 'boolean'))
      return invalid('SUPPLIER_CASE_INVALID_INPUT');
    try {
      return await this.prisma.$transaction(async tx => {
      // Same-Company PO-specific serialization: simultaneous Store/Jai/PM actions
      // cannot both insert a "next" event from a stale version.
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'supplier_case:' + context.auth.companyId + ':' + orderId);
      const actor = await this.actor(context.auth, tx);
      const scoped = { ...context.auth, roleCodes: actor.roleCodes, permissions: actor.permissions };
      const order = await this.order(scoped, orderId, tx);
      // The canonical PUR10 finalizer locks and updates this exact PO row.
      // A serializable supplier transaction that began before cancellation
      // must not append a new report from its older snapshot after that
      // cancellation commits. No PO field is modified by this read lock.
      const locked = await tx.$queryRaw<Array<{id: string}>>(Prisma.sql`
        SELECT "id" FROM "purchase_orders"
        WHERE "id" = ${orderId}::uuid
          AND "company_id" = ${order.companyId}::uuid
        FOR UPDATE
      `);
      if (locked.length !== 1) throw new NotFoundException({ code: 'SUPPLIER_CASE_PO_NOT_FOUND' });
      const current = await this.history(order.companyId, orderId, tx);
      if (current.eventId !== input.expectedPreviousEventId)
        return conflict('SUPPLIER_CASE_STALE_EVENT');
      if (!order.approvalInstance || order.approvalInstance.approvalState !== 'APPROVED' ||
          order.nextRevision || order.cancelledAt)
        return conflict('SUPPLIER_CASE_APPROVED_LATEST_SOURCE_REQUIRED');
      const doc = await tx.document.findFirst({
        where: { id: input.evidenceDocumentId, companyId: order.companyId, isActive: true,
          links: { some: { entityType: 'PROJECT', entityId: order.projectId } } },
        select: { id: true, checksum: true,
          links: { where: { entityType: 'RECEIVING_DELIVERY' }, select: { entityId: true } } },
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
      let replacementTrace: Record<string, string> | null = null;
      let returnCustodyTrace: ReturnType<typeof verifySupplierReturnCustody> | null = null;
      if (input.action === 'STORE_RECORD_RETURN_DISPATCH') {
        if (!current.origin || !current.claim || !input.originalReceivingDeliveryLineId ||
            !input.returnQuantity || !input.supplierSignatory ||
            input.supplierSignatureConfirmed !== true)
          return conflict('SUPPLIER_CASE_RETURN_SOURCE_AND_SIGNED_HANDOVER_REQUIRED');
        // Non-damaged discrepancy cases remain claim-only. No assumed
        // short/excess/wrong-item posted-material or financial resolution.
        if (current.state?.discrepancyKind !== 'DAMAGED')
          return conflict('PUR14_RETURN_KIND_REQUIRES_ATTRIBUTION_POLICY');
        const original = await tx.receivingDeliveryLine.findFirst({
          where: { id: input.originalReceivingDeliveryLineId,
            delivery: { companyId: order.companyId, projectId: order.projectId,
              supplierId: order.supplierId, purchaseOrderId: order.id } },
          select: {
            id: true, condition: true, purchaseOrderLineId: true,
            materialId: true, uomId: true,
            observedQuantity: true, goodQuantity: true,
            delivery: { select: {
              id: true, companyId: true, projectId: true,
              supplierId: true, purchaseOrderId: true, warehouseId: true,
              status: true, checkedAt: true,
              replacement: { select: { id: true } },
            } },
          },
        });
        if (!original?.purchaseOrderLineId)
          return conflict('SUPPLIER_CASE_RETURN_ORIGINAL_CHECKED_LINE_REQUIRED');
        const poLine = await tx.purchaseOrderLine.findFirst({
          where: { id: original.purchaseOrderLineId,
            purchaseOrderId: order.id, lineType: 'MATERIAL' },
          select: { id: true, materialId: true, uomId: true },
        });
        if (!poLine?.materialId || !poLine.uomId)
          return conflict('SUPPLIER_CASE_RETURN_PO_MATERIAL_SOURCE_REQUIRED');
        const originDoc = await tx.receivingDeliveryEvidence.findFirst({
          where: { companyId: order.companyId,
            deliveryId: original.delivery.id,
            documentId: current.origin.evidenceDocumentId,
            purpose: 'CONDITION_PHOTO',
            replacement: { is: null },
            document: { companyId: order.companyId, isActive: true,
              links: { some: { entityType: 'RECEIVING_DELIVERY',
                entityId: original.delivery.id } } },
          },
          select: { checksum: true, document: { select: { checksum: true } } },
        });
        try {
          returnCustodyTrace = verifySupplierReturnCustody({
            expected: {
              companyId: order.companyId, projectId: order.projectId,
              supplierId: order.supplierId, purchaseOrderId: order.id,
              purchaseOrderLineId: poLine.id, materialId: poLine.materialId,
              uomId: poLine.uomId,
              discrepancyKind: current.state.discrepancyKind!,
            },
            original: {
              deliveryId: original.delivery.id, lineId: original.id,
              companyId: original.delivery.companyId,
              projectId: original.delivery.projectId,
              supplierId: original.delivery.supplierId,
              purchaseOrderId: original.delivery.purchaseOrderId ?? '',
              purchaseOrderLineId: original.purchaseOrderLineId,
              materialId: original.materialId, uomId: original.uomId,
              warehouseId: original.delivery.warehouseId,
              status: original.delivery.status, condition: original.condition,
              checkedAt: original.delivery.checkedAt?.toISOString() ?? null,
              superseded: Boolean(original.delivery.replacement),
              observedQuantity: original.observedQuantity.toFixed(4),
              goodQuantity: original.goodQuantity.toFixed(4),
              conditionPhotoVerified: Boolean(originDoc && originDoc.document.checksum &&
                originDoc.checksum === originDoc.document.checksum),
            },
            handover: {
              quantity: input.returnQuantity,
              supplierSignatory: input.supplierSignatory,
              supplierSignatureConfirmed: input.supplierSignatureConfirmed,
              documentId: doc.id, documentChecksum: doc.checksum,
              documentDistinctFromConditionPhoto: doc.id !== current.origin.evidenceDocumentId &&
                Boolean(doc.checksum && originDoc?.checksum &&
                  doc.checksum.toLowerCase() !== originDoc.checksum.toLowerCase()),
              documentLinkedToOriginalDelivery: doc.links.some(link =>
                link.entityId === original.delivery.id),
            },
          });
        } catch (error) {
          if (error instanceof SupplierReturnCustodyError) return conflict(error.code);
          throw error;
        }
      }
      if (input.action === 'STORE_RECORD_REPLACEMENT_RECEIPT') {
        // Do not relabel any unrelated posted GR as a completed supplier claim.
        // Existing evidence-only cases remain readable until real source proof exists.
        if (!current.origin || !current.claim ||
            !input.originalReceivingDeliveryLineId || !input.recordedGoodsReceiptItemId ||
            !input.recordedGoodsReceiptId)
          return conflict('SUPPLIER_CASE_REPLACEMENT_PROVENANCE_REQUIRED');
        const origin = await tx.receivingDeliveryLine.findFirst({
          where: { id: input.originalReceivingDeliveryLineId,
            delivery: { companyId: order.companyId, projectId: order.projectId,
              supplierId: order.supplierId, purchaseOrderId: order.id } },
          select: {
            id: true, purchaseOrderLineId: true, materialId: true, uomId: true,
            observedQuantity: true, goodQuantity: true,
            delivery: { select: {
              id: true, companyId: true, projectId: true, supplierId: true,
              purchaseOrderId: true, status: true, receivedAt: true,
            } },
          },
        });
        // Missing/foreign/unlinked origin must be a controlled business conflict,
        // never an empty-string UUID passed to PostgreSQL by Prisma.
        if (!origin?.purchaseOrderLineId)
          return conflict('SUPPLIER_CASE_REPLACEMENT_SOURCE_NOT_FOUND');
        const poLine = await tx.purchaseOrderLine.findFirst({
          where: { id: origin.purchaseOrderLineId, purchaseOrderId: order.id,
            lineType: 'MATERIAL' },
          select: { id: true, materialId: true, uomId: true },
        });
        const originalDocument = await tx.document.findFirst({
          where: { id: current.origin.evidenceDocumentId, companyId: order.companyId,
            isActive: true, links: { some: {
              entityType: 'RECEIVING_DELIVERY', entityId: origin.delivery.id,
            } } },
          select: { id: true },
        });
        // The candidate GR lookup must itself be tenant and PO constrained.
        // Do not read a foreign receipt and depend only on an eventual proof rejection.
        const gr = await tx.goodsReceipt.findFirst({
          where: { id: input.recordedGoodsReceiptId, companyId: order.companyId,
            projectId: order.projectId, supplierId: order.supplierId,
            purchaseOrderId: order.id },
          select: {
            id: true, companyId: true, projectId: true, supplierId: true,
            purchaseOrderId: true, postedAt: true, reversedAt: true,
            approvalInstance: { select: { approvalState: true } },
            items: { where: { id: input.recordedGoodsReceiptItemId },
              select: { id: true, purchaseOrderLineId: true, materialId: true,
                uomId: true, quantity: true } },
            delivery: { select: {
              id: true, companyId: true, projectId: true, supplierId: true,
              purchaseOrderId: true, receivedAt: true, status: true, checkedAt: true,
              supersedesId: true,
              lines: { select: { purchaseOrderLineId: true, materialId: true,
                uomId: true, goodQuantity: true } },
            } },
          },
        });
        if (!poLine?.materialId || !gr || !gr.items[0] || !gr.delivery)
          return conflict('SUPPLIER_CASE_REPLACEMENT_SOURCE_NOT_FOUND');
        // A Project-linked document alone does not establish receiving provenance.
        // A live, non-superseded immutable receiving evidence row is required
        // for BOTH the damaged origin and the independently checked replacement.
        const originalEvidence = await tx.receivingDeliveryEvidence.findFirst({
          where: { companyId: order.companyId, deliveryId: origin.delivery.id,
            documentId: current.origin.evidenceDocumentId, purpose: 'CONDITION_PHOTO',
            replacement: { is: null },
            document: { companyId: order.companyId, isActive: true } },
          select: { checksum: true, document: { select: { checksum: true } } },
        });
        const replacementEvidence = await tx.receivingDeliveryEvidence.findFirst({
          where: { companyId: order.companyId, deliveryId: gr.delivery.id,
            documentId: input.evidenceDocumentId, purpose: 'CONDITION_PHOTO',
            replacement: { is: null },
            document: { companyId: order.companyId, isActive: true,
              links: { some: { entityType: 'RECEIVING_DELIVERY',
                entityId: gr.delivery.id } } } },
          select: { checksum: true, document: { select: { checksum: true } } },
        });
        if (!replacementEvidence ||
            !replacementEvidence.document.checksum ||
            replacementEvidence.document.checksum !== replacementEvidence.checksum)
          return conflict('SUPPLIER_CASE_REPLACEMENT_RECEIVING_EVIDENCE_REQUIRED');
        const item = gr.items[0];
        const deliveredLine = gr.delivery.lines.find(line =>
          line.purchaseOrderLineId === poLine.id &&
          line.materialId === poLine.materialId &&
          line.uomId === poLine.uomId &&
          line.goodQuantity.equals(item.quantity));
        if (!deliveredLine)
          return conflict('SUPPLIER_CASE_REPLACEMENT_DELIVERY_LINE_NOT_FOUND');
        try {
          const proof = verifySupplierReplacementProof({
            expected: {
              companyId: order.companyId, projectId: order.projectId,
              supplierId: order.supplierId, purchaseOrderId: order.id,
              purchaseOrderLineId: poLine.id, materialId: poLine.materialId,
              uomId: poLine.uomId, discrepancyKind: current.state?.discrepancyKind ?? '',
              claimAt: current.claim.claimedAt,
            },
            original: {
              id: origin.delivery.id, lineId: origin.id,
              companyId: origin.delivery.companyId, projectId: origin.delivery.projectId,
              supplierId: origin.delivery.supplierId,
              purchaseOrderId: origin.delivery.purchaseOrderId ?? '',
              purchaseOrderLineId: origin.purchaseOrderLineId,
              materialId: origin.materialId, uomId: origin.uomId,
              status: origin.delivery.status,
              receivedAt: origin.delivery.receivedAt.toISOString(),
              observedQuantity: origin.observedQuantity.toFixed(4),
              goodQuantity: origin.goodQuantity.toFixed(4),
              discrepancyDocumentLinked: Boolean(originalDocument && originalEvidence &&
                originalEvidence.document.checksum &&
                originalEvidence.document.checksum === originalEvidence.checksum),
            },
            receipt: {
              id: gr.id, itemId: item.id, companyId: gr.companyId,
              projectId: gr.projectId, supplierId: gr.supplierId,
              purchaseOrderId: gr.purchaseOrderId,
              postedAt: gr.postedAt?.toISOString() ?? null,
              reversedAt: gr.reversedAt?.toISOString() ?? null,
              approvalState: gr.approvalInstance?.approvalState ?? null,
              item: { purchaseOrderLineId: item.purchaseOrderLineId,
                materialId: item.materialId, uomId: item.uomId,
                quantity: item.quantity.toFixed(4) },
              delivery: {
                id: gr.delivery.id, companyId: gr.delivery.companyId,
                projectId: gr.delivery.projectId, supplierId: gr.delivery.supplierId,
                purchaseOrderId: gr.delivery.purchaseOrderId ?? '',
                receivedAt: gr.delivery.receivedAt.toISOString(),
                status: gr.delivery.status,
                checkedAt: gr.delivery.checkedAt?.toISOString() ?? null,
                supersedesId: gr.delivery.supersedesId,
                line: { purchaseOrderLineId: deliveredLine.purchaseOrderLineId,
                  materialId: deliveredLine.materialId, uomId: deliveredLine.uomId,
                  goodQuantity: deliveredLine.goodQuantity.toFixed(4) },
              },
            },
          });
          replacementTrace = {
            ...proof, discrepancyEventId: current.origin.eventId,
            claimEventId: current.claim.eventId,
          };
        } catch (error) {
          if (error instanceof SupplierReplacementProofError) return conflict(error.code);
          throw error;
        }
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
            previousEventId: current.eventId, state: { ...decision.case },
            actorUserId: context.auth.userId, evidenceDocumentId: doc.id,
            reportedOnly: true, note: decision.note,
            ...(input.action === 'ACKNOWLEDGE' ?
              { referencedPur07AcknowledgmentEventId: input.recordedPoAcknowledgmentEventId } : {}),
            ...(input.action === 'REPORT_DELAY' ?
              { newSupplierExpectedDate: input.newSupplierExpectedDate } : {}),
            ...(input.action === 'STORE_RECORD_RETURN_DISPATCH' ?
              { originalReceivingDeliveryLineId: input.originalReceivingDeliveryLineId,
                returnCustodyTrace } : {}),
            ...(input.action === 'STORE_RECORD_REPLACEMENT_RECEIPT' ?
              { recordedGoodsReceiptId: input.recordedGoodsReceiptId,
                recordedGoodsReceiptItemId: input.recordedGoodsReceiptItemId,
                originalReceivingDeliveryLineId: input.originalReceivingDeliveryLineId,
                replacementTrace } : {}),
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError &&
          (error.code === 'P2034' ||
           (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))) {
        return conflict('SUPPLIER_CASE_CONCURRENT_SOURCE_CHANGE');
      }
      throw error;
    }
  }
}
