import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { materialPlanIssueFixture } from './material-plan-issue-test-fixture';
import { securityHeadersMiddleware } from '../common/security-headers';
import { ProblemDetailsFilter } from '../common/problem-details.filter';

// One actual PostgreSQL-backed, cookie/CSRF-authenticated cross-module journey.
// Uses exclusively disposable synthetic fixtures. This is technical regression,
// NOT human UAT, retained MKE/TCJ role proof or prototype/GL gate certification.
test('P0 integrated material journey: request -> approved plan issue -> signed receipt -> stock and reports', async () => {
  const previousStorage = process.env.STORAGE_ROOT;
  const storage = await mkdtemp(path.join(tmpdir(), 'erp-integrated-material-'));
  process.env.STORAGE_ROOT = storage;
  const db = new PrismaService();
  try {
    await db.$connect();
    const app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1');
    app.use(securityHeadersMiddleware(false));
    app.useGlobalFilters(new ProblemDetailsFilter());
    try {
      await app.listen(0, '127.0.0.1');
      const f = await materialPlanIssueFixture(db);
      await f.grant(f.store, ['inventory.stock.view', 'inventory.report.view']);
      type Actor = typeof f.store;
      const base = await app.getUrl() + '/api/v1';
      const call = async (actor: Actor | undefined, route: string, expected = 200, body?: unknown, csrf = true) => {
        const result = await fetch(base + route, {
          method: body === undefined ? 'GET' : 'POST',
          headers: {
            ...(actor ? { Cookie: 'erp_session=' + actor.session.sessionToken } : {}),
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(actor && csrf ? { 'x-csrf-token': actor.session.csrfToken } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        assert.equal(result.status, expected, await result.clone().text());
        assert.equal(result.headers.get('cache-control'), 'private, no-store');
        return result.json() as Promise<any>;
      };
      const requests = '/inventory/material-requests';
      const planIssues = '/inventory/material-plan-issues';
      const projectQuery = '?projectId=' + f.project.id;
      const dimension = {
        companyId: f.company.id, projectId: f.project.id, warehouseId: f.warehouse.id,
        materialId: f.material.id, uomId: f.uom.id,
      };
      const quantities = new InventoryQuantityService(db);
      const balance = () => quantities.onHand(db, dimension);
      const financial = async () => ({
        payments: await db.payment.count({ where: { companyId: f.company.id } }),
        directCosts: await db.directCostPosting.count({ where: { companyId: f.company.id } }),
      });
      const financeBefore = await financial();
      assert.equal((await balance()).toFixed(4), '20.0000', 'fixture count provides the stock');
      const reportBefore = (await call(f.store, '/inventory/reports/movement-summary' + projectQuery)).data;
      assert.equal(reportBefore.materialIssueRowCount, 0);
      assert.equal(reportBefore.stockCountRowCount, 1);

      // Request capture is NOT an issue approval, a material plan or stock posting.
      const requestInput = {
        requestKey: randomUUID(), projectId: f.project.id, warehouseId: f.warehouse.id,
        requesterEmployeeId: f.foreman.employee.id, requestDate: '2026-11-02',
        remarks: 'Synthetic Foreman request captured by Store Site',
        lines: [{
          materialId: f.material.id, uomId: f.uom.id, requestedQuantity: '3.0000',
          wbsId: null, costCodeId: null, activityId: null, remarks: null,
        }],
      };
      await call(undefined, requests, 401, requestInput);
      await call(f.foreman, requests, 403, requestInput);
      await call(f.store, requests, 403, requestInput, false);
      const captured = (await call(f.store, requests, 201, requestInput)).data;
      assert.deepEqual((await call(f.store, requests, 201, requestInput)).data, captured);
      const requestId = captured.id;
      const original = (await call(f.store, requests + '/' + requestId)).data;
      const lineId = original.lines[0].id;
      assert.equal(original.lines[0].issuedQuantity, '0.0000');
      assert.equal(original.lines[0].acknowledgedQuantity, '0.0000');
      assert.equal((await call(f.foreman, requests + '/' + requestId)).data.id, requestId);
      await call(f.outsider, requests + '/' + requestId, 403);
      assert.equal((await balance()).toFixed(4), '20.0000');

      // The approved Cost BOQ-backed plan exists in the shared fixture; enabling
      // its policy is synthetic-only and needs a separate explicitly granted actor.
      await call(f.ben, planIssues + '/projects/' + f.project.id + '/enable', 201, f.enableInput());
      // Exercise the deployed Material Issue entrypoint instead of creating the
      // new issue directly through the fixture service. This tests a missing
      // authentication/CSRF boundary without duplicating posting business logic.
      const issueInput = {
        projectId: f.project.id, warehouseId: f.warehouse.id,
        issueDate: '2026-11-02', issuedToEmployeeId: f.foreman.employee.id,
        remarks: 'Synthetic approved-plan material issue',
        lines: [{ materialId: f.material.id, uomId: f.uom.id, quantity: '3.0000' }],
      };
      await call(f.foreman, '/inventory/material-issues', 403, issueInput);
      await call(f.store, '/inventory/material-issues', 403, issueInput, false);
      const createdIssue = (await call(f.store, '/inventory/material-issues', 201, issueInput)).data;
      const issue = (await call(f.store, '/inventory/material-issues/' + createdIssue.id)).data;
      assert.equal(issue.id, createdIssue.id);
      assert.equal(issue.items.length, 1);
      assert.ok(await db.materialPlanIssueBinding.findUnique({ where: { issueId: issue.id } }));
      const draftLink = {
        requestKey: randomUUID(), expectedVersion: original.version,
        requestLineId: lineId, materialIssueItemId: issue.items[0]!.id,
        reason: 'Link requires actual canonical posting',
      };
      await call(f.store, requests + '/' + requestId + '/issue-links', 422, draftLink);
      assert.equal((await balance()).toFixed(4), '20.0000');

      // Within-plan post is one canonical ledger effect, WITHOUT a second
      // manager approval; neither the request nor the signed receipt posts stock.
      const pin = await f.pin(issue.id);
      assert.equal((await call(f.store, planIssues + '/issues/' + issue.id + '/preview', 201, pin)).data.result, 'WITHIN_PLAN');
      await call(f.foreman, planIssues + '/issues/' + issue.id + '/within-plan', 403, pin);
      const posted = (await call(f.store, planIssues + '/issues/' + issue.id + '/within-plan', 201, pin)).data;
      assert.equal(posted.status, 'POSTED');
      assert.deepEqual((await call(f.store, planIssues + '/issues/' + issue.id + '/within-plan', 201, pin)).data, posted);
      assert.equal(await db.stockTransaction.count({ where: { materialIssueId: issue.id } }), 1);
      assert.equal((await balance()).toFixed(4), '17.0000');
      assert.equal((await call(f.store, requests + '/' + requestId)).data.lines[0].issuedQuantity, '0.0000');

      const linked = (await call(f.store, requests + '/' + requestId + '/issue-links', 201, draftLink)).data;
      assert.deepEqual((await call(f.store, requests + '/' + requestId + '/issue-links', 201, draftLink)).data, linked);
      const afterLink = (await call(f.store, requests + '/' + requestId)).data;
      assert.equal(afterLink.lines[0].issuedQuantity, '3.0000');
      assert.equal(afterLink.lines[0].acknowledgedQuantity, '0.0000');
      assert.equal((await balance()).toFixed(4), '17.0000');

      // Evidence upload alone is not recipient acknowledgment or stock effect.
      const signedDocument = await f.upload(requestId);
      const afterUpload = (await call(f.store, requests + '/' + requestId)).data;
      assert.equal(afterUpload.lines[0].acknowledgedQuantity, '0.0000');
      const receipt = {
        requestKey: randomUUID(), expectedVersion: afterUpload.version,
        issueLinkId: afterUpload.lines[0].issueLinks[0].id,
        recipientEmployeeId: f.foreman.employee.id, issuerEmployeeId: f.store.employee.id,
        receivedAt: new Date(Date.now() - 60_000).toISOString(), documentId: signedDocument.id,
        signedEvidenceConfirmed: true, supersedesReceiptId: null,
        reason: 'Signed synthetic material handover',
      };
      await call(f.store, requests + '/' + requestId + '/receipts', 422, { ...receipt, signedEvidenceConfirmed: false });
      const acknowledged = (await call(f.store, requests + '/' + requestId + '/receipts', 201, receipt)).data;
      assert.deepEqual((await call(f.store, requests + '/' + requestId + '/receipts', 201, receipt)).data, acknowledged);
      assert.equal((await call(f.store, requests + '/' + requestId)).data.lines[0].acknowledgedQuantity, '3.0000');
      assert.equal(await db.stockTransaction.count({ where: { materialIssueId: issue.id } }), 1);
      assert.equal((await balance()).toFixed(4), '17.0000');
      const reportPosted = (await call(f.store, '/inventory/reports/movement-summary' + projectQuery)).data;
      assert.equal(reportPosted.materialIssueRowCount, reportBefore.materialIssueRowCount + 1);
      assert.equal(reportPosted.stockCountRowCount, reportBefore.stockCountRowCount);

      // A canonical reversal is reflected across the request projection,
      // stock ledger and source-derived report. Signed evidence remains a record.
      // Verify the actual guarded HTTP reversal boundary and its stock/readback effects.
      await call(f.foreman, '/inventory/material-issues/' + issue.id + '/reverse', 403,
        { reversalKey: randomUUID(), reason: 'Foreman cannot reverse a material issue' });
      await call(f.store, '/inventory/material-issues/' + issue.id + '/reverse', 201,
        { reversalKey: randomUUID(), reason: 'Synthetic physical issue reversal' });
      const reversed = (await call(f.store, requests + '/' + requestId)).data;
      assert.equal(reversed.lines[0].issuedQuantity, '0.0000');
      assert.equal(reversed.lines[0].acknowledgedQuantity, '0.0000');
      assert.equal(reversed.lines[0].issueLinks[0].receipts.length, 1);
      assert.equal(await db.document.count({ where: { id: signedDocument.id } }), 1);
      assert.equal((await balance()).toFixed(4), '20.0000');
      assert.equal((await call(f.store, '/inventory/reports/movement-summary' + projectQuery)).data.materialIssueRowCount,
        reportBefore.materialIssueRowCount + 2, 'canonical reversal is an additional ledger/report row');
      assert.deepEqual(await financial(), financeBefore, 'material operations cannot create Finance postings');
    } finally {
      await app.close();
    }
  } finally {
    await db.$disconnect();
    if (previousStorage === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousStorage;
    await rm(storage, { recursive: true, force: true });
  }
});
