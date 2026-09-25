import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthenticatedUserContext } from '../auth/auth.types';
import {
  AuthorizationService,
} from './authorization.service';
import { ProjectScopeService } from './project-scope.service';

function authContext(
  permissions: string[],
  roleCodes: string[] = [],
): AuthenticatedUserContext {
  return {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'user@example.com',
    displayName: 'User',
    roleCodes,
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('role name alone never grants a business permission', () => {
  const authorization = new AuthorizationService();
  const adminByNameOnly = authContext([], ['SYS_ADMIN']);

  assert.equal(
    authorization.hasPermission(
      adminByNameOnly,
      'finance.payment.approve',
    ),
    false,
  );
});

test('project scope accepts explicit all-project permission or membership', () => {
  const authorization = new AuthorizationService();
  const scope = new ProjectScopeService(authorization);

  assert.equal(
    scope.canAccessProject(authContext(['projects.access_all']), false),
    true,
  );
  assert.equal(scope.canAccessProject(authContext([]), true), true);
  assert.equal(scope.canAccessProject(authContext([]), false), false);
});
