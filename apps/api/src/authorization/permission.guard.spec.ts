import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';

function contextFor(
  auth: AuthenticatedUserContext,
): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({ headers: {}, auth }),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function authWith(permissions: string[]): AuthenticatedUserContext {
  return {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'user@example.com',
    displayName: 'User',
    roleCodes: [],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('permission guard allows all explicitly required permissions', () => {
  const reflector = {
    getAllAndOverride: () => ['admin.users.manage'],
  } as unknown as Reflector;
  const guard = new PermissionGuard(reflector, new AuthorizationService());

  assert.equal(
    guard.canActivate(contextFor(authWith(['admin.users.manage']))),
    true,
  );
});

test('permission guard rejects missing permission', () => {
  const reflector = {
    getAllAndOverride: () => ['finance.payment.approve'],
  } as unknown as Reflector;
  const guard = new PermissionGuard(reflector, new AuthorizationService());

  assert.throws(
    () => guard.canActivate(contextFor(authWith([]))),
    (error: unknown) => error instanceof ForbiddenException,
  );
});
