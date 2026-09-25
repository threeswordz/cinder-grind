import assert from 'node:assert/strict';
import test from 'node:test';
import { ForbiddenException } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { ApprovalService } from './approval.service';

function auth(userId: string): AuthenticatedUserContext {
  return {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId,
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'user@example.com',
    displayName: 'User',
    roleCodes: ['APPROVER'],
    permissions: [],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('maker-checker foundation blocks self approval', () => {
  const service = new ApprovalService({} as never);
  const userId = '00000000-0000-0000-0000-000000000010';

  assert.throws(
    () => service.assertMakerChecker(userId, auth(userId).userId),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test('maker-checker foundation allows different maker and approver', () => {
  const service = new ApprovalService({} as never);

  assert.doesNotThrow(() =>
    service.assertMakerChecker(
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000011',
    ),
  );
});
