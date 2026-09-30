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
  optionalSubcontractString,
  requiredSubcontractString,
  requiredSubcontractUuid,
  subcontractInvalid,
  subcontractObject,
} from './subcontract-validation';
import {
  SubcontractsVariationService,
  VariationDraftInput,
  VariationDraftUpdate,
} from './subcontracts-variation.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function contextOf(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId ? { correlationId: request.correlationId } : {}),
  };
}

function signedAmount(value: unknown): string {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!/^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(text)) {
    return subcontractInvalid(
      'valueDelta',
      'Use a signed DECIMAL(18,2) amount with at most 16 integer digits.',
    );
  }
  return text;
}

function variationCreate(body: unknown): VariationDraftInput {
  const input = subcontractObject(body);
  return {
    valueDelta: signedAmount(input.valueDelta),
    scopeChange: requiredSubcontractString(input, 'scopeChange', 10000),
    reason: requiredSubcontractString(input, 'reason', 10000),
    createKey: requiredSubcontractString(input, 'createKey', 120),
  };
}

function variationUpdate(body: unknown): VariationDraftUpdate {
  const input = subcontractObject(body);
  const result: VariationDraftUpdate = {};
  if (input.valueDelta !== undefined) result.valueDelta = signedAmount(input.valueDelta);
  if (input.scopeChange !== undefined) {
    result.scopeChange = requiredSubcontractString(input, 'scopeChange', 10000);
  }
  if (input.reason !== undefined) {
    result.reason = requiredSubcontractString(input, 'reason', 10000);
  }
  if (Object.keys(result).length === 0) {
    return subcontractInvalid('body', 'Provide at least one Variation field to update.');
  }
  return result;
}

function submitAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    workflowCode: requiredSubcontractString(input, 'workflowCode', 80),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

function approvalAction(body: unknown) {
  const input = subcontractObject(body);
  const comment = optionalSubcontractString(input, 'comment', 5000);
  return {
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
    ...(comment ? { comment } : {}),
  };
}

function reasonAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    reason: requiredSubcontractString(input, 'reason', 10000),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

@Controller('subcontracts')
export class SubcontractsVariationController {
  constructor(private readonly variations: SubcontractsVariationService) {}

  @Get('variation-agreement-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view')
  async agreementOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.variations.agreementOptions(authOf(request)) };
  }

  @Get('variation-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.variations.workflowOptions(authOf(request)) };
  }

  @Get('agreements/:agreementId/variations')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) agreementId: string,
  ) {
    return {
      data: await this.variations.listVariations(authOf(request), agreementId),
    };
  }

  @Get('variations/:variationId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
  ) {
    return {
      data: await this.variations.getVariation(authOf(request), variationId),
    };
  }

  @Post('agreements/:agreementId/variations')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' })) agreementId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.variations.createVariation(
        contextOf(request),
        agreementId,
        variationCreate(body),
      ),
    };
  }

  @Patch('variations/:variationId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.variations.updateVariation(
        contextOf(request),
        variationId,
        variationUpdate(body),
      ),
    };
  }

  @Post('variations/:variationId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = submitAction(body);
    return {
      data: await this.variations.submitVariation(
        contextOf(request),
        variationId,
        input.workflowCode,
        input.actionKey,
      ),
    };
  }

  @Post('variations/:variationId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = approvalAction(body);
    return {
      data: await this.variations.approveVariation(
        contextOf(request),
        variationId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('variations/:variationId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.reject')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.variations.rejectVariation(
        contextOf(request),
        variationId,
        input.reason,
        input.actionKey,
      ),
    };
  }

  @Post('variations/:variationId/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.variation.view', 'subcontracts.variation.reverse')
  async reverse(
    @Req() request: AuthenticatedRequest,
    @Param('variationId', new ParseUUIDPipe({ version: '4' })) variationId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.variations.reverseVariation(
        contextOf(request),
        variationId,
        input.reason,
        input.actionKey,
      ),
    };
  }

  @Get('reports/agreements')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.report.view')
  async report(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
  ) {
    return {
      data: await this.variations.reportAgreements(
        authOf(request),
        projectId
          ? requiredSubcontractUuid(projectId, 'projectId')
          : undefined,
      ),
    };
  }
}
