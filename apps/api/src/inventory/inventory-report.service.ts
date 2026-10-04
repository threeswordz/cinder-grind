import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  StockBalanceFilters,
  StockBalanceService,
} from './stock-balance.service';

export type InventoryMovementFilters = {
  projectId?: string;
  warehouseId?: string;
  materialId?: string;
  movementType?: string;
  sourceType?: string;
  postedFrom?: Date;
  postedTo?: Date;
};

type MovementRow = {
  id: string;
  movementType: string;
  quantity: Prisma.Decimal;
  effectKey: string;
  reversalOfId: string | null;
  postedAt: Date;
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  uomId: string;
  uomCode: string;
  postedByUserId: string;
  postedByDisplayName: string;
  sourceType: string;
  sourceId: string | null;
  sourceNumber: string | null;
};

@Injectable()
export class InventoryReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly balances: StockBalanceService,
  ) {}

  projects(auth: AuthenticatedUserContext) {
    return this.balances.projects(auth);
  }

  balanceReport(
    auth: AuthenticatedUserContext,
    filters: StockBalanceFilters,
  ) {
    return this.balances.balances(auth, filters);
  }

  balanceSummary(
    auth: AuthenticatedUserContext,
    filters: StockBalanceFilters,
  ) {
    return this.balances.balanceSummary(auth, filters);
  }

  portfolioBalanceSummaries(
    auth: AuthenticatedUserContext,
    projectIds: string[],
  ) {
    return this.balances.portfolioBalanceSummaries(auth, projectIds);
  }

  async movementReport(
    auth: AuthenticatedUserContext,
    filters: InventoryMovementFilters,
  ) {
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
      if (!projects.length) return [];
      conditions.push(
        Prisma.sql`st.project_id IN (${Prisma.join(
          projects.map((row) => Prisma.sql`${row.id}::uuid`),
        )})`,
      );
    }
    if (filters.projectId) {
      conditions.push(Prisma.sql`st.project_id = ${filters.projectId}::uuid`);
    }
    if (filters.warehouseId) {
      conditions.push(
        Prisma.sql`st.warehouse_id = ${filters.warehouseId}::uuid`,
      );
    }
    if (filters.materialId) {
      conditions.push(
        Prisma.sql`st.material_id = ${filters.materialId}::uuid`,
      );
    }
    if (filters.movementType) {
      conditions.push(
        Prisma.sql`st.movement_type = ${filters.movementType}`,
      );
    }
    if (filters.sourceType) {
      const sourceColumn: Record<string, Prisma.Sql> = {
        GOODS_RECEIPT: Prisma.sql`st.goods_receipt_item_id`,
        MATERIAL_ISSUE: Prisma.sql`st.material_issue_item_id`,
        MATERIAL_RETURN: Prisma.sql`st.material_return_item_id`,
        STOCK_TRANSFER: Prisma.sql`st.stock_transfer_item_id`,
      };
      const column = sourceColumn[filters.sourceType];
      if (!column) return [];
      conditions.push(Prisma.sql`${column} IS NOT NULL`);
    }
    if (filters.postedFrom) {
      conditions.push(Prisma.sql`st.posted_at >= ${filters.postedFrom}`);
    }
    if (filters.postedTo) {
      conditions.push(Prisma.sql`st.posted_at < ${filters.postedTo}`);
    }

    const rows = await this.prisma.$queryRaw<MovementRow[]>(Prisma.sql`
      SELECT
        st.id,
        st.movement_type AS "movementType",
        st.quantity::DECIMAL(18,4) AS quantity,
        st.effect_key AS "effectKey",
        st.reversal_of_id AS "reversalOfId",
        st.posted_at AS "postedAt",
        w.id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        m.id AS "materialId",
        m.material_code AS "materialCode",
        m.material_name AS "materialName",
        p.id AS "projectId",
        p.project_code AS "projectCode",
        p.project_name AS "projectName",
        u.id AS "uomId",
        u.uom_code AS "uomCode",
        actor.id AS "postedByUserId",
        actor.display_name AS "postedByDisplayName",
        CASE
          WHEN st.goods_receipt_item_id IS NOT NULL THEN 'GOODS_RECEIPT'
          WHEN st.material_issue_item_id IS NOT NULL THEN 'MATERIAL_ISSUE'
          WHEN st.material_return_item_id IS NOT NULL THEN 'MATERIAL_RETURN'
          WHEN st.stock_transfer_item_id IS NOT NULL THEN 'STOCK_TRANSFER'
          ELSE 'UNKNOWN'
        END AS "sourceType",
        COALESCE(
          st.goods_receipt_id,
          st.material_issue_id,
          st.material_return_id,
          st.stock_transfer_id
        ) AS "sourceId",
        COALESCE(
          gr.receipt_number,
          mi.issue_number,
          mr.return_number,
          transfer.transfer_number
        ) AS "sourceNumber"
      FROM stock_transactions st
      JOIN warehouses w
        ON w.id=st.warehouse_id AND w.company_id=st.company_id
      JOIN materials m
        ON m.id=st.material_id AND m.company_id=st.company_id
      JOIN units_of_measure u
        ON u.id=st.uom_id AND u.company_id=st.company_id
      JOIN users actor
        ON actor.id=st.posted_by_user_id AND actor.company_id=st.company_id
      LEFT JOIN projects p
        ON p.id=st.project_id AND p.company_id=st.company_id
      LEFT JOIN goods_receipts gr ON gr.id=st.goods_receipt_id
      LEFT JOIN material_issues mi ON mi.id=st.material_issue_id
      LEFT JOIN material_returns mr ON mr.id=st.material_return_id
      LEFT JOIN stock_transfers transfer ON transfer.id=st.stock_transfer_id
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY st.posted_at DESC, st.id DESC
      LIMIT 2000
    `);

    return rows.map((row) => ({
      ...row,
      quantity: new Prisma.Decimal(row.quantity).toFixed(4),
    }));
  }
}
