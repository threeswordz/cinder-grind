import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectProgressPlanService } from './project-progress-plan.service';

const CONFIRM = 'schedule.work_plan.confirm';
const PREPARE = 'schedule.work_plan.prepare';
type FakeRole = {
  roleCode: string;
  permissions: string[];
  active?: boolean;
  membershipCompanyId?: string;
  roleCompanyId?: string;
};
type Check = {
  roles: FakeRole[];
  code?: string;
  cachedPermissions?: string[];
  sessionActive?: boolean;
};
async function checkLive(input: Check) {
  const companyId = randomUUID(), userId = randomUUID(), sessionId = randomUUID();
  const auth: AuthenticatedUserContext = {
    companyId, userId, sessionId, email: 'fm02@example.com', displayName: 'FM02 test',
    roleCodes: input.roles.map(x => x.roleCode),
    permissions: input.cachedPermissions ?? [input.code ?? CONFIRM],
    csrfTokenHash: '0'.repeat(64),
  };
  const session = input.sessionActive === false ? null : {
    user: {
      userRoles: input.roles.map(r => ({
        companyId: r.membershipCompanyId ?? companyId,
        role: {
          companyId: r.roleCompanyId ?? companyId,
          roleCode: r.roleCode,
          isActive: r.active !== false,
          rolePermissions: r.permissions.map(permissionCode => ({permission: {permissionCode}})),
        },
      })),
    },
  };
  const tx = {
    userSession: {
      findFirst: async (args: {where: {id: string;userId: string}}) => {
        assert.equal(args.where.id, sessionId);
        assert.equal(args.where.userId, userId);
        return session;
      },
    },
  } as unknown as Prisma.TransactionClient;
  const service = new ProjectProgressPlanService(
    {} as PrismaService, {} as ProjectAccessService, {} as AuditService,
  );
  const guarded = service as unknown as {
    live: (tx: Prisma.TransactionClient, auth: AuthenticatedUserContext, code: string) => Promise<void>;
  };
  await guarded.live(tx, auth, input.code ?? CONFIRM);
}
async function denied(input: Check, code: string) {
  await assert.rejects(() => checkLive(input), (e: unknown) => {
    assert.ok(e instanceof ForbiddenException);
    assert.equal((e.getResponse() as {code: string}).code, code);
    return true;
  });
}

test('FM02 Ben confirmation requires current same-company MANAGEMENT and explicit permission', async () => {
  await checkLive({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM]}]});
});
test('FM02 other roles cannot confirm even if they hold a cached/live permission', async () => {
  await denied({roles: [{roleCode: 'PROJECT_MANAGER', permissions: [CONFIRM]}]},
    'FM02_MANAGEMENT_ROLE_REQUIRED');
});
test('FM02 unrelated role permission cannot substitute for MANAGEMENT permission', async () => {
  await denied({roles: [
    {roleCode: 'MANAGEMENT', permissions: [PREPARE]},
    {roleCode: 'PROJECT_MANAGER', permissions: [CONFIRM]},
  ]}, 'FM02_MANAGEMENT_ROLE_REQUIRED');
});
test('FM02 another company role cannot grant confirmation', async () => {
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM],
    roleCompanyId: randomUUID()}]}, 'FM02_PERMISSION_REVOKED');
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM],
    membershipCompanyId: randomUUID()}]}, 'FM02_PERMISSION_REVOKED');
});
test('FM02 inactive MANAGEMENT and revoked permissions are rejected', async () => {
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM], active: false}]},
    'FM02_PERMISSION_REVOKED');
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: []}]},
    'FM02_PERMISSION_REVOKED');
});
test('FM02 stale session claims and revoked session are rejected', async () => {
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM]}],
    cachedPermissions: [PREPARE]}, 'FM02_PERMISSION_REVOKED');
  await denied({roles: [{roleCode: 'MANAGEMENT', permissions: [CONFIRM]}],
    sessionActive: false}, 'FM02_SESSION_REVOKED');
});
test('FM02 plan preparation uses current scoped permission, without requiring MANAGEMENT', async () => {
  await checkLive({code: PREPARE, roles: [{roleCode: 'PROJECT_MANAGER', permissions: [PREPARE]}]});
});
