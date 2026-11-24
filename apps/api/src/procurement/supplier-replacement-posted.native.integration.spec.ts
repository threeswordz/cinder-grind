import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ReceivingService } from '../inventory/receiving.service';
import { GoodsReceiptService } from '../inventory/goods-receipt.service';
import { receivingFixture } from '../inventory/receiving-test-fixture';
import { DocumentTargetsService } from '../documents/document-targets.service';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';

// One genuinely posted, separately checked GR in a fresh disposable Company.
// No retained grants, CI full-suite replay or Production. All supplier case
// events remain nonposting, with native actor/session authorization.
test('PUR14 native positive: source damaged line -> Store/PM/Jai -> later approved posted replacement item', async () => {
  const db = new PrismaService();
  const storage = await mkdtemp(join(tmpdir(), 'pur14-posted-native-'));
  const priorStorage = process.env.STORAGE_ROOT, priorNodeEnv = process.env.NODE_ENV;
  process.env.STORAGE_ROOT = join(storage, 'documents');
  process.env.NODE_ENV = 'test';
  await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false });
  await app.init();
  try {
    const f = await receivingFixture(db);
    // Synthetic Company only; convert fixture display roles into real business
    // role-code equivalents without modifying any retained Company/Project.
    await db.role.update({ where: { id: f.store.role.id }, data: { roleCode: 'STOREKEEPER' } });
    await db.role.update({ where: { id: f.pm.role.id }, data: { roleCode: 'PROJECT_MANAGER' } });
    await db.role.update({ where: { id: f.buyer.role.id }, data: { roleCode: 'PROCUREMENT_OFFICER' } });
    const documentView = await db.permission.findUniqueOrThrow({
      where: { permissionCode: 'documents.document.view' },
    });
    await db.rolePermission.create({ data: {
      roleId: f.buyer.role.id, permissionId: documentView.id,
    } });
    const store = await f.sessions.resolve(f.store.session.sessionToken);
    const pm = await f.sessions.resolve(f.pm.session.sessionToken);
    const jai = await f.sessions.resolve(f.buyer.session.sessionToken);
    assert.ok(store && pm && jai);
    const receiving = app.get(ReceivingService);
    const goods = app.get(GoodsReceiptService);
    const targets = app.get(DocumentTargetsService);
    const supplier = app.get(SupplierDeliveryCaseService);
    const ctx = (auth: NonNullable<typeof store>) => ({ auth });
    const command = (version: number, extra: Record<string, unknown> = {}) => ({
      requestKey: randomUUID(), expectedVersion: version, reason: 'Supplier actual delivery evidence', ...extra,
    });
    await receiving.enable(ctx(f.config.auth), f.project.id, {
      requestKey: randomUUID(), reason: 'Disposable test only',
    });
    const poLine = f.po.lines[0]!;
    const recordDelivery = async (observed: string, good: string, receivedAt: string) => {
      const captured = await receiving.capture(ctx(store), f.input({
        receivedAt,
        reason: 'Supplier physical delivery with signed documents',
        lines: [{
          materialId: f.material.id, uomId: f.uom.id,
          observedQuantity: observed, goodQuantity: good,
          condition: observed === good ? 'NORMAL' : 'DAMAGED',
          note: 'Actual condition on arrival',
        }],
      }));
      let detail = await receiving.get(store, captured.id);
      const lineId = detail.lines[0]!.id;
      await receiving.link(ctx(store), captured.id, command(detail.version, {
        purchaseOrderId: f.po.id, lines: [{ id: lineId, purchaseOrderLineId: poLine.id }],
      }));
      let discrepancyDocumentId = '';
      for (const purpose of ['DELIVERY_NOTE', 'RECEIVER_SIGNATURE', 'CONDITION_PHOTO']) {
        const bytes = Buffer.from('%PDF-1.4\nSigned supplier '+purpose+' '+randomUUID()+'\n');
        const uploaded = await targets.upload(
          ctx(store), f.project.id, 'RECEIVING_DELIVERY', captured.id, f.documentType.id,
          { originalname: purpose+'.pdf', mimetype: 'application/pdf', size: bytes.length, buffer: bytes },
        );
        if (purpose === 'CONDITION_PHOTO') discrepancyDocumentId = uploaded.id;
        detail = await receiving.get(store, captured.id);
        await receiving.attach(ctx(store), captured.id, command(detail.version, {
          documentId: uploaded.id, purpose, signedEvidenceConfirmed: purpose === 'RECEIVER_SIGNATURE',
        }));
      }
      detail = await receiving.get(store, captured.id);
      await receiving.check(ctx(f.jai.auth), captured.id, command(detail.version, { decision: 'ACCEPT' }));
      // Existing receiving rules require an independent check; the Project
      // Jai checks independently of Store under existing receiving permissions.
      detail = await receiving.get(store, captured.id);
      assert.equal(detail.status, 'CHECKED');
      return { id: captured.id, lineId, discrepancyDocumentId, detail };
    };
    const original = await recordDelivery('4.0000', '3.0000', new Date(Date.now()-3600000).toISOString());
    const input = (action: string, version: number, previous: string | null, more: Record<string, unknown> = {}) => ({
      action, expectedVersion: version, expectedPreviousEventId: previous,
      evidenceDocumentId: original.discrepancyDocumentId,
      note: 'Independent supplier physical evidence', ...more,
    });
    const discrepancy = await supplier.transition(ctx(store), f.po.id,
      input('REPORT_DISCREPANCY', 0, null, { discrepancyKind: 'DAMAGED' }) as never);
    const review = await supplier.transition(ctx(pm), f.po.id,
      input('PM_REVIEW_DISCREPANCY', 1, discrepancy.expectedPreviousEventId,
        { pmDecision: 'REQUEST_REPLACEMENT' }) as never);
    const claim = await supplier.transition(ctx(jai), f.po.id,
      input('JAI_RECORD_CLAIM', 2, review.expectedPreviousEventId) as never);
    // A genuinely NEW delivery after Jai's claim, not a correction or the
    // originally damaged inbound delivery.
    await new Promise<void>(resolve => setTimeout(resolve, 30));
    const replacement = await recordDelivery('1.0000', '1.0000', new Date().toISOString());
    const gr = await goods.create(ctx(store), {
      projectId: f.project.id, purchaseOrderId: f.po.id,
      warehouseId: f.warehouse.id, deliveryId: replacement.id,
      requestKey: randomUUID(), expectedDeliveryVersion: replacement.detail.version,
      lines: [{ purchaseOrderLineId: poLine.id, quantity: new Prisma.Decimal('1.0000') }],
    });
    await goods.submit(ctx(store), gr.id, f.receiptWorkflow.workflowCode);
    await goods.approve(ctx(pm), gr.id, randomUUID());
    const posted = await db.goodsReceipt.findUniqueOrThrow({
      where: { id: gr.id }, include: { items: true, approvalInstance: true },
    });
    assert.ok(posted.postedAt && !posted.reversedAt);
    assert.equal(posted.approvalInstance?.approvalState, 'APPROVED');
    const beforeStock = await db.stockTransaction.count({ where: { companyId: f.company.id } });
    const beforeAP = await db.supplierInvoice.count({ where: { companyId: f.company.id } });
    const beforePayments = await db.payment.count({ where: { companyId: f.company.id } });
    const answer = await supplier.transition(ctx(store), f.po.id, input(
      'STORE_RECORD_REPLACEMENT_RECEIPT', 3, claim.expectedPreviousEventId, {
        recordedGoodsReceiptId: gr.id,
        recordedGoodsReceiptItemId: posted.items[0]!.id,
        originalReceivingDeliveryLineId: original.lineId,
        evidenceDocumentId: replacement.discrepancyDocumentId,
      }) as never);
    assert.equal(answer.case.stage, 'REPLACEMENT_RECEIPT_RECORDED');
    const readback = await supplier.read(store, f.po.id);
    assert.equal((readback.replacementTrace as { quantity: string }).quantity, '1.0000');
    assert.equal((readback.replacementTrace as { originalDeliveryId: string }).originalDeliveryId, original.id);
    assert.equal((readback.replacementTrace as { replacementGoodsReceiptId: string }).replacementGoodsReceiptId, gr.id);
    assert.equal(await db.stockTransaction.count({ where: { companyId: f.company.id } }), beforeStock);
    assert.equal(await db.supplierInvoice.count({ where: { companyId: f.company.id } }), beforeAP);
    assert.equal(await db.payment.count({ where: { companyId: f.company.id } }), beforePayments);
    await db.userSession.update({ where: { id: f.store.session.sessionId }, data: { revokedAt: new Date() } });
    await assert.rejects(supplier.read(store, f.po.id));
  } finally {
    await app.close();
    await db.$disconnect();
    if (priorStorage === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = priorStorage;
    if (priorNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorNodeEnv;
    await rm(storage, { recursive: true, force: true });
  }
});
