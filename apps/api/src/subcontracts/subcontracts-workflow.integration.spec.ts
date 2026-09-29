import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
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
    displayName: 'V0.5-B Test User',
    roleCodes,
    permissions: accessAll ? ['projects.access_all'] : [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.5-B retains agreement decisions and enforces Work Order allocation ceiling', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCB-' + suffix,
        companyName: 'Subcontracts Stage B ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SCB-C-' + suffix,
        customerName: 'Stage B Customer',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SCB-P-' + suffix,
        projectName: 'Stage B Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    const subcontractor = await prisma.subcontractor.create({
      data: {
        companyId: company.id,
        subcontractorCode: 'SCB-S-' + suffix,
        subcontractorName: 'Stage B Subcontractor',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scb-maker-' + suffix + '@example.com',
        displayName: 'Stage B Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scb-checker-' + suffix + '@example.com',
        displayName: 'Stage B Checker',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'scb-outsider-' + suffix + '@example.com',
        displayName: 'Stage B Outsider',
        passwordHash: 'x',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'SCB_APPROVER_' + suffix,
        roleName: 'Stage B Approver',
      },
    });
    const statusA = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_AGREEMENT',
        statusCode: 'ACTIVE_' + suffix,
        statusLabel: 'Active',
      },
    });
    const statusB = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_AGREEMENT',
        statusCode: 'MOB_' + suffix,
        statusLabel: 'Mobilized',
      },
    });

    const agreementWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SC_AGR_' + suffix,
        entityType: 'SUBCONTRACT_AGREEMENT',
        workflowName: 'Agreement Approval',
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
    const workOrderWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SC_WO_' + suffix,
        entityType: 'SUBCONTRACT_WORK_ORDER',
        workflowName: 'Work Order Approval',
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

    const agreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-' + suffix.slice(0, 3).toUpperCase(),
        originalValue: '1000.00',
        scopeOfWork: 'Stage B structural package',
        currencyCode: 'SGD',
        operationalStatusId: statusA.id,
        createdByUserId: maker.id,
      },
    });

    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: agreement.id },
          data: { firstApprovedAt: new Date() },
        }),
      'a Draft agreement cannot acquire first-approval evidence below the API',
    );

    const authorization = new AuthorizationService();
    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(authorization),
    );
    const service = new SubcontractsWorkflowService(
      prisma,
      access,
      new ApprovalService(prisma),
      new AuditService(prisma),
    );
    const makerAuth = auth(company.id, maker.id);
    const checkerAuth = auth(company.id, checker.id, [role.roleCode]);
    const outsiderAuth = auth(
      company.id,
      outsider.id,
      [role.roleCode],
      false,
    );

    const submitted = await service.submitInitialAgreement(
      { auth: makerAuth },
      agreement.id,
      agreementWorkflow.workflowCode,
      'agreement-submit-' + suffix,
    );
    assert.equal(submitted.approvalState, 'SUBMITTED');

    const replayedSubmit = await service.submitInitialAgreement(
      { auth: makerAuth },
      agreement.id,
      agreementWorkflow.workflowCode,
      'agreement-submit-' + suffix,
    );
    assert.equal(replayedSubmit.id, agreement.id);

    await assert.rejects(
      () =>
        service.submitInitialAgreement(
          { auth: makerAuth },
          agreement.id,
          'CHANGED_' + suffix,
          'agreement-submit-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'a retry key must not be reusable with a changed workflow payload',
    );

    const submittedVersion =
      await prisma.subcontractAgreementVersion.findFirstOrThrow({
        where: { agreementId: agreement.id, versionNo: 1 },
      });
    await assert.rejects(
      () =>
        prisma.subcontractAgreementVersion.update({
          where: { id: submittedVersion.id },
          data: { approvalState: 'APPROVED' },
        }),
      'an approved Agreement Version must carry retained decision evidence below the API',
    );

    await assert.rejects(
      () =>
        service.approveInitialAgreement(
          { auth: makerAuth },
          agreement.id,
          'maker-approve-' + suffix,
        ),
      (error: unknown) => error instanceof ForbiddenException,
      'the agreement maker cannot approve the same submission',
    );

    const approved = await service.approveInitialAgreement(
      { auth: checkerAuth },
      agreement.id,
      'checker-approve-' + suffix,
      'Approved for Stage B test.',
    );
    assert.equal(approved.approvalState, 'APPROVED');
    assert.ok(approved.firstApprovedAt);

    const versionOne =
      await prisma.subcontractAgreementVersion.findFirstOrThrow({
        where: { agreementId: agreement.id, versionNo: 1 },
      });
    assert.equal(versionOne.approvalState, 'APPROVED');

    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: agreement.id },
          data: { originalValue: '1001.00' },
        }),
      'first-approved commercial value must remain immutable below the API',
    );

    const revision = await service.createRevision(
      { auth: makerAuth },
      agreement.id,
      {
        operationalStatusId: statusB.id,
        reason: 'Mobilization status update',
      },
    );
    assert.equal(revision.versionNo, 2);
    assert.equal(revision.originalValue.toFixed(2), '1000.00');

    await service.submitRevision(
      { auth: makerAuth },
      revision.id,
      agreementWorkflow.workflowCode,
      'revision-submit-' + suffix,
    );
    const approvedRevision = await service.approveRevision(
      { auth: checkerAuth },
      revision.id,
      'revision-approve-' + suffix,
    );
    assert.equal(approvedRevision.approvalState, 'APPROVED');

    const afterRevision =
      await prisma.subcontractAgreement.findUniqueOrThrow({
        where: { id: agreement.id },
      });
    assert.equal(afterRevision.operationalStatusId, statusB.id);
    assert.equal(afterRevision.originalValue.toFixed(2), '1000.00');
    assert.equal(afterRevision.scopeOfWork, 'Stage B structural package');

    const wo1 = await service.createWorkOrder(
      { auth: makerAuth },
      agreement.id,
      {
        scopeOfWork: 'Work Order allocation one',
        amount: '600.00',
      },
    );
    const wo2 = await service.createWorkOrder(
      { auth: makerAuth },
      agreement.id,
      {
        scopeOfWork: 'Work Order allocation two',
        amount: '600.00',
      },
    );
    assert.equal(wo1.workOrderNumber, 'WO-001');
    assert.equal(wo2.workOrderNumber, 'WO-002');

    await service.submitWorkOrder(
      { auth: makerAuth },
      wo1.id,
      workOrderWorkflow.workflowCode,
      'wo1-submit-' + suffix,
    );
    await service.submitWorkOrder(
      { auth: makerAuth },
      wo2.id,
      workOrderWorkflow.workflowCode,
      'wo2-submit-' + suffix,
    );

    await assert.rejects(
      () =>
        prisma.subcontractWorkOrder.update({
          where: { id: wo1.id },
          data: { approvalState: 'APPROVED' },
        }),
      'an approved Work Order must carry retained decision evidence below the API',
    );

    const competingApprovals = await Promise.allSettled([
      service.approveWorkOrder(
        { auth: checkerAuth },
        wo1.id,
        'wo1-approve-' + suffix,
      ),
      service.approveWorkOrder(
        { auth: checkerAuth },
        wo2.id,
        'wo2-approve-' + suffix,
      ),
    ]);
    assert.equal(
      competingApprovals.filter((result) => result.status === 'fulfilled')
        .length,
      1,
      'agreement locking and the allocation ceiling must allow only one competing 600/600 approval against a 1000 ceiling',
    );

    const approvedWorkOrders = await prisma.subcontractWorkOrder.findMany({
      where: {
        agreementId: agreement.id,
        approvalState: 'APPROVED',
      },
    });
    assert.equal(approvedWorkOrders.length, 1);
    assert.equal(approvedWorkOrders[0]?.amount.toFixed(2), '600.00');

    const pendingWorkOrder = await prisma.subcontractWorkOrder.findFirstOrThrow({
      where: {
        agreementId: agreement.id,
        approvalState: 'SUBMITTED',
      },
    });
    const pendingActionCount = await prisma.approvalAction.count({
      where: { approvalInstanceId: pendingWorkOrder.approvalInstanceId! },
    });
    assert.equal(
      pendingActionCount,
      0,
      'a failed over-ceiling final approval must roll back its Approval Action',
    );

    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: agreement.id },
          data: { approvalState: 'CANCELLED' },
        }),
      'a cancelled agreement must carry actor/time/reason evidence below the API',
    );

    await assert.rejects(
      () =>
        service.cancelAgreement(
          { auth: makerAuth },
          agreement.id,
          'Cannot cancel with active allocations',
          'cancel-blocked-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'submitted or approved Work Orders must block agreement cancellation',
    );

    await assert.rejects(
      () => service.getWorkOrder(outsiderAuth, wo1.id),
      (error: unknown) => error instanceof ForbiddenException,
      'Project authorization must protect Stage B Work Order detail',
    );

    const replay = await prisma.subcontractActionReplay.findFirstOrThrow({
      where: {
        companyId: company.id,
        actionType: 'AGREEMENT_SUBMIT',
        entityId: agreement.id,
      },
    });
    await assert.rejects(
      () =>
        prisma.subcontractActionReplay.update({
          where: { id: replay.id },
          data: { payloadHash: '0'.repeat(64) },
        }),
      'action retry evidence must be immutable below the API',
    );
    await assert.rejects(
      () =>
        prisma.subcontractActionReplay.delete({
          where: { id: replay.id },
        }),
      'action retry evidence must be retained',
    );

    const cancelAgreement = await prisma.subcontractAgreement.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        subcontractorId: subcontractor.id,
        agreementNumber: 'SC2609-C' + suffix.slice(0, 2).toUpperCase(),
        originalValue: '500.00',
        scopeOfWork: 'Cancellation test package',
        currencyCode: 'SGD',
        operationalStatusId: statusA.id,
        createdByUserId: maker.id,
      },
    });
    await service.submitInitialAgreement(
      { auth: makerAuth },
      cancelAgreement.id,
      agreementWorkflow.workflowCode,
      'cancel-agreement-submit-' + suffix,
    );
    await service.approveInitialAgreement(
      { auth: checkerAuth },
      cancelAgreement.id,
      'cancel-agreement-approve-' + suffix,
    );
    const cancelled = await service.cancelAgreement(
      { auth: makerAuth },
      cancelAgreement.id,
      'Package withdrawn',
      'cancel-agreement-' + suffix,
    );
    assert.equal(cancelled.approvalState, 'CANCELLED');

    const cancellationReplay = await service.cancelAgreement(
      { auth: makerAuth },
      cancelAgreement.id,
      'Package withdrawn',
      'cancel-agreement-' + suffix,
    );
    assert.equal(cancellationReplay.approvalState, 'CANCELLED');

    await assert.rejects(
      () =>
        service.cancelAgreement(
          { auth: makerAuth },
          cancelAgreement.id,
          'Changed cancellation reason',
          'cancel-agreement-' + suffix,
        ),
      (error: unknown) => error instanceof ConflictException,
      'a cancellation retry key cannot be reused with changed material payload',
    );

    const audits = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: {
          in: [
            'SUBCONTRACT_AGREEMENT',
            'SUBCONTRACT_AGREEMENT_VERSION',
            'SUBCONTRACT_WORK_ORDER',
          ],
        },
      },
      select: { action: true },
    });
    assert.ok(audits.some((row) => row.action === 'SUBMIT'));
    assert.ok(audits.some((row) => row.action === 'APPROVAL_APPROVE'));
    assert.ok(audits.some((row) => row.action === 'CANCEL'));
  } finally {
    await prisma.$disconnect();
  }
});
