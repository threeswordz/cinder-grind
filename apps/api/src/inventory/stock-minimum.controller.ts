import {
  Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { inventoryInvalid, inventoryObject, inventoryUuid } from './inventory-validation';
import { StockMinimumService } from './stock-minimum.service';

const uuid = new ParseUUIDPipe({ version: '4' });
@Controller('inventory/stock-minimums')
export class StockMinimumController {
  constructor(private readonly minimums: StockMinimumService) {}

  @Get('projects')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  projects(@Req() r: AuthenticatedRequest) {
    return this.minimums.projects(r.auth!).then(data => ({ data }));
  }

  @Get('projects/:projectId/sites')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  sites(@Req() r: AuthenticatedRequest,
    @Param('projectId', uuid) projectId: string) {
    return this.minimums.sites(r.auth!, projectId).then(data => ({ data }));
  }

  @Get('projects/:projectId/sites/:warehouseId/choices')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  choices(@Req() r: AuthenticatedRequest,
    @Param('projectId', uuid) projectId: string,
    @Param('warehouseId', uuid) warehouseId: string,
    @Query('after') rawAfter: unknown) {
    const after = rawAfter === undefined ? undefined : inventoryUuid(rawAfter, 'after');
    return this.minimums.choices(r.auth!, projectId, warehouseId, after).then(data => ({ data }));
  }

  /** An approved plan's validFrom, not a supplier promise or daily issue date. */
  @Get('projects/:projectId/sites/:warehouseId/plan-starts')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  planStarts(@Req() r: AuthenticatedRequest,
    @Param('projectId', uuid) projectId: string,
    @Param('warehouseId', uuid) warehouseId: string) {
    return this.minimums.planStarts(r.auth!, projectId, warehouseId)
      .then(data => ({ data }));
  }

  @Get('projects/:projectId/sites/:warehouseId')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  read(@Req() r: AuthenticatedRequest,
    @Param('projectId', uuid) projectId: string,
    @Param('warehouseId', uuid) warehouseId: string) {
    return this.minimums.read(r.auth!, projectId, warehouseId).then(data => ({ data }));
  }

  @Post('projects/:projectId/sites/:warehouseId')
  @Header('Cache-Control', 'private, no-store')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.stock.view')
  set(@Req() r: AuthenticatedRequest,
    @Param('projectId', uuid) projectId: string,
    @Param('warehouseId', uuid) warehouseId: string,
    @Body() input: unknown) {
    const x = inventoryObject(input);
    const allowed = new Set(['materialId', 'uomId', 'minimumQuantity', 'status', 'reason', 'expectedPreviousEventId']);
    if (Object.keys(x).some(k => !allowed.has(k)) ||
        !Object.prototype.hasOwnProperty.call(x, 'expectedPreviousEventId'))
      inventoryInvalid('body', 'Provide only threshold policy and explicit expectedPreviousEventId.');
    const previous = x.expectedPreviousEventId === null ? null :
      inventoryUuid(x.expectedPreviousEventId, 'expectedPreviousEventId');
    const context = { auth: r.auth!, ...(r.correlationId ? { correlationId: r.correlationId } : {}) };
    return this.minimums.set(context, projectId, warehouseId, {
      materialId: x.materialId, uomId: x.uomId, minimumQuantity: x.minimumQuantity,
      status: x.status, reason: x.reason,
    }, previous).then(data => ({ data }));
  }
}
