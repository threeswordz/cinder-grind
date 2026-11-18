import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { MaterialUomService } from './material-uom.service';
const context = (r: AuthenticatedRequest) => ({ auth: r.auth!, ...(r.correlationId ? { correlationId: r.correlationId } : {}) });

@Controller('master-data/material-conversions')
export class MaterialUomController {
  constructor(private readonly service: MaterialUomService) {}
  @Get(':materialId') @UseGuards(AuthGuard, PermissionGuard) @RequirePermissions('master.material.view')
  get(@Req() r: AuthenticatedRequest, @Param('materialId') id: string, @Query('before') before?: string) { return this.service.get(r.auth!, id, before).then(data => ({ data })); }
  @Post(':materialId/basis') @UseGuards(AuthGuard, CsrfGuard, PermissionGuard) @RequirePermissions('master.material.view', 'master.material.manage', 'master.material.conversion.manage')
  prepare(@Req() r: AuthenticatedRequest, @Param('materialId') id: string, @Body() body: unknown) { return this.service.prepare(context(r), id, body).then(data => ({ data })); }
  @Post(':materialId/revisions') @UseGuards(AuthGuard, CsrfGuard, PermissionGuard) @RequirePermissions('master.material.view', 'master.material.manage', 'master.material.conversion.manage')
  revise(@Req() r: AuthenticatedRequest, @Param('materialId') id: string, @Body() body: unknown) { return this.service.revise(context(r), id, body).then(data => ({ data })); }
  @Post(':materialId/preview') @UseGuards(AuthGuard, CsrfGuard, PermissionGuard) @RequirePermissions('master.material.view')
  preview(@Req() r: AuthenticatedRequest, @Param('materialId') id: string, @Body() body: unknown) { return this.service.preview(r.auth!, id, body).then(data => ({ data })); }
}
