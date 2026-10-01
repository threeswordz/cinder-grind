import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  financeArray,
  financeDate,
  financeNonEmpty,
  financeNullableString,
  financeObject,
  financePositiveDecimal,
  financeString,
  financeUuid,
} from './finance-validation';
import {
  FinanceService,
  SupplierInvoiceLineInput,
} from './finance.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function contextOf(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId
      ? { correlationId: request.correlationId }
      : {}),
  };
}

function lineInput(value: unknown, prefix = 'line'): SupplierInvoiceLineInput {
  const input = financeObject(value);
  return {
    description: financeString(input, 'description', 500),
    amount: financePositiveDecimal(input, 'amount'),
    purchaseOrderLineId: financeUuid(input, 'purchaseOrderLineId', true),
    goodsReceiptItemId: financeUuid(input, 'goodsReceiptItemId', true),
    wbsId: financeUuid(input, 'wbsId', true),
    costCodeId: financeUuid(input, 'costCodeId', true),
  };
}

@Controller('finance')
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.finance.projects(authOf(request)) };
  }

  @Get('supplier-invoice-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.finance.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/supplier-invoice-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.finance.options(authOf(request), projectId) };
  }

  @Get('projects/:projectId/supplier-invoices')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.finance.listInvoices(authOf(request), projectId) };
  }

  @Get('supplier-invoices/:invoiceId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
  ) {
    return { data: await this.finance.getInvoice(authOf(request), invoiceId) };
  }

  @Get('purchase-order-lines/:lineId/supplier-invoices')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async byPurchaseOrderLine(
    @Req() request: AuthenticatedRequest,
    @Param('lineId', new ParseUUIDPipe({ version: '4' })) lineId: string,
  ) {
    return {
      data: await this.finance.invoicesForPurchaseOrderLine(
        authOf(request),
        lineId,
      ),
    };
  }

  @Get('goods-receipt-items/:itemId/supplier-invoices')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.view')
  async byGoodsReceiptItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return {
      data: await this.finance.invoicesForGoodsReceiptItem(
        authOf(request),
        itemId,
      ),
    };
  }

  @Post('projects/:projectId/supplier-invoices')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    const lines = financeArray(input, 'lines').map((value) => lineInput(value));
    return {
      data: await this.finance.createInvoice(contextOf(request), projectId, {
        supplierId: financeUuid(input, 'supplierId')!,
        supplierReference: financeString(input, 'supplierReference', 200),
        invoiceDate: financeDate(input, 'invoiceDate')!,
        dueDate: financeDate(input, 'dueDate', true),
        createKey: financeString(input, 'createKey', 120),
        lines,
      }),
    };
  }

  @Patch('supplier-invoices/:invoiceId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    const data = {
      ...(input.supplierReference !== undefined
        ? { supplierReference: financeString(input, 'supplierReference', 200) }
        : {}),
      ...(input.invoiceDate !== undefined
        ? { invoiceDate: financeDate(input, 'invoiceDate')! }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: financeDate(input, 'dueDate', true) }
        : {}),
    };
    financeNonEmpty(data);
    return {
      data: await this.finance.updateInvoice(
        contextOf(request),
        invoiceId,
        data,
      ),
    };
  }

  @Post('supplier-invoices/:invoiceId/items')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.edit')
  async addLine(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.finance.addLine(
        contextOf(request),
        invoiceId,
        lineInput(body),
      ),
    };
  }

  @Patch('supplier-invoice-items/:itemId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.edit')
  async updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    const data = {
      ...(input.description !== undefined
        ? { description: financeString(input, 'description', 500) }
        : {}),
      ...(input.amount !== undefined
        ? { amount: financePositiveDecimal(input, 'amount') }
        : {}),
      ...(input.purchaseOrderLineId !== undefined
        ? {
            purchaseOrderLineId: financeUuid(
              input,
              'purchaseOrderLineId',
              true,
            ),
          }
        : {}),
      ...(input.goodsReceiptItemId !== undefined
        ? {
            goodsReceiptItemId: financeUuid(input, 'goodsReceiptItemId', true),
          }
        : {}),
      ...(input.wbsId !== undefined
        ? { wbsId: financeUuid(input, 'wbsId', true) }
        : {}),
      ...(input.costCodeId !== undefined
        ? { costCodeId: financeUuid(input, 'costCodeId', true) }
        : {}),
    };
    financeNonEmpty(data);
    return {
      data: await this.finance.updateLine(contextOf(request), itemId, data),
    };
  }

  @Delete('supplier-invoice-items/:itemId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.edit')
  async deleteLine(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe({ version: '4' })) itemId: string,
  ) {
    return {
      data: await this.finance.deleteLine(contextOf(request), itemId),
    };
  }

  @Post('supplier-invoices/:invoiceId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.submit')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.finance.submit(
        contextOf(request),
        invoiceId,
        financeString(input, 'workflowCode', 80),
        financeString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('supplier-invoices/:invoiceId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.finance.approve(
        contextOf(request),
        invoiceId,
        financeString(input, 'actionKey', 120),
        financeNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('supplier-invoices/:invoiceId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.supplier_invoice.reject')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('invoiceId', new ParseUUIDPipe({ version: '4' })) invoiceId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.finance.reject(
        contextOf(request),
        invoiceId,
        financeString(input, 'actionKey', 120),
        financeNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }
}
