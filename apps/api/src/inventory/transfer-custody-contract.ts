import { Prisma } from '@prisma/client';
import { UnprocessableEntityException } from '@nestjs/common';
import { inventoryObject, inventoryUuid, requiredInventoryString } from './inventory-validation';

export const TRANSFER = 'inventory.transfer.';
export function transferCommand(value: unknown) {
  const input = inventoryObject(value);
  if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) {
    throw new UnprocessableEntityException({ code: 'TRANSFER_VERSION_REQUIRED' });
  }
  return {
    requestKey: inventoryUuid(input.requestKey, 'requestKey'),
    expectedVersion: Number(input.expectedVersion),
    reason: requiredInventoryString(input, 'reason', 2000),
  };
}

export function transferReceipt(value: unknown) {
  const input = inventoryObject(value);
  const command = transferCommand(value);
  if (!Array.isArray(input.lines) || !input.lines.length || input.lines.length > 200) {
    throw new UnprocessableEntityException({ code: 'TRANSFER_RECEIPT_LINES_INVALID' });
  }
  const lines = input.lines.map((raw) => {
    const row = inventoryObject(raw);
    if (typeof row.quantity !== 'string' || !/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(row.quantity)) {
      throw new UnprocessableEntityException({ code: 'TRANSFER_RECEIPT_QUANTITY_INVALID' });
    }
    const quantity = new Prisma.Decimal(row.quantity);
    if (quantity.lte(0)) throw new UnprocessableEntityException({ code: 'TRANSFER_RECEIPT_QUANTITY_INVALID' });
    return {
      transferItemId: inventoryUuid(row.transferItemId, 'transferItemId'),
      quantity,
      note: requiredInventoryString(row, 'note', 2000),
    };
  }).sort((a, b) => a.transferItemId.localeCompare(b.transferItemId));
  if (new Set(lines.map((line) => line.transferItemId)).size !== lines.length) {
    throw new UnprocessableEntityException({ code: 'TRANSFER_RECEIPT_DUPLICATE_LINE' });
  }
  return { ...command, documentId: inventoryUuid(input.documentId, 'documentId'), lines };
}
