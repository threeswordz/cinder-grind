import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ApprovalAdminService } from './approval-admin.service';

function authContext(companyId: string, userId: string): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'admin@example.com',
    displayName: 'Admin',
    roleCodes: ['SYS_ADMIN'],
    permissions: ['admin.approval_matrix.manage'],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('approval matrix administration protects historical workflow meaning', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'AWF-' + suffix,
        companyName: 'Approval Admin Integration Test',
      },
    });
    const admin = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'admin-awf-' + suffix + '@example.com',
        displayName: 'Admin',
        passwordHash: 'not-used-in-this-test',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'APPROVER_' + suffix,
        roleName: 'Approver',
      },
    });
    const service = new ApprovalAdminService(
      prisma,
      new AuditService(prisma),
    );
    const auth = authContext(company.id, admin.id);

    const workflow = await service.createWorkflow(
      { auth },
      {
        workflowCode: 'TEST_' + suffix,
        entityType: 'TEST_RECORD',
        workflowName: 'Test Workflow',
        steps: [
          {
            stepNo: 1,
            stepName: 'Approval',
            requiredApprovals: 1,
            roleIds: [role.id],
          },
        ],
      },
    );

    assert.equal(workflow.steps.length, 1);
    assert.equal(workflow.steps[0]?.stepRoles.length, 1);

    await service.replaceSteps(
      { auth },
      workflow.id,
      [
        {
          stepNo: 1,
          stepName: 'Updated Approval',
          requiredApprovals: 1,
          roleIds: [role.id],
        },
      ],
    );

    await prisma.approvalInstance.create({
      data: {
        companyId: company.id,
        approvalWorkflowId: workflow.id,
        entityType: workflow.entityType,
        entityId: randomUUID(),
        currentStepNo: 1,
        approvalState: 'SUBMITTED',
      },
    });

    await assert.rejects(
      () =>
        service.replaceSteps(
          { auth },
          workflow.id,
          [
            {
              stepNo: 1,
              stepName: 'Unsafe Rewrite',
              requiredApprovals: 1,
              roleIds: [role.id],
            },
          ],
        ),
      (error: unknown) => error instanceof ConflictException,
    );
  } finally {
    await prisma.$disconnect();
  }
});
