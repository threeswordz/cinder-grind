import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { physicalCommand } from './subcontract-physical-contract';
import { SubcontractsClaimsService } from './subcontracts-claims.service';
import { SubcontractsPhysicalService } from './subcontracts-physical.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const context = (request: AuthenticatedRequest) => ({ auth: request.auth!,
  ...(request.correlationId ? { correlationId: request.correlationId } : {}) });

@Controller('subcontracts/physical')
export class SubcontractsPhysicalController {
  constructor(private readonly physical: SubcontractsPhysicalService, private readonly claims: SubcontractsClaimsService) {}

  @Post('projects/:projectId/enable')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.physical.configure', 'subcontracts.physical.view')
  async enable(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Body() body: unknown) {
    return { data: await this.physical.enable(context(request), projectId, body) };
  }

  @Get('claims/:claimId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.physical.view', 'subcontracts.claim.view')
  async get(@Req() request: AuthenticatedRequest, @Param('claimId', uuid) claimId: string) {
    return { data: await this.physical.get(request.auth!, claimId) };
  }

  @Post('claims/:claimId/capture')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.physical.view', 'subcontracts.physical.edit', 'subcontracts.claim.view', 'subcontracts.claim.edit')
  async capture(@Req() request: AuthenticatedRequest, @Param('claimId', uuid) claimId: string, @Body() body: unknown) {
    return { data: await this.physical.capture(context(request), claimId, body) };
  }

  @Post('claims/:claimId/decide')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.physical.view', 'subcontracts.physical.decide', 'subcontracts.claim.view', 'subcontracts.assessment.assess', 'documents.document.view')
  async decide(@Req() request: AuthenticatedRequest, @Param('claimId', uuid) claimId: string, @Body() body: unknown) {
    const input = physicalCommand(body);
    return { data: await this.claims.assessClaim(context(request), claimId, {
      assessedAmount: '0', reason: input.reason, actionKey: input.requestKey, physicalDecision: body,
    }) };
  }
}
