import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

import { PrismaService } from '../prisma/prisma.service';

test('SYS_ADMIN PR cancellation remediation removes only the legacy technical-role grant', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  const suffix = Date.now().toString(36);
  const migrationSql = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260927154500_v0_3_b_sys_admin_pr_cancel_remediation/migration.sql',
    ),
    'utf8',
  );

  try {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { permissionCode: 'procurement.pr.cancel' },
      select: { id: true },
    });

    const company = await prisma.company.create({
      data: {
        companyCode: 'GOV-' + suffix,
        companyName: 'Governance Remediation ' + suffix,
      },
    });

    const systemAdmin = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'SYS_ADMIN',
        roleName: 'System Administrator',
      },
    });
    const procurementManager = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PROCUREMENT_MANAGER',
        roleName: 'Procurement Manager',
      },
    });

    await prisma.rolePermission.createMany({
      data: [
        {
          roleId: systemAdmin.id,
          permissionId: permission.id,
        },
        {
          roleId: procurementManager.id,
          permissionId: permission.id,
        },
      ],
    });

    assert.equal(
      await prisma.rolePermission.count({
        where: {
          permissionId: permission.id,
          roleId: { in: [systemAdmin.id, procurementManager.id] },
        },
      }),
      2,
      'Legacy setup must contain both technical and explicit business-role grants before remediation.',
    );

    await prisma.$executeRawUnsafe(migrationSql);

    assert.equal(
      await prisma.rolePermission.count({
        where: {
          roleId: systemAdmin.id,
          permissionId: permission.id,
        },
      }),
      0,
      'Corrective migration must remove the implicit SYS_ADMIN cancellation grant.',
    );
    assert.equal(
      await prisma.rolePermission.count({
        where: {
          roleId: procurementManager.id,
          permissionId: permission.id,
        },
      }),
      1,
      'Corrective migration must preserve explicitly configured business-role cancellation.',
    );
  } finally {
    await prisma.rolePermission.deleteMany({
      where: {
        role: {
          company: {
            companyCode: 'GOV-' + suffix,
          },
        },
      },
    });
    await prisma.role.deleteMany({
      where: {
        company: {
          companyCode: 'GOV-' + suffix,
        },
      },
    });
    await prisma.company.deleteMany({
      where: {
        companyCode: 'GOV-' + suffix,
      },
    });
    await prisma.$disconnect();
  }
});
