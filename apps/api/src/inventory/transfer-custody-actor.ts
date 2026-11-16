import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type TransferDb = Prisma.TransactionClient | PrismaService;
export async function transferActor(auth: AuthenticatedUserContext, db: TransferDb, permissions: string[]) {
  const session = await db.userSession.findFirst({
    where: {
      id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
      user: { companyId: auth.companyId, isActive: true, company: { isActive: true } },
    },
    select: { user: { select: {
      employee: { select: { id: true, isActive: true, companyId: true } },
      userRoles: { select: { role: { select: {
        companyId: true, isActive: true, roleCode: true,
        rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
      } } } },
    } } },
  });
  const roles = session?.user.userRoles.map((r) => r.role).filter((r) => r.isActive && r.companyId === auth.companyId) ?? [];
  const current = [...new Set(roles.flatMap((r) => r.rolePermissions.map((p) => p.permission.permissionCode)))];
  const employee = session?.user.employee;
  if (!employee?.isActive || employee.companyId !== auth.companyId ||
      !permissions.every((p) => auth.permissions.includes(p) && current.includes(p))) {
    throw new ForbiddenException({ code: 'TRANSFER_ACTOR_DENIED' });
  }
  return { ...auth, employeeId: employee.id, permissions: current, roleCodes: roles.map((r) => r.roleCode) };
}
