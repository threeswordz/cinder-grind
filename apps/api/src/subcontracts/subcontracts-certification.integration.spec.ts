import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
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
import { RetentionService } from '../finance/retention.service';
import { SubcontractsCertificationController } from './subcontracts-certification.controller';
import { SubcontractsCertificationService } from './subcontracts-certification.service';
import { SubcontractsClaimsService } from './subcontracts-claims.service';

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
    displayName: 'V0.5-D Test User',
    roleCodes,
    permissions: accessAll ? ['projects.access_all'] : [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.5-D Certification routes retain explicit permission metadata', () => {
  const routes = [
    ['workflowOptions', ['subcontracts.certification.view', 'subcontracts.certification.submit']],
    ['certificationsForAgreement', ['subcontracts.certification.view']],
    ['certification', ['subcontracts.certification.view']],
    ['financeReference', ['subcontracts.certification.view', 'finance.payment.view']],
    ['createCertification', ['subcontracts.certification.view', 'subcontracts.certification.create']],
    ['updateCertification', ['subcontracts.certification.view', 'subcontracts.certification.edit']],
    ['submitCertification', ['subcontracts.certification.view', 'subcontracts.certification.submit']],
    ['approveCertification', ['subcontracts.certification.view', 'subcontracts.certification.approve']],
    ['rejectCertification', ['subcontracts.certification.view', 'subcontracts.certification.reject']],
    ['reverseCertification', ['subcontracts.certification.view', 'subcontracts.certification.reverse']],
  ] as const;

  for (const [method, permissions] of routes) {
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        SubcontractsCertificationController.prototype[method],
      ),
      permissions,
      method + ' must retain its Stage-D Certification permission boundary',
    );
  }
});

test('V0.5-D certifies assessed Claims with retained withholding, history and concurrency guards', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCD-' + suffix,
        companyName: 'Subcontracts Stage D ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SCD-C-' + suffix,
        customerName: 'Stage D Customer',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCD-P-' + suffix,
        projectName: 'Stage D Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCD-XP-' + suffix,
        projectName: 'Stage D Other Project',
        customerId: customer.id,
        contractValue: '50000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-12-31T00:00:00.000Z'),
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scd-maker-' + suffix + '@example.com',
        displayName: 'Stage D Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scd-checker-' + suffix + '@example.com',
        displayName: 'Stage D Checker',
        passwordHash: 'x',
      },
    });
    const noRole = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scd-norole-' + suffix + '@example.com',
        displayName: 'Stage D No Role',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scd-outsider-' + suffix + '@example.com',
        displayName: 'Stage D Outsider',
        passwordHash: 'x',
      },
    });
    const subcontractor = await prisma.subcontractor.create({
      data: {
        companyId: company.id,
        subcontractorCode: 'SCD-S-' + suffix,
        subcontractorName: 'Stage D Subcontractor',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'SCD_CERT_' + suffix,
        roleName: 'Stage D Certification Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SC_CERT_' + suffix,
        entityType: 'SUBCONTRACT_CERTIFICATION',
        workflowName: 'Certification Approval',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Certification Checker',
            requiredApprovals: 1,
            stepRoles: { create: { roleId: role.id } },
          },
        },
      },
    });

    const authorization = new AuthorizationService();
    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(authorization),
    );
    const audit = new AuditService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const claims = new SubcontractsClaimsService(
      prisma,
      access,
      audit,
      numbers,
    );
    const certifications = new SubcontractsCertificationService(
      prisma,
      access,
      new ApprovalService(prisma),
      audit,
      numbers,
    );
    const retention = new RetentionService(prisma, access);

    const makerAuth = auth(company.id, maker.id);
    const makerApproverAuth = auth(company.id, maker.id, [role.roleCode]);
    const checkerAuth = auth(company.id, checker.id, [role.roleCode]);
    const noRoleAuth = auth(company.id, noRole.id);
    const outsiderAuth = auth(
      company.id,
      outsider.id,
      [role.roleCode],
      false,
    );

    const createAgreement = (label: string, input: {
      originalValue: string;
      retentionRate: string;
      retentionCap?: string | null;
    }) =>
      prisma.subcontractAgreement.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          subcontractorId: subcontractor.id,
          agreementNumber:
            'SC2610-' + label + suffix.slice(0, 2).toUpperCase(),
          originalValue: input.originalValue,
          scopeOfWork: 'Stage D ' + label + ' package',
          currencyCode: 'SGD',
          retentionRate: input.retentionRate,
          retentionCap: input.retentionCap ?? null,
          approvalState: 'APPROVED',
          firstApprovedAt: new Date(),
          createdByUserId: maker.id,
        },
      });

    const createAssessedClaim = async (
      agreementId: string,
      periodStart: string,
      periodEnd: string,
      amount: string,
      key: string,
    ) => {
      const claim = await claims.createClaim(
        { auth: makerAuth },
        agreementId,
        {
          periodStart: new Date(periodStart + 'T00:00:00.000Z'),
          periodEnd: new Date(periodEnd + 'T00:00:00.000Z'),
        },
      );
      await claims.addLine(
        { auth: makerAuth },
        claim.id,
        { amount },
      );
      await claims.submitClaim(
        { auth: makerAuth },
        claim.id,
        'submit-' + key + '-' + suffix,
      );
      return claims.assessClaim(
        { auth: checkerAuth },
        claim.id,
        {
          assessedAmount: amount,
          reason: 'Accepted Stage D measured progress.',
          actionKey: 'assess-' + key + '-' + suffix,
        },
      );
    };

    const cappedAgreement = await createAgreement('CAP', {
      originalValue: '1000.00',
      retentionRate: '10.00',
      retentionCap: '15.00',
    });
    const claimOne = await createAssessedClaim(
      cappedAgreement.id,
      '2026-10-01',
      '2026-10-31',
      '100.00',
      'cap-one',
    );
    const certOne = await certifications.createCertification(
      { auth: makerAuth },
      claimOne.id,
      { certifiedGross: '100.00' },
    );
    assert.match(certOne.certificationNumber, /^SCT\d{4}-\d{3}$/);
    assert.equal(certOne.state, 'DRAFT');

    await assert.rejects(
      () => certifications.getCertification(outsiderAuth, certOne.id),
      (error: unknown) => error instanceof ForbiddenException,
      'Project scope must be enforced before retained Certification detail is disclosed',
    );

    await assert.rejects(
      () =>
        prisma.subcontractCertification.create({
          data: {
            companyId: company.id,
            projectId: otherProject.id,
            agreementId: cappedAgreement.id,
            claimId: claimOne.id,
            assessmentId: claimOne.assessment!.id,
            certificationNumber: 'SCT2610-998',
            currencyCode: 'SGD',
            certifiedGross: '50.00',
            createdByUserId: maker.id,
          },
        }),
      'database must reject cross-Project Certification source references',
    );
    await assert.rejects(
      () =>
        prisma.subcontractCertification.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            agreementId: cappedAgreement.id,
            claimId: claimOne.id,
            assessmentId: claimOne.assessment!.id,
            certificationNumber: 'SCT2610-999',
            currencyCode: 'SGD',
            certifiedGross: '100.01',
            createdByUserId: maker.id,
          },
        }),
      'database must reject certified gross above the retained Assessment',
    );

    const submittedOne = await certifications.submitCertification(
      { auth: checkerAuth },
      certOne.id,
      workflow.workflowCode,
      'cert-submit-one-' + suffix,
    );
    assert.equal(submittedOne.state, 'SUBMITTED');

    const replayedSubmit = await certifications.submitCertification(
      { auth: checkerAuth },
      certOne.id,
      workflow.workflowCode,
      'cert-submit-one-' + suffix,
    );
    assert.equal(replayedSubmit.state, 'SUBMITTED');

    await assert.rejects(
      () =>
        prisma.approvalInstance.update({
          where: { id: submittedOne.approvalInstanceId! },
          data: { approvalState: 'APPROVED', completedAt: new Date() },
        }),
      'database must reject ApprovalInstance state changes that are not reciprocated by Certification lifecycle state',
    );

    await assert.rejects(
      () =>
        certifications.submitCertification(
          { auth: checkerAuth },
          certOne.id,
          workflow.workflowCode + '_CHANGED',
          'cert-submit-one-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'action-key reuse with changed material payload must conflict',
    );

    await assert.rejects(
      () =>
        certifications.approveCertification(
          { auth: makerApproverAuth },
          certOne.id,
          'maker-approve-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
      'Certification draft creator cannot final-approve even when another user submitted it',
    );
    await assert.rejects(
      () =>
        certifications.approveCertification(
          { auth: noRoleAuth },
          certOne.id,
          'norole-approve-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
      'configured Approval Matrix role is required for Certification approval',
    );

    const approvedOne = await certifications.approveCertification(
      { auth: checkerAuth },
      certOne.id,
      'checker-approve-one-' + suffix,
      'Approved Stage D certification.',
    );
    assert.equal(approvedOne.state, 'APPROVED');
    assert.equal(approvedOne.assessedAmountSnapshot?.toFixed(2), '100.00');
    assert.equal(approvedOne.retentionRateSnapshot?.toFixed(2), '10.00');
    assert.equal(approvedOne.retentionCapSnapshot?.toFixed(2), '15.00');
    assert.equal(approvedOne.retainedBeforeSnapshot?.toFixed(2), '0.00');
    assert.equal(approvedOne.retainedAmount?.toFixed(2), '10.00');
    assert.equal(approvedOne.netCertifiedAmount?.toFixed(2), '90.00');

    const withholdingEntries = await prisma.retentionLedgerEntry.findMany({
      where: { certificationId: certOne.id },
      orderBy: { recordedAt: 'asc' },
    });
    assert.equal(withholdingEntries.length, 1);
    assert.equal(withholdingEntries[0]?.entryType, 'WITHHOLDING');
    assert.equal(withholdingEntries[0]?.amount.toFixed(2), '10.00');
    assert.equal(withholdingEntries[0]?.recordedByUserId, checker.id);

    const financeReferenceBeforePayment =
      await certifications.financeReference(checkerAuth, certOne.id);
    assert.equal(financeReferenceBeforePayment.allocations.length, 0);

    const retentionBeforeReversal = await retention.list(
      checkerAuth,
      project.id,
    );
    const retentionRow = retentionBeforeReversal.find(
      (row) => row.id === certOne.id,
    );
    assert.ok(retentionRow);
    assert.equal(retentionRow.financeState, 'ACTIVE');
    assert.equal(retentionRow.retentionBalance?.toFixed(2), '10.00');

    await assert.rejects(
      () =>
        prisma.retentionLedgerEntry.update({
          where: { id: withholdingEntries[0]!.id },
          data: { amount: '9.99' },
        }),
      /RETENTION_LEDGER_IMMUTABLE/,
      'retention ledger history must be immutable below the API',
    );

    const replayedApproval = await certifications.approveCertification(
      { auth: checkerAuth },
      certOne.id,
      'checker-approve-one-' + suffix,
      'Approved Stage D certification.',
    );
    assert.equal(replayedApproval.state, 'APPROVED');
    await assert.rejects(
      () =>
        certifications.approveCertification(
          { auth: checkerAuth },
          certOne.id,
          'checker-approve-one-' + suffix,
          'Changed comment',
        ),
      (error: unknown) => error instanceof ConflictException,
      'final approval retry key must remain bound to its original payload',
    );

    await assert.rejects(
      () =>
        prisma.subcontractCertification.update({
          where: { id: certOne.id },
          data: { certifiedGross: '99.00' },
        }),
      'approved Certification source must remain immutable below the API',
    );
    await assert.rejects(
      () =>
        prisma.subcontractCertification.update({
          where: { id: certOne.id },
          data: { retainedAmount: '9.99' },
        }),
      'approved retention snapshot must remain immutable below the API',
    );
    await assert.rejects(
      () =>
        prisma.subcontractCertification.delete({ where: { id: certOne.id } }),
      'Certification history must not be hard-deletable',
    );
    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: cappedAgreement.id },
          data: {
            approvalState: 'CANCELLED',
            cancelledAt: new Date(),
            cancellationReason: 'Must be blocked by active Certification.',
          },
        }),
      'non-reversed approved Certification must block Agreement cancellation',
    );

    const claimTwo = await createAssessedClaim(
      cappedAgreement.id,
      '2026-11-01',
      '2026-11-30',
      '100.00',
      'cap-two',
    );
    const certTwo = await certifications.createCertification(
      { auth: makerAuth },
      claimTwo.id,
      { certifiedGross: '100.00' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      certTwo.id,
      workflow.workflowCode,
      'cert-submit-two-' + suffix,
    );
    const approvedTwo = await certifications.approveCertification(
      { auth: checkerAuth },
      certTwo.id,
      'checker-approve-two-' + suffix,
    );
    assert.equal(approvedTwo.retainedBeforeSnapshot?.toFixed(2), '10.00');
    assert.equal(approvedTwo.retainedAmount?.toFixed(2), '5.00');
    assert.equal(approvedTwo.netCertifiedAmount?.toFixed(2), '95.00');

    const claimThree = await createAssessedClaim(
      cappedAgreement.id,
      '2026-12-01',
      '2026-12-31',
      '100.00',
      'cap-three',
    );
    const certThree = await certifications.createCertification(
      { auth: makerAuth },
      claimThree.id,
      { certifiedGross: '100.00' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      certThree.id,
      workflow.workflowCode,
      'cert-submit-three-' + suffix,
    );
    const approvedThree = await certifications.approveCertification(
      { auth: checkerAuth },
      certThree.id,
      'checker-approve-three-' + suffix,
    );
    assert.equal(approvedThree.retainedBeforeSnapshot?.toFixed(2), '15.00');
    assert.equal(approvedThree.retainedAmount?.toFixed(2), '0.00');
    assert.equal(approvedThree.netCertifiedAmount?.toFixed(2), '100.00');

    await prisma.company.update({
      where: { id: company.id },
      data: { baseCurrencyCode: 'USD' },
    });

    const reversedOne = await certifications.reverseCertification(
      { auth: checkerAuth },
      certOne.id,
      'Correct the underlying assessed Claim.',
      'cert-reverse-one-' + suffix,
    );
    assert.equal(reversedOne.state, 'REVERSED');
    assert.equal(reversedOne.reversalReason, 'Correct the underlying assessed Claim.');
    assert.equal(reversedOne.retainedAmount?.toFixed(2), '10.00');
    assert.ok(reversedOne.reversedAt);

    const reversedEntries = await prisma.retentionLedgerEntry.findMany({
      where: { certificationId: certOne.id },
      orderBy: { recordedAt: 'asc' },
    });
    assert.equal(reversedEntries.length, 2);
    assert.deepEqual(
      reversedEntries.map((entry) => entry.entryType),
      ['WITHHOLDING', 'REVERSAL'],
    );
    assert.equal(reversedEntries[1]?.amount.toFixed(2), '10.00');
    assert.equal(
      reversedEntries[1]?.reversesEntryId,
      reversedEntries[0]?.id,
    );
    const retentionAfterReversal = await retention.list(
      checkerAuth,
      project.id,
    );
    const reversedRetentionRow = retentionAfterReversal.find(
      (row) => row.id === certOne.id,
    );
    assert.ok(reversedRetentionRow);
    assert.equal(reversedRetentionRow.financeState, 'REVERSED');
    assert.equal(reversedRetentionRow.retentionBalance?.toFixed(2), '0.00');
    assert.equal(reversedRetentionRow.currencyCode, 'SGD');
    assert.equal(
      reversedRetentionRow.baseCurrencyCode,
      'USD',
      'historical withholding must remain reversible after a later Company base-currency change',
    );
    assert.deepEqual(
      reversedEntries.map((entry) => entry.currencyCode),
      ['SGD', 'SGD'],
      'compensating reversal must reuse the original withholding currency without FX conversion',
    );

    await prisma.company.update({
      where: { id: company.id },
      data: { baseCurrencyCode: 'SGD' },
    });

    const replacement = await claims.createReplacement(
      { auth: makerAuth },
      claimOne.id,
    );
    assert.equal(replacement.replacementForClaimId, claimOne.id);
    await claims.addLine(
      { auth: makerAuth },
      replacement.id,
      { amount: '90.00' },
    );
    await claims.submitClaim(
      { auth: makerAuth },
      replacement.id,
      'replacement-submit-' + suffix,
    );
    const replacedSource = await prisma.subcontractClaim.findUniqueOrThrow({
      where: { id: claimOne.id },
    });
    assert.equal(
      replacedSource.state,
      'REPLACED',
      'successor submission must retain and supersede the original Claim after Certification reversal',
    );

    const roundingAgreement = await createAgreement('RND', {
      originalValue: '100.00',
      retentionRate: '2.50',
      retentionCap: null,
    });
    const roundingClaim = await createAssessedClaim(
      roundingAgreement.id,
      '2027-01-01',
      '2027-01-31',
      '0.20',
      'rounding',
    );
    const roundingCert = await certifications.createCertification(
      { auth: makerAuth },
      roundingClaim.id,
      { certifiedGross: '0.20' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      roundingCert.id,
      workflow.workflowCode,
      'rounding-submit-' + suffix,
    );
    const rounded = await certifications.approveCertification(
      { auth: checkerAuth },
      roundingCert.id,
      'rounding-approve-' + suffix,
    );
    assert.equal(
      rounded.retainedAmount?.toFixed(2),
      '0.01',
      '0.005 retention must round half-up to 0.01',
    );
    assert.equal(rounded.netCertifiedAmount?.toFixed(2), '0.19');

    const zeroAgreement = await createAgreement('ZERO', {
      originalValue: '100.00',
      retentionRate: '0.00',
      retentionCap: null,
    });
    const zeroClaim = await createAssessedClaim(
      zeroAgreement.id,
      '2027-02-01',
      '2027-02-28',
      '50.00',
      'zero',
    );
    const zeroCert = await certifications.createCertification(
      { auth: makerAuth },
      zeroClaim.id,
      { certifiedGross: '50.00' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      zeroCert.id,
      workflow.workflowCode,
      'zero-submit-' + suffix,
    );
    const zeroApproved = await certifications.approveCertification(
      { auth: checkerAuth },
      zeroCert.id,
      'zero-approve-' + suffix,
    );
    assert.equal(zeroApproved.retainedAmount?.toFixed(2), '0.00');
    assert.equal(zeroApproved.netCertifiedAmount?.toFixed(2), '50.00');

    const concurrentAgreement = await createAgreement('CONC', {
      originalValue: '2000.00',
      retentionRate: '10.00',
      retentionCap: '100.00',
    });
    const [concurrentClaimA, concurrentClaimB] = await Promise.all([
      createAssessedClaim(
        concurrentAgreement.id,
        '2027-03-01',
        '2027-03-31',
        '600.00',
        'conc-a',
      ),
      createAssessedClaim(
        concurrentAgreement.id,
        '2027-04-01',
        '2027-04-30',
        '600.00',
        'conc-b',
      ),
    ]);
    const concurrentCertA = await certifications.createCertification(
      { auth: makerAuth },
      concurrentClaimA.id,
      { certifiedGross: '600.00' },
    );
    const concurrentCertB = await certifications.createCertification(
      { auth: makerAuth },
      concurrentClaimB.id,
      { certifiedGross: '600.00' },
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      concurrentCertA.id,
      workflow.workflowCode,
      'conc-submit-a-' + suffix,
    );
    await certifications.submitCertification(
      { auth: makerAuth },
      concurrentCertB.id,
      workflow.workflowCode,
      'conc-submit-b-' + suffix,
    );

    const concurrentApprovals = await Promise.allSettled([
      certifications.approveCertification(
        { auth: checkerAuth },
        concurrentCertA.id,
        'conc-approve-a-' + suffix,
      ),
      certifications.approveCertification(
        { auth: checkerAuth },
        concurrentCertB.id,
        'conc-approve-b-' + suffix,
      ),
    ]);
    const fulfilledConcurrent = concurrentApprovals.filter(
      (result) => result.status === 'fulfilled',
    ).length;
    assert.ok(
      fulfilledConcurrent >= 1,
      'agreement-scoped serialization must allow at least one competing valid approval to commit',
    );
    if (concurrentApprovals[0]?.status === 'rejected') {
      await certifications.approveCertification(
        { auth: checkerAuth },
        concurrentCertA.id,
        'conc-approve-a-' + suffix,
      );
    }
    if (concurrentApprovals[1]?.status === 'rejected') {
      await certifications.approveCertification(
        { auth: checkerAuth },
        concurrentCertB.id,
        'conc-approve-b-' + suffix,
      );
    }
    const approvedConcurrent = await prisma.subcontractCertification.findMany({
      where: {
        agreementId: concurrentAgreement.id,
        state: 'APPROVED',
      },
      orderBy: { certificationNumber: 'asc' },
    });
    assert.equal(approvedConcurrent.length, 2);
    assert.equal(
      approvedConcurrent
        .reduce(
          (sum, row) => sum + Number(row.retainedAmount?.toFixed(2) ?? '0'),
          0,
        )
        .toFixed(2),
      '100.00',
      'concurrent approvals must not exceed the aggregate retention cap',
    );
    assert.deepEqual(
      approvedConcurrent
        .map((row) => row.retainedAmount?.toFixed(2))
        .sort(),
      ['40.00', '60.00'],
    );
  } finally {
    await prisma.$disconnect();
  }
});
