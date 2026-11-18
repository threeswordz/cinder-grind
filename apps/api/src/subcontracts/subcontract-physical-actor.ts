import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

export type PhysicalDb = Prisma.TransactionClient | PrismaService;
export async function physicalActor(auth: AuthenticatedUserContext, db: PhysicalDb, required: string[]) {
  const session = await db.userSession.findFirst({
    where: { id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() },
      user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } },
    select: { user: { select: {
      employee: { select: { id: true, companyId: true, isActive: true } },
      userRoles: { select: { role: { select: { companyId: true, roleCode: true, isActive: true,
        rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } },
    } } },
  });
  const roles = session?.user.userRoles.map(row => row.role).filter(row => row.isActive && row.companyId === auth.companyId) ?? [];
  const permissions = [...new Set(roles.flatMap(row => row.rolePermissions.map(item => item.permission.permissionCode)))];
  const employee = session?.user.employee;
  if (!employee?.isActive || employee.companyId !== auth.companyId ||
      !required.every(code => auth.permissions.includes(code) && permissions.includes(code))) {
    throw new ForbiddenException({ code: 'PHYSICAL_ACTOR_DENIED' });
  }
  return { ...auth, employeeId: employee.id, permissions, roleCodes: roles.map(row => row.roleCode) };
}
