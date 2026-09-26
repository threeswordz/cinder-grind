import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  invalid,
  optionalBoolean,
  optionalTrimmedString,
  requireObject,
  requiredTrimmedString,
  validateCode,
} from './admin-validation';
import { ApprovalAdminService } from './approval-admin.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function auditContext(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId
      ? { correlationId: request.correlationId }
      : {}),
  };
}

function parseSteps(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw invalid('steps', 'Must contain between 1 and 20 approval steps.');
  }

  return value.map((item, index) => {
    const record = requireObject(item);
    const stepNo = record.stepNo;
    const requiredApprovals = record.requiredApprovals;
    const roleIds = record.roleIds;

    if (!Number.isInteger(stepNo) || (stepNo as number) < 1) {
      throw invalid('steps[' + index + '].stepNo', 'Must be a positive integer.');
    }
    if (
      !Number.isInteger(requiredApprovals) ||
      (requiredApprovals as number) < 1
    ) {
      throw invalid(
        'steps[' + index + '].requiredApprovals',
        'Must be a positive integer.',
      );
    }
    if (
      !Array.isArray(roleIds) ||
      roleIds.length < 1 ||
      roleIds.length > 50 ||
      !roleIds.every((roleId) => typeof roleId === 'string')
    ) {
      throw invalid(
        'steps[' + index + '].roleIds',
        'Must contain between 1 and 50 Role IDs.',
      );
    }

    return {
      stepNo: stepNo as number,
      stepName: requiredTrimmedString(record, 'stepName', 150),
      requiredApprovals: requiredApprovals as number,
      roleIds: roleIds as string[],
    };
  });
}

@Controller('admin/approval-workflows')
export class ApprovalAdminController {
  constructor(private readonly approvals: ApprovalAdminService) {}

  @Get('role-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.approval_matrix.manage')
  async roleOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.approvals.listRoleOptions(authOf(request).companyId),
    };
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.approval_matrix.manage')
  async list(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.approvals.listWorkflows(authOf(request).companyId),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.approval_matrix.manage')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    return {
      data: await this.approvals.createWorkflow(auditContext(request), {
        workflowCode: validateCode(
          requiredTrimmedString(input, 'workflowCode', 80),
          'workflowCode',
          80,
        ),
        entityType: validateCode(
          requiredTrimmedString(input, 'entityType', 100),
          'entityType',
          100,
        ),
        workflowName: requiredTrimmedString(input, 'workflowName', 150),
        steps: parseSteps(input.steps),
      }),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.approval_matrix.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const workflowName = optionalTrimmedString(
      input,
      'workflowName',
      150,
    );
    const isActive = optionalBoolean(input, 'isActive');

    if (workflowName === undefined && isActive === undefined) {
      throw invalid('body', 'Provide a workflow name or active status.');
    }

    return {
      data: await this.approvals.updateWorkflow(
        auditContext(request),
        id,
        {
          ...(workflowName !== undefined ? { workflowName } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
        },
      ),
    };
  }

  @Put(':id/steps')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.approval_matrix.manage')
  async replaceSteps(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    return {
      data: await this.approvals.replaceSteps(
        auditContext(request),
        id,
        parseSteps(input.steps),
      ),
    };
  }
}
