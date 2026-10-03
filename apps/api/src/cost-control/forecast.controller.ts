import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  costArray,
  costDate,
  costNonEmpty,
  costNonNegativeDecimal,
  costNullableString,
  costObject,
  costString,
  costUuid,
} from './cost-control-validation';
import {
  CostForecastLineInput,
  ForecastService,
} from './forecast.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function contextOf(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId
      ? { correlationId: request.correlationId }
      : {}),
  };
}

function parseLines(input: Record<string, unknown>): CostForecastLineInput[] {
  return costArray(input, 'lines').map((line, index) => ({
    wbsId: costUuid(line, 'wbsId', true),
    costCodeId: costUuid(line, 'costCodeId', true),
    uncommittedEtcAmount: costNonNegativeDecimal(
      line,
      'uncommittedEtcAmount',
    ),
    remarks: costNullableString(line, 'remarks', 5000),
    inputOrder: index + 1,
  }));
}

@Controller('cost-control')
export class ForecastController {
  constructor(private readonly forecasts: ForecastService) {}

  @Get('forecast-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.manage')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.forecasts.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/forecast-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.forecasts.options(authOf(request), projectId) };
  }

  @Get('projects/:projectId/forecasts')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.forecasts.list(authOf(request), projectId) };
  }

  @Get('forecasts/:forecastId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('forecastId', new ParseUUIDPipe({ version: '4' })) forecastId: string,
  ) {
    return { data: await this.forecasts.get(authOf(request), forecastId) };
  }

  @Post('projects/:projectId/forecasts')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.manage')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.forecasts.create(contextOf(request), projectId, {
        forecastDate: costDate(input, 'forecastDate'),
        description: costNullableString(input, 'description', 5000),
        lines: parseLines(input),
        createKey: costString(input, 'createKey', 120),
      }),
    };
  }

  @Patch('forecasts/:forecastId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('forecastId', new ParseUUIDPipe({ version: '4' })) forecastId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    const data = {
      ...(input.forecastDate !== undefined
        ? { forecastDate: costDate(input, 'forecastDate') }
        : {}),
      ...(input.description !== undefined
        ? { description: costNullableString(input, 'description', 5000) }
        : {}),
      ...(input.lines !== undefined ? { lines: parseLines(input) } : {}),
    };
    costNonEmpty(data);
    return {
      data: await this.forecasts.update(contextOf(request), forecastId, data),
    };
  }

  @Post('forecasts/:forecastId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.manage')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('forecastId', new ParseUUIDPipe({ version: '4' })) forecastId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.forecasts.submit(
        contextOf(request),
        forecastId,
        costString(input, 'workflowCode', 80),
        costString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('forecasts/:forecastId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('forecastId', new ParseUUIDPipe({ version: '4' })) forecastId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.forecasts.approve(
        contextOf(request),
        forecastId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('forecasts/:forecastId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.forecast.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('forecastId', new ParseUUIDPipe({ version: '4' })) forecastId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.forecasts.reject(
        contextOf(request),
        forecastId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }
}
