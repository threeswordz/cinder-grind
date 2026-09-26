import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';

type ProjectScopeDb = Pick<Prisma.TransactionClient, 'project' | 'user'>;

@Injectable()
export class ProjectAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectScope: ProjectScopeService,
  ) {}

  async scopeWhere(
    auth: AuthenticatedUserContext,
    db: ProjectScopeDb = this.prisma,
  ): Promise<Prisma.ProjectWhereInput> {
    if (this.projectScope.canAccessProject(auth, false)) {
      return { companyId: auth.companyId };
    }

    const employeeId = await this.activeEmployeeId(auth, db);
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
    db: ProjectScopeDb = this.prisma,
  ): Promise<void> {
    const where = await this.scopeWhere(auth, db);
    const project = await db.project.findFirst({
      where: { ...where, id: projectId },
      select: { id: true },
    });

    if (!project) {
      const exists = await db.project.findFirst({
        where: { id: projectId, companyId: auth.companyId },
        select: { id: true },
      });

      if (!exists) {
        throw new NotFoundException({
          code: 'PROJECT_NOT_FOUND',
          detail: 'Project not found.',
        });
      }

      this.projectScope.assertProjectAccess(auth, false);
    }
  }

  async activeEmployeeId(
    auth: AuthenticatedUserContext,
    db: ProjectScopeDb = this.prisma,
  ): Promise<string | null> {
    const user = await db.user.findFirst({
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
