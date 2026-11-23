import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { supplierDateWindow, supplierLineIndicator } from './supplier-commitment-indicator';

const dec = (value: string) => new Prisma.Decimal(value);
const input = {
  orderedQuantity: dec('10'),
  receivedQuantity: dec('4.25'),
  receivedAtSite: dec('2.25'),
  expectedDelivery: '2026-12-08',
  requiredOnSite: null,
  previousApprovedExpectedDelivery: null,
  asOfThailandDate: '2026-11-24',
  cancelled: false,
};

test('SS14 due windows are inclusive at 14 / 7 / 0 and late only after expected date', () => {
  assert.deepEqual(supplierDateWindow('2026-12-08', '2026-11-24'),
    { window: 'WITHIN_14_DAYS', daysUntil: 14 });
  assert.deepEqual(supplierDateWindow('2026-12-01', '2026-11-24'),
    { window: 'WITHIN_7_DAYS', daysUntil: 7 });
  assert.deepEqual(supplierDateWindow('2026-11-24', '2026-11-24'),
    { window: 'DUE_TODAY', daysUntil: 0 });
  assert.deepEqual(supplierDateWindow('2026-11-23', '2026-11-24'),
    { window: 'LATE', daysUntil: -1 });
  assert.deepEqual(supplierDateWindow('2026-12-09', '2026-11-24'),
    { window: 'LATER', daysUntil: 15 });
  assert.deepEqual(supplierDateWindow(null, '2026-11-24'),
    { window: 'DATE_UNKNOWN', daysUntil: null });
});

test('SS14 partial posted GR leaves pending demand and counts only real selected-site GR', () => {
  const result = supplierLineIndicator(input);
  assert.deepEqual(
    [result.orderedQuantity, result.receivedQuantity, result.receivedAtSelectedSite,
      result.pendingQuantity, result.deliveryState],
    ['10.0000', '4.2500', '2.2500', '5.7500', 'WITHIN_14_DAYS'],
  );
  assert.equal(result.targetSite, 'NOT_RECORDED_ON_PO');
  assert.equal(result.supplierAcknowledgment, 'NOT_VERIFIED');
  assert.equal(result.requiredOnSiteWindow, 'DATE_UNKNOWN');
});

test('SS14 requiredOnSite is separate from delivery date; absent PO expected date is unknown', () => {
  const result = supplierLineIndicator({
    ...input, expectedDelivery: null, requiredOnSite: '2026-11-24',
  });
  assert.equal(result.deliveryState, 'DATE_UNKNOWN');
  assert.equal(result.requiredOnSiteWindow, 'DUE_TODAY');
  assert.equal(result.daysUntilExpectedDelivery, null);
});

test('SS14 explicit approved PO revision date change is not a verified supplier reschedule', () => {
  const revised = supplierLineIndicator({
    ...input, previousApprovedExpectedDelivery: '2026-12-01',
  });
  assert.equal(revised.dateRevisedFromPreviousApproved, true);
  assert.equal(revised.previousApprovedExpectedDelivery, '2026-12-01');
  assert.equal(revised.supplierAcknowledgment, 'NOT_VERIFIED');
  const unchanged = supplierLineIndicator({
    ...input, previousApprovedExpectedDelivery: '2026-12-08',
  });
  assert.equal(unchanged.dateRevisedFromPreviousApproved, false);
  assert.equal(unchanged.previousApprovedExpectedDelivery, null);
});

test('SS14 cancelled approved PO is not shown as a live supplier obligation', () => {
  const result = supplierLineIndicator({
    ...input, cancelled: true, expectedDelivery: '2026-11-20',
  });
  assert.equal(result.deliveryState, 'CANCELLED');
  assert.equal(result.pendingQuantity, '0.0000');
  const complete = supplierLineIndicator({
    ...input, receivedQuantity: dec('10'), receivedAtSite: dec('10'),
    expectedDelivery: '2026-11-20',
  });
  assert.equal(complete.deliveryState, 'FULFILLED');
});

test('SS14 invalid dates, over-receipt and site-receipt mismatch fail closed', () => {
  assert.throws(() => supplierDateWindow('2026-02-30', '2026-11-24'),
    /SS14_SUPPLIER_DATE_INVALID/);
  assert.throws(() => supplierLineIndicator({
    ...input, receivedQuantity: dec('10.001'),
  }), /SS14_SUPPLIER_QUANTITY_SOURCE_INVALID/);
  assert.throws(() => supplierLineIndicator({
    ...input, receivedAtSite: dec('5'),
  }), /SS14_SUPPLIER_QUANTITY_SOURCE_INVALID/);
});
