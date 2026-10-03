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
import {
  CostControlFilters,
  CostControlService,
} from './cost-control.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
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
      code: 'COST_CONTROL_FILTER_INVALID',
      detail: field + ' must be a valid UUID v4.',
    });
  }
  return value;
}

@Controller('projects/:projectId/cost-control')
export class CostControlController {
  constructor(private readonly costControl: CostControlService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.control.view')
  async projectCostControl(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('wbsId') wbsIdValue?: string,
    @Query('costCodeId') costCodeIdValue?: string,
  ) {
    const wbsId = optionalUuid(wbsIdValue, 'wbsId');
    const costCodeId = optionalUuid(costCodeIdValue, 'costCodeId');
    const filters: CostControlFilters = {};
    if (wbsId) filters.wbsId = wbsId;
    if (costCodeId) filters.costCodeId = costCodeId;
    return {
      data: await this.costControl.projectCostControl(
        authOf(request),
        projectId,
        filters,
      ),
    };
  }
}
