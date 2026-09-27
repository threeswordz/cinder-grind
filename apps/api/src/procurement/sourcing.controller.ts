import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  procurementArray,
  procurementDate,
  procurementDecimal,
  procurementNonEmpty,
  procurementNonnegativeDecimal,
  procurementNullableString,
  procurementObject,
  procurementUuid,
} from './procurement-validation';
import { SourcingService } from './sourcing.service';

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

@Controller('procurement')
export class SourcingController {
  constructor(private readonly sourcing: SourcingService) {}

  @Get('rfq-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.sourcing.projects(authOf(request)) };
  }

  @Get('quotation-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.view')
  async quotationProjects(@Req() request: AuthenticatedRequest) {
    return { data: await this.sourcing.projects(authOf(request)) };
  }

  @Get('projects/:projectId/approved-demand')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.view')
  async approvedDemand(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.sourcing.approvedDemand(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('projects/:projectId/supplier-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.manage')
  async supplierOptions(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.sourcing.supplierOptions(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('projects/:projectId/rfqs')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.view')
  async listRfqs(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.sourcing.listRfqs(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('projects/:projectId/quotation-rfqs')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.view')
  async listQuotationRfqs(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.sourcing.listRfqs(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('rfqs/:rfqId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.view')
  async getRfq(
    @Req() request: AuthenticatedRequest,
    @Param('rfqId', new ParseUUIDPipe({ version: '4' }))
    rfqId: string,
  ) {
    return {
      data: await this.sourcing.getRfqDetail(
        authOf(request),
        rfqId,
      ),
    };
  }

  @Get('quotation-rfqs/:rfqId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.view')
  async getQuotationRfq(
    @Req() request: AuthenticatedRequest,
    @Param('rfqId', new ParseUUIDPipe({ version: '4' }))
    rfqId: string,
  ) {
    return {
      data: await this.sourcing.getRfqDetail(
        authOf(request),
        rfqId,
      ),
    };
  }

  @Post('projects/:projectId/rfqs')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.manage')
  async createRfq(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const lines = procurementArray(input.lines, 'lines').map(
      (row, index) => {
        const item = procurementObject(row);
        return {
          purchaseRequestLineId: procurementUuid(
            item.purchaseRequestLineId,
            'lines[' + index + '].purchaseRequestLineId',
          )!,
          quantity: procurementDecimal(
            item.quantity,
            'lines[' + index + '].quantity',
          ),
        };
      },
    );
    return {
      data: await this.sourcing.createRfq(
        auditContext(request),
        projectId,
        {
          closingDate: procurementDate(
            input.closingDate,
            'closingDate',
            true,
          ),
          remarks:
            procurementNullableString(input, 'remarks', 10000) ??
            null,
          lines,
        },
      ),
    };
  }

  @Post('rfqs/:rfqId/suppliers')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.rfq.manage')
  async inviteSupplier(
    @Req() request: AuthenticatedRequest,
    @Param('rfqId', new ParseUUIDPipe({ version: '4' }))
    rfqId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.sourcing.inviteSupplier(
        auditContext(request),
        rfqId,
        procurementUuid(input.supplierId, 'supplierId')!,
      ),
    };
  }

  @Post('rfqs/:rfqId/quotations')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.manage')
  async createQuotation(
    @Req() request: AuthenticatedRequest,
    @Param('rfqId', new ParseUUIDPipe({ version: '4' }))
    rfqId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const quotationDate = procurementDate(
      input.quotationDate,
      'quotationDate',
      false,
    );
    if (!quotationDate) {
      throw new Error('Required quotation date validation failed.');
    }
    return {
      data: await this.sourcing.createQuotation(
        auditContext(request),
        rfqId,
        procurementUuid(input.supplierId, 'supplierId')!,
        {
          quotationDate,
          supplierReference:
            procurementNullableString(
              input,
              'supplierReference',
              150,
            ) ?? null,
          validityDate: procurementDate(
            input.validityDate,
            'validityDate',
            true,
          ),
          remarks:
            procurementNullableString(input, 'remarks', 10000) ??
            null,
        },
      ),
    };
  }

  @Patch('quotations/:quotationId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.manage')
  async updateQuotation(
    @Req() request: AuthenticatedRequest,
    @Param('quotationId', new ParseUUIDPipe({ version: '4' }))
    quotationId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    const data = {
      ...(input.supplierReference !== undefined
        ? {
            supplierReference:
              procurementNullableString(
                input,
                'supplierReference',
                150,
              ) ?? null,
          }
        : {}),
      ...(input.quotationDate !== undefined
        ? {
            quotationDate: procurementDate(
              input.quotationDate,
              'quotationDate',
              false,
            )!,
          }
        : {}),
      ...(input.validityDate !== undefined
        ? {
            validityDate: procurementDate(
              input.validityDate,
              'validityDate',
              true,
            ),
          }
        : {}),
      ...(input.remarks !== undefined
        ? {
            remarks:
              procurementNullableString(
                input,
                'remarks',
                10000,
              ) ?? null,
          }
        : {}),
    };
    procurementNonEmpty(data);
    return {
      data: await this.sourcing.updateQuotation(
        auditContext(request),
        quotationId,
        data,
      ),
    };
  }

  @Put('quotations/:quotationId/lines/:rfqLineId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.manage')
  async upsertQuotationLine(
    @Req() request: AuthenticatedRequest,
    @Param('quotationId', new ParseUUIDPipe({ version: '4' }))
    quotationId: string,
    @Param('rfqLineId', new ParseUUIDPipe({ version: '4' }))
    rfqLineId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.sourcing.upsertQuotationLine(
        auditContext(request),
        quotationId,
        rfqLineId,
        {
          quantity: procurementDecimal(
            input.quantity,
            'quantity',
          ),
          unitPrice: procurementNonnegativeDecimal(
            input.unitPrice,
            'unitPrice',
          ),
          remarks:
            procurementNullableString(input, 'remarks', 10000) ??
            null,
        },
      ),
    };
  }

  @Get('rfqs/:rfqId/comparison')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.quotation.view')
  async comparison(
    @Req() request: AuthenticatedRequest,
    @Param('rfqId', new ParseUUIDPipe({ version: '4' }))
    rfqId: string,
  ) {
    return {
      data: await this.sourcing.comparison(
        authOf(request),
        rfqId,
      ),
    };
  }

  @Post('rfq-lines/:rfqLineId/award')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.award.select')
  async selectAward(
    @Req() request: AuthenticatedRequest,
    @Param('rfqLineId', new ParseUUIDPipe({ version: '4' }))
    rfqLineId: string,
    @Body() body: unknown,
  ) {
    const input = procurementObject(body);
    return {
      data: await this.sourcing.selectAward(
        auditContext(request),
        rfqLineId,
        procurementUuid(
          input.supplierQuotationLineId,
          'supplierQuotationLineId',
        )!,
        procurementNullableString(
          input,
          'decisionReason',
          10000,
        ) ?? null,
      ),
    };
  }
}
