import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Req,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { procurementObject, procurementString, procurementUuid } from './procurement-validation';
import { PurchaseOrderCancellationCaseService } from './purchase-order-cancellation-case.service';
import type { Pur10Action } from './purchase-order-cancellation-contract';

const ACTIONS: readonly string[] = [
  'PROPOSE', 'PM_FORWARD', 'PM_RETURN', 'BEN_APPROVE', 'BEN_REJECT',
];

/**
 * PUR10 protected, nonposting decision events plus explicit Ben-only finalization.
 * The separate finalization route cancels only after live authorization, source,
 * receipt and Finance checks; neither route posts stock or Finance adjustments.
 */
@Controller('procurement/purchase-orders/:orderId/cancellation-case')
export class PurchaseOrderCancellationCaseController {
  constructor(private readonly cases: PurchaseOrderCancellationCaseService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  read(@Req() req: AuthenticatedRequest,
       @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string) {
    return this.cases.read(req.auth!, orderId).then(data => ({ data }));
  }

  @Post('events')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view')
  change(@Req() req: AuthenticatedRequest,
         @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
         @Body() body: unknown) {
    const x = procurementObject(body);
    if (Object.keys(x).some(k => ![
      'action', 'expectedVersion', 'expectedPreviousEventId', 'note',
    ].includes(k)) || !ACTIONS.includes(String(x.action)) ||
        !Number.isSafeInteger(x.expectedVersion) ||
        typeof x.expectedPreviousEventId === 'undefined') {
      throw new UnprocessableEntityException({ code: 'PUR10_REQUEST_INVALID' });
    }
    const previous = x.expectedPreviousEventId === null ? null :
      procurementUuid(x.expectedPreviousEventId, 'expectedPreviousEventId');
    return this.cases.transition(
      {
        auth: req.auth!,
        ...(req.correlationId ? { correlationId: req.correlationId } : {}),
      },
      orderId, x.action as Pur10Action, x.expectedVersion as number,
      previous, procurementString(x, 'note', 2000),
    ).then(data => ({ data }));
  }
  @Post('finalize')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('procurement.po.view', 'procurement.po.approve', 'procurement.po.cancel')
  finalize(
    @Req() req: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: unknown,
  ) {
    const x = procurementObject(body);
    const keys = [
      'expectedVersion', 'expectedPreviousEventId',
      'supplierAgreementEvidence', 'supplierAgreed',
      'noDepositOrPenalty', 'noDeliveryOrInvoice',
    ];
    if (Object.keys(x).some(k => !keys.includes(k)) ||
        !Number.isSafeInteger(x.expectedVersion) ||
        x.supplierAgreed !== true ||
        x.noDepositOrPenalty !== true || x.noDeliveryOrInvoice !== true)
      throw new UnprocessableEntityException({
        code: 'PUR10_EXPLICIT_BEN_SUPPLIER_AND_NO_EXCEPTION_ATTESTATION_REQUIRED',
      });
    const previous = procurementUuid(x.expectedPreviousEventId, 'expectedPreviousEventId');
    if (!previous) throw new UnprocessableEntityException({ code: 'PUR10_FINALIZATION_EVENT_REQUIRED' });
    return this.cases.finalize({
      auth: req.auth!,
      ...(req.correlationId ? { correlationId: req.correlationId } : {}),
    }, orderId, x.expectedVersion as number, previous, {
      supplierAgreementEvidence: procurementString(x, 'supplierAgreementEvidence', 1200),
      supplierAgreed: true, noDepositOrPenalty: true, noDeliveryOrInvoice: true,
    }).then(data => ({ data }));
  }

}
