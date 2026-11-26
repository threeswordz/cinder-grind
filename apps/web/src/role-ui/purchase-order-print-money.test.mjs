import assert from 'node:assert/strict';
import test from 'node:test';
import {approvedPrintTotals, formatPoLineAmount} from '../procurement/purchase-order-print-money.ts';
const order = (amounts, overrides = {}) => ({lines: amounts.map(amount => ({amount})), discountAmount:'0', freightAmount:'0', additionalChargeAmount:'0', vatRatePercent:'7', ...overrides});
test('fractional satang is accepted; gross rounds from exact net, not displayed parts', () => {
  assert.deepEqual(approvedPrintTotals(order(['0.375'])), {subtotal:'0.38',net:'0.38',vatAmount:'0.03',grandTotal:'0.40'});
  assert.equal(formatPoLineAmount('0.375'), '0.38');
});
test('sums precise amounts before rounding, including eight-place storage', () => {
  assert.equal(approvedPrintTotals(order(['0.00499999','0.00000001'])).subtotal,'0.01');
  assert.equal(approvedPrintTotals(order(['0.004','0.004'])).subtotal,'0.01');
  assert.equal(formatPoLineAmount('0.004'),'0.00');
  assert.equal(approvedPrintTotals(order(['0.00499999','1e-8'])).subtotal,'0.01');
  assert.equal(formatPoLineAmount('1.25e+21'),'1250000000000000000000.00');
});
test('commercial adjustments use exact net and VAT percent', () => {
  assert.deepEqual(approvedPrintTotals(order(['125.0000'],{discountAmount:'0.50',freightAmount:'1.25',additionalChargeAmount:'0.25',vatRatePercent:'7.50'})),{subtotal:'125.00',net:'126.00',vatAmount:'9.45',grandTotal:'135.45'});
});
test('missing values are not silently zeroed', () => {
  assert.deepEqual(approvedPrintTotals(order(['0.375'],{vatRatePercent:null})),{subtotal:'0.38',net:null,vatAmount:null,grandTotal:null});
});
test('large stored decimals remain exact beyond Number safe integer', () => {
  assert.equal(approvedPrintTotals(order(['999999999999999999999999999999.99999999'],{vatRatePercent:'0'})).grandTotal,'1000000000000000000000000000000.00');
});
test('rejects invalid amounts, negative net, unsupported header precision and VAT', () => {
  for (const raw of ['-1','1e-9','1e+30','1.000000001','NaN','01',' 1']) assert.throws(()=>approvedPrintTotals(order([raw])),/PO_PRINT_INVALID_MONEY_DECIMAL/);
  assert.throws(()=>approvedPrintTotals(order(['0.1'],{discountAmount:'0.11'})),/PO_PRINT_NEGATIVE_NET_TOTAL/);
  assert.throws(()=>approvedPrintTotals(order(['1'],{freightAmount:'0.001'})),/PO_PRINT_INVALID_MONEY_DECIMAL/);
  assert.throws(()=>approvedPrintTotals(order(['1'],{vatRatePercent:'100.01'})),/PO_PRINT_VAT_RATE_INVALID/);
});
