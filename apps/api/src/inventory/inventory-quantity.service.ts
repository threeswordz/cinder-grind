import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { PrismaService } from '../prisma/prisma.service';

type Db = Prisma.TransactionClient | PrismaService;

export type StockDimension = {
  companyId: string;
  warehouseId: string;
  materialId: string;
  projectId: string;
  uomId: string;
};

@Injectable()
export class InventoryQuantityService {
  constructor(private readonly prisma: PrismaService) {}

  key(dimension: StockDimension): string {
    return [
      dimension.companyId,
      dimension.warehouseId,
      dimension.materialId,
      dimension.projectId,
      dimension.uomId,
    ].join(':');
  }

  async lock(tx: Prisma.TransactionClient, dimension: StockDimension) {
    await tx.$executeRawUnsafe(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      'inventory-stock:' + this.key(dimension),
    );
  }

  async onHand(db: Db, dimension: StockDimension): Promise<Prisma.Decimal> {
    const rows = await db.$queryRaw<Array<{ quantity: Prisma.Decimal }>>(Prisma.sql`
      SELECT COALESCE(SUM(quantity), 0)::DECIMAL(38,4) AS quantity
      FROM stock_transactions
      WHERE company_id = ${dimension.companyId}::uuid
        AND warehouse_id = ${dimension.warehouseId}::uuid
        AND material_id = ${dimension.materialId}::uuid
        AND project_id = ${dimension.projectId}::uuid
        AND uom_id = ${dimension.uomId}::uuid
    `);
    return new Prisma.Decimal(rows[0]?.quantity ?? 0);
  }

  async activeReserved(
    db: Db,
    dimension: StockDimension,
    excludeReservationId?: string,
  ): Promise<Prisma.Decimal> {
    const rows = await db.$queryRaw<Array<{ quantity: Prisma.Decimal }>>(Prisma.sql`
      SELECT COALESCE(SUM(quantity), 0)::DECIMAL(38,4) AS quantity
      FROM material_reservations
      WHERE company_id = ${dimension.companyId}::uuid
        AND warehouse_id = ${dimension.warehouseId}::uuid
        AND material_id = ${dimension.materialId}::uuid
        AND project_id = ${dimension.projectId}::uuid
        AND uom_id = ${dimension.uomId}::uuid
        AND status = 'ACTIVE'
        ${excludeReservationId
          ? Prisma.sql`AND id <> ${excludeReservationId}::uuid`
          : Prisma.empty}
    `);
    return new Prisma.Decimal(rows[0]?.quantity ?? 0);
  }

  // Snapshot identity is additional to net quantity. Ledger rows are
  // append-only, so a transaction count detects +N/-N ABA movements.
  // Reservation identity/status/version and its append-only audit event count
  // detect releases/replacements or same-quantity reservation churn.
  // Evaluate under the existing exact-dimension stock lock, in the caller's
  // serializable transaction; never use client timestamps as sole proof.
  async snapshotVersion(db: Db, dimension: StockDimension) {
    const where = {
      companyId: dimension.companyId,
      projectId: dimension.projectId,
      warehouseId: dimension.warehouseId,
      materialId: dimension.materialId,
      uomId: dimension.uomId,
    };
    const [ledgerEventCount, reservations] = await Promise.all([
      db.stockTransaction.count({ where }),
      db.materialReservation.findMany({
        where,
        select: {
          id: true, status: true, quantity: true, updatedAt: true,
        },
        orderBy: { id: 'asc' },
      }),
    ]);
    const audits = reservations.length ? await db.auditLog.groupBy({
      by: ['entityId'],
      where: {
        companyId: dimension.companyId,
        entityType: 'MATERIAL_RESERVATION',
        entityId: { in: reservations.map(row => row.id) },
      },
      _count: { id: true },
    }) : [];
    const auditById = new Map(audits.map(row => [row.entityId, row._count.id]));
    const canonical = reservations.map(row => [
      row.id, row.status, row.quantity.toString(), row.updatedAt.toISOString(),
      auditById.get(row.id) ?? 0,
    ]);
    const reservationFingerprint = createHash('sha256')
      .update(JSON.stringify(canonical)).digest('hex');
    return { ledgerEventCount, reservationFingerprint };
  }

  async available(
    db: Db,
    dimension: StockDimension,
    excludeReservationId?: string,
  ) {
    const [onHand, reserved] = await Promise.all([
      this.onHand(db, dimension),
      this.activeReserved(db, dimension, excludeReservationId),
    ]);
    return { onHand, reserved, available: onHand.minus(reserved) };
  }
}
