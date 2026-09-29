import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  normalizeResetRule,
  NumberSequenceService,
  validateFormatTemplate,
} from './number-sequence.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numberSequences: NumberSequenceService,
  ) {}

  getCompany(companyId: string) {
    return this.prisma.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        id: true,
        companyCode: true,
        companyName: true,
        baseCurrencyCode: true,
        isActive: true,
      },
    });
  }

  async updateCompany(
    context: AuditContext,
    data: {
      companyCode?: string;
      companyName?: string;
      baseCurrencyCode?: string;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await this.getCompanyWithClient(
          tx,
          context.auth.companyId,
        );
        const after = await tx.company.update({
          where: { id: context.auth.companyId },
          data,
          select: {
            id: true,
            companyCode: true,
            companyName: true,
            baseCurrencyCode: true,
            isActive: true,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'COMPANY',
            entityId: after.id,
            action: 'UPDATE_SETTINGS',
            oldValues: before,
            newValues: after,
          },
          tx,
        );

        return after;
      });
    } catch (error) {
      this.throwIfUniqueConflict(error, 'Company code is already in use.');
      throw error;
    }
  }

  listStatuses(companyId: string, entityType?: string) {
    return this.prisma.statusDefinition.findMany({
      where: {
        companyId,
        ...(entityType ? { entityType } : {}),
      },
      orderBy: [
        { entityType: 'asc' },
        { sortOrder: 'asc' },
        { statusCode: 'asc' },
      ],
    });
  }

  async createStatus(
    context: AuditContext,
    data: {
      entityType: string;
      statusCode: string;
      statusLabel: string;
      sortOrder: number;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.statusDefinition.create({
          data: { companyId: context.auth.companyId, ...data },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'STATUS_DEFINITION',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );

        return created;
      });
    } catch (error) {
      this.throwIfUniqueConflict(
        error,
        'This status code already exists for the selected entity type.',
      );
      throw error;
    }
  }

  async updateStatus(
    context: AuditContext,
    id: string,
    data: {
      statusLabel?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.statusDefinition.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('Status definition');

      const after = await tx.statusDefinition.update({
        where: { id },
        data,
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'STATUS_DEFINITION',
          entityId: id,
          action: 'UPDATE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );

      return after;
    });
  }

  listNumberSequences(companyId: string) {
    return this.prisma.numberSequence.findMany({
      where: { companyId },
      orderBy: { sequenceCode: 'asc' },
    });
  }

  async createNumberSequence(
    context: AuditContext,
    data: {
      entityType: string;
      sequenceCode: string;
      formatTemplate: string;
      resetRule: string;
      startingValue: number;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.numberSequence.create({
          data: {
            companyId: context.auth.companyId,
            entityType: data.entityType,
            sequenceCode: data.sequenceCode,
            formatTemplate: validateFormatTemplate(data.formatTemplate),
            resetRule: normalizeResetRule(data.resetRule),
            nextValue: data.startingValue,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'NUMBER_SEQUENCE',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );

        return created;
      });
    } catch (error) {
      this.throwIfUniqueConflict(
        error,
        'This number-sequence code already exists.',
      );
      throw error;
    }
  }

  async updateNumberSequence(
    context: AuditContext,
    id: string,
    data: {
      formatTemplate?: string;
      resetRule?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.numberSequence.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.notFound('Number sequence');

      this.numberSequences.assertEditable(
        before.nextValue,
        before.lastPeriodKey,
        before.sequenceCode,
      );

      const after = await tx.numberSequence.update({
        where: { id },
        data: {
          ...(data.formatTemplate
            ? { formatTemplate: validateFormatTemplate(data.formatTemplate) }
            : {}),
          ...(data.resetRule
            ? { resetRule: normalizeResetRule(data.resetRule) }
            : {}),
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'NUMBER_SEQUENCE',
          entityId: id,
          action: 'UPDATE',
          oldValues: before,
          newValues: after,
        },
        tx,
      );

      return after;
    });
  }

  listSystemSettings(companyId: string) {
    return this.prisma.systemSetting.findMany({
      where: { companyId },
      orderBy: { settingKey: 'asc' },
    });
  }

  async upsertSystemSetting(
    context: AuditContext,
    settingKey: string,
    settingValue: Prisma.InputJsonValue,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.systemSetting.findUnique({
        where: {
          companyId_settingKey: {
            companyId: context.auth.companyId,
            settingKey,
          },
        },
      });

      const after = await tx.systemSetting.upsert({
        where: {
          companyId_settingKey: {
            companyId: context.auth.companyId,
            settingKey,
          },
        },
        create: {
          companyId: context.auth.companyId,
          settingKey,
          settingValue,
        },
        update: { settingValue },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'SYSTEM_SETTING',
          entityId: after.id,
          action: before ? 'UPDATE' : 'CREATE',
          ...(before ? { oldValues: before } : {}),
          newValues: after,
        },
        tx,
      );

      return after;
    });
  }

  private getCompanyWithClient(
    tx: Prisma.TransactionClient,
    companyId: string,
  ) {
    return tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        id: true,
        companyCode: true,
        companyName: true,
        baseCurrencyCode: true,
        isActive: true,
      },
    });
  }

  private throwIfUniqueConflict(error: unknown, detail: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_ADMIN_CONFIGURATION',
        detail,
      });
    }
  }

  private notFound(entity: string): NotFoundException {
    return new NotFoundException({
      code: 'ADMIN_RECORD_NOT_FOUND',
      detail: entity + ' not found.',
    });
  }
}
