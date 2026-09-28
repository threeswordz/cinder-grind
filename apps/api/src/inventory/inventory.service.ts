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
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type InventoryDb = Prisma.TransactionClient | PrismaService;

export type WarehouseInput = {
  warehouseCode: string;
  warehouseName: string;
  projectId?: string | null;
  location?: string | null;
  isSiteWarehouse: boolean;
};

export type WarehouseFilters = {
  includeInactive?: boolean;
  projectId?: string;
  search?: string;
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async listWarehouses(
    auth: AuthenticatedUserContext,
    filters: WarehouseFilters = {},
  ) {
    if (filters.projectId) {
      await this.access.assertAccess(auth, filters.projectId);
    }
    const visible = await this.visibleWhere(auth, this.prisma);
    const search = filters.search?.trim();
    return this.prisma.warehouse.findMany({
      where: {
        AND: [
          visible,
          ...(filters.includeInactive ? [] : [{ isActive: true }]),
          ...(filters.projectId
            ? [{ projectId: filters.projectId }]
            : []),
          ...(search
            ? [
                {
                  OR: [
                    {
                      warehouseCode: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      warehouseName: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                    {
                      location: {
                        contains: search,
                        mode: Prisma.QueryMode.insensitive,
                      },
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
      },
      orderBy: [{ warehouseCode: 'asc' }],
    });
  }

  async getWarehouse(auth: AuthenticatedUserContext, id: string) {
    return this.visibleWarehouse(auth, id, this.prisma);
  }

  async createWarehouse(context: AuditContext, input: WarehouseInput) {
    this.assertSiteProject(input.projectId ?? null, input.isSiteWarehouse);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (input.projectId) {
          await this.assertActiveProject(context.auth, input.projectId, tx);
        }
        const row = await tx.warehouse.create({
          data: {
            companyId: context.auth.companyId,
            warehouseCode: input.warehouseCode,
            warehouseName: input.warehouseName,
            projectId: input.projectId ?? null,
            location: input.location ?? null,
            isSiteWarehouse: input.isSiteWarehouse,
          },
          include: {
            project: {
              select: { id: true, projectCode: true, projectName: true },
            },
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'WAREHOUSE',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error);
      throw error;
    }
  }

  async updateWarehouse(
    context: AuditContext,
    id: string,
    input: Partial<WarehouseInput>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.visibleWarehouse(context.auth, id, tx);
        const projectId =
          input.projectId !== undefined ? input.projectId : before.projectId;
        const isSiteWarehouse =
          input.isSiteWarehouse ?? before.isSiteWarehouse;

        this.assertSiteProject(projectId, isSiteWarehouse);

        if (
          input.projectId !== undefined &&
          input.projectId !== before.projectId &&
          !this.access.canAccessAll(context.auth)
        ) {
          throw new ForbiddenException({
            code: 'WAREHOUSE_PROJECT_REASSIGNMENT_DENIED',
            detail:
              'Changing Warehouse Project ownership requires projects.access_all.',
          });
        }

        if (projectId) {
          await this.assertActiveProject(context.auth, projectId, tx);
        }

        const row = await tx.warehouse.update({
          where: { id },
          data: {
            ...(input.warehouseCode !== undefined
              ? { warehouseCode: input.warehouseCode }
              : {}),
            ...(input.warehouseName !== undefined
              ? { warehouseName: input.warehouseName }
              : {}),
            ...(input.projectId !== undefined
              ? { projectId: input.projectId }
              : {}),
            ...(input.location !== undefined
              ? { location: input.location }
              : {}),
            ...(input.isSiteWarehouse !== undefined
              ? { isSiteWarehouse: input.isSiteWarehouse }
              : {}),
          },
          include: {
            project: {
              select: { id: true, projectCode: true, projectName: true },
            },
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'WAREHOUSE',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error);
      throw error;
    }
  }

  async archiveWarehouse(context: AuditContext, id: string) {
    return this.setWarehouseActive(context, id, false);
  }

  async reactivateWarehouse(context: AuditContext, id: string) {
    return this.setWarehouseActive(context, id, true);
  }

  private async setWarehouseActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (!isActive) {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'inventory-warehouse:' + id,
        );
      }
      const before = await this.visibleWarehouse(context.auth, id, tx);
      if (before.isActive === isActive) {
        throw new ConflictException({
          code: isActive
            ? 'WAREHOUSE_ALREADY_ACTIVE'
            : 'WAREHOUSE_ALREADY_ARCHIVED',
          detail: isActive
            ? 'Warehouse is already active.'
            : 'Warehouse is already archived.',
        });
      }
      if (isActive && before.projectId) {
        await this.assertActiveProject(context.auth, before.projectId, tx);
      }
      const row = await tx.warehouse.update({
        where: { id },
        data: { isActive },
        include: {
          project: {
            select: { id: true, projectCode: true, projectName: true },
          },
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'WAREHOUSE',
          entityId: id,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  private async visibleWhere(
    auth: AuthenticatedUserContext,
    db: InventoryDb,
  ): Promise<Prisma.WarehouseWhereInput> {
    const projectScope = await this.access.scopeWhere(auth, db);
    return {
      companyId: auth.companyId,
      OR: [
        { projectId: null },
        { project: { is: projectScope } },
      ],
    };
  }

  private async visibleWarehouse(
    auth: AuthenticatedUserContext,
    id: string,
    db: InventoryDb,
  ) {
    const visible = await this.visibleWhere(auth, db);
    const row = await db.warehouse.findFirst({
      where: { AND: [visible, { id }] },
      include: {
        project: {
          select: { id: true, projectCode: true, projectName: true },
        },
      },
    });
    if (row) return row;

    const existing = await db.warehouse.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, projectId: true },
    });
    if (!existing) throw this.notFound();
    if (existing.projectId) {
      await this.access.assertAccess(auth, existing.projectId, db);
    }
    throw new ForbiddenException({
      code: 'WAREHOUSE_SCOPE_DENIED',
      detail: 'Warehouse is outside your effective Project scope.',
    });
  }

  private async assertActiveProject(
    auth: AuthenticatedUserContext,
    projectId: string,
    db: InventoryDb,
  ) {
    await this.access.assertAccess(auth, projectId, db);
    const project = await db.project.findFirst({
      where: {
        id: projectId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!project) {
      throw new UnprocessableEntityException({
        code: 'WAREHOUSE_PROJECT_INVALID',
        detail: 'Warehouse Project must be active and belong to the same Company.',
      });
    }
  }

  private assertSiteProject(
    projectId: string | null,
    isSiteWarehouse: boolean,
  ) {
    if (isSiteWarehouse && !projectId) {
      throw new UnprocessableEntityException({
        code: 'SITE_WAREHOUSE_PROJECT_REQUIRED',
        detail: 'A Site Warehouse must belong to a Project.',
      });
    }
  }

  private throwUnique(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'WAREHOUSE_DUPLICATE',
        detail: 'Warehouse code already exists in this Company.',
      });
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'WAREHOUSE_NOT_FOUND',
      detail: 'Warehouse not found.',
    });
  }
}
