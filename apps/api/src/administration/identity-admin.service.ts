import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function validatePassword(value: string): void {
  if (value.length < 12 || value.length > 1024) {
    throw new UnprocessableEntityException({
      code: 'VALIDATION_ERROR',
      detail: 'One or more fields are invalid.',
      errors: [
        {
          field: 'password',
          message: 'Password must be between 12 and 1024 characters.',
        },
      ],
    });
  }
}

@Injectable()
export class IdentityAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly audit: AuditService,
  ) {}

  listUsers(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        employeeId: true,
        email: true,
        displayName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                roleCode: true,
                roleName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  getUser(companyId: string, id: string) {
    return this.prisma.user.findFirstOrThrow({
      where: { id, companyId },
      select: {
        id: true,
        employeeId: true,
        email: true,
        displayName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                roleCode: true,
                roleName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  async createUser(
    context: AuditContext,
    input: {
      email: string;
      displayName: string;
      password: string;
      employeeId?: string;
      roleIds?: string[];
    },
  ) {
    validatePassword(input.password);
    const email = normalizeEmail(input.email);
    const passwordHash = await this.passwords.hash(input.password);

    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeCompany(
        tx,
        context.auth.companyId,
        input.employeeId,
      );
      await this.assertRolesCompany(
        tx,
        context.auth.companyId,
        input.roleIds ?? [],
      );

      try {
        const user = await tx.user.create({
          data: {
            companyId: context.auth.companyId,
            email,
            displayName: input.displayName,
            passwordHash,
            ...(input.employeeId ? { employeeId: input.employeeId } : {}),
          },
        });

        if ((input.roleIds ?? []).length > 0) {
          await tx.userRole.createMany({
            data: (input.roleIds ?? []).map((roleId) => ({
              companyId: context.auth.companyId,
              userId: user.id,
              roleId,
            })),
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'USER',
            entityId: user.id,
            action: 'CREATE',
            newValues: {
              id: user.id,
              email: user.email,
              displayName: user.displayName,
              employeeId: user.employeeId,
              isActive: user.isActive,
              roleIds: input.roleIds ?? [],
            },
          },
          tx,
        );

        return this.getUserWithClient(tx, context.auth.companyId, user.id);
      } catch (error) {
        this.throwUniqueConflict(error, 'User email or Employee link is already in use.');
        throw error;
      }
    });
  }

  async updateUser(
    context: AuditContext,
    id: string,
    input: {
      email?: string;
      displayName?: string;
      employeeId?: string | null;
      isActive?: boolean;
    },
  ) {
    if (id === context.auth.userId && input.isActive === false) {
      throw new ForbiddenException({
        code: 'SELF_DEACTIVATION_DENIED',
        detail: 'You cannot deactivate your own account.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const before = await this.findUserWithClient(
        tx,
        context.auth.companyId,
        id,
      );
      if (!before) throw this.notFound('User');

      if (input.employeeId !== undefined && input.employeeId !== null) {
        await this.assertEmployeeCompany(
          tx,
          context.auth.companyId,
          input.employeeId,
        );
      }

      try {
        const after = await tx.user.update({
          where: { id },
          data: {
            ...(input.email !== undefined
              ? { email: normalizeEmail(input.email) }
              : {}),
            ...(input.displayName !== undefined
              ? { displayName: input.displayName }
              : {}),
            ...(input.employeeId !== undefined
              ? { employeeId: input.employeeId }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          },
        });

        if (input.isActive === false) {
          await tx.userSession.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }

        await this.audit.record(
          {
            ...context,
            entityType: 'USER',
            entityId: id,
            action: 'UPDATE',
            oldValues: {
              email: before.email,
              displayName: before.displayName,
              employeeId: before.employeeId,
              isActive: before.isActive,
            },
            newValues: {
              email: after.email,
              displayName: after.displayName,
              employeeId: after.employeeId,
              isActive: after.isActive,
            },
          },
          tx,
        );

        return this.getUserWithClient(tx, context.auth.companyId, id);
      } catch (error) {
        this.throwUniqueConflict(error, 'User email or Employee link is already in use.');
        throw error;
      }
    });
  }

  async resetPassword(
    context: AuditContext,
    id: string,
    newPassword: string,
  ): Promise<void> {
    validatePassword(newPassword);
    const passwordHash = await this.passwords.hash(newPassword);

    await this.prisma.$transaction(async (tx) => {
      const existing = await this.findUserWithClient(
        tx,
        context.auth.companyId,
        id,
      );
      if (!existing) throw this.notFound('User');

      await tx.user.update({
        where: { id },
        data: { passwordHash },
      });
      await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'USER',
          entityId: id,
          action: 'RESET_PASSWORD',
          newValues: { sessionsRevoked: true },
        },
        tx,
      );
    });
  }

  async replaceUserRoles(
    context: AuditContext,
    id: string,
    roleIds: string[],
  ) {
    if (id === context.auth.userId) {
      throw new ForbiddenException({
        code: 'SELF_ROLE_CHANGE_DENIED',
        detail:
          'You cannot change your own role assignments through User Management.',
      });
    }

    const uniqueRoleIds = [...new Set(roleIds)];

    return this.prisma.$transaction(async (tx) => {
      const user = await this.findUserWithClient(
        tx,
        context.auth.companyId,
        id,
      );
      if (!user) throw this.notFound('User');

      await this.assertRolesCompany(
        tx,
        context.auth.companyId,
        uniqueRoleIds,
      );

      const before = await tx.userRole.findMany({
        where: { companyId: context.auth.companyId, userId: id },
        select: { roleId: true },
      });

      await tx.userRole.deleteMany({
        where: { companyId: context.auth.companyId, userId: id },
      });
      if (uniqueRoleIds.length > 0) {
        await tx.userRole.createMany({
          data: uniqueRoleIds.map((roleId) => ({
            companyId: context.auth.companyId,
            userId: id,
            roleId,
          })),
        });
      }

      await tx.userSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'USER',
          entityId: id,
          action: 'REPLACE_ROLES',
          oldValues: { roleIds: before.map((row) => row.roleId).sort() },
          newValues: { roleIds: [...uniqueRoleIds].sort(), sessionsRevoked: true },
        },
        tx,
      );

      return this.getUserWithClient(tx, context.auth.companyId, id);
    });
  }

  listEmployeeOptions(companyId: string) {
    return this.prisma.employee.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ employeeName: 'asc' }, { employeeCode: 'asc' }],
      select: {
        id: true,
        employeeCode: true,
        employeeName: true,
        jobTitle: true,
      },
    });
  }

  listRoleOptions(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId, isActive: true },
      orderBy: { roleName: 'asc' },
      select: {
        id: true,
        roleCode: true,
        roleName: true,
        isActive: true,
      },
    });
  }

  listRoles(companyId: string) {
    return this.prisma.role.findMany({
      where: { companyId },
      orderBy: { roleName: 'asc' },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  async createRole(
    context: AuditContext,
    input: {
      roleCode: string;
      roleName: string;
      description?: string;
    },
  ) {
    try {
      const role = await this.prisma.role.create({
        data: {
          companyId: context.auth.companyId,
          roleCode: input.roleCode,
          roleName: input.roleName,
          ...(input.description ? { description: input.description } : {}),
        },
      });

      await this.audit.record({
        ...context,
        entityType: 'ROLE',
        entityId: role.id,
        action: 'CREATE',
        newValues: role,
      });

      return role;
    } catch (error) {
      this.throwUniqueConflict(error, 'Role code is already in use.');
      throw error;
    }
  }

  async updateRole(
    context: AuditContext,
    id: string,
    input: {
      roleName?: string;
      description?: string | null;
      isActive?: boolean;
    },
  ) {
    const before = await this.prisma.role.findFirst({
      where: { id, companyId: context.auth.companyId },
    });
    if (!before) throw this.notFound('Role');

    if (input.isActive === false) {
      const selfAssignment = await this.prisma.userRole.findFirst({
        where: { userId: context.auth.userId, roleId: id },
        select: { id: true },
      });
      if (selfAssignment) {
        throw new ForbiddenException({
          code: 'SELF_ROLE_DEACTIVATION_DENIED',
          detail: 'You cannot deactivate a Role currently assigned to your own account.',
        });
      }
    }

    const after = await this.prisma.role.update({
      where: { id },
      data: input,
    });

    if (input.isActive === false) {
      const users = await this.prisma.userRole.findMany({
        where: { roleId: id },
        select: { userId: true },
      });
      await this.prisma.userSession.updateMany({
        where: {
          userId: { in: users.map((row) => row.userId) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.record({
      ...context,
      entityType: 'ROLE',
      entityId: id,
      action: 'UPDATE',
      oldValues: before,
      newValues: after,
    });

    return after;
  }

  listPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ moduleCode: 'asc' }, { permissionCode: 'asc' }],
    });
  }

  async replaceRolePermissions(
    context: AuditContext,
    roleId: string,
    permissionCodes: string[],
  ) {
    const uniqueCodes = [...new Set(permissionCodes)];
    const subcontractPermissionGroups = [
      {
        view: 'subcontracts.subcontractor.view',
        actions: [
          'subcontracts.subcontractor.manage',
          'subcontracts.subcontractor.archive',
        ],
      },
      {
        view: 'subcontracts.agreement.view',
        actions: [
          'subcontracts.agreement.create',
          'subcontracts.agreement.edit',
          'subcontracts.agreement.submit',
          'subcontracts.agreement.approve',
          'subcontracts.agreement.reject',
          'subcontracts.agreement.revise',
          'subcontracts.agreement.cancel',
        ],
      },
      {
        view: 'subcontracts.work_order.view',
        actions: [
          'subcontracts.work_order.create',
          'subcontracts.work_order.edit',
          'subcontracts.work_order.submit',
          'subcontracts.work_order.approve',
          'subcontracts.work_order.reject',
        ],
      },
    ];
    for (const group of subcontractPermissionGroups) {
      if (
        group.actions.some((code) => uniqueCodes.includes(code)) &&
        !uniqueCodes.includes(group.view)
      ) {
        throw new UnprocessableEntityException({
          code: 'SUBCONTRACTS_VIEW_PERMISSION_REQUIRED',
          detail:
            'Subcontracts action permissions require the matching view permission so authorized users can discover and read the records they act on.',
        });
      }
    }

    const poActionCodes = uniqueCodes.filter(
      (code) =>
        code.startsWith('procurement.po.') &&
        code !== 'procurement.po.view',
    );
    if (
      poActionCodes.length > 0 &&
      !uniqueCodes.includes('procurement.po.view')
    ) {
      throw new UnprocessableEntityException({
        code: 'PO_VIEW_PERMISSION_REQUIRED',
        detail:
          'Purchase Order action permissions require procurement.po.view so the authorized workflow actor can discover and read scoped Purchase Orders.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id: roleId, companyId: context.auth.companyId },
      });
      if (!role) throw this.notFound('Role');

      const selfAssignment = await tx.userRole.findFirst({
        where: { userId: context.auth.userId, roleId },
        select: { id: true },
      });
      if (selfAssignment) {
        throw new ForbiddenException({
          code: 'SELF_ROLE_PERMISSION_CHANGE_DENIED',
          detail:
            'You cannot change Permissions on a Role currently assigned to your own account.',
        });
      }

      const permissions = await tx.permission.findMany({
        where: { permissionCode: { in: uniqueCodes } },
      });

      if (permissions.length !== uniqueCodes.length) {
        throw new UnprocessableEntityException({
          code: 'UNKNOWN_PERMISSION',
          detail: 'One or more permission codes are not system-defined.',
        });
      }

      const before = await tx.rolePermission.findMany({
        where: { roleId },
        include: { permission: true },
      });

      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
        });
      }

      const users = await tx.userRole.findMany({
        where: { roleId },
        select: { userId: true },
      });
      await tx.userSession.updateMany({
        where: {
          userId: { in: users.map((row) => row.userId) },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'ROLE',
          entityId: roleId,
          action: 'REPLACE_PERMISSIONS',
          oldValues: {
            permissionCodes: before
              .map((row) => row.permission.permissionCode)
              .sort(),
          },
          newValues: {
            permissionCodes: [...uniqueCodes].sort(),
            sessionsRevoked: true,
          },
        },
        tx,
      );

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  private async assertEmployeeCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    employeeId?: string,
  ): Promise<void> {
    if (!employeeId) return;

    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true },
    });
    if (!employee) {
      throw new UnprocessableEntityException({
        code: 'INVALID_EMPLOYEE',
        detail: 'Employee must belong to the same company.',
      });
    }
  }

  private async assertRolesCompany(
    tx: Prisma.TransactionClient,
    companyId: string,
    roleIds: string[],
  ): Promise<void> {
    if (roleIds.length === 0) return;

    const count = await tx.role.count({
      where: {
        id: { in: [...new Set(roleIds)] },
        companyId,
        isActive: true,
      },
    });

    if (count !== new Set(roleIds).size) {
      throw new UnprocessableEntityException({
        code: 'INVALID_ROLE',
        detail: 'All assigned Roles must be active and belong to the same company.',
      });
    }
  }

  private findUserWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    return tx.user.findFirst({
      where: { id, companyId },
    });
  }

  private getUserWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
    id: string,
  ) {
    return tx.user.findFirstOrThrow({
      where: { id, companyId },
      select: {
        id: true,
        employeeId: true,
        email: true,
        displayName: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                roleCode: true,
                roleName: true,
                isActive: true,
              },
            },
          },
        },
      },
    });
  }

  private throwUniqueConflict(error: unknown, detail: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_IDENTITY_CONFIGURATION',
        detail,
      });
    }
  }

  private notFound(entity: string): NotFoundException {
    return new NotFoundException({
      code: 'ADMIN_RECORD_NOT_FOUND',
      detail: entity + ' not found.',
    });
  }
}
