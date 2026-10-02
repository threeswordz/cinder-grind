import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { RetentionService } from './retention.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

@Controller('finance')
export class RetentionController {
  constructor(private readonly retention: RetentionService) {}

  @Get('retention-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.retention.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.retention.projects(authOf(request)) };
  }

  @Get('projects/:projectId/retention')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.retention.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.retention.list(authOf(request), projectId) };
  }
}
