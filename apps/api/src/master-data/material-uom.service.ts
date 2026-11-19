import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { MATERIAL_UOM_MANAGE, MATERIAL_UOM_VIEW, uomId, uomInvalid, uomPrepare, uomPreview, uomRevise, uomVersion } from './material-uom-contract';
import { materialUomException } from './material-uom-errors';
import { resolveMaterialUomStock } from './material-uom-stock';

type Tx = Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
const conflict = (code = 'MATERIAL_UOM_VERSION_CONFLICT'): never => { throw new ConflictException({ code, detail: 'Refresh the material definitions before changing them.' }); };

@Injectable()
export class MaterialUomService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async actor(auth: AuthenticatedUserContext, tx: Tx, manage = false) {
    const session = await tx.userSession.findFirst({
      where: { id: auth.sessionId, userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() }, user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } },
      select: { user: { select: { employee: { select: { companyId: true, isActive: true } }, userRoles: { select: { companyId: true, role: { select: { companyId: true, roleCode: true, isActive: true, rolePermissions: { select: { permission: { select: { permissionCode: true } } } } } } } } } } },
    });
    const employee = session?.user.employee;
    const permissions = session?.user.userRoles.filter(r => r.companyId === auth.companyId && r.role.companyId === auth.companyId && r.role.isActive && r.role.roleCode !== 'SYS_ADMIN').flatMap(r => r.role.rolePermissions.map(p => p.permission.permissionCode)) ?? [];
    const required = [MATERIAL_UOM_VIEW, ...(manage ? ['master.material.manage', MATERIAL_UOM_MANAGE] : [])];
    if (!session || !employee?.isActive || employee.companyId !== auth.companyId || !required.every(p => permissions.includes(p) && auth.permissions.includes(p))) throw new ForbiddenException({ code: 'MATERIAL_UOM_AUTHORITY_DENIED' });
  }

  private async material(auth: AuthenticatedUserContext, id: string, tx: Tx, active = false) {
    const row = await tx.material.findFirst({ where: { id, companyId: auth.companyId }, select: { id: true, materialCode: true, materialName: true, isActive: true } });
    if (!row) throw new NotFoundException({ code: 'MATERIAL_UOM_NOT_FOUND' });
    if (active && !row.isActive) return uomInvalid('materialId', 'MATERIAL_UOM_REFERENCE_INVALID');
    return row;
  }

  private async unit(auth: AuthenticatedUserContext, id: string, tx: Tx) {
    const unit = await tx.unitOfMeasure.findFirst({ where: { id, companyId: auth.companyId, isActive: true } });
    if (!unit) return uomInvalid('uomId', 'MATERIAL_UOM_REFERENCE_INVALID');
    return unit;
  }

  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) try {
      return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code)))) { if (attempt < 2) continue; conflict('MATERIAL_UOM_RETRY_REQUIRED'); }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') conflict('MATERIAL_UOM_VERSION_CONFLICT');
      throw materialUomException(error) ?? error;
    }
    return conflict('MATERIAL_UOM_RETRY_REQUIRED');
  }

  async get(auth: AuthenticatedUserContext, materialId: string, before?: string) {
    materialId = uomId(materialId, 'materialId');
    const cursor = before === undefined ? undefined : /^\d+$/.test(before) ? uomVersion(Number(before)) : uomInvalid('before');
    return this.transaction(async tx => {
      await this.actor(auth, tx);
      const material = await this.material(auth, materialId, tx);
      const basis = await tx.materialUomBasis.findUnique({ where: { materialId }, select: { materialId: true, stockUomId: true, stockPrecision: true, stockUomCode: true, stockUomName: true, version: true, reason: true, createdAt: true, createdByUserId: true } });
      const revisions = basis ? await tx.materialUomRevision.findMany({ where: { companyId: auth.companyId, materialId, ...(cursor ? { revisionNo: { lt: cursor } } : {}) }, orderBy: { revisionNo: 'desc' }, take: 26,
        select: { id: true, revisionNo: true, sourceUomId: true, sourcePrecision: true, sourceUomCode: true, sourceUomName: true, numerator: true, denominator: true, effectiveFrom: true, reason: true, createdAt: true, createdByUserId: true } }) : [];
      return { material, state: basis ? 'PREPARED' : 'NOT_PREPARED', inventoryConversionEnabled: false, basis, revisions: revisions.slice(0, 25).map(r => ({ ...r, effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10) })), nextBefore: revisions.length > 25 ? revisions[24]!.revisionNo : null };
    });
  }

  private operation(context: Context, materialId: string, action: 'PREPARE' | 'REVISE', input: ReturnType<typeof uomPrepare> | ReturnType<typeof uomRevise>, work: (tx: Tx, operationId: string) => Promise<{ materialId: string; version: number; revisionId: string | null }>) {
    return this.transaction(async tx => {
      const auth = context.auth;
      await this.actor(auth, tx, true);
      await this.material(auth, materialId, tx, true);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom-key', auth.companyId, auth.userId, input.requestKey].join(':')},0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom', auth.companyId, materialId].join(':')},0))`;
      // Current active references are required even on a successful response-loss retry.
      await this.unit(auth, 'stockUomId' in input ? input.stockUomId : input.sourceUomId, tx);
      const basis = await tx.materialUomBasis.findUnique({ where: { materialId } });
      if (basis) await this.unit(auth, basis.stockUomId, tx);
      const prior = await tx.materialUomOperation.findUnique({ where: { companyId_actorUserId_requestKey: { companyId: auth.companyId, actorUserId: auth.userId, requestKey: input.requestKey } } });
      if (prior) {
        if (prior.materialId !== materialId || prior.action !== action || !isDeepStrictEqual(prior.input, input)) return conflict('MATERIAL_UOM_REPLAY_CONFLICT');
        return prior.outcome;
      }
      const operationId = randomUUID(), outcome = await work(tx, operationId);
      // Preserve the exact PostgreSQL transaction clock, including microseconds.
      // Prisma supplies JS millisecond timestamps for @default(now()) on create.
      await tx.$executeRaw`INSERT INTO material_uom_operations(id,company_id,actor_user_id,session_id,request_key,action,material_id,input,outcome)
        VALUES(${operationId}::uuid,${auth.companyId}::uuid,${auth.userId}::uuid,${auth.sessionId}::uuid,${input.requestKey}::uuid,${action},${materialId}::uuid,${JSON.stringify(input)}::jsonb,${JSON.stringify(outcome)}::jsonb)`;
      await this.audit.record({ ...context, entityType: 'MATERIAL_UOM', entityId: materialId, action, newValues: outcome }, tx);
      return outcome;
    });
  }

  async prepare(context: Context, materialId: string, value: unknown) {
    materialId = uomId(materialId, 'materialId'); const input = uomPrepare(value);
    return this.operation(context, materialId, 'PREPARE', input, async (tx, operationId) => {
      if (await tx.materialUomBasis.findUnique({ where: { materialId } })) return conflict('MATERIAL_UOM_BASIS_PINNED');
      const unit = await this.unit(context.auth, input.stockUomId, tx);
      if (unit.decimalPlaces > 4) return uomInvalid('stockUomId', 'MATERIAL_UOM_STOCK_PRECISION');
      await tx.$executeRaw`INSERT INTO material_uom_bases(material_id,company_id,stock_uom_id,stock_precision,stock_uom_code,stock_uom_name,created_by_user_id,session_id,operation_id,reason)
        VALUES(${materialId}::uuid,${context.auth.companyId}::uuid,${unit.id}::uuid,${unit.decimalPlaces},${unit.uomCode},${unit.uomName},${context.auth.userId}::uuid,${context.auth.sessionId}::uuid,${operationId}::uuid,${input.reason})`;
      return { materialId, version: 1, revisionId: null };
    });
  }

  async revise(context: Context, materialId: string, value: unknown) {
    materialId = uomId(materialId, 'materialId'); const input = uomRevise(value);
    return this.operation(context, materialId, 'REVISE', input, async (tx, operationId) => {
      const basis = await tx.materialUomBasis.findUnique({ where: { materialId } });
      if (!basis || basis.version !== input.expectedVersion) return conflict();
      if (basis.stockUomId === input.sourceUomId) return uomInvalid('sourceUomId', 'MATERIAL_UOM_IDENTITY_FIXED');
      const unit = await this.unit(context.auth, input.sourceUomId, tx);
      const revisionId = randomUUID(), version = basis.version + 1;
      await tx.$executeRaw`INSERT INTO material_uom_revisions(id,company_id,material_id,source_uom_id,source_precision,source_uom_code,source_uom_name,effective_from,numerator,denominator,revision_no,created_by_user_id,session_id,operation_id,reason)
        VALUES(${revisionId}::uuid,${context.auth.companyId}::uuid,${materialId}::uuid,${unit.id}::uuid,${unit.decimalPlaces},${unit.uomCode},${unit.uomName},${input.effectiveFrom}::date,${input.numerator},${input.denominator},${version},${context.auth.userId}::uuid,${context.auth.sessionId}::uuid,${operationId}::uuid,${input.reason})`;
      return { materialId, version, revisionId };
    });
  }

  async preview(auth: AuthenticatedUserContext, materialId: string, value: unknown) {
    materialId = uomId(materialId, 'materialId'); const input = uomPreview(value);
    return this.transaction(async tx => {
      await this.actor(auth, tx);
      await this.material(auth, materialId, tx, true);
      // Stage B's shared DB-backed selector is also used by operational source
      // freezing. A preview remains read-only, with no stock activation.
      const pin = await resolveMaterialUomStock(tx, {
        companyId: auth.companyId, materialId, sourceUomId: input.sourceUomId,
        businessDate: input.businessDate, quantity: input.quantity,
      });
      if (!pin) return uomInvalid('materialId', 'MATERIAL_UOM_BASIS_REQUIRED');
      return {
        materialId, basisVersion: pin.basisVersion, state: 'PREVIEW_ONLY',
        inventoryConversionEnabled: false, businessDate: pin.businessDate,
        revisionId: pin.revisionId, effectiveFrom: pin.effectiveFrom,
        numerator: pin.numerator, denominator: pin.denominator,
        sourceUomId: pin.sourceUomId, sourceUomCode: pin.sourceUomCode,
        stockUomId: pin.stockUomId, stockUomCode: pin.stockUomCode,
        enteredQuantity: pin.enteredQuantity, stockQuantity: pin.stockQuantity,
      };
    });
  }
}
