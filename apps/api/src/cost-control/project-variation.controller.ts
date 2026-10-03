import {
  Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest, AuthenticatedUserContext } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  costNonEmpty, costNullableString, costObject, costSignedDecimal, costString,
} from './cost-control-validation';
import { ProjectVariationService } from './project-variation.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}
function contextOf(request: AuthenticatedRequest) {
  return { auth: authOf(request), ...(request.correlationId ? { correlationId: request.correlationId } : {}) };
}

@Controller('cost-control')
export class ProjectVariationController {
  constructor(private readonly variations: ProjectVariationService) {}

  @Get('project-variation-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.variation.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.variations.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/project-variations')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.variation.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.variations.list(authOf(request), projectId) };
  }

  @Get('project-variations/:variationId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.variation.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
  ) {
    return { data: await this.variations.get(authOf(request), variationId) };
  }

  @Post('projects/:projectId/project-variations')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.variations.create(contextOf(request), projectId, {
        variationNumber: costString(input, 'variationNumber', 120),
        description: costString(input, 'description', 500),
        reason: costNullableString(input, 'reason', 5000),
        valueDelta: costSignedDecimal(input, 'valueDelta'),
        createKey: costString(input, 'createKey', 120),
      }),
    };
  }

  @Patch('project-variations/:variationId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.create')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    const data = {
      ...(input.description !== undefined ? { description: costString(input, 'description', 500) } : {}),
      ...(input.reason !== undefined ? { reason: costNullableString(input, 'reason', 5000) } : {}),
      ...(input.valueDelta !== undefined ? { valueDelta: costSignedDecimal(input, 'valueDelta') } : {}),
    };
    costNonEmpty(data);
    return { data: await this.variations.update(contextOf(request), variationId, data) };
  }

  @Post('project-variations/:variationId/reversal')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.create')
  async createReversal(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.variations.createReversal(contextOf(request), variationId, {
        variationNumber: costString(input, 'variationNumber', 120),
        reason: costString(input, 'reason', 5000),
        createKey: costString(input, 'createKey', 120),
      }),
    };
  }

  @Post('project-variations/:variationId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.variations.submit(
        contextOf(request), variationId,
        costString(input, 'workflowCode', 80),
        costString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('project-variations/:variationId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.variations.approve(
        contextOf(request), variationId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('project-variations/:variationId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.variation.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.variations.reject(
        contextOf(request), variationId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }
}
