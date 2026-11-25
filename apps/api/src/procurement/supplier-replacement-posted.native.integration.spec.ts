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
      })) as unknown as { id: string };
      assert.ok(typeof captured.id === 'string', 'Receiving capture must resolve to a delivery ID');
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
    // Independent tests, each targeting a specific live persistence and
    // authorization rejection before the successful final transition.
    const candidate = (more: Record<string, unknown> = {}) => input(
      'STORE_RECORD_REPLACEMENT_RECEIPT', 3, claim.expectedPreviousEventId, {
        recordedGoodsReceiptId: gr.id,
        recordedGoodsReceiptItemId: posted.items[0]!.id,
        originalReceivingDeliveryLineId: original.lineId,
        evidenceDocumentId: replacement.discrepancyDocumentId,
        ...more,
      });
    const expectCode = async (run: Promise<unknown>, code: string) => {
      await assert.rejects(run, (err: unknown) => {
        if (!err || typeof err !== 'object' || !('getResponse' in err) ||
            typeof err.getResponse !== 'function') return false;
        const body = err.getResponse();
        return !!body && typeof body === 'object' && 'code' in body && body.code === code;
      }, 'Expected '+code);
    };
    const supplierAuditBefore = await db.auditLog.count({
      where: { companyId: f.company.id, entityType: 'SUPPLIER_DELIVERY_CASE', entityId: f.po.id },
    });
    assert.equal(supplierAuditBefore, 3);
    // A syntactically valid but nonexistent origin must not reach a UUID
    // query with an empty string or append a supplier-case event.
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ originalReceivingDeliveryLineId: randomUUID() }) as never),
    'SUPPLIER_CASE_REPLACEMENT_SOURCE_NOT_FOUND');
    assert.equal(await db.auditLog.count({
      where: { companyId: f.company.id, entityType: 'SUPPLIER_DELIVERY_CASE', entityId: f.po.id },
    }), supplierAuditBefore);
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ recordedGoodsReceiptId: randomUUID() }) as never),
    'SUPPLIER_CASE_REPLACEMENT_SOURCE_NOT_FOUND');
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ recordedGoodsReceiptItemId: randomUUID() }) as never),
    'SUPPLIER_CASE_REPLACEMENT_SOURCE_NOT_FOUND');
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ evidenceDocumentId: randomUUID() }) as never),
    'SUPPLIER_CASE_SCOPED_DOCUMENT_EVIDENCE_REQUIRED');
    // Original photo is a valid Project document, but NOT replacement receiving
    // evidence; the old API incorrectly accepted it for unrelated GR linkage.
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ evidenceDocumentId: original.discrepancyDocumentId }) as never),
    'SUPPLIER_CASE_REPLACEMENT_RECEIVING_EVIDENCE_REQUIRED');
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ originalReceivingDeliveryLineId: replacement.lineId }) as never),
    'PUR14_REPLACEMENT_ORIGIN_OR_ITEM_MISMATCH');
    await expectCode(supplier.transition(ctx(store), f.po.id,
      candidate({ expectedVersion: 2, expectedPreviousEventId: review.expectedPreviousEventId }) as never),
    'SUPPLIER_CASE_STALE_EVENT');

    // Revocation MUST be rechecked inside the same serializable transaction,
    // not trusted from the already-resolved AuthenticatedUserContext.
    const storeView = await db.permission.findUniqueOrThrow({
      where: { permissionCode: 'inventory.receiving.view' },
    });
    await db.rolePermission.delete({
      where: { roleId_permissionId: {
        roleId: f.store.role.id, permissionId: storeView.id,
      } },
    });
    try {
      await expectCode(supplier.transition(ctx(store), f.po.id, candidate() as never),
        'SUPPLIER_CASE_BUSINESS_VIEW_DENIED');
    } finally {
      await db.rolePermission.create({
        data: { roleId: f.store.role.id, permissionId: storeView.id },
      });
    }
    await db.employee.update({
      where: { id: f.store.employee.id }, data: { isActive: false },
    });
    try {
      await expectCode(supplier.transition(ctx(store), f.po.id, candidate() as never),
        'SUPPLIER_CASE_LIVE_EMPLOYEE_REQUIRED');
    } finally {
      await db.employee.update({
        where: { id: f.store.employee.id }, data: { isActive: true },
      });
    }
    await db.userSession.update({
      where: { id: f.store.session.sessionId }, data: { revokedAt: new Date() },
    });
    try {
      await expectCode(supplier.transition(ctx(store), f.po.id, candidate() as never),
        'SUPPLIER_CASE_LIVE_EMPLOYEE_REQUIRED');
    } finally {
      await db.userSession.update({
        where: { id: f.store.session.sessionId }, data: { revokedAt: null },
      });
    }

    // The Store employee is a real Project member for the approved receipt.
    // Removing just that disposable membership must deny the cached auth.
    const membership = await db.projectMember.findFirstOrThrow({
      where: { employeeId: f.store.employee.id, projectId: f.project.id },
    });
    await db.projectMember.delete({ where: { id: membership.id } });
    try {
      await expectCode(supplier.transition(ctx(store), f.po.id, candidate() as never),
        'PROJECT_ACCESS_DENIED');
    } finally {
      await db.projectMember.create({ data: {
        projectId: f.project.id, employeeId: f.store.employee.id,
        projectRole: membership.projectRole,
      } });
    }

    // A distinct active Company/Store principal must not see this source PO.
    const foreignCompany = await db.company.create({
      data: { companyCode: 'PUR14-F-'+randomUUID().slice(0,8),
        companyName: 'Foreign replacement negative-test Company' },
    });
    const foreignEmployee = await db.employee.create({ data: {
      companyId: foreignCompany.id, employeeCode: 'PUR14-X-'+randomUUID().slice(0,8),
      employeeName: 'Foreign synthetic Store',
    } });
    const foreignUser = await db.user.create({ data: {
      companyId: foreignCompany.id, employeeId: foreignEmployee.id,
      email: 'pur14-foreign-'+randomUUID()+'@example.invalid',
      displayName: 'Foreign synthetic Store', passwordHash: 'not-a-real-login',
    } });
    const foreignRole = await db.role.create({ data: {
      companyId: foreignCompany.id, roleCode: 'STOREKEEPER',
      roleName: 'Foreign synthetic Storekeeper',
    } });
    const permissionDocs = await db.permission.findUniqueOrThrow({
      where: { permissionCode: 'documents.document.view' },
    });
    await db.rolePermission.createMany({ data: [storeView, permissionDocs].map(p => ({
      roleId: foreignRole.id, permissionId: p.id,
    })) });
    await db.userRole.create({ data: {
      companyId: foreignCompany.id, userId: foreignUser.id, roleId: foreignRole.id,
    } });
    const foreignSession = await f.sessions.create(foreignUser.id);
    const foreign = await f.sessions.resolve(foreignSession.sessionToken);
    assert.ok(foreign);
    await expectCode(supplier.transition(ctx(foreign), f.po.id, candidate() as never),
      'SUPPLIER_CASE_PO_NOT_FOUND');

    assert.equal(await db.auditLog.count({
      where: { companyId: f.company.id, entityType: 'SUPPLIER_DELIVERY_CASE', entityId: f.po.id },
    }), supplierAuditBefore, 'Rejected cases cannot add audit transitions');
    assert.equal(await db.stockTransaction.count({ where: { companyId: f.company.id } }), beforeStock,
      'Rejected supplier claims cannot change canonical stock');
    assert.equal(await db.supplierInvoice.count({ where: { companyId: f.company.id } }), beforeAP);
    assert.equal(await db.payment.count({ where: { companyId: f.company.id } }), beforePayments);
    const answer = await supplier.transition(ctx(store), f.po.id, input(
      'STORE_RECORD_REPLACEMENT_RECEIPT', 3, claim.expectedPreviousEventId, {
        recordedGoodsReceiptId: gr.id,
        recordedGoodsReceiptItemId: posted.items[0]!.id,
        originalReceivingDeliveryLineId: original.lineId,
        evidenceDocumentId: replacement.discrepancyDocumentId,
      }) as never);
    assert.equal(answer.case.stage, 'REPLACEMENT_RECEIPT_RECORDED');
    await expectCode(supplier.transition(ctx(store), f.po.id, candidate() as never),
      'SUPPLIER_CASE_STALE_EVENT');
    assert.equal(await db.auditLog.count({
      where: { companyId: f.company.id, entityType: 'SUPPLIER_DELIVERY_CASE', entityId: f.po.id },
    }), supplierAuditBefore+1, 'Exactly one accepted final supplier event');
    const readback = await supplier.read(store, f.po.id);
    assert.equal((readback.replacementTrace as { quantity: string }).quantity, '1.0000');
    assert.equal((readback.replacementTrace as { originalDeliveryId: string }).originalDeliveryId, original.id);
    assert.equal((readback.replacementTrace as { replacementGoodsReceiptId: string }).replacementGoodsReceiptId, gr.id);
    assert.equal(readback.replacementReceiptLiveStatus, 'POSTED');
    assert.equal(await db.stockTransaction.count({ where: { companyId: f.company.id } }), beforeStock);
    assert.equal(await db.supplierInvoice.count({ where: { companyId: f.company.id } }), beforeAP);
    assert.equal(await db.payment.count({ where: { companyId: f.company.id } }), beforePayments);

    // Real authorized canonical reversal after supplier-case event: keep the
    // immutable supplier claim, but stop displaying its GR as live received stock.
    const reversed = await goods.reverse(ctx(pm), gr.id, randomUUID(),
      'Disposable canonical reversal after supplier replacement was evidenced');
    assert.ok(reversed.reversedAt, 'Canonical receipt reversal should be complete');
    const afterReversal = await supplier.read(store, f.po.id);
    assert.equal(afterReversal.case?.stage, 'REPLACEMENT_RECEIPT_RECORDED',
      'Audit evidence must not be erased by a later canonical reversal');
    assert.equal(afterReversal.expectedPreviousEventId, readback.expectedPreviousEventId);
    assert.deepEqual(afterReversal.replacementTrace, readback.replacementTrace);
    assert.equal(afterReversal.replacementReceiptLiveStatus, 'REVERSED',
      'Reversed canonical GR must never be shown as still posted');
    assert.equal(await db.auditLog.count({
      where: { companyId: f.company.id, entityType: 'SUPPLIER_DELIVERY_CASE', entityId: f.po.id },
    }), supplierAuditBefore + 1, 'Reversal is not an additional supplier-case event');
    assert.equal(await db.stockTransaction.count({ where: { companyId: f.company.id } }),
      beforeStock + 1, 'Only the canonical GR reversal creates its stock reversal entry');

    // The PostgreSQL canonical GR source trigger refuses an edit that would
    // violate the approved PO material source. We must TEST the fail-closed
    // rejection rather than bypassing the trigger to fake a mismatch.
    await assert.rejects(db.goodsReceiptItem.update({
      where: { id: posted.items[0]!.id },
      data: { quantity: new Prisma.Decimal('2.0000') },
    }), /Goods Receipt item must match its Draft approved-PO material source/);
    assert.deepEqual((await supplier.read(store, f.po.id)).replacementTrace,
      readback.replacementTrace, 'Rejected GR source edit must preserve historical evidence');
    assert.equal((await supplier.read(store, f.po.id)).replacementReceiptLiveStatus, 'REVERSED');
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
