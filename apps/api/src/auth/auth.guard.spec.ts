import assert from 'node:assert/strict';
import test from 'node:test';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { AuthGuard } from './auth.guard';
import { AuthenticatedUserContext } from './auth.types';
import { SessionService } from './session.service';

function context(cookie?: string): {
  context: ExecutionContext;
  request: { headers: Record<string, string>; auth?: AuthenticatedUserContext };
} {
  const request: {
    headers: Record<string, string>;
    auth?: AuthenticatedUserContext;
  } = { headers: cookie ? { cookie } : {} };

  return {
    request,
    context: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => undefined,
      }),
    } as unknown as ExecutionContext,
  };
}

test('auth guard resolves a valid opaque session cookie', async () => {
  const auth: AuthenticatedUserContext = {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'user@example.com',
    displayName: 'User',
    roleCodes: [],
    permissions: [],
    csrfTokenHash: '0'.repeat(64),
  };
  const sessions = {
    resolve: async () => auth,
  } as unknown as SessionService;
  const guard = new AuthGuard(sessions);
  const target = context(
    'erp_session=abc_DEF-12345678901234567890',
  );

  assert.equal(await guard.canActivate(target.context), true);
  assert.equal(target.request.auth?.userId, auth.userId);
});

test('auth guard rejects a request without a session cookie', async () => {
  const sessions = {
    resolve: async () => null,
  } as unknown as SessionService;
  const guard = new AuthGuard(sessions);

  await assert.rejects(
    () => guard.canActivate(context().context),
    (error: unknown) => error instanceof UnauthorizedException,
  );
});
