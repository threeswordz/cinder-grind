import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { completeSupplierCount, poQuoteBasis } from './purchase-order-quote-policy';
const D = (x: string) => new Prisma.Decimal(x);

test('PUR01 whole PO THB thresholds and VAT excluded', () => {
  for (const [subtotal,discount,freight,charges,required] of [
    ['10000','0','0','0',1],
    ['10000.01','0','0','0',2],
    ['50000','0','0','0',2],
    ['50000.01','0','0','0',3],
    ['9950','0','50.01','0',2],
    ['50100','150','50','0',2],
  ] as const) {
    assert.equal(poQuoteBasis(D(subtotal), D(discount), D(freight), D(charges), D('7')).requiredSuppliers, required);
  }
  assert.throws(() => poQuoteBasis(D('100'),null,D('0'),D('0'),D('7')));
  assert.throws(() => poQuoteBasis(D('100'),D('0'),D('0'),D('0'),null));
  assert.throws(() => poQuoteBasis(D('100'),D('101'),D('0'),D('0'),D('7')));
});

test('PUR01 distinct qualified suppliers must quote every PO line', () => {
  const order = [{ rfqLineId:'A',quantity:D('3') },{ rfqLineId:'B',quantity:D('2') }];
  const offers = [
    { rfqLineId:'A',supplierId:'a',quantity:D('3') },
    { rfqLineId:'B',supplierId:'a',quantity:D('2') },
    { rfqLineId:'A',supplierId:'b',quantity:D('3') },
    { rfqLineId:'B',supplierId:'c',quantity:D('2') },
  ];
  assert.equal(completeSupplierCount(order,offers),1);
  assert.equal(completeSupplierCount(order,[...offers,{rfqLineId:'B',supplierId:'b',quantity:D('2')}]),2);
});
