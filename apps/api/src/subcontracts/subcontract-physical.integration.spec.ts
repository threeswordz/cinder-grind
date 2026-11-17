import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { subcontractPhysicalFixture } from './subcontract-physical-test-fixture';

test('DEC-048 actual HTTP binds partial physical acceptance to canonical assessment and certification', async t => {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.ok(target.username === 'erp_validation' && /^\/(?:erp_validation|erp_physical_validation_[0-9]{2})$/.test(target.pathname) ||
    /^\/(?:construction_erp|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/.test(target.pathname));
  assert.notEqual(process.env.NODE_ENV, 'production');
  const previous = process.env.STORAGE_ROOT, storage = await mkdtemp(join(tmpdir(), 'physical-http-'));
  process.env.STORAGE_ROOT = storage;
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl() + '/api/v1', sessions: Array<{ cookie: string; csrf: string }> = [];
  type Session = typeof sessions[number];
  async function call(actor: Session, path: string, expected = 200, body?: unknown, method = body === undefined ? 'GET' : 'POST'): Promise<any> {
    const response = await fetch(base + path, { method, headers: { Cookie: actor.cookie, 'x-csrf-token': actor.csrf,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result: any = await response.json();
    assert.equal(response.status, expected, path + ' ' + JSON.stringify(result));
    return result.data;
  }
  let failure: unknown;
  try {
    const f = await subcontractPhysicalFixture(db);
    const login = async (actor: typeof f.maker) => {
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: actor.user.email, password: actor.password }) });
      assert.equal(response.status, 201, 'Real synthetic actor login must succeed');
      const result: any = await response.json(); assert.equal(result.data.user.id, actor.user.id);
      const cookie = response.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
      const session = { cookie, csrf: result.data.csrfToken as string }; sessions.push(session); return session;
    };
    const loggedIn: Session[] = [];
    for (const actor of [f.maker, f.ben, f.porn, f.nancy, f.outsider, f.technical]) loggedIn.push(await login(actor));
    const [maker, ben, porn, nancy, outsider, technical] = loggedIn;
    const root = '/subcontracts', physical = root + '/physical';
    const noSideEffects = async () => ({ stock: await db.stockTransaction.findMany({ where: { companyId: f.company.id } }),
      payments: await db.payment.findMany({ where: { companyId: f.company.id } }), invoices: await db.supplierInvoice.findMany({ where: { companyId: f.company.id } }) });
    const before = await noSideEffects();
    const makeClaim = async (month: string) => {
      const claim = await call(maker!, root + '/agreements/' + f.agreement.id + '/claims', 201, { periodStart: '2026-' + month + '-01', periodEnd: '2026-' + month + '-20' });
      const line = await call(maker!, root + '/claims/' + claim.id + '/lines', 201, { amount: '1000.00' });
      return { claim, line };
    };
    const legacy = await makeClaim('01');
    await call(maker!, root + '/claims/' + legacy.claim.id + '/submit', 201, { actionKey: randomUUID() });
    await call(ben!, root + '/claims/' + legacy.claim.id + '/assess', 201, { actionKey: randomUUID(), assessedAmount: '200', reason: 'Retained monetary source before opt-in' });
    const old = await db.subcontractClaim.findUniqueOrThrow({ where: { id: legacy.claim.id }, include: { lines: true, assessment: true } });
    await call(ben!, physical + '/projects/' + f.project.id + '/enable', 201, { requestKey: randomUUID(), reason: 'Explicit disposable physical source opt-in' });
    assert.equal(await db.subcontractPhysicalClaim.count({ where: { claimId: legacy.claim.id } }), 0);

    const prepare = async (month: string, options: { quantity?: string; heldSourceId?: string; submit?: boolean } = {}) => {
      const { claim, line } = await makeClaim(month);
      const data = new FormData(); data.set('documentTypeId', f.documentType.id);
      const bytes = Buffer.from('%PDF-1.4 Explicit synthetic physical work evidence');
      data.set('file', new Blob([bytes], { type: 'application/pdf' }), 'work.pdf');
      const upload = await fetch(base + '/documents/projects/' + f.project.id + '/targets/SUBCONTRACT_CLAIM/' + claim.id,
        { method: 'POST', headers: { Cookie: maker!.cookie, 'x-csrf-token': maker!.csrf }, body: data });
      const result: any = await upload.json(); assert.equal(upload.status, 201, JSON.stringify(result));
      const observationId = randomUUID(), documentId = result.data.id as string;
      const input = { requestKey: randomUUID(), expectedVersion: 1, reason: 'Actual measured work captured', observations: [{
        id: observationId, claimLineId: line.id, basis: 'MEASURED', item: 'Installed work', location: 'Area A', quantity: options.quantity ?? '10',
        uomId: f.uom.id, progressPercent: '80', reason: 'Actual measured quantity', documentIds: [documentId],
        ...(options.heldSourceId ? { heldSourceId: options.heldSourceId } : {}),
      }] };
      const captured = await call(maker!, physical + '/claims/' + claim.id + '/capture', 201, input);
      assert.deepEqual(await call(maker!, physical + '/claims/' + claim.id + '/capture', 201, input), captured);
      await call(maker!, physical + '/claims/' + claim.id + '/capture', 409, { ...input, reason: 'Changed replay' });
      await call(maker!, root + '/claims/' + claim.id + '/submit', 409, { actionKey: randomUUID() });
      if (options.submit !== false) await call(maker!, root + '/claims/' + claim.id + '/submit', 201, { actionKey: randomUUID(), expectedPhysicalVersion: 2 });
      const source = await call(ben!, physical + '/claims/' + claim.id);
      return { claim, line, observationId, documentId, bytes, source, input };
    };
    const source = await prepare('02'), claimId = source.claim.id;
    const decision = { requestKey: randomUUID(), expectedVersion: 2, sourceDigest: source.source.submission.sourceDigest,
      reason: 'Independent acceptance of eight; two require rework',
      decisions: [{ observationId: source.observationId, acceptedQuantity: '8', acceptedAmount: '731.25', heldDisposition: 'REWORK', reason: 'Two units remain held' }] };
    await t.test('source, actor and direct canonical-assessment bypasses fail closed', async () => {
      await call(outsider!, physical + '/claims/' + claimId, 403); await call(technical!, physical + '/claims/' + claimId, 403);
      await call(porn!, physical + '/claims/' + claimId + '/decide', 403, decision);
      await call(ben!, root + '/claims/' + claimId + '/assess', 409, { actionKey: randomUUID(), assessedAmount: '731.25', reason: 'Legacy endpoint must not bypass physical decision' });
      await db.employee.update({ where: { id: f.ben.employee!.id }, data: { isActive: false } });
      try { await call(ben!, physical + '/claims/' + claimId, 403); }
      finally { await db.employee.update({ where: { id: f.ben.employee!.id }, data: { isActive: true } }); }
      await f.grant(f.maker.role.id, ['subcontracts.physical.decide', 'subcontracts.assessment.assess']);
      await call(maker!, physical + '/claims/' + claimId + '/decide', 403, decision);
      await db.rolePermission.deleteMany({ where: { roleId: f.maker.role.id, permission: { permissionCode: { in: ['subcontracts.physical.decide', 'subcontracts.assessment.assess'] } } } });
      await assert.rejects(db.$transaction(async tx => {
        await tx.subcontractClaimAssessment.create({ data: { companyId: f.company.id, projectId: f.project.id, agreementId: f.agreement.id,
          claimId, assessedAmount: '731.25', reason: 'Direct canonical bypass must fail', assessedByUserId: f.ben.user.id, assessedAt: new Date() } });
        await tx.subcontractClaim.update({ where: { id: claimId }, data: { state: 'ASSESSED' } });
      }), /PHYSICAL_DECISION_REQUIRED/);
      assert.equal(await db.subcontractClaimAssessment.count({ where: { claimId } }), 0);
    });
    await t.test('eight accepted and two held retains one explicit 731.25 canonical assessment and stable replay', async () => {
      const first = await call(ben!, physical + '/claims/' + claimId + '/decide', 201, decision);
      assert.equal(first.state, 'ASSESSED');
      assert.deepEqual(await call(ben!, physical + '/claims/' + claimId + '/decide', 201, decision), first);
      await call(ben!, physical + '/claims/' + claimId + '/decide', 409, { ...decision, reason: 'Changed replay' });
      const physicalSource = await call(ben!, physical + '/claims/' + claimId);
      assert.equal(physicalSource.decision.assessedAmount, '731.25');
      assert.equal(physicalSource.decision.decisions[0].heldQuantity, '2.0000');
      assert.equal(await db.subcontractPhysicalDecision.count({ where: { claimId } }), 1);
      await assert.rejects(db.document.update({ where: { id: source.documentId }, data: { isActive: false } }), /PHYSICAL_EVIDENCE_FROZEN/);
    });
    await t.test('Porn certification and independent Nancy approval retain canonical ceilings and exact evidence bytes', async () => {
      await call(porn!, root + '/claims/' + claimId + '/certifications', 422, { certifiedGross: '800' });
      const certification = await call(porn!, root + '/claims/' + claimId + '/certifications', 201, { certifiedGross: '731.25' });
      const stored = await db.document.findUniqueOrThrow({ where: { id: source.documentId } }), path = join(storage, stored.storageKey);
      const bytes = await readFile(path); await writeFile(path, Buffer.from('changed external bytes'));
      try {
        await call(porn!, root + '/certifications/' + certification.id, 409, { certifiedGross: '731.25' }, 'PATCH');
        const response = await fetch(base + '/documents/projects/' + f.project.id + '/' + source.documentId + '/download', { headers: { Cookie: ben!.cookie } });
        assert.equal(response.status, 422);
      } finally { await writeFile(path, bytes); }
      await call(porn!, root + '/certifications/' + certification.id + '/submit', 201, { workflowCode: f.workflow.workflowCode, actionKey: randomUUID() });
      await call(nancy!, root + '/certifications/' + certification.id + '/approve', 201, { actionKey: randomUUID(), comment: 'Independent accepted-value certification approval' });
      const approved = await db.subcontractCertification.findUniqueOrThrow({ where: { id: certification.id } });
      assert.equal(approved.certifiedGross.toFixed(2), '731.25'); assert.equal(approved.retainedAmount?.toFixed(2), '36.56');
    });
    const held = await prepare('03');
    await call(ben!, physical + '/claims/' + held.claim.id + '/decide', 201, { requestKey: randomUUID(), expectedVersion: 2,
      sourceDigest: held.source.submission.sourceDigest, reason: 'Wholly rework, no accepted amount',
      decisions: [{ observationId: held.observationId, acceptedQuantity: '0', acceptedAmount: '0', heldDisposition: 'REWORK', reason: 'All work held' }] });
    await call(porn!, root + '/claims/' + held.claim.id + '/certifications', 409, { certifiedGross: '0' });
    await t.test('concurrent held-work submissions reserve one source, and nested rework retains exact ancestry', async () => {
      const a = await prepare('04', { quantity: '2', heldSourceId: source.observationId, submit: false });
      const b = await prepare('05', { quantity: '2', heldSourceId: source.observationId, submit: false });
      const candidates = [a, b];
      const results = await Promise.all(candidates.map(candidate => fetch(base + root + '/claims/' + candidate.claim.id + '/submit', {
        method: 'POST', headers: { Cookie: maker!.cookie, 'x-csrf-token': maker!.csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: randomUUID(), expectedPhysicalVersion: 2 }),
      }).then(async response => ({ status: response.status, body: await response.json() }))));
      assert.deepEqual(results.map(r => r.status).sort(), [201, 409], JSON.stringify(results));
      const winner = candidates[results.findIndex(r => r.status === 201)]!;
      const loser = candidates[results.findIndex(r => r.status === 409)]!;
      assert.equal(await db.subcontractPhysicalSubmission.count({ where: { claimId: { in: candidates.map(c => c.claim.id) } } }), 1);
      assert.equal((await call(ben!, physical + '/claims/' + loser.claim.id)).heldSources.some((s: any) => s.id === source.observationId), false);
      const current = await call(ben!, physical + '/claims/' + winner.claim.id);
      await call(ben!, physical + '/claims/' + winner.claim.id + '/decide', 201, { requestKey: randomUUID(), expectedVersion: 2,
        sourceDigest: current.submission.sourceDigest, reason: 'One unit accepted, one still held on this later source',
        decisions: [{ observationId: winner.observationId, acceptedQuantity: '1', acceptedAmount: '120.45', heldDisposition: 'REWORK', reason: 'Explicit later accepted amount' }] });
      const grandchild = await prepare('06', { quantity: '1', heldSourceId: winner.observationId });
      await call(ben!, physical + '/claims/' + grandchild.claim.id + '/decide', 201, { requestKey: randomUUID(), expectedVersion: 2,
        sourceDigest: grandchild.source.submission.sourceDigest, reason: 'Final held unit completed with its own explicit amount',
        decisions: [{ observationId: grandchild.observationId, acceptedQuantity: '1', acceptedAmount: '50', heldDisposition: null, reason: 'No inferred prior unit price' }] });
      const original = await call(ben!, physical + '/claims/' + claimId);
      assert.equal(original.decision.assessedAmount, '731.25'); assert.equal(original.decision.decisions[0].heldQuantity, '2.0000');
      assert.equal(await db.subcontractClaimAssessment.count({ where: { claimId: grandchild.claim.id, assessedAmount: '50' } }), 1);
      await call(maker!, root + '/claims/' + loser.claim.id + '/submit', 409, { actionKey: randomUUID(), expectedPhysicalVersion: 2 });
    });
    await t.test('active rework prevents source correction until the canonical child is withdrawn', async () => {
      const child = await prepare('07', { quantity: '1', heldSourceId: held.observationId });
      await call(ben!, root + '/claims/' + held.claim.id + '/assessment/reject', 409, { actionKey: randomUUID(), reason: 'Cannot orphan active held-work consumption' });
      await call(maker!, root + '/claims/' + child.claim.id + '/withdraw', 201, { actionKey: randomUUID(), reason: 'Retain child history and release its reservation' });
      await call(ben!, root + '/claims/' + held.claim.id + '/assessment/reject', 201, { actionKey: randomUUID(), reason: 'Source can now follow canonical linked correction' });
      assert.equal((await call(ben!, physical + '/claims/' + held.claim.id)).decision.decisions[0].heldQuantity, '10.0000');
    });
    await t.test('fresh grants and both Document aliases preserve scope and fail closed on replay', async () => {
      const docPermission = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'documents.document.view' } });
      await db.rolePermission.deleteMany({ where: { roleId: f.maker.role.id, permissionId: docPermission.id } });
      try {
        const masked = await call(maker!, physical + '/claims/' + claimId);
        assert.deepEqual(masked.submission.evidence, []);
        assert.deepEqual(masked.revisions[0].observations[0].documentIds, []);
        assert.equal(masked.decision.assessedAmount, undefined); assert.equal(masked.decision.decisions[0].acceptedAmount, undefined);
      } finally { await f.grant(f.maker.role.id, ['documents.document.view']); }
      const decidePermission = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'subcontracts.physical.decide' } });
      await db.rolePermission.deleteMany({ where: { roleId: f.ben.role.id, permissionId: decidePermission.id } });
      try { await call(ben!, physical + '/claims/' + claimId + '/decide', 403, decision); }
      finally { await f.grant(f.ben.role.id, ['subcontracts.physical.decide']); }
      for (const suffix of ['/' + source.documentId + '/download', '/targets/SUBCONTRACT_CLAIM/' + claimId + '/' + source.documentId + '/download']) {
        const url = base + '/documents/projects/' + f.project.id + suffix;
        const allowed = await fetch(url, { headers: { Cookie: ben!.cookie } }); assert.equal(allowed.status, 200);
        assert.deepEqual(Buffer.from(await allowed.arrayBuffer()), source.bytes);
        const denied = await fetch(url, { headers: { Cookie: outsider!.cookie } }); assert.equal(denied.status, 403); await denied.body?.cancel();
      }
      const foreign = await subcontractPhysicalFixture(db);
      const foreignClaim = await db.subcontractClaim.create({ data: { companyId: foreign.company.id, projectId: foreign.project.id, agreementId: foreign.agreement.id,
        claimNumber: 'FOREIGN-CLAIM', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-20'), currencyCode: 'THB', createdByUserId: foreign.maker.user.id } });
      await call(ben!, physical + '/claims/' + foreignClaim.id, 404);
    });
    await t.test('an in-flight evidence archive serializes with source submission and cannot leave a frozen inactive file', async () => {
      const candidate = await prepare('08', { submit: false });
      let ready!: () => void, release!: () => void;
      const started = new Promise<void>(resolve => { ready = resolve; }), finish = new Promise<void>(resolve => { release = resolve; });
      const archived = db.$transaction(async tx => {
        await tx.document.update({ where: { id: candidate.documentId }, data: { isActive: false } });
        ready(); await finish;
      }, { timeout: 15000 });
      await started;
      let completed = false, blocked = false;
      const submitting = fetch(base + root + '/claims/' + candidate.claim.id + '/submit', {
        method: 'POST', headers: { Cookie: maker!.cookie, 'x-csrf-token': maker!.csrf, 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionKey: randomUUID(), expectedPhysicalVersion: 2 }),
      }).then(response => { completed = true; return response; });
      try {
        const deadline = Date.now() + 3000;
        while (!completed && !blocked && Date.now() < deadline) {
          const rows = await db.$queryRaw<Array<{ blocked: boolean }>>`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
            AND wait_event_type='Lock' AND query LIKE '%subcontract_physical_submissions%') AS blocked`;
          blocked = rows[0]!.blocked;
          if (!blocked && !completed) await new Promise(resolve => setTimeout(resolve, 20));
        }
      } finally { release(); await archived; }
      const response = await submitting, body: any = await response.json();
      assert.equal(response.status, 409, JSON.stringify(body));
      assert.equal(blocked, true, 'Submission must wait for the in-flight evidence mutation');
      assert.equal(await db.subcontractPhysicalSubmission.count({ where: { claimId: candidate.claim.id } }), 0);
      assert.equal((await db.document.findUniqueOrThrow({ where: { id: candidate.documentId } })).isActive, false);
    });
    assert.deepEqual(await db.subcontractClaim.findUniqueOrThrow({ where: { id: legacy.claim.id }, include: { lines: true, assessment: true } }), old);
    assert.deepEqual(await noSideEffects(), before);
  } catch (error) { failure = error; }
  finally {
    for (const actor of sessions) try {
      const response = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: actor.cookie, 'x-csrf-token': actor.csrf } });
      assert.equal(response.status, 204, 'Each actual session must be revoked'); await response.body?.cancel();
      await call(actor, '/auth/me', 401);
    } catch (error) { failure ??= error; }
    try { await app.close(); } catch (error) { failure ??= error; }
    try { await db.$disconnect(); } catch (error) { failure ??= error; }
    if (previous === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = previous;
    try { await rm(storage, { recursive: true, force: true }); } catch (error) { failure ??= error; }
  }
  if (failure) throw failure;
});
