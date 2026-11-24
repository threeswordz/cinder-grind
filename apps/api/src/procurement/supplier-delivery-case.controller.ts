import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Req,
  UnprocessableEntityException, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  procurementObject, procurementString, procurementUuid,
} from './procurement-validation';
import { SupplierDeliveryCaseService, type SupplierCaseInput } from './supplier-delivery-case.service';
import type { SupplierAction } from './supplier-delivery-lifecycle';

const actions: SupplierAction[] = [
  'ACKNOWLEDGE', 'CONFIRM_IN_TRANSIT', 'REPORT_DELAY',
  'REPORT_DISCREPANCY', 'PM_REVIEW_DISCREPANCY', 'JAI_RECORD_CLAIM',
  'STORE_RECORD_RETURN_DISPATCH', 'STORE_RECORD_REPLACEMENT_RECEIPT',
];
const uuid = (value: unknown, key: string): string => {
  const result = procurementUuid(value, key);
  if (!result) throw new UnprocessableEntityException({ code: 'SUPPLIER_CASE_UUID_REQUIRED' });
  return result;
};

/**
 * Live role and Project checks occur INSIDE the transactional service;
 * authenticated business actors may have different minimal procurement,
 * receipt and Store permissions. No blanket PermissionGuard union or SYS_ADMIN.
 */
@Controller('procurement/purchase-orders/:orderId/supplier-case')
export class SupplierDeliveryCaseController {
  constructor(private readonly service: SupplierDeliveryCaseService) {}

  @Get()
  @UseGuards(AuthGuard)
  async read(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
  ) {
    return { data: await this.service.read(request.auth!, orderId) };
  }

  @Post('events')
  @UseGuards(AuthGuard, CsrfGuard)
  async record(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', new ParseUUIDPipe({ version: '4' })) orderId: string,
    @Body() body: unknown,
  ) {
    const x = procurementObject(body);
    const allow = [
      'action', 'expectedVersion', 'expectedPreviousEventId', 'evidenceDocumentId',
      'note', 'recordedPoAcknowledgmentEventId', 'discrepancyKind',
      'pmDecision', 'recordedGoodsReceiptId', 'newSupplierExpectedDate',
    ];
    if (Object.keys(x).some(key => !allow.includes(key)) ||
        !actions.includes(x.action as SupplierAction) ||
        !Number.isSafeInteger(x.expectedVersion) ||
        (x.expectedVersion as number) < 0 ||
        !Object.prototype.hasOwnProperty.call(x, 'expectedPreviousEventId')) {
      throw new UnprocessableEntityException({ code: 'SUPPLIER_CASE_INPUT_INVALID' });
    }
    const previous = x.expectedPreviousEventId === null ? null :
      uuid(x.expectedPreviousEventId, 'expectedPreviousEventId');
    const action = x.action as SupplierAction;
    const discrepancyKind = x.discrepancyKind;
    const pmDecision = x.pmDecision;
    const kinds = ['SHORT','WRONG_ITEM','EXCESS','DAMAGED'];
    const decisions = ['REQUEST_RETURN','REQUEST_REPLACEMENT','DOCUMENT_ONLY'];
    if ((discrepancyKind !== undefined && !kinds.includes(String(discrepancyKind))) ||
        (pmDecision !== undefined && !decisions.includes(String(pmDecision))) ||
        (x.newSupplierExpectedDate !== undefined &&
          (typeof x.newSupplierExpectedDate !== 'string' ||
           !/^\d{4}-\d{2}-\d{2}$/.test(x.newSupplierExpectedDate)))) {
      throw new UnprocessableEntityException({ code: 'SUPPLIER_CASE_ACTION_FIELDS_INVALID' });
    }
    // A pure transition rule also checks which of these fields belongs to its
    // current stage; this boundary rejects unknown/malformed field values.
    const input: SupplierCaseInput = {
      action, expectedVersion: x.expectedVersion as number,
      expectedPreviousEventId: previous,
      evidenceDocumentId: uuid(x.evidenceDocumentId, 'evidenceDocumentId'),
      note: procurementString(x, 'note', 2000),
      ...(x.recordedPoAcknowledgmentEventId !== undefined
        ? { recordedPoAcknowledgmentEventId: uuid(x.recordedPoAcknowledgmentEventId, 'recordedPoAcknowledgmentEventId') }
        : {}),
      ...(discrepancyKind !== undefined
        ? { discrepancyKind: discrepancyKind as NonNullable<SupplierCaseInput['discrepancyKind']> } : {}),
      ...(pmDecision !== undefined
        ? { pmDecision: pmDecision as NonNullable<SupplierCaseInput['pmDecision']> } : {}),
      ...(x.recordedGoodsReceiptId !== undefined
        ? { recordedGoodsReceiptId: uuid(x.recordedGoodsReceiptId, 'recordedGoodsReceiptId') } : {}),
      ...(x.newSupplierExpectedDate !== undefined
        ? { newSupplierExpectedDate: x.newSupplierExpectedDate as string } : {}),
    };
    return { data: await this.service.transition({
      auth: request.auth!,
      ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    }, orderId, input) };
  }
}
