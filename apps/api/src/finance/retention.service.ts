import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

@Injectable()
export class RetentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: scope,
      select: { id: true, projectCode: true, projectName: true, isActive: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async list(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const company = await this.prisma.company.findUniqueOrThrow({
      where: { id: auth.companyId },
      select: { baseCurrencyCode: true },
    });
    const certifications = await this.prisma.subcontractCertification.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        state: { in: ['APPROVED', 'REVERSED'] },
        retainedAmount: { gt: 0 },
      },
      select: {
        id: true,
        certificationNumber: true,
        currencyCode: true,
        state: true,
        retainedAmount: true,
        netCertifiedAmount: true,
        approvedAt: true,
        reversedAt: true,
        reversalReason: true,
        agreement: {
          select: {
            id: true,
            agreementNumber: true,
            subcontractor: {
              select: {
                id: true,
                subcontractorCode: true,
                subcontractorName: true,
              },
            },
          },
        },
        retentionLedgerEntries: {
          orderBy: [{ recordedAt: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            entryType: true,
            amount: true,
            currencyCode: true,
            reversesEntryId: true,
            recordedAt: true,
            recordedBy: { select: { id: true, displayName: true } },
          },
        },
      },
      orderBy: [{ approvedAt: 'asc' }, { certificationNumber: 'asc' }],
    });

    return certifications.map((certification) => {
      const hasLedgerEvidence =
        certification.retentionLedgerEntries.length > 0;
      const supported =
        hasLedgerEvidence ||
        certification.currencyCode === company.baseCurrencyCode;
      const retentionBalance = certification.retentionLedgerEntries.reduce(
        (balance, entry) =>
          entry.entryType === 'WITHHOLDING'
            ? balance.plus(entry.amount)
            : balance.minus(entry.amount),
        new Prisma.Decimal(0),
      );
      const financeState = !supported
        ? 'UNSUPPORTED_CURRENCY'
        : certification.retentionLedgerEntries.length === 0
          ? 'MISSING_EVIDENCE'
          : retentionBalance.eq(0)
            ? 'REVERSED'
            : 'ACTIVE';

      return {
        ...certification,
        baseCurrencyCode: company.baseCurrencyCode,
        financeState,
        retentionBalance: supported ? retentionBalance : null,
      };
    });
  }
}
