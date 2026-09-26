import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  documentMaxBytes,
  UploadedDocumentFile,
} from '../documents/document-policy.service';
import {
  DailySiteReportCreateInput,
  DailySiteReportUpdateInput,
  SiteDelayInput,
  SiteInspectionInput,
  SiteIssueInput,
  SiteManpowerInput,
  SiteMaterialUsageInput,
  SiteProgressInput,
  SiteExecutionService,
} from './site-execution.service';
import {
  nullableSiteString,
  optionalSiteUuid,
  requiredSiteString,
  siteArray,
  siteDate,
  siteInvalid,
  siteObject,
  sitePercent,
  sitePositiveDecimal,
  sitePositiveInt,
  siteUuid,
} from './site-execution-validation';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function auditContext(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId
      ? { correlationId: request.correlationId }
      : {}),
  };
}

function manpowerRows(value: unknown, field = 'manpower'): SiteManpowerInput[] {
  return siteArray(value, field).map((row, index) => {
    const remarks = nullableSiteString(
      row,
      'remarks',
      10000,
    );
    return {
      tradeRole: requiredSiteString(
        row,
        'tradeRole',
        150,
      ),
      headcount: sitePositiveInt(
        row.headcount,
        `${field}[${index}].headcount`,
      ),
      ...(remarks !== undefined ? { remarks } : {}),
    };
  });
}

function materialRows(
  value: unknown,
  field = 'materialUsage',
): SiteMaterialUsageInput[] {
  return siteArray(value, field).map((row, index) => {
    const activityId = optionalSiteUuid(
      row.activityId,
      `${field}[${index}].activityId`,
    );
    const wbsId = optionalSiteUuid(
      row.wbsId,
      `${field}[${index}].wbsId`,
    );
    const remarks = nullableSiteString(row, 'remarks', 10000);
    return {
      materialId: siteUuid(
        row.materialId,
        `${field}[${index}].materialId`,
      ),
      uomId: siteUuid(
        row.uomId,
        `${field}[${index}].uomId`,
      ),
      quantity: sitePositiveDecimal(
        row.quantity,
        `${field}[${index}].quantity`,
      ),
      ...(activityId !== undefined ? { activityId } : {}),
      ...(wbsId !== undefined ? { wbsId } : {}),
      ...(remarks !== undefined ? { remarks } : {}),
    };
  });
}

function progressRows(
  value: unknown,
  field = 'progress',
): SiteProgressInput[] {
  const rows = siteArray(value, field).map((row, index) => {
    const note = nullableSiteString(row, 'note', 10000);
    return {
      activityId: siteUuid(
        row.activityId,
        `${field}[${index}].activityId`,
      ),
      percentComplete: sitePercent(
        row.percentComplete,
        `${field}[${index}].percentComplete`,
      ),
      ...(note !== undefined ? { note } : {}),
    };
  });

  const ids = new Set(rows.map((row) => row.activityId));
  if (ids.size !== rows.length) {
    siteInvalid(field, 'Only one progress row per Activity is allowed.');
  }
  return rows;
}

function issueRows(value: unknown, field = 'issues'): SiteIssueInput[] {
  return siteArray(value, field).map((row, index) => {
    const activityId = optionalSiteUuid(
      row.activityId,
      `${field}[${index}].activityId`,
    );
    const remarks = nullableSiteString(row, 'remarks', 10000);
    return {
      ...(activityId !== undefined ? { activityId } : {}),
      issueText: requiredSiteString(row, 'issueText', 10000),
      ...(remarks !== undefined ? { remarks } : {}),
    };
  });
}

function delayRows(value: unknown, field = 'delays'): SiteDelayInput[] {
  return siteArray(value, field).map((row, index) => {
    const activityId = optionalSiteUuid(
      row.activityId,
      `${field}[${index}].activityId`,
    );
    const remarks = nullableSiteString(row, 'remarks', 10000);
    return {
      ...(activityId !== undefined ? { activityId } : {}),
      delayReason: requiredSiteString(row, 'delayReason', 10000),
      ...(remarks !== undefined ? { remarks } : {}),
    };
  });
}

function inspectionRows(
  value: unknown,
  field = 'inspections',
): SiteInspectionInput[] {
  return siteArray(value, field).map((row, index) => {
    const activityId = optionalSiteUuid(
      row.activityId,
      `${field}[${index}].activityId`,
    );
    const inspectionReference = nullableSiteString(
      row,
      'inspectionReference',
      200,
    );
    const remarks = nullableSiteString(row, 'remarks', 10000);
    if (!inspectionReference && !remarks) {
      siteInvalid(
        `${field}[${index}]`,
        'Provide an inspection reference or remarks.',
      );
    }
    return {
      ...(activityId !== undefined ? { activityId } : {}),
      ...(inspectionReference !== undefined
        ? { inspectionReference }
        : {}),
      ...(remarks !== undefined ? { remarks } : {}),
    };
  });
}

function createInput(body: unknown): DailySiteReportCreateInput {
  const input = siteObject(body);
  const weatherObservation = nullableSiteString(
    input,
    'weatherObservation',
    10000,
  );
  const generalRemarks = nullableSiteString(input, 'generalRemarks', 10000);

  return {
    projectId: siteUuid(input.projectId, 'projectId'),
    reportDate: siteDate(input.reportDate, 'reportDate'),
    ...(weatherObservation !== undefined ? { weatherObservation } : {}),
    ...(generalRemarks !== undefined ? { generalRemarks } : {}),
    manpower: manpowerRows(input.manpower),
    materialUsage: materialRows(input.materialUsage),
    progress: progressRows(input.progress),
    issues: issueRows(input.issues),
    delays: delayRows(input.delays),
    inspections: inspectionRows(input.inspections),
  };
}

function updateInput(body: unknown): DailySiteReportUpdateInput {
  const input = siteObject(body);
  const data: DailySiteReportUpdateInput = {};

  if (input.reportDate !== undefined) {
    data.reportDate = siteDate(input.reportDate, 'reportDate');
  }
  if (input.weatherObservation !== undefined) {
    data.weatherObservation = nullableSiteString(
      input,
      'weatherObservation',
      10000,
    );
  }
  if (input.generalRemarks !== undefined) {
    data.generalRemarks = nullableSiteString(
      input,
      'generalRemarks',
      10000,
    );
  }
  if (input.manpower !== undefined) data.manpower = manpowerRows(input.manpower);
  if (input.materialUsage !== undefined) {
    data.materialUsage = materialRows(input.materialUsage);
  }
  if (input.progress !== undefined) data.progress = progressRows(input.progress);
  if (input.issues !== undefined) data.issues = issueRows(input.issues);
  if (input.delays !== undefined) data.delays = delayRows(input.delays);
  if (input.inspections !== undefined) {
    data.inspections = inspectionRows(input.inspections);
  }

  if (Object.keys(data).length === 0) {
    siteInvalid('body', 'Provide at least one field to update.');
  }
  return data;
}

@Controller('site-execution')
export class SiteExecutionController {
  constructor(private readonly site: SiteExecutionService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.site.projects(authOf(request)) };
  }

  @Get('projects/:projectId/options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.site.options(authOf(request), projectId),
    };
  }

  @Get('reports')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
    @Query('from') rawFrom?: string,
    @Query('to') rawTo?: string,
  ) {
    if (!rawProjectId) siteInvalid('projectId', 'Is required.');
    return {
      data: await this.site.list(
        authOf(request),
        siteUuid(rawProjectId, 'projectId'),
        rawFrom ? siteDate(rawFrom, 'from') : undefined,
        rawTo ? siteDate(rawTo, 'to') : undefined,
      ),
    };
  }

  @Post('reports')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.site.create(
        auditContext(request),
        createInput(body),
      ),
    };
  }

  @Get('reports/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.site.get(authOf(request), id) };
  }

  @Patch('reports/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.site.update(
        auditContext(request),
        id,
        updateInput(body),
      ),
    };
  }

  @Post('reports/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.site.submit(auditContext(request), id),
    };
  }

  @Post('reports/:id/corrections')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.edit')
  async correction(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = siteObject(body);
    return {
      data: await this.site.addCorrection(
        auditContext(request),
        id,
        requiredSiteString(input, 'correctionNote', 10000),
      ),
    };
  }

  @Get('reports/:id/documents')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async documents(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.site.listDocuments(authOf(request), id),
    };
  }

  @Post('reports/:id/photos')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.edit')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: documentMaxBytes() },
    }),
  )
  async uploadPhoto(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Body() body: unknown,
  ) {
    if (!file) {
      throw new UnprocessableEntityException({
        code: 'DOCUMENT_FILE_REQUIRED',
        detail: 'A site photograph/file is required.',
      });
    }
    const input = siteObject(body);
    return {
      data: await this.site.uploadPhoto(
        auditContext(request),
        id,
        siteUuid(input.documentTypeId, 'documentTypeId'),
        file,
      ),
    };
  }

  @Get('reports/:id/documents/:documentId/download')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.daily_report.view')
  async downloadDocument(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('documentId', new ParseUUIDPipe({ version: '4' }))
    documentId: string,
  ) {
    const result = await this.site.downloadDocument(
      authOf(request),
      id,
      documentId,
    );
    const encodedName = encodeURIComponent(result.fileName);
    return new StreamableFile(result.bytes, {
      type: result.mimeType,
      length: result.fileSizeBytes,
      disposition: "attachment; filename*=UTF-8''" + encodedName,
    });
  }
}
