import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { transferCustodyFixture } from './transfer-custody-test-fixture';

test('DEC-046 transfer actual HTTP: dispatch, partial destination receipt, assignment, evidence and unchanged legacy path', async t => {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost','127.0.0.1'].includes(target.hostname));
  assert.match(target.pathname, /^\/(?:construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
  const oldStorage = process.env.STORAGE_ROOT, storage = await mkdtemp(join(tmpdir(), 'transfer-http-'));
  process.env.STORAGE_ROOT = storage;
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter()); await app.listen(0, '127.0.0.1');
  try {
    const f = await transferCustodyFixture(db, app), base = await app.getUrl() + '/api/v1';
    type Actor = typeof f.store;
    async function call(actor: Actor, path: string, expected = 200, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<any> {
      const response = await fetch(base + path, { method, headers: { Cookie: 'erp_session=' + actor.session.sessionToken, 'x-csrf-token': actor.session.csrfToken, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const result: any = await response.json(); assert.equal(response.status, expected, path + ' ' + JSON.stringify(result)); return result.data;
    }
    const quantity = async (warehouseId: string) => (await db.stockTransaction.aggregate({ where: { companyId: f.company.id, warehouseId, materialId: f.material.id }, _sum: { quantity: true } }))._sum.quantity?.toFixed(4) ?? '0.0000';
    const ordinary = '/inventory/stock-transfers', root = '/inventory/transfer-custody';
    let legacy: any;
    await t.test('legacy approval retains exact paired posting and reversal', async () => {
      legacy = await call(f.store, ordinary, 201, { ...f.transferInput, lines: [{ ...f.transferInput.lines[0], quantity: '2.0000' }] });
      await call(f.store, ordinary + '/' + legacy.id + '/submit', 201, { workflowCode: f.workflow.workflowCode });
      await call(f.pm, ordinary + '/' + legacy.id + '/approve', 201, { postKey: randomUUID() });
      assert.equal(await quantity(f.warehouse.id), '8.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '2.0000');
      await call(f.store, ordinary + '/' + legacy.id + '/reverse', 201, { reversalKey: randomUUID(), reason: 'Legacy exact reversal' });
      assert.equal(await quantity(f.warehouse.id), '10.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '0.0000');
    });
    const originalLegacy = await db.stockTransfer.findUniqueOrThrow({ where: { id: legacy.id }, include: { stockTransactions: { orderBy: { id: 'asc' } } } });
    await call(f.pm, root + '/projects/' + f.project.id + '/enable', 201, { requestKey: randomUUID(), reason: 'Explicit isolated synthetic transfer policy' });
    const transfer = await call(f.store, ordinary, 201, f.transferInput), id = transfer.id;
    assert.ok(transfer.custody); assert.equal(transfer.custody.version, 1);
    const destination = root + '/projects/' + f.unassigned.id + '/transfers/' + id;
    const detail = () => call(f.jai, destination);
    await t.test('independent approval has no stock effect, destination projection reveals no origin facts', async () => {
      await call(f.store, ordinary + '/' + id + '/submit', 201, { workflowCode: f.workflow.workflowCode });
      await call(f.pm, ordinary + '/' + id + '/approve', 201, { postKey: randomUUID() });
      assert.equal(await quantity(f.warehouse.id), '10.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '0.0000');
      const projection = await detail(); assert.equal(projection.dispatchedAt, null);
      assert.ok(!JSON.stringify(projection).includes(f.project.id)); assert.ok(!JSON.stringify(projection).includes('commercial'));
      await call(f.jai, ordinary + '/' + id, 403);
    });
    const dispatch = { requestKey: randomUUID(), expectedVersion: (await detail()).version, reason: 'Actual origin dispatch of five units' };
    await t.test('dispatch consumes only origin, same-key retry is stable and changed replay is denied', async () => {
      const first = await call(f.store, root + '/transfers/' + id + '/dispatch', 201, dispatch);
      assert.deepEqual(await call(f.store, root + '/transfers/' + id + '/dispatch', 201, dispatch), first);
      await call(f.store, root + '/transfers/' + id + '/dispatch', 409, { ...dispatch, reason: 'Changed request body' });
      assert.equal(await quantity(f.warehouse.id), '5.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '0.0000');
    });
    let receiptId = '', evidenceId = '';
    await t.test('receiver evidence uses canonical upload and both aliases respect destination scope', async () => {
      await call(f.viewer, destination + '/receipts', 403, { requestKey: randomUUID(), expectedVersion: (await detail()).version, reason: 'Not explicitly assigned' });
      const prepared = await call(f.jai, destination + '/receipts', 201, { requestKey: randomUUID(), expectedVersion: (await detail()).version, reason: 'Actual delivery received' });
      receiptId = prepared.receiptId;
      const data = new FormData(); data.set('documentTypeId', f.documentType.id); data.set('file', new Blob([Buffer.from('%PDF-1.4 Synthetic signed transfer receipt')], { type: 'application/pdf' }), 'receipt.pdf');
      const upload = await fetch(base + '/documents/projects/' + f.unassigned.id + '/targets/TRANSFER_RECEIPT/' + receiptId, { method: 'POST', headers: { Cookie: 'erp_session=' + f.jai.session.sessionToken, 'x-csrf-token': f.jai.session.csrfToken }, body: data });
      const body: any = await upload.json(); assert.equal(upload.status, 201, JSON.stringify(body)); evidenceId = body.data.id;
      await call(f.outsider, '/documents/projects/' + f.unassigned.id + '/' + evidenceId + '/download', 403);
      const download = await fetch(base + '/documents/projects/' + f.unassigned.id + '/' + evidenceId + '/download', { headers: { Cookie: 'erp_session=' + f.jai.session.sessionToken } });
      assert.equal(download.status, 200); assert.equal(await download.text(), '%PDF-1.4 Synthetic signed transfer receipt');
    });
    const receivedBody = { requestKey: randomUUID(), expectedVersion: (await detail()).version, reason: 'Four accepted; one remains in transit', documentId: evidenceId, lines: [{ transferItemId: transfer.items[0].id, quantity: '4.0000', note: 'Actual accepted quantity' }] };
    await t.test('partial receipt credits actual quantity only, overreceipt and partial reversal fail closed', async () => {
      const first = await call(f.jai, destination + '/receipts/' + receiptId + '/receive', 201, receivedBody);
      assert.deepEqual(await call(f.jai, destination + '/receipts/' + receiptId + '/receive', 201, receivedBody), first);
      await call(f.jai, destination + '/receipts/' + receiptId + '/receive', 409, { ...receivedBody, lines: [{ ...receivedBody.lines[0], quantity: '5.0000' }] });
      assert.equal(await quantity(f.destinationWarehouse.id), '4.0000'); assert.equal((await detail()).lines[0].outstanding, '1.0000');
      await call(f.store, ordinary + '/' + id + '/reverse', 409, { reversalKey: randomUUID(), reason: 'Must not return unreceived stock' });
      await assert.rejects(db.transferReceiptLine.updateMany({ where: { receiptId }, data: { quantity: '5' } }), /TRANSFER_HISTORY_IMMUTABLE/);
      await assert.rejects(db.transferReceiptLine.create({ data: { receiptId, transferItemId: transfer.items[0].id, quantity: '0.5', note: 'Must not extend a committed physical acknowledgment' } }), /TRANSFER_OVERRECEIPT_OR_DIMENSION_INVALID/);
    });
    await t.test('assigned Employee is explicit and current membership, grant and session remain mandatory', async () => {
      const assigned = await call(f.pm, destination + '/assign', 201, { requestKey: randomUUID(), expectedVersion: (await detail()).version, employeeId: f.viewer.employee.id, reason: 'Destination Store unavailable; Khaimook assigns active Employee' });
      assert.ok(assigned.version);
      const prepared = await call(f.viewer, destination + '/receipts', 201, { requestKey: randomUUID(), expectedVersion: assigned.version, reason: 'Assigned Employee received remainder' });
      await db.projectMember.updateMany({ where: { employeeId: f.viewer.employee.id, projectId: f.unassigned.id }, data: { isActive: false } });
      await call(f.viewer, destination, 403);
      await db.projectMember.updateMany({ where: { employeeId: f.viewer.employee.id, projectId: f.unassigned.id }, data: { isActive: true } });
      assert.ok(prepared.receiptId);
      const data = new FormData(); data.set('documentTypeId', f.documentType.id); data.set('file', new Blob([Buffer.from('%PDF-1.4 Assigned receiver remainder')], { type: 'application/pdf' }), 'remainder.pdf');
      const upload = await fetch(base + '/documents/projects/' + f.unassigned.id + '/targets/TRANSFER_RECEIPT/' + prepared.receiptId, { method: 'POST', headers: { Cookie: 'erp_session=' + f.viewer.session.sessionToken, 'x-csrf-token': f.viewer.session.csrfToken }, body: data });
      const document: any = await upload.json(); assert.equal(upload.status, 201, JSON.stringify(document));
      const remainder = { requestKey: randomUUID(), expectedVersion: prepared.version, reason: 'Actual remaining one unit accepted', documentId: document.data.id, lines: [{ transferItemId: transfer.items[0].id, quantity: '1.0000', note: 'Received remaining quantity' }] };
      await call(f.viewer, destination + '/receipts/' + prepared.receiptId + '/receive', 409, { ...remainder, requestKey: randomUUID(), lines: [{ ...remainder.lines[0], quantity: '2.0000' }] });
      const results = await Promise.all([call(f.viewer, destination + '/receipts/' + prepared.receiptId + '/receive', 201, remainder), call(f.viewer, destination + '/receipts/' + prepared.receiptId + '/receive', 201, remainder)]);
      assert.deepEqual(results[0], results[1]); assert.equal((await detail()).lines[0].outstanding, '0.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '5.0000');
      await call(f.store, ordinary + '/' + id + '/reverse', 201, { reversalKey: randomUUID(), reason: 'Complete physical transfer correction with exact canonical reversal' });
      assert.equal(await quantity(f.warehouse.id), '10.0000'); assert.equal(await quantity(f.destinationWarehouse.id), '0.0000');
      await f.sessions.revoke(f.viewer.auth.sessionId);
      await call(f.viewer, destination, 401);
    });
    await t.test('stock consumed after approval does not create a reservation promise or origin overspend', async () => {
      const large = await call(f.store, ordinary, 201, { ...f.transferInput, lines: [{ ...f.transferInput.lines[0], quantity: '20.0000' }] });
      await call(f.store, ordinary + '/' + large.id + '/submit', 201, { workflowCode: f.workflow.workflowCode });
      const approval = { postKey: randomUUID(), comment: 'Approval is not a stock reservation' };
      const first = await call(f.pm, ordinary + '/' + large.id + '/approve', 201, approval);
      assert.deepEqual(await call(f.pm, ordinary + '/' + large.id + '/approve', 201, approval), first);
      await call(f.pm, ordinary + '/' + large.id + '/approve', 409, { ...approval, comment: 'Changed replay' });
      const current = await call(f.store, ordinary + '/' + large.id);
      await call(f.store, root + '/transfers/' + large.id + '/dispatch', 409, { requestKey: randomUUID(), expectedVersion: current.custody.version, reason: 'Insufficient origin stock must fail closed' });
      assert.equal(await db.transferDispatch.count({ where: { transferId: large.id } }), 0);
      assert.equal(await quantity(f.warehouse.id), '10.0000');
    });
    assert.deepEqual(await db.stockTransfer.findUniqueOrThrow({ where: { id: legacy.id }, include: { stockTransactions: { orderBy: { id: 'asc' } } } }), originalLegacy);
  } finally {
    await app.close(); await db.$disconnect(); process.env.STORAGE_ROOT = oldStorage; await rm(storage, { recursive: true, force: true });
  }
});
