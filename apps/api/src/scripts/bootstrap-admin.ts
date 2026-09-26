import { PrismaClient } from '@prisma/client';

import { PasswordService } from '../auth/password.service';

const REQUIRED_ADMIN_PERMISSIONS = [
  'projects.access_all',
  'projects.project.view',
  'projects.project.create',
  'projects.project.edit',
  'projects.project.archive',
  'projects.team.view',
  'projects.team.manage',
  'wbs.wbs.view',
  'wbs.wbs.create',
  'wbs.wbs.edit',
  'wbs.wbs.archive',
  'wbs.cost_code.view',
  'wbs.cost_code.create',
  'wbs.cost_code.edit',
  'wbs.cost_code.archive',
  'documents.document.view',
  'documents.document.upload',
  'documents.document.link',
  'documents.document.archive',
  'documents.type.manage',
  'admin.company.manage',
  'admin.users.manage',
  'admin.roles.manage',
  'admin.permissions.assign',
  'admin.approval_matrix.manage',
  'admin.number_sequences.manage',
  'admin.status.manage',
  'admin.system_settings.manage',
  'admin.audit_config.manage',
  'audit.log.view',
  'master.customer.view',
  'master.customer.manage',
  'master.supplier.view',
  'master.supplier.manage',
  'master.employee.view',
  'master.employee.manage',
  'master.material.view',
  'master.material.manage',
  'master.uom.view',
  'master.uom.manage',
] as const;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(name + ' is required for bootstrap.');
  }
  return value;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const passwords = new PasswordService();

  try {
    const companyCode = requiredEnv('BOOTSTRAP_COMPANY_CODE');
    const companyName = requiredEnv('BOOTSTRAP_COMPANY_NAME');
    const adminEmail = requiredEnv('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
    const adminDisplayName = requiredEnv('BOOTSTRAP_ADMIN_DISPLAY_NAME');
    const adminPassword = requiredEnv('BOOTSTRAP_ADMIN_PASSWORD');

    if (adminPassword.length < 12) {
      throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters.');
    }

    const company = await prisma.company.upsert({
      where: { companyCode },
      update: { companyName },
      create: { companyCode, companyName },
    });

    const existingUserCount = await prisma.user.count({
      where: { companyId: company.id },
    });
    if (existingUserCount > 0) {
      throw new Error(
        'Bootstrap refused: this company already has application users.',
      );
    }

    const permissions = await prisma.permission.findMany({
      where: {
        permissionCode: { in: [...REQUIRED_ADMIN_PERMISSIONS] },
      },
    });
    if (permissions.length !== REQUIRED_ADMIN_PERMISSIONS.length) {
      throw new Error(
        'Bootstrap refused: required system permissions are missing. Apply all migrations first.',
      );
    }

    const passwordHash = await passwords.hash(adminPassword);

    await prisma.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: {
          companyId_roleCode: {
            companyId: company.id,
            roleCode: 'SYS_ADMIN',
          },
        },
        update: {
          roleName: 'System Administrator',
          description:
            'Technical administration only. Business approvals require separate Roles.',
          isActive: true,
        },
        create: {
          companyId: company.id,
          roleCode: 'SYS_ADMIN',
          roleName: 'System Administrator',
          description:
            'Technical administration only. Business approvals require separate Roles.',
        },
      });

      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      });

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email: adminEmail,
          displayName: adminDisplayName,
          passwordHash,
        },
      });

      await tx.userRole.create({
        data: {
          companyId: company.id,
          userId: user.id,
          roleId: role.id,
        },
      });
    });

    process.stdout.write(
      'System Administrator bootstrap completed for company ' +
        companyCode +
        '.\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Bootstrap failed.';
  process.stderr.write(message + '\n');
  process.exitCode = 1;
});
