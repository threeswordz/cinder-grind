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
  const order = [{ rfqLineId:'A',uomId:'EA',quantity:D('3') },{ rfqLineId:'B',uomId:'KG',quantity:D('2') }];
  const offers = [
    { rfqLineId:'A',uomId:'EA',supplierId:'a',quantity:D('3') },
    { rfqLineId:'B',uomId:'KG',supplierId:'a',quantity:D('2') },
    { rfqLineId:'A',uomId:'EA',supplierId:'b',quantity:D('3') },
    { rfqLineId:'B',uomId:'KG',supplierId:'c',quantity:D('2') },
  ];
  assert.equal(completeSupplierCount(order,offers),1);
  assert.equal(completeSupplierCount(order,[...offers,{rfqLineId:'B',uomId:'KG',supplierId:'b',quantity:D('2')}]),2);
});

test('PUR01 invalid stored commercial values fail closed at decision time', () => {
  for (const values of [
    ['100','-1','0','0','7'], ['100','0','-1','0','7'],
    ['100','0','0','-1','7'], ['100','0','0','0','-1'],
    ['100','0','0','0','101'], ['NaN','0','0','0','7'],
    ['100','0','Infinity','0','7'],
  ]) {
    const [subtotal,discount,freight,charges,vat] = values.map(D);
    assert.throws(() => poQuoteBasis(subtotal!,discount!,freight!,charges!,vat!));
  }
});
test('PUR01 counts only matching RFQ units and valid quantities, never duplicate demand', () => {
  const order = [{rfqLineId:'A',uomId:'EA',quantity:D('2')}];
  const valid = {rfqLineId:'A',uomId:'EA',supplierId:'s',quantity:D('2')};
  assert.equal(completeSupplierCount(order,[valid]),1);
  assert.equal(completeSupplierCount(order,[{...valid,uomId:'BOX',quantity:D('100')}]),0);
  assert.equal(completeSupplierCount(order,[{...valid,quantity:D('Infinity')}]),0);
  assert.equal(completeSupplierCount(order,[{...valid,quantity:D('0')}]),0);
  assert.equal(completeSupplierCount(order,[valid,{...valid,quantity:D('3')}]),1);
  assert.throws(() => completeSupplierCount([], [valid]));
  assert.throws(() => completeSupplierCount([...order,...order],[valid]));
  assert.throws(() => completeSupplierCount([{...order[0]!,quantity:D('0')}],[valid]));
});
