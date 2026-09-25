import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { safeHashEquals } from './crypto.util';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';

test('authentication creates, resolves, rotates and revokes a secure session', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: `AUTH-${suffix}`,
        companyName: 'Authentication Integration Test',
      },
    });

    const passwords = new PasswordService();
    const sessions = new SessionService(prisma);
    const auth = new AuthService(prisma, passwords, sessions);
    const plainPassword = 'Correct-Horse-Battery-Staple-2026!';
    const passwordHash = await passwords.hash(plainPassword);

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email: `auth-${suffix}@example.com`,
        passwordHash,
        displayName: 'Auth Test User',
      },
    });

    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: `TEST_ROLE_${suffix}`,
        roleName: 'Test Role',
      },
    });

    const permission = await prisma.permission.create({
      data: {
        permissionCode: `test.auth.${suffix}`,
        moduleCode: 'TEST',
        description: 'Authentication integration test permission',
      },
    });

    await prisma.userRole.create({
      data: { companyId: company.id, userId: user.id, roleId: role.id },
    });
    await prisma.rolePermission.create({
      data: { roleId: role.id, permissionId: permission.id },
    });

    const login = await auth.login(user.email.toUpperCase(), plainPassword);
    assert.equal(login.user.id, user.id);
    assert.ok(login.sessionToken.length >= 40);
    assert.ok(login.csrfToken.length >= 40);

    const context = await sessions.resolve(login.sessionToken);
    assert.ok(context);
    assert.deepEqual(context.roleCodes, [role.roleCode]);
    assert.deepEqual(context.permissions, [permission.permissionCode]);
    assert.equal(safeHashEquals(context.csrfTokenHash, login.csrfToken), true);

    const rotatedCsrf = await sessions.rotateCsrfToken(context.sessionId);
    const rotatedContext = await sessions.resolve(login.sessionToken);
    assert.ok(rotatedContext);
    assert.equal(
      safeHashEquals(rotatedContext.csrfTokenHash, rotatedCsrf),
      true,
    );
    assert.equal(
      safeHashEquals(rotatedContext.csrfTokenHash, login.csrfToken),
      false,
    );

    await sessions.revoke(context.sessionId);
    assert.equal(await sessions.resolve(login.sessionToken), null);

    await assert.rejects(
      () => auth.login(user.email, 'wrong-password'),
      (error: unknown) => error instanceof UnauthorizedException,
    );
  } finally {
    await prisma.$disconnect();
  }
});
