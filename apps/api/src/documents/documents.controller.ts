import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  documentCode,
  documentObject,
  documentString,
  documentUuid,
  nonemptyDocumentUpdate,
} from './document-validation';
import { UploadedDocumentFile } from './document-policy.service';
import {
  DocumentUploadCleanupInterceptor,
  documentUploadLimits,
  documentUploadStorage,
} from './document-upload-storage';

import { DocumentsService } from './documents.service';

const authOf = (request: AuthenticatedRequest) => request.auth!;
const auditContext = (request: AuthenticatedRequest) => ({
  auth: authOf(request),
  ...(request.correlationId ? { correlationId: request.correlationId } : {}),
});

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.type.manage')
  async list(@Req() request: AuthenticatedRequest) {
    return { data: await this.documents.listDocumentTypes(authOf(request)) };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.type.manage')
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = documentObject(body);
    return {
      data: await this.documents.createDocumentType(auditContext(request), {
        documentTypeCode: documentCode(
          documentString(input, 'documentTypeCode', 80),
        ),
        documentTypeName: documentString(input, 'documentTypeName', 150),
      }),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.type.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = documentObject(body);
    const data: Parameters<DocumentsService['updateDocumentType']>[2] = {};

    if (input.documentTypeCode !== undefined) {
      data.documentTypeCode = documentCode(
        documentString(input, 'documentTypeCode', 80),
      );
    }
    if (input.documentTypeName !== undefined) {
      data.documentTypeName = documentString(input, 'documentTypeName', 150);
    }
    nonemptyDocumentUpdate(data as Record<string, unknown>);

    return {
      data: await this.documents.updateDocumentType(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.type.manage')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.documents.setDocumentTypeActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.type.manage')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.documents.setDocumentTypeActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.documents.projects(authOf(request)) };
  }

  @Get('type-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.upload')
  async typeOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.documents.typeOptions(authOf(request)) };
  }

  @Get('projects/:projectId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async listProjectDocuments(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.documents.listProjectDocuments(
        authOf(request),
        projectId,
      ),
    };
  }

  @Post('projects/:projectId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.upload', 'documents.document.link')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: documentUploadLimits(),
      storage: documentUploadStorage(),
    }),
    new DocumentUploadCleanupInterceptor(),
  )
  async uploadProjectDocument(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() body: unknown,
  ) {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_FILE_REQUIRED',
        detail: 'A document file is required.',
      });
    }
    const input = documentObject(body);
    const documentTypeId = documentUuid(
      documentString(input, 'documentTypeId', 36),
      'documentTypeId',
    );

    return {
      data: await this.documents.uploadProjectDocument(
        auditContext(request),
        projectId,
        documentTypeId,
        file,
      ),
    };
  }

  @Get('projects/:projectId/:documentId/download')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async downloadProjectDocument(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ) {
    const result = await this.documents.downloadProjectDocument(
      authOf(request),
      projectId,
      documentId,
    );
    const encodedName = encodeURIComponent(result.fileName);
    return new StreamableFile(result.bytes, {
      type: result.mimeType,
      length: result.fileSizeBytes,
      disposition: "attachment; filename*=UTF-8''" + encodedName,
    });
  }

  @Post('projects/:projectId/:documentId/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.archive')
  async archiveProjectDocument(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ) {
    return {
      data: await this.documents.setProjectDocumentActive(
        auditContext(request),
        projectId,
        documentId,
        false,
      ),
    };
  }

  @Post('projects/:projectId/:documentId/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.archive')
  async reactivateProjectDocument(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' })) documentId: string,
  ) {
    return {
      data: await this.documents.setProjectDocumentActive(
        auditContext(request),
        projectId,
        documentId,
        true,
      ),
    };
  }
}
