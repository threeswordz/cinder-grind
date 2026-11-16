import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { TransferCustodyService } from './transfer-custody.service';

const uuid = new ParseUUIDPipe({ version: '4' });
const context = (request: AuthenticatedRequest) => ({ auth: request.auth!, ...(request.correlationId ? { correlationId: request.correlationId } : {}) });

@Controller('inventory/transfer-custody')
export class TransferCustodyController {
  constructor(private readonly service: TransferCustodyService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.receipt_view')
  async projects(@Req() request: AuthenticatedRequest) { return { data: await this.service.projects(request.auth!) }; }

  @Post('projects/:projectId/enable')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.configure')
  async enable(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Body() body: unknown) {
    return { data: await this.service.enable(context(request), projectId, body) };
  }

  @Get('projects/:projectId/transfers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.receipt_view')
  async list(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string) { return { data: await this.service.list(request.auth!, projectId) }; }

  @Get('projects/:projectId/transfers/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.receipt_view')
  async get(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Param('id', uuid) id: string) { return { data: await this.service.get(request.auth!, id, projectId) }; }

  @Post('transfers/:id/dispatch')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view', 'inventory.transfer.dispatch')
  async dispatch(@Req() request: AuthenticatedRequest, @Param('id', uuid) id: string, @Body() body: unknown) { return { data: await this.service.dispatch(context(request), id, body) }; }

  @Post('projects/:projectId/transfers/:id/assign')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view', 'inventory.transfer.assign_receiver')
  async assign(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Param('id', uuid) id: string, @Body() body: unknown) { return { data: await this.service.assign(context(request), id, projectId, body) }; }

  @Get('projects/:projectId/transfers/:id/receivers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.view', 'inventory.transfer.assign_receiver')
  async receivers(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Param('id', uuid) id: string) { return { data: await this.service.eligibleReceivers(request.auth!, id, projectId) }; }

  @Post('projects/:projectId/transfers/:id/receipts')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.receipt_view')
  async prepare(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Param('id', uuid) id: string, @Body() body: unknown) { return { data: await this.service.prepareReceipt(context(request), id, projectId, body) }; }

  @Post('projects/:projectId/transfers/:id/receipts/:receiptId/receive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.transfer.receipt_view', 'documents.document.view')
  async receive(@Req() request: AuthenticatedRequest, @Param('projectId', uuid) projectId: string, @Param('id', uuid) id: string, @Param('receiptId', uuid) receiptId: string, @Body() body: unknown) { return { data: await this.service.receive(context(request), id, projectId, receiptId, body) }; }
}
