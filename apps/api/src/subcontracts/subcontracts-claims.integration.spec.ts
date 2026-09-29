import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SubcontractsClaimsController } from './subcontracts-claims.controller';
import { SubcontractsClaimsService } from './subcontracts-claims.service';
import { SubcontractsWorkflowService } from './subcontracts-workflow.service';

function auth(
  companyId: string,
  userId: string,
  accessAll = true,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'V0.5-C Test User',
    roleCodes: ['V05C_TEST'],
    permissions: accessAll ? ['projects.access_all'] : [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.5-C Claim routes retain explicit permission metadata', () => {
  const routes = [
    ['listClaims', 'subcontracts.claim.view'],
    ['getClaim', 'subcontracts.claim.view'],
    ['createClaim', 'subcontracts.claim.create'],
    ['updateClaim', 'subcontracts.claim.edit'],
    ['addLine', 'subcontracts.claim.edit'],
    ['updateLine', 'subcontracts.claim.edit'],
    ['deleteLine', 'subcontracts.claim.edit'],
    ['submitClaim', 'subcontracts.claim.submit'],
    ['withdrawClaim', 'subcontracts.claim.withdraw'],
    ['createReplacement', 'subcontracts.claim.create'],
    ['assessClaim', 'subcontracts.assessment.assess'],
    ['rejectAssessment', 'subcontracts.assessment.reject'],
  ] as const;

  for (const [method, permission] of routes) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        SubcontractsClaimsController.prototype[method],
      ),
      [permission],
      method + ' must retain its Stage C permission boundary',
    );
  }
});

test('V0.5-C retains Claim history, separates assessment and enforces commercial ceilings', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCC-' + suffix,
        companyName: 'Subcontracts Stage C ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SCC-C-' + suffix,
        customerName: 'Stage C Customer',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCC-P-' + suffix,
        projectName: 'Stage C Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-09-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCC-XP-' + suffix,
        projectName: 'Stage C Other Project',
        customerId: customer.id,
        contractValue: '50000',
        plannedStartDate: new Date('2026-09-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scc-maker-' + suffix + '@example.com',
        displayName: 'Stage C Maker',
        passwordHash: 'x',
      },
    });
    const assessor = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scc-assessor-' + suffix + '@example.com',
        displayName: 'Stage C Assessor',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scc-outsider-' + suffix + '@example.com',
        displayName: 'Stage C Outsider',
        passwordHash: 'x',
      },
    });
    const subcontractor = await prisma.subcontractor.create({
      data: {
        companyId: company.id,
        subcontractorCode: 'SCC-S-' + suffix,
        subcontractorName: 'Stage C Subcontractor',
      },
    });

    const agreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-C' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Stage C agreement-scope package',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    const otherAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: otherProject.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-X' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Other Project package',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });

    const authorization = new AuthorizationService();
    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(authorization),
    );
    const audit = new AuditService(prisma);
    const claims = new SubcontractsClaimsService(
      prisma,
      access,
      audit,
      new NumberSequenceService(prisma),
    );
    const workflow = new SubcontractsWorkflowService(
      prisma,
      access,
      new ApprovalService(prisma),
      audit,
    );
    const makerAuth = auth(company.id, maker.id);
    const assessorAuth = auth(company.id, assessor.id);
    const outsiderAuth = auth(company.id, outsider.id, false);

    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          agreement.id,
          {
            periodStart: new Date('2026-09-30T00:00:00.000Z'),
            periodEnd: new Date('2026-09-01T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Claim period must be inclusive with start on or before end',
    );

    const claim = await claims.createClaim(
      { auth: makerAuth },
      agreement.id,
      {
        periodStart: new Date('2026-09-01T00:00:00.000Z'),
        periodEnd: new Date('2026-09-30T00:00:00.000Z'),
      },
    );
    assert.match(claim.claimNumber, /^SCL\d{4}-\d{3}$/);
    assert.equal(claim.state, 'DRAFT');

    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          agreement.id,
          {
            periodStart: new Date('2026-09-01T00:00:00.000Z'),
            periodEnd: new Date('2026-09-30T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'only one active Claim may exist for the exact Agreement/period',
    );

    const line = await claims.addLine(
      { auth: makerAuth },
      claim.id,
      { amount: '600.00' },
    );
    assert.equal(line.amount.toFixed(2), '600.00');

    const submitted = await claims.submitClaim(
      { auth: makerAuth },
      claim.id,
      'claim-submit-' + suffix,
    );
    assert.equal(submitted.state, 'SUBMITTED');
    assert.equal(submitted.lines[0]?.amount.toFixed(2), '600.00');

    const replayedSubmit = await claims.submitClaim(
      { auth: makerAuth },
      claim.id,
      'claim-submit-' + suffix,
    );
    assert.equal(replayedSubmit.state, 'SUBMITTED');

    await assert.rejects(
      () =>
        claims.submitClaim(
          { auth: outsiderAuth },
          claim.id,
          'claim-submit-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
      'retained retry evidence must never bypass current Project access',
    );

    await assert.rejects(
      () =>
        prisma.subcontractClaimLine.update({
          where: { id: line.id },
          data: { amount: '601.00' },
        }),
      'submitted Claim source lines must be immutable below the API',
    );
    await assert.rejects(
      () => prisma.subcontractClaimLine.delete({ where: { id: line.id } }),
      'submitted Claim lines must not be hard-deletable',
    );
    await assert.rejects(
      () => prisma.subcontractClaim.delete({ where: { id: claim.id } }),
      'submitted Claim history must not be hard-deletable',
    );

    await assert.rejects(
      () =>
        claims.assessClaim(
          { auth: assessorAuth },
          claim.id,
          {
            assessedAmount: '600.01',
            reason: 'Must not exceed claimed amount',
            actionKey: 'claim-assess-over-' + suffix,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'assessment cannot exceed the retained submitted Claim total',
    );

    const assessed = await claims.assessClaim(
      { auth: assessorAuth },
      claim.id,
      {
        assessedAmount: '500.00',
        reason: 'Accepted measured progress for this period.',
        actionKey: 'claim-assess-' + suffix,
      },
    );
    assert.equal(assessed.state, 'ASSESSED');
    assert.equal(assessed.lines[0]?.amount.toFixed(2), '600.00');
    assert.equal(assessed.assessment?.assessedAmount.toFixed(2), '500.00');

    const replayedAssessment = await claims.assessClaim(
      { auth: assessorAuth },
      claim.id,
      {
        assessedAmount: '500.00',
        reason: 'Accepted measured progress for this period.',
        actionKey: 'claim-assess-' + suffix,
      },
    );
    assert.equal(replayedAssessment.state, 'ASSESSED');

    await assert.rejects(
      () =>
        claims.assessClaim(
          { auth: assessorAuth },
          claim.id,
          {
            assessedAmount: '500.00',
            reason: 'Changed assessment reason',
            actionKey: 'claim-assess-' + suffix,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'assessment action key cannot be reused with changed material payload',
    );

    const rejected = await claims.rejectAssessment(
      { auth: assessorAuth },
      claim.id,
      'Correction requires a replacement Claim.',
      'assessment-reject-' + suffix,
    );
    assert.equal(rejected.state, 'REJECTED');
    assert.equal(rejected.assessment?.state, 'REJECTED');
    assert.equal(rejected.lines[0]?.amount.toFixed(2), '600.00');
    assert.equal(rejected.assessment?.assessedAmount.toFixed(2), '500.00');

    await assert.rejects(
      () =>
        prisma.subcontractClaimAssessment.delete({
          where: { id: rejected.assessment!.id },
        }),
      'Assessment decision history must not be hard-deletable',
    );

    const replacement = await claims.createReplacement(
      { auth: makerAuth },
      claim.id,
    );
    assert.notEqual(replacement.claimNumber, claim.claimNumber);
    assert.equal(replacement.replacementForClaimId, claim.id);
    const replacementLine = await claims.addLine(
      { auth: makerAuth },
      replacement.id,
      { amount: '500.00' },
    );
    const submittedReplacement = await claims.submitClaim(
      { auth: makerAuth },
      replacement.id,
      'replacement-submit-' + suffix,
    );
    assert.equal(submittedReplacement.state, 'SUBMITTED');
    const replacedSource = await prisma.subcontractClaim.findUniqueOrThrow({
      where: { id: claim.id },
    });
    assert.equal(replacedSource.state, 'REPLACED');
    assert.ok(replacedSource.replacedAt);

    const overAgreement = await claims.createClaim(
      { auth: makerAuth },
      agreement.id,
      {
        periodStart: new Date('2026-10-01T00:00:00.000Z'),
        periodEnd: new Date('2026-10-31T00:00:00.000Z'),
      },
    );
    await claims.addLine(
      { auth: makerAuth },
      overAgreement.id,
      { amount: '600.00' },
    );
    await assert.rejects(
      () =>
        claims.submitClaim(
          { auth: makerAuth },
          overAgreement.id,
          'over-agreement-submit-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'active cumulative period increments must not exceed the agreement ceiling',
    );

    const withdrawal = await claims.createClaim(
      { auth: makerAuth },
      agreement.id,
      {
        periodStart: new Date('2026-11-01T00:00:00.000Z'),
        periodEnd: new Date('2026-11-30T00:00:00.000Z'),
      },
    );
    await claims.addLine(
      { auth: makerAuth },
      withdrawal.id,
      { amount: '100.00' },
    );
    await claims.submitClaim(
      { auth: makerAuth },
      withdrawal.id,
      'withdrawal-submit-' + suffix,
    );
    const withdrawn = await claims.withdrawClaim(
      { auth: makerAuth },
      withdrawal.id,
      'Incorrect source measurement.',
      'withdrawal-action-' + suffix,
    );
    assert.equal(withdrawn.state, 'WITHDRAWN');
    assert.equal(withdrawn.withdrawalReason, 'Incorrect source measurement.');

    const withdrawalReplacement = await claims.createReplacement(
      { auth: makerAuth },
      withdrawal.id,
    );
    await claims.addLine(
      { auth: makerAuth },
      withdrawalReplacement.id,
      { amount: '80.00' },
    );
    await claims.submitClaim(
      { auth: makerAuth },
      withdrawalReplacement.id,
      'withdrawal-replacement-submit-' + suffix,
    );
    const withdrawnSource = await prisma.subcontractClaim.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });
    assert.equal(withdrawnSource.state, 'REPLACED');

    await assert.rejects(
      () =>
        workflow.cancelAgreement(
          { auth: assessorAuth },
          agreement.id,
          'Must not cancel with an active Claim.',
          'agreement-cancel-claim-guard-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'Agreement cancellation must be blocked by submitted/assessed Claims',
    );

    await assert.rejects(
      () => claims.getClaim(outsiderAuth, submittedReplacement.id),
      (error: unknown) => error instanceof ForbiddenException,
      'unassigned Project users must not read retained Claims',
    );

    const workflowRow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SCC-WO-' + suffix,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        workflowName: 'Stage C WO fixture',
      },
    });
    const instance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflowRow.id,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        entityId: randomUUID(),
        currentStepNo: 1,
        approvalState: 'APPROVED',
        completedAt: new Date(),
      },
    });
    const woAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-W' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Work Order claim package',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    const wo = await prisma.subcontractWorkOrder.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        agreementId: woAgreement.id,
        sequenceNo: 1,
        workOrderNumber: 'WO-001',
        scopeOfWork: 'Approved Work Order fixture',
        amount: '300.00',
        approvalState: 'APPROVED',
        approvalInstanceId: instance.id,
        createdByUserId: maker.id,
        submittedByUserId: maker.id,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });

    const woClaim = await claims.createClaim(
      { auth: makerAuth },
      woAgreement.id,
      {
        periodStart: new Date('2026-12-01T00:00:00.000Z'),
        periodEnd: new Date('2026-12-31T00:00:00.000Z'),
      },
    );
    const woLine = await claims.addLine(
      { auth: makerAuth },
      woClaim.id,
      { amount: '250.00' },
    );
    await assert.rejects(
      () =>
        claims.submitClaim(
          { auth: makerAuth },
          woClaim.id,
          'wo-required-' + suffix,
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'approved Work Orders make Work Order references mandatory on every Claim line',
    );

    await claims.updateLine(
      { auth: makerAuth },
      woLine.id,
      { amount: '350.00', workOrderId: wo.id },
    );
    await assert.rejects(
      () =>
        claims.submitClaim(
          { auth: makerAuth },
          woClaim.id,
          'wo-ceiling-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'Claim allocation cannot exceed the approved Work Order amount',
    );

    await claims.updateLine(
      { auth: makerAuth },
      woLine.id,
      { amount: '250.00' },
    );
    const submittedWoClaim = await claims.submitClaim(
      { auth: makerAuth },
      woClaim.id,
      'wo-valid-' + suffix,
    );
    assert.equal(submittedWoClaim.state, 'SUBMITTED');
    assert.equal(submittedWoClaim.lines[0]?.workOrderId, wo.id);

    const woClaimTwo = await claims.createClaim(
      { auth: makerAuth },
      woAgreement.id,
      {
        periodStart: new Date('2027-01-01T00:00:00.000Z'),
        periodEnd: new Date('2027-01-31T00:00:00.000Z'),
      },
    );
    await claims.addLine(
      { auth: makerAuth },
      woClaimTwo.id,
      { amount: '100.00', workOrderId: wo.id },
    );
    await assert.rejects(
      () =>
        claims.submitClaim(
          { auth: makerAuth },
          woClaimTwo.id,
          'wo-cumulative-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'cumulative active Claim allocation per Work Order cannot exceed its approved amount',
    );

    const otherWorkflowInstance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflowRow.id,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        entityId: randomUUID(),
        currentStepNo: 1,
        approvalState: 'APPROVED',
        completedAt: new Date(),
      },
    });
    const otherWo = await prisma.subcontractWorkOrder.create({
      data: {
        companyId: company.id,
        projectId: otherProject.id,
        agreementId: otherAgreement.id,
        sequenceNo: 1,
        workOrderNumber: 'WO-001',
        scopeOfWork: 'Other Project Work Order',
        amount: '100.00',
        approvalState: 'APPROVED',
        approvalInstanceId: otherWorkflowInstance.id,
        createdByUserId: maker.id,
        submittedByUserId: maker.id,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });

    await assert.rejects(
      () =>
        claims.addLine(
          { auth: makerAuth },
          woClaimTwo.id,
          { amount: '10.00', workOrderId: otherWo.id },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'service must reject cross-Project/cross-Agreement Work Order references',
    );

    await assert.rejects(
      () =>
        prisma.subcontractClaimLine.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            agreementId: woAgreement.id,
            claimId: woClaimTwo.id,
            lineNo: 900,
            amount: '1.00',
            workOrderId: otherWo.id,
          },
        }),
      'database composite Work Order reference must reject cross-Project/cross-Agreement data',
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: ['SUBCONTRACT_CLAIM', 'SUBCONTRACT_CLAIM_ASSESSMENT'],
        },
      },
    });
    assert.ok(auditCount >= 10, 'Claim/Assessment lifecycle must retain audit evidence');

    assert.equal(replacementLine.amount.toFixed(2), '500.00');
  } finally {
    await prisma.$disconnect();
  }
});
