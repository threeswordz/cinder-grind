import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { AuthenticatedUserContext } from './auth.types';
import { sha256Hex } from './crypto.util';
import { CsrfGuard } from './csrf.guard';

function contextFor(token: string | undefined): ExecutionContext {
  const raw = 'csrf-test-token';
  const auth: AuthenticatedUserContext = {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'user@example.com',
    displayName: 'User',
    roleCodes: [],
    permissions: [],
    csrfTokenHash: sha256Hex(raw),
  };

  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: token ? { 'x-csrf-token': token } : {},
        auth,
      }),
      getResponse: () => ({}),
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

test('CSRF guard accepts the current token', () => {
  assert.equal(new CsrfGuard().canActivate(contextFor('csrf-test-token')), true);
});

test('CSRF guard rejects a missing or incorrect token', () => {
  const guard = new CsrfGuard();

  assert.throws(
    () => guard.canActivate(contextFor(undefined)),
    (error: unknown) => error instanceof ForbiddenException,
  );
  assert.throws(
    () => guard.canActivate(contextFor('wrong-token')),
    (error: unknown) => error instanceof ForbiddenException,
  );
});
