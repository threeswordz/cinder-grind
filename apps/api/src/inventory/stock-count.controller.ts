import { Prisma } from '@prisma/client';
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest, AuthenticatedUserContext } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  inventoryInvalid, inventoryObject, inventoryUuid, nullableInventoryString, requiredInventoryString,
} from './inventory-validation';
import { StockCountService } from './stock-count.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}
function auditContext(request: AuthenticatedRequest) {
  return { auth: authOf(request), ...(request.correlationId ? { correlationId: request.correlationId } : {}) };
}
function quantity(value: unknown, field = 'actualQuantity') {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return inventoryInvalid(field, 'Must be a non-negative decimal quantity.');
  }
  try {
    const decimal = new Prisma.Decimal(value);
    if (!decimal.isFinite() || decimal.lessThan(0) || decimal.decimalPlaces() > 4 ||
        decimal.greaterThan('99999999999999.9999')) {
      return inventoryInvalid(field, 'Must be non-negative with at most four decimal places.');
    }
    return decimal;
  } catch {
    return inventoryInvalid(field, 'Must be a non-negative decimal quantity.');
  }
}
function version(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    return inventoryInvalid('expectedVersion', 'Must be a positive integer.');
  }
  return value;
}
function instant(value: unknown, field = 'countedAt') {
  if (typeof value !== 'string' || value.length > 80) return inventoryInvalid(field, 'Must be an ISO timestamp.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return inventoryInvalid(field, 'Must be an ISO timestamp.');
  return parsed;
}

@Controller('inventory')
export class StockCountController {
  constructor(private readonly counts: StockCountService) {}

  @Get('stock-count-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.counts.projects(authOf(request)) };
  }

  @Get('projects/:projectId/stock-count-warehouses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  async warehouses(@Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string) {
    return { data: await this.counts.siteWarehouses(authOf(request), projectId) };
  }

  @Get('projects/:projectId/stock-count-choices')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  async choices(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('warehouseId') warehouseId: unknown,
    @Query('after') after: unknown,
  ) {
    const afterId = after === undefined || after === ''
      ? undefined
      : inventoryUuid(after, 'after');
    return {
      data: await this.counts.choices(
        authOf(request),
        projectId,
        inventoryUuid(warehouseId, 'warehouseId'),
        afterId,
      ),
    };
  }

  @Get('projects/:projectId/stock-counts')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  async list(@Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string) {
    return { data: await this.counts.list(authOf(request), projectId) };
  }

  @Get('stock-counts/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  async get(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return { data: await this.counts.get(authOf(request), id) };
  }

  @Post('stock-counts')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.create')
  async create(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const input = inventoryObject(body);
    return { data: await this.counts.create(auditContext(request), {
      projectId: inventoryUuid(input.projectId, 'projectId'),
      warehouseId: inventoryUuid(input.warehouseId, 'warehouseId'),
      materialId: inventoryUuid(input.materialId, 'materialId'),
      uomId: inventoryUuid(input.uomId, 'uomId'),
      countedAt: instant(input.countedAt),
      actualQuantity: quantity(input.actualQuantity),
      evidenceReference: nullableInventoryString(input, 'evidenceReference', 2000) ?? null,
    }) };
  }

  @Patch('stock-counts/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.edit')
  async update(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    const input = inventoryObject(body);
    if (input.countedAt === undefined && input.actualQuantity === undefined && input.evidenceReference === undefined) {
      inventoryInvalid('body', 'Provide a draft field to update.');
    }
    return { data: await this.counts.updateDraft(auditContext(request), id, {
      expectedVersion: version(input.expectedVersion),
      ...(input.countedAt !== undefined ? { countedAt: instant(input.countedAt) } : {}),
      ...(input.actualQuantity !== undefined ? { actualQuantity: quantity(input.actualQuantity) } : {}),
      ...(input.evidenceReference !== undefined
        ? { evidenceReference: nullableInventoryString(input, 'evidenceReference', 2000) ?? null } : {}),
    }) };
  }

  @Post('stock-counts/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.submit')
  async submit(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.counts.submit(
      auditContext(request), id, version(inventoryObject(body).expectedVersion),
    ) };
  }

  @Post('stock-counts/:id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.approve')
  async approve(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    const input = inventoryObject(body);
    return { data: await this.counts.approve(
      auditContext(request), id, version(input.expectedVersion),
      requiredInventoryString(input, 'postKey', 120),
      nullableInventoryString(input, 'comment', 1000) ?? undefined,
    ) };
  }

  @Post('stock-counts/:id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock_count.approve')
  async reject(@Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    const input = inventoryObject(body);
    return { data: await this.counts.reject(
      auditContext(request), id, version(input.expectedVersion), requiredInventoryString(input, 'comment', 1000),
    ) };
  }
}
