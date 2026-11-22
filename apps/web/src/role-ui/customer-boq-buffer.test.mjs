import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeRetainedQuantity} from '../budget/customer-boq-buffer.ts';

test('DEC-054 saved Client quantity and buffer reopen at the selected integer-UOM precision',()=>{
  const saved={quantity:'12.0000',bufferQuantity:'2.0000'};
  const input={quantity:normalizeRetainedQuantity(saved.quantity,0),
    bufferQuantity:normalizeRetainedQuantity(saved.bufferQuantity,0)};
  assert.deepEqual(input,{quantity:'12',bufferQuantity:'2'});
  assert.deepEqual(saved,{quantity:'12.0000',bufferQuantity:'2.0000'},
    'immutable persisted pricing snapshots must not be rewritten');
});

test('DEC-054 selected Client UOM uses up to four significant decimals, without JS floating-point rounding',()=>{
  assert.equal(normalizeRetainedQuantity('10.2500',2),'10.25');
  assert.equal(normalizeRetainedQuantity('1.2340',3),'1.234');
  assert.equal(normalizeRetainedQuantity('0.0001',4),'0.0001');
  assert.equal(normalizeRetainedQuantity('1000',0),'1000');
  assert.equal(normalizeRetainedQuantity('2.0000',1),'2');
  assert.equal(normalizeRetainedQuantity('12.0000',7),'12');
});

test('DEC-054 never rounds material quantities or repairs malformed immutable values',()=>{
  for(const [saved,precision] of [['2.0001',0],['1.2010',1],['1.00001',4],
    ['-2.0000',4],['1e3',4],['1.0x',3],[' 2.0000',0]]) {
    assert.throws(()=>normalizeRetainedQuantity(saved,precision));
  }
  for(const badPrecision of [-1,0.5,NaN])
    assert.throws(()=>normalizeRetainedQuantity('2.0000',badPrecision));
});
