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
  procurementDate,
  procurementDecimal,
  procurementLineType,
  procurementNonEmpty,
  procurementNullableString,
  procurementObject,
  procurementString,
  procurementUuid,
} from './procurement-validation';
import { ProcurementService } from './procurement.service';

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

@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurement: ProcurementService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.procurement.projects(authOf(request)) };
  }

  @Get('projects/:projectId/options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.procurement.options(authOf(request), projectId),
    };
  }

  @Get('pr-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.procurement.workflowOptions(authOf(request)),
    };
  }

  @Get('projects/:projectId/purchase-requests')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.view')
  async listRequests(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.procurement.listRequests(authOf(request), projectId),
    };
  }

  @Get('purchase-requests/:requestId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.view')
  async getRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
  ) {
    return {
      data: await this.procurement.getRequest(authOf(request), requestId),
    };
  }

  @Post('projects/:projectId/purchase-requests')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async createRequest(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.procurement.createRequest(
        auditContext(request),
        projectId,
        procurementNullableString(input, 'remarks', 10000) ?? null,
      ),
    };
  }

  @Post('purchase-requests/:requestId/copy-rejected')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async copyRejected(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.procurement.copyRejected(
        auditContext(request),
        requestId,
        procurementNullableString(input, 'remarks', 10000),
      ),
    };
  }

  @Patch('purchase-requests/:requestId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async updateRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    if (input.remarks === undefined) {
      procurementNonEmpty({});
    }
    return {
      data: await this.procurement.updateRequest(
        auditContext(request),
        requestId,
        procurementNullableString(input, 'remarks', 10000) ?? null,
      ),
    };
  }

  @Post('purchase-requests/:requestId/lines')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async createLine(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const description =
      input.description === undefined
        ? undefined
        : procurementString(input, 'description', 500);
    return {
      data: await this.procurement.createLine(
        auditContext(request),
        requestId,
        {
          lineType: procurementLineType(input.lineType),
          materialId: procurementUuid(input.materialId, 'materialId', true),
          ...(description !== undefined ? { description } : {}),
          quantity: procurementDecimal(input.quantity, 'quantity'),
          uomId: procurementUuid(input.uomId, 'uomId')!,
          wbsId: procurementUuid(input.wbsId, 'wbsId', true),
          costCodeId: procurementUuid(
            input.costCodeId,
            'costCodeId',
            true,
          ),
          activityId: procurementUuid(input.activityId, 'activityId', true),
          requiredOnSite: procurementDate(
            input.requiredOnSite,
            'requiredOnSite',
            true,
          ),
        },
      ),
    };
  }

  @Patch('purchase-request-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const data = {
      ...(input.lineType !== undefined
        ? { lineType: procurementLineType(input.lineType) }
        : {}),
      ...(input.materialId !== undefined
        ? {
            materialId: procurementUuid(
              input.materialId,
              'materialId',
              true,
            ),
          }
        : {}),
      ...(input.description !== undefined
        ? { description: procurementString(input, 'description', 500) }
        : {}),
      ...(input.quantity !== undefined
        ? { quantity: procurementDecimal(input.quantity, 'quantity') }
        : {}),
      ...(input.uomId !== undefined
        ? { uomId: procurementUuid(input.uomId, 'uomId')! }
        : {}),
      ...(input.wbsId !== undefined
        ? { wbsId: procurementUuid(input.wbsId, 'wbsId', true) }
        : {}),
      ...(input.costCodeId !== undefined
        ? {
            costCodeId: procurementUuid(
              input.costCodeId,
              'costCodeId',
              true,
            ),
          }
        : {}),
      ...(input.activityId !== undefined
        ? {
            activityId: procurementUuid(
              input.activityId,
              'activityId',
              true,
            ),
          }
        : {}),
      ...(input.requiredOnSite !== undefined
        ? {
            requiredOnSite: procurementDate(
              input.requiredOnSite,
              'requiredOnSite',
              true,
            ),
          }
        : {}),
    };
    procurementNonEmpty(data);
    return {
      data: await this.procurement.updateLine(
        auditContext(request),
        lineId,
        data,
      ),
    };
  }

  @Delete('purchase-request-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.manage')
  async deleteLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
  ) {
    return {
      data: await this.procurement.deleteLine(
        auditContext(request),
        lineId,
      ),
    };
  }

  @Post('purchase-requests/:requestId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.submit')
  async submitRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.procurement.submitRequest(
        auditContext(request),
        requestId,
        procurementString(input, 'workflowCode', 80),
      ),
    };
  }

  @Post('purchase-requests/:requestId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.approve')
  async approveRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const comment = procurementNullableString(input, 'comment', 5000);
    return {
      data: await this.procurement.approveRequest(
        auditContext(request),
        requestId,
        comment ?? undefined,
      ),
    };
  }

  @Post('purchase-requests/:requestId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.approve')
  async rejectRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const comment = procurementNullableString(input, 'comment', 5000);
    return {
      data: await this.procurement.rejectRequest(
        auditContext(request),
        requestId,
        comment ?? undefined,
      ),
    };
  }

  @Post('purchase-requests/:requestId/cancel')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.pr.cancel')
  async cancelRequest(
    @Req() request: AuthenticatedRequest,
    @Param('requestId', new ParseUUIDPipe({ version: '4' }))
    requestId: string,
  ) {
    return {
      data: await this.procurement.cancelRequest(
        auditContext(request),
        requestId,
      ),
    };
  }
}
