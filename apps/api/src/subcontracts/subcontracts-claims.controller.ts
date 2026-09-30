import {
  Body,
  Controller,
  Delete,
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
  optionalSubcontractUuid,
  requiredSubcontractString,
  subcontractInvalid,
  subcontractObject,
  subcontractPositiveAmount,
} from './subcontract-validation';
import {
  ClaimDraftInput,
  ClaimDraftUpdate,
  ClaimLineInput,
  ClaimLineUpdate,
  SubcontractsClaimsService,
} from './subcontracts-claims.service';

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

function claimDate(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return subcontractInvalid(field, 'Use an ISO calendar date YYYY-MM-DD.');
  }
  const date = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return subcontractInvalid(field, 'Use a valid calendar date YYYY-MM-DD.');
  }
  return date;
}

function nonnegativeAmount(value: unknown, field: string): string {
  const text =
    typeof value === 'number' && Number.isFinite(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : '';
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(text)) {
    return subcontractInvalid(
      field,
      'Use a nonnegative DECIMAL(18,2) amount with at most 16 integer digits.',
    );
  }
  return text;
}

function claimCreate(body: unknown): ClaimDraftInput {
  const input = subcontractObject(body);
  return {
    periodStart: claimDate(input.periodStart, 'periodStart'),
    periodEnd: claimDate(input.periodEnd, 'periodEnd'),
  };
}

function claimUpdate(body: unknown): ClaimDraftUpdate {
  const input = subcontractObject(body);
  const result: ClaimDraftUpdate = {};
  if (input.periodStart !== undefined) {
    result.periodStart = claimDate(input.periodStart, 'periodStart');
  }
  if (input.periodEnd !== undefined) {
    result.periodEnd = claimDate(input.periodEnd, 'periodEnd');
  }
  if (Object.keys(result).length === 0) {
    return subcontractInvalid(
      'body',
      'Provide periodStart and/or periodEnd to update.',
    );
  }
  return result;
}

function lineCreate(body: unknown): ClaimLineInput {
  const input = subcontractObject(body);
  const workOrderId = optionalSubcontractUuid(
    input.workOrderId,
    'workOrderId',
  );
  return {
    amount: subcontractPositiveAmount(input.amount, 'amount'),
    ...(workOrderId !== undefined ? { workOrderId } : {}),
  };
}

function lineUpdate(body: unknown): ClaimLineUpdate {
  const input = subcontractObject(body);
  const result: ClaimLineUpdate = {};
  if (input.amount !== undefined) {
    result.amount = subcontractPositiveAmount(input.amount, 'amount');
  }
  if (input.workOrderId !== undefined) {
    result.workOrderId =
      optionalSubcontractUuid(input.workOrderId, 'workOrderId') ?? null;
  }
  if (Object.keys(result).length === 0) {
    return subcontractInvalid(
      'body',
      'Provide amount and/or workOrderId to update.',
    );
  }
  return result;
}

function actionKey(body: unknown) {
  const input = subcontractObject(body);
  return {
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

function reasonAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    reason: requiredSubcontractString(input, 'reason', 10000),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

function assessmentAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    assessedAmount: nonnegativeAmount(
      input.assessedAmount,
      'assessedAmount',
    ),
    reason: requiredSubcontractString(input, 'reason', 10000),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

@Controller('subcontracts')
export class SubcontractsClaimsController {
  constructor(private readonly claims: SubcontractsClaimsService) {}

  @Get('claim-agreement-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.view')
  async claimAgreementOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.claims.claimAgreementOptions(authOf(request)),
    };
  }

  @Get('agreements/:agreementId/claim-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.view')
  async claimOptions(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.claims.claimOptions(authOf(request), agreementId),
    };
  }

  @Get('agreements/:agreementId/claims')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.view')
  async listClaims(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.claims.listClaims(authOf(request), agreementId),
    };
  }

  @Get('claims/:claimId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.view')
  async getClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
  ) {
    return { data: await this.claims.getClaim(authOf(request), claimId) };
  }

  @Post('agreements/:agreementId/claims')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.create')
  async createClaim(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.claims.createClaim(
        contextOf(request),
        agreementId,
        claimCreate(body),
      ),
    };
  }

  @Patch('claims/:claimId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.edit')
  async updateClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.claims.updateClaim(
        contextOf(request),
        claimId,
        claimUpdate(body),
      ),
    };
  }

  @Post('claims/:claimId/lines')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.edit')
  async addLine(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.claims.addLine(
        contextOf(request),
        claimId,
        lineCreate(body),
      ),
    };
  }

  @Patch('claim-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.edit')
  async updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.claims.updateLine(
        contextOf(request),
        lineId,
        lineUpdate(body),
      ),
    };
  }

  @Delete('claim-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.edit')
  async deleteLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
  ) {
    return {
      data: await this.claims.deleteLine(contextOf(request), lineId),
    };
  }

  @Post('claims/:claimId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.submit')
  async submitClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    const input = actionKey(body);
    return {
      data: await this.claims.submitClaim(
        contextOf(request),
        claimId,
        input.actionKey,
      ),
    };
  }

  @Post('claims/:claimId/withdraw')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.withdraw')
  async withdrawClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.claims.withdrawClaim(
        contextOf(request),
        claimId,
        input.reason,
        input.actionKey,
      ),
    };
  }

  @Post('claims/:claimId/replacements')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.claim.create')
  async createReplacement(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
  ) {
    return {
      data: await this.claims.createReplacement(
        contextOf(request),
        claimId,
      ),
    };
  }

  @Post('claims/:claimId/assess')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.assessment.assess')
  async assessClaim(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.claims.assessClaim(
        contextOf(request),
        claimId,
        assessmentAction(body),
      ),
    };
  }

  @Post('claims/:claimId/assessment/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.assessment.reject')
  async rejectAssessment(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' })) claimId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.claims.rejectAssessment(
        contextOf(request),
        claimId,
        input.reason,
        input.actionKey,
      ),
    };
  }
}
