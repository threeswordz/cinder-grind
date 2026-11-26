import {activatedStockMaterials,lockStockWarehouses} from './material-uom-active-source';
import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {deriveStockEffectFromOriginal} from '../master-data/material-uom-effect-pin';
import {requireTrackedStockUnit} from './material-uom-stock-dimension';
import { createHash } from 'node:crypto';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { InventoryQuantityService, StockDimension } from './inventory-quantity.service';
import { transferActor, TransferDb } from './transfer-custody-actor';
import { TRANSFER, transferCommand, transferReceipt } from './transfer-custody-contract';
import { inventoryObject, inventoryUuid, requiredInventoryString } from './inventory-validation';

type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type Tx = Prisma.TransactionClient;
function conflict(code: string): never { throw new ConflictException({ code }); }
function denied(): never { throw new ForbiddenException({ code: 'TRANSFER_CUSTODY_DENIED' }); }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

@Injectable()
export class TransferCustodyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly quantities: InventoryQuantityService,
    private readonly documents: DocumentsService,
  ) {}

  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.prisma.$transaction(work, { isolationLevel: 'Serializable', timeout: 30000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          if (error.code === 'P2034' || error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))) {
            if (attempt < 2) continue;
            conflict('TRANSFER_RETRY_REQUIRED');
          }
          if (error.code === 'P2002') conflict('TRANSFER_CONCURRENT_CONFLICT');
          const code = String(error.meta?.message ?? '').match(/TRANSFER_[A-Z_]+/)?.[0];
          if (code) conflict(code);
        }
        throw error;
      }
    }
    return conflict('TRANSFER_RETRY_REQUIRED');
  }

  async controlled(id: string, db: TransferDb = this.prisma) {
    return db.transferCustody.findUnique({ where: { transferId: id } });
  }

  // Called atomically with canonical creation, before any approval/stock effect.
  async event(context: Context, tx: Tx, id: string, action: string, reason: string, bump = true) {
    return recordTransferCustodyEvent(context, tx, this.audit, id, action, reason, bump);
  }

  private async project(auth: AuthenticatedUserContext, projectId: string, db: TransferDb) {
    await this.access.assertAccess(auth, projectId, db);
    if (!await db.project.findFirst({ where: { id: projectId, companyId: auth.companyId, isActive: true }, select: { id: true } })) denied();
  }

  async projects(supplied: AuthenticatedUserContext) {
    const auth = await transferActor(supplied, this.prisma, [TRANSFER + 'receipt_view']);
    return this.prisma.project.findMany({ where: { AND: [await this.access.scopeWhere(auth), { isActive: true }] }, select: { id: true, projectCode: true, projectName: true }, orderBy: { projectCode: 'asc' } });
  }

  async enable(context: Context, projectId: string, value: unknown) {
    const input = inventoryObject(value), requestKey = inventoryUuid(input.requestKey, 'requestKey'), reason = requiredInventoryString(input, 'reason', 2000);
    if (process.env.NODE_ENV === 'production') denied();
    return this.transaction(async (tx) => {
      const auth = await transferActor(context.auth, tx, [TRANSFER + 'configure']);
      await this.project(auth, projectId, tx);
      await this.key(tx, auth, requestKey);
      const hash = digest(['ENABLE', projectId, reason]);
      const prior = await this.prior(tx, auth, requestKey, 'ENABLE', hash);
      if (prior) return prior.outcome;
      await tx.transferProjectPolicy.create({ data: { projectId, companyId: auth.companyId, enabledByUserId: auth.userId, reason } });
      return this.operation(context, tx, requestKey, 'ENABLE', hash, null, projectId, { projectId, enabled: true });
    });
  }

  private async key(tx: Tx, auth: AuthenticatedUserContext, key: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['transfer-key', auth.companyId, auth.userId, key].join(':')}, 0))`;
  }

  private async lock(tx: Tx, auth: AuthenticatedUserContext, id: string) {
    await tx.$queryRaw`SELECT transfer_id FROM transfer_custodies WHERE transfer_id=${id}::uuid AND company_id=${auth.companyId}::uuid FOR UPDATE`;
    const row = await tx.transferCustody.findFirst({ where: { transferId: id, companyId: auth.companyId }, include: { dispatch: true } });
    if (!row) throw new NotFoundException({ code: 'TRANSFER_CUSTODY_NOT_FOUND' });
    return row;
  }

  private async prior(tx: Tx, auth: AuthenticatedUserContext, key: string, action: string, hash: string) {
    const prior = await tx.transferOperation.findUnique({ where: { companyId_actorUserId_requestKey: { companyId: auth.companyId, actorUserId: auth.userId, requestKey: key } } });
    if (prior && (prior.action !== action || prior.bodyDigest !== hash)) conflict('TRANSFER_REPLAY_CONFLICT');
    return prior;
  }

  private async operation(context: Context, tx: Tx, requestKey: string, action: string, bodyDigest: string, transferId: string | null, projectId: string | null, outcome: Prisma.InputJsonValue) {
    await tx.transferOperation.create({ data: { companyId: context.auth.companyId, actorUserId: context.auth.userId, requestKey, action, bodyDigest, transferId, projectId, outcome } });
    await this.audit.record({ ...context, entityType: 'STOCK_TRANSFER', entityId: transferId ?? projectId!, action: 'CUSTODY_' + action, newValues: outcome }, tx);
    return outcome;
  }

  private async source(auth: AuthenticatedUserContext, id: string, db: TransferDb) {
    const row = await db.stockTransfer.findFirst({ where: { id, companyId: auth.companyId }, include: { items: true, approvalInstance: true } });
    if (!row || !row.items.length) throw new NotFoundException({ code: 'TRANSFER_CUSTODY_NOT_FOUND' });
    for (const projectId of new Set(row.items.map((i) => i.sourceProjectId))) await this.project(auth, projectId, db);
    return row;
  }

  async dispatch(context: Context, id: string, value: unknown) {
    const input = transferCommand(value);
    return this.transaction(async (tx) => {
      const auth = await transferActor(context.auth, tx, [TRANSFER + 'view', TRANSFER + 'dispatch']);
      await this.key(tx, auth, input.requestKey);
      const custody = await this.lock(tx, auth, id), row = await this.source(auth, id, tx);
      const hash = digest(['DISPATCH', id, input]), prior = await this.prior(tx, auth, input.requestKey, 'DISPATCH', hash);
      if (prior) return prior.outcome;
      if (custody.version !== input.expectedVersion) conflict('TRANSFER_VERSION_CONFLICT');
      if (await tx.transferCustodyEvent.findFirst({where:{transferId:id,action:'CANCEL'},select:{id:true}})) conflict('SS16_TRANSFER_CANCELLED');
      if (custody.dispatch || row.postedAt || row.reversedAt || row.approvalInstance?.approvalState !== 'APPROVED') conflict('TRANSFER_DISPATCH_NOT_READY');
      for (const warehouseId of [row.sourceWarehouseId, row.destinationWarehouseId].sort()) {
        await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', 'inventory-warehouse:' + warehouseId);
        const warehouse = await tx.warehouse.findFirst({ where: { id: warehouseId, companyId: auth.companyId, isActive: true }, select: { id: true, projectId: true } });
        if (!warehouse || row.items.some(item => warehouse.projectId && warehouse.projectId !== (warehouseId === row.sourceWarehouseId ? item.sourceProjectId : item.destinationProjectId))) conflict('TRANSFER_WAREHOUSE_SCOPE_CHANGED');
      }
      for (const projectId of new Set(row.items.map(item => item.destinationProjectId))) if (!await tx.project.count({ where: { id: projectId, companyId: auth.companyId, isActive: true } })) conflict('TRANSFER_DIMENSIONS_CHANGED');
      const pinRows=await tx.materialUomTransferSourcePin.findMany({where:{transferId:id,companyId:auth.companyId}});
      const pins=new Map(pinRows.map(p=>[p.transferItemId,p]));
      await lockStockWarehouses(tx,[row.sourceWarehouseId]);
      const activated=await activatedStockMaterials(tx,auth.companyId,row.items.map(i=>i.materialId));
      if(row.items.some(i=>activated.has(i.materialId)!==pins.has(i.id)))conflict('MATERIAL_UOM_TRANSFER_SOURCE_INCOMPLETE');
      const dimensions = new Map<string, { dimension: StockDimension; quantity: Prisma.Decimal }>();
      for (const item of [...row.items].sort((a,b)=>a.materialId.localeCompare(b.materialId)||a.id.localeCompare(b.id))) {
        const p=pins.get(item.id);
        if(p&&(p.sourceUomId!==item.uomId||!p.sourceQuantity.eq(item.quantity)||p.materialId!==item.materialId||
          p.sourceProjectId!==item.sourceProjectId||p.destinationProjectId!==item.destinationProjectId||
          p.sourceWarehouseId!==row.sourceWarehouseId||p.destinationWarehouseId!==row.destinationWarehouseId))conflict('MATERIAL_UOM_TRANSFER_SOURCE_MISMATCH');
        await requireTrackedStockUnit(tx,{companyId:row.companyId,materialId:item.materialId,uomId:p?.stockUomId??item.uomId},p?.stockQuantity??item.quantity);
        if (!await tx.material.count({ where: { id: item.materialId, companyId: auth.companyId, isActive: true } }) || !await tx.unitOfMeasure.count({ where: { id: item.uomId, companyId: auth.companyId, isActive: true } })) conflict('TRANSFER_DIMENSIONS_CHANGED');
        const dimension = { companyId: row.companyId, warehouseId: row.sourceWarehouseId, materialId: item.materialId, projectId: item.sourceProjectId, uomId: pins.get(item.id)?.stockUomId??item.uomId };
        const key = this.quantities.key(dimension), prior = dimensions.get(key);
        dimensions.set(key, { dimension, quantity: (prior?.quantity ?? new Prisma.Decimal(0)).plus(pins.get(item.id)?.stockQuantity??item.quantity) });
      }
      for (const key of [...dimensions.keys()].sort()) await this.quantities.lock(tx, dimensions.get(key)!.dimension);
      for (const { dimension, quantity } of dimensions.values()) if (quantity.gt((await this.quantities.available(tx, dimension)).available)) conflict('STOCK_TRANSFER_INSUFFICIENT_AVAILABLE');
      const now = new Date();
      await tx.transferDispatch.create({ data: { transferId: id, actorUserId: auth.userId, reason: input.reason, recordedAt: now } });
      await tx.stockTransfer.update({ where: { id }, data: { postedAt: now, postedByUserId: auth.userId, postKey: 'dispatch:' + input.requestKey } });
      for (const item of row.items) await tx.stockTransaction.create({ data: {
        companyId: row.companyId, warehouseId: row.sourceWarehouseId, materialId: item.materialId, projectId: item.sourceProjectId, uomId: pins.get(item.id)?.stockUomId??item.uomId,
        stockTransferId: id, stockTransferItemId: item.id, movementType: 'STOCK_TRANSFER_OUT', quantity: (pins.get(item.id)?.stockQuantity??item.quantity).negated(), effectKey: 'stock-transfer-out:' + item.id, postedByUserId: auth.userId,
      } });
      const version = await this.event(context, tx, id, 'DISPATCH', input.reason);
      return this.operation(context, tx, input.requestKey, 'DISPATCH', hash, id, null, { id, version });
    });
  }

  private async destination(auth: AuthenticatedUserContext, id: string, projectId: string, db: TransferDb) {
    await this.project(auth, projectId, db);
    const row = await db.stockTransfer.findFirst({ where: { id, companyId: auth.companyId }, select: {
      id: true, transferNumber: true, reversedAt: true,
      destinationWarehouse: { select: { id: true, warehouseCode: true, warehouseName: true, isActive: true, projectId: true } },
      items: { where: { destinationProjectId: projectId }, orderBy: { lineNo: 'asc' }, select: { id: true, quantity: true, materialId: true, uomId: true, material: { select: { materialCode: true, materialName: true, isActive: true } }, uom: { select: { uomCode: true, isActive: true } } } },
    } });
    if (!row || !row.items.length) throw new NotFoundException({ code: 'TRANSFER_DESTINATION_NOT_FOUND' });
    return row;
  }

  private async receiver(auth: Awaited<ReturnType<typeof transferActor>>, id: string, projectId: string, db: TransferDb) {
    if (auth.permissions.includes(TRANSFER + 'receive')) return;
    if (!auth.permissions.includes(TRANSFER + 'receive_assigned')) denied();
    // An all-Project grant does not substitute for the assigned Employee's destination membership.
    const employeeId = await this.access.activeEmployeeId(auth, db);
    const assignment = await db.transferReceiverAssignment.findFirst({ where: { transferId: id, projectId }, orderBy: { version: 'desc' } });
    if (!employeeId || assignment?.employeeId !== employeeId || !await db.projectMember.count({ where: { projectId, employeeId, isActive: true } })) denied();
  }

  async list(supplied: AuthenticatedUserContext, projectId: string) {
    const auth = await transferActor(supplied, this.prisma, [TRANSFER + 'receipt_view']);
    await this.project(auth, projectId, this.prisma);
    const rows = await this.prisma.stockTransfer.findMany({ where: { companyId: auth.companyId, items: { some: { destinationProjectId: projectId } }, id: { in: (await this.prisma.transferCustody.findMany({ where: { companyId: auth.companyId }, select: { transferId: true } })).map((r) => r.transferId) } }, select: { id: true, transferNumber: true }, orderBy: { createdAt: 'desc' }, take: 100 });
    return rows;
  }

  async get(supplied: AuthenticatedUserContext, id: string, projectId: string) {
    const auth = await transferActor(supplied, this.prisma, [TRANSFER + 'receipt_view']);
    const row = await this.destination(auth, id, projectId, this.prisma), custody = await this.controlled(id);
    if (!custody || custody.companyId !== auth.companyId) throw new NotFoundException({ code: 'TRANSFER_CUSTODY_NOT_FOUND' });
    const receipts = await this.prisma.transferReceipt.findMany({ where: { transferId: id, projectId }, include: { lines: true }, orderBy: { createdAt: 'asc' } });
    const dispatch = await this.prisma.transferDispatch.findUnique({ where: { transferId: id } });
    const assignment = await this.prisma.transferReceiverAssignment.findFirst({ where: { transferId: id, projectId }, orderBy: { version: 'desc' } });
    const totals = new Map<string, Prisma.Decimal>();
    for (const receipt of receipts.filter((r) => r.postedAt)) for (const line of receipt.lines) totals.set(line.transferItemId, (totals.get(line.transferItemId) ?? new Prisma.Decimal(0)).plus(line.quantity));
    let canReceive = false;
    try { await this.receiver(auth, id, projectId, this.prisma); canReceive = true; } catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    return {
      id, projectId, transferNumber: row.transferNumber, version: custody.version, reversedAt: row.reversedAt,
      destinationWarehouse: { id: row.destinationWarehouse.id, warehouseCode: row.destinationWarehouse.warehouseCode, warehouseName: row.destinationWarehouse.warehouseName, isActive: row.destinationWarehouse.isActive }, dispatchedAt: dispatch?.recordedAt ?? null, assignedEmployeeId: assignment?.employeeId ?? null,
      canReceive: canReceive && Boolean(dispatch) && !row.reversedAt,
      lines: row.items.map((i) => ({ id: i.id, material: i.material, uom: i.uom, quantity: i.quantity.toFixed(4), accepted: (totals.get(i.id) ?? new Prisma.Decimal(0)).toFixed(4), outstanding: dispatch ? i.quantity.minus(totals.get(i.id) ?? 0).toFixed(4) : '0.0000' })),
      receipts: receipts.map((r) => ({ id: r.id, createdByUserId: r.createdByUserId, reason: r.reason, createdAt: r.createdAt, postedAt: r.postedAt, documentId: auth.permissions.includes('documents.document.view') ? r.documentId : null, lines: r.lines.map((l) => ({ transferItemId: l.transferItemId, quantity: l.quantity.toFixed(4), note: l.note })) })),
    };
  }

  async assign(context: Context, id: string, projectId: string, value: unknown) {
    const input = { ...transferCommand(value), employeeId: inventoryUuid(inventoryObject(value).employeeId, 'employeeId') };
    return this.transaction(async (tx) => {
      const auth = await transferActor(context.auth, tx, [TRANSFER + 'view', TRANSFER + 'assign_receiver']);
      await this.key(tx, auth, input.requestKey);
      const custody = await this.lock(tx, auth, id);
      const source = await this.source(auth, id, tx); await this.destination(auth, id, projectId, tx);
      const hash = digest(['ASSIGN', id, projectId, input]), prior = await this.prior(tx, auth, input.requestKey, 'ASSIGN', hash);
      if (prior) return prior.outcome;
      if (source.approvalInstance?.approvalState === 'CANCELLED' || await tx.transferCustodyEvent.findFirst({where:{transferId:id,action:'CANCEL'},select:{id:true}})) conflict('SS16_TRANSFER_CANCELLED');
      if (custody.version !== input.expectedVersion) conflict('TRANSFER_VERSION_CONFLICT');
      const employee = await tx.employee.findFirst({ where: { id: input.employeeId, companyId: auth.companyId, isActive: true, projectMembers: { some: { projectId, isActive: true } } }, select: { id: true } });
      const user = employee && await tx.user.findFirst({
        where: { employeeId: employee.id, companyId: auth.companyId, isActive: true },
        select: { id: true, userRoles: { select: { role: { select: {
          isActive: true, companyId: true,
          rolePermissions: { select: { permission: { select: { permissionCode: true } } } },
        } } } } },
      });
      const permissions = user?.userRoles.filter((r) => r.role.isActive && r.role.companyId === auth.companyId).flatMap((r) => r.role.rolePermissions.map((p) => p.permission.permissionCode)) ?? [];
      if (!employee || ![TRANSFER + 'receipt_view', TRANSFER + 'receive_assigned', 'documents.document.view'].every((p) => permissions.includes(p))) conflict('TRANSFER_ASSIGNEE_NOT_ELIGIBLE');
      const version = await this.event(context, tx, id, 'ASSIGN', input.reason);
      await tx.transferReceiverAssignment.create({ data: { transferId: id, projectId, employeeId: employee.id, actorUserId: auth.userId, version, reason: input.reason } });
      return this.operation(context, tx, input.requestKey, 'ASSIGN', hash, id, projectId, { id, version });
    });
  }

  async eligibleReceivers(supplied: AuthenticatedUserContext, id: string, projectId: string) {
    const auth = await transferActor(supplied, this.prisma, [TRANSFER + 'view', TRANSFER + 'assign_receiver']);
    await this.source(auth, id, this.prisma);
    await this.destination(auth, id, projectId, this.prisma);
    const employees = await this.prisma.employee.findMany({
      where: { companyId: auth.companyId, isActive: true, projectMembers: { some: { projectId, isActive: true } } },
      select: { id: true, employeeCode: true, employeeName: true }, orderBy: { employeeCode: 'asc' }, take: 100,
    });
    const result = [];
    for (const employee of employees) {
      const user = await this.prisma.user.findFirst({ where: { employeeId: employee.id, companyId: auth.companyId, isActive: true }, select: {
        userRoles: { select: { role: { select: { companyId: true, isActive: true, rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } },
      } });
      const permissions = user?.userRoles.filter(r => r.role.isActive && r.role.companyId === auth.companyId).flatMap(r => r.role.rolePermissions.map(p => p.permission.permissionCode)) ?? [];
      if ([TRANSFER + 'receipt_view', TRANSFER + 'receive_assigned', 'documents.document.view'].every(p => permissions.includes(p))) result.push(employee);
    }
    return result;
  }

  async prepareReceipt(context: Context, id: string, projectId: string, value: unknown) {
    const input = transferCommand(value);
    return this.transaction(async (tx) => {
      const auth = await transferActor(context.auth, tx, [TRANSFER + 'receipt_view']);
      await this.key(tx, auth, input.requestKey);
      const custody = await this.lock(tx, auth, id), row = await this.destination(auth, id, projectId, tx);
      await this.receiver(auth, id, projectId, tx);
      const hash = digest(['PREPARE_RECEIPT', id, projectId, input]), prior = await this.prior(tx, auth, input.requestKey, 'PREPARE_RECEIPT', hash);
      if (prior) return prior.outcome;
      if (custody.version !== input.expectedVersion) conflict('TRANSFER_VERSION_CONFLICT');
      if (!custody.dispatch || row.reversedAt) conflict('TRANSFER_NOT_DISPATCHED');
      if (!row.destinationWarehouse.isActive || row.destinationWarehouse.projectId && row.destinationWarehouse.projectId !== projectId) conflict('TRANSFER_WAREHOUSE_SCOPE_CHANGED');
      const receipt = await tx.transferReceipt.create({ data: { transferId: id, projectId, createdByUserId: auth.userId, reason: input.reason } });
      const version = await this.event(context, tx, id, 'PREPARE_RECEIPT', input.reason);
      return this.operation(context, tx, input.requestKey, 'PREPARE_RECEIPT', hash, id, projectId, { id, receiptId: receipt.id, version });
    });
  }

  async receive(context: Context, id: string, projectId: string, receiptId: string, value: unknown) {
    const input = transferReceipt(value);
    return this.transaction(async (tx) => {
      const auth = await transferActor(context.auth, tx, [TRANSFER + 'receipt_view', 'documents.document.view']);
      await this.key(tx, auth, input.requestKey);
      const custody = await this.lock(tx, auth, id), row = await this.destination(auth, id, projectId, tx);
      await this.receiver(auth, id, projectId, tx);
      const hash = digest(['RECEIVE', id, projectId, receiptId, { ...input, lines: input.lines.map((l) => ({ ...l, quantity: l.quantity.toFixed(4) })) }]);
      const prior = await this.prior(tx, auth, input.requestKey, 'RECEIVE', hash);
      if (prior) return prior.outcome;
      if (custody.version !== input.expectedVersion) conflict('TRANSFER_VERSION_CONFLICT');
      if (!custody.dispatch || row.reversedAt || !row.destinationWarehouse.isActive) conflict('TRANSFER_NOT_RECEIVABLE');
      if (row.destinationWarehouse.projectId && row.destinationWarehouse.projectId !== projectId) conflict('TRANSFER_WAREHOUSE_SCOPE_CHANGED');
      const receipt = await tx.transferReceipt.findFirst({ where: { id: receiptId, transferId: id, projectId, createdByUserId: auth.userId, postedAt: null } });
      if (!receipt) conflict('TRANSFER_RECEIPT_NOT_EDITABLE');
      const document = await tx.document.findFirst({ where: { id: input.documentId, companyId: auth.companyId, isActive: true, links: { some: { entityType: 'TRANSFER_RECEIPT', entityId: receiptId } } }, select: { id: true, checksum: true } });
      if (!document?.checksum) conflict('TRANSFER_RECEIPT_EVIDENCE_REQUIRED');
      // The ordinary canonical download validates both source aliases and actual stored bytes.
      const downloaded = await this.documents.downloadProjectDocument(auth, projectId, document.id, tx);
      if (createHash('sha256').update(downloaded.bytes).digest('hex') !== document.checksum) conflict('TRANSFER_EVIDENCE_INTEGRITY_FAILED');
      const previous = await tx.transferReceiptLine.findMany({ where: { receipt: { transferId: id, postedAt: { not: null } } }, select: { transferItemId: true, quantity: true } });
      const totals = new Map<string, Prisma.Decimal>();
      for (const line of previous) totals.set(line.transferItemId, (totals.get(line.transferItemId) ?? new Prisma.Decimal(0)).plus(line.quantity));
      const effects=new Map<string,{stockUomId:string;stockQuantity:Prisma.Decimal}>();
      const dimensions: StockDimension[] = [];
      for (const line of input.lines) {
        const item = row.items.find((i) => i.id === line.transferItemId);
        if (!item || !item.material.isActive || !item.uom.isActive || line.quantity.plus(totals.get(item.id) ?? 0).gt(item.quantity)) conflict('TRANSFER_OVERRECEIPT_OR_DIMENSION_INVALID');
        const movement=await tx.stockTransaction.findFirst({where:{stockTransferItemId:item.id,movementType:'STOCK_TRANSFER_OUT'},include:{materialUomEffectPin:true}});
        const pin=movement?.materialUomEffectPin;
        if(pin){
          if(pin.effectSign!==-1||pin.companyId!==auth.companyId||pin.materialId!==item.materialId||pin.sourceUomId!==item.uomId||!pin.sourceQuantity.eq(item.quantity))
            conflict('MATERIAL_UOM_TRANSFER_SOURCE_MISMATCH');
          const basis=await tx.materialUomBasis.findUniqueOrThrow({where:{materialId:pin.materialId}});
          const revision=pin.revisionId?await tx.materialUomRevision.findUniqueOrThrow({where:{id:pin.revisionId}}):null;
          effects.set(item.id,deriveStockEffectFromOriginal({...pin,effectSign:-1},line.quantity,item.quantity.minus(totals.get(item.id)??0),1,
            {source:revision?.sourcePrecision??basis.stockPrecision,stock:basis.stockPrecision}));
        }
        dimensions.push({ companyId: auth.companyId, warehouseId: row.destinationWarehouse.id, materialId: item.materialId, projectId, uomId: effects.get(item.id)?.stockUomId??item.uomId });
      }
      for (const dimension of dimensions.sort((a, b) => this.quantities.key(a).localeCompare(this.quantities.key(b)))) await this.quantities.lock(tx, dimension);
      await tx.transferReceipt.update({ where: { id: receiptId }, data: { documentId: document.id, checksum: document.checksum, postedAt: new Date(), reason: input.reason } });
      for (const line of input.lines) {
        const item = row.items.find((i) => i.id === line.transferItemId)!;
        const recorded = await tx.transferReceiptLine.create({ data: { receiptId, transferItemId: item.id, quantity: line.quantity, note: line.note } });
        await tx.stockTransaction.create({ data: {
          companyId: auth.companyId, warehouseId: row.destinationWarehouse.id, projectId, materialId: item.materialId, uomId: effects.get(item.id)?.stockUomId??item.uomId,
          stockTransferId: id, stockTransferItemId: item.id, transferReceiptLineId: recorded.id, movementType: 'STOCK_TRANSFER_IN', quantity: effects.get(item.id)?.stockQuantity??line.quantity, effectKey: 'transfer-receipt:' + recorded.id, postedByUserId: auth.userId,
        } });
      }
      const version = await this.event(context, tx, id, 'RECEIVE', input.reason);
      return this.operation(context, tx, input.requestKey, 'RECEIVE', hash, id, projectId, { id, receiptId, version });
    });
  }
}

export async function bindTransferCustody(context: Context, tx: Tx, audit: AuditService, id: string, sourceProjectIds: string[]) {
    const policies = await tx.transferProjectPolicy.findMany({ where: { projectId: { in: sourceProjectIds } } });
    if (!policies.length) return;
    if (new Set(policies.map((p) => p.projectId)).size !== new Set(sourceProjectIds).size) conflict('TRANSFER_ALL_SOURCES_MUST_BE_ENABLED');
    if (process.env.NODE_ENV === 'production') denied();
    const auth = await transferActor(context.auth, tx, [TRANSFER + 'view', TRANSFER + 'create']);
    if (policies.some((p) => p.companyId !== auth.companyId)) denied();
    await tx.transferCustody.create({ data: { transferId: id, companyId: auth.companyId } });
    await recordTransferCustodyEvent(context, tx, audit, id, 'CREATE', 'New transfer bound to explicitly enabled synthetic dispatch/receipt policy', false);
  }


export async function recordTransferCustodyEvent(context: Context, tx: Tx, audit: AuditService, id: string, action: string, reason: string, bump = true) {
    const row = bump
      ? await tx.transferCustody.update({ where: { transferId: id }, data: { version: { increment: 1 } } })
      : await tx.transferCustody.findUniqueOrThrow({ where: { transferId: id } });
    await tx.transferCustodyEvent.create({ data: { transferId: id, version: row.version, actorUserId: context.auth.userId, action, reason } });
    await audit.record({ ...context, entityType: 'STOCK_TRANSFER', entityId: id, action: 'CUSTODY_' + action, newValues: { version: row.version, reason } }, tx);
    return row.version;
  }

