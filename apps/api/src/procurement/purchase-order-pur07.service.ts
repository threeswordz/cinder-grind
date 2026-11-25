import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  approvedPoPdfFilename,
  approvedPoPdfSha256,
  PoPdfUnsupportedTextError,
  renderApprovedPoAsciiPdf,
} from './purchase-order-pdf';
import { renderApprovedPoUnicodePdf } from './purchase-order-unicode-pdf';
import { PurchaseOrderService } from './purchase-order.service';

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };

export type PoExternalEventInput = {
  kind: 'DISPATCH' | 'ACKNOWLEDGMENT';
  channel: 'EMAIL' | 'LINE';
  recipient: string;
  evidenceReference: string;
  evidenceDocumentId?: string | null;
  acknowledgesEventId?: string | null;
};

// PUR07 only: immutable evidence of a USER-REPORTED external action. The ERP
// never sends email/LINE or asserts external receipt merely from this record.
@Injectable()
export class PurchaseOrderPur07Service {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly orders: PurchaseOrderService,
  ) {}

  private purchasingOnly(auth: AuthenticatedUserContext): void {
    if (!auth.roleCodes.includes('PROCUREMENT_OFFICER') ||
        !auth.permissions.includes('procurement.po.edit')) {
      throw new ForbiddenException({ code: 'PO_DISPATCH_PURCHASING_ONLY' });
    }
  }

  async approvedPdf(auth: AuthenticatedUserContext, orderId: string) {
    // Existing scoped getOrder is reused; do not invent a looser PDF read path.
    const order = await this.orders.getOrder(auth, orderId);
    if (order.lifecycleState !== 'APPROVED' || order.cancelledAt) {
      throw new ConflictException({
        code: 'PO_PDF_APPROVED_REVISION_ONLY',
        detail: 'Only an active, independently approved Purchase Order revision can be exported.',
      });
    }
    // The browser's approved Print/Save-as-PDF path already requires a
    // completed independent approval. Apply the same source contract to the
    // server PDF download; never render a supplier-facing "APPROVED" placeholder
    // when the real approval completion timestamp is missing.
    if (order.approvalInstance?.approvalState !== 'APPROVED' ||
        !order.approvalInstance.completedAt) {
      throw new ConflictException({
        code: 'PO_PDF_INDEPENDENT_APPROVAL_EVIDENCE_REQUIRED',
        detail: 'Supplier-facing PDF requires recorded completed independent PO approval.',
      });
    }
    if (order.currencyCode !== 'THB') {
      throw new ConflictException({
        code: 'PO_PDF_CURRENCY_UNVERIFIED',
        detail: 'This supplier-facing Purchase Order export requires verified THB.',
      });
    }
    if (!order.lines.length) {
      throw new ConflictException({ code: 'PO_PDF_LINES_MISSING' });
    }
    const legalNames = new Set(
      order.lines.map(line => line.quotationAward?.supplierNameSnapshot?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    if (legalNames.size !== 1 || order.lines.some(line => !line.quotationAward?.supplierNameSnapshot?.trim())) {
      throw new ConflictException({
        code: 'PO_PDF_SUPPLIER_LEGAL_SNAPSHOT_UNVERIFIED',
        detail: 'A supplier legal-name snapshot must be consistent across all approved PO lines.',
      });
    }
    const fileName = approvedPoPdfFilename(
      order.poNumber, order.displayNumber, order.revisionNo,
    );
    const subtotal = order.lines.reduce(
      (sum, line) => sum.plus(line.amount), new Prisma.Decimal(0),
    );
    const subtotalText = subtotal.toFixed(2);
    const discount = order.discountAmount;
    const freight = order.freightAmount;
    const charges = order.additionalChargeAmount;
    const vatRate = order.vatRatePercent;
    const net = discount !== null && freight !== null && charges !== null
      ? subtotal.minus(discount).plus(freight).plus(charges)
      : null;
    const total = net !== null && vatRate !== null
      ? net.mul(new Prisma.Decimal(1).plus(vatRate.div(100)))
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2)
      : null;
    if (net?.isNegative()) {
      throw new ConflictException({ code: 'PO_PDF_NEGATIVE_NET_TOTAL' });
    }
    const pdfInput = {
        number: order.displayNumber ?? order.poNumber,
        revision: order.revisionNo,
        company: order.companyId,
        project: order.project.projectCode + ' - ' + order.project.projectName,
        supplierLegalName: [...legalNames][0]!,
        approvedAt: order.approvalInstance.completedAt.toISOString(),
        currency: order.currencyCode,
        lines: order.lines.map(line => ({
          number: line.lineNo,
          description: line.description,
          quantity: line.quantity.toString(),
          uom: line.uomCodeSnapshot,
          unitPrice: line.unitPrice.toFixed(2),
          amount: line.amount.toFixed(2),
        })),
        deliveryLocation: order.deliveryLocation,
        deliveryTerms: order.deliveryTerms,
        paymentTerms: order.paymentTerms,
        creditTerms: order.creditTerms,
        subtotal: subtotalText,
        discount: discount?.toFixed(2) ?? null,
        freight: freight?.toFixed(2) ?? null,
        charges: charges?.toFixed(2) ?? null,
        vatPercent: vatRate?.toFixed(2) ?? null,
        total,
      };
    let bytes: Buffer;
    try {
      // Keep the established no-dependency deterministic ASCII PDF route.
      bytes = renderApprovedPoAsciiPdf(pdfInput);
    } catch (error) {
      if (!(error instanceof PoPdfUnsupportedTextError)) throw error;
      // Actual Thai/Unicode content is rendered through a sandboxed, local
      // headless Chromium PDF engine, preserving searchable legal names and
      // source lines. Production host must supply Chromium and Noto Sans Thai;
      // absence is a fail-closed error, never a fabricated ASCII document.
      try {
        bytes = await renderApprovedPoUnicodePdf(pdfInput);
      } catch (failure) {
        // Expose only a bounded internal failure class to operational logs;
        // never supplier text, document content, paths, stack or raw CDP data.
        const reason = failure instanceof Error &&
          /^PO_PDF_UNICODE_[A-Z_]+$/.test(failure.message)
          ? failure.message : 'PO_PDF_UNICODE_UNKNOWN_FAILURE';
        Logger.warn(reason, 'PurchaseOrderPur07Service');
        throw new UnprocessableEntityException({
          code: 'PO_PDF_UNICODE_RENDERER_UNAVAILABLE',
          detail: 'Thai/Unicode approved PO could not be rendered with the installed sandboxed Chromium and Thai fonts. No partial PDF was exported. Configure and verify the local renderer before release.',
        });
      }
    }
    return { bytes, fileName, sha256: approvedPoPdfSha256(bytes) };
  }

  async events(auth: AuthenticatedUserContext, orderId: string) {
    const order = await this.orders.getOrder(auth, orderId);
    return this.prisma.poDispatchEvent.findMany({
      where: { companyId: auth.companyId, projectId: order.projectId, purchaseOrderId: order.id },
      orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }],
      // PO viewing alone is NOT documents.document.view: never leak an
      // attached Project Document's filename or checksum through this list.
      include: {
        actor: { select: { id: true, displayName: true } },
      },
    });
  }

  async record(
    context: AuditContext,
    orderId: string,
    input: PoExternalEventInput,
  ) {
    this.purchasingOnly(context.auth);
    // A scoped Project document UUID does not itself grant the right to link
    // that document to supplier communications. Preserve optional text-only
    // external evidence for Jai without expanding any retained role grant.
    if (input.evidenceDocumentId && !context.auth.permissions.includes('documents.document.view')) {
      throw new ForbiddenException({ code: 'PO_DISPATCH_DOCUMENT_VIEW_REQUIRED' });
    }
    const order = await this.orders.getOrder(context.auth, orderId);
    const eventType = input.kind;
    if (eventType !== 'DISPATCH' && eventType !== 'ACKNOWLEDGMENT') {
      throw new UnprocessableEntityException({ code: 'PO_DISPATCH_KIND_INVALID' });
    }
    if (input.channel !== 'EMAIL' && input.channel !== 'LINE') {
      throw new UnprocessableEntityException({ code: 'PO_DISPATCH_CHANNEL_INVALID' });
    }
    const reference = input.evidenceReference.trim();
    const recipient = input.recipient.trim();
    if (recipient.length < 3 || recipient.length > 320 ||
        reference.length < 3 || reference.length > 1200) {
      throw new UnprocessableEntityException({ code: 'PO_DISPATCH_EVIDENCE_REQUIRED' });
    }
    if (eventType === 'DISPATCH' &&
        (order.lifecycleState !== 'APPROVED' || order.cancelledAt)) {
      throw new ConflictException({ code: 'PO_DISPATCH_APPROVED_REVISION_ONLY' });
    }
    if (eventType === 'DISPATCH' && input.acknowledgesEventId) {
      throw new UnprocessableEntityException({ code: 'PO_DISPATCH_ACK_REFERENCE_INVALID' });
    }
    if (eventType === 'ACKNOWLEDGMENT' && !input.acknowledgesEventId) {
      throw new UnprocessableEntityException({ code: 'PO_DISPATCH_ACK_REFERENCE_REQUIRED' });
    }

    const pdfFileName = approvedPoPdfFilename(
      order.poNumber, order.displayNumber, order.revisionNo,
    );
    // The requested file was not sent by ERP. A filename is a deterministic
    // label, not evidence a PDF exists or has been delivered.
    return this.prisma.$transaction(async tx => {
      await this.access.assertAccess(context.auth, order.projectId, tx);
      const current = await tx.purchaseOrder.findFirst({
        where: { id: order.id, companyId: context.auth.companyId, projectId: order.projectId },
        include: { approvalInstance: { select: { approvalState: true } } },
      });
      if (!current) throw new NotFoundException({ code: 'PURCHASE_ORDER_NOT_FOUND' });
      if (eventType === 'DISPATCH' &&
          (current.cancelledAt || current.approvalInstance?.approvalState !== 'APPROVED')) {
        throw new ConflictException({ code: 'PO_DISPATCH_APPROVED_REVISION_ONLY' });
      }
      if (eventType === 'ACKNOWLEDGMENT') {
        const prior = await tx.poDispatchEvent.findFirst({
          where: {
            id: input.acknowledgesEventId!,
            kind: 'DISPATCH',
            companyId: context.auth.companyId,
            projectId: order.projectId,
            purchaseOrderId: order.id,
          },
          select: { id: true },
        });
        if (!prior) {
          throw new ConflictException({ code: 'PO_DISPATCH_ACK_REFERENCE_INVALID' });
        }
      }
      const evidenceDocumentId = input.evidenceDocumentId ?? null;
      if (evidenceDocumentId) {
        const document = await tx.document.findFirst({
          where: {
            id: evidenceDocumentId,
            companyId: context.auth.companyId,
            isActive: true,
            links: { some: { entityType: 'PROJECT', entityId: order.projectId } },
          },
          select: { id: true },
        });
        if (!document) {
          throw new ConflictException({ code: 'PO_DISPATCH_EVIDENCE_DOCUMENT_OUT_OF_SCOPE' });
        }
      }
      const saved = await tx.poDispatchEvent.create({
        data: {
          companyId: context.auth.companyId,
          projectId: order.projectId,
          purchaseOrderId: order.id,
          kind: eventType,
          channel: input.channel,
          recipient,
          evidenceReference: reference,
          evidenceDocumentId,
          pdfFileName: eventType === 'DISPATCH' ? pdfFileName : null,
          pdfSha256: null, // Do not fabricate a hash for externally sent files.
          acknowledgesEventId: eventType === 'ACKNOWLEDGMENT'
            ? input.acknowledgesEventId ?? null
            : null,
          recordedByUserId: context.auth.userId,
        },
      });
      await this.audit.record({
        ...context,
        entityType: 'PURCHASE_ORDER',
        entityId: order.id,
        action: eventType === 'DISPATCH' ? 'EXTERNAL_SEND_REPORTED' : 'EXTERNAL_ACK_REPORTED',
        newValues: {
          eventId: saved.id, poNumber: order.poNumber, revisionNo: order.revisionNo,
          channel: saved.channel, recipient: saved.recipient,
          evidenceReference: saved.evidenceReference,
          evidenceDocumentId: saved.evidenceDocumentId,
          acknowledgesEventId: saved.acknowledgesEventId,
          reportedOnly: true,
        },
      }, tx);
      return saved;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }
}
