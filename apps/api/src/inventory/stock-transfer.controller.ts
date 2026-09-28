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
import { Prisma } from '@prisma/client';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  inventoryInvalid,
  inventoryObject,
  inventoryUuid,
  nullableInventoryString,
  optionalInventoryUuid,
  requiredInventoryString,
} from './inventory-validation';
import { StockTransferService, TransferLineInput } from './stock-transfer.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function auditContext(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId ? { correlationId: request.correlationId } : {}),
  };
}

function quantity(value: unknown, field = 'quantity'): Prisma.Decimal {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return inventoryInvalid(field, 'Must be a positive decimal quantity.');
  }
  const input = String(value);
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(input)) {
    return inventoryInvalid(field, 'Use a positive DECIMAL(18,4) quantity.');
  }
  const result = new Prisma.Decimal(input);
  if (result.lte(0)) return inventoryInvalid(field, 'Must be greater than zero.');
  return result;
}

function dateValue(value: unknown, field: string, required = true): Date | undefined {
  if (value === undefined) {
    if (required) return inventoryInvalid(field, 'Is required.');
    return undefined;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return inventoryInvalid(field, 'Use YYYY-MM-DD.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return inventoryInvalid(field, 'Use a valid calendar date.');
  }
  return parsed;
}

function transferLine(raw: unknown, index?: number): TransferLineInput {
  const input = inventoryObject(raw);
  const prefix = index === undefined ? '' : `lines[${index}].`;
  return {
    materialId: inventoryUuid(input.materialId, prefix + 'materialId'),
    quantity: quantity(input.quantity, prefix + 'quantity'),
    uomId: inventoryUuid(input.uomId, prefix + 'uomId'),
    sourceProjectId: inventoryUuid(
      input.sourceProjectId,
      prefix + 'sourceProjectId',
    ),
    destinationProjectId: inventoryUuid(
      input.destinationProjectId,
      prefix + 'destinationProjectId',
    ),
    remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
  };
}

@Controller('inventory')
export class StockTransferController {
  constructor(private readonly transfers: StockTransferService) {}

  @Get('transfer-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.transfers.projects(authOf(request)) };
  }

  @Get('projects/:projectId/transfer-warehouses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view')
  async warehouses(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.transfers.warehouses(authOf(request), projectId),
    };
  }

  @Get('projects/:projectId/transfer-stock')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view')
  async stock(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('warehouseId') warehouseId: unknown,
  ) {
    return {
      data: await this.transfers.stockChoices(
        authOf(request),
        projectId,
        optionalInventoryUuid(warehouseId, 'warehouseId') ?? undefined,
      ),
    };
  }

  @Get('transfer-workflows')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.submit')
  async workflows(@Req() request: AuthenticatedRequest) {
    return { data: await this.transfers.workflowOptions(authOf(request)) };
  }

  @Get('stock-transfers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId: unknown,
  ) {
    return {
      data: await this.transfers.list(
        authOf(request),
        optionalInventoryUuid(projectId, 'projectId') ?? undefined,
      ),
    };
  }

  @Get('stock-transfers/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.transfers.get(authOf(request), id) };
  }

  @Post('stock-transfers')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    if (
      !Array.isArray(input.lines) ||
      input.lines.length === 0 ||
      input.lines.length > 200
    ) {
      return inventoryInvalid('lines', 'Provide one to 200 transfer lines.');
    }
    return {
      data: await this.transfers.create(auditContext(request), {
        sourceWarehouseId: inventoryUuid(
          input.sourceWarehouseId,
          'sourceWarehouseId',
        ),
        destinationWarehouseId: inventoryUuid(
          input.destinationWarehouseId,
          'destinationWarehouseId',
        ),
        transferDate: dateValue(input.transferDate, 'transferDate')!,
        remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
        lines: (input.lines as unknown[]).map((line, index) =>
          transferLine(line, index),
        ),
      }),
    };
  }

  @Patch('stock-transfers/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.transfers.updateDraft(auditContext(request), id, {
        ...(input.sourceWarehouseId !== undefined
          ? {
              sourceWarehouseId: inventoryUuid(
                input.sourceWarehouseId,
                'sourceWarehouseId',
              ),
            }
          : {}),
        ...(input.destinationWarehouseId !== undefined
          ? {
              destinationWarehouseId: inventoryUuid(
                input.destinationWarehouseId,
                'destinationWarehouseId',
              ),
            }
          : {}),
        ...(input.transferDate !== undefined
          ? {
              transferDate: dateValue(
                input.transferDate,
                'transferDate',
                false,
              )!,
            }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: nullableInventoryString(input, 'remarks', 10000) ?? null }
          : {}),
      }),
    };
  }

  @Patch('stock-transfer-items/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.edit')
  async updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.transfers.updateDraftLine(
        auditContext(request),
        id,
        transferLine(body),
      ),
    };
  }

  @Post('stock-transfers/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.transfers.submit(
        auditContext(request),
        id,
        requiredInventoryString(inventoryObject(body), 'workflowCode', 80),
      ),
    };
  }

  @Post('stock-transfers/:id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.transfers.approve(
        auditContext(request),
        id,
        requiredInventoryString(input, 'postKey', 120),
        nullableInventoryString(input, 'comment', 1000) ?? undefined,
      ),
    };
  }

  @Post('stock-transfers/:id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.transfers.reject(
        auditContext(request),
        id,
        nullableInventoryString(inventoryObject(body), 'comment', 1000) ??
          undefined,
      ),
    };
  }

  @Post('stock-transfers/:id/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.reverse')
  async reverse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.transfers.reverse(
        auditContext(request),
        id,
        requiredInventoryString(input, 'reversalKey', 120),
        requiredInventoryString(input, 'reason', 1000),
      ),
    };
  }
}
