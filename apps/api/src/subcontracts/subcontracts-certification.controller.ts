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
  optionalSubcontractString,
  requiredSubcontractString,
  subcontractInvalid,
  subcontractObject,
} from './subcontract-validation';
import {
  CertificationDraftInput,
  CertificationDraftUpdate,
  SubcontractsCertificationService,
} from './subcontracts-certification.service';

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

function certificationCreate(body: unknown): CertificationDraftInput {
  const input = subcontractObject(body);
  return {
    certifiedGross: nonnegativeAmount(
      input.certifiedGross,
      'certifiedGross',
    ),
  };
}

function certificationUpdate(body: unknown): CertificationDraftUpdate {
  const input = subcontractObject(body);
  if (input.certifiedGross === undefined) {
    return subcontractInvalid(
      'body',
      'Provide certifiedGross to update.',
    );
  }
  return {
    certifiedGross: nonnegativeAmount(
      input.certifiedGross,
      'certifiedGross',
    ),
  };
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
export class SubcontractsCertificationController {
  constructor(
    private readonly certifications: SubcontractsCertificationService,
  ) {}

  @Get('certification-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.submit',
  )
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.certifications.workflowOptions(authOf(request)),
    };
  }

  @Get('agreements/:agreementId/certifications')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.certification.view')
  async certificationsForAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.certifications.listCertifications(
        authOf(request),
        agreementId,
      ),
    };
  }

  @Get('certifications/:certificationId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.certification.view')
  async certification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
  ) {
    return {
      data: await this.certifications.getCertification(
        authOf(request),
        certificationId,
      ),
    };
  }

  @Get('certifications/:certificationId/finance-reference')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'finance.payment.view',
  )
  async financeReference(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
  ) {
    return {
      data: await this.certifications.financeReference(
        authOf(request),
        certificationId,
      ),
    };
  }

  @Post('claims/:claimId/certifications')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.create',
  )
  async createCertification(
    @Req() request: AuthenticatedRequest,
    @Param('claimId', new ParseUUIDPipe({ version: '4' }))
    claimId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.certifications.createCertification(
        contextOf(request),
        claimId,
        certificationCreate(body),
      ),
    };
  }

  @Patch('certifications/:certificationId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.edit',
  )
  async updateCertification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.certifications.updateCertification(
        contextOf(request),
        certificationId,
        certificationUpdate(body),
      ),
    };
  }

  @Post('certifications/:certificationId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.submit',
  )
  async submitCertification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
    @Body() body: unknown,
  ) {
    const input = submitAction(body);
    return {
      data: await this.certifications.submitCertification(
        contextOf(request),
        certificationId,
        input.workflowCode,
        input.actionKey,
      ),
    };
  }

  @Post('certifications/:certificationId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.approve',
  )
  async approveCertification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
    @Body() body: unknown,
  ) {
    const input = approvalAction(body);
    return {
      data: await this.certifications.approveCertification(
        contextOf(request),
        certificationId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('certifications/:certificationId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.reject',
  )
  async rejectCertification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.certifications.rejectCertification(
        contextOf(request),
        certificationId,
        input.reason,
        input.actionKey,
      ),
    };
  }

  @Post('certifications/:certificationId/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions(
    'subcontracts.certification.view',
    'subcontracts.certification.reverse',
  )
  async reverseCertification(
    @Req() request: AuthenticatedRequest,
    @Param('certificationId', new ParseUUIDPipe({ version: '4' }))
    certificationId: string,
    @Body() body: unknown,
  ) {
    const input = reasonAction(body);
    return {
      data: await this.certifications.reverseCertification(
        contextOf(request),
        certificationId,
        input.reason,
        input.actionKey,
      ),
    };
  }
}
