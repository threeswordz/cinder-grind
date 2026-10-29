import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException, ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerBoqService } from './customer-boq.service';
import { customerBoqFixture } from './customer-boq-test-fixture';

// Disposable database only: the normal registered suite/upgrade rehearsal supplies DATABASE_URL.
// Disposable persisted roles only; no person-name checks or retained fixtures.

test('Customer BOQ persistence uses real scoped grants, immutable history, configured approvals and transaction safety', async (t) => {
  const db = new PrismaService(); await db.$connect();
  try {
    const f = await customerBoqFixture(db);
    const foreign = await customerBoqFixture(db);
    const { service, maker, checker, editor, project, input } = f;
    const ctx = { auth: maker }, pid = project.id;
    const originalSource = await db.budgetRevision.findUniqueOrThrow({ where: { id: f.source.id }, include: { lines: true } });
    const beforeFinancial = await Promise.all([db.stockTransaction.count(), db.payment.count(), db.directCostPosting.count()]);
    let version!: Awaited<ReturnType<CustomerBoqService['create']>>;
    let submitted!: Awaited<ReturnType<CustomerBoqService['submit']>>;
    let instance!: string;

    await t.test('create stores approved source IDs, exact inputs/results and cost snapshots; receipt discloses no money', async () => {
      version = await service.create(ctx, pid, randomUUID(), input());
      assert.deepEqual(Object.keys(version).sort(), ['approvalState', 'editNo', 'id']);
      const { version: stored } = await service.history(maker, pid, version.id);
      assert.equal(stored.currencyCode, 'THB'); assert.equal(stored.sourceRevisionId, f.source.id);
      assert.equal(stored.edits[0]!.totalAmount.toFixed(2), '1200.00');
      const line = stored.edits[0]!.lines[0]!;
      assert.equal(line.rate.toFixed(4), '120.0000'); assert.equal(line.mappings[0]!.sourceLineId, f.sourceLine.id);
      assert.equal(line.mappings[0]!.allocatedCost.toFixed(10), '1000.0000000000');
      assert.equal((line.mappings[0]!.sourceSnapshot as { amount: string }).amount, '1000.0000');
    });
    await t.test('persisted markup keeps the adopted rate-first discrepancy and ten-place allocated cost', async () => {
      const draft = input();
      draft.lines = [{ lineId: randomUUID(), description: 'Allocated customer work', quantity: '300', uomId: f.uom.id,
        method: 'MARKUP', markupPercent: '0', mappingReason: 'Allocate 0.1 percent of approved cost to independent customer quantity',
        mappings: [{ sourceLineId: f.sourceLine.id, sharePercent: '0.1' }] }];
      const receipt = await service.create(ctx, pid, randomUUID(), draft);
      const row = (await service.history(maker, pid, receipt.id)).version.edits[0]!;
      assert.equal(row.totalAmount.toFixed(2), '0.99');
      const line = row.lines[0]!;
      assert.equal(line.rate.toFixed(4), '0.0033');
      assert.equal(line.mappings[0]!.allocatedCost.toFixed(10), '1.0000000000');
      assert.equal((line.pricingSnapshot as { targetAmount: string }).targetAmount, '1.00');
      assert.equal((line.pricingSnapshot as { rateRoundingDifference: string }).rateRoundingDifference, '-0.01');
    });
    await t.test('identical concurrent retries return one immutable receipt and create one version/audit', async () => {
      const request = randomUUID(); const count = await db.customerBoqVersion.count({ where: { projectId: pid } });
      const results = await Promise.all([service.create(ctx, pid, request, input()), service.create(ctx, pid, request, input())]);
      assert.deepEqual(results[0], results[1]); assert.equal(await db.customerBoqVersion.count({ where: { projectId: pid } }), count + 1);
      assert.equal(await db.auditLog.count({ where: { entityType: 'CUSTOMER_BOQ', entityId: results[0]!.id, action: 'CREATE' } }), 1);
      await assert.rejects(service.create(ctx, pid, request, input('115')), ConflictException);
    });
    await t.test('distinct concurrent creates allocate distinct Project version numbers', async () => {
      const receipts = await Promise.all([service.create(ctx, pid, randomUUID(), input()), service.create(ctx, pid, randomUUID(), input())]);
      const rows = await db.customerBoqVersion.findMany({ where: { id: { in: receipts.map((r) => r.id) } } });
      assert.equal(new Set(rows.map((r) => r.versionNo)).size, 2);
    });
    await t.test('forged caller roles/permissions, SYS_ADMIN label, unassigned Project and foreign Company cannot read or write', async () => {
      const fake = { ...f.outsider, permissions: [...maker.permissions, 'projects.access_all'], roleCodes: ['SYS_ADMIN'] };
      await assert.rejects(service.history(fake, pid, version.id), ForbiddenException);
      await assert.rejects(service.create({ auth: fake }, pid, randomUUID(), input()), ForbiddenException);
      await assert.rejects(service.history(foreign.maker, pid, version.id), NotFoundException);
      await assert.rejects(service.history(maker, foreign.project.id, version.id), NotFoundException);
    });
    await t.test('missing/unapproved/cross-scope source and foreign UOM/mapping fail without a partial version or replay', async () => {
      const count = await db.customerBoqVersion.count({ where: { projectId: pid } });
      for (const sourceRevisionId of [randomUUID(), f.pending.id, foreign.source.id]) await assert.rejects(service.create(ctx, pid, randomUUID(), { ...input(), sourceRevisionId }), UnprocessableEntityException);
      const badUom = input(); badUom.lines[0]!.uomId = foreign.uom.id;
      await assert.rejects(service.create(ctx, pid, randomUUID(), badUom), UnprocessableEntityException);
      const badMap = input(); badMap.lines[0]!.mappings = [{ sourceLineId: foreign.sourceLine.id, sharePercent: '100' }];
      await assert.rejects(service.create(ctx, pid, randomUUID(), badMap), UnprocessableEntityException);
      assert.equal(await db.customerBoqVersion.count({ where: { projectId: pid } }), count);
    });
    await t.test('persisted UOM precision and canonical identities reject spoofed inputs and aliases', async () => {
      const draft = input(); draft.lines[0]!.quantity = '0.5'; draft.lines[0]!.mappingReason = 'Fractional';
      Object.assign(draft.lines[0]!, { uomDecimalPlaces: 4, previousRate: '999' });
      await assert.rejects(service.create(ctx, pid, randomUUID(), draft), UnprocessableEntityException);
      const alias = input(); alias.lines[0]!.lineId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
      await assert.rejects(service.create(ctx, pid, randomUUID(), alias), UnprocessableEntityException);
    });
    await t.test('competing edits have exactly one winner; persisted prior rate and reason are retained', async () => {
      const outcomes = await Promise.allSettled([service.edit(ctx, pid, randomUUID(), version.id, 1, { ...input('115'), reason: 'Negotiated discount' }),
        service.edit({ auth: editor }, pid, randomUUID(), version.id, 1, { ...input('110'), reason: 'Other negotiation' })]);
      assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((x) => x.status === 'rejected' && x.reason instanceof ConflictException).length, 1);
      const { version: row } = await service.history(maker, pid, version.id);
      assert.equal(row.edits.length, 2); assert.equal(row.edits[0]!.totalAmount.toFixed(2), '1200.00');
      const snapshot = row.edits[1]!.lines[0]!.pricingSnapshot as { previousRate: string; pricingReason: string };
      assert.equal(snapshot.previousRate, '120.0000'); assert.ok(snapshot.pricingReason);
    });
    await t.test('audit failure rolls back version, lines, mappings and replay atomically', async () => {
      class FailingAudit extends AuditService { override async record(): Promise<void> { throw new Error('isolated audit failure'); } }
      const failing = new CustomerBoqService(db, f.access, new FailingAudit(db), f.approvals);
      const count = await db.customerBoqVersion.count({ where: { projectId: pid } }); const request = randomUUID();
      await assert.rejects(failing.create(ctx, pid, request, input()), /isolated audit failure/);
      assert.equal(await db.customerBoqVersion.count({ where: { projectId: pid } }), count);
      assert.equal(await db.customerBoqReplay.count({ where: { requestId: request } }), 0);
    });
    await t.test('database denies update/delete and append into a retained edit, including before submission', async () => {
      const edit = await db.customerBoqEdit.findFirstOrThrow({ where: { versionId: version.id, editNo: 1 } });
      const line = await db.customerBoqLine.findFirstOrThrow({ where: { editId: edit.id } });
      await assert.rejects(db.customerBoqEdit.update({ where: { id: edit.id }, data: { reason: 'Rewrite' } }), /append-only/);
      await assert.rejects(db.customerBoqLine.delete({ where: { id: line.id } }), /append-only/);
      await assert.rejects(db.customerBoqLine.create({ data: { ...line, id: randomUUID(), lineKey: randomUUID(), uomSnapshot: line.uomSnapshot as Prisma.InputJsonValue, pricingSnapshot: line.pricingSnapshot as Prisma.InputJsonValue } }), /retained Customer BOQ edit/);
      await assert.rejects(db.customerBoqVersion.delete({ where: { id: version.id } }), /cannot be deleted/);
    });
    await t.test('submission requires configured workflow; freezes contents; stale instance and self-approval fail', async () => {
      await assert.rejects(service.submit(ctx, pid, randomUUID(), version.id, 2, 'MISSING'), UnprocessableEntityException);
      assert.equal((await service.history(maker, pid, version.id)).version.approvalInstanceId, null);
      submitted = await service.submit(ctx, pid, randomUUID(), version.id, 2, f.wf.workflowCode);
      instance = (await service.history(maker, pid, version.id)).version.approvalInstanceId!;
      assert.equal(submitted.approvalState, 'SUBMITTED');
      await assert.rejects(service.edit(ctx, pid, randomUUID(), version.id, 2, input()), ConflictException);
      await assert.rejects(service.decide({ auth: checker }, pid, randomUUID(), version.id, randomUUID(), 'APPROVE', 'stale'), ConflictException);
      await assert.rejects(service.decide(ctx, pid, randomUUID(), version.id, instance, 'APPROVE', 'self'), ForbiddenException);
    });
    await t.test('explicit action grants never bypass the configured approval step role', async () => {
      const otherRole = await db.role.create({ data: { companyId: f.company.id, roleCode: 'OTHER', roleName: 'Other commercial role',
        rolePermissions: { create: maker.permissions.map((permissionCode) => ({ permission: { connect: { permissionCode } } })) } } });
      await db.userRole.deleteMany({ where: { userId: checker.userId } });
      await db.userRole.create({ data: { companyId: f.company.id, userId: checker.userId, roleId: otherRole.id } });
      try {
        await assert.rejects(service.decide({ auth: checker }, pid, randomUUID(), version.id, instance, 'APPROVE', 'Wrong configured step role'), ForbiddenException);
        assert.equal((await service.history(checker, pid, version.id)).version.approvalInstance?.approvalState, 'SUBMITTED');
      } finally {
        await db.userRole.deleteMany({ where: { userId: checker.userId } });
        await db.userRole.create({ data: { companyId: f.company.id, userId: checker.userId, roleId: f.role.id } });
      }
    });
    await t.test('rejection, new edit, resubmission and concurrent approvals preserve old instance/actions and yield one final decision', async () => {
      await service.decide({ auth: checker }, pid, randomUUID(), version.id, instance, 'REJECT', 'Revise offer');
      const edit = await service.edit(ctx, pid, randomUUID(), version.id, 2, { ...input('112'), reason: 'Revised offer' });
      assert.equal(edit.editNo, 3);
      await service.submit(ctx, pid, randomUUID(), version.id, 3, f.wf.workflowCode);
      const fresh = (await service.history(maker, pid, version.id)).version.approvalInstanceId!;
      assert.notEqual(fresh, instance);
      const outcomes = await Promise.allSettled([service.decide({ auth: checker }, pid, randomUUID(), version.id, fresh, 'APPROVE', 'Approved'), service.decide({ auth: checker }, pid, randomUUID(), version.id, fresh, 'APPROVE', 'Duplicate')]);
      assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
      assert.equal(outcomes.filter((x) => x.status === 'rejected' && x.reason instanceof ConflictException).length, 1);
      const history = await service.history(maker, pid, version.id);
      assert.equal(history.version.approvalInstance?.approvalState, 'APPROVED');
      assert.deepEqual(history.approvals.map((a) => a.approvalState).sort(), ['APPROVED', 'REJECTED']);
      assert.equal(history.approvals.reduce((n, a) => n + a.actions.length, 0), 2);
      await assert.rejects(service.edit(ctx, pid, randomUUID(), version.id, 3, input()), ConflictException);
      await assert.rejects(db.customerBoqVersion.update({ where: { id: version.id }, data: { currentEditNo: 4 } }), /immutable/);
    });
    await t.test('approved change creates new linked version; earlier history remains byte-for-byte stable', async () => {
      const before = JSON.stringify(await service.history(maker, pid, version.id));
      const next = await service.create(ctx, pid, randomUUID(), { ...input('113'), previousVersionId: version.id, reason: 'New commercial revision' });
      assert.notEqual(next.id, version.id); assert.equal(next.approvalState, 'DRAFT');
      assert.equal((await service.history(maker, pid, next.id)).version.previousVersionId, version.id);
      assert.equal(JSON.stringify(await service.history(maker, pid, version.id)), before);
    });
    await t.test('revoking a persisted capability denies prior history and replay despite stale caller flags', async () => {
      const request = randomUUID(); await service.create(ctx, pid, request, input());
      const permission = await db.permission.findUniqueOrThrow({ where: { permissionCode: 'budget.customer.view' } });
      await db.rolePermission.delete({ where: { roleId_permissionId: { roleId: f.role.id, permissionId: permission.id } } });
      await assert.rejects(service.history(maker, pid, version.id), ForbiddenException);
      await assert.rejects(service.create(ctx, pid, request, input()), ForbiddenException);
    });
    await t.test('all operations leave approved source and stock/payment/direct-cost ledgers unchanged', async () => {
      assert.deepEqual(await db.budgetRevision.findUniqueOrThrow({ where: { id: f.source.id }, include: { lines: true } }), originalSource);
      assert.deepEqual(await Promise.all([db.stockTransaction.count(), db.payment.count(), db.directCostPosting.count()]), beforeFinancial);
    });
  } finally { await db.$disconnect(); }
});
