import { createHash } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type SubcontractDb = Prisma.TransactionClient | PrismaService;

export type SubcontractorInput = {
  subcontractorCode: string;
  subcontractorName: string;
  supplierId?: string | null;
  registrationNumber?: string | null;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type AgreementDraftInput = {
  projectId: string;
  subcontractorId: string;
  originalValue: string;
  scopeOfWork: string;
  currencyCode: string;
  retentionRate?: string;
  retentionCap?: string | null;
  operationalStatusId?: string | null;
  createKey?: string | null;
};

export type AgreementDraftUpdate = Partial<
  Pick<
    AgreementDraftInput,
    'originalValue' | 'scopeOfWork' | 'currencyCode' | 'retentionRate' | 'retentionCap' | 'operationalStatusId'
  >
>;

@Injectable()
export class SubcontractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly numbers: NumberSequenceService,
    private readonly authorization: AuthorizationService,
  ) {}

  listSubcontractors(
    auth: AuthenticatedUserContext,
    filters: { includeInactive?: boolean; search?: string } = {},
  ) {
    const search = filters.search?.trim();
    return this.prisma.subcontractor.findMany({
      where: {
        companyId: auth.companyId,
        ...(filters.includeInactive ? {} : { isActive: true }),
        ...(search
          ? {
              OR: [
                {
                  subcontractorCode: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  subcontractorName: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  registrationNumber: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
            isActive: true,
          },
        },
      },
      orderBy: [{ subcontractorCode: 'asc' }],
    });
  }

  async getSubcontractor(auth: AuthenticatedUserContext, id: string) {
    const row = await this.prisma.subcontractor.findFirst({
      where: { id, companyId: auth.companyId },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
            isActive: true,
          },
        },
      },
    });
    if (!row) throw this.notFound('Subcontractor');
    return row;
  }

  listSuppliers(auth: AuthenticatedUserContext) {
    return this.prisma.supplier.findMany({
      where: { companyId: auth.companyId, isActive: true },
      select: {
        id: true,
        supplierCode: true,
        supplierName: true,
      },
      orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }],
    });
  }

  agreementSubcontractors(auth: AuthenticatedUserContext) {
    return this.prisma.subcontractor.findMany({
      where: { companyId: auth.companyId, isActive: true },
      select: {
        id: true,
        subcontractorCode: true,
        subcontractorName: true,
      },
      orderBy: [
        { subcontractorName: 'asc' },
        { subcontractorCode: 'asc' },
      ],
    });
  }

  async createSubcontractor(context: AuditContext, input: SubcontractorInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertSupplier(context.auth.companyId, input.supplierId, tx);
        const row = await tx.subcontractor.create({
          data: {
            companyId: context.auth.companyId,
            subcontractorCode: input.subcontractorCode,
            subcontractorName: input.subcontractorName,
            supplierId: input.supplierId ?? null,
            registrationNumber: input.registrationNumber ?? null,
            contactName: input.contactName ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            address: input.address ?? null,
          },
          include: {
            supplier: {
              select: {
                id: true,
                supplierCode: true,
                supplierName: true,
                isActive: true,
              },
            },
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACTOR',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwUnique(error, 'Subcontractor code or Supplier link is already in use.');
      throw error;
    }
  }

  async updateSubcontractor(
    context: AuditContext,
    id: string,
    input: Partial<SubcontractorInput>,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.subcontractor(context.auth.companyId, id, tx);
        await this.assertSupplier(context.auth.companyId, input.supplierId, tx);
        const row = await tx.subcontractor.update({
          where: { id },
          data: input,
          include: {
            supplier: {
              select: {
                id: true,
                supplierCode: true,
                supplierName: true,
                isActive: true,
              },
            },
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACTOR',
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
      this.throwUnique(error, 'Subcontractor code or Supplier link is already in use.');
      throw error;
    }
  }

  archiveSubcontractor(context: AuditContext, id: string) {
    return this.setSubcontractorActive(context, id, false);
  }

  reactivateSubcontractor(context: AuditContext, id: string) {
    return this.setSubcontractorActive(context, id, true);
  }

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { AND: [scope, { isActive: true }] },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  statuses(auth: AuthenticatedUserContext) {
    return this.prisma.statusDefinition.findMany({
      where: {
        companyId: auth.companyId,
        entityType: 'SUBCONTRACT_AGREEMENT',
        isActive: true,
      },
      select: { id: true, statusCode: true, statusLabel: true, sortOrder: true },
      orderBy: [{ sortOrder: 'asc' }, { statusCode: 'asc' }],
    });
  }

  async listAgreements(
    auth: AuthenticatedUserContext,
    filters: {
      projectId?: string;
      subcontractorId?: string;
      search?: string;
    } = {},
  ) {
    if (filters.projectId) await this.access.assertAccess(auth, filters.projectId);
    const scope = await this.access.scopeWhere(auth);
    const search = filters.search?.trim();
    return this.prisma.subcontractAgreement.findMany({
      where: {
        companyId: auth.companyId,
        project: scope,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.subcontractorId
          ? { subcontractorId: filters.subcontractorId }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  agreementNumber: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  scopeOfWork: {
                    contains: search,
                    mode: Prisma.QueryMode.insensitive,
                  },
                },
                {
                  subcontractor: {
                    subcontractorName: {
                      contains: search,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              ],
            }
          : {}),
      },
      include: this.agreementInclude(),
      orderBy: [{ createdAt: 'desc' }, { agreementNumber: 'desc' }],
    });
  }

  async getAgreement(auth: AuthenticatedUserContext, id: string) {
    return this.visibleAgreement(auth, id, this.prisma);
  }

  async createAgreement(context: AuditContext, input: AgreementDraftInput) {
    if (input.createKey) {
      const existing = await this.prisma.subcontractAgreement.findFirst({
        where: {
          companyId: context.auth.companyId,
          createdByUserId: context.auth.userId,
          createKey: input.createKey,
        },
        include: this.agreementInclude(),
      });
      if (existing) {
        await this.access.assertAccess(context.auth, existing.projectId);
        this.assertAgreementReplayView(context.auth);
        this.assertAgreementReplayPayload(existing, input);
        return existing;
      }
    }

    await this.access.assertAccess(context.auth, input.projectId);
    await this.assertAgreementReferences(context.auth, input, this.prisma);
    await this.ensureAgreementSequence(context.auth.companyId);
    const agreementNumber = await this.numbers.next(
      context.auth.companyId,
      'SUBCONTRACT_AGREEMENT',
    );

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, input.projectId, tx);
        await this.lockProject(context.auth.companyId, input.projectId, tx);
        await this.lockSubcontractor(
          context.auth.companyId,
          input.subcontractorId,
          tx,
        );
        await this.lockStatus(
          context.auth.companyId,
          input.operationalStatusId,
          tx,
        );
        await this.assertAgreementReferences(context.auth, input, tx);
        const row = await tx.subcontractAgreement.create({
          data: {
            companyId: context.auth.companyId,
            projectId: input.projectId,
            subcontractorId: input.subcontractorId,
            agreementNumber,
            originalValue: input.originalValue,
            scopeOfWork: input.scopeOfWork,
            currencyCode: input.currencyCode,
            retentionRate: input.retentionRate ?? '0.00',
            retentionCap: input.retentionCap ?? null,
            operationalStatusId: input.operationalStatusId ?? null,
            createKey: input.createKey ?? null,
            createPayloadHash: input.createKey
              ? this.agreementCreatePayloadHash(input)
              : null,
            createdByUserId: context.auth.userId,
          },
          include: this.agreementInclude(),
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUBCONTRACT_AGREEMENT',
            entityId: row.id,
            action: 'CREATE_DRAFT',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      if (input.createKey && this.isUnique(error)) {
        const existing = await this.prisma.subcontractAgreement.findFirst({
          where: {
            companyId: context.auth.companyId,
            createdByUserId: context.auth.userId,
            createKey: input.createKey,
          },
          include: this.agreementInclude(),
        });
        if (existing) {
          await this.access.assertAccess(context.auth, existing.projectId);
          this.assertAgreementReplayView(context.auth);
          this.assertAgreementReplayPayload(existing, input);
          return existing;
        }
      }
      this.throwUnique(error, 'Agreement number or create key is already in use.');
      throw error;
    }
  }

  async updateAgreement(
    context: AuditContext,
    id: string,
    input: AgreementDraftUpdate,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.visibleAgreement(context.auth, id, tx);
      if (before.approvalState !== 'DRAFT') {
        throw new ConflictException({
          code: 'AGREEMENT_NOT_DRAFT',
          detail: 'Only a Draft agreement can be edited in Stage A.',
        });
      }
      if (input.operationalStatusId !== undefined) {
        await this.lockStatus(
          context.auth.companyId,
          input.operationalStatusId,
          tx,
        );
        await this.assertStatus(
          context.auth.companyId,
          input.operationalStatusId,
          tx,
        );
      }
      const row = await tx.subcontractAgreement.update({
        where: { id },
        data: input,
        include: this.agreementInclude(),
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACT_AGREEMENT',
          entityId: id,
          action: 'UPDATE_DRAFT',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  private async setSubcontractorActive(
    context: AuditContext,
    id: string,
    active: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockSubcontractor(context.auth.companyId, id, tx);
      const before = await this.subcontractor(context.auth.companyId, id, tx);
      if (before.isActive === active) return before;
      if (active) {
        await this.assertSupplier(
          context.auth.companyId,
          before.supplierId,
          tx,
        );
      }
      const row = await tx.subcontractor.update({
        where: { id },
        data: { isActive: active },
        include: {
          supplier: {
            select: {
              id: true,
              supplierCode: true,
              supplierName: true,
              isActive: true,
            },
          },
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'SUBCONTRACTOR',
          entityId: id,
          action: active ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  private async lockProject(
    companyId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "projects"
        WHERE "id" = ${id}::uuid AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockStatus(
    companyId: string,
    id: string | null | undefined,
    tx: Prisma.TransactionClient,
  ) {
    if (!id) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "status_definitions"
        WHERE "id" = ${id}::uuid AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async lockSubcontractor(
    companyId: string,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id"
        FROM "subcontractors"
        WHERE "id" = ${id}::uuid AND "company_id" = ${companyId}::uuid
        FOR UPDATE`,
    );
  }

  private async subcontractor(
    companyId: string,
    id: string,
    db: SubcontractDb,
  ) {
    const row = await db.subcontractor.findFirst({
      where: { id, companyId },
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            supplierName: true,
            isActive: true,
          },
        },
      },
    });
    if (!row) throw this.notFound('Subcontractor');
    return row;
  }

  private async visibleAgreement(
    auth: AuthenticatedUserContext,
    id: string,
    db: SubcontractDb,
  ) {
    const scope = await this.access.scopeWhere(auth, db);
    const row = await db.subcontractAgreement.findFirst({
      where: { id, companyId: auth.companyId, project: scope },
      include: this.agreementInclude(),
    });
    if (row) return row;

    const exists = await db.subcontractAgreement.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true },
    });
    if (!exists) throw this.notFound('Subcontract agreement');
    throw new ForbiddenException({
      code: 'PROJECT_ACCESS_DENIED',
      detail: 'You do not have access to this agreement Project.',
    });
  }

  private async assertSupplier(
    companyId: string,
    supplierId: string | null | undefined,
    db: SubcontractDb,
  ) {
    if (!supplierId) return;
    const supplier = await db.supplier.findFirst({
      where: { id: supplierId, companyId, isActive: true },
      select: { id: true },
    });
    if (!supplier) {
      throw new UnprocessableEntityException({
        code: 'INVALID_SUPPLIER',
        detail: 'Supplier must be active and belong to the same Company.',
      });
    }
  }

  private async assertAgreementReferences(
    auth: AuthenticatedUserContext,
    input: AgreementDraftInput,
    db: SubcontractDb,
  ) {
    const project = await db.project.findFirst({
      where: {
        id: input.projectId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!project) {
      throw new UnprocessableEntityException({
        code: 'INVALID_PROJECT',
        detail: 'Project must be active and belong to the same Company.',
      });
    }
    const subcontractor = await db.subcontractor.findFirst({
      where: {
        id: input.subcontractorId,
        companyId: auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!subcontractor) {
      throw new UnprocessableEntityException({
        code: 'INVALID_SUBCONTRACTOR',
        detail: 'Subcontractor must be active and belong to the same Company.',
      });
    }
    await this.assertStatus(
      auth.companyId,
      input.operationalStatusId,
      db,
    );
  }

  private async assertStatus(
    companyId: string,
    statusId: string | null | undefined,
    db: SubcontractDb,
  ) {
    if (!statusId) return;
    const status = await db.statusDefinition.findFirst({
      where: {
        id: statusId,
        companyId,
        entityType: 'SUBCONTRACT_AGREEMENT',
        isActive: true,
      },
      select: { id: true },
    });
    if (!status) {
      throw new UnprocessableEntityException({
        code: 'INVALID_AGREEMENT_STATUS',
        detail:
          'Operational status must be an active SUBCONTRACT_AGREEMENT status in the same Company.',
      });
    }
  }

  private async ensureAgreementSequence(companyId: string) {
    await this.prisma.numberSequence.upsert({
      where: {
        companyId_sequenceCode: {
          companyId,
          sequenceCode: 'SUBCONTRACT_AGREEMENT',
        },
      },
      create: {
        companyId,
        entityType: 'SUBCONTRACT_AGREEMENT',
        sequenceCode: 'SUBCONTRACT_AGREEMENT',
        formatTemplate: 'SCYYMM-###',
        resetRule: 'MONTHLY',
        nextValue: 1,
      },
      update: {},
    });
  }

  private agreementInclude() {
    return {
      project: {
        select: { id: true, projectCode: true, projectName: true },
      },
      subcontractor: {
        select: {
          id: true,
          subcontractorCode: true,
          subcontractorName: true,
          isActive: true,
        },
      },
      operationalStatus: {
        select: { id: true, statusCode: true, statusLabel: true },
      },
      createdBy: {
        select: { id: true, displayName: true },
      },
    } satisfies Prisma.SubcontractAgreementInclude;
  }

  private agreementCreatePayloadHash(input: AgreementDraftInput): string {
    const canonicalPayload = JSON.stringify([
      input.projectId.toLowerCase(),
      input.subcontractorId.toLowerCase(),
      new Prisma.Decimal(input.originalValue).toFixed(2),
      input.scopeOfWork,
      input.currencyCode,
      new Prisma.Decimal(input.retentionRate ?? '0.00').toFixed(2),
      input.retentionCap === null || input.retentionCap === undefined
        ? null
        : new Prisma.Decimal(input.retentionCap).toFixed(2),
      input.operationalStatusId?.toLowerCase() ?? null,
    ]);
    return createHash('sha256').update(canonicalPayload).digest('hex');
  }

  private assertAgreementReplayPayload(
    existing: { createPayloadHash: string | null },
    input: AgreementDraftInput,
  ): void {
    if (
      !existing.createPayloadHash ||
      existing.createPayloadHash !== this.agreementCreatePayloadHash(input)
    ) {
      throw new ConflictException({
        code: 'IDEMPOTENCY_KEY_REUSED',
        detail:
          'The create key is already bound to a different agreement payload.',
      });
    }
  }

  private assertAgreementReplayView(auth: AuthenticatedUserContext): void {
    if (
      !this.authorization.hasPermission(
        auth,
        'subcontracts.agreement.view',
      )
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        detail:
          'Agreement view permission is required to return an existing create-key result.',
      });
    }
  }

  private throwUnique(error: unknown, detail: string): void {
    if (!this.isUnique(error)) return;
    throw new ConflictException({ code: 'DUPLICATE_RECORD', detail });
  }

  private isUnique(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private notFound(entity: string) {
    return new NotFoundException({
      code: 'NOT_FOUND',
      detail: entity + ' not found.',
    });
  }
}
