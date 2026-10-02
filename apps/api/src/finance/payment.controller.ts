import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  financeDate,
  financeNonEmpty,
  financeNullableString,
  financeObject,
  financePositiveDecimal,
  financeString,
  financeUuid,
} from './finance-validation';
import {
  PaymentAllocationTarget,
  PaymentDirection,
  PaymentService,
} from './payment.service';

function authOf(r: AuthenticatedRequest) {
  if (!r.auth) throw new Error('Authentication context is missing.');
  return r.auth;
}

function contextOf(r: AuthenticatedRequest) {
  return {
    auth: authOf(r),
    ...(r.correlationId ? { correlationId: r.correlationId } : {}),
  };
}

function direction(input: Record<string, unknown>): PaymentDirection {
  const value = financeString(input, 'direction', 20).toUpperCase();
  if (value !== 'OUTBOUND' && value !== 'INBOUND') {
    throw new UnprocessableEntityException({
      code: 'PAYMENT_DIRECTION_INVALID',
      detail: 'Payment direction must be OUTBOUND or INBOUND.',
    });
  }
  return value;
}

function targetType(
  input: Record<string, unknown>,
): PaymentAllocationTarget {
  const value = financeString(input, 'targetType', 40).toUpperCase();
  if (
    ![
      'SUPPLIER_INVOICE',
      'CLIENT_INVOICE',
      'SUBCONTRACT_CERTIFICATION',
    ].includes(value)
  ) {
    throw new UnprocessableEntityException({
      code: 'PAYMENT_TARGET_TYPE_INVALID',
      detail: 'Unsupported Payment allocation target type.',
    });
  }
  return value as PaymentAllocationTarget;
}

@Controller('finance')
export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  @Get('payment-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async projects(@Req() r: AuthenticatedRequest) {
    return { data: await this.service.projects(authOf(r)) };
  }

  @Get('payment-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.submit')
  async workflows(@Req() r: AuthenticatedRequest) {
    return { data: await this.service.workflowOptions(authOf(r)) };
  }

  @Get('projects/:projectId/payment-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async options(
    @Req() r: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return { data: await this.service.options(authOf(r), projectId) };
  }

  @Get('projects/:projectId/payments')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async list(
    @Req() r: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return { data: await this.service.list(authOf(r), projectId) };
  }

  @Get('payments/:paymentId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async get(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
  ) {
    return { data: await this.service.get(authOf(r), paymentId) };
  }

  @Post('projects/:projectId/payments')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.create')
  async create(
    @Req() r: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.create(contextOf(r), projectId, {
        direction: direction(input),
        paymentDate: financeDate(input, 'paymentDate')!,
        supplierId: financeUuid(input, 'supplierId', true),
        customerId: financeUuid(input, 'customerId', true),
        subcontractorId: financeUuid(input, 'subcontractorId', true),
        amount: financePositiveDecimal(input, 'amount'),
        paymentMethod: financeNullableString(input, 'paymentMethod', 120),
        reference: financeNullableString(input, 'reference', 200),
        createKey: financeString(input, 'createKey', 120),
      }),
    };
  }

  @Patch('payments/:paymentId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.edit')
  async update(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    const data = {
      ...(input.paymentDate !== undefined
        ? { paymentDate: financeDate(input, 'paymentDate')! }
        : {}),
      ...(input.amount !== undefined
        ? { amount: financePositiveDecimal(input, 'amount') }
        : {}),
      ...(input.paymentMethod !== undefined
        ? {
            paymentMethod: financeNullableString(
              input,
              'paymentMethod',
              120,
            ),
          }
        : {}),
      ...(input.reference !== undefined
        ? {
            reference: financeNullableString(input, 'reference', 200),
          }
        : {}),
    };
    financeNonEmpty(data);
    return {
      data: await this.service.update(contextOf(r), paymentId, data),
    };
  }

  @Post('payments/:paymentId/allocations')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.edit')
  async addAllocation(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.addAllocation(contextOf(r), paymentId, {
        targetType: targetType(input),
        targetId: financeUuid(input, 'targetId')!,
        amount: financePositiveDecimal(input, 'amount'),
        actionKey: financeString(input, 'actionKey', 120),
      }),
    };
  }

  @Post('payments/:paymentId/allocations/:allocationId/remove')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.edit')
  async removeAllocation(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Param('allocationId', new ParseUUIDPipe({ version: '4' }))
    allocationId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.removeAllocation(
        contextOf(r),
        paymentId,
        targetType(input),
        allocationId,
        financeString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('payments/:paymentId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.submit')
  async submit(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.submit(
        contextOf(r),
        paymentId,
        financeString(input, 'workflowCode', 80),
        financeString(input, 'actionKey', 120),
      ),
    };
  }

  @Post('payments/:paymentId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.approve')
  async approve(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.approve(
        contextOf(r),
        paymentId,
        financeString(input, 'actionKey', 120),
        financeNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('payments/:paymentId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.reject')
  async reject(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.reject(
        contextOf(r),
        paymentId,
        financeString(input, 'actionKey', 120),
        financeNullableString(input, 'comment', 5000) ?? undefined,
      ),
    };
  }

  @Post('payments/:paymentId/cancel')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view', 'finance.payment.cancel')
  async cancel(
    @Req() r: AuthenticatedRequest,
    @Param('paymentId', new ParseUUIDPipe({ version: '4' }))
    paymentId: string,
    @Body() body: unknown,
  ) {
    const input = financeObject(body);
    return {
      data: await this.service.cancel(
        contextOf(r),
        paymentId,
        financeString(input, 'actionKey', 120),
        financeString(input, 'reason', 5000),
      ),
    };
  }
}
