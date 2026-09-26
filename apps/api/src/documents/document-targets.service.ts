import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { UploadedDocumentFile } from './document-policy.service';
import { DocumentsService } from './documents.service';

export type DocumentTargetType = 'WBS' | 'ACTIVITY';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

@Injectable()
export class DocumentTargetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly documents: DocumentsService,
  ) {}

  async options(auth: AuthenticatedUserContext, projectId: string) {
    await this.access.assertAccess(auth, projectId);
    const [wbs, activities] = await Promise.all([
      this.prisma.wbsElement.findMany({
        where: { projectId, isActive: true },
        select: { id: true, wbsCode: true, wbsName: true, parentId: true },
        orderBy: { wbsCode: 'asc' },
      }),
      this.prisma.activity.findMany({
        where: {
          projectId,
          companyId: auth.companyId,
          isActive: true,
        },
        select: {
          id: true,
          activityCode: true,
          activityName: true,
          wbsId: true,
        },
        orderBy: { activityCode: 'asc' },
      }),
    ]);
    return { wbs, activities };
  }

  async list(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    await this.assertTarget(auth, projectId, entityType, entityId);

    const rows = await this.prisma.document.findMany({
      where: {
        companyId: auth.companyId,
        links: {
          some: { entityType, entityId },
        },
      },
      include: {
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

    return rows.map((row) => this.toDto(row));
  }

  async upload(
    context: AuditContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentTypeId: string,
    file: UploadedDocumentFile,
  ) {
    await this.assertTarget(
      context.auth,
      projectId,
      entityType,
      entityId,
    );

    const document = await this.documents.uploadProjectDocument(
      context,
      projectId,
      documentTypeId,
      file,
    );

    await this.prisma.$transaction(async (tx) => {
      const link = await tx.documentLink.create({
        data: {
          documentId: document.id,
          entityType,
          entityId,
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
            documentId: document.id,
            entityType,
            entityId,
            projectId,
          },
        },
        tx,
      );
    });

    return document;
  }

  async download(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
  ) {
    await this.assertTarget(auth, projectId, entityType, entityId);
    await this.assertLinked(
      auth,
      documentId,
      entityType,
      entityId,
    );
    return this.documents.downloadProjectDocument(
      auth,
      projectId,
      documentId,
    );
  }

  async setActive(
    context: AuditContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
    documentId: string,
    isActive: boolean,
  ) {
    await this.assertTarget(
      context.auth,
      projectId,
      entityType,
      entityId,
    );
    await this.assertLinked(
      context.auth,
      documentId,
      entityType,
      entityId,
    );
    return this.documents.setProjectDocumentActive(
      context,
      projectId,
      documentId,
      isActive,
    );
  }

  private async assertTarget(
    auth: AuthenticatedUserContext,
    projectId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    if (entityType === 'WBS') {
      const row = await this.prisma.wbsElement.findFirst({
        where: { id: entityId, projectId },
        select: { id: true },
      });
      if (!row) throw this.targetNotFound();
      return;
    }

    const row = await this.prisma.activity.findFirst({
      where: {
        id: entityId,
        projectId,
        companyId: auth.companyId,
      },
      select: { id: true },
    });
    if (!row) throw this.targetNotFound();
  }

  private async assertLinked(
    auth: AuthenticatedUserContext,
    documentId: string,
    entityType: DocumentTargetType,
    entityId: string,
  ) {
    const linked = await this.prisma.documentLink.findFirst({
      where: {
        documentId,
        entityType,
        entityId,
        document: { companyId: auth.companyId },
      },
      select: { id: true },
    });
    if (!linked) {
      throw new NotFoundException({
        code: 'DOCUMENT_TARGET_LINK_NOT_FOUND',
        detail: 'Document is not linked to the requested target.',
      });
    }
  }

  private toDto(row: {
    id: string;
    documentTypeId: string;
    fileName: string;
    storageProvider: string;
    mimeType: string;
    fileSizeBytes: number;
    checksum: string | null;
    uploadedAt: Date;
    isActive: boolean;
    documentType: {
      id: string;
      documentTypeCode: string;
      documentTypeName: string;
    };
    uploadedBy: {
      id: string;
      displayName: string;
    };
  }) {
    return {
      id: row.id,
      documentTypeId: row.documentTypeId,
      fileName: row.fileName,
      storageProvider: row.storageProvider,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      checksum: row.checksum,
      uploadedAt: row.uploadedAt,
      isActive: row.isActive,
      documentType: row.documentType,
      uploadedBy: row.uploadedBy,
    };
  }

  private targetNotFound() {
    return new UnprocessableEntityException({
      code: 'DOCUMENT_TARGET_INVALID',
      detail:
        'WBS or Activity target must belong to the selected Project.',
    });
  }
}
