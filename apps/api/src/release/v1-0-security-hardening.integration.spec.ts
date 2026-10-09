import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { protectedSourceContract } from '../management/management.service';

function auth(
  permissions: string[] = [],
  roleCodes: string[] = [],
): AuthenticatedUserContext {
  return {
    sessionId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    companyId: '00000000-0000-0000-0000-000000000003',
    email: 'security-regression@example.com',
    displayName: 'Security Regression',
    roleCodes,
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('AC-V10-026 preserves explicit permissions and technical SYS_ADMIN separation', () => {
  const authorization = new AuthorizationService();
  const sysAdminOnly = auth([], ['SYS_ADMIN']);
  const allProjectsOnly = auth(['projects.access_all'], ['SYS_ADMIN']);

  for (const permission of [
    'management.dashboard.view',
    'finance.payment.approve',
    'cost.control.view',
    'inventory.report.view',
  ]) {
    assert.equal(authorization.hasPermission(sysAdminOnly, permission), false);
    assert.equal(authorization.hasPermission(allProjectsOnly, permission), false);
  }

  assert.equal(
    authorization.hasPermission(
      auth(['management.dashboard.view']),
      'management.dashboard.view',
    ),
    true,
  );
});

test('AC-V10-026 preserves effective Project scope independently of business permissions', () => {
  const scope = new ProjectScopeService(new AuthorizationService());

  assert.equal(scope.canAccessProject(auth(['management.dashboard.view']), false), false);
  assert.equal(scope.canAccessProject(auth(['management.dashboard.view']), true), true);
  assert.equal(scope.canAccessProject(auth(['projects.access_all']), false), true);
});

test('AC-V10-026 preserves protected source-detail boundaries across modules', () => {
  const aggregateOnly = auth(
    ['projects.access_all', 'management.dashboard.view'],
    ['SYS_ADMIN'],
  );

  for (const [source, permission] of [
    ['V0.6 Finance', 'finance.payment.view'],
    ['V0.7 Cost Control', 'cost.control.view'],
    ['V0.4 Inventory', 'inventory.report.view'],
  ] as const) {
    const protectedContract = protectedSourceContract(
      aggregateOnly,
      source,
      [permission],
    );
    assert.equal(protectedContract.sourceViewAvailable, false);
    assert.equal(
      protectedContract.protectedDetailPolicy,
      'OWNING_MODULE_PERMISSION_REQUIRED',
    );

    const permitted = protectedSourceContract(
      auth([...aggregateOnly.permissions, permission], aggregateOnly.roleCodes),
      source,
      [permission],
    );
    assert.equal(permitted.sourceViewAvailable, true);
  }
});
