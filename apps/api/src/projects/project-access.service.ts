import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}

  async scopeWhere(
    auth: AuthenticatedUserContext,
  ): Promise<Prisma.ProjectWhereInput> {
    if (this.authorization.hasAllProjectsAccess(auth)) {
      return { companyId: auth.companyId };
    }

    const employeeId = await this.activeEmployeeId(auth);
    if (!employeeId) {
      return { companyId: auth.companyId, id: '__NO_PROJECT_ACCESS__' };
    }

    return {
      companyId: auth.companyId,
      members: {
        some: {
          employeeId,
          isActive: true,
        },
      },
    };
  }

  async assertAccess(
    auth: AuthenticatedUserContext,
    projectId: string,
  ): Promise<void> {
    const where = await this.scopeWhere(auth);
    const project = await this.prisma.project.findFirst({
      where: { ...where, id: projectId },
      select: { id: true },
    });

    if (!project) {
      const exists = await this.prisma.project.findFirst({
        where: { id: projectId, companyId: auth.companyId },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException({
          code: 'PROJECT_NOT_FOUND',
          detail: 'Project not found.',
        });
      }

      throw new ForbiddenException({
        code: 'PROJECT_SCOPE_DENIED',
        detail: 'You do not have access to this Project.',
      });
    }
  }

  async activeEmployeeId(
    auth: AuthenticatedUserContext,
  ): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: auth.userId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: {
        employee: {
          select: {
            id: true,
            isActive: true,
          },
        },
      },
    });

    if (!user?.employee?.isActive) return null;
    return user.employee.id;
  }
}
