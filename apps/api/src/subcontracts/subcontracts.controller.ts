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
  optionalSubcontractBoolean,
  optionalSubcontractString,
  optionalSubcontractUuid,
  requiredSubcontractString,
  requiredSubcontractUuid,
  subcontractAmount,
  subcontractCode,
  subcontractCurrency,
  subcontractFlag,
  subcontractInvalid,
  subcontractObject,
  subcontractSearch,
} from './subcontract-validation';
import {
  AgreementDraftInput,
  AgreementDraftUpdate,
  SubcontractorInput,
  SubcontractsService,
} from './subcontracts.service';

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

function subcontractorCreate(body: unknown): SubcontractorInput {
  const input = subcontractObject(body);
  const email = optionalSubcontractString(input, 'email', 320);
  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return subcontractInvalid('email', 'Use a valid email address.');
  }
  return {
    subcontractorCode: subcontractCode(
      requiredSubcontractString(input, 'subcontractorCode', 50),
      'subcontractorCode',
    ),
    subcontractorName: requiredSubcontractString(
      input,
      'subcontractorName',
      200,
    ),
    supplierId: optionalSubcontractUuid(input.supplierId, 'supplierId'),
    registrationNumber: optionalSubcontractString(
      input,
      'registrationNumber',
      100,
    ),
    contactName: optionalSubcontractString(input, 'contactName', 200),
    email,
    phone: optionalSubcontractString(input, 'phone', 50),
    address: optionalSubcontractString(input, 'address', 4000),
  };
}

function subcontractorUpdate(body: unknown): Partial<SubcontractorInput> {
  const input = subcontractObject(body);
  const result: Partial<SubcontractorInput> = {};
  if (input.subcontractorCode !== undefined) {
    result.subcontractorCode = subcontractCode(
      requiredSubcontractString(input, 'subcontractorCode', 50),
      'subcontractorCode',
    );
  }
  if (input.subcontractorName !== undefined) {
    result.subcontractorName = requiredSubcontractString(
      input,
      'subcontractorName',
      200,
    );
  }
  for (const [field, max] of [
    ['registrationNumber', 100],
    ['contactName', 200],
    ['email', 320],
    ['phone', 50],
    ['address', 4000],
  ] as const) {
    const value = optionalSubcontractString(input, field, max);
    if (value !== undefined) result[field] = value;
  }
  if (
    result.email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)
  ) {
    return subcontractInvalid('email', 'Use a valid email address.');
  }
  const supplierId = optionalSubcontractUuid(input.supplierId, 'supplierId');
  if (supplierId !== undefined) result.supplierId = supplierId;
  if (Object.keys(result).length === 0) {
    return subcontractInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

function agreementCreate(body: unknown): AgreementDraftInput {
  const input = subcontractObject(body);
  const status = optionalSubcontractUuid(
    input.operationalStatusId,
    'operationalStatusId',
  );
  const key = optionalSubcontractString(input, 'createKey', 120);
  return {
    projectId: requiredSubcontractUuid(input.projectId, 'projectId'),
    subcontractorId: requiredSubcontractUuid(
      input.subcontractorId,
      'subcontractorId',
    ),
    originalValue: subcontractAmount(input.originalValue),
    scopeOfWork: requiredSubcontractString(input, 'scopeOfWork', 10000),
    currencyCode: subcontractCurrency(
      requiredSubcontractString(input, 'currencyCode', 3),
    ),
    ...(status !== undefined ? { operationalStatusId: status } : {}),
    ...(key !== undefined ? { createKey: key } : {}),
  };
}

function agreementUpdate(body: unknown): AgreementDraftUpdate {
  const input = subcontractObject(body);
  const result: AgreementDraftUpdate = {};
  if (input.originalValue !== undefined) {
    result.originalValue = subcontractAmount(input.originalValue);
  }
  if (input.scopeOfWork !== undefined) {
    result.scopeOfWork = requiredSubcontractString(
      input,
      'scopeOfWork',
      10000,
    );
  }
  if (input.currencyCode !== undefined) {
    result.currencyCode = subcontractCurrency(
      requiredSubcontractString(input, 'currencyCode', 3),
    );
  }
  const status = optionalSubcontractUuid(
    input.operationalStatusId,
    'operationalStatusId',
  );
  if (status !== undefined) result.operationalStatusId = status;
  if (Object.keys(result).length === 0) {
    return subcontractInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

@Controller('subcontracts')
export class SubcontractsController {
  constructor(private readonly subcontracts: SubcontractsService) {}

  @Get('subcontractors')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.view')
  async subcontractors(
    @Req() request: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: string,
    @Query('search') search?: string,
  ) {
    return {
      data: await this.subcontracts.listSubcontractors(authOf(request), {
        includeInactive: subcontractFlag(
          includeInactive,
          'includeInactive',
        ),
        search: subcontractSearch(search),
      }),
    };
  }

  @Get('subcontractors/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.view')
  async subcontractor(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.subcontracts.getSubcontractor(authOf(request), id) };
  }

  @Post('subcontractors')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.manage')
  async createSubcontractor(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.subcontracts.createSubcontractor(
        contextOf(request),
        subcontractorCreate(body),
      ),
    };
  }

  @Patch('subcontractors/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.manage')
  async updateSubcontractor(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.subcontracts.updateSubcontractor(
        contextOf(request),
        id,
        subcontractorUpdate(body),
      ),
    };
  }

  @Post('subcontractors/:id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.archive')
  async archiveSubcontractor(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.subcontracts.archiveSubcontractor(contextOf(request), id),
    };
  }

  @Post('subcontractors/:id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.archive')
  async reactivateSubcontractor(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.subcontracts.reactivateSubcontractor(
        contextOf(request),
        id,
      ),
    };
  }

  @Get('suppliers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.subcontractor.view')
  async suppliers(@Req() request: AuthenticatedRequest) {
    return { data: await this.subcontracts.listSuppliers(authOf(request)) };
  }

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.subcontracts.projects(authOf(request)) };
  }

  @Get('agreement-statuses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.view')
  async statuses(@Req() request: AuthenticatedRequest) {
    return { data: await this.subcontracts.statuses(authOf(request)) };
  }

  @Get('agreements')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.view')
  async agreements(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId?: string,
    @Query('subcontractorId') subcontractorId?: string,
    @Query('search') search?: string,
  ) {
    return {
      data: await this.subcontracts.listAgreements(authOf(request), {
        ...(projectId
          ? { projectId: requiredSubcontractUuid(projectId, 'projectId') }
          : {}),
        ...(subcontractorId
          ? {
              subcontractorId: requiredSubcontractUuid(
                subcontractorId,
                'subcontractorId',
              ),
            }
          : {}),
        search: subcontractSearch(search),
      }),
    };
  }

  @Get('agreements/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.view')
  async agreement(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.subcontracts.getAgreement(authOf(request), id) };
  }

  @Post('agreements')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.create')
  async createAgreement(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.subcontracts.createAgreement(
        contextOf(request),
        agreementCreate(body),
      ),
    };
  }

  @Patch('agreements/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.edit')
  async updateAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.subcontracts.updateAgreement(
        contextOf(request),
        id,
        agreementUpdate(body),
      ),
    };
  }
}
