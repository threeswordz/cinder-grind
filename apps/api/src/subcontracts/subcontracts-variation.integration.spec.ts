import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException, ForbiddenException } from '@nestjs/common';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SubcontractsCertificationService } from './subcontracts-certification.service';
import { SubcontractsClaimsService } from './subcontracts-claims.service';
import { SubcontractsVariationController } from './subcontracts-variation.controller';
import { SubcontractsVariationService } from './subcontracts-variation.service';
import { SubcontractsWorkflowService } from './subcontracts-workflow.service';

function auth(
  companyId: string,
  userId: string,
  roleCodes: string[] = [],
  accessAll = true,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'V0.5-E Test User',
    roleCodes,
    permissions: accessAll ? ['projects.access_all'] : [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.5-E routes retain explicit Variation and reporting permissions', () => {
  const routes = [
    ['agreementOptions', ['subcontracts.variation.view']],
    ['workflowOptions', ['subcontracts.variation.view', 'subcontracts.variation.submit']],
    ['list', ['subcontracts.variation.view']],
    ['get', ['subcontracts.variation.view']],
    ['create', ['subcontracts.variation.view', 'subcontracts.variation.create']],
    ['update', ['subcontracts.variation.view', 'subcontracts.variation.edit']],
    ['submit', ['subcontracts.variation.view', 'subcontracts.variation.submit']],
    ['approve', ['subcontracts.variation.view', 'subcontracts.variation.approve']],
    ['reject', ['subcontracts.variation.view', 'subcontracts.variation.reject']],
    ['reverse', ['subcontracts.variation.view', 'subcontracts.variation.reverse']],
    ['report', ['subcontracts.report.view']],
  ] as const;
  for (const [method, permissions] of routes) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        SubcontractsVariationController.prototype[method],
      ),
      permissions,
    );
  }
});

test('V0.5-E applies approved Variations to the ceiling and derives authorized reports', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCE-' + suffix,
        companyName: 'Stage E ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SCE-C-' + suffix,
        customerName: 'Stage E Customer',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCE-P-' + suffix,
        projectName: 'Stage E Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCE-XP-' + suffix,
        projectName: 'Other Stage E Project',
        customerId: customer.id,
        contractValue: '50000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'sce-maker-' + suffix + '@example.com',
        displayName: 'Stage E Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'sce-checker-' + suffix + '@example.com',
        displayName: 'Stage E Checker',
        passwordHash: 'x',
      },
    });
    const noRole = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'sce-no-role-' + suffix + '@example.com',
        displayName: 'Stage E No Role',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'sce-outsider-' + suffix + '@example.com',
        displayName: 'Stage E Outsider',
        passwordHash: 'x',
      },
    });
    const subcontractor = await prisma.subcontractor.create({
      data: {
        companyId: company.id,
        subcontractorCode: 'SCE-S-' + suffix,
        subcontractorName: 'Stage E Subcontractor',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'SCE_APPROVER_' + suffix,
        roleName: 'Stage E Commercial Approver',
      },
    });
    const makeWorkflow = (entityType: string, code: string, name: string) =>
      prisma.approvalWorkflow.create({
        data: {
          companyId: company.id,
          workflowCode: code + '_' + suffix,
          entityType,
          workflowName: name,
          steps: {
            create: {
              stepNo: 1,
              stepName: 'Checker',
              requiredApprovals: 1,
              stepRoles: { create: { roleId: role.id } },
            },
          },
        },
      });
    const [variationWorkflow, workOrderWorkflow, certificationWorkflow] =
      await Promise.all([
        makeWorkflow('SUBCONTRACT_VARIATION', 'SCE_VAR', 'Variation Approval'),
        makeWorkflow('SUBCONTRACT_WORK_ORDER', 'SCE_WO', 'Work Order Approval'),
        makeWorkflow(
          'SUBCONTRACT_CERTIFICATION',
          'SCE_CERT',
          'Certification Approval',
        ),
      ]);

    const agreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2610-E' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Immutable original scope',
        currencyCode: 'SGD',
        retentionRate: '10.00',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    const cancellableAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2610-C' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '500.00',
        scopeOfWork: 'Cancellation guard scope',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: otherProject.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2610-X' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '9999.00',
        scopeOfWork: 'Unauthorized project data',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const approvals = new ApprovalService(prisma);
    const variations = new SubcontractsVariationService(
      prisma,
      access,
      approvals,
      audit,
      numbers,
    );
    const workflow = new SubcontractsWorkflowService(
      prisma,
      access,
      approvals,
      audit,
    );
    const claims = new SubcontractsClaimsService(prisma, access, audit, numbers);
    const certifications = new SubcontractsCertificationService(
      prisma,
      access,
      approvals,
      audit,
      numbers,
    );
    const makerAuth = auth(company.id, maker.id);
    const makerApproverAuth = auth(company.id, maker.id, [role.roleCode]);
    const checkerAuth = auth(company.id, checker.id, [role.roleCode]);
    const noRoleAuth = auth(company.id, noRole.id);
    const outsiderAuth = auth(company.id, outsider.id, [], false);
    const sysAdminWithoutProject = auth(
      company.id,
      outsider.id,
      ['SYS_ADMIN'],
      false,
    );

    const increaseInput = {
      valueDelta: '250.00',
      scopeChange: 'Additional approved scope.',
      reason: 'Authorize additional commercial scope.',
      createKey: 'increase-' + suffix,
    };
    const increase = await variations.createVariation(
      { auth: makerAuth },
      agreement.id,
      increaseInput,
    );
    assert.match(increase.variationNumber, /^SVO\d{4}-\d{3}$/);
    assert.equal(increase.currencyCode, agreement.currencyCode);
    const createReplay = await variations.createVariation(
      { auth: makerAuth },
      agreement.id,
      increaseInput,
    );
    assert.equal(createReplay.id, increase.id);
    await assert.rejects(
      () =>
        variations.createVariation(
          { auth: makerAuth },
          agreement.id,
          { ...increaseInput, valueDelta: '251.00' },
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => variations.getVariation(outsiderAuth, increase.id),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () =>
        prisma.subcontractVariation.create({
          data: {
            companyId: company.id,
            projectId: otherProject.id,
            agreementId: agreement.id,
            variationNumber: 'SVO2610-998',
            currencyCode: 'SGD',
            valueDelta: '1.00',
            scopeChange: 'Invalid cross-Project reference.',
            reason: 'Integrity proof.',
            createKey: 'cross-' + suffix,
            createPayloadHash: 'b'.repeat(64),
            createdByUserId: maker.id,
          },
        }),
    );

    await variations.submitVariation(
      { auth: makerAuth },
      increase.id,
      variationWorkflow.workflowCode,
      'increase-submit-' + suffix,
    );
    await assert.rejects(
      () =>
        variations.approveVariation(
          { auth: makerApproverAuth },
          increase.id,
          'increase-maker-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () =>
        variations.approveVariation(
          { auth: noRoleAuth },
          increase.id,
          'increase-no-role-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    const approvedIncrease = await variations.approveVariation(
      { auth: checkerAuth },
      increase.id,
      'increase-approve-' + suffix,
      'Approved.',
    );
    assert.equal(approvedIncrease.state, 'APPROVED');
    const unchangedAgreement = await prisma.subcontractAgreement.findUniqueOrThrow({
      where: { id: agreement.id },
    });
    assert.equal(unchangedAgreement.originalValue.toFixed(2), '1000.00');
    assert.equal(unchangedAgreement.scopeOfWork, 'Immutable original scope');
    const retainedVariationAudit = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_VARIATION',
        entityId: increase.id,
      },
      select: { action: true },
      orderBy: { occurredAt: 'asc' },
    });
    assert.deepEqual(
      retainedVariationAudit.map((entry) => entry.action),
      ['CREATE_DRAFT', 'SUBMIT', 'APPROVAL_APPROVE'],
      'Variation create, submit and approval decisions must remain in retained audit history',
    );
    await assert.rejects(() =>
      prisma.subcontractVariation.update({
        where: { id: increase.id },
        data: { valueDelta: '999.00' },
      }),
    );

    const workOrder = await workflow.createWorkOrder(
      { auth: makerAuth },
      agreement.id,
      {
        scopeOfWork: 'Allocation above original but within varied ceiling.',
        amount: '1100.00',
      },
    );
    await workflow.submitWorkOrder(
      { auth: makerAuth },
      workOrder.id,
      workOrderWorkflow.workflowCode,
      'wo-submit-' + suffix,
    );
    const approvedWorkOrder = await workflow.approveWorkOrder(
      { auth: checkerAuth },
      workOrder.id,
      'wo-approve-' + suffix,
    );
    assert.equal(approvedWorkOrder.amount.toFixed(2), '1100.00');

    const claim = await claims.createClaim(
      { auth: makerAuth },
      agreement.id,
      {
        periodStart: new Date('2026-10-01T00:00:00.000Z'),
        periodEnd: new Date('2026-10-31T00:00:00.000Z'),
      },
    );
    await claims.addLine(
      { auth: makerAuth },
      claim.id,
      { workOrderId: workOrder.id, amount: '1100.00' },
    );
    await claims.submitClaim(
      { auth: makerAuth },
      claim.id,
      'claim-submit-' + suffix,
    );
    const assessed = await claims.assessClaim(
      { auth: checkerAuth },
      claim.id,
      {
        assessedAmount: '1100.00',
        reason: 'Measured Stage E progress.',
        actionKey: 'claim-assess-' + suffix,
      },
    );
    assert.equal(assessed.state, 'ASSESSED');

    const certification = await certifications.createCertification(
      { auth: makerAuth },
      claim.id,
      { certifiedGross: '1050.00' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      certification.id,
      certificationWorkflow.workflowCode,
      'cert-submit-' + suffix,
    );
    const approvedCertification =
      await certifications.approveCertification(
        { auth: checkerAuth },
        certification.id,
        'cert-approve-' + suffix,
      );
    assert.equal(approvedCertification.certifiedGross.toFixed(2), '1050.00');
    assert.equal(approvedCertification.retainedAmount?.toFixed(2), '105.00');
    assert.equal(approvedCertification.netCertifiedAmount?.toFixed(2), '945.00');

    const report = await variations.reportAgreements(makerAuth, project.id);
    const row = report.find((item) => item.id === agreement.id);
    assert.ok(row);
    assert.deepEqual(
      {
        originalValue: row.originalValue,
        approvedVariationDelta: row.approvedVariationDelta,
        currentCeiling: row.currentCeiling,
        approvedWorkOrderAllocation: row.approvedWorkOrderAllocation,
        activeClaimedValue: row.activeClaimedValue,
        assessedValue: row.assessedValue,
        certifiedGross: row.certifiedGross,
        withheldRetention: row.withheldRetention,
        netCertification: row.netCertification,
      },
      {
        originalValue: '1000.00',
        approvedVariationDelta: '250.00',
        currentCeiling: '1250.00',
        approvedWorkOrderAllocation: '1100.00',
        activeClaimedValue: '1100.00',
        assessedValue: '1100.00',
        certifiedGross: '1050.00',
        withheldRetention: '105.00',
        netCertification: '945.00',
      },
    );
    assert.equal('actualCost' in row || 'paidCost' in row, false);
    assert.deepEqual(await variations.reportAgreements(outsiderAuth), []);
    await assert.rejects(
      () => variations.reportAgreements(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => variations.reportAgreements(sysAdminWithoutProject, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const pendingCancellation = await variations.createVariation(
      { auth: makerAuth },
      cancellableAgreement.id,
      {
        valueDelta: '0.00',
        scopeChange: 'Pending scope clarification.',
        reason: 'Cancellation protection proof.',
        createKey: 'cancel-guard-' + suffix,
      },
    );
    await variations.submitVariation(
      { auth: makerAuth },
      pendingCancellation.id,
      variationWorkflow.workflowCode,
      'cancel-var-submit-' + suffix,
    );
    await assert.rejects(
      () =>
        workflow.cancelAgreement(
          { auth: makerAuth },
          cancellableAgreement.id,
          'Should be blocked.',
          'cancel-agreement-' + suffix,
        ),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string }).code ===
          'AGREEMENT_HAS_PENDING_VARIATION',
    );
    const rejectedCancellationVariation = await variations.rejectVariation(
      { auth: checkerAuth },
      pendingCancellation.id,
      'Resolve pending Variation before Agreement cancellation.',
      'cancel-var-reject-' + suffix,
    );
    assert.equal(rejectedCancellationVariation.state, 'REJECTED');
    const cancelledAgreement = await workflow.cancelAgreement(
      { auth: makerAuth },
      cancellableAgreement.id,
      'Cancel after pending Variation is resolved.',
      'cancel-agreement-after-reject-' + suffix,
    );
    assert.equal(cancelledAgreement.approvalState, 'CANCELLED');
    const historyOptions = await variations.agreementOptions(makerAuth);
    assert.ok(
      historyOptions.some(
        (item) =>
          item.id === cancellableAgreement.id &&
          item.approvalState === 'CANCELLED' &&
          item.cancelledAt,
      ),
      'cancelled Agreements must remain discoverable for retained Variation history',
    );
    await assert.rejects(
      () =>
        variations.createVariation(
          { auth: makerAuth },
          cancellableAgreement.id,
          {
            valueDelta: '1.00',
            scopeChange: 'Must not create against cancelled Agreement.',
            reason: 'History selector must remain read-only for cancellation.',
            createKey: 'cancelled-create-' + suffix,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'cancelled Agreement history browsing must not re-enable new Variations',
    );

    const reductions = await Promise.all(
      ['a', 'b'].map(async (label) => {
        const variation = await variations.createVariation(
          { auth: makerAuth },
          agreement.id,
          {
            valueDelta: '-100.00',
            scopeChange: 'Concurrent reduction ' + label,
            reason: 'Concurrency proof ' + label,
            createKey: 'reduce-' + label + '-' + suffix,
          },
        );
        await variations.submitVariation(
          { auth: makerAuth },
          variation.id,
          variationWorkflow.workflowCode,
          'reduce-submit-' + label + '-' + suffix,
        );
        return variation;
      }),
    );
    const competing = await Promise.allSettled(
      reductions.map((variation, index) =>
        variations.approveVariation(
          { auth: checkerAuth },
          variation.id,
          'reduce-approve-' + index + '-' + suffix,
        ),
      ),
    );
    assert.equal(
      competing.filter((result) => result.status === 'fulfilled').length,
      1,
    );
    const states = await prisma.subcontractVariation.findMany({
      where: { id: { in: reductions.map((item) => item.id) } },
    });
    const approvedReduction = states.find((item) => item.state === 'APPROVED');
    const submittedReduction = states.find((item) => item.state === 'SUBMITTED');
    assert.ok(approvedReduction);
    assert.ok(submittedReduction);
    await variations.rejectVariation(
      { auth: checkerAuth },
      submittedReduction.id,
      'Rejected after concurrency guard proof.',
      'reduce-reject-' + suffix,
    );
    await assert.rejects(
      () =>
        variations.reverseVariation(
          { auth: checkerAuth },
          increase.id,
          'Would reduce below protected downstream values.',
          'increase-reverse-blocked-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    const reversedReduction = await variations.reverseVariation(
      { auth: checkerAuth },
      approvedReduction.id,
      'Restore ceiling.',
      'reduce-reverse-' + suffix,
    );
    assert.equal(reversedReduction.state, 'REVERSED');

    const after = (
      await variations.reportAgreements(makerAuth, project.id)
    ).find((item) => item.id === agreement.id);
    assert.equal(after?.currentCeiling, '1250.00');

    const identities = await prisma.subcontractVariation.findMany({
      where: { companyId: company.id },
      select: { variationNumber: true },
    });
    assert.equal(
      new Set(identities.map((item) => item.variationNumber)).size,
      identities.length,
    );
    assert.ok(
      identities.every((item) => /^SVO\d{4}-\d{3}$/.test(item.variationNumber)),
    );
  } finally {
    await prisma.$disconnect();
  }
});
