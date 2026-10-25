import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AdministrationService } from '../administration/administration.service';
import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { DirectCostService } from '../cost-control/direct-cost.service';
import { ProjectVariationService } from '../cost-control/project-variation.service';
import { CostControlService } from '../cost-control/cost-control.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SubcontractsCertificationService } from '../subcontracts/subcontracts-certification.service';
import { legacyFixture } from './legacy-fixture';

export async function verifyThbUpgrade(prisma: PrismaService, requireRetention: boolean) {
  const fixture = legacyFixture();
  const authorization = new AuthorizationService();
  const access = new ProjectAccessService(prisma, new ProjectScopeService(authorization));
  const audit = new AuditService(prisma);
  const approvals = new ApprovalService(prisma);
  const numbers = new NumberSequenceService(prisma);
  const administration = new AdministrationService(prisma, audit, numbers);
  const directCost = new DirectCostService(prisma, access, approvals, audit);
  const variations = new ProjectVariationService(prisma, access, approvals, audit);
  async function actualAuth(id: string): Promise<AuthenticatedUserContext> {
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: {
      userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
    } });
    return { sessionId: randomUUID(), companyId: user.companyId, userId: user.id, email: user.email,
      displayName: user.displayName, csrfTokenHash: '0'.repeat(64),
      roleCodes: user.userRoles.filter((r) => r.role.isActive).map((r) => r.role.roleCode),
      permissions: [...new Set(user.userRoles.filter((r) => r.role.isActive).flatMap((r) => r.role.rolePermissions.map((p) => p.permission.permissionCode)))],
    };
  }
  const maker = await actualAuth(fixture.userId);
  const checker = await actualAuth(fixture.checkerId);
  assert.ok(maker.permissions.includes('admin.company.manage'));
  if (requireRetention) {
    assert.equal((await prisma.company.findUniqueOrThrow({ where: { id: fixture.companyId } })).baseCurrencyCode, 'SGD');
    await assert.rejects(prisma.purchaseOrder.create({ data: {
      companyId: fixture.companyId, projectId: fixture.projectId, supplierId: fixture.supplierId,
      poNumber: 'DENIED-' + randomUUID(), createdByUserId: fixture.userId,
    } }), /ERP_THB_COMPANY_REQUIRED/);
  }
  await administration.updateCompany({ auth: maker }, { baseCurrencyCode: 'THB' });
  assert.ok(await prisma.auditLog.count({ where: { companyId: maker.companyId, entityType: 'COMPANY', action: 'UPDATE_SETTINGS' } }));
  assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: fixture.knownPoId } })).currencyCode, 'SGD');
  assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: fixture.unknownPoId } })).currencyCode, null);
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: fixture.projectId } })).contractCurrencyCode, null);
  for (const [table, id] of [['purchase_orders',fixture.knownPoId],['purchase_orders',fixture.unknownPoId],
    ['budget_revisions',fixture.knownBudgetId],['budget_revisions',fixture.unknownBudgetId],['boqs',fixture.boqId]]) {
    await assert.rejects(prisma.$queryRawUnsafe('SELECT erp_thb_assert_source($1::text, $2::uuid)', table, id), /ERP_THB/);
  }
  await assert.rejects(prisma.project.update({ where: { id: fixture.projectId }, data: { contractValue: '999999' } }), /ERP_THB/);
  await assert.rejects(new CostControlService(prisma, access).projectCostControl(maker, fixture.projectId),
    (error: unknown) => !!error && typeof error === 'object' && 'getResponse' in error && JSON.stringify((error as { getResponse(): unknown }).getResponse()).includes('COST_CONTROL_CURRENCY_UNVERIFIED'));
  // Exact historical correction remains source-linked and denominated SGD,
  // including retries after the Company's deliberate THB transition.
  const prior = await prisma.directCostPosting.findFirst({ where: { reversesPostingId: fixture.directCostId, state: { not: 'REJECTED' } } });
  const reversalInput = { postingDate: prior?.postingDate ?? new Date('2026-10-04'),
    reason: prior?.reversalReason ?? 'Exact historical correction after THB transition',
    reference: prior?.reference ?? null, createKey: prior?.createKey ?? randomUUID() };
  const reversed = await directCost.createReversal({ auth: maker }, fixture.directCostId, reversalInput);
  assert.equal(reversed.currencyCode, 'SGD');
  assert.equal(reversed.amount.toFixed(2), '-88.75');
  const retries = await Promise.all([1,2].map(() => directCost.createReversal({ auth: maker }, fixture.directCostId, reversalInput)));
  assert.ok(retries.every((r) => r.id === reversed.id));
  await assert.rejects(directCost.createReversal({ auth: maker }, fixture.directCostId, { ...reversalInput, reason: 'Changed payload' }));
  await assert.rejects(directCost.update({ auth: maker }, reversed.id, { amount: new Prisma.Decimal('-1') }));
  if (reversed.state === 'DRAFT') {
    await directCost.submit({ auth: maker }, reversed.id, fixture.directCostWorkflow, randomUUID());
    await assert.rejects(directCost.approve({ auth: maker }, reversed.id, randomUUID()));
    const approved = await directCost.approve({ auth: checker }, reversed.id, randomUUID());
    assert.equal(approved.state, 'APPROVED');
  }
  assert.equal(await prisma.directCostPosting.count({ where: { reversesPostingId: fixture.directCostId } }), 1);
  const variationInput = { variationNumber: 'LEGACY-PV-CORRECTION-' + randomUUID().slice(0, 8), reason: 'Exact original-currency commercial correction', createKey: randomUUID() };
  const variation = await variations.createReversal({ auth: maker }, fixture.projectVariationId, variationInput);
  assert.equal(variation.currencyCode, 'SGD');
  assert.equal(variation.valueDelta.toFixed(2), '-25.50');
  await variations.submit({ auth: maker }, variation.id, fixture.projectVariationWorkflow, randomUUID());
  await assert.rejects(variations.approve({ auth: maker }, variation.id, randomUUID()));
  await variations.approve({ auth: checker }, variation.id, randomUUID());
  const replay = await variations.createReversal({ auth: maker }, fixture.projectVariationId, variationInput);
  assert.equal(replay.id, variation.id);
  await assert.rejects(variations.createReversal({ auth: maker }, fixture.projectVariationId, { ...variationInput, reason: 'Changed payload' }));
  await assert.rejects(directCost.get({ ...maker, companyId: randomUUID() }, fixture.directCostId));
  if (requireRetention) {
    const certification = await prisma.subcontractCertification.findFirst({ where: { state: 'APPROVED', currencyCode: 'SGD',
      retainedAmount: { gt: '0' }, retentionLedgerEntries: { some: { entryType: 'WITHHOLDING' }, none: { entryType: 'REVERSAL' } },
      paymentAllocations: { none: {} },
    } });
    assert.ok(certification?.approvedByUserId, 'Real previous-runtime fixture must include an unpaid retained certification');
    const administrator = await prisma.user.findFirstOrThrow({ where: { companyId: certification.companyId, email: 'rc-admin@example.invalid' } });
    const adminAuth = await actualAuth(administrator.id);
    assert.ok(adminAuth.permissions.includes('admin.company.manage'));
    await administration.updateCompany({ auth: adminAuth }, { baseCurrencyCode: 'THB' });
    // Reconstruct the immutable original request from its real CREATE audit,
    // rather than its subsequently edited fields. Exact historical retries are
    // reads; changed payloads remain conflicts after the Company transition.
    const historical = await prisma.directCostPosting.findFirstOrThrow({ where: {
      companyId: certification.companyId, currencyCode: 'SGD', reversesPostingId: null, state: 'APPROVED',
    } });
    const originalAudit = await prisma.auditLog.findFirstOrThrow({ where: {
      entityType: 'DIRECT_COST_POSTING', entityId: historical.id, action: 'CREATE_DRAFT',
    } });
    const original = originalAudit.newValues as Record<string, Prisma.JsonValue>;
    const originalMaker = await actualAuth(historical.createdByUserId);
    assert.ok(originalMaker.permissions.includes('cost.direct_posting.create'));
    const originalInput = {
      postingDate: new Date(String(original.postingDate)), description: String(original.description),
      reference: original.reference === null ? null : String(original.reference),
      amount: new Prisma.Decimal(String(original.amount)), wbsId: original.wbsId === null ? null : String(original.wbsId),
      costCodeId: String(original.costCodeId), createKey: historical.createKey,
    };
    const countsBefore = [await prisma.directCostPosting.count(), await prisma.auditLog.count()];
    const historicalRetries = await Promise.all([1,2].map(() => directCost.create({ auth: originalMaker }, historical.projectId, originalInput)));
    assert.ok(historicalRetries.every((row) => row.id === historical.id && row.currencyCode === 'SGD'));
    await assert.rejects(directCost.create({ auth: originalMaker }, historical.projectId,
      { ...originalInput, description: 'Changed historical create payload' }));
    assert.deepEqual([await prisma.directCostPosting.count(), await prisma.auditLog.count()], countsBefore);
    // Preserve #248's raw PO, GR-only and combined mismatch regressions on
    // real approved/posted SGD sources created by the previous runtime.
    const receipt = await prisma.goodsReceipt.findFirstOrThrow({ where: {
      companyId: certification.companyId, postedAt: { not: null }, reversedAt: null,
      purchaseOrder: { currencyCode: 'SGD' }, items: { some: {} },
    }, include: { items: true } });
    const sourceLine = receipt.items[0]!;
    const retainedPo = await prisma.purchaseOrder.findUniqueOrThrow({ where: { id: receipt.purchaseOrderId } });
    assert.equal(retainedPo.currencyCode, 'SGD');
    for (const sourceIds of [
      { purchaseOrderLineId: sourceLine.purchaseOrderLineId },
      { goodsReceiptItemId: sourceLine.id },
      { purchaseOrderLineId: sourceLine.purchaseOrderLineId, goodsReceiptItemId: sourceLine.id },
    ]) {
      await assert.rejects(prisma.$transaction(async (tx) => {
        const invoice = await tx.supplierInvoice.create({ data: {
          companyId: receipt.companyId, projectId: receipt.projectId, supplierId: receipt.supplierId,
          supplierInvoiceNumber: 'LEGACY-SOURCE-' + randomUUID(), supplierReference: randomUUID(),
          invoiceDate: new Date('2026-10-25'), currencyCode: 'THB', createKey: randomUUID(),
          createPayloadHash: 'b'.repeat(64), createdByUserId: receipt.createdByUserId,
        } });
        await tx.supplierInvoiceItem.create({ data: {
          companyId: receipt.companyId, projectId: receipt.projectId, supplierInvoiceId: invoice.id,
          lineNo: 1, description: 'Historical source mismatch must remain denied', amount: '1', ...sourceIds,
        } });
      }), /SUPPLIER_INVOICE_SOURCE_CURRENCY_MISMATCH/);
    }
    const approver = await actualAuth(certification.approvedByUserId);
    assert.ok(approver.permissions.includes('subcontracts.certification.reverse'));
    const service = new SubcontractsCertificationService(prisma, access, approvals, audit, numbers);
    const key = randomUUID();
    await service.reverseCertification({ auth: approver }, certification.id, 'Exact historical retention correction', key);
    await service.reverseCertification({ auth: approver }, certification.id, 'Exact historical retention correction', key);
    await assert.rejects(service.reverseCertification({ auth: approver }, certification.id, 'Changed payload', key));
    const entries = await prisma.retentionLedgerEntry.findMany({ where: { certificationId: certification.id } });
    assert.equal(entries.length, 2);
    assert.ok(entries.every((r) => r.currencyCode === 'SGD'));
    const withholding = entries.find((r) => r.entryType === 'WITHHOLDING')!;
    const correction = entries.find((r) => r.entryType === 'REVERSAL')!;
    assert.equal(correction.reversesEntryId, withholding.id);
    assert.equal(correction.amount.toString(), withholding.amount.toString());
  }
  console.log('THB_UPGRADE_POLICY_PASS — verified SGD/NULL lineage denial, truthful reports, exact SGD corrections, maker/checker, scoped access and stable retries' + (requireRetention ? ', including original-currency retention.' : '.'));
}
