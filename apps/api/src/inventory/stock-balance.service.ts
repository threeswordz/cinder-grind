import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

export type StockBalanceFilters = {
  projectId?: string;
  warehouseId?: string;
  materialId?: string;
  search?: string;
  includeInactiveWarehouses?: boolean;
  includeZero?: boolean;
};

type BalanceRow = {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  warehouseProjectId: string | null;
  warehouseProjectCode: string | null;
  warehouseProjectName: string | null;
  isSiteWarehouse: boolean;
  warehouseIsActive: boolean;
  materialId: string;
  materialCode: string;
  materialName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  uomId: string;
  uomCode: string;
  quantity: Prisma.Decimal;
};

type BalanceSummaryRow = {
  balanceRowCount: number;
  warehouseCount: number;
  materialCount: number;
  uomCount: number;
};

@Injectable()
export class StockBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  private async balanceConditions(
    auth: AuthenticatedUserContext,
    filters: StockBalanceFilters,
  ): Promise<Prisma.Sql[] | null> {
    if (filters.projectId) {
      await this.access.assertAccess(auth, filters.projectId);
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`st.company_id = ${auth.companyId}::uuid`,
    ];

    if (!this.access.canAccessAll(auth)) {
      const scope = await this.access.scopeWhere(auth);
      const projects = await this.prisma.project.findMany({
        where: scope,
        select: { id: true },
      });
      if (projects.length === 0) return null;
      conditions.push(
        Prisma.sql`st.project_id IN (${Prisma.join(projects.map((row) => Prisma.sql`${row.id}::uuid`))})`,
      );
    }

    if (filters.projectId) {
      conditions.push(Prisma.sql`st.project_id = ${filters.projectId}::uuid`);
    }
    if (filters.warehouseId) {
      conditions.push(Prisma.sql`st.warehouse_id = ${filters.warehouseId}::uuid`);
    }
    if (filters.materialId) {
      conditions.push(Prisma.sql`st.material_id = ${filters.materialId}::uuid`);
    }
    if (!filters.includeInactiveWarehouses) {
      conditions.push(Prisma.sql`w.is_active = TRUE`);
    }
    if (filters.search) {
      const pattern = `%${filters.search.replace(/[\\%_]/g, '\\  async balances(auth: AuthenticatedUserContext, filters: StockBalanceFilters) {
    if (filters.projectId) {
      await this.access.assertAccess(auth, filters.projectId);
    }

    const conditions: Prisma.Sql[] = [
      Prisma.sql`st.company_id = ${auth.companyId}::uuid`,
    ];

    if (!this.access.canAccessAll(auth)) {
      const scope = await this.access.scopeWhere(auth);
      const projects = await this.prisma.project.findMany({
        where: scope,
        select: { id: true },
      });
      if (projects.length === 0) return [];
      conditions.push(
        Prisma.sql`st.project_id IN (${Prisma.join(projects.map((row) => Prisma.sql`${row.id}::uuid`))})`,
      );
    }

    if (filters.projectId) {
      conditions.push(Prisma.sql`st.project_id = ${filters.projectId}::uuid`);
    }
    if (filters.warehouseId) {
      conditions.push(Prisma.sql`st.warehouse_id = ${filters.warehouseId}::uuid`);
    }
    if (filters.materialId) {
      conditions.push(Prisma.sql`st.material_id = ${filters.materialId}::uuid`);
    }
    if (!filters.includeInactiveWarehouses) {
      conditions.push(Prisma.sql`w.is_active = TRUE`);
    }
    if (filters.search) {
      const pattern = `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(Prisma.sql`(
        w.warehouse_code ILIKE ${pattern} ESCAPE '\\'
        OR w.warehouse_name ILIKE ${pattern} ESCAPE '\\'
        OR m.material_code ILIKE ${pattern} ESCAPE '\\'
        OR m.material_name ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(p.project_code, '') ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(p.project_name, '') ILIKE ${pattern} ESCAPE '\\'
      )`);
    }

    const having = filters.includeZero
      ? Prisma.empty
      : Prisma.sql`HAVING SUM(st.quantity) <> 0`;
')}%`;
      conditions.push(Prisma.sql`(
        w.warehouse_code ILIKE ${pattern} ESCAPE '\\'
        OR w.warehouse_name ILIKE ${pattern} ESCAPE '\\'
        OR m.material_code ILIKE ${pattern} ESCAPE '\\'
        OR m.material_name ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(p.project_code, '') ILIKE ${pattern} ESCAPE '\\'
        OR COALESCE(p.project_name, '') ILIKE ${pattern} ESCAPE '\\'
      )`);
    }

    return conditions;
  }

  async balanceSummary(
    auth: AuthenticatedUserContext,
    filters: StockBalanceFilters,
  ) {
    const conditions = await this.balanceConditions(auth, filters);
    if (conditions === null) {
      return {
        balanceRowCount: 0,
        warehouseCount: 0,
        materialCount: 0,
        uomCount: 0,
      };
    }

    const having = filters.includeZero
      ? Prisma.empty
      : Prisma.sql`HAVING SUM(st.quantity) <> 0`;

    const rows = await this.prisma.$queryRaw<BalanceSummaryRow[]>(Prisma.sql`
      WITH balance_rows AS (
        SELECT
          st.project_id AS project_id,
          w.id AS warehouse_id,
          m.id AS material_id,
          u.id AS uom_id
        FROM stock_transactions st
        JOIN warehouses w ON w.id = st.warehouse_id AND w.company_id = st.company_id
        JOIN materials m ON m.id = st.material_id AND m.company_id = st.company_id
        JOIN units_of_measure u ON u.id = st.uom_id AND u.company_id = st.company_id
        LEFT JOIN projects p ON p.id = st.project_id AND p.company_id = st.company_id
        WHERE ${Prisma.join(conditions, ' AND ')}
        GROUP BY st.project_id, w.id, m.id, u.id
        ${having}
      )
      SELECT
        COUNT(*)::INTEGER AS "balanceRowCount",
        COUNT(DISTINCT warehouse_id)::INTEGER AS "warehouseCount",
        COUNT(DISTINCT material_id)::INTEGER AS "materialCount",
        COUNT(DISTINCT uom_id)::INTEGER AS "uomCount"
      FROM balance_rows
    `);

    return (
      rows[0] ?? {
        balanceRowCount: 0,
        warehouseCount: 0,
        materialCount: 0,
        uomCount: 0,
      }
    );
  }

  async balances(auth: AuthenticatedUserContext, filters: StockBalanceFilters) {
    const conditions = await this.balanceConditions(auth, filters);
    if (conditions === null) return [];

    const having = filters.includeZero
      ? Prisma.empty
      : Prisma.sql`HAVING SUM(st.quantity) <> 0`;

    const rows = await this.prisma.$queryRaw<BalanceRow[]>(Prisma.sql`
      SELECT
        w.id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        wp.id AS "warehouseProjectId",
        wp.project_code AS "warehouseProjectCode",
        wp.project_name AS "warehouseProjectName",
        w.is_site_warehouse AS "isSiteWarehouse",
        w.is_active AS "warehouseIsActive",
        m.id AS "materialId",
        m.material_code AS "materialCode",
        m.material_name AS "materialName",
        p.id AS "projectId",
        p.project_code AS "projectCode",
        p.project_name AS "projectName",
        u.id AS "uomId",
        u.uom_code AS "uomCode",
        SUM(st.quantity)::DECIMAL(18,4) AS "quantity"
      FROM stock_transactions st
      JOIN warehouses w ON w.id = st.warehouse_id AND w.company_id = st.company_id
      JOIN materials m ON m.id = st.material_id AND m.company_id = st.company_id
      JOIN units_of_measure u ON u.id = st.uom_id AND u.company_id = st.company_id
      LEFT JOIN projects p ON p.id = st.project_id AND p.company_id = st.company_id
      LEFT JOIN projects wp ON wp.id = w.project_id AND wp.company_id = w.company_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      GROUP BY
        w.id, w.warehouse_code, w.warehouse_name,
        wp.id, wp.project_code, wp.project_name,
        w.is_site_warehouse, w.is_active,
        m.id, m.material_code, m.material_name,
        p.id, p.project_code, p.project_name,
        u.id, u.uom_code
      ${having}
      ORDER BY
        COALESCE(p.project_name, ''), w.warehouse_code, m.material_code, u.uom_code
      LIMIT 1000
    `);

    return rows.map((row) => ({
      ...row,
      quantity: new Prisma.Decimal(row.quantity).toFixed(4),
    }));
  }
}
