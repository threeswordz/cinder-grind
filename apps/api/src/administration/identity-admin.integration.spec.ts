import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ForbiddenException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';
import { IdentityAdminService } from './identity-admin.service';

function authContext(companyId: string, userId: string): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'admin@example.com',
    displayName: 'Admin',
    roleCodes: ['SYS_ADMIN'],
    permissions: [
      'admin.users.manage',
      'admin.roles.manage',
      'admin.permissions.assign',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('user and role administration respects company boundaries and revokes sessions', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'ADM-' + suffix,
        companyName: 'Administration Integration Test',
      },
    });
    const passwords = new PasswordService();
    const bootstrapHash = await passwords.hash('Bootstrap-Password-2026!');
    const admin = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'admin-' + suffix + '@example.com',
        displayName: 'Admin',
        passwordHash: bootstrapHash,
      },
    });
    const service = new IdentityAdminService(
      prisma,
      passwords,
      new AuditService(prisma),
    );
    const auth = authContext(company.id, admin.id);

    const role = await service.createRole(
      { auth },
      {
        roleCode: 'TEST_ROLE_' + suffix,
        roleName: 'Test Role',
      },
    );

    const created = await service.createUser(
      { auth },
      {
        email: 'user-' + suffix + '@example.com',
        displayName: 'Test User',
        password: 'Strong-User-Password-2026!',
        roleIds: [role.id],
      },
    );

    assert.equal(created.userRoles.length, 1);
    assert.equal(created.userRoles[0]?.role.roleCode, role.roleCode);

    const session = await prisma.userSession.create({
      data: {
        userId: created.id,
        tokenHash: 'a'.repeat(64),
        csrfTokenHash: 'b'.repeat(64),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await service.replaceUserRoles({ auth }, created.id, []);
    const revoked = await prisma.userSession.findUniqueOrThrow({
      where: { id: session.id },
    });
    assert.ok(revoked.revokedAt);

    await assert.rejects(
      () => service.replaceUserRoles({ auth }, admin.id, []),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const audits = await prisma.auditLog.count({
      where: { companyId: company.id },
    });
    assert.ok(audits >= 3);
  } finally {
    await prisma.$disconnect();
  }
});
