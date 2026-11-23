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
 * PUR10 protected staged review. These endpoints never cancel a PO or post
 * stock/finance. A separate independent finalized write gate is still required.
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
}
