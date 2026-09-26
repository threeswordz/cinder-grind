import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
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
  parseSchedulingDate,
  schedulingInvalid,
} from '../scheduling/scheduling-validation';
import { ReportingService } from './reporting.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

@Controller('reporting')
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('reporting.operational.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.reporting.projects(authOf(request)) };
  }

  @Get('projects/:projectId/project-engineer')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('reporting.operational.view')
  async projectEngineer(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') rawAsOf?: string,
    @Query('days') rawDays?: string,
  ) {
    if (!rawAsOf) throw schedulingInvalid('asOf', 'Is required.');
    const parsedDays =
      rawDays === undefined || rawDays === '' ? 14 : Number(rawDays);
    if (parsedDays !== 14 && parsedDays !== 28) {
      throw schedulingInvalid('days', 'Must be 14 or 28.');
    }
    return {
      data: await this.reporting.projectEngineer(
        authOf(request),
        projectId,
        parseSchedulingDate(rawAsOf, 'asOf'),
        parsedDays,
      ),
    };
  }
}
