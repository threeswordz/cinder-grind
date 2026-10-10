import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
  documentObject,
  documentString,
  documentUuid,
} from './document-validation';
import { UploadedDocumentFile } from './document-policy.service';
import {
  DocumentUploadCleanupInterceptor,
  documentUploadLimits,
  documentUploadStorage,
} from './document-upload-storage';

import {
  DocumentTargetsService,
  DocumentTargetType,
} from './document-targets.service';

const authOf = (request: AuthenticatedRequest) => request.auth!;
const auditContext = (request: AuthenticatedRequest) => ({
  auth: authOf(request),
  ...(request.correlationId ? { correlationId: request.correlationId } : {}),
});

function targetType(value: string): DocumentTargetType {
  const supported: DocumentTargetType[] = [
    'WBS',
    'ACTIVITY',
    'PURCHASE_REQUEST',
    'RFQ',
    'SUPPLIER_QUOTATION',
    'PURCHASE_ORDER',
    'GOODS_RECEIPT',
    'MATERIAL_RESERVATION',
    'MATERIAL_ISSUE',
    'MATERIAL_RETURN',
    'STOCK_TRANSFER',
    'SUPPLIER_INVOICE',
    'CLIENT_INVOICE',
    'PAYMENT',
    'SUBCONTRACT_AGREEMENT',
    'SUBCONTRACT_WORK_ORDER',
    'SUBCONTRACT_CLAIM',
    'SUBCONTRACT_CERTIFICATION',
    'SUBCONTRACT_VARIATION',
  ];
  if (!supported.includes(value as DocumentTargetType)) {
    throw new UnprocessableEntityException({
      code: 'DOCUMENT_TARGET_TYPE_INVALID',
      detail:
        'Document target type is not supported by the canonical Documents target allowlist.',
    });
  }
  return value as DocumentTargetType;
}

@Controller('documents/projects/:projectId/targets')
export class DocumentTargetsController {
  constructor(private readonly targets: DocumentTargetsService) {}

  @Get('options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.targets.options(authOf(request), projectId),
    };
  }

  @Get(':entityType/:entityId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Param('entityType') rawEntityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' }))
    entityId: string,
  ) {
    return {
      data: await this.targets.list(
        authOf(request),
        projectId,
        targetType(rawEntityType),
        entityId,
      ),
    };
  }

  @Post(':entityType/:entityId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.upload', 'documents.document.link')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: documentUploadLimits(),
      storage: documentUploadStorage(),
    }),
    new DocumentUploadCleanupInterceptor(),
  )
  async upload(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Param('entityType') rawEntityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' }))
    entityId: string,
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
      data: await this.targets.upload(
        auditContext(request),
        projectId,
        targetType(rawEntityType),
        entityId,
        documentTypeId,
        file,
      ),
    };
  }

  @Get(':entityType/:entityId/:documentId/download')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('documents.document.view')
  async download(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Param('entityType') rawEntityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' }))
    entityId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    const result = await this.targets.download(
      authOf(request),
      projectId,
      targetType(rawEntityType),
      entityId,
      documentId,
    );
    const encodedName = encodeURIComponent(result.fileName);
    return new StreamableFile(result.bytes, {
      type: result.mimeType,
      length: result.fileSizeBytes,
      disposition: "attachment; filename*=UTF-8''" + encodedName,
    });
  }

  @Post(':entityType/:entityId/:documentId/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.archive')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Param('entityType') rawEntityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' }))
    entityId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    return {
      data: await this.targets.setActive(
        auditContext(request),
        projectId,
        targetType(rawEntityType),
        entityId,
        documentId,
        false,
      ),
    };
  }

  @Post(':entityType/:entityId/:documentId/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('documents.document.archive')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Param('entityType') rawEntityType: string,
    @Param('entityId', new ParseUUIDPipe({ version: '4' }))
    entityId: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    return {
      data: await this.targets.setActive(
        auditContext(request),
        projectId,
        targetType(rawEntityType),
        entityId,
        documentId,
        true,
      ),
    };
  }
}
