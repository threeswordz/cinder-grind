import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  APPROVAL_STATE,
  ApprovalService,
} from './approval.service';

function authContext(
  companyId: string,
  userId: string,
  roleCodes: string[],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: `${userId}@example.com`,
    displayName: 'Approval Test User',
    roleCodes,
    permissions: [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('approval engine enforces maker-checker and current-step role', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: `APR-${suffix}`,
        companyName: 'Approval Integration Test',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `maker-${suffix}@example.com`,
        passwordHash: 'not-used-in-this-test',
        displayName: 'Maker',
      },
    });
    const approver = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `approver-${suffix}@example.com`,
        passwordHash: 'not-used-in-this-test',
        displayName: 'Approver',
      },
    });
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: `APPROVER_${suffix}`,
        roleName: 'Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: `TEST_${suffix}`,
        entityType: 'TEST_RECORD',
        workflowName: 'Approval Integration Test',
        steps: {
          create: {
            stepNo: 1,
            stepName: 'Approval',
            requiredApprovals: 1,
            stepRoles: {
              create: { roleId: role.id },
            },
          },
        },
      },
    });

    const service = new ApprovalService(prisma);
    const instance = await service.start({
      companyId: company.id,
      workflowCode: workflow.workflowCode,
      entityType: workflow.entityType,
      entityId: randomUUID(),
    });

    await assert.rejects(
      () =>
        service.approve(
          instance.id,
          authContext(company.id, maker.id, [role.roleCode]),
          maker.id,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        service.approve(
          instance.id,
          authContext(company.id, approver.id, ['WRONG_ROLE']),
          maker.id,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const result = await service.approve(
      instance.id,
      authContext(company.id, approver.id, [role.roleCode]),
      maker.id,
      'Approved in integration test.',
    );

    assert.equal(result.approvalState, APPROVAL_STATE.APPROVED);
    const actions = await prisma.approvalAction.count({
      where: { approvalInstanceId: instance.id },
    });
    assert.equal(actions, 1);
  } finally {
    await prisma.$disconnect();
  }
});
