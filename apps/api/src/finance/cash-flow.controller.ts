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
import { CashFlowService } from './cash-flow.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

@Controller('finance')
export class CashFlowController {
  constructor(private readonly cashFlow: CashFlowService) {}

  @Get('cash-flow-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.cashFlow.projects(authOf(request)) };
  }

  @Get('projects/:projectId/cash-flow')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async projectCashFlow(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.cashFlow.projectCashFlow(authOf(request), projectId),
    };
  }
}
