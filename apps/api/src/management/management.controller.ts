import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  ManagementReportDomain,
  ManagementReportOptions,
  ManagementReportStatus,
  ManagementService,
} from './management.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function asOfDate(value: string | undefined): Date {
  if (value === undefined || value === '') {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_AS_OF_REQUIRED',
      detail: 'asOf is required and must use YYYY-MM-DD.',
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_AS_OF_INVALID',
      detail: 'asOf must use YYYY-MM-DD.',
    });
  }
  const result = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(result.getTime()) ||
    result.toISOString().slice(0, 10) !== value
  ) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_AS_OF_INVALID',
      detail: 'asOf must be a valid calendar date.',
    });
  }
  return result;
}

function lookaheadDays(value: string | undefined): 14 | 28 {
  if (value === undefined || value === '') return 14;
  const result = Number(value);
  if (result !== 14 && result !== 28) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_DAYS_INVALID',
      detail: 'days must be 14 or 28.',
    });
  }
  return result;
}


const REPORT_DOMAINS = new Set<ManagementReportDomain>([
  'ALL',
  'SCHEDULE',
  'PROCUREMENT',
  'INVENTORY',
  'COST',
  'COMMERCIAL',
  'FINANCE',
]);

const REPORT_STATUSES = new Set<ManagementReportStatus>([
  'AVAILABLE',
  'UNAVAILABLE',
  'COMPLETED',
  'DELAYED',
  'CRITICAL',
  'LOOKAHEAD',
  'AT_RISK',
  'ON_TIME',
]);

function reportDomain(value: string | undefined): ManagementReportDomain {
  const normalized = (value ?? 'ALL').toUpperCase() as ManagementReportDomain;
  if (!REPORT_DOMAINS.has(normalized)) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_DOMAIN_INVALID',
      detail:
        'domain must be ALL, SCHEDULE, PROCUREMENT, INVENTORY, COST, COMMERCIAL or FINANCE.',
    });
  }
  return normalized;
}

function reportStatus(
  value: string | undefined,
): ManagementReportStatus | undefined {
  if (value === undefined || value === '') return undefined;
  const normalized = value.toUpperCase() as ManagementReportStatus;
  if (!REPORT_STATUSES.has(normalized)) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_STATUS_INVALID',
      detail:
        'status must be AVAILABLE, UNAVAILABLE, COMPLETED, DELAYED, CRITICAL, LOOKAHEAD, AT_RISK or ON_TIME.',
    });
  }
  return normalized;
}

function optionalUuid(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_FILTER_INVALID',
      detail: field + ' must be a valid UUID v4.',
    });
  }
  return value;
}

function optionalDay(
  value: string | undefined,
  field: string,
): Date | undefined {
  if (value === undefined || value === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_DATE_INVALID',
      detail: field + ' must use YYYY-MM-DD.',
    });
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_DATE_INVALID',
      detail: field + ' must be a valid calendar date.',
    });
  }
  return parsed;
}

function reportOptions(
  asOf: string | undefined,
  days: string | undefined,
  domain: string | undefined,
  status: string | undefined,
  fromDateValue: string | undefined,
  toDateValue: string | undefined,
  wbsIdValue: string | undefined,
  costCodeIdValue: string | undefined,
): ManagementReportOptions {
  const fromDate = optionalDay(fromDateValue, 'fromDate');
  const toDate = optionalDay(toDateValue, 'toDate');
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new UnprocessableEntityException({
      code: 'MANAGEMENT_REPORT_DATE_RANGE_INVALID',
      detail: 'fromDate must be on or before toDate.',
    });
  }
  const wbsId = optionalUuid(wbsIdValue, 'wbsId');
  const costCodeId = optionalUuid(costCodeIdValue, 'costCodeId');
  const parsedStatus = reportStatus(status);
  return {
    asOf: asOfDate(asOf),
    days: lookaheadDays(days),
    domain: reportDomain(domain),
    ...(parsedStatus ? { status: parsedStatus } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate
      ? { toDateExclusive: new Date(toDate.getTime() + 86_400_000) }
      : {}),
    ...(wbsId ? { wbsId } : {}),
    ...(costCodeId ? { costCodeId } : {}),
  };
}

@Controller('management')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('management.dashboard.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.management.projects(authOf(request)) };
  }

  @Get('projects/:projectId/summary')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('management.dashboard.view')
  async projectSummary(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') asOf?: string,
    @Query('days') days?: string,
  ) {
    return {
      data: await this.management.projectSummary(
        authOf(request),
        projectId,
        {
          asOf: asOfDate(asOf),
          days: lookaheadDays(days),
        },
      ),
    };
  }

  @Get('reports')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('management.dashboard.view')
  async report(
    @Req() request: AuthenticatedRequest,
    @Query('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') asOf?: string,
    @Query('days') days?: string,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('wbsId') wbsId?: string,
    @Query('costCodeId') costCodeId?: string,
  ) {
    return {
      data: await this.management.projectReport(
        authOf(request),
        projectId,
        reportOptions(
          asOf,
          days,
          domain,
          status,
          fromDate,
          toDate,
          wbsId,
          costCodeId,
        ),
      ),
    };
  }

  @Get('reports/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="management-report.csv"',
  )
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions(
    'management.dashboard.view',
    'management.report.export',
  )
  async reportCsv(
    @Req() request: AuthenticatedRequest,
    @Query('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') asOf?: string,
    @Query('days') days?: string,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('wbsId') wbsId?: string,
    @Query('costCodeId') costCodeId?: string,
  ) {
    return this.management.projectReportCsv(
      authOf(request),
      projectId,
      reportOptions(
        asOf,
        days,
        domain,
        status,
        fromDate,
        toDate,
        wbsId,
        costCodeId,
      ),
    );
  }

  @Get('portfolio')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('management.portfolio.view')
  async portfolio(
    @Req() request: AuthenticatedRequest,
    @Query('asOf') asOf?: string,
    @Query('days') days?: string,
  ) {
    return {
      data: await this.management.portfolio(authOf(request), {
        asOf: asOfDate(asOf),
        days: lookaheadDays(days),
      }),
    };
  }
}
