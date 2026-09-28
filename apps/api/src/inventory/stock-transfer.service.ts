import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  InventoryQuantityService,
  StockDimension,
} from './inventory-quantity.service';

type AuditContext = { auth: AuthenticatedUserContext; correlationId?: string };
type Db = Prisma.TransactionClient | PrismaService;

export type TransferLineInput = {
  materialId: string;
  quantity: Prisma.Decimal;
  uomId: string;
  sourceProjectId: string;
  destinationProjectId: string;
  remarks?: string | null;
};

@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly approvals: ApprovalService,
    private readonly numbers: NumberSequenceService,
    private readonly quantities: InventoryQuantityService,
  ) {}

  workflowOptions(auth: AuthenticatedUserContext) {
    return this.prisma.approvalWorkflow.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'STOCK_TRANSFER',
        isActive: true,
      },
      select: { id: true, workflowCode: true, workflowName: true },
      orderBy: { workflowCode: 'asc' },
    });
  }

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async warehouses(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    return this.prisma.warehouse.findMany({
      where: {
        companyId: auth.companyId,
        isActive: true,
        OR: [{ projectId: null }, { projectId }],
      },
      select: {
        id: true,
        warehouseCode: true,
        warehouseName: true,
        projectId: true,
        isSiteWarehouse: true,
      },
      orderBy: { warehouseCode: 'asc' },
    });
  }

  async stockChoices(
    auth: AuthenticatedUserContext,
    projectId: string,
    warehouseId?: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const warehouse = warehouseId
      ? Prisma.sql`AND st.warehouse_id = ${warehouseId}::uuid`
      : Prisma.empty;
    return this.prisma.$queryRaw<Array<{
      warehouseId: string;
      warehouseCode: string;
      materialId: string;
      materialCode: string;
      materialName: string;
      uomId: string;
      uomCode: string;
      onHand: Prisma.Decimal;
      reserved: Prisma.Decimal;
      available: Prisma.Decimal;
    }>>(Prisma.sql`
      SELECT
        w.id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        m.id AS "materialId",
        m.material_code AS "materialCode",
        m.material_name AS "materialName",
        u.id AS "uomId",
        u.uom_code AS "uomCode",
        SUM(st.quantity)::DECIMAL(38,4) AS "onHand",
        COALESCE((
          SELECT SUM(r.quantity)
          FROM material_reservations r
          WHERE r.company_id=st.company_id
            AND r.warehouse_id=st.warehouse_id
            AND r.material_id=st.material_id
            AND r.project_id=st.project_id
            AND r.uom_id=st.uom_id
            AND r.status='ACTIVE'
        ),0)::DECIMAL(38,4) AS "reserved",
        (
          SUM(st.quantity) - COALESCE((
            SELECT SUM(r.quantity)
            FROM material_reservations r
            WHERE r.company_id=st.company_id
              AND r.warehouse_id=st.warehouse_id
              AND r.material_id=st.material_id
              AND r.project_id=st.project_id
              AND r.uom_id=st.uom_id
              AND r.status='ACTIVE'
          ),0)
        )::DECIMAL(38,4) AS "available"
      FROM stock_transactions st
      JOIN warehouses w ON w.id=st.warehouse_id AND w.company_id=st.company_id
      JOIN materials m ON m.id=st.material_id AND m.company_id=st.company_id
      JOIN units_of_measure u ON u.id=st.uom_id AND u.company_id=st.company_id
      WHERE st.company_id=${auth.companyId}::uuid
        AND st.project_id=${projectId}::uuid
        AND w.is_active=TRUE
        ${warehouse}
      GROUP BY st.company_id,st.warehouse_id,st.material_id,st.project_id,st.uom_id,
        w.id,w.warehouse_code,m.id,m.material_code,m.material_name,u.id,u.uom_code
      HAVING SUM(st.quantity) > 0
      ORDER BY w.warehouse_code,m.material_code,u.uom_code
      LIMIT 1000
    `);
  }

  async list(auth: AuthenticatedUserContext, projectId?: string) {
    if (projectId) await this.access.assertAccess(auth, projectId);
    const scope = await this.access.scopeWhere(auth);
    const projects = await this.prisma.project.findMany({
      where: scope,
      select: { id: true },
    });
    const projectIds = projects.map((row) => row.id);
    if (!projectIds.length) return [];
    return this.prisma.stockTransfer.findMany({
      where: {
        companyId: auth.companyId,
        items: {
          every: {
            AND: [
              { sourceProjectId: { in: projectIds } },
              { destinationProjectId: { in: projectIds } },
            ],
          },
          ...(projectId
            ? {
                some: {
                  OR: [
                    { sourceProjectId: projectId },
                    { destinationProjectId: projectId },
                  ],
                },
              }
            : {}),
        },
      },
      include: {
        sourceWarehouse: {
          select: { warehouseCode: true, warehouseName: true },
        },
        destinationWarehouse: {
          select: { warehouseCode: true, warehouseName: true },
        },
        approvalInstance: { select: { approvalState: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(auth: AuthenticatedUserContext, id: string, db: Db = this.prisma) {
    const row = await db.stockTransfer.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        sourceWarehouse: {
          select: { warehouseCode: true, warehouseName: true, projectId: true },
        },
        destinationWarehouse: {
          select: { warehouseCode: true, warehouseName: true, projectId: true },
        },
        items: {
          orderBy: { lineNo: 'asc' },
          include: {
            material: { select: { materialCode: true, materialName: true } },
            uom: { select: { uomCode: true } },
            sourceProject: { select: { projectCode: true, projectName: true } },
            destinationProject: {
              select: { projectCode: true, projectName: true },
            },
          },
        },
        approvalInstance: {
          include: { actions: { orderBy: { actionAt: 'asc' } } },
        },
        stockTransactions: { orderBy: { postedAt: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'STOCK_TRANSFER_NOT_FOUND' });
    for (const projectId of [
      ...new Set(
        row.items.flatMap((item) => [
          item.sourceProjectId,
          item.destinationProjectId,
        ]),
      ),
    ]) {
      await this.access.assertAccess(auth, projectId, db);
    }
    return row;
  }

  async create(
    context: AuditContext,
    input: {
      sourceWarehouseId: string;
      destinationWarehouseId: string;
      transferDate: Date;
      remarks?: string | null;
      lines: TransferLineInput[];
    },
  ) {
    if (!input.lines.length || input.lines.length > 200) {
      throw new UnprocessableEntityException({ code: 'STOCK_TRANSFER_LINES_INVALID' });
    }
    input.lines.forEach((line) => this.assertQuantity(line.quantity));
    const sequence = await this.prisma.numberSequence.findFirst({
      where: {
        companyId: context.auth.companyId,
        sequenceCode: 'STOCK_TRANSFER',
      },
    });
    if (
      !sequence ||
      sequence.formatTemplate !== 'STYYMM-###' ||
      sequence.resetRule !== 'MONTHLY'
    ) {
      throw new ConflictException({
        code: 'STOCK_TRANSFER_NUMBERING_REQUIRED',
        detail: 'Configure STYYMM-### with a monthly reset.',
      });
    }
    const transferNumber = await this.numbers.next(
      context.auth.companyId,
      'STOCK_TRANSFER',
    );
    return this.prisma.$transaction(async (tx) => {
      const warehouses = await this.validateWarehouses(
        context.auth,
        input.sourceWarehouseId,
        input.destinationWarehouseId,
        tx,
      );
      const transfer = await tx.stockTransfer.create({
        data: {
          companyId: context.auth.companyId,
          sourceWarehouseId: warehouses.source.id,
          destinationWarehouseId: warehouses.destination.id,
          transferNumber,
          transferDate: input.transferDate,
          remarks: input.remarks ?? null,
          createdByUserId: context.auth.userId,
        },
      });
      for (const [index, line] of input.lines.entries()) {
        await this.validateLine(context.auth, warehouses, line, tx);
        await tx.stockTransferItem.create({
          data: {
            stockTransferId: transfer.id,
            lineNo: index + 1,
            materialId: line.materialId,
            quantity: line.quantity,
            uomId: line.uomId,
            sourceProjectId: line.sourceProjectId,
            destinationProjectId: line.destinationProjectId,
            remarks: line.remarks ?? null,
          },
        });
      }
      await this.audit.record(
        {
          ...context,
          entityType: 'STOCK_TRANSFER',
          entityId: transfer.id,
          action: 'CREATE',
          newValues: {
            transferNumber,
            sourceWarehouseId: input.sourceWarehouseId,
            destinationWarehouseId: input.destinationWarehouseId,
            lineCount: input.lines.length,
          },
        },
        tx,
      );
      return this.get(context.auth, transfer.id, tx);
    });
  }

  async updateDraft(
    context: AuditContext,
    id: string,
    input: {
      sourceWarehouseId?: string;
      destinationWarehouseId?: string;
      transferDate?: Date;
      remarks?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfer = await this.get(context.auth, id, tx);
      if (transfer.submittedAt || transfer.postedAt || transfer.reversedAt) {
        throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_DRAFT' });
      }
      const sourceWarehouseId =
        input.sourceWarehouseId ?? transfer.sourceWarehouseId;
      const destinationWarehouseId =
        input.destinationWarehouseId ?? transfer.destinationWarehouseId;
      const warehouses = await this.validateWarehouses(
        context.auth,
        sourceWarehouseId,
        destinationWarehouseId,
        tx,
      );
      for (const item of transfer.items) {
        await this.validateLine(context.auth, warehouses, item, tx);
      }
      const row = await tx.stockTransfer.update({
        where: { id },
        data: {
          sourceWarehouseId,
          destinationWarehouseId,
          ...(input.transferDate ? { transferDate: input.transferDate } : {}),
          ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'STOCK_TRANSFER',
          entityId: id,
          action: 'UPDATE_DRAFT',
          oldValues: {
            sourceWarehouseId: transfer.sourceWarehouseId,
            destinationWarehouseId: transfer.destinationWarehouseId,
          },
          newValues: {
            sourceWarehouseId,
            destinationWarehouseId,
          },
        },
        tx,
      );
      return row;
    });
  }

  async updateDraftLine(
    context: AuditContext,
    itemId: string,
    input: TransferLineInput,
  ) {
    this.assertQuantity(input.quantity);
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.stockTransferItem.findUnique({
        where: { id: itemId },
      });
      if (!item) throw new NotFoundException({ code: 'STOCK_TRANSFER_ITEM_NOT_FOUND' });
      const transfer = await this.get(context.auth, item.stockTransferId, tx);
      if (transfer.submittedAt || transfer.postedAt || transfer.reversedAt) {
        throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_DRAFT' });
      }
      const warehouses = await this.validateWarehouses(
        context.auth,
        transfer.sourceWarehouseId,
        transfer.destinationWarehouseId,
        tx,
      );
      await this.validateLine(context.auth, warehouses, input, tx);
      const row = await tx.stockTransferItem.update({
        where: { id: itemId },
        data: {
          materialId: input.materialId,
          quantity: input.quantity,
          uomId: input.uomId,
          sourceProjectId: input.sourceProjectId,
          destinationProjectId: input.destinationProjectId,
          remarks: input.remarks ?? null,
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'STOCK_TRANSFER_ITEM',
          entityId: itemId,
          action: 'UPDATE_DRAFT',
          oldValues: { quantity: item.quantity.toString() },
          newValues: { quantity: row.quantity.toString() },
        },
        tx,
      );
      return row;
    });
  }

  async submit(context: AuditContext, id: string, workflowCode: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const transfer = await this.get(context.auth, id, tx);
        if (
          transfer.submittedAt ||
          transfer.postedAt ||
          transfer.reversedAt ||
          !transfer.items.length
        ) {
          throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_DRAFT' });
        }
        const warehouses = await this.validateWarehouses(
          context.auth,
          transfer.sourceWarehouseId,
          transfer.destinationWarehouseId,
          tx,
        );
        for (const item of transfer.items) {
          await this.validateLine(context.auth, warehouses, item, tx);
        }
        const approval = await this.approvals.start(
          {
            companyId: context.auth.companyId,
            workflowCode,
            entityType: 'STOCK_TRANSFER',
            entityId: id,
          },
          tx,
        );
        const row = await tx.stockTransfer.update({
          where: { id },
          data: {
            approvalInstanceId: approval.id,
            submittedByUserId: context.auth.userId,
            submittedAt: new Date(),
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'STOCK_TRANSFER',
            entityId: id,
            action: 'SUBMIT',
            newValues: { approvalInstanceId: approval.id },
          },
          tx,
        );
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async approve(
    context: AuditContext,
    id: string,
    postKey: string,
    comment?: string,
  ) {
    const transfer = await this.get(context.auth, id);
    if (transfer.postedAt && transfer.postKey === postKey) return transfer;
    if (
      !transfer.approvalInstanceId ||
      !transfer.submittedByUserId ||
      transfer.postedAt ||
      transfer.reversedAt
    ) {
      throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_SUBMITTED' });
    }
    await this.approvals.approve(
      transfer.approvalInstanceId,
      context.auth,
      transfer.createdByUserId,
      comment,
      async (tx) => {
        const current = await this.get(context.auth, id, tx);
        if (current.postedAt || current.reversedAt) {
          throw new ConflictException({ code: 'STOCK_TRANSFER_ALREADY_POSTED' });
        }
        await this.lockWarehouses(
          tx,
          current.sourceWarehouseId,
          current.destinationWarehouseId,
        );
        const warehouses = await this.validateWarehouses(
          context.auth,
          current.sourceWarehouseId,
          current.destinationWarehouseId,
          tx,
        );
        for (const item of current.items) {
          await this.validateLine(context.auth, warehouses, item, tx);
        }

        const dimensions = new Map<string, StockDimension>();
        const requiredBySource = new Map<string, Prisma.Decimal>();
        for (const item of current.items) {
          const source = this.dimension(
            current.companyId,
            current.sourceWarehouseId,
            item.materialId,
            item.sourceProjectId,
            item.uomId,
          );
          const destination = this.dimension(
            current.companyId,
            current.destinationWarehouseId,
            item.materialId,
            item.destinationProjectId,
            item.uomId,
          );
          const sourceKey = this.quantities.key(source);
          dimensions.set(sourceKey, source);
          dimensions.set(this.quantities.key(destination), destination);
          requiredBySource.set(
            sourceKey,
            (requiredBySource.get(sourceKey) ?? new Prisma.Decimal(0)).plus(
              item.quantity,
            ),
          );
        }
        for (const key of [...dimensions.keys()].sort()) {
          await this.quantities.lock(tx, dimensions.get(key)!);
        }
        for (const [key, required] of requiredBySource) {
          const available = await this.quantities.available(
            tx,
            dimensions.get(key)!,
          );
          if (required.greaterThan(available.available)) {
            throw new ConflictException({
              code: 'STOCK_TRANSFER_INSUFFICIENT_AVAILABLE',
              detail:
                'Transfer cannot create negative stock or consume stock held by an Active Reservation.',
            });
          }
        }

        const now = new Date();
        await tx.stockTransfer.update({
          where: { id },
          data: {
            postedAt: now,
            postedByUserId: context.auth.userId,
            postKey,
          },
        });
        for (const item of current.items) {
          await tx.stockTransaction.create({
            data: {
              companyId: current.companyId,
              warehouseId: current.sourceWarehouseId,
              materialId: item.materialId,
              projectId: item.sourceProjectId,
              uomId: item.uomId,
              stockTransferId: current.id,
              stockTransferItemId: item.id,
              movementType: 'STOCK_TRANSFER_OUT',
              quantity: item.quantity.negated(),
              effectKey: 'stock-transfer-out:' + item.id,
              postedByUserId: context.auth.userId,
            },
          });
          await tx.stockTransaction.create({
            data: {
              companyId: current.companyId,
              warehouseId: current.destinationWarehouseId,
              materialId: item.materialId,
              projectId: item.destinationProjectId,
              uomId: item.uomId,
              stockTransferId: current.id,
              stockTransferItemId: item.id,
              movementType: 'STOCK_TRANSFER_IN',
              quantity: item.quantity,
              effectKey: 'stock-transfer-in:' + item.id,
              postedByUserId: context.auth.userId,
            },
          });
        }
        await this.audit.record(
          {
            ...context,
            entityType: 'STOCK_TRANSFER',
            entityId: id,
            action: 'APPROVE_POST',
            newValues: {
              postKey,
              postedAt: now,
              lineCount: current.items.length,
            },
          },
          tx,
        );
      },
    );
    return this.get(context.auth, id);
  }

  async reject(context: AuditContext, id: string, comment?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const transfer = await this.get(context.auth, id, tx);
        if (
          !transfer.approvalInstanceId ||
          !transfer.submittedByUserId ||
          transfer.postedAt
        ) {
          throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_SUBMITTED' });
        }
        const result = await this.approvals.reject(
          transfer.approvalInstanceId,
          context.auth,
          transfer.createdByUserId,
          comment,
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'STOCK_TRANSFER',
            entityId: id,
            action: 'REJECT',
            newValues: { approvalState: result.approvalState },
          },
          tx,
        );
        return this.get(context.auth, id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async reverse(
    context: AuditContext,
    id: string,
    reversalKey: string,
    reason: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          'stock-transfer-reverse:' + id,
        );
        const transfer = await this.get(context.auth, id, tx);
        if (transfer.reversedAt && transfer.reversalKey === reversalKey) {
          return transfer;
        }
        if (!transfer.postedAt || transfer.reversedAt) {
          throw new ConflictException({ code: 'STOCK_TRANSFER_NOT_REVERSIBLE' });
        }
        await this.lockWarehouses(
          tx,
          transfer.sourceWarehouseId,
          transfer.destinationWarehouseId,
        );
        await this.validateWarehouses(
          context.auth,
          transfer.sourceWarehouseId,
          transfer.destinationWarehouseId,
          tx,
        );

        const originals = transfer.stockTransactions.filter(
          (movement) =>
            movement.movementType === 'STOCK_TRANSFER_OUT' ||
            movement.movementType === 'STOCK_TRANSFER_IN',
        );
        if (originals.length !== transfer.items.length * 2) {
          throw new ConflictException({ code: 'STOCK_TRANSFER_LEDGER_INCOMPLETE' });
        }

        const dimensions = new Map<string, StockDimension>();
        const requiredAtDestination = new Map<string, Prisma.Decimal>();
        for (const movement of originals) {
          const projectId = movement.projectId;
          if (!projectId) {
            throw new ConflictException({
              code: 'STOCK_TRANSFER_LEDGER_PROJECT_MISSING',
            });
          }
          const dimension = this.dimension(
            movement.companyId,
            movement.warehouseId,
            movement.materialId,
            projectId,
            movement.uomId,
          );
          const key = this.quantities.key(dimension);
          dimensions.set(key, dimension);
          if (movement.movementType === 'STOCK_TRANSFER_IN') {
            requiredAtDestination.set(
              key,
              (requiredAtDestination.get(key) ?? new Prisma.Decimal(0)).plus(
                movement.quantity,
              ),
            );
          }
        }
        for (const key of [...dimensions.keys()].sort()) {
          await this.quantities.lock(tx, dimensions.get(key)!);
        }
        for (const [key, required] of requiredAtDestination) {
          const available = await this.quantities.available(
            tx,
            dimensions.get(key)!,
          );
          if (required.greaterThan(available.available)) {
            throw new ConflictException({
              code: 'STOCK_TRANSFER_REVERSAL_INSUFFICIENT_AVAILABLE',
              detail:
                'Transfer reversal cannot create negative stock or consume stock held by an Active Reservation.',
            });
          }
        }

        const at = new Date();
        await tx.stockTransfer.update({
          where: { id },
          data: {
            reversedAt: at,
            reversedByUserId: context.auth.userId,
            reversalKey,
            reversalReason: reason,
          },
        });
        for (const movement of originals) {
          await tx.stockTransaction.create({
            data: {
              companyId: movement.companyId,
              warehouseId: movement.warehouseId,
              materialId: movement.materialId,
              projectId: movement.projectId,
              uomId: movement.uomId,
              stockTransferId: movement.stockTransferId,
              stockTransferItemId: movement.stockTransferItemId,
              movementType:
                movement.movementType === 'STOCK_TRANSFER_OUT'
                  ? 'STOCK_TRANSFER_OUT_REVERSAL'
                  : 'STOCK_TRANSFER_IN_REVERSAL',
              quantity: movement.quantity.negated(),
              effectKey: 'stock-transfer-reversal:' + movement.id,
              reversalOfId: movement.id,
              postedByUserId: context.auth.userId,
            },
          });
        }
        await this.audit.record(
          {
            ...context,
            entityType: 'STOCK_TRANSFER',
            entityId: id,
            action: 'REVERSE',
            newValues: { reversalKey, reason, reversedAt: at },
          },
          tx,
        );
        return this.get(context.auth, id, tx);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private dimension(
    companyId: string,
    warehouseId: string,
    materialId: string,
    projectId: string,
    uomId: string,
  ): StockDimension {
    return { companyId, warehouseId, materialId, projectId, uomId };
  }

  private assertQuantity(quantity: Prisma.Decimal) {
    if (quantity.lte(0) || quantity.decimalPlaces() > 4) {
      throw new UnprocessableEntityException({
        code: 'STOCK_TRANSFER_QUANTITY_INVALID',
        detail: 'Transfer quantity must be a positive DECIMAL(18,4).',
      });
    }
  }

  private async lockWarehouses(
    tx: Prisma.TransactionClient,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
  ) {
    for (const warehouseId of [
      sourceWarehouseId,
      destinationWarehouseId,
    ].sort()) {
      await tx.$executeRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        'inventory-warehouse:' + warehouseId,
      );
      await tx.$queryRawUnsafe<Array<{ id: string }>>(
        'SELECT id FROM warehouses WHERE id = $1::uuid FOR UPDATE',
        warehouseId,
      );
    }
  }

  private async validateWarehouses(
    auth: AuthenticatedUserContext,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    db: Db,
  ) {
    if (sourceWarehouseId === destinationWarehouseId) {
      throw new UnprocessableEntityException({
        code: 'STOCK_TRANSFER_WAREHOUSES_SAME',
        detail: 'Source and destination Warehouses must differ.',
      });
    }
    const rows = await db.warehouse.findMany({
      where: {
        id: { in: [sourceWarehouseId, destinationWarehouseId] },
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true, projectId: true },
    });
    const source = rows.find((row) => row.id === sourceWarehouseId);
    const destination = rows.find((row) => row.id === destinationWarehouseId);
    if (!source || !destination) {
      throw new ConflictException({
        code: 'STOCK_TRANSFER_WAREHOUSE_INVALID',
        detail:
          'Both source and destination Warehouses must be active and belong to the same Company.',
      });
    }
    return { source, destination };
  }

  private async validateLine(
    auth: AuthenticatedUserContext,
    warehouses: {
      source: { id: string; projectId: string | null };
      destination: { id: string; projectId: string | null };
    },
    line: {
      materialId: string;
      quantity: Prisma.Decimal;
      uomId: string;
      sourceProjectId: string;
      destinationProjectId: string;
    },
    db: Db,
  ) {
    this.assertQuantity(line.quantity);
    await this.access.assertAccess(auth, line.sourceProjectId, db);
    if (line.destinationProjectId !== line.sourceProjectId) {
      await this.access.assertAccess(auth, line.destinationProjectId, db);
    }
    const [material, uom, projects] = await Promise.all([
      db.material.findFirst({
        where: {
          id: line.materialId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      db.unitOfMeasure.findFirst({
        where: {
          id: line.uomId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
      db.project.findMany({
        where: {
          id: { in: [line.sourceProjectId, line.destinationProjectId] },
          companyId: auth.companyId,
          isActive: true,
        },
        select: { id: true },
      }),
    ]);
    if (!material || !uom || projects.length !== new Set([
      line.sourceProjectId,
      line.destinationProjectId,
    ]).size) {
      throw new UnprocessableEntityException({
        code: 'STOCK_TRANSFER_DIMENSIONS_INVALID',
        detail:
          'Material, UOM and source/destination Project must be active and belong to the same Company.',
      });
    }
    if (
      (warehouses.source.projectId &&
        warehouses.source.projectId !== line.sourceProjectId) ||
      (warehouses.destination.projectId &&
        warehouses.destination.projectId !== line.destinationProjectId)
    ) {
      throw new UnprocessableEntityException({
        code: 'STOCK_TRANSFER_PROJECT_WAREHOUSE_MISMATCH',
        detail:
          'Project-fixed Warehouses require matching source/destination Project attribution.',
      });
    }
  }
}
