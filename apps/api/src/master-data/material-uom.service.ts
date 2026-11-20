import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { exactUomQuantity, MATERIAL_UOM_MANAGE, MATERIAL_UOM_VIEW, uomActivate, uomId, uomInvalid, uomPrepare, uomPreview, uomRevise, uomVersion } from './material-uom-contract';
import { materialUomException } from './material-uom-errors';

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
      const activation = basis ? await tx.materialUomActivation.findUnique({where:{materialId},select:{createdAt:true,basisVersion:true}}) : null;
      return { material, state: basis ? 'PREPARED' : 'NOT_PREPARED', inventoryConversionEnabled: Boolean(activation), activation, basis, revisions: revisions.slice(0, 25).map(r => ({ ...r, effectiveFrom: r.effectiveFrom.toISOString().slice(0, 10) })), nextBefore: revisions.length > 25 ? revisions[24]!.revisionNo : null };
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

  // Explicit Stage B activation. Existing material and conversion maintenance
  // rights are revalidated; a prepared definition never activates by itself.
  async activateStock(context: Context, materialId: string, value: unknown) {
    materialId = uomId(materialId, 'materialId'); const input = uomActivate(value);
    return this.transaction(async tx => {
      const auth = context.auth;
      await this.actor(auth, tx, true);
      await this.material(auth, materialId, tx, true);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom-key',auth.companyId,auth.userId,input.requestKey].join(':')},0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-uom',auth.companyId,materialId].join(':')},0))`;
      const basis = await tx.materialUomBasis.findUnique({where:{materialId}});
      if (!basis || basis.companyId !== auth.companyId) return conflict('MATERIAL_UOM_BASIS_REQUIRED');
      await this.unit(auth,basis.stockUomId,tx);
      const prior = await tx.materialUomActivation.findUnique({where:{companyId_actorUserId_requestKey:{companyId:auth.companyId,actorUserId:auth.userId,requestKey:input.requestKey}}});
      const outcome = (row: { materialId: string; stockUomId: string; basisVersion: number }) => ({materialId:row.materialId,stockUomId:row.stockUomId,basisVersion:row.basisVersion,inventoryConversionEnabled:true});
      if (prior) {
        if (prior.materialId !== materialId || prior.basisVersion !== input.expectedVersion || prior.reason !== input.reason) return conflict('MATERIAL_UOM_REPLAY_CONFLICT');
        return outcome(prior);
      }
      if (basis.version !== input.expectedVersion) return conflict('MATERIAL_UOM_ACTIVATION_VERSION_CONFLICT');
      if (await tx.materialUomActivation.findUnique({where:{materialId}})) return conflict('MATERIAL_UOM_ALREADY_ACTIVATED');
      // The SQL guard independently checks all historical and open sources,
      // current authority, exact basis version and the transaction clock.
      await tx.$executeRaw`INSERT INTO material_uom_activations(material_id,company_id,stock_uom_id,basis_version,actor_user_id,session_id,request_key,reason)
        VALUES(${materialId}::uuid,${auth.companyId}::uuid,${basis.stockUomId}::uuid,${basis.version},${auth.userId}::uuid,${auth.sessionId}::uuid,${input.requestKey}::uuid,${input.reason})`;
      const result = outcome({materialId,stockUomId:basis.stockUomId,basisVersion:basis.version});
      await this.audit.record({...context,entityType:'MATERIAL_UOM',entityId:materialId,action:'ACTIVATE_STOCK',newValues:result},tx);
      return result;
    });
  }

  async preview(auth: AuthenticatedUserContext, materialId: string, value: unknown) {
    materialId = uomId(materialId, 'materialId'); const input = uomPreview(value);
    return this.transaction(async tx => {
      await this.actor(auth, tx); await this.material(auth, materialId, tx, true);
      const basis = await tx.materialUomBasis.findUnique({ where: { materialId } });
      if (!basis) return uomInvalid('materialId', 'MATERIAL_UOM_BASIS_REQUIRED');
      await this.unit(auth, basis.stockUomId, tx); await this.unit(auth, input.sourceUomId, tx);
      const revision = input.sourceUomId === basis.stockUomId ? null : await tx.materialUomRevision.findFirst({ where: { companyId: auth.companyId, materialId, sourceUomId: input.sourceUomId, effectiveFrom: { lte: new Date(input.businessDate + 'T00:00:00.000Z') } }, orderBy: [{ effectiveFrom: 'desc' }, { revisionNo: 'desc' }] });
      if (!revision && input.sourceUomId !== basis.stockUomId) return uomInvalid('businessDate', 'MATERIAL_UOM_DEFINITION_REQUIRED');
      const numerator = revision?.numerator ?? '1', denominator = revision?.denominator ?? '1';
      const activation = await tx.materialUomActivation.findUnique({where:{materialId},select:{materialId:true}});
      return { materialId, basisVersion: basis.version, state: 'PREVIEW_ONLY', inventoryConversionEnabled: Boolean(activation), businessDate: input.businessDate, revisionId: revision?.id ?? null, effectiveFrom: revision?.effectiveFrom.toISOString().slice(0, 10) ?? null, numerator, denominator,
        sourceUomId: input.sourceUomId, sourceUomCode: revision?.sourceUomCode ?? basis.stockUomCode, stockUomId: basis.stockUomId, stockUomCode: basis.stockUomCode,
        ...exactUomQuantity(input.quantity, revision?.sourcePrecision ?? basis.stockPrecision, basis.stockPrecision, numerator, denominator) };
    });
  }
}
