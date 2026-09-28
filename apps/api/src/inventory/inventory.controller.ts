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
  InventoryService,
  WarehouseInput,
} from './inventory.service';
import {
  inventoryBoolean,
  inventoryInvalid,
  inventoryObject,
  inventoryUuid,
  nullableInventoryString,
  optionalInventoryUuid,
  requiredInventoryString,
} from './inventory-validation';

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

function warehouseCreate(body: unknown): WarehouseInput {
  const input = inventoryObject(body);
  const projectId = optionalInventoryUuid(input.projectId, 'projectId');
  const location = nullableInventoryString(input, 'location', 500);
  return {
    warehouseCode: requiredInventoryString(input, 'warehouseCode', 80),
    warehouseName: requiredInventoryString(input, 'warehouseName', 200),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(location !== undefined ? { location } : {}),
    isSiteWarehouse:
      input.isSiteWarehouse === undefined
        ? false
        : inventoryBoolean(input.isSiteWarehouse, 'isSiteWarehouse'),
  };
}

function warehouseUpdate(body: unknown): Partial<WarehouseInput> {
  const input = inventoryObject(body);
  const result: Partial<WarehouseInput> = {};
  if (input.warehouseCode !== undefined) {
    result.warehouseCode = requiredInventoryString(
      input,
      'warehouseCode',
      80,
    );
  }
  if (input.warehouseName !== undefined) {
    result.warehouseName = requiredInventoryString(
      input,
      'warehouseName',
      200,
    );
  }
  if (input.projectId !== undefined) {
    const projectId = optionalInventoryUuid(input.projectId, 'projectId');
    if (projectId !== undefined) result.projectId = projectId;
  }
  if (input.location !== undefined) {
    const location = nullableInventoryString(input, 'location', 500);
    if (location !== undefined) result.location = location;
  }
  if (input.isSiteWarehouse !== undefined) {
    result.isSiteWarehouse = inventoryBoolean(
      input.isSiteWarehouse,
      'isSiteWarehouse',
    );
  }
  if (Object.keys(result).length === 0) {
    inventoryInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.inventory.projects(authOf(request)) };
  }

  @Get('warehouses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.view')
  async warehouses(
    @Req() request: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: string,
    @Query('projectId') rawProjectId?: string,
    @Query('search') search?: string,
  ) {
    return {
      data: await this.inventory.listWarehouses(authOf(request), {
        includeInactive: includeInactive === 'true',
        ...(rawProjectId
          ? { projectId: inventoryUuid(rawProjectId, 'projectId') }
          : {}),
        ...(search?.trim() ? { search: search.trim().slice(0, 200) } : {}),
      }),
    };
  }

  @Get('warehouses/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.view')
  async warehouse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.inventory.getWarehouse(authOf(request), id) };
  }

  @Post('warehouses')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.create')
  async createWarehouse(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.inventory.createWarehouse(
        auditContext(request),
        warehouseCreate(body),
      ),
    };
  }

  @Patch('warehouses/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.edit')
  async updateWarehouse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.inventory.updateWarehouse(
        auditContext(request),
        id,
        warehouseUpdate(body),
      ),
    };
  }

  @Post('warehouses/:id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.archive')
  async archiveWarehouse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.inventory.archiveWarehouse(auditContext(request), id),
    };
  }

  @Post('warehouses/:id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.warehouse.archive')
  async reactivateWarehouse(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.inventory.reactivateWarehouse(
        auditContext(request),
        id,
      ),
    };
  }
}
