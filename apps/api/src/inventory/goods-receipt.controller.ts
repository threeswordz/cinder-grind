import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest, AuthenticatedUserContext } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  inventoryInvalid, inventoryObject, inventoryUuid, nullableInventoryString,
  requiredInventoryString,
} from './inventory-validation';
import { GoodsReceiptService } from './goods-receipt.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}
function auditContext(request: AuthenticatedRequest) {
  return { auth: authOf(request), ...(request.correlationId ? { correlationId: request.correlationId } : {}) };
}
function quantity(value: unknown): Prisma.Decimal {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return inventoryInvalid('quantity', 'Must be a positive decimal quantity.');
  }
  const input = String(value);
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(input)) {
    return inventoryInvalid('quantity', 'Use a positive DECIMAL(18,4) quantity.');
  }
  const result = new Prisma.Decimal(input);
  if (result.lte(0)) return inventoryInvalid('quantity', 'Must be greater than zero.');
  return result;
}

@Controller('inventory')
export class GoodsReceiptController {
  constructor(private readonly receipts: GoodsReceiptService) {}

  @Get('receipt-workflows')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.submit')
  async workflows(@Req() request: AuthenticatedRequest) {
    return { data: await this.receipts.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/eligible-receipt-pos')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.view')
  async eligible(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.receipts.eligibleOrders(authOf(request), projectId) };
  }

  @Get('projects/:projectId/goods-receipts')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.receipts.list(authOf(request), projectId) };
  }

  @Get('goods-receipts/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.receipts.get(authOf(request), id) };
  }

  @Post('goods-receipts')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.create')
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = inventoryObject(body);
    if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 200) {
      inventoryInvalid('lines', 'Provide one to 200 material lines.');
    }
    const lines = (input.lines as unknown[]).map((value) => {
      const line = inventoryObject(value);
      return {
        purchaseOrderLineId: inventoryUuid(line.purchaseOrderLineId, 'purchaseOrderLineId'),
        quantity: quantity(line.quantity),
      };
    });
    return { data: await this.receipts.create(auditContext(request), {
      projectId: inventoryUuid(input.projectId, 'projectId'),
      purchaseOrderId: inventoryUuid(input.purchaseOrderId, 'purchaseOrderId'),
      warehouseId: inventoryUuid(input.warehouseId, 'warehouseId'),
      remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
      lines,
    }) };
  }

  @Post('goods-receipts/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.receipts.submit(
      auditContext(request), id,
      requiredInventoryString(inventoryObject(body), 'workflowCode', 80),
    ) };
  }

  @Post('goods-receipts/:id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return { data: await this.receipts.approve(
      auditContext(request), id,
      requiredInventoryString(input, 'postKey', 120),
      nullableInventoryString(input, 'comment', 1000) ?? undefined,
    ) };
  }

  @Post('goods-receipts/:id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return { data: await this.receipts.reject(
      auditContext(request), id,
      nullableInventoryString(inventoryObject(body), 'comment', 1000) ?? undefined,
    ) };
  }

  @Post('goods-receipts/:id/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.receipt.reverse')
  async reverse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return { data: await this.receipts.reverse(
      auditContext(request), id,
      requiredInventoryString(input, 'reversalKey', 120),
      requiredInventoryString(input, 'reason', 1000),
    ) };
  }
}
