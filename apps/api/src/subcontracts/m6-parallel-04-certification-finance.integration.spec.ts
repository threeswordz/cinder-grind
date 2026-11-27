import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { subcontractPhysicalFixture } from './subcontract-physical-test-fixture';

// New disposable journey only: never rerun a retained claim, payment or session.
// Coordinator runs this file explicitly against an isolated migrated PG fixture.
test('M6-04 physical acceptance to cancelled allocation retains scoped financial history', async () => {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.equal(target.username, 'erp_validation');
  assert.match(target.pathname, /^\/(?:erp_validation|erp_physical_validation_[0-9]{2})$/);
  assert.notEqual(process.env.NODE_ENV, 'production');
  const previous = process.env.STORAGE_ROOT, storage = await mkdtemp(join(tmpdir(), 'm6-04-finance-'));
  process.env.STORAGE_ROOT = storage;
  const db = new PrismaService();
  const sessions: Array<{ cookie: string; csrf: string }> = [];
  type Session = typeof sessions[number];
  let app: INestApplication | undefined, base = '';
  try {
    await db.$connect();
    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter());
    await app.listen(0, '127.0.0.1'); base = await app.getUrl() + '/api/v1';
    const f = await subcontractPhysicalFixture(db), foreign = await subcontractPhysicalFixture(db);
    // These grants are only to newly created disposable synthetic roles.
    await f.grant(f.maker.role.id, ['finance.payment.view', 'finance.payment.create', 'finance.payment.edit', 'finance.payment.submit']);
    await f.grant(f.nancy.role.id, ['finance.payment.view', 'finance.payment.approve', 'finance.payment.cancel']);
    await f.grant(f.outsider.role.id, ['subcontracts.certification.view', 'finance.payment.view']);
    await foreign.grant(foreign.porn.role.id, ['finance.payment.view']);
    const workflow = await db.approvalWorkflow.create({ data: { companyId: f.company.id, entityType: 'PAYMENT', workflowCode: 'M6-04-PAY', workflowName: 'Disposable independent payment approval',
      steps: { create: [{ stepNo: 1, stepName: 'Independent finance approval', requiredApprovals: 1, stepRoles: { create: [{ roleId: f.nancy.role.id }] } }] } } });
    async function login(actor: typeof f.maker): Promise<Session> {
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: actor.user.email, password: actor.password }) });
      assert.equal(response.status, 201); const body: any = await response.json();
      const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
      const session = { cookie, csrf: body.data.csrfToken as string }; sessions.push(session); assert.equal(body.data.user.id, actor.user.id); return session;
    }
    const loggedIn: Session[] = [];
    for (const actor of [f.maker, f.ben, f.porn, f.nancy, f.outsider, foreign.porn]) loggedIn.push(await login(actor));
    const [maker, ben, porn, nancy, outsider, foreignActor] = loggedIn;
    async function call(actor: Session, path: string, status = 200, body?: unknown): Promise<any> {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: actor.cookie, 'x-csrf-token': actor.csrf, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(response.status, status, path);
      if (status >= 400) { await response.body?.cancel(); return; }
      return (await response.json() as any).data;
    }
    const sc = '/subcontracts', ph = sc + '/physical';
    await call(ben!, ph + '/projects/' + f.project.id + '/enable', 201, { requestKey: randomUUID(), reason: 'New isolated physical fixture only' });
    const claim = await call(maker!, sc + '/agreements/' + f.agreement.id + '/claims', 201, { periodStart: '2026-02-01', periodEnd: '2026-02-20' });
    const claimPath = sc + '/claims/' + claim.id, physicalPath = ph + '/claims/' + claim.id;
    const line = await call(maker!, claimPath + '/lines', 201, { amount: '1000.00' });
    const upload = new FormData(); upload.set('documentTypeId', f.documentType.id); upload.set('file', new Blob(['%PDF-1.4 isolated M6-04 financial evidence'], { type: 'application/pdf' }), 'acceptance.pdf');
    const uploaded = await fetch(base + '/documents/projects/' + f.project.id + '/targets/SUBCONTRACT_CLAIM/' + claim.id, { method: 'POST', headers: { Cookie: maker!.cookie, 'x-csrf-token': maker!.csrf }, body: upload });
    assert.equal(uploaded.status, 201); const documentId = (await uploaded.json() as any).data.id;
    const observationId = randomUUID();
    await call(maker!, physicalPath + '/capture', 201, { requestKey: randomUUID(), expectedVersion: 1, reason: 'Measured work', observations: [{ id: observationId, claimLineId: line.id, basis: 'MEASURED', item: 'Installed work', location: 'Area A', quantity: '10', uomId: f.uom.id, progressPercent: '80', reason: 'Measured fixture', documentIds: [documentId] }] });
    await call(maker!, claimPath + '/submit', 201, { actionKey: randomUUID(), expectedPhysicalVersion: 2 });
    const submitted = await call(ben!, physicalPath);
    await call(ben!, physicalPath + '/decide', 201, { requestKey: randomUUID(), expectedVersion: 2, sourceDigest: submitted.submission.sourceDigest, reason: 'Eight accepted, two held', decisions: [{ observationId, acceptedQuantity: '8', acceptedAmount: '100.00', heldDisposition: 'REWORK', reason: 'Two remain held' }] });
    const cert = await call(porn!, claimPath + '/certifications', 201, { certifiedGross: '100.00' });
    const certPath = sc + '/certifications/' + cert.id;
    await call(porn!, certPath + '/submit', 201, { workflowCode: f.workflow.workflowCode, actionKey: randomUUID() });
    await call(nancy!, certPath + '/approve', 201, { actionKey: randomUUID(), comment: 'Independent fixture approval' });
    const approved = await db.subcontractCertification.findUniqueOrThrow({ where: { id: cert.id } });
    assert.equal(approved.retainedAmount?.toFixed(2), '5.00'); assert.equal(approved.netCertifiedAmount?.toFixed(2), '95.00');
    const sourceSnapshot = async () => ({ claim: await db.subcontractClaim.findUniqueOrThrow({ where: { id: claim.id } }), assessment: await db.subcontractClaimAssessment.findUniqueOrThrow({ where: { id: approved.assessmentId } }), physical: await db.subcontractPhysicalDecision.findUniqueOrThrow({ where: { claimId: claim.id } }), submission: await db.subcontractPhysicalSubmission.findUniqueOrThrow({ where: { claimId: claim.id } }), certification: await db.subcontractCertification.findUniqueOrThrow({ where: { id: cert.id } }), retention: await db.retentionLedgerEntry.findMany({ where: { certificationId: cert.id }, orderBy: { id: 'asc' } }), document: await db.document.findUniqueOrThrow({ where: { id: documentId } }), supplierInvoices: await db.supplierInvoice.findMany({ where: { companyId: f.company.id }, orderBy: { id: 'asc' } }), clientInvoices: await db.clientInvoice.findMany({ where: { companyId: f.company.id }, orderBy: { id: 'asc' } }) });
    const sourceBefore = await sourceSnapshot(); assert.equal(sourceBefore.retention.length, 1);
    const payment = await call(maker!, '/finance/projects/' + f.project.id + '/payments', 201, { direction: 'OUTBOUND', paymentDate: '2026-02-28', subcontractorId: f.agreement.subcontractorId, amount: '69.40', createKey: randomUUID() });
    const payPath = '/finance/payments/' + payment.id;
    await call(maker!, payPath + '/allocations', 201, { targetType: 'SUBCONTRACT_CERTIFICATION', targetId: cert.id, amount: '69.40', actionKey: randomUUID() });
    await call(maker!, payPath + '/submit', 201, { workflowCode: workflow.workflowCode, actionKey: randomUUID() });
    await call(nancy!, payPath + '/approve', 201, { actionKey: randomUUID(), comment: 'Independent payment approval' });
    const reference = certPath + '/finance-reference';
    const beforeCancel = await call(nancy!, reference); assert.equal(beforeCancel.allocations.length, 1); assert.equal(beforeCancel.allocations[0].payment.state, 'APPROVED');
    const allocation = await db.subcontractPaymentAllocation.findFirstOrThrow({ where: { paymentId: payment.id, subcontractCertificationId: cert.id } });
    const cancel = { actionKey: randomUUID(), reason: 'Disposable payment cancellation' };
    await call(nancy!, payPath + '/cancel', 201, cancel); await call(nancy!, payPath + '/cancel', 201, cancel);
    const afterCancel = await call(nancy!, reference);
    assert.equal(afterCancel.allocations.length, 1); assert.equal(afterCancel.allocations[0].id, allocation.id); assert.equal(afterCancel.allocations[0].payment.id, payment.id);
    assert.equal(afterCancel.allocations[0].payment.state, 'CANCELLED'); assert.equal(afterCancel.allocations[0].payment.cancellationReason, cancel.reason);
    assert.equal(afterCancel.allocations[0].allocatedAmount, '69.4');
    assert.deepEqual(await db.subcontractPaymentAllocation.findUniqueOrThrow({ where: { id: allocation.id } }), allocation);
    const scoped = await call(porn!, certPath); assert.equal(scoped.id, cert.id);
    await call(porn!, reference, 403); await call(outsider!, certPath, 403); await call(outsider!, reference, 403);
    await call(foreignActor!, certPath, 404); await call(foreignActor!, reference, 404);
    const masked = await call(maker!, physicalPath); assert.equal(masked.decision.decisions[0].heldQuantity, '2.0000');
    assert.equal(masked.decision.assessedAmount, undefined); assert.equal(masked.decision.decisions[0].acceptedAmount, undefined);
    assert.deepEqual(await sourceSnapshot(), sourceBefore, 'Payment cancellation and denied reads must not alter certification, physical, retention, document or invoice sources');
  } finally {
    try {
      const revoked = await Promise.allSettled(sessions.map(async session => {
        const response = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: session.cookie, 'x-csrf-token': session.csrf, 'Content-Type': 'application/json' }, body: '{}' });
        await response.body?.cancel(); assert.equal(response.status, 204);
        const stale = await fetch(base + '/auth/me', { headers: { Cookie: session.cookie } }); await stale.body?.cancel(); assert.equal(stale.status, 401);
      }));
      assert.ok(revoked.every(result => result.status === 'fulfilled'), 'Every disposable session must be revoked');
    } finally {
      try { await app?.close(); await db.$disconnect(); }
      finally { if (previous === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = previous; await rm(storage, { recursive: true, force: true }); }
    }
  }
});
