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
  optionalSubcontractUuid,
  requiredSubcontractString,
  subcontractInvalid,
  subcontractObject,
  subcontractPositiveAmount,
} from './subcontract-validation';
import {
  AgreementRevisionInput,
  AgreementRevisionUpdate,
  SubcontractsWorkflowService,
  WorkOrderDraftInput,
  WorkOrderDraftUpdate,
} from './subcontracts-workflow.service';

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

function workflowAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    workflowCode: requiredSubcontractString(input, 'workflowCode', 80),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

function decisionAction(body: unknown) {
  const input = subcontractObject(body);
  const comment = optionalSubcontractString(input, 'comment', 5000);
  return {
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
    ...(comment ? { comment } : {}),
  };
}

function cancellationAction(body: unknown) {
  const input = subcontractObject(body);
  return {
    reason: requiredSubcontractString(input, 'reason', 10000),
    actionKey: requiredSubcontractString(input, 'actionKey', 120),
  };
}

function revisionCreate(body: unknown): AgreementRevisionInput {
  const input = subcontractObject(body);
  const operationalStatusId = optionalSubcontractUuid(
    input.operationalStatusId,
    'operationalStatusId',
  );
  return {
    reason: requiredSubcontractString(input, 'reason', 10000),
    ...(operationalStatusId !== undefined ? { operationalStatusId } : {}),
  };
}

function revisionUpdate(body: unknown): AgreementRevisionUpdate {
  const input = subcontractObject(body);
  const result: AgreementRevisionUpdate = {};

  if (input.operationalStatusId !== undefined) {
    result.operationalStatusId =
      optionalSubcontractUuid(
        input.operationalStatusId,
        'operationalStatusId',
      ) ?? null;
  }
  if (input.reason !== undefined) {
    result.reason = requiredSubcontractString(input, 'reason', 10000);
  }
  if (Object.keys(result).length === 0) {
    return subcontractInvalid(
      'body',
      'Provide at least one revision field to update.',
    );
  }
  return result;
}

function workOrderCreate(body: unknown): WorkOrderDraftInput {
  const input = subcontractObject(body);
  const wbsElementId = optionalSubcontractUuid(
    input.wbsElementId,
    'wbsElementId',
  );
  const costCodeId = optionalSubcontractUuid(input.costCodeId, 'costCodeId');
  return {
    scopeOfWork: requiredSubcontractString(input, 'scopeOfWork', 10000),
    amount: subcontractPositiveAmount(input.amount, 'amount'),
    ...(wbsElementId !== undefined ? { wbsElementId } : {}),
    ...(costCodeId !== undefined ? { costCodeId } : {}),
  };
}

function workOrderUpdate(body: unknown): WorkOrderDraftUpdate {
  const input = subcontractObject(body);
  const result: WorkOrderDraftUpdate = {};

  if (input.scopeOfWork !== undefined) {
    result.scopeOfWork = requiredSubcontractString(
      input,
      'scopeOfWork',
      10000,
    );
  }
  if (input.amount !== undefined) {
    result.amount = subcontractPositiveAmount(input.amount, 'amount');
  }
  if (input.wbsElementId !== undefined) {
    result.wbsElementId =
      optionalSubcontractUuid(input.wbsElementId, 'wbsElementId') ?? null;
  }
  if (input.costCodeId !== undefined) {
    result.costCodeId =
      optionalSubcontractUuid(input.costCodeId, 'costCodeId') ?? null;
  }
  if (Object.keys(result).length === 0) {
    return subcontractInvalid(
      'body',
      'Provide at least one Work Order field to update.',
    );
  }
  return result;
}

@Controller('subcontracts')
export class SubcontractsWorkflowController {
  constructor(
    private readonly workflow: SubcontractsWorkflowService,
  ) {}

  @Get('agreement-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.submit')
  async agreementWorkflowOptions(
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.workflow.workflowOptions(
        authOf(request),
        'SUBCONTRACT_AGREEMENT',
      ),
    };
  }

  @Get('work-order-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.submit')
  async workOrderWorkflowOptions(
    @Req() request: AuthenticatedRequest,
  ) {
    return {
      data: await this.workflow.workflowOptions(
        authOf(request),
        'SUBCONTRACT_WORK_ORDER',
      ),
    };
  }

  @Get('agreements/:agreementId/versions')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.view')
  async versions(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.workflow.agreementVersions(
        authOf(request),
        agreementId,
      ),
    };
  }

  @Post('agreements/:agreementId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.submit')
  async submitAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    const input = workflowAction(body);
    return {
      data: await this.workflow.submitInitialAgreement(
        contextOf(request),
        agreementId,
        input.workflowCode,
        input.actionKey,
      ),
    };
  }

  @Post('agreements/:agreementId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.approve')
  async approveAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.approveInitialAgreement(
        contextOf(request),
        agreementId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('agreements/:agreementId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.reject')
  async rejectAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.rejectInitialAgreement(
        contextOf(request),
        agreementId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('agreements/:agreementId/revisions')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.revise')
  async createRevision(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.workflow.createRevision(
        contextOf(request),
        agreementId,
        revisionCreate(body),
      ),
    };
  }

  @Patch('agreement-versions/:versionId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.revise')
  async updateRevision(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', new ParseUUIDPipe({ version: '4' }))
    versionId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.workflow.updateRevision(
        contextOf(request),
        versionId,
        revisionUpdate(body),
      ),
    };
  }

  @Post('agreement-versions/:versionId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.submit')
  async submitRevision(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', new ParseUUIDPipe({ version: '4' }))
    versionId: string,
    @Body() body: unknown,
  ) {
    const input = workflowAction(body);
    return {
      data: await this.workflow.submitRevision(
        contextOf(request),
        versionId,
        input.workflowCode,
        input.actionKey,
      ),
    };
  }

  @Post('agreement-versions/:versionId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.approve')
  async approveRevision(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', new ParseUUIDPipe({ version: '4' }))
    versionId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.approveRevision(
        contextOf(request),
        versionId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('agreement-versions/:versionId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.reject')
  async rejectRevision(
    @Req() request: AuthenticatedRequest,
    @Param('versionId', new ParseUUIDPipe({ version: '4' }))
    versionId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.rejectRevision(
        contextOf(request),
        versionId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('agreements/:agreementId/cancel')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.agreement.cancel')
  async cancelAgreement(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    const input = cancellationAction(body);
    return {
      data: await this.workflow.cancelAgreement(
        contextOf(request),
        agreementId,
        input.reason,
        input.actionKey,
      ),
    };
  }

  @Get('agreements/:agreementId/work-order-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.view')
  async workOrderOptions(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.workflow.workOrderOptions(
        authOf(request),
        agreementId,
      ),
    };
  }

  @Get('agreements/:agreementId/work-orders')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.view')
  async workOrders(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
  ) {
    return {
      data: await this.workflow.listWorkOrders(
        authOf(request),
        agreementId,
      ),
    };
  }

  @Get('work-orders/:workOrderId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.view')
  async workOrder(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ParseUUIDPipe({ version: '4' }))
    workOrderId: string,
  ) {
    return {
      data: await this.workflow.getWorkOrder(
        authOf(request),
        workOrderId,
      ),
    };
  }

  @Post('agreements/:agreementId/work-orders')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.create')
  async createWorkOrder(
    @Req() request: AuthenticatedRequest,
    @Param('agreementId', new ParseUUIDPipe({ version: '4' }))
    agreementId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.workflow.createWorkOrder(
        contextOf(request),
        agreementId,
        workOrderCreate(body),
      ),
    };
  }

  @Patch('work-orders/:workOrderId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.edit')
  async updateWorkOrder(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ParseUUIDPipe({ version: '4' }))
    workOrderId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.workflow.updateWorkOrder(
        contextOf(request),
        workOrderId,
        workOrderUpdate(body),
      ),
    };
  }

  @Post('work-orders/:workOrderId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.submit')
  async submitWorkOrder(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ParseUUIDPipe({ version: '4' }))
    workOrderId: string,
    @Body() body: unknown,
  ) {
    const input = workflowAction(body);
    return {
      data: await this.workflow.submitWorkOrder(
        contextOf(request),
        workOrderId,
        input.workflowCode,
        input.actionKey,
      ),
    };
  }

  @Post('work-orders/:workOrderId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.approve')
  async approveWorkOrder(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ParseUUIDPipe({ version: '4' }))
    workOrderId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.approveWorkOrder(
        contextOf(request),
        workOrderId,
        input.actionKey,
        input.comment,
      ),
    };
  }

  @Post('work-orders/:workOrderId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('subcontracts.work_order.reject')
  async rejectWorkOrder(
    @Req() request: AuthenticatedRequest,
    @Param('workOrderId', new ParseUUIDPipe({ version: '4' }))
    workOrderId: string,
    @Body() body: unknown,
  ) {
    const input = decisionAction(body);
    return {
      data: await this.workflow.rejectWorkOrder(
        contextOf(request),
        workOrderId,
        input.actionKey,
        input.comment,
      ),
    };
  }
}
