import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { UploadedDocumentFile } from '../documents/document-policy.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

export type SiteManpowerInput = {
  tradeRole: string;
  headcount: number;
  remarks?: string | null;
};

export type SiteMaterialUsageInput = {
  materialId: string;
  uomId: string;
  quantity: Prisma.Decimal;
  activityId?: string | null;
  wbsId?: string | null;
  remarks?: string | null;
};

export type SiteProgressInput = {
  activityId: string;
  percentComplete: Prisma.Decimal;
  note?: string | null;
};

export type SiteIssueInput = {
  activityId?: string | null;
  issueText: string;
  remarks?: string | null;
};

export type SiteDelayInput = {
  activityId?: string | null;
  delayReason: string;
  remarks?: string | null;
};

export type SiteInspectionInput = {
  activityId?: string | null;
  inspectionReference?: string | null;
  remarks?: string | null;
};

export type DailySiteReportCreateInput = {
  projectId: string;
  reportDate: Date;
  weatherObservation?: string | null;
  generalRemarks?: string | null;
  manpower: SiteManpowerInput[];
  materialUsage: SiteMaterialUsageInput[];
  progress: SiteProgressInput[];
  issues: SiteIssueInput[];
  delays: SiteDelayInput[];
  inspections: SiteInspectionInput[];
};

export type DailySiteReportUpdateInput = {
  reportDate?: Date;
  weatherObservation?: string | null;
  generalRemarks?: string | null;
  manpower?: SiteManpowerInput[];
  materialUsage?: SiteMaterialUsageInput[];
  progress?: SiteProgressInput[];
  issues?: SiteIssueInput[];
  delays?: SiteDelayInput[];
  inspections?: SiteInspectionInput[];
};

@Injectable()
export class SiteExecutionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { ...scope, isActive: true },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);

    const [activities, wbs, materials, uoms, documentTypes] =
      await Promise.all([
        this.prisma.activity.findMany({
          where: {
            companyId: auth.companyId,
            projectId,
            isActive: true,
          },
          select: {
            id: true,
            activityCode: true,
            activityName: true,
            wbsId: true,
            isSummary: true,
            isMilestone: true,
          },
          orderBy: { activityCode: 'asc' },
        }),
        this.prisma.wbsElement.findMany({
          where: { projectId, isActive: true },
          select: { id: true, wbsCode: true, wbsName: true },
          orderBy: { wbsCode: 'asc' },
        }),
        this.prisma.material.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: {
            id: true,
            materialCode: true,
            materialName: true,
            defaultUomId: true,
          },
          orderBy: { materialCode: 'asc' },
        }),
        this.prisma.unitOfMeasure.findMany({
          where: { companyId: auth.companyId, isActive: true },
          select: {
            id: true,
            uomCode: true,
            uomName: true,
            decimalPlaces: true,
          },
          orderBy: { uomCode: 'asc' },
        }),
        this.documents.typeOptions(auth),
      ]);

    return {
      activities,
      wbs,
      materials,
      uoms,
      documentTypes,
      equipmentIntegration: {
        available: false,
        targetStage: 'V0.2-F',
        message:
          'Equipment usage will reference the canonical Equipment Register when V0.2-F is implemented.',
      },
    };
  }

  async list(
    auth: AuthenticatedUserContext,
    projectId: string,
    from?: Date,
    to?: Date,
  ) {
    await this.access.assertAccess(auth, projectId);
    const rows = await this.prisma.dailySiteReport.findMany({
      where: {
        companyId: auth.companyId,
        projectId,
        ...(from || to
          ? {
              reportDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      include: {
        createdBy: { select: { id: true, displayName: true } },
        submittedBy: { select: { id: true, displayName: true } },
        manpowerLines: { select: { headcount: true } },
        _count: {
          select: {
            materialUsage: true,
            progressLines: true,
            issues: true,
            delays: true,
            inspections: true,
            corrections: true,
          },
        },
      },
      orderBy: [{ reportDate: 'desc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => ({
      ...row,
      totalManpower: row.manpowerLines.reduce(
        (total, line) => total + line.headcount,
        0,
      ),
      manpowerLines: undefined,
    }));
  }

  async get(auth: AuthenticatedUserContext, id: string) {
    const report = await this.prisma.dailySiteReport.findFirst({
      where: { id, companyId: auth.companyId },
      include: this.detailInclude(),
    });
    if (!report) throw this.notFound();
    await this.access.assertAccess(auth, report.projectId);

    const correctionIds = report.corrections.map((row) => row.id);
    const correctionProgress = correctionIds.length
      ? await this.prisma.activityProgress.findMany({
          where: {
            companyId: auth.companyId,
            sourceType: 'DAILY_SITE_REPORT_CORRECTION',
            sourceEntityId: { in: correctionIds },
          },
          include: {
            activity: {
              select: {
                id: true,
                activityCode: true,
                activityName: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        })
      : [];
    const progressByCorrection = new Map<string, typeof correctionProgress>();
    for (const progress of correctionProgress) {
      if (!progress.sourceEntityId) continue;
      const rows = progressByCorrection.get(progress.sourceEntityId) ?? [];
      rows.push(progress);
      progressByCorrection.set(progress.sourceEntityId, rows);
    }

    return {
      ...report,
      corrections: report.corrections.map((correction) => ({
        ...correction,
        progressCorrections:
          progressByCorrection.get(correction.id) ?? [],
      })),
      totalManpower: report.manpowerLines.reduce(
        (total, line) => total + line.headcount,
        0,
      ),
    };
  }

  async create(
    context: AuditContext,
    input: DailySiteReportCreateInput,
  ) {
    try {
      const id = await this.prisma.$transaction(async (tx) => {
        await this.access.assertAccess(context.auth, input.projectId, tx);
        await this.validateReferences(
          tx,
          context.auth.companyId,
          input.projectId,
          input,
        );

        const report = await tx.dailySiteReport.create({
          data: {
            companyId: context.auth.companyId,
            projectId: input.projectId,
            reportDate: input.reportDate,
            ...(input.weatherObservation !== undefined
              ? { weatherObservation: input.weatherObservation }
              : {}),
            ...(input.generalRemarks !== undefined
              ? { generalRemarks: input.generalRemarks }
              : {}),
            createdByUserId: context.auth.userId,
            manpowerLines: {
              create: input.manpower.map((line) => ({
                tradeRole: line.tradeRole,
                headcount: line.headcount,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            },
            materialUsage: {
              create: input.materialUsage.map((line) => ({
                materialId: line.materialId,
                uomId: line.uomId,
                quantity: line.quantity,
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                ...(line.wbsId !== undefined
                  ? { wbsId: line.wbsId }
                  : {}),
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            },
            progressLines: {
              create: input.progress.map((line) => ({
                activityId: line.activityId,
                percentComplete: line.percentComplete,
                ...(line.note !== undefined ? { note: line.note } : {}),
              })),
            },
            issues: {
              create: input.issues.map((line) => ({
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                issueText: line.issueText,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            },
            delays: {
              create: input.delays.map((line) => ({
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                delayReason: line.delayReason,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            },
            inspections: {
              create: input.inspections.map((line) => ({
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                ...(line.inspectionReference !== undefined
                  ? { inspectionReference: line.inspectionReference }
                  : {}),
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            },
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'DAILY_SITE_REPORT',
            entityId: report.id,
            action: 'CREATE',
            newValues: {
              projectId: report.projectId,
              reportDate: report.reportDate,
              status: report.status,
            },
          },
          tx,
        );
        return report.id;
      });

      return this.get(context.auth, id);
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async update(
    context: AuditContext,
    id: string,
    input: DailySiteReportUpdateInput,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const before = await tx.dailySiteReport.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound();
        await this.access.assertAccess(context.auth, before.projectId, tx);
        this.assertDraft(before.status);

        await this.validateReferences(
          tx,
          context.auth.companyId,
          before.projectId,
          {
            manpower: input.manpower ?? [],
            materialUsage: input.materialUsage ?? [],
            progress: input.progress ?? [],
            issues: input.issues ?? [],
            delays: input.delays ?? [],
            inspections: input.inspections ?? [],
          },
        );

        if (input.manpower !== undefined) {
          await tx.dailySiteReportManpower.deleteMany({
            where: { reportId: id },
          });
          if (input.manpower.length) {
            await tx.dailySiteReportManpower.createMany({
              data: input.manpower.map((line) => ({
                reportId: id,
                tradeRole: line.tradeRole,
                headcount: line.headcount,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            });
          }
        }

        if (input.materialUsage !== undefined) {
          await tx.dailySiteReportMaterialUsage.deleteMany({
            where: { reportId: id },
          });
          if (input.materialUsage.length) {
            await tx.dailySiteReportMaterialUsage.createMany({
              data: input.materialUsage.map((line) => ({
                reportId: id,
                materialId: line.materialId,
                uomId: line.uomId,
                quantity: line.quantity,
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                ...(line.wbsId !== undefined
                  ? { wbsId: line.wbsId }
                  : {}),
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            });
          }
        }

        if (input.progress !== undefined) {
          await tx.dailySiteReportProgressLine.deleteMany({
            where: { reportId: id },
          });
          if (input.progress.length) {
            await tx.dailySiteReportProgressLine.createMany({
              data: input.progress.map((line) => ({
                reportId: id,
                activityId: line.activityId,
                percentComplete: line.percentComplete,
                ...(line.note !== undefined ? { note: line.note } : {}),
              })),
            });
          }
        }

        if (input.issues !== undefined) {
          await tx.dailySiteReportIssue.deleteMany({ where: { reportId: id } });
          if (input.issues.length) {
            await tx.dailySiteReportIssue.createMany({
              data: input.issues.map((line) => ({
                reportId: id,
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                issueText: line.issueText,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            });
          }
        }

        if (input.delays !== undefined) {
          await tx.dailySiteReportDelay.deleteMany({ where: { reportId: id } });
          if (input.delays.length) {
            await tx.dailySiteReportDelay.createMany({
              data: input.delays.map((line) => ({
                reportId: id,
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                delayReason: line.delayReason,
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            });
          }
        }

        if (input.inspections !== undefined) {
          await tx.dailySiteReportInspection.deleteMany({
            where: { reportId: id },
          });
          if (input.inspections.length) {
            await tx.dailySiteReportInspection.createMany({
              data: input.inspections.map((line) => ({
                reportId: id,
                ...(line.activityId !== undefined
                  ? { activityId: line.activityId }
                  : {}),
                ...(line.inspectionReference !== undefined
                  ? { inspectionReference: line.inspectionReference }
                  : {}),
                ...(line.remarks !== undefined
                  ? { remarks: line.remarks }
                  : {}),
              })),
            });
          }
        }

        const updated = await tx.dailySiteReport.update({
          where: { id },
          data: {
            ...(input.reportDate !== undefined
              ? { reportDate: input.reportDate }
              : {}),
            ...(input.weatherObservation !== undefined
              ? { weatherObservation: input.weatherObservation }
              : {}),
            ...(input.generalRemarks !== undefined
              ? { generalRemarks: input.generalRemarks }
              : {}),
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'DAILY_SITE_REPORT',
            entityId: id,
            action: 'UPDATE',
            oldValues: {
              reportDate: before.reportDate,
              weatherObservation: before.weatherObservation,
              generalRemarks: before.generalRemarks,
            },
            newValues: {
              reportDate: updated.reportDate,
              weatherObservation: updated.weatherObservation,
              generalRemarks: updated.generalRemarks,
            },
          },
          tx,
        );
      });

      return this.get(context.auth, id);
    } catch (error) {
      this.throwDuplicate(error);
      throw error;
    }
  }

  async submit(context: AuditContext, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const report = await tx.dailySiteReport.findFirst({
        where: { id, companyId: context.auth.companyId },
        include: { progressLines: true },
      });
      if (!report) throw this.notFound();
      await this.access.assertAccess(context.auth, report.projectId, tx);
      this.assertDraft(report.status);

      for (const line of report.progressLines) {
        const progress = await tx.activityProgress.create({
          data: {
            companyId: context.auth.companyId,
            projectId: report.projectId,
            activityId: line.activityId,
            progressDate: report.reportDate,
            percentComplete: line.percentComplete,
            note: line.note,
            sourceType: 'DAILY_SITE_REPORT',
            sourceEntityId: report.id,
            recordedByUserId: context.auth.userId,
          },
        });

        await tx.dailySiteReportProgressLine.update({
          where: { id: line.id },
          data: { activityProgressId: progress.id },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY_PROGRESS',
            entityId: progress.id,
            action: 'CREATE',
            newValues: {
              projectId: report.projectId,
              activityId: line.activityId,
              progressDate: report.reportDate,
              percentComplete: line.percentComplete,
              sourceType: 'DAILY_SITE_REPORT',
              sourceEntityId: report.id,
            },
          },
          tx,
        );
      }

      const submitted = await tx.dailySiteReport.update({
        where: { id },
        data: {
          status: 'SUBMITTED',
          submittedByUserId: context.auth.userId,
          submittedAt: new Date(),
        },
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'DAILY_SITE_REPORT',
          entityId: id,
          action: 'SUBMIT',
          oldValues: { status: report.status },
          newValues: {
            status: submitted.status,
            submittedByUserId: submitted.submittedByUserId,
            submittedAt: submitted.submittedAt,
          },
        },
        tx,
      );
    });

    return this.get(context.auth, id);
  }

  async addCorrection(
    context: AuditContext,
    id: string,
    correctionNote: string,
    progressCorrections: SiteProgressInput[] = [],
  ) {
    const correctionId = await this.prisma.$transaction(async (tx) => {
      const report = await tx.dailySiteReport.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!report) throw this.notFound();
      await this.access.assertAccess(context.auth, report.projectId, tx);
      if (report.status !== 'SUBMITTED') {
        throw new ConflictException({
          code: 'DAILY_SITE_REPORT_NOT_SUBMITTED',
          detail: 'Corrections can only be appended after report submission.',
        });
      }

      await this.validateReferences(
        tx,
        context.auth.companyId,
        report.projectId,
        {
          manpower: [],
          materialUsage: [],
          progress: progressCorrections,
          issues: [],
          delays: [],
          inspections: [],
        },
      );

      const correction = await tx.dailySiteReportCorrection.create({
        data: {
          reportId: id,
          correctionNote,
          createdByUserId: context.auth.userId,
        },
      });

      for (const line of progressCorrections) {
        const progress = await tx.activityProgress.create({
          data: {
            companyId: context.auth.companyId,
            projectId: report.projectId,
            activityId: line.activityId,
            progressDate: report.reportDate,
            percentComplete: line.percentComplete,
            ...(line.note !== undefined ? { note: line.note } : {}),
            sourceType: 'DAILY_SITE_REPORT_CORRECTION',
            sourceEntityId: correction.id,
            recordedByUserId: context.auth.userId,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'ACTIVITY_PROGRESS',
            entityId: progress.id,
            action: 'CREATE',
            newValues: {
              projectId: report.projectId,
              activityId: line.activityId,
              progressDate: report.reportDate,
              percentComplete: line.percentComplete,
              sourceType: 'DAILY_SITE_REPORT_CORRECTION',
              sourceEntityId: correction.id,
            },
          },
          tx,
        );
      }

      await this.audit.record(
        {
          ...context,
          entityType: 'DAILY_SITE_REPORT_CORRECTION',
          entityId: correction.id,
          action: 'CREATE',
          newValues: {
            reportId: id,
            correctionNote,
            progressCorrectionCount: progressCorrections.length,
          },
        },
        tx,
      );
      return correction.id;
    });

    const correction = await this.prisma.dailySiteReportCorrection.findUnique({
      where: { id: correctionId },
      include: {
        createdBy: { select: { id: true, displayName: true } },
      },
    });
    if (!correction) return null;

    const persistedProgressCorrections =
      await this.prisma.activityProgress.findMany({
      where: {
        companyId: context.auth.companyId,
        sourceType: 'DAILY_SITE_REPORT_CORRECTION',
        sourceEntityId: correctionId,
      },
      include: {
        activity: {
          select: { id: true, activityCode: true, activityName: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return {
      ...correction,
      progressCorrections: persistedProgressCorrections,
    };
  }

  async listDocuments(auth: AuthenticatedUserContext, reportId: string) {
    const report = await this.reportForAccess(auth, reportId);
    return this.prisma.document.findMany({
      where: {
        companyId: auth.companyId,
        links: {
          some: {
            entityType: 'DAILY_SITE_REPORT',
            entityId: reportId,
          },
        },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSizeBytes: true,
        uploadedAt: true,
        isActive: true,
        documentType: {
          select: {
            id: true,
            documentTypeCode: true,
            documentTypeName: true,
          },
        },
        uploadedBy: {
          select: { id: true, displayName: true },
        },
      },
      orderBy: [{ uploadedAt: 'desc' }, { fileName: 'asc' }],
    });
  }

  async uploadPhoto(
    context: AuditContext,
    reportId: string,
    documentTypeId: string,
    file: UploadedDocumentFile,
  ) {
    const report = await this.reportForAccess(context.auth, reportId);
    this.assertDraft(report.status);
    const document = await this.documents.uploadProjectDocument(
      context,
      report.projectId,
      documentTypeId,
      file,
    );
    await this.linkDocument(context, reportId, document.id);
    return document;
  }

  async downloadDocument(
    auth: AuthenticatedUserContext,
    reportId: string,
    documentId: string,
  ) {
    const report = await this.reportForAccess(auth, reportId);
    const linked = await this.prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType: 'DAILY_SITE_REPORT',
        entityId: reportId,
        document: { companyId: auth.companyId },
      },
      select: { id: true },
    });
    if (!linked) {
      throw new NotFoundException({
        code: 'DAILY_SITE_REPORT_DOCUMENT_NOT_FOUND',
        detail: 'Daily Site Report document not found.',
      });
    }
    return this.documents.downloadProjectDocument(
      auth,
      report.projectId,
      documentId,
    );
  }

  private async linkDocument(
    context: AuditContext,
    reportId: string,
    documentId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const report = await tx.dailySiteReport.findFirst({
        where: { id: reportId, companyId: context.auth.companyId },
      });
      if (!report) throw this.notFound();
      await this.access.assertAccess(context.auth, report.projectId, tx);
      this.assertDraft(report.status);

      const document = await tx.document.findFirst({
        where: {
          id: documentId,
          companyId: context.auth.companyId,
          isActive: true,
          links: {
            some: {
              entityType: 'PROJECT',
              entityId: report.projectId,
            },
          },
        },
        select: { id: true },
      });
      if (!document) {
        throw new UnprocessableEntityException({
          code: 'DAILY_SITE_REPORT_DOCUMENT_INVALID',
          detail:
            'Document must be active and already linked to the same Project.',
        });
      }

      const existing = await tx.documentLink.findFirst({
        where: {
          documentId,
          entityType: 'DAILY_SITE_REPORT',
          entityId: reportId,
        },
      });
      if (existing) return existing;

      const link = await tx.documentLink.create({
        data: {
          documentId,
          entityType: 'DAILY_SITE_REPORT',
          entityId: reportId,
          linkedByUserId: context.auth.userId,
        },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'DOCUMENT_LINK',
          entityId: link.id,
          action: 'CREATE',
          newValues: {
            documentId,
            entityType: 'DAILY_SITE_REPORT',
            entityId: reportId,
          },
        },
        tx,
      );
      return link;
    });
  }

  private async reportForAccess(
    auth: AuthenticatedUserContext,
    id: string,
  ) {
    const report = await this.prisma.dailySiteReport.findFirst({
      where: { id, companyId: auth.companyId },
      select: { id: true, projectId: true, status: true },
    });
    if (!report) throw this.notFound();
    await this.access.assertAccess(auth, report.projectId);
    return report;
  }

  private async validateReferences(
    tx: Prisma.TransactionClient,
    companyId: string,
    projectId: string,
    input: {
      materialUsage: SiteMaterialUsageInput[];
      progress: SiteProgressInput[];
      issues: SiteIssueInput[];
      delays: SiteDelayInput[];
      inspections: SiteInspectionInput[];
      manpower?: SiteManpowerInput[];
    },
  ) {
    const activityIds = new Set<string>();
    for (const line of input.materialUsage) {
      if (line.activityId) activityIds.add(line.activityId);
    }
    for (const line of input.progress) activityIds.add(line.activityId);
    for (const line of input.issues) {
      if (line.activityId) activityIds.add(line.activityId);
    }
    for (const line of input.delays) {
      if (line.activityId) activityIds.add(line.activityId);
    }
    for (const line of input.inspections) {
      if (line.activityId) activityIds.add(line.activityId);
    }

    const activities = activityIds.size
      ? await tx.activity.findMany({
          where: {
            id: { in: [...activityIds] },
            companyId,
            projectId,
            isActive: true,
          },
          select: { id: true, wbsId: true },
        })
      : [];
    if (activities.length !== activityIds.size) {
      throw this.invalidReference(
        'All Activity references must be active and belong to the Daily Site Report Project.',
      );
    }
    const activityMap = new Map(
      activities.map((activity) => [activity.id, activity]),
    );

    const wbsIds = new Set(
      input.materialUsage
        .map((line) => line.wbsId)
        .filter((id): id is string => Boolean(id)),
    );
    if (wbsIds.size) {
      const count = await tx.wbsElement.count({
        where: {
          id: { in: [...wbsIds] },
          projectId,
          isActive: true,
        },
      });
      if (count !== wbsIds.size) {
        throw this.invalidReference(
          'All WBS references must be active and belong to the Daily Site Report Project.',
        );
      }
    }

    const materialIds = new Set(
      input.materialUsage.map((line) => line.materialId),
    );
    if (materialIds.size) {
      const count = await tx.material.count({
        where: {
          id: { in: [...materialIds] },
          companyId,
          isActive: true,
        },
      });
      if (count !== materialIds.size) {
        throw this.invalidReference(
          'All Material references must be active and belong to the current Company.',
        );
      }
    }

    const uomIds = new Set(input.materialUsage.map((line) => line.uomId));
    if (uomIds.size) {
      const count = await tx.unitOfMeasure.count({
        where: {
          id: { in: [...uomIds] },
          companyId,
          isActive: true,
        },
      });
      if (count !== uomIds.size) {
        throw this.invalidReference(
          'All UOM references must be active and belong to the current Company.',
        );
      }
    }

    for (const line of input.materialUsage) {
      if (
        line.activityId &&
        line.wbsId &&
        activityMap.get(line.activityId)?.wbsId !== line.wbsId
      ) {
        throw this.invalidReference(
          'When both Activity and WBS are supplied on a material-use line, the Activity must belong to that WBS.',
        );
      }
    }
  }

  private detailInclude() {
    return {
      project: {
        select: { id: true, projectCode: true, projectName: true },
      },
      createdBy: { select: { id: true, displayName: true } },
      submittedBy: { select: { id: true, displayName: true } },
      manpowerLines: { orderBy: { createdAt: 'asc' as const } },
      materialUsage: {
        include: {
          material: {
            select: { id: true, materialCode: true, materialName: true },
          },
          uom: { select: { id: true, uomCode: true, uomName: true } },
          activity: {
            select: { id: true, activityCode: true, activityName: true },
          },
          wbs: { select: { id: true, wbsCode: true, wbsName: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      progressLines: {
        include: {
          activity: {
            select: { id: true, activityCode: true, activityName: true },
          },
          activityProgress: {
            select: {
              id: true,
              progressDate: true,
              percentComplete: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      issues: {
        include: {
          activity: {
            select: { id: true, activityCode: true, activityName: true },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      delays: {
        include: {
          activity: {
            select: { id: true, activityCode: true, activityName: true },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      inspections: {
        include: {
          activity: {
            select: { id: true, activityCode: true, activityName: true },
          },
        },
        orderBy: { createdAt: 'asc' as const },
      },
      corrections: {
        include: {
          createdBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'asc' as const },
      },
    };
  }

  private assertDraft(status: string) {
    if (status !== 'DRAFT') {
      throw new ConflictException({
        code: 'DAILY_SITE_REPORT_SUBMITTED',
        detail:
          'Submitted Daily Site Report content is immutable. Append a correction instead.',
      });
    }
  }

  private invalidReference(detail: string) {
    return new UnprocessableEntityException({
      code: 'DAILY_SITE_REPORT_REFERENCE_INVALID',
      detail,
    });
  }

  private notFound() {
    return new NotFoundException({
      code: 'DAILY_SITE_REPORT_NOT_FOUND',
      detail: 'Daily Site Report not found.',
    });
  }

  private throwDuplicate(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DAILY_SITE_REPORT_DUPLICATE',
        detail:
          'Only one Daily Site Report is allowed per Project and reporting date.',
      });
    }
  }
}
