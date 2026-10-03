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
  costDate,
  costNonEmpty,
  costNullableString,
  costObject,
  costPositiveDecimal,
  costString,
  costUuid,
} from './cost-control-validation';
import { DirectCostService } from './direct-cost.service';

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

@Controller('cost-control')
export class DirectCostController {
  constructor(private readonly directCost: DirectCostService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.control.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.directCost.projects(authOf(request)) };
  }

  @Get('direct-cost-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.directCost.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/direct-cost-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.control.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.directCost.options(authOf(request), projectId) };
  }

  @Get('projects/:projectId/direct-cost-postings')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.control.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.directCost.list(authOf(request), projectId) };
  }

  @Get('direct-cost-postings/:postingId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('cost.control.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
  ) {
    return { data: await this.directCost.get(authOf(request), postingId) };
  }

  @Post('projects/:projectId/direct-cost-postings')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.directCost.create(contextOf(request), projectId, {
        postingDate: costDate(input, 'postingDate'),
        description: costString(input, 'description', 500),
        reference: costNullableString(input, 'reference', 200),
        amount: costPositiveDecimal(input, 'amount'),
        wbsId: costUuid(input, 'wbsId', true),
        costCodeId: costUuid(input, 'costCodeId')!,
        createKey: costString(input, 'createKey', 120),
      }),
    };
  }

  @Patch('direct-cost-postings/:postingId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.create')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    const data = {
      ...(input.postingDate !== undefined
        ? { postingDate: costDate(input, 'postingDate') }
        : {}),
      ...(input.description !== undefined
        ? { description: costString(input, 'description', 500) }
        : {}),
      ...(input.reference !== undefined
        ? { reference: costNullableString(input, 'reference', 200) }
        : {}),
      ...(input.amount !== undefined
        ? { amount: costPositiveDecimal(input, 'amount') }
        : {}),
      ...(input.wbsId !== undefined
        ? { wbsId: costUuid(input, 'wbsId', true) }
        : {}),
      ...(input.costCodeId !== undefined
        ? { costCodeId: costUuid(input, 'costCodeId')! }
        : {}),
    };
    costNonEmpty(data);
    return {
      data: await this.directCost.update(contextOf(request), postingId, data),
    };
  }

  @Post('direct-cost-postings/:postingId/reversal')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.create')
  async createReversal(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.directCost.createReversal(
        contextOf(request),
        postingId,
        {
          postingDate: costDate(input, 'postingDate'),
          reason: costString(input, 'reason', 5000),
          reference: costNullableString(input, 'reference', 200),
          createKey: costString(input, 'createKey', 120),
        },
      ),
    };
  }

  @Post('direct-cost-postings/:postingId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.directCost.submit(
        contextOf(request),
        postingId,
        costString(input, 'workflowCode', 80),
        costString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('direct-cost-postings/:postingId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.directCost.approve(
        contextOf(request),
        postingId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('direct-cost-postings/:postingId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('cost.direct_posting.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('postingId', new ParseUUIDPipe({ version: '4' })) postingId: string,
    @Body() body: unknown,
  ) {
    const input = costObject(body);
    return {
      data: await this.directCost.reject(
        contextOf(request),
        postingId,
        costString(input, 'actionKey', 120),
        costNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }
}
