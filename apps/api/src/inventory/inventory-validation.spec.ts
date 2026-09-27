import assert from 'node:assert/strict';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';

import {
  inventoryBoolean,
  inventoryObject,
  inventoryUuid,
  nullableInventoryString,
  requiredInventoryString,
} from './inventory-validation';

test('Inventory validation normalizes Warehouse input', () => {
  const input = inventoryObject({
    warehouseCode: '  MAIN  ',
    warehouseName: ' Main Store ',
    location: '',
    isSiteWarehouse: false,
  });
  assert.equal(
    requiredInventoryString(input, 'warehouseCode', 80),
    'MAIN',
  );
  assert.equal(
    requiredInventoryString(input, 'warehouseName', 200),
    'Main Store',
  );
  assert.equal(nullableInventoryString(input, 'location', 500), null);
  assert.equal(
    inventoryBoolean(input.isSiteWarehouse, 'isSiteWarehouse'),
    false,
  );
});

test('Inventory validation rejects invalid UUID and wrong boolean type', () => {
  assert.throws(
    () => inventoryUuid('not-a-uuid', 'projectId'),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );
  assert.throws(
    () => inventoryBoolean('false', 'isSiteWarehouse'),
    (error: unknown) => error instanceof UnprocessableEntityException,
  );
});
