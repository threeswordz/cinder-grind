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
import { siteIssueFixture } from './site-issue-test-fixture';

test('FM03 actual authenticated HTTP enforces lifecycle, severity, scope, immutable history and retries', async t => {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(process.platform, 'linux');
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.match(target.pathname, /^\/(?:construction_erp|fm03_[a-f0-9]{32}|construction_erp_v10e_(?:upgrade|hrrestore)_[a-f0-9]{12})$/);
  const storage = await mkdtemp(join(tmpdir(), 'fm03-http-')), oldStorage = process.env.STORAGE_ROOT;
  process.env.STORAGE_ROOT = storage;
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl() + '/api/v1';
  const sessions = new Map<string, { cookie: string; csrf: string }>();
  try {
    const f = await siteIssueFixture(db);
    for (const [key, actor] of Object.entries(f.actors)) {
      const r = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: actor.email, password: actor.password }) });
      assert.equal(r.status, 201, key + ' real login');
      const value = await r.json() as { data: { csrfToken: string; user: { id: string } } };
      assert.equal(value.data.user.id, actor.userId);
      const cookie = r.headers.get('set-cookie')?.split(';')[0]; assert.ok(cookie);
      sessions.set(key, { cookie, csrf: value.data.csrfToken });
    }
    async function call(key: string | null, path: string, status = 200, body?: unknown, csrf = true): Promise<any> {
      const s = key ? sessions.get(key) : undefined;
      const r = await fetch(base + '/site-issues' + path, { method: body === undefined ? 'GET' : 'POST',
        headers: { ...(s ? { Cookie: s.cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(s && csrf ? { 'X-CSRF-Token': s.csrf } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(r.status, status, String(key) + ' ' + path);
      return r.json();
    }
    const route = '/projects/' + f.assigned.id + '/routing';
    const config = { requestKey: randomUUID(), expectedVersion: 0, ownerUserId: f.actors.OWNER.userId,
      escalationUserId: f.actors.MANAGER.userId, reason: 'Explicit synthetic functional routing' };
    const unchanged = JSON.stringify(await db.dailySiteReport.findUnique({ where: { id: f.report.id }, include: { issues: true } }));
    await t.test('actual sessions, explicit routing, CSRF and Project authority precede report creation', async () => {
      await call(null, '/projects', 401);
      await call('CONFIG', '', 403, f.input());
      await call('REPORTER', '', 403, f.input(), false);
      await call('OUTSIDER', '?projectId=' + f.assigned.id, 403);
      await call('REPORTER', '?projectId=' + f.foreign.id, 404);
      await call('REPORTER', '', 409, f.input());
      await call('CONFIG', route, 403, { ...config, escalationUserId: config.ownerUserId });
      await call('CONFIG', route, 403, { ...config, ownerUserId: f.actors.OUTSIDER.userId });
      const routed = (await call('CONFIG', route, 201, config)).data;
      assert.deepEqual((await call('CONFIG', route, 201, config)).data, routed);
      await call('CONFIG', route, 409, { ...config, requestKey: randomUUID() });
      await call('OWNER', route, 403, { ...config, expectedVersion: 1 });
      await call('REPORTER', '', 403, f.input({ activityId: randomUUID() }));
      await call('REPORTER', '', 404, f.input({ projectId: f.foreign.id }));
      await call('REPORTER', '', 422, f.input({ status: 'CLOSED' }));
    });
    let id = '', firstFollowUp: Record<string, unknown>;
    await t.test('concurrent reports are one effect and an immediate durable management alert', async () => {
      const input = f.input({ workStopped: true });
      const [a, b] = await Promise.all([call('REPORTER', '', 201, input), call('REPORTER', '', 201, input)]);
      assert.deepEqual(a.data, b.data); id = a.data.id;
      assert.equal(await db.siteIssue.count({ where: { companyId: f.company.id } }), 1);
      assert.equal(await db.siteIssueEvent.count({ where: { issueId: id } }), 1);
      await call('REPORTER', '', 409, { ...input, description: 'Changed under the same key' });
      const alert = (await call('MANAGER', '/escalations')).data;
      assert.equal(alert.total, 1); assert.equal(alert.items[0].id, id);
      await call('OWNER', '/escalations', 403);
      await call('OUTSIDER', '/' + id, 403);
      const detail = (await call('REPORTER', '/' + id)).data;
      assert.equal(detail.reporterUserId, f.actors.REPORTER.userId);
      assert.equal(detail.ownerUserId, f.actors.OWNER.userId);
      assert.equal(detail.version, 1); assert.ok(detail.escalatedAt);
      assert.doesNotMatch(JSON.stringify(detail), /passwordHash|csrfTokenHash|accountNumber/);
    });
    await t.test('assigned owner follow-up, own Foreman recheck and final closure retain rejected and successful verification', async () => {
      const command = (version: number, extra = {}) => ({ requestKey: randomUUID(), expectedVersion: version, note: 'Synthetic recorded action', ...extra });
      await call('OWNER', '/' + id + '/close', 409, command(1));
      await call('OTHER_OWNER', '/' + id + '/follow-up', 403, command(1));
      await call('REPORTER', '/' + id + '/follow-up', 403, command(1));
      await call('OWNER', '/' + id + '/follow-up', 409, command(999));
      firstFollowUp = command(1);
      const saved = (await call('OWNER', '/' + id + '/follow-up', 201, firstFollowUp)).data;
      assert.equal(saved.version, 2);
      assert.deepEqual((await call('OWNER', '/' + id + '/follow-up', 201, firstFollowUp)).data, saved);
      await call('OWNER', '/' + id + '/follow-up', 409, { ...firstFollowUp, note: 'Different note' });
      await call('OTHER', '/' + id + '/verify', 403, command(2, { resolved: true }));
      assert.equal((await call('REPORTER', '/' + id + '/verify', 201, command(2, { resolved: false }))).data.version, 3);
      await call('OWNER', '/' + id + '/close', 409, command(3));
      await call('OWNER', '/' + id + '/follow-up', 201, command(3));
      await call('REPORTER', '/' + id + '/verify', 201, command(4, { resolved: true }));
      const closing = command(5);
      const [a, b] = await Promise.all([call('OWNER', '/' + id + '/close', 201, closing), call('OWNER', '/' + id + '/close', 201, closing)]);
      assert.deepEqual(a.data, b.data); assert.equal(a.data.version, 6);
      assert.deepEqual((await call('OWNER', '/' + id + '/follow-up', 201, firstFollowUp)).data, saved);
      const detail = (await call('REPORTER', '/' + id)).data;
      assert.equal(detail.status, 'CLOSED'); assert.equal(detail.events.length, 6);
      assert.deepEqual(detail.events.map((e: { action: string }) => e.action), ['CLOSE', 'VERIFY', 'FOLLOW_UP', 'VERIFY', 'FOLLOW_UP', 'REPORT']);
      assert.equal((await call('MANAGER', '/escalations')).data.total, 0);
      assert.equal(JSON.stringify(await db.dailySiteReport.findUnique({ where: { id: f.report.id }, include: { issues: true } })), unchanged);
      assert.equal(await db.stockTransaction.count({ where: { companyId: f.company.id } }), 0);
      assert.equal(await db.payment.count({ where: { companyId: f.company.id } }), 0);
      assert.equal(await db.hrEmployment.count({ where: { companyId: f.company.id } }), 0);
    });
    await t.test('asset-only severity waits for PM assessment but work-stop escalation does not wait or get erased', async () => {
      for (const severity of ['SEVERE', 'NOT_SEVERE']) {
        const created = (await call('REPORTER', '', 201, f.input({ category: 'ASSET_LOSS_DAMAGE', affectsCostOrDelivery: true }))).data;
        assert.equal((await call('REPORTER', '/' + created.id)).data.escalatedAt, null);
        const body = { requestKey: randomUUID(), expectedVersion: 1, note: 'PM asset assessment', assetSeverity: severity };
        await call('OWNER', '/' + created.id + '/follow-up', 201, body);
        assert.equal(Boolean((await call('REPORTER', '/' + created.id)).data.escalatedAt), severity === 'SEVERE');
      }
      const created = (await call('REPORTER', '', 201, f.input({ category: 'ASSET_LOSS_DAMAGE', workStopped: true }))).data;
      const before = (await call('REPORTER', '/' + created.id)).data;
      await call('OWNER', '/' + created.id + '/follow-up', 422, { requestKey: randomUUID(), expectedVersion: 1, note: 'Missing assessment' });
      await call('OWNER', '/' + created.id + '/follow-up', 201, { requestKey: randomUUID(), expectedVersion: 1, note: 'Assessment retained', assetSeverity: 'NOT_SEVERE' });
      assert.equal((await call('REPORTER', '/' + created.id)).data.escalatedAt, before.escalatedAt);
    });
    await t.test('PostgreSQL refuses history edits, immutable identity drift and state updates without matching actor events', async () => {
      const event = await db.siteIssueEvent.findFirstOrThrow({ where: { issueId: id } });
      await assert.rejects(db.siteIssueEvent.update({ where: { id: event.id }, data: { note: 'Replace history' } }));
      await assert.rejects(db.siteIssueEvent.delete({ where: { id: event.id } }));
      await assert.rejects(db.siteIssue.delete({ where: { id } }));
      await assert.rejects(db.siteIssue.update({ where: { id }, data: { projectId: f.unassigned.id } }));
      const created = (await call('REPORTER', '', 201, f.input())).data;
      await assert.rejects(db.siteIssue.update({ where: { id: created.id }, data: { version: 2, status: 'AWAITING_VERIFICATION' } }));
      assert.equal((await call('REPORTER', '/' + created.id)).data.version, 1);
      await assert.rejects(db.activity.update({ where: { id: f.activity.id }, data: { projectId: f.unassigned.id } }));
    });
    await t.test('revoked rights and inactive membership deny existing sessions; later routing does not reassign existing cases', async () => {
      const created = (await call('REPORTER', '', 201, f.input())).data;
      const p = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'site.issue.follow_up' } });
      await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: f.actors.OWNER.roleId, permissionId: p.id } } });
      const follow = { requestKey: randomUUID(), expectedVersion: 1, note: 'Check live authority' };
      await call('OWNER', '/' + created.id + '/follow-up', 403, follow);
      await db.rolePermission.create({ data: { roleId: f.actors.OWNER.roleId, permissionId: p.id } });
      await db.projectMember.updateMany({ where: { projectId: f.assigned.id, employeeId: f.actors.OWNER.employeeId }, data: { isActive: false } });
      await call('OWNER', '/' + created.id + '/follow-up', 403, follow);
      await db.projectMember.updateMany({ where: { projectId: f.assigned.id, employeeId: f.actors.OWNER.employeeId }, data: { isActive: true } });
      await call('CONFIG', route, 201, { ...config, expectedVersion: 1, requestKey: randomUUID(), ownerUserId: f.actors.OTHER_OWNER.userId });
      assert.equal((await call('REPORTER', '/' + created.id)).data.ownerUserId, f.actors.OWNER.userId);
      await call('OTHER_OWNER', '/' + created.id + '/follow-up', 403, follow);
      await call('OWNER', '/' + created.id + '/follow-up', 201, follow);
      const later = (await call('REPORTER', '', 201, f.input())).data;
      assert.equal((await call('REPORTER', '/' + later.id)).data.ownerUserId, f.actors.OTHER_OWNER.userId);
    });
  } finally {
    for (const s of sessions.values()) {
      const r = await fetch(base + '/auth/logout', { method: 'POST', headers: { Cookie: s.cookie, 'X-CSRF-Token': s.csrf } });
      assert.equal(r.status, 204);
    }
    await app.close(); await db.$disconnect(); await rm(storage, { recursive: true, force: true });
    if (oldStorage === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = oldStorage;
  }
});
