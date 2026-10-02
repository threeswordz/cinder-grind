import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

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

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PM-' + suffix,
        employeeName: 'Project Manager ' + suffix,
        jobTitle: 'Project Manager',
      },
    });
    await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'INACTIVE-' + suffix,
        employeeName: 'Inactive Employee ' + suffix,
        isActive: false,
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'OTHER-' + suffix,
        companyName: 'Other Company ' + suffix,
      },
    });
    await prisma.employee.create({
      data: {
        companyId: otherCompany.id,
        employeeCode: 'OTHER-' + suffix,
        employeeName: 'Other Company Employee ' + suffix,
      },
    });

    const employeeOptions = await service.listEmployeeOptions(company.id);
    assert.deepEqual(
      employeeOptions.map((item) => item.id),
      [employee.id],
    );

    const role = await service.createRole(
      { auth },
      {
        roleCode: 'TEST_ROLE_' + suffix,
        roleName: 'Test Role',
      },
    );

    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'finance.client_invoice.approve',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Client Invoice action permissions require Client Invoice view permission',
    );
    await service.replaceRolePermissions({ auth }, role.id, [
      'finance.client_invoice.view',
      'finance.client_invoice.approve',
    ]);
    const clientInvoicePermissionCount = await prisma.rolePermission.count({
      where: {
        roleId: role.id,
        permission: { permissionCode: { startsWith: 'finance.client_invoice.' } },
      },
    });
    assert.equal(clientInvoicePermissionCount, 2);

    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'subcontracts.agreement.create',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'subcontracts.agreement.approve',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Stage B agreement actions require agreement view permission',
    );
    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'subcontracts.work_order.approve',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Stage B Work Order actions require Work Order view permission',
    );
    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'subcontracts.certification.approve',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Stage D Certification actions require Certification view permission',
    );
    await assert.rejects(
      () =>
        service.replaceRolePermissions({ auth }, role.id, [
          'subcontracts.certification.view',
          'subcontracts.certification.approve',
        ]),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Stage D Certification permissions require Claim view because the Certification workspace is mounted inside Claims',
    );
    await service.replaceRolePermissions({ auth }, role.id, [
      'subcontracts.subcontractor.view',
      'subcontracts.subcontractor.manage',
      'subcontracts.agreement.view',
      'subcontracts.agreement.create',
    ]);
    const subcontractPermissionCount = await prisma.rolePermission.count({
      where: {
        roleId: role.id,
        permission: { permissionCode: { startsWith: 'subcontracts.' } },
      },
    });
    assert.equal(subcontractPermissionCount, 4);

    const created = await service.createUser(
      { auth },
      {
        email: 'user-' + suffix + '@example.com',
        displayName: 'Test User',
        password: 'Strong-User-Password-2026!',
        employeeId: employee.id,
        roleIds: [role.id],
      },
    );

    assert.equal(created.employeeId, employee.id);
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
