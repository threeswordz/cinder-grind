import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  inventoryInvalid,
  optionalInventoryUuid,
} from './inventory-validation';
import {
  InventoryMovementFilters,
  InventoryReportService,
} from './inventory-report.service';
import { StockBalanceFilters } from './stock-balance.service';

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

function optionalString(
  value: unknown,
  field: string,
  max: number,
): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return inventoryInvalid(field, 'Must be a string.');
  const result = value.trim();
  if (!result || result.length > max) {
    return inventoryInvalid(field, 'Must be between 1 and ' + max + ' characters.');
  }
  return result;
}

function optionalDate(value: unknown, field: string, exclusiveEnd = false) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return inventoryInvalid(field, 'Use YYYY-MM-DD.');
  }
  const result = new Date(value + 'T00:00:00.000Z');
  if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== value) {
    return inventoryInvalid(field, 'Use a valid calendar date.');
  }
  if (exclusiveEnd) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

@Controller('inventory/reports')
export class InventoryReportController {
  constructor(private readonly reports: InventoryReportService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.report.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.reports.projects(authOf(request)) };
  }

  @Get('balances')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.report.view')
  async balances(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId: unknown,
    @Query('warehouseId') warehouseId: unknown,
    @Query('materialId') materialId: unknown,
    @Query('search') search: unknown,
    @Query('includeInactiveWarehouses') includeInactiveWarehouses: unknown,
    @Query('includeZero') includeZero: unknown,
  ) {
    const filters: StockBalanceFilters = {};
    const project = optionalInventoryUuid(projectId, 'projectId');
    const warehouse = optionalInventoryUuid(warehouseId, 'warehouseId');
    const material = optionalInventoryUuid(materialId, 'materialId');
    const searchText = optionalString(search, 'search', 120);
    const inactive = optionalBoolean(
      includeInactiveWarehouses,
      'includeInactiveWarehouses',
    );
    const zero = optionalBoolean(includeZero, 'includeZero');
    if (project) filters.projectId = project;
    if (warehouse) filters.warehouseId = warehouse;
    if (material) filters.materialId = material;
    if (searchText) filters.search = searchText;
    if (inactive !== undefined) filters.includeInactiveWarehouses = inactive;
    if (zero !== undefined) filters.includeZero = zero;
    return { data: await this.reports.balanceReport(authOf(request), filters) };
  }

  @Get('movements')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.report.view')
  async movements(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId: unknown,
    @Query('warehouseId') warehouseId: unknown,
    @Query('materialId') materialId: unknown,
    @Query('movementType') movementType: unknown,
    @Query('postedFrom') postedFrom: unknown,
    @Query('postedTo') postedTo: unknown,
  ) {
    const filters: InventoryMovementFilters = {};
    const project = optionalInventoryUuid(projectId, 'projectId');
    const warehouse = optionalInventoryUuid(warehouseId, 'warehouseId');
    const material = optionalInventoryUuid(materialId, 'materialId');
    const movement = optionalString(movementType, 'movementType', 40);
    const from = optionalDate(postedFrom, 'postedFrom');
    const to = optionalDate(postedTo, 'postedTo', true);
    if (project) filters.projectId = project;
    if (warehouse) filters.warehouseId = warehouse;
    if (material) filters.materialId = material;
    if (movement) filters.movementType = movement;
    if (from) filters.postedFrom = from;
    if (to) filters.postedTo = to;
    return { data: await this.reports.movementReport(authOf(request), filters) };
  }
}
