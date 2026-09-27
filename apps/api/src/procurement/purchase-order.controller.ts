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
  procurementArray,
  procurementDate,
  procurementDecimal,
  procurementNonEmpty,
  procurementNonnegativeDecimal,
  procurementNullableString,
  procurementObject,
  procurementString,
  procurementUuid,
} from './procurement-validation';
import { PurchaseOrderService } from './purchase-order.service';

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
export class PurchaseOrderController {
  constructor(private readonly purchaseOrders: PurchaseOrderService) {}

  @Get('po-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.purchaseOrders.projects(authOf(request)),
    };
  }

  @Get('po-create-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.create')
  async createProjects(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.purchaseOrders.projects(authOf(request)),
    };
  }

  @Get('po-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.purchaseOrders.workflowOptions(
        authOf(request),
      ),
    };
  }

  @Get('projects/:projectId/po-awards')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.create')
  async awards(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.purchaseOrders.availableAwards(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('projects/:projectId/purchase-orders')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.purchaseOrders.listOrders(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('purchase-orders/:orderId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return {
      data: await this.purchaseOrders.getOrder(
        authOf(request),
        orderId,
      ),
    };
  }

  @Get('purchase-orders/:orderId/revisions')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  async revisions(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
  ) {
    return {
      data: await this.purchaseOrders.revisions(
        authOf(request),
        orderId,
      ),
    };
  }

  @Post('projects/:projectId/purchase-orders')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const awardIds = procurementArray(
      input.awardIds,
      'awardIds',
    ).map((value, index) =>
      procurementUuid(value, 'awardIds[' + index + ']'),
    ) as string[];

    return {
      data: await this.purchaseOrders.createOrder(
        auditContext(request),
        projectId,
        awardIds,
        procurementNullableString(input, 'remarks', 10000) ??
          null,
      ),
    };
  }

  @Patch('purchase-orders/:orderId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const data = {
      ...(input.remarks !== undefined
        ? {
            remarks:
              procurementNullableString(
                input,
                'remarks',
                10000,
              ) ?? null,
          }
        : {}),
      ...(input.revisionReason !== undefined
        ? {
            revisionReason:
              procurementNullableString(
                input,
                'revisionReason',
                10000,
              ) ?? null,
          }
        : {}),
    };
    procurementNonEmpty(data);
    return {
      data: await this.purchaseOrders.updateOrder(
        auditContext(request),
        orderId,
        data,
      ),
    };
  }

  @Patch('purchase-order-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.edit')
  async updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' }))
    lineId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const data = {
      ...(input.quantity !== undefined
        ? {
            quantity: procurementDecimal(
              input.quantity,
              'quantity',
            ),
          }
        : {}),
      ...(input.unitPrice !== undefined
        ? {
            unitPrice: procurementNonnegativeDecimal(
              input.unitPrice,
              'unitPrice',
            ),
          }
        : {}),
      ...(input.wbsId !== undefined
        ? {
            wbsId: procurementUuid(
              input.wbsId,
              'wbsId',
              true,
            ),
          }
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
      ...(input.requiredOnSite !== undefined
        ? {
            requiredOnSite: procurementDate(
              input.requiredOnSite,
              'requiredOnSite',
              true,
            ),
          }
        : {}),
      ...(input.expectedDelivery !== undefined
        ? {
            expectedDelivery: procurementDate(
              input.expectedDelivery,
              'expectedDelivery',
              true,
            ),
          }
        : {}),
      ...(input.remarks !== undefined
        ? {
            remarks:
              procurementNullableString(
                input,
                'remarks',
                10000,
              ) ?? null,
          }
        : {}),
    };
    procurementNonEmpty(data);
    return {
      data: await this.purchaseOrders.updateLine(
        auditContext(request),
        lineId,
        data,
      ),
    };
  }

  @Delete('purchase-order-lines/:lineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.edit')
  async deleteLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' }))
    lineId: string,
  ) {
    return {
      data: await this.purchaseOrders.deleteLine(
        auditContext(request),
        lineId,
      ),
    };
  }

  @Post('purchase-orders/:orderId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.purchaseOrders.submit(
        auditContext(request),
        orderId,
        procurementString(input, 'workflowCode', 80),
      ),
    };
  }

  @Post('purchase-orders/:orderId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const comment = procurementNullableString(
      input,
      'comment',
      5000,
    );
    return {
      data: await this.purchaseOrders.approve(
        auditContext(request),
        orderId,
        comment ?? undefined,
      ),
    };
  }

  @Post('purchase-orders/:orderId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.reject')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const comment = procurementNullableString(
      input,
      'comment',
      5000,
    );
    return {
      data: await this.purchaseOrders.reject(
        auditContext(request),
        orderId,
        comment ?? undefined,
      ),
    };
  }

  @Post('purchase-orders/:orderId/cancel')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.cancel')
  async cancel(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.purchaseOrders.cancel(
        auditContext(request),
        orderId,
        procurementString(input, 'reason', 10000),
      ),
    };
  }

  @Post('purchase-orders/:orderId/revise')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.revise')
  async revise(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' }))
    orderId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.purchaseOrders.revise(
        auditContext(request),
        orderId,
        procurementNullableString(
          input,
          'revisionReason',
          10000,
        ),
      ),
    };
  }
}
