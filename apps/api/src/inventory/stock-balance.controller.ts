import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest, AuthenticatedUserContext } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { inventoryInvalid, optionalInventoryUuid } from './inventory-validation';
import { StockBalanceService } from './stock-balance.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return inventoryInvalid(field, 'Must be true or false.');
}

function optionalSearch(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return inventoryInvalid('search', 'Must be a string.');
  const result = value.trim();
  if (result.length > 120) return inventoryInvalid('search', 'Must be at most 120 characters.');
  return result || undefined;
}

@Controller('inventory')
export class StockBalanceController {
  constructor(private readonly balances: StockBalanceService) {}

  @Get('stock-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.balances.projects(authOf(request)) };
  }

  @Get('stock-balances')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId: unknown,
    @Query('warehouseId') warehouseId: unknown,
    @Query('materialId') materialId: unknown,
    @Query('search') search: unknown,
    @Query('includeInactiveWarehouses') includeInactiveWarehouses: unknown,
    @Query('includeZero') includeZero: unknown,
  ) {
    return {
      data: await this.balances.balances(authOf(request), {
        projectId: optionalInventoryUuid(projectId, 'projectId') ?? undefined,
        warehouseId: optionalInventoryUuid(warehouseId, 'warehouseId') ?? undefined,
        materialId: optionalInventoryUuid(materialId, 'materialId') ?? undefined,
        search: optionalSearch(search),
        includeInactiveWarehouses: optionalBoolean(
          includeInactiveWarehouses,
          'includeInactiveWarehouses',
        ),
        includeZero: optionalBoolean(includeZero, 'includeZero'),
      }),
    };
  }
}
