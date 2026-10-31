import 'reflect-metadata';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { NestFactory } from '@nestjs/core';
import { ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AppModule } from '../app.module';
import { AuditService } from '../audit/audit.service';
import { securityHeadersMiddleware } from '../common/security-headers';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { PrismaService } from '../prisma/prisma.service';
import { HrService } from './hr.service';
import { LocalDocumentStorage } from '../documents/local-document-storage.service';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { hrFacts, hrFixture } from './hr-test-fixture';

test('HR employee/private HTTP and database contracts use disposable scoped identities, immutable history and exact authority', async t => {
  const savedKeys = process.env.HR_PRIVATE_KEYS, savedActive = process.env.HR_PRIVATE_ACTIVE_KEY_ID;
  const savedStorage = process.env.STORAGE_ROOT;
  const temporaryHrStorage = await mkdtemp(path.join(tmpdir(), 'erp-hr-attachment-http-'));
  process.env.STORAGE_ROOT = temporaryHrStorage;
  const keys = { test1: randomBytes(32).toString('base64') };
  process.env.HR_PRIVATE_KEYS = JSON.stringify(keys); process.env.HR_PRIVATE_ACTIVE_KEY_ID = 'test1';
  const db = new PrismaService(); await db.$connect();
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1'); app.use(securityHeadersMiddleware(false)); app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl() + '/api/v1';
  try {
    const f = await hrFixture(db), a = f.actors;
    type Actor = typeof a.hr;
    const root = '/hr/companies/' + f.company.id, foreign = '/hr/companies/' + f.other.id;
    const employeeRoot = root + '/employees/' + f.legacy.id;
    const secretId = 'SYNTHETIC_ID_PRIVATE_NEVER_IN_AUDIT', secretBank = 'SYNTHETIC_BANK_PRIVATE_NEVER_IN_AUDIT', secretReason = 'SYNTHETIC_REASON_PRIVATE_NEVER_IN_AUDIT';
    const original = { employee: await db.employee.findUniqueOrThrow({ where: { id: f.legacy.id } }),
      user: await db.user.findUniqueOrThrow({ where: { id: f.legacyUser.id } }), member: await db.projectMember.findUniqueOrThrow({ where: { id: f.legacyMember.id } }) };
    const counts = () => Promise.all([db.payment.count(),db.directCostPosting.count(),db.stockTransaction.count(),db.customerBoqVersion.count(),db.dailySiteReportManpower.count()]);
    const financialBefore = await counts();
    const call = async (actor: Actor | undefined, path: string, status = 200, method = 'GET', body?: unknown, csrf = true) => {
      const r = await fetch(base + path, { method, headers: {
        ...(actor ? { Cookie: 'erp_session=' + actor.session.sessionToken } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(actor && csrf ? { 'x-csrf-token': actor.session.csrfToken } : {}),
      }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
      assert.equal(r.status, status, await r.clone().text());
      assert.equal(r.headers.get('cache-control'), 'private, no-store');
      return await r.json() as any;
    };
    const post = (actor: Actor, path: string, body: unknown, status = 201, csrf = true) => call(actor,path,status,'POST',body,csrf);
    const enrol = { requestId: randomUUID(), expectedVersion: 0, facts: hrFacts({ projectId: f.project.id, reason: secretReason }) };

    await t.test('authentication and CSRF protect every mutation; no request creates grants automatically', async () => {
      await call(undefined, '/hr/companies', 401);
      await post(a.hr, employeeRoot + '/employment', enrol, 403, false);
      assert.equal(await db.hrEmployment.count({ where: { companyId: f.company.id } }), 0);
      assert.equal((await call(a.admin, '/hr/companies')).data.length, 0);
    });
    await t.test('explicit target-Company scope works without changing the session Company or roles', async () => {
      const companies = (await call(a.hr, '/hr/companies')).data;
      assert.deepEqual(companies.map((c: any) => c.id).sort(), [f.company.id, f.other.id].sort());
      await call(a.hr, foreign + '/employees');
      await call(a.hr, '/hr/companies/' + f.hidden.id + '/employees', 404);
      await call(a.hr, '/hr/companies/' + randomUUID() + '/employees', 404);
      const resolved = await f.sessions.resolve(a.hr.session.sessionToken);
      assert.equal(resolved!.companyId, f.company.id); assert.deepEqual(resolved!.roleCodes, a.hr.auth.roleCodes);
      const scope = await f.projects.scopeWhere(resolved!);
      assert.equal(scope.companyId, f.company.id);
      await assert.rejects(f.projects.assertAccess(resolved!, f.foreignProject.id), NotFoundException);
    });
    await t.test('existing employee enrolment appends an explicit first history without changing canonical references', async () => {
      const response = await post(a.hr, employeeRoot + '/employment', enrol);
      assert.deepEqual(response.data, { id: f.legacy.id, version: 1 });
      const history = (await call(a.hr, employeeRoot + '/employment')).data;
      assert.equal(history.employment.revisions.length, 1);
      assert.equal(history.employment.revisions[0].payBasis, 'DAILY');
      assert.equal(JSON.stringify(history).includes(secretReason), false);
      assert.equal(JSON.stringify(history).includes('ciphertext'), false);
      assert.deepEqual(await db.employee.findUniqueOrThrow({ where: { id: f.legacy.id } }), original.employee);
      assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: f.legacyUser.id } }), original.user);
      assert.deepEqual(await db.projectMember.findUniqueOrThrow({ where: { id: f.legacyMember.id } }), original.member);
      const reason = (await post(a.nancy, employeeRoot + '/employment/' + history.employment.revisions[0].id + '/reveal', {})).data;
      assert.equal(reason.reason, secretReason);
      await post(a.ben, employeeRoot + '/employment/' + history.employment.revisions[0].id + '/reveal', {}, 403);
    });
    await t.test('eight-function matrix keeps view/manage/category rights independent', async () => {
      await post(a.hr, employeeRoot + '/private/identity/revisions', { requestId: randomUUID(), expectedVersion: 0, values: { identityNumber: secretId }, reason: secretReason });
      await post(a.hr, employeeRoot + '/private/bank/revisions', { requestId: randomUUID(), expectedVersion: 0,
        values: { accountNumber: secretBank, bankName: 'Synthetic bank', accountHolder: 'Synthetic holder' }, reason: secretReason });
      for (const actor of [a.hr,a.nancy]) {
        assert.equal((await post(actor, employeeRoot + '/private/identity/reveal', { version: 1 })).data.values.identityNumber, secretId);
        assert.equal((await post(actor, employeeRoot + '/private/bank/reveal', { version: 1 })).data.values.accountNumber, secretBank);
      }
      assert.equal((await post(a.porn, employeeRoot + '/private/bank/reveal', { version: 1 })).data.values.accountNumber, secretBank);
      await post(a.porn, employeeRoot + '/private/identity/reveal', { version: 1 }, 404);
      await post(a.porn, employeeRoot + '/private/bank/reason', { version: 1 }, 404);
      for (const actor of [a.ben,a.pm,a.store,a.foreman,a.admin,a.outsider]) {
        await post(actor, employeeRoot + '/private/identity/reveal', { version: 1 }, 404);
        await post(actor, employeeRoot + '/private/bank/reveal', { version: 1 }, 404);
      }
      for (const actor of [a.nancy,a.ben,a.porn]) {
        await call(actor, employeeRoot + '/employment');
        await post(actor, employeeRoot + '/employment', { ...enrol, requestId: randomUUID(), expectedVersion: 1 }, 403);
      }
    });
    await t.test('default masking, explicit reveal, bounded history and safe generic Employee DTOs prevent private disclosure', async () => {
      const masked = (await call(a.porn, employeeRoot + '/private/bank')).data;
      assert.equal(masked.values.accountNumber, '••••'); assert.equal(JSON.stringify(masked).includes(secretBank), false);
      const history = (await call(a.nancy, employeeRoot + '/private/bank/history')).data;
      assert.deepEqual(Object.keys(history[0]).sort(), ['actorUserId','createdAt','id','version']);
      assert.equal((await post(a.nancy, employeeRoot + '/private/bank/reason', { version: 1 })).data.reason, secretReason);
      const generic = (await call(a.hr, '/master-data/employees/' + f.legacy.id)).data;
      assert.deepEqual(Object.keys(generic).sort(), Object.keys(original.employee).sort());
      assert.equal(JSON.stringify(generic).includes(secretId), false);
      const list = (await call(a.hr, root + '/employees')).data;
      for (const secret of [secretId,secretBank,secretReason,'ciphertext','hiringApprovalReference']) assert.equal(JSON.stringify(list).includes(secret), false);
    });
    await t.test('Project operational projections remain salary/private-free and cannot cross Project/Company scope', async () => {
      for (const actor of [a.pm,a.store,a.foreman]) {
        const rows = (await call(actor, '/hr/projects/' + f.project.id + '/employees')).data;
        assert.ok(rows.some((r: any) => r.id === f.legacy.id));
        for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['employeeCode','employeeName','id','jobTitle']);
        await call(actor, '/hr/projects/' + f.unassigned.id + '/employees', 403);
        await call(actor, '/hr/projects/' + f.foreignProject.id + '/employees', 404);
        await call(actor, employeeRoot + '/employment', 403);
      }
    });
    await t.test('forged capabilities, SYS_ADMIN labels and substituted sessions do not confer HR access', async () => {
      await assert.rejects(f.service.history({ ...a.outsider.auth, roleCodes: ['SYS_ADMIN'], permissions: a.hr.auth.permissions }, f.company.id, f.legacy.id), NotFoundException);
      await assert.rejects(f.service.history({ ...a.hr.auth, sessionId: a.outsider.auth.sessionId }, f.company.id, f.legacy.id), NotFoundException);
      await call(a.hr, foreign + '/employees/' + f.legacy.id + '/employment', 404);
      await post(a.nancy, foreign + '/employees/' + f.legacy.id + '/private/bank/reveal', { version: 1 }, 404);
    });
    await t.test('an additive role supplies no missing category entitlement; raw scoped references cannot cross Companies', async () => {
      const role = await db.role.create({ data: { companyId: f.company.id, roleCode: 'EXTRA_' + f.suffix, roleName: 'Synthetic additive capability' } });
      const permission = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'hr.bank.view' } });
      await db.rolePermission.create({ data: { roleId: role.id, permissionId: permission.id } });
      await db.userRole.create({ data: { companyId: f.company.id, userId: a.pm.user.id, roleId: role.id } });
      await post(a.pm, employeeRoot + '/private/bank/reveal', { version: 1 }, 404);
      await assert.rejects(db.hrEmployment.create({ data: { companyId: f.other.id, employeeId: f.legacy.id } }));
      await assert.rejects(db.hrPrivateRevision.create({ data: { companyId: f.other.id, employeeId: f.legacy.id,
        category: 'bank', version: 1, ciphertext: 'not-a-private-record', actorUserId: a.hr.user.id } }));
    });
    await t.test('same-key concurrent retries create one employee/revision/replay; changed body conflicts', async () => {
      const body = { requestId: randomUUID(), employeeCode: 'NEW-' + f.suffix, employeeName: 'Synthetic new employee', facts: hrFacts() };
      const count = await db.employee.count({ where: { companyId: f.company.id } });
      const replies = await Promise.all([f.service.create(a.hr.auth, f.company.id, body), f.service.create(a.hr.auth, f.company.id, body)]);
      assert.deepEqual(replies[0], replies[1]);
      assert.equal(await db.employee.count({ where: { companyId: f.company.id } }), count + 1);
      assert.equal(await db.hrReplay.count({ where: { companyId: f.company.id, requestId: body.requestId } }), 1);
      assert.equal(await db.hrEmploymentRevision.count({ where: { employment: { employeeId: replies[0]!.id } } }), 1);
      await assert.rejects(f.service.create(a.hr.auth, f.company.id, { ...body, employeeName: 'Different body' }), ConflictException);
    });
    await t.test('competing employment corrections have one winner and preserve prior facts', async () => {
      const changes = [1,2].map(n => f.service.employment(a.hr.auth, f.company.id, f.legacy.id,
        { requestId: randomUUID(), expectedVersion: 1, facts: hrFacts({ reason: 'Correction ' + n }) }));
      const outcomes = await Promise.allSettled(changes);
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter(x => x.status === 'rejected' && x.reason instanceof ConflictException).length, 1);
      const history = (await f.service.history(a.hr.auth, f.company.id, f.legacy.id)).employment!;
      assert.equal(history.currentVersion, 2); assert.deepEqual(history.revisions.map(r => r.version), [1,2]);
    });
    await t.test('competing private corrections preserve both the original snapshot and one next version', async () => {
      const outcomes = await Promise.allSettled([1,2].map(n => f.service.privateWrite(a.hr.auth, f.company.id, f.legacy.id, 'identity',
        { requestId: randomUUID(), expectedVersion: 1, values: { identityNumber: secretId + n }, reason: secretReason })));
      assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter(x => x.status === 'rejected' && x.reason instanceof ConflictException).length, 1);
      assert.equal((await f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'identity', 1)).values.identityNumber, secretId);
      assert.equal((await f.service.privateHistory(a.hr.auth, f.company.id, f.legacy.id, 'identity')).length, 2);
    });
    await t.test('new-code rehire and Company transfer link verified episodes without rewriting User/Project/history', async () => {
      const source = { companyId: f.company.id, employeeId: f.legacy.id, verificationReason: secretReason };
      const rehired = await f.service.create(a.hr.auth, f.company.id, { requestId: randomUUID(), employeeCode: 'REHIRE-' + f.suffix,
        employeeName: 'Synthetic rehire', facts: hrFacts(), predecessor: source });
      const moved = await f.service.create(a.hr.auth, f.other.id, { requestId: randomUUID(), employeeCode: 'TRANSFER-' + f.suffix,
        employeeName: 'Synthetic transfer', facts: hrFacts(), predecessor: source });
      assert.notEqual(rehired.id, f.legacy.id); assert.notEqual(moved.id, f.legacy.id);
      const links = await db.hrPersonLink.findMany({ where: { employeeId: { in: [f.legacy.id, rehired.id, moved.id] } } });
      assert.equal(links.length, 3); assert.equal(new Set(links.map(l => l.personId)).size, 1);
      assert.deepEqual(await db.employee.findUniqueOrThrow({ where: { id: f.legacy.id } }), original.employee);
      assert.deepEqual(await db.user.findUniqueOrThrow({ where: { id: f.legacyUser.id } }), original.user);
      assert.deepEqual(await db.projectMember.findUniqueOrThrow({ where: { id: f.legacyMember.id } }), original.member);
      await post(a.hr, foreign + '/employees', { requestId: randomUUID(), employeeCode: f.legacy.employeeCode.toUpperCase(),
        employeeName: 'Must use a new code', facts: hrFacts(), predecessor: source }, 409);
      await post(a.hr, root + '/employees', { requestId: randomUUID(), employeeCode: 'INVALID-' + f.suffix,
        employeeName: 'Invalid source', facts: hrFacts(), predecessor: { ...source, companyId: f.hidden.id } }, 404);
    });
    await t.test('master edits remain compatible until HR references exist; SQL protects historical identity and immutable revisions', async () => {
      const plain = await db.employee.create({ data: { companyId: f.company.id, employeeCode: 'PLAIN-' + f.suffix, employeeName: 'Unreferenced master' } });
      await call(a.hr, '/master-data/employees/' + plain.id, 200, 'PATCH', { employeeCode: 'EDITED-' + f.suffix });
      await call(a.hr, '/master-data/employees/' + f.legacy.id, 409, 'PATCH', { employeeCode: 'REWRITE-' + f.suffix });
      await assert.rejects(db.employee.update({ where: { id: f.legacy.id }, data: { employeeCode: 'FORGED-' + f.suffix } }));
      await assert.rejects(db.employee.update({ where: { id: f.legacy.id }, data: { companyId: f.other.id } }));
      const revision = await db.hrEmploymentRevision.findFirstOrThrow({ where: { employment: { employeeId: f.legacy.id } } });
      await assert.rejects(db.hrEmploymentRevision.update({ where: { id: revision.id }, data: { payBasis: 'MONTHLY' } }));
      await assert.rejects(db.hrEmploymentRevision.delete({ where: { id: revision.id } }));
      const link = await db.hrPersonLink.findFirstOrThrow({ where: { employeeId: f.legacy.id } });
      await assert.rejects(db.hrPersonLink.delete({ where: { id: link.id } }));
      await assert.rejects(db.hrPrivateRevision.deleteMany({ where: { employeeId: f.legacy.id } }));
    });
    await t.test('scope administration is target-owned, versioned, auditable and cannot grant self access', async () => {
      await post(a.admin, root + '/access', { requestId: randomUUID(), userId: a.admin.auth.userId, category: 'identity', isActive: true, expectedVersion: 0, reasonCode: 'OWNER_APPROVED_SCOPE' }, 403);
      await post(a.admin, foreign + '/access', { requestId: randomUUID(), userId: a.outsider.auth.userId, category: 'bank', isActive: true, expectedVersion: 0, reasonCode: 'OWNER_APPROVED_SCOPE' }, 404);
      const grant = { requestId: randomUUID(), userId: a.outsider.auth.userId, category: 'bank', isActive: true, expectedVersion: 0, reasonCode: 'OWNER_APPROVED_SCOPE' };
      const first = await post(a.admin, root + '/access', grant);
      assert.deepEqual((await post(a.admin, root + '/access', grant)).data, first.data);
      await post(a.outsider, employeeRoot + '/private/bank/reveal', { version: 1 }, 404); // entitlement alone grants no action.
      await post(a.admin, root + '/access', { ...grant, requestId: randomUUID() }, 409);
      const scopes = (await call(a.admin, root + '/access')).data.items;
      assert.ok(scopes.every((s: any) => !Object.hasOwn(s, 'ciphertext')));
      const keyConfig = process.env.HR_PRIVATE_KEYS;
      delete process.env.HR_PRIVATE_KEYS;
      try {
        // Revocation is technical metadata and does not depend on private keys.
        await post(a.admin, root + '/access', { ...grant, requestId: randomUUID(), isActive: false,
          expectedVersion: 1, reasonCode: 'ACCESS_REVOKED' });
        await assert.rejects(f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'bank', 1), ServiceUnavailableException);
      } finally { process.env.HR_PRIVATE_KEYS = keyConfig; }

    });
    await t.test('access pagination reaches every active and revoked grant and permits revoking a later-page grant', async () => {
      const users = Array.from({ length: 30 }, (_, index) => ({ id: randomUUID(), companyId: f.company.id,
        email: `scope-page-${index}-${f.suffix}@example.invalid`, displayName: 'Synthetic pagination subject', passwordHash: 'not-a-login' }));
      await db.user.createMany({ data: users });
      const grants = users.flatMap(user => ['employment','identity','bank','documents'].map(category => ({
        id: randomUUID(), companyId: f.company.id, userId: user.id, category, isActive: false,
        reasonCode: 'ACCESS_REVOKED', updatedByUserId: a.admin.auth.userId,
      })));
      await db.hrCompanyAccess.createMany({ data: grants });
      const ids = new Set<string>(grants.map(g => g.id));
      const expected = await db.hrCompanyAccess.findMany({ where: { companyId: f.company.id }, orderBy: { id: 'asc' } });
      const late = expected.filter(g => ids.has(g.id)).at(-1)!;
      assert.ok(expected.findIndex(g => g.id === late.id) >= 100);
      await db.hrCompanyAccess.update({ where: { id: late.id }, data: { isActive: true, version: late.version + 1 } });
      const seen: any[] = [];
      let after: string | null = null;
      do {
        const page: { items: any[]; nextCursor: string | null } = (await call(a.admin, root + '/access' + (after ? '?after=' + after : ''))).data;
        assert.ok(page.items.length > 0 && page.items.length <= 100);
        seen.push(...page.items);
        assert.ok(seen.length <= expected.length); // A repeated cursor must fail, not loop.
        assert.equal(page.nextCursor, seen.length < expected.length ? page.items.at(-1).id : null);
        after = page.nextCursor;
      } while (after !== null);
      assert.deepEqual(seen.map(g => g.id), expected.map(g => g.id));
      assert.equal(new Set(seen.map(g => g.id)).size, expected.length);
      assert.ok(seen.some(g => !g.isActive));
      const visible = seen.find(g => g.id === late.id)!;
      assert.equal(visible.isActive, true); assert.equal(visible.version, late.version + 1);
      await post(a.admin, root + '/access', { requestId: randomUUID(), userId: visible.userId, category: visible.category,
        isActive: false, expectedVersion: visible.version, reasonCode: 'ACCESS_REVOKED' });
      const revoked = await db.hrCompanyAccess.findUniqueOrThrow({ where: { id: late.id } });
      assert.equal(revoked.isActive, false); assert.equal(revoked.version, visible.version + 1);
      assert.deepEqual((await call(a.admin, root + '/access?after=' + seen.at(-1).id)).data, { items: [], nextCursor: null });
      await call(a.admin, root + '/access?after=invalid', 422);
      await call(a.admin, root + '/access?unexpected=1', 422);
      await call(a.hr, root + '/access?after=' + late.id, 403);
      await call(a.otherAdmin, root + '/access?after=' + late.id, 404);
      await call(a.admin, foreign + '/access?after=' + late.id, 404);
    });
    await t.test('revoked entitlements, inactive roles/Companies/users and revoked sessions fail on subsequent requests', async () => {
      const grant = await db.hrCompanyAccess.findUniqueOrThrow({ where: { companyId_userId_category: { companyId: f.company.id, userId: a.hr.auth.userId, category: 'bank' } } });
      await post(a.admin, root + '/access', { requestId: randomUUID(), userId: a.hr.auth.userId, category: 'bank', isActive: false, expectedVersion: grant.version, reasonCode: 'ACCESS_REVOKED' });
      await assert.rejects(f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'bank', 1), NotFoundException);
      await post(a.admin, root + '/access', { requestId: randomUUID(), userId: a.hr.auth.userId, category: 'bank', isActive: true, expectedVersion: grant.version + 1, reasonCode: 'SCOPE_CORRECTION' });
      await db.role.update({ where: { id: a.hr.role.id }, data: { isActive: false } });
      await assert.rejects(f.service.history(a.hr.auth, f.company.id, f.legacy.id), NotFoundException);
      await db.role.update({ where: { id: a.hr.role.id }, data: { isActive: true } });
      await db.company.update({ where: { id: f.other.id }, data: { isActive: false } });
      await call(a.hr, foreign + '/employees', 404);
      await db.company.update({ where: { id: f.other.id }, data: { isActive: true } });

      await db.user.update({ where: { id: a.nancy.user.id }, data: { isActive: false } });
      await post(a.nancy, employeeRoot + '/private/bank/reveal', { version: 1 }, 401);
      await assert.rejects(f.service.privateRead(a.nancy.auth, f.company.id, f.legacy.id, 'bank', 1), NotFoundException);
      await db.user.update({ where: { id: a.nancy.user.id }, data: { isActive: true } });
      await db.user.update({ where: { id: a.outsider.user.id }, data: { isActive: false } });
      await post(a.admin, root + '/access', { requestId: randomUUID(), userId: a.outsider.user.id, category: 'identity', isActive: true, expectedVersion: 0, reasonCode: 'OWNER_APPROVED_SCOPE' }, 404);
      await db.user.update({ where: { id: a.outsider.user.id }, data: { isActive: true } });
      await f.sessions.revoke(a.outsider.auth.sessionId);
      await call(a.outsider, '/hr/companies', 401);
    });
    await t.test('unknown fields, invalid dates and foreign Project references fail atomically with safe errors', async () => {
      const before = await db.employee.count();
      const draft = { requestId: randomUUID(), employeeCode: 'BAD-' + f.suffix, employeeName: 'Synthetic bad input', facts: hrFacts() };
      await post(a.hr, root + '/employees', { ...draft, salary: secretId }, 422);
      const bad = await post(a.hr, root + '/employees', { ...draft, facts: hrFacts({ startDate: '2026-02-30', reason: secretReason }) }, 422);
      assert.equal(JSON.stringify(bad).includes(secretReason), false);
      await post(a.hr, root + '/employees', { ...draft, facts: hrFacts({ projectId: f.foreignProject.id }) }, 404);
      await post(a.hr, employeeRoot + '/private/bank/revisions', { requestId: randomUUID(), expectedVersion: 1,
        values: { accountNumber: secretBank, salaryAmount: secretId }, reason: secretReason }, 422);
      assert.equal(await db.employee.count(), before);
    });
    await t.test('audit failure rolls back canonical Employee, history and replay together', async () => {
      class FailingAudit extends AuditService { override async record(): Promise<void> { throw new Error('Synthetic audit unavailable'); } }
      const failing = new HrService(db, new FailingAudit(db), f.projects, f.crypto, new LocalDocumentStorage(), new DocumentPolicyService());
      const before = await db.employee.count(), requestId = randomUUID();
      await assert.rejects(failing.create(a.hr.auth, f.company.id, { requestId, employeeCode: 'ROLLBACK-' + f.suffix, employeeName: 'Must roll back', facts: hrFacts() }));
      assert.equal(await db.employee.count(), before); assert.equal(await db.hrReplay.count({ where: { requestId } }), 0);
    });
    await t.test('key rotation retains historical decrypt/replay; missing and removed keys fail safely', async () => {
      const request = { requestId: randomUUID(), expectedVersion: 1, values: { accountNumber: secretBank + '_V2' }, reason: secretReason };
      const first = await f.service.privateWrite(a.hr.auth, f.company.id, f.legacy.id, 'bank', request);
      process.env.HR_PRIVATE_KEYS = JSON.stringify({ ...keys, test2: randomBytes(32).toString('base64') }); process.env.HR_PRIVATE_ACTIVE_KEY_ID = 'test2';
      assert.deepEqual(await f.service.privateWrite(a.hr.auth, f.company.id, f.legacy.id, 'bank', request), first);
      assert.equal((await f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'bank', 1)).values.accountNumber, secretBank);
      const rotated = process.env.HR_PRIVATE_KEYS;
      delete process.env.HR_PRIVATE_KEYS;
      await assert.rejects(f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'bank', 1), ServiceUnavailableException);
      process.env.HR_PRIVATE_KEYS = JSON.stringify({ test2: JSON.parse(rotated!).test2 });
      await assert.rejects(f.service.privateRead(a.hr.auth, f.company.id, f.legacy.id, 'bank', 1), ServiceUnavailableException);
      process.env.HR_PRIVATE_KEYS = JSON.stringify(keys); process.env.HR_PRIVATE_ACTIVE_KEY_ID = 'test1';
    });
    await t.test('dedicated HR attachment history denies cross-scope, forged grants and private metadata leaks', async () => {
      const view = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'hr.documents.view' } });
      const manage = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'hr.documents.manage' } });
      await db.rolePermission.createMany({ data: [
        { roleId: a.hr.role.id, permissionId: view.id },
        { roleId: a.hr.role.id, permissionId: manage.id },
        { roleId: a.nancy.role.id, permissionId: view.id },
      ] });
      await db.hrCompanyAccess.createMany({ data: [a.hr, a.nancy].map(actor => ({
        companyId: f.company.id, userId: actor.user.id, category: 'documents',
        reasonCode: 'OWNER_APPROVED_SCOPE', updatedByUserId: a.admin.user.id,
      })) });
      const type = await db.documentType.create({ data: {
        companyId: f.company.id, documentTypeCode: 'HR-READ-' + f.suffix,
        documentTypeName: 'Generic synthetic document type',
      } });
      const doc = await db.document.create({ data: {
        companyId: f.company.id, documentTypeId: type.id,
        fileName: 'hr-private.enc', mimeType: 'application/octet-stream',
        fileSizeBytes: 345, storageProvider: 'LOCAL', storageKey: randomUUID(),
        checksum: 'b'.repeat(64), uploadedByUserId: a.hr.user.id,
      } });
      await db.documentLink.create({ data: {
        documentId: doc.id, entityType: 'HR_ATTACHMENT',
        entityId: f.legacy.id, linkedByUserId: a.hr.user.id,
      } });
      const attachment = await db.hrDocumentAttachment.create({ data: {
        companyId: f.company.id, employeeId: f.legacy.id,
        documentId: doc.id, version: 1,
        encryptedMetadata: '{"v":1,"k":"synthetic","n":"nonce","t":"tag","c":"fake-synthetic-ciphertext"}',
        actorUserId: a.hr.user.id,
      } });
      const path = employeeRoot + '/documents';
      for (const actor of [a.hr, a.nancy]) {
        const data = (await call(actor, path)).data;
        assert.deepEqual(data.items, [{ id: attachment.id, version: 1, createdAt: attachment.createdAt.toISOString() }]);
        assert.equal(data.nextCursor, null);
        const response = JSON.stringify(data);
        for (const forbidden of ['storageKey', 'checksum', 'encryptedMetadata', 'fileName', 'mimeType', 'documentTypeId', doc.id, doc.storageKey])
          assert.equal(response.includes(forbidden), false);
      }
      assert.deepEqual((await call(a.hr, path + '?after=1')).data, { items: [], nextCursor: null });
      assert.deepEqual((await call(a.hr, path + '?after=0')).data.items.map((r: any) => r.id), [attachment.id]);
      for (const invalid of ['after=-1','after=01','after=xyz','after=2147483647','unexpected=1']) {
        await call(a.hr, path + '?' + invalid, 422);
      }
      for (const actor of [a.ben, a.porn, a.store, a.foreman, a.admin]) {
        await call(actor, path, 403);
      }
      // The earlier session-revocation contract intentionally revoked outsider:
      // authentication must fail (401) before any document permission check.
      await call(a.outsider, path, 401);
      await call(a.hr, root + '/employees/' + randomUUID() + '/documents', 404);
      await call(a.hr, foreign + '/employees/' + f.legacy.id + '/documents', 404);
      const docsGrant = await db.hrCompanyAccess.findUniqueOrThrow({ where: {
        companyId_userId_category: { companyId: f.company.id, userId: a.nancy.user.id, category: 'documents' },
      } });
      // HR entitlement changes are versioned and target-owned; exercise the
      // actual approval/administration route rather than bypassing SQL guards.
      await post(a.admin, root + '/access', {
        requestId: randomUUID(), userId: a.nancy.user.id,
        category: 'documents', isActive: false, expectedVersion: docsGrant.version,
        reasonCode: 'ACCESS_REVOKED',
      });
      await call(a.nancy, path, 404);
      await db.role.update({ where: { id: a.hr.role.id }, data: { isActive: false } });
      await call(a.hr, path, 403);
      await db.role.update({ where: { id: a.hr.role.id }, data: { isActive: true } });
    });

    await t.test('private encrypted HR upload/download is byte-exact, Company-scoped and replay safe', async () => {
      // The preceding attachment-history test created the employee's immutable
      // version 1 custody record using synthetic placeholder ciphertext.
      // This test exercises a REAL encrypted version 2 stored in disposable
      // memory->ciphertext storage, never an existing retained document.
      const type = await db.documentType.create({ data: {
        companyId: f.company.id, documentTypeCode: 'HRA-FILE-' + f.suffix,
        documentTypeName: 'Synthetic ordinary evidence type',
      } });
      const bytes = Buffer.from('SYNTHETIC-HR-DOCUMENT-BYTES-' + f.suffix, 'utf8');
      const documentPath = employeeRoot + '/documents';
      const foreignType = await db.documentType.create({ data: {
        companyId: f.other.id, documentTypeCode: 'HRA-FOREIGN-' + f.suffix,
        documentTypeName: 'Synthetic foreign-Company type',
      } });
      const inactiveType = await db.documentType.create({ data: {
        companyId: f.company.id, documentTypeCode: 'HRA-INACTIVE-' + f.suffix,
        documentTypeName: 'Synthetic inactive evidence type', isActive: false,
      } });
      const options = (await call(a.hr, root + '/document-types')).data;
      assert.ok(options.items.some((item: any) => item.id === type.id));
      assert.equal(options.items.some((item: any) => item.id === foreignType.id), false);
      assert.equal(options.items.some((item: any) => item.id === inactiveType.id), false);
      assert.ok(options.items.every((item: any) =>
        Object.keys(item).sort().join(',') === 'documentTypeCode,documentTypeName,id'));
      await call(a.ben, root + '/document-types', 403);
      await call(a.nancy, root + '/document-types', 403);
      await call(a.hr, root + '/document-types?after=not-a-uuid', 422);
      await call(a.hr, root + '/document-types?unrecognized=1', 422);
      await call(a.hr, foreign + '/document-types', 404);
      const requestId = randomUUID();
      const upload = (actor: Actor, key: string, expectedVersion = '1',
        payload = bytes, csrf = true) => {
        const form = new FormData();
        form.set('requestId', key);
        form.set('documentTypeId', type.id);
        form.set('expectedVersion', expectedVersion);
        form.set('file', new Blob([payload], { type: 'text/plain' }), 'synthetic-private.txt');
        return fetch(base + documentPath, { method: 'POST',
          headers: { Cookie: 'erp_session=' + actor.session.sessionToken,
            ...(csrf ? { 'x-csrf-token': actor.session.csrfToken } : {}) },
          body: form,
        });
      };
      const blocked = await upload(a.ben, randomUUID());
      assert.equal(blocked.status, 403);
      const noCsrf = await upload(a.hr, randomUUID(), '1', bytes, false);
      assert.equal(noCsrf.status, 403);
      // No completed upload may be created by a rejected or revoked actor.
      const storedBefore = await db.hrDocumentAttachment.count({ where: { companyId: f.company.id, employeeId: f.legacy.id } });
      const deniedBytes = Buffer.from('PRIVATE-REJECTED-ACCESS');
      await assert.rejects(f.service.uploadDocument(a.ben.auth, f.company.id,
        f.legacy.id, { requestId: randomUUID(), documentTypeId: type.id, expectedVersion: '1' },
        { originalname: 'synthetic-private.txt', mimetype: 'text/plain', buffer: deniedBytes }));
      assert.ok(deniedBytes.every(byte => byte === 0), 'Rejected private upload buffers must be erased');
      const rejectedMime = Buffer.from('PRIVATE-INVALID-MIME');
      await assert.rejects(f.service.uploadDocument(a.hr.auth, f.company.id,
        f.legacy.id, { requestId: randomUUID(), documentTypeId: type.id, expectedVersion: '1' },
        { originalname: 'synthetic-private.txt', mimetype: 'application/x-executable', buffer: rejectedMime }));
      assert.ok(rejectedMime.every(byte => byte === 0), 'Invalid private MIME bytes must be erased');
      assert.equal(await db.hrDocumentAttachment.count({
        where: { companyId: f.company.id, employeeId: f.legacy.id },
      }), storedBefore);
      const response = await upload(a.hr, requestId);
      assert.equal(response.status, 201, await response.clone().text());
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      const receipt = (await response.json() as any).data;
      assert.equal(receipt.version, 2);
      const row = await db.hrDocumentAttachment.findUniqueOrThrow({ where: { id: receipt.id },
        include: { document: true } });
      assert.equal(row.companyId, f.company.id);
      assert.equal(row.employeeId, f.legacy.id);
      assert.equal(row.document.fileName, 'hr-private.enc');
      assert.equal(row.document.mimeType, 'application/octet-stream');
      assert.notEqual(row.document.checksum, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(JSON.stringify(row).includes(bytes.toString('utf8')), false);
      assert.equal(JSON.stringify(row).includes('synthetic-private.txt'), false);
      assert.deepEqual((await db.documentLink.findMany({ where: { documentId: row.documentId } }))
        .map(l => [l.entityType, l.entityId]), [['HR_ATTACHMENT', f.legacy.id]]);
      const storagePath = path.join(temporaryHrStorage, row.document.storageKey);
      const cipher = await readFile(storagePath);
      assert.equal(cipher.includes(bytes), false);
      assert.equal(createHash('sha256').update(cipher).digest('hex'), row.document.checksum);

      const download = (actor: Actor, pathSuffix = '/' + receipt.id + '/download') => fetch(
        base + documentPath + pathSuffix, {
          headers: { Cookie: 'erp_session=' + actor.session.sessionToken },
        });
      const authorized = await download(a.hr);
      assert.equal(authorized.status, 200, await authorized.clone().text());
      assert.equal(authorized.headers.get('cache-control'), 'private, no-store');
      assert.equal(authorized.headers.get('content-type')?.startsWith('text/plain'), true);
      assert.deepEqual(Buffer.from(await authorized.arrayBuffer()), bytes);
      assert.match(authorized.headers.get('content-disposition') ?? '', /synthetic-private.txt/);
      for (const actor of [a.ben,a.porn,a.store,a.foreman,a.admin]) {
        const denied = await download(actor);
        assert.equal(denied.status, 403);
      }
      assert.equal((await download(a.nancy)).status, 404);
      assert.equal((await fetch(base + foreign + '/employees/' + f.legacy.id + '/documents/' + receipt.id + '/download', {
        headers: { Cookie: 'erp_session=' + a.hr.session.sessionToken },
      })).status, 404);

      const replay = await upload(a.hr, requestId);
      assert.equal(replay.status, 201, await replay.clone().text());
      assert.deepEqual((await replay.json() as any).data, receipt);
      assert.equal(await db.hrDocumentAttachment.count({ where: {
        companyId: f.company.id, employeeId: f.legacy.id,
      } }), 2);
      assert.equal((await readdir(temporaryHrStorage)).filter(name => /^[0-9a-f]{8}-/.test(name)).length, 1);
      const changed = await upload(a.hr, requestId, '1',
        Buffer.from('DIFFERENT-SYNTHETIC-PRIVATE-BYTES'));
      assert.equal(changed.status, 409);
      const stale = await upload(a.hr, randomUUID(), '1');
      assert.equal(stale.status, 409);
      assert.equal(await db.hrDocumentAttachment.count({ where: {
        companyId: f.company.id, employeeId: f.legacy.id,
      } }), 2);
      // An actual entitlement revocation must block the dedicated download
      // even for someone who previously downloaded the exact same bytes.
      const grant = await db.hrCompanyAccess.findUniqueOrThrow({ where: {
        companyId_userId_category: { companyId: f.company.id, userId: a.hr.user.id, category: 'documents' },
      } });
      await db.hrCompanyAccess.update({ where: { id: grant.id },
        data: { isActive: false, version: grant.version + 1, reasonCode: 'ACCESS_REVOKED' } });
      try {
        assert.equal((await download(a.hr)).status, 404);
        assert.notEqual((await upload(a.hr, randomUUID(), '2')).status, 201);
      } finally {
        await db.hrCompanyAccess.update({ where: { id: grant.id },
          data: { isActive: true, version: grant.version + 2, reasonCode: 'SCOPE_CORRECTION' } });
      }

      const savedKeysForFailure = process.env.HR_PRIVATE_KEYS;
      delete process.env.HR_PRIVATE_KEYS;
      try {
        const noKey = await download(a.hr);
        assert.equal(noKey.status, 503);
        assert.equal((await noKey.text()).includes(bytes.toString('utf8')), false);
      } finally { process.env.HR_PRIVATE_KEYS = savedKeysForFailure; }
      const originalCipher = Buffer.from(cipher);
      await writeFile(storagePath, Buffer.from('SYNTHETIC-TAMPERED-CIPHERTEXT'));
      try {
        const tampered = await download(a.hr);
        assert.notEqual(tampered.status, 200);
      } finally { await writeFile(storagePath, originalCipher); }
      const restoredDownload = await download(a.hr);
      assert.equal(restoredDownload.status, 200);
      assert.deepEqual(Buffer.from(await restoredDownload.arrayBuffer()), bytes);
    });

    await t.test('private payloads/history/replay/audit remain encrypted or metadata-only; excluded ledgers are untouched', async () => {
      const companyIds = [f.company.id,f.other.id];
      const rows = await Promise.all([db.hrEmploymentRevision.findMany({ where: { companyId: { in: companyIds } } }),
        db.hrPrivateRevision.findMany({ where: { companyId: { in: companyIds } } }), db.hrPersonLink.findMany({ where: { companyId: { in: companyIds } } }),
        db.hrReplay.findMany({ where: { companyId: { in: companyIds } } }), db.auditLog.findMany({ where: { companyId: { in: companyIds }, entityType: 'HR' } })]);
      for (const secret of [secretId,secretBank,secretReason]) assert.equal(JSON.stringify(rows).includes(secret), false);
      assert.deepEqual(await counts(), financialBefore);
    });
  } finally {
    await app.close(); await db.$disconnect();
    if (savedKeys === undefined) delete process.env.HR_PRIVATE_KEYS; else process.env.HR_PRIVATE_KEYS = savedKeys;
    if (savedActive === undefined) delete process.env.HR_PRIVATE_ACTIVE_KEY_ID; else process.env.HR_PRIVATE_ACTIVE_KEY_ID = savedActive;
    if (savedStorage === undefined) delete process.env.STORAGE_ROOT; else process.env.STORAGE_ROOT = savedStorage;
    await rm(temporaryHrStorage, { recursive: true, force: true });
  }
});
