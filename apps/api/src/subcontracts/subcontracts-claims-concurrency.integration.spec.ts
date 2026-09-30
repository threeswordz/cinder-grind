import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException } from '@nestjs/common';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SubcontractsClaimsService } from './subcontracts-claims.service';
import { SubcontractsWorkflowService } from './subcontracts-workflow.service';

function auth(companyId: string, userId: string): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'V0.5-C Concurrency User',
    roleCodes: ['V05C_CONCURRENCY'],
    permissions: ['projects.access_all'],
    csrfTokenHash: '0'.repeat(64),
  };
}

function oneFulfilledOneRejected<T>(
  results: PromiseSettledResult<T>[],
  message: string,
): {
  fulfilled: PromiseFulfilledResult<T>;
  rejected: PromiseRejectedResult;
} {
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<T> =>
      result.status === 'fulfilled',
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult =>
      result.status === 'rejected',
  );
  assert.equal(fulfilled.length, 1, message + ': expected one winner');
  assert.equal(rejected.length, 1, message + ': expected one loser');
  return { fulfilled: fulfilled[0]!, rejected: rejected[0]! };
}

test('V0.5-C serializes Claim commercial races on the Agreement boundary', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCC-R-' + suffix,
        companyName: 'Stage C Concurrency ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SCC-RC-' + suffix,
        customerName: 'Stage C Concurrency Customer',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCC-RP-' + suffix,
        projectName: 'Stage C Concurrency Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-09-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scc-r-maker-' + suffix + '@example.com',
        displayName: 'Stage C Concurrency Maker',
        passwordHash: 'x',
      },
    });
    const assessor = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scc-r-assessor-' + suffix + '@example.com',
        displayName: 'Stage C Concurrency Assessor',
        passwordHash: 'x',
      },
    });
    const subcontractor = await prisma.subcontractor.create({
      data: {
        companyId: company.id,
        subcontractorCode: 'SCC-RS-' + suffix,
        subcontractorName: 'Stage C Concurrency Subcontractor',
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

    const createAgreement = (code: string, value = '1000.00') =>
      prisma.subcontractAgreement.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          subcontractorId: subcontractor.id,
          agreementNumber:
            'SC2609-' + code + suffix.slice(0, 3).toUpperCase(),
          originalValue: value,
          scopeOfWork: 'Concurrency fixture ' + code,
          currencyCode: 'SGD',
          approvalState: 'APPROVED',
          firstApprovedAt: new Date(),
          createdByUserId: maker.id,
        },
      });

    const createDraft = async (
      agreementId: string,
      start: string,
      end: string,
      amount: string,
      workOrderId?: string,
    ) => {
      const claim = await claims.createClaim(
        { auth: makerAuth },
        agreementId,
        {
          periodStart: new Date(start + 'T00:00:00.000Z'),
          periodEnd: new Date(end + 'T00:00:00.000Z'),
        },
      );
      await claims.addLine(
        { auth: makerAuth },
        claim.id,
        {
          amount,
          ...(workOrderId ? { workOrderId } : {}),
        },
      );
      return claim;
    };

    // The active-period partial unique index includes DRAFT. Therefore two
    // exact-period candidates cannot both exist long enough to race submit.
    // Prove the real contention boundary: concurrent creation yields one active
    // Draft, and only that winner can proceed to submission.
    const samePeriodAgreement = await createAgreement('SP');
    const samePeriodResults = await Promise.allSettled([
      claims.createClaim(
        { auth: makerAuth },
        samePeriodAgreement.id,
        {
          periodStart: new Date('2026-10-01T00:00:00.000Z'),
          periodEnd: new Date('2026-10-31T00:00:00.000Z'),
        },
      ),
      claims.createClaim(
        { auth: makerAuth },
        samePeriodAgreement.id,
        {
          periodStart: new Date('2026-10-01T00:00:00.000Z'),
          periodEnd: new Date('2026-10-31T00:00:00.000Z'),
        },
      ),
    ]);
    const samePeriod = oneFulfilledOneRejected(
      samePeriodResults,
      'same-period competitors',
    );
    assert.ok(
      samePeriod.rejected.status === 'rejected' &&
        samePeriod.rejected.reason instanceof ConflictException,
      'same-period loser must fail as a business conflict',
    );
    assert.equal(
      await prisma.subcontractClaim.count({
        where: {
          agreementId: samePeriodAgreement.id,
          periodStart: new Date('2026-10-01T00:00:00.000Z'),
          periodEnd: new Date('2026-10-31T00:00:00.000Z'),
          state: { in: ['DRAFT', 'SUBMITTED', 'ASSESSED'] },
        },
      }),
      1,
      'only one active same-period Claim may survive the race',
    );
    const samePeriodWinner = samePeriod.fulfilled.value;
    await claims.addLine(
      { auth: makerAuth },
      samePeriodWinner.id,
      { amount: '100.00' },
    );
    const submittedSamePeriod = await claims.submitClaim(
      { auth: makerAuth },
      samePeriodWinner.id,
      'same-period-winner-' + suffix,
    );
    assert.equal(submittedSamePeriod.state, 'SUBMITTED');

    const agreementCeiling = await createAgreement('AC');
    const agreementClaimA = await createDraft(
      agreementCeiling.id,
      '2026-11-01',
      '2026-11-30',
      '600.00',
    );
    const agreementClaimB = await createDraft(
      agreementCeiling.id,
      '2026-12-01',
      '2026-12-31',
      '600.00',
    );
    const agreementCeilingResults = await Promise.allSettled([
      claims.submitClaim(
        { auth: makerAuth },
        agreementClaimA.id,
        'agreement-race-a-' + suffix,
      ),
      claims.submitClaim(
        { auth: makerAuth },
        agreementClaimB.id,
        'agreement-race-b-' + suffix,
      ),
    ]);
    oneFulfilledOneRejected(
      agreementCeilingResults,
      'agreement-ceiling competing submissions',
    );
    assert.equal(
      await prisma.subcontractClaim.count({
        where: {
          agreementId: agreementCeiling.id,
          state: 'SUBMITTED',
        },
      }),
      1,
      'Agreement row lock must allow only one over-ceiling competitor to submit',
    );

    const workOrderAgreement = await createAgreement('WO');
    const approvalWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SCC-R-WO-' + suffix,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        workflowName: 'Stage C Concurrency Work Order',
      },
    });
    const approvalInstance = await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: approvalWorkflow.id,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        entityId: randomUUID(),
        currentStepNo: 1,
        approvalState: 'APPROVED',
        completedAt: new Date(),
      },
    });
    const workOrder = await prisma.subcontractWorkOrder.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        agreementId: workOrderAgreement.id,
        sequenceNo: 1,
        workOrderNumber: 'WO-001',
        scopeOfWork: 'Concurrency Work Order',
        amount: '700.00',
        approvalState: 'APPROVED',
        approvalInstanceId: approvalInstance.id,
        createdByUserId: maker.id,
        submittedByUserId: maker.id,
        submittedAt: new Date(),
        decidedAt: new Date(),
      },
    });
    const workOrderClaimA = await createDraft(
      workOrderAgreement.id,
      '2027-01-01',
      '2027-01-31',
      '400.00',
      workOrder.id,
    );
    const workOrderClaimB = await createDraft(
      workOrderAgreement.id,
      '2027-02-01',
      '2027-02-28',
      '400.00',
      workOrder.id,
    );
    const workOrderResults = await Promise.allSettled([
      claims.submitClaim(
        { auth: makerAuth },
        workOrderClaimA.id,
        'work-order-race-a-' + suffix,
      ),
      claims.submitClaim(
        { auth: makerAuth },
        workOrderClaimB.id,
        'work-order-race-b-' + suffix,
      ),
    ]);
    oneFulfilledOneRejected(
      workOrderResults,
      'Work Order ceiling competing submissions',
    );
    const submittedWorkOrderTotal = await prisma.subcontractClaimLine.aggregate({
      where: {
        workOrderId: workOrder.id,
        claim: { state: { in: ['SUBMITTED', 'ASSESSED'] } },
      },
      _sum: { amount: true },
    });
    assert.equal(
      submittedWorkOrderTotal._sum.amount?.toFixed(2),
      '400.00',
      'Work Order row allocation must remain within its approved ceiling after the race',
    );

    const cancellationAgreement = await createAgreement('CS');
    const cancellationClaim = await createDraft(
      cancellationAgreement.id,
      '2027-03-01',
      '2027-03-31',
      '500.00',
    );
    const cancellationSubmissionResults = await Promise.allSettled([
      claims.submitClaim(
        { auth: makerAuth },
        cancellationClaim.id,
        'cancel-submit-race-' + suffix,
      ),
      workflow.cancelAgreement(
        { auth: makerAuth },
        cancellationAgreement.id,
        'Competing cancellation.',
        'cancel-submit-cancel-' + suffix,
      ),
    ]);
    oneFulfilledOneRejected(
      cancellationSubmissionResults,
      'Agreement cancellation versus Claim submission',
    );
    const cancellationAgreementAfter =
      await prisma.subcontractAgreement.findUniqueOrThrow({
        where: { id: cancellationAgreement.id },
      });
    const cancellationClaimAfter =
      await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: cancellationClaim.id },
      });
    const submitWon =
      cancellationClaimAfter.state === 'SUBMITTED' &&
      cancellationAgreementAfter.approvalState === 'APPROVED';
    const cancelWon =
      cancellationClaimAfter.state === 'DRAFT' &&
      cancellationAgreementAfter.approvalState === 'CANCELLED';
    assert.ok(
      submitWon || cancelWon,
      'cancellation/submission race must resolve to exactly one valid state pair',
    );

    const assessmentAgreement = await createAgreement('CA');
    const assessmentClaim = await createDraft(
      assessmentAgreement.id,
      '2027-04-01',
      '2027-04-30',
      '500.00',
    );
    await claims.submitClaim(
      { auth: makerAuth },
      assessmentClaim.id,
      'assessment-race-submit-' + suffix,
    );
    const cancellationAssessmentResults = await Promise.allSettled([
      claims.assessClaim(
        { auth: assessorAuth },
        assessmentClaim.id,
        {
          assessedAmount: '450.00',
          reason: 'Concurrency finalization proof.',
          actionKey: 'assessment-race-assess-' + suffix,
        },
      ),
      workflow.cancelAgreement(
        { auth: makerAuth },
        assessmentAgreement.id,
        'Competing cancellation versus Assessment.',
        'assessment-race-cancel-' + suffix,
      ),
    ]);
    const assessmentFulfilled = cancellationAssessmentResults.filter(
      (result) => result.status === 'fulfilled',
    );
    const assessmentRejected = cancellationAssessmentResults.filter(
      (result) => result.status === 'rejected',
    );
    assert.equal(
      assessmentFulfilled.length,
      1,
      'Assessment/cancellation race must have one successful finalization',
    );
    assert.equal(
      assessmentRejected.length,
      1,
      'Assessment/cancellation race must reject Agreement cancellation',
    );
    const assessmentAgreementAfter =
      await prisma.subcontractAgreement.findUniqueOrThrow({
        where: { id: assessmentAgreement.id },
      });
    const assessmentClaimAfter =
      await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: assessmentClaim.id },
        include: { assessment: true },
      });
    assert.equal(
      assessmentAgreementAfter.approvalState,
      'APPROVED',
      'submitted/assessed Claim must keep the Agreement cancellation guard active',
    );
    assert.equal(
      assessmentClaimAfter.state,
      'ASSESSED',
      'Assessment finalization must survive the competing cancellation attempt',
    );
    assert.equal(
      assessmentClaimAfter.assessment?.assessedAmount.toFixed(2),
      '450.00',
      'retained Assessment amount changed during the cancellation race',
    );
  } finally {
    await prisma.$disconnect();
  }
});
