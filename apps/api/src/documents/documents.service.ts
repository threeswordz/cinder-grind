import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { DocumentPolicyService, UploadedDocumentFile } from './document-policy.service';
import {
  cleanupUploadedDocumentFile,
  checksumUploadedDocumentFile,
} from './document-upload-storage';
import { DocumentStorage } from './document-storage';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

type DocumentTypeCreate = {
  documentTypeCode: string;
  documentTypeName: string;
};

type DocumentTypeUpdate = {
  documentTypeCode?: string;
  documentTypeName?: string;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
    private readonly storage: DocumentStorage,
    private readonly policy: DocumentPolicyService,
  ) {}

  async projects(auth: AuthenticatedUserContext) {
    const scope = await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where: { ...scope, isActive: true },
      select: { id: true, projectCode: true, projectName: true },
      orderBy: [{ projectName: 'asc' }, { projectCode: 'asc' }],
    });
  }

  listDocumentTypes(auth: AuthenticatedUserContext) {
    return this.prisma.documentType.findMany({
      where: { companyId: auth.companyId },
      orderBy: [{ documentTypeName: 'asc' }, { documentTypeCode: 'asc' }],
    });
  }

  typeOptions(auth: AuthenticatedUserContext) {
    return this.prisma.documentType.findMany({
      where: { companyId: auth.companyId, isActive: true },
      select: {
        id: true,
        documentTypeCode: true,
        documentTypeName: true,
      },
      orderBy: [{ documentTypeName: 'asc' }, { documentTypeCode: 'asc' }],
    });
  }

  async createDocumentType(context: AuditContext, data: DocumentTypeCreate) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const row = await tx.documentType.create({
          data: { companyId: context.auth.companyId, ...data },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'DOCUMENT_TYPE',
            entityId: row.id,
            action: 'CREATE',
            newValues: row,
          },
          tx,
        );
        return row;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Document Type code is already in use.');
      throw error;
    }
  }

  async updateDocumentType(
    context: AuditContext,
    id: string,
    data: DocumentTypeUpdate,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.documentType.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.typeNotFound();

        const row = await tx.documentType.update({ where: { id }, data });
        await this.audit.record(
          {
            ...context,
            entityType: 'DOCUMENT_TYPE',
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
      this.throwDuplicate(error, 'Document Type code is already in use.');
      throw error;
    }
  }

  async setDocumentTypeActive(
    context: AuditContext,
    id: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.documentType.findFirst({
        where: { id, companyId: context.auth.companyId },
      });
      if (!before) throw this.typeNotFound();

      const row = await tx.documentType.update({
        where: { id },
        data: { isActive },
      });
      await this.audit.record(
        {
          ...context,
          entityType: 'DOCUMENT_TYPE',
          entityId: id,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: row,
        },
        tx,
      );
      return row;
    });
  }

  async listProjectDocuments(
    auth: AuthenticatedUserContext,
    projectId: string,
  ) {
    await this.access.assertAccess(auth, projectId);

    const rows = await this.prisma.document.findMany({
      where: {
        companyId: auth.companyId,
        links: {
          some: {
            entityType: 'PROJECT',
            entityId: projectId,
          },
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

    return rows.map((row) => this.toDocumentDto(row));
  }

  async uploadProjectDocument(
    context: AuditContext,
    projectId: string,
    documentTypeId: string,
    file: UploadedDocumentFile,
  ) {
    try {
      await this.access.assertAccess(context.auth, projectId);
      const normalized = this.policy.validate(file);

    const type = await this.prisma.documentType.findFirst({
      where: {
        id: documentTypeId,
        companyId: context.auth.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!type) {
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_TYPE_INVALID',
        detail: 'Document Type must be active and belong to the current company.',
      });
    }

      const checksum = await checksumUploadedDocumentFile(file);
      const stored = file.path
        ? await this.storage.putFile(file.path)
        : await this.storage.put(file.buffer!);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const document = await tx.document.create({
          data: {
            companyId: context.auth.companyId,
            documentTypeId,
            fileName: normalized.fileName,
            storageProvider: stored.storageProvider,
            storageKey: stored.storageKey,
            mimeType: normalized.mimeType,
            fileSizeBytes: file.size,
            uploadedByUserId: context.auth.userId,
            checksum,
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
        });

        const link = await tx.documentLink.create({
          data: {
            documentId: document.id,
            entityType: 'PROJECT',
            entityId: projectId,
            linkedByUserId: context.auth.userId,
          },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'DOCUMENT',
            entityId: document.id,
            action: 'CREATE',
            newValues: this.toDocumentDto(document),
          },
          tx,
        );
        await this.audit.record(
          {
            ...context,
            entityType: 'DOCUMENT_LINK',
            entityId: link.id,
            action: 'CREATE',
            newValues: {
              documentId: document.id,
              entityType: 'PROJECT',
              entityId: projectId,
            },
          },
          tx,
        );

        return document;
      });

      return this.toDocumentDto(row);
      } catch (error) {
        await this.storage.remove(stored.storageKey);
        throw error;
      }
    } finally {
      await cleanupUploadedDocumentFile(file);
    }
  }

  async downloadProjectDocument(
    auth: AuthenticatedUserContext,
    projectId: string,
    documentId: string,
  ) {
    await this.access.assertAccess(auth, projectId);
    const row = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        companyId: auth.companyId,
        links: {
          some: { entityType: 'PROJECT', entityId: projectId },
        },
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSizeBytes: true,
        storageKey: true,
      },
    });
    if (!row) throw this.documentNotFound();

    const bytes = await this.storage.read(row.storageKey);
    return {
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      fileSizeBytes: row.fileSizeBytes,
      bytes,
    };
  }

  async setProjectDocumentActive(
    context: AuditContext,
    projectId: string,
    documentId: string,
    isActive: boolean,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.access.assertAccess(context.auth, projectId, tx);

      const before = await tx.document.findFirst({
        where: {
          id: documentId,
          companyId: context.auth.companyId,
          links: {
            some: { entityType: 'PROJECT', entityId: projectId },
          },
        },
      });
      if (!before) throw this.documentNotFound();

      const row = await tx.document.update({
        where: { id: documentId },
        data: { isActive },
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
      });

      await this.audit.record(
        {
          ...context,
          entityType: 'DOCUMENT',
          entityId: documentId,
          action: isActive ? 'REACTIVATE' : 'ARCHIVE',
          oldValues: before,
          newValues: this.toDocumentDto(row),
        },
        tx,
      );

      return this.toDocumentDto(row);
    });
  }

  private toDocumentDto(row: {
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

  private typeNotFound() {
    return new NotFoundException({
      code: 'DOCUMENT_TYPE_NOT_FOUND',
      detail: 'Document Type not found.',
    });
  }

  private documentNotFound() {
    return new NotFoundException({
      code: 'DOCUMENT_NOT_FOUND',
      detail: 'Document not found.',
    });
  }

  private throwDuplicate(error: unknown, detail: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({ code: 'DUPLICATE_CODE', detail });
    }
  }
}
