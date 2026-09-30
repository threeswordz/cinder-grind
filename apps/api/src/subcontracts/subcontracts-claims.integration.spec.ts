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
    ['claimAgreementOptions', 'subcontracts.claim.view'],
    ['claimOptions', 'subcontracts.claim.view'],
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
      () =>
        prisma.subcontractClaimLine.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            agreementId: agreement.id,
            claimId: claim.id,
            lineNo: 99,
            amount: '1.00',
          },
        }),
      'submitted Claim source lines must reject direct inserts below the API',
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

    // Direct PostgreSQL/Prisma persistence must retain the same monetary bound.
    // Use an isolated Agreement so these database-level fixtures cannot affect
    // the commercial ceiling assertions for the primary Stage-C lifecycle.
    const assessmentBoundAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-B' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Assessment amount database-bound fixture',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    const createSubmittedAssessmentBoundClaim = async (
      periodStart: string,
      periodEnd: string,
      amount: string,
      actionKey: string,
    ) => {
      const boundClaim = await claims.createClaim(
        { auth: makerAuth },
        assessmentBoundAgreement.id,
        {
          periodStart: new Date(periodStart + 'T00:00:00.000Z'),
          periodEnd: new Date(periodEnd + 'T00:00:00.000Z'),
        },
      );
      await claims.addLine(
        { auth: makerAuth },
        boundClaim.id,
        { amount },
      );
      return claims.submitClaim(
        { auth: makerAuth },
        boundClaim.id,
        actionKey,
      );
    };
    const directlyAssessBoundClaim = async (
      claimId: string,
      assessedAmount: string,
      reason: string,
    ) =>
      prisma.$transaction(async (tx) => {
        const decision = await tx.subcontractClaimAssessment.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            agreementId: assessmentBoundAgreement.id,
            claimId,
            assessedAmount,
            reason,
            state: 'ASSESSED',
            assessedByUserId: assessor.id,
            assessedAt: new Date(),
          },
        });
        await tx.subcontractClaim.update({
          where: { id: claimId },
          data: { state: 'ASSESSED' },
        });
        return decision;
      });

    const directEqualClaim = await createSubmittedAssessmentBoundClaim(
      '2028-05-01',
      '2028-05-31',
      '100.00',
      'direct-bound-equal-submit-' + suffix,
    );
    const directEqualAssessment = await directlyAssessBoundClaim(
      directEqualClaim.id,
      '100.00',
      'Direct database assessment equal to retained Claim total.',
    );
    assert.equal(directEqualAssessment.assessedAmount.toFixed(2), '100.00');
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: directEqualClaim.id },
      })).state,
      'ASSESSED',
      'direct assessment equal to retained Claim total must remain valid',
    );

    const directLowerClaim = await createSubmittedAssessmentBoundClaim(
      '2028-06-01',
      '2028-06-30',
      '100.00',
      'direct-bound-lower-submit-' + suffix,
    );
    const directLowerAssessment = await directlyAssessBoundClaim(
      directLowerClaim.id,
      '75.00',
      'Direct database assessment below retained Claim total.',
    );
    assert.equal(directLowerAssessment.assessedAmount.toFixed(2), '75.00');
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: directLowerClaim.id },
      })).state,
      'ASSESSED',
      'direct assessment below retained Claim total must remain valid',
    );

    const directOverClaim = await createSubmittedAssessmentBoundClaim(
      '2028-07-01',
      '2028-07-31',
      '100.00',
      'direct-bound-over-submit-' + suffix,
    );
    await assert.rejects(
      () =>
        directlyAssessBoundClaim(
          directOverClaim.id,
          '100.01',
          'Direct database assessment above retained Claim total.',
        ),
      'database must reject a direct Assessment above the retained Claim total',
    );
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: directOverClaim.id },
      })).state,
      'SUBMITTED',
      'rejected direct over-assessment must roll back the Claim state transition',
    );
    assert.equal(
      await prisma.subcontractClaimAssessment.count({
        where: { claimId: directOverClaim.id },
      }),
      0,
      'rejected direct over-assessment must roll back Assessment evidence',
    );

    // The monetary bound must be checked against the final committed Claim
    // lines, not only against the line total observed when Assessment is inserted.
    const directMutableDraft = await claims.createClaim(
      { auth: makerAuth },
      assessmentBoundAgreement.id,
      {
        periodStart: new Date('2028-08-01T00:00:00.000Z'),
        periodEnd: new Date('2028-08-31T00:00:00.000Z'),
      },
    );
    const directMutableLine = await claims.addLine(
      { auth: makerAuth },
      directMutableDraft.id,
      { amount: '100.00' },
    );
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const assessedAt = new Date();
          await tx.subcontractClaimAssessment.create({
            data: {
              companyId: company.id,
              projectId: project.id,
              agreementId: assessmentBoundAgreement.id,
              claimId: directMutableDraft.id,
              assessedAmount: '100.00',
              reason: 'Must be checked against the final retained line total.',
              state: 'ASSESSED',
              assessedByUserId: assessor.id,
              assessedAt,
            },
          });
          await tx.subcontractClaimLine.update({
            where: { id: directMutableLine.id },
            data: { amount: '50.00' },
          });
          await tx.subcontractClaim.update({
            where: { id: directMutableDraft.id },
            data: {
              state: 'SUBMITTED',
              submittedByUserId: maker.id,
              submittedAt: assessedAt,
            },
          });
          await tx.subcontractClaim.update({
            where: { id: directMutableDraft.id },
            data: { state: 'ASSESSED' },
          });
        }),
      'deferred database consistency must reject an Assessment above the final retained Claim total',
    );
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: directMutableDraft.id },
      })).state,
      'DRAFT',
      'failed direct Assessment transaction must roll back Claim lifecycle changes',
    );
    assert.equal(
      (await prisma.subcontractClaimLine.findUniqueOrThrow({
        where: { id: directMutableLine.id },
      })).amount.toFixed(2),
      '100.00',
      'failed direct Assessment transaction must roll back Draft line mutation',
    );
    assert.equal(
      await prisma.subcontractClaimAssessment.count({
        where: { claimId: directMutableDraft.id },
      }),
      0,
      'failed direct Assessment transaction must roll back Assessment evidence',
    );

    // Inserts as terminal assessment states must also carry reciprocal
    // Assessment evidence. Single-statement direct inserts cannot fabricate it.
    for (const [badState, periodStart, periodEnd] of [
      ['ASSESSED', '2028-01-01', '2028-01-31'],
      ['REJECTED', '2028-02-01', '2028-02-29'],
    ] as const) {
      await assert.rejects(
        () =>
          prisma.subcontractClaim.create({
            data: {
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-DI-' + badState[0] + '-' + suffix,
              periodStart: new Date(periodStart + 'T00:00:00.000Z'),
              periodEnd: new Date(periodEnd + 'T00:00:00.000Z'),
              currencyCode: agreement.currencyCode,
              state: badState,
              createdByUserId: maker.id,
              submittedByUserId: maker.id,
              submittedAt: new Date(),
            },
          }),
        'database must reject inserted ' + badState + ' Claim without matching Assessment',
      );
    }

    // Direct SQL/Prisma cannot invent ASSESSED state without retained
    // assessment decision evidence. Valid assessment below must still work.
    await assert.rejects(
      () => prisma.subcontractClaim.update({
        where: { id: claim.id },
        data: { state: 'ASSESSED' },
      }),
      'database must reject SUBMITTED -> ASSESSED without matching Assessment',
    );
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: claim.id },
      })).state,
      'SUBMITTED',
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

    const claimOnlyReader: AuthenticatedUserContext = {
      ...makerAuth,
      permissions: ['projects.access_all', 'subcontracts.claim.view'],
    };
    const assessmentReader: AuthenticatedUserContext = {
      ...assessorAuth,
      permissions: [
        'projects.access_all',
        'subcontracts.claim.view',
        'subcontracts.assessment.view',
      ],
    };
    const claimOnlyDetail = await claims.getClaim(claimOnlyReader, claim.id);
    assert.equal(
      claimOnlyDetail.assessment,
      null,
      'Claim view alone must not disclose Assessment detail',
    );
    const claimOnlyList = await claims.listClaims(
      claimOnlyReader,
      agreement.id,
    );
    assert.equal(
      claimOnlyList.find((row) => row.id === claim.id)?.assessment,
      null,
      'Claim list must redact Assessment history without assessment.view',
    );
    const assessmentDetail = await claims.getClaim(
      assessmentReader,
      claim.id,
    );
    assert.equal(
      assessmentDetail.assessment?.assessedAmount.toFixed(2),
      '500.00',
      'assessment.view must expose retained Assessment history',
    );

    const replayedSubmitAfterAssessment = await claims.submitClaim(
      { auth: claimOnlyReader },
      claim.id,
      'claim-submit-' + suffix,
    );
    assert.equal(replayedSubmitAfterAssessment.state, 'ASSESSED');
    assert.equal(
      replayedSubmitAfterAssessment.assessment,
      null,
      'submit replay must not disclose a later Assessment without assessment.view',
    );

    const assessAudit = await prisma.auditLog.findFirst({
      where: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_CLAIM_ASSESSMENT',
        entityId: assessed.assessment!.id,
        action: 'ASSESS',
      },
    });
    assert.ok(
      assessAudit,
      'Assessment creation audit must be keyed to the Assessment entity ID',
    );

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

    await assert.rejects(
      () => prisma.subcontractClaim.update({
        where: { id: claim.id },
        data: { state: 'REJECTED' },
      }),
      'database must reject ASSESSED -> REJECTED while Assessment is still active',
    );
    await assert.rejects(
      () => prisma.subcontractClaimAssessment.update({
        where: { id: assessed.assessment!.id },
        data: {
          state: 'REJECTED',
          rejectedByUserId: assessor.id,
          rejectedAt: new Date(),
          rejectionReason: 'Cannot reject Assessment without updating its Claim.',
        },
      }),
      'database must reject standalone Assessment rejection without Claim correction',
    );
    const stillAssessed = await prisma.subcontractClaim.findUniqueOrThrow({
      where: { id: claim.id },
      include: { assessment: true },
    });
    assert.equal(stillAssessed.state, 'ASSESSED');
    assert.equal(stillAssessed.assessment?.state, 'ASSESSED');

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

    // Terminal exact-period history must not be bypassed through generic
    // create or by changing the period of an unrelated Draft.
    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          agreement.id,
          {
            periodStart: claim.periodStart,
            periodEnd: claim.periodEnd,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'rejected Claim period must require a linked replacement',
    );
    const unrelatedDraft = await claims.createClaim(
      { auth: makerAuth },
      agreement.id,
      {
        periodStart: new Date('2027-05-01T00:00:00.000Z'),
        periodEnd: new Date('2027-05-31T00:00:00.000Z'),
      },
    );
    await assert.rejects(
      () =>
        claims.updateClaim(
          { auth: makerAuth },
          unrelatedDraft.id,
          { periodStart: claim.periodStart, periodEnd: claim.periodEnd },
        ),
      (error: unknown) => error instanceof ConflictException,
      'changing an unrelated Draft to a terminal period must be denied',
    );

    const unlinkedDirectCorrectionId = randomUUID();
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const submittedAt = new Date();
          await tx.subcontractClaim.create({
            data: {
              id: unlinkedDirectCorrectionId,
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-UNLINK-' + suffix,
              periodStart: claim.periodStart,
              periodEnd: claim.periodEnd,
              currencyCode: agreement.currencyCode,
              state: 'DRAFT',
              createdByUserId: maker.id,
            },
          });
          await tx.subcontractClaimLine.create({
            data: {
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimId: unlinkedDirectCorrectionId,
              lineNo: 1,
              amount: '10.00',
            },
          });
          await tx.subcontractClaim.update({
            where: { id: unlinkedDirectCorrectionId },
            data: {
              state: 'SUBMITTED',
              submittedByUserId: maker.id,
              submittedAt,
            },
          });
        }),
      'database must reject an unlinked direct correction for retained terminal Claim history',
    );
    assert.equal(
      await prisma.subcontractClaim.count({
        where: { id: unlinkedDirectCorrectionId },
      }),
      0,
      'invalid unlinked direct correction must roll back the Claim',
    );
    assert.equal(
      await prisma.subcontractClaimLine.count({
        where: { claimId: unlinkedDirectCorrectionId },
      }),
      0,
      'invalid unlinked direct correction must roll back its Claim lines',
    );

    const replacement = await claims.createReplacement(
      { auth: makerAuth },
      claim.id,
    );
    await assert.rejects(
      () =>
        claims.updateClaim(
          { auth: makerAuth },
          replacement.id,
          { periodEnd: new Date('2026-09-29T00:00:00.000Z') },
        ),
      (error: unknown) => error instanceof ConflictException,
      'a linked replacement must retain the predecessor period',
    );

    await assert.rejects(
      () =>
        prisma.subcontractClaim.update({
          where: { id: replacement.id },
          data: { periodEnd: new Date('2026-09-29T00:00:00.000Z') },
        }),
      'database must reject direct period edits on a linked Draft replacement',
    );
    const replacementAfterDirectPeriodEdit =
      await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: replacement.id },
      });
    assert.equal(
      replacementAfterDirectPeriodEdit.periodEnd.getTime(),
      claim.periodEnd.getTime(),
      'rejected direct period edit must retain the predecessor period',
    );

    assert.notEqual(replacement.claimNumber, claim.claimNumber);
    assert.equal(replacement.replacementForClaimId, claim.id);

    // Direct INSERT/future Prisma paths must not fabricate a completed
    // replacement lineage without either withdrawal evidence or a rejected
    // Assessment on the predecessor.
    const evidenceFreeSourceId = randomUUID();
    const evidenceFreeReplacementId = randomUUID();
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const insertedAt = new Date();
          await tx.subcontractClaim.create({
            data: {
              id: evidenceFreeSourceId,
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-NOE-SRC-' + suffix,
              periodStart: new Date('2028-03-01T00:00:00.000Z'),
              periodEnd: new Date('2028-03-31T00:00:00.000Z'),
              currencyCode: agreement.currencyCode,
              state: 'REPLACED',
              createdByUserId: maker.id,
              submittedByUserId: maker.id,
              submittedAt: insertedAt,
              replacedAt: insertedAt,
            },
          });
          await tx.subcontractClaim.create({
            data: {
              id: evidenceFreeReplacementId,
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-NOE-RPL-' + suffix,
              periodStart: new Date('2028-03-01T00:00:00.000Z'),
              periodEnd: new Date('2028-03-31T00:00:00.000Z'),
              currencyCode: agreement.currencyCode,
              state: 'SUBMITTED',
              replacementForClaimId: evidenceFreeSourceId,
              createdByUserId: maker.id,
              submittedByUserId: maker.id,
              submittedAt: insertedAt,
            },
          });
        }),
      'database must reject inserted replacement lineage without correction evidence',
    );
    assert.equal(
      await prisma.subcontractClaim.count({
        where: {
          id: { in: [evidenceFreeSourceId, evidenceFreeReplacementId] },
        },
      }),
      0,
      'invalid evidence-free replacement lineage must roll back completely',
    );

    // Direct SQL/future Prisma replacement lineage must correct the exact same
    // predecessor period even when all other correction evidence is valid.
    const mismatchedPeriodSourceId = randomUUID();
    const mismatchedPeriodReplacementId = randomUUID();
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          const insertedAt = new Date();
          await tx.subcontractClaim.create({
            data: {
              id: mismatchedPeriodSourceId,
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-MISMATCH-SRC-' + suffix,
              periodStart: new Date('2028-04-01T00:00:00.000Z'),
              periodEnd: new Date('2028-04-30T00:00:00.000Z'),
              currencyCode: agreement.currencyCode,
              state: 'REPLACED',
              createdByUserId: maker.id,
              submittedByUserId: maker.id,
              submittedAt: insertedAt,
              withdrawnByUserId: maker.id,
              withdrawnAt: insertedAt,
              withdrawalReason: 'Valid withdrawal correction evidence.',
              replacedAt: insertedAt,
            },
          });
          await tx.subcontractClaim.create({
            data: {
              id: mismatchedPeriodReplacementId,
              companyId: company.id,
              projectId: project.id,
              agreementId: agreement.id,
              claimNumber: 'SCL-MISMATCH-RPL-' + suffix,
              periodStart: new Date('2028-04-01T00:00:00.000Z'),
              periodEnd: new Date('2028-04-29T00:00:00.000Z'),
              currencyCode: agreement.currencyCode,
              state: 'SUBMITTED',
              replacementForClaimId: mismatchedPeriodSourceId,
              createdByUserId: maker.id,
              submittedByUserId: maker.id,
              submittedAt: insertedAt,
            },
          });
        }),
      'database must reject linked replacement whose period differs from predecessor',
    );
    assert.equal(
      await prisma.subcontractClaim.count({
        where: {
          id: { in: [mismatchedPeriodSourceId, mismatchedPeriodReplacementId] },
        },
      }),
      0,
      'mismatched-period replacement lineage must roll back completely',
    );

    const replacementLine = await claims.addLine(
      { auth: makerAuth },
      replacement.id,
      { amount: '500.00' },
    );

    // A rejected correction path must not be rewritten as a withdrawal path
    // while the predecessor/successor replacement transition commits atomically.
    await assert.rejects(
      () =>
        prisma.$transaction(async (tx) => {
          await tx.subcontractClaim.update({
            where: { id: claim.id },
            data: {
              state: 'REPLACED',
              replacedAt: new Date(),
              withdrawnByUserId: maker.id,
              withdrawnAt: new Date(),
              withdrawalReason: 'Contradictory withdrawal evidence.',
            },
          });
          await tx.subcontractClaim.update({
            where: { id: replacement.id },
            data: {
              state: 'SUBMITTED',
              submittedByUserId: maker.id,
              submittedAt: new Date(),
            },
          });
        }),
      'database must reject withdrawal evidence on a rejected Claim replacement',
    );
    const rejectedLineageAfterInvalidReplacement =
      await prisma.subcontractClaim.findMany({
        where: { id: { in: [claim.id, replacement.id] } },
        select: {
          id: true,
          state: true,
          withdrawnAt: true,
          withdrawnByUserId: true,
          withdrawalReason: true,
        },
      });
    const rejectedSourceAfterInvalidReplacement =
      rejectedLineageAfterInvalidReplacement.find((row) => row.id === claim.id);
    const rejectedReplacementAfterInvalidReplacement =
      rejectedLineageAfterInvalidReplacement.find(
        (row) => row.id === replacement.id,
      );
    assert.equal(rejectedSourceAfterInvalidReplacement?.state, 'REJECTED');
    assert.equal(rejectedSourceAfterInvalidReplacement?.withdrawnAt, null);
    assert.equal(rejectedSourceAfterInvalidReplacement?.withdrawnByUserId, null);
    assert.equal(rejectedSourceAfterInvalidReplacement?.withdrawalReason, null);
    assert.equal(rejectedReplacementAfterInvalidReplacement?.state, 'DRAFT');

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
    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          agreement.id,
          {
            periodStart: claim.periodStart,
            periodEnd: claim.periodEnd,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'generic creation must not erase period history after predecessor is REPLACED',
    );

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
    // Direct SQL/Prisma must not move SUBMITTED to WITHDRAWN without the
    // complete actor/time/reason evidence required by BR-V05-11.
    await assert.rejects(
      () =>
        prisma.$executeRaw`UPDATE "subcontract_claims"
          SET "state" = 'WITHDRAWN'
          WHERE "id" = ${withdrawal.id}::uuid`,
      'database must reject a withdrawal transition missing all withdrawal evidence',
    );
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: withdrawal.id },
      })).state,
      'SUBMITTED',
    );

    const withdrawn = await claims.withdrawClaim(
      { auth: makerAuth },
      withdrawal.id,
      'Incorrect source measurement.',
      'withdrawal-action-' + suffix,
    );
    assert.equal(withdrawn.state, 'WITHDRAWN');
    assert.equal(withdrawn.withdrawalReason, 'Incorrect source measurement.');

    await assert.rejects(
      () =>
        prisma.subcontractClaim.update({
          where: { id: withdrawal.id },
          data: { state: 'REPLACED', replacedAt: new Date() },
        }),
      'database must reject REPLACED predecessor without linked submitted successor',
    );
    assert.equal(
      (await prisma.subcontractClaim.findUniqueOrThrow({
        where: { id: withdrawal.id },
      })).state,
      'WITHDRAWN',
    );

    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          agreement.id,
          {
            periodStart: withdrawal.periodStart,
            periodEnd: withdrawal.periodEnd,
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'withdrawn Claim period must use the linked replacement path',
    );

    const withdrawalReplacement = await claims.createReplacement(
      { auth: makerAuth },
      withdrawal.id,
    );
    await assert.rejects(
      () =>
        prisma.subcontractClaim.update({
          where: { id: withdrawalReplacement.id },
          data: {
            state: 'SUBMITTED',
            submittedByUserId: maker.id,
            submittedAt: new Date(),
          },
        }),
      'database must reject submitted linked replacement while predecessor is not REPLACED',
    );
    const lineageBeforeSubmit = await prisma.subcontractClaim.findMany({
      where: { id: { in: [withdrawal.id, withdrawalReplacement.id] } },
      select: { id: true, state: true },
    });
    assert.equal(
      lineageBeforeSubmit.find((row) => row.id === withdrawal.id)?.state,
      'WITHDRAWN',
    );
    assert.equal(
      lineageBeforeSubmit.find((row) => row.id === withdrawalReplacement.id)?.state,
      'DRAFT',
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

    const historyAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-H' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Cancelled Agreement retained-history package',
        currencyCode: 'SGD',
        approvalState: 'APPROVED',
        firstApprovedAt: new Date(),
        createdByUserId: maker.id,
      },
    });
    const historyClaim = await claims.createClaim(
      { auth: makerAuth },
      historyAgreement.id,
      {
        periodStart: new Date('2027-02-01T00:00:00.000Z'),
        periodEnd: new Date('2027-02-28T00:00:00.000Z'),
      },
    );
    await claims.addLine(
      { auth: makerAuth },
      historyClaim.id,
      { amount: '50.00' },
    );
    await claims.submitClaim(
      { auth: makerAuth },
      historyClaim.id,
      'history-submit-' + suffix,
    );
    await claims.withdrawClaim(
      { auth: makerAuth },
      historyClaim.id,
      'Retain this Claim as cancelled-agreement history.',
      'history-withdraw-' + suffix,
    );

    const historyDraft = await claims.createClaim(
      { auth: makerAuth },
      historyAgreement.id,
      {
        periodStart: new Date('2027-03-01T00:00:00.000Z'),
        periodEnd: new Date('2027-03-31T00:00:00.000Z'),
      },
    );
    const historyDraftLine = await claims.addLine(
      { auth: makerAuth },
      historyDraft.id,
      { amount: '25.00' },
    );

    const cancelledHistoryAgreement = await workflow.cancelAgreement(
      { auth: assessorAuth },
      historyAgreement.id,
      'Agreement package cancelled after retaining terminal Claim history.',
      'history-agreement-cancel-' + suffix,
    );
    assert.equal(cancelledHistoryAgreement.approvalState, 'CANCELLED');
    assert.ok(cancelledHistoryAgreement.cancelledAt);

    const historyOptions = await claims.claimAgreementOptions(makerAuth);
    const cancelledHistoryOption = historyOptions.find(
      (row) => row.id === historyAgreement.id,
    );
    assert.equal(
      cancelledHistoryOption?.approvalState,
      'CANCELLED',
      'cancelled Agreements with retained Claim history must remain discoverable',
    );
    assert.ok(
      cancelledHistoryOption?.cancelledAt,
      'history selector must expose cancellation state for read-only presentation',
    );

    const retainedHistory = await claims.listClaims(
      assessmentReader,
      historyAgreement.id,
    );
    assert.deepEqual(
      retainedHistory.map((row) => row.state).sort(),
      ['DRAFT', 'WITHDRAWN'],
      'cancelled Agreement history must remain readable, including a surviving Draft',
    );

    await assert.rejects(
      () =>
        claims.createClaim(
          { auth: makerAuth },
          historyAgreement.id,
          {
            periodStart: new Date('2027-04-01T00:00:00.000Z'),
            periodEnd: new Date('2027-04-30T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'cancelled Agreements must reject new Claim Draft creation',
    );
    await assert.rejects(
      () =>
        claims.updateClaim(
          { auth: makerAuth },
          historyDraft.id,
          { periodEnd: new Date('2027-03-30T00:00:00.000Z') },
        ),
      (error: unknown) => error instanceof ConflictException,
      'surviving Draft periods must become read-only after Agreement cancellation',
    );
    await assert.rejects(
      () =>
        claims.addLine(
          { auth: makerAuth },
          historyDraft.id,
          { amount: '1.00' },
        ),
      (error: unknown) => error instanceof ConflictException,
      'surviving Drafts must reject new lines after Agreement cancellation',
    );
    await assert.rejects(
      () =>
        claims.updateLine(
          { auth: makerAuth },
          historyDraftLine.id,
          { amount: '26.00' },
        ),
      (error: unknown) => error instanceof ConflictException,
      'surviving Draft lines must be immutable after Agreement cancellation',
    );
    await assert.rejects(
      () => claims.deleteLine({ auth: makerAuth }, historyDraftLine.id),
      (error: unknown) => error instanceof ConflictException,
      'surviving Draft lines must not be deletable after Agreement cancellation',
    );
    await assert.rejects(
      () => claims.createReplacement({ auth: makerAuth }, historyClaim.id),
      (error: unknown) => error instanceof ConflictException,
      'cancelled Agreements must reject linked replacement creation',
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
