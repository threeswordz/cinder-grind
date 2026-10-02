import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { financeArray, financeDate, financeNonEmpty, financeNullableString, financeObject, financePositiveDecimal, financeString, financeUuid } from './finance-validation';
import { ClientInvoiceLineInput, ClientInvoiceService } from './client-invoice.service';

function authOf(r: AuthenticatedRequest) { if (!r.auth) throw new Error('Authentication context is missing.'); return r.auth; }
function contextOf(r: AuthenticatedRequest) { return { auth: authOf(r), ...(r.correlationId ? { correlationId: r.correlationId } : {}) }; }
function line(value: unknown): ClientInvoiceLineInput {
  const x=financeObject(value); return { description: financeString(x,'description',500), amount: financePositiveDecimal(x,'amount') };
}

@Controller('finance')
export class ClientInvoiceController {
  constructor(private readonly service: ClientInvoiceService) {}

  @Get('client-invoice-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.view')
  async projects(@Req() r: AuthenticatedRequest) {
    return { data: await this.service.balanceProjects(authOf(r)) };
  }

  @Get('client-invoice-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.submit')
  async workflows(@Req() r: AuthenticatedRequest) { return { data: await this.service.workflowOptions(authOf(r)) }; }

  @Get('projects/:projectId/client-invoice-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.view')
  async options(@Req() r: AuthenticatedRequest, @Param('projectId',new ParseUUIDPipe({version:'4'})) projectId:string) {
    return { data: await this.service.options(authOf(r),projectId) };
  }

  @Get('projects/:projectId/client-invoices')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.view')
  async list(@Req() r: AuthenticatedRequest, @Param('projectId',new ParseUUIDPipe({version:'4'})) projectId:string) {
    return { data: await this.service.list(authOf(r),projectId) };
  }

  @Get('accounts-receivable-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.ar.view')
  async accountsReceivableProjects(@Req() r: AuthenticatedRequest) {
    return { data: await this.service.balanceProjects(authOf(r)) };
  }

  @Get('projects/:projectId/accounts-receivable')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.ar.view')
  async accountsReceivable(
    @Req() r: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.service.accountsReceivable(authOf(r), projectId) };
  }

  @Get('client-invoices/:invoiceId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.view')
  async get(@Req() r: AuthenticatedRequest, @Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string) {
    return { data: await this.service.get(authOf(r),invoiceId) };
  }

  @Post('projects/:projectId/client-invoices')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.create')
  async create(@Req() r: AuthenticatedRequest,@Param('projectId',new ParseUUIDPipe({version:'4'})) projectId:string,@Body() body:unknown) {
    const x=financeObject(body);
    return { data: await this.service.create(contextOf(r),projectId,{
      customerId: financeUuid(x,'customerId')!, invoiceDate: financeDate(x,'invoiceDate')!,
      dueDate: financeDate(x,'dueDate',true), createKey: financeString(x,'createKey',120),
      lines: financeArray(x,'lines').map(line),
    })};
  }


  @Patch('client-invoices/:invoiceId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.edit')
  async update(@Req() r:AuthenticatedRequest,@Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string,@Body() body:unknown) {
    const x=financeObject(body); const data={
      ...(x.invoiceDate!==undefined?{invoiceDate:financeDate(x,'invoiceDate')!}:{}),
      ...(x.dueDate!==undefined?{dueDate:financeDate(x,'dueDate',true)}:{}),
    }; financeNonEmpty(data); return {data:await this.service.update(contextOf(r),invoiceId,data)};
  }

  @Post('client-invoices/:invoiceId/items')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.edit')
  async addLine(@Req() r:AuthenticatedRequest,@Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string,@Body() body:unknown) {
    return {data:await this.service.addLine(contextOf(r),invoiceId,line(body))};
  }

  @Patch('client-invoice-items/:itemId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.edit')
  async updateLine(@Req() r:AuthenticatedRequest,@Param('itemId',new ParseUUIDPipe({version:'4'})) itemId:string,@Body() body:unknown) {
    const x=financeObject(body); const data={
      ...(x.description!==undefined?{description:financeString(x,'description',500)}:{}),
      ...(x.amount!==undefined?{amount:financePositiveDecimal(x,'amount')}:{}),
    }; financeNonEmpty(data); return {data:await this.service.updateLine(contextOf(r),itemId,data)};
  }

  @Delete('client-invoice-items/:itemId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.edit')
  async deleteLine(@Req() r:AuthenticatedRequest,@Param('itemId',new ParseUUIDPipe({version:'4'})) itemId:string) {
    return {data:await this.service.deleteLine(contextOf(r),itemId)};
  }

  @Post('client-invoices/:invoiceId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.submit')
  async submit(@Req() r:AuthenticatedRequest,@Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string,@Body() body:unknown) {
    const x=financeObject(body); return { data: await this.service.submit(contextOf(r),invoiceId,financeString(x,'workflowCode',80),financeString(x,'actionKey',120)) };
  }

  @Post('client-invoices/:invoiceId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.approve')
  async approve(@Req() r:AuthenticatedRequest,@Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string,@Body() body:unknown) {
    const x=financeObject(body); return { data: await this.service.approve(contextOf(r),invoiceId,financeString(x,'actionKey',120),financeNullableString(x,'comment',5000)??undefined) };
  }

  @Post('client-invoices/:invoiceId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.client_invoice.reject')
  async reject(@Req() r:AuthenticatedRequest,@Param('invoiceId',new ParseUUIDPipe({version:'4'})) invoiceId:string,@Body() body:unknown) {
    const x=financeObject(body); return { data: await this.service.reject(contextOf(r),invoiceId,financeString(x,'actionKey',120),financeNullableString(x,'comment',5000)??undefined) };
  }
}
