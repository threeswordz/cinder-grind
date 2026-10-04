import {
  Controller,
  Get,
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
import { ManagementService } from './management.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function asOfDate(value: string | undefined): Date {
  if (value === undefined || value === '') {
    const now = new Date();
    return new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );
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

@Controller('management')
export class ManagementController {
  constructor(private readonly management: ManagementService) {}

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

  @Get('portfolio')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('management.portfolio.view')
  async portfolio(@Req() request: AuthenticatedRequest) {
    return { data: await this.management.portfolio(authOf(request)) };
  }
}
