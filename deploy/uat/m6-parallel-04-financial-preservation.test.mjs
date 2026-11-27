import test from 'node:test';
import assert from 'node:assert/strict';
import { financialTables, verifyM604FinancialPreservation } from './m6-parallel-04-financial-preservation.mjs';
const row = value => ({ __fm03_exact_row_json: JSON.stringify(value) });
function fixture() {
  const before = Object.fromEntries(financialTables.map(t => [t, [row({ id: t + '-1', amount: '731.25' })]]));
  before.subcontract_payment_allocations = [];
  before.client_receipt_allocations = [];
  return { before, after: structuredClone(before) };
}
const verify = f => verifyM604FinancialPreservation(f.before, f.after);
function fails(mutate, code) { const f = fixture(); mutate(f); assert.throws(() => verify(f), { message: code }); }
test('exact populated finance history and explicit empty optional tables', () => {
  const f = fixture(), result = verify(f);
  assert.equal(result.financialRowsPreserved, true);
  assert.deepEqual(result.emptyTables, ['subcontract_payment_allocations', 'client_receipt_allocations']);
  assert.equal(result.liveDatabaseVerified, false);
  assert.equal(result.milestone6Accepted, false);
});
test('new subcontract allocation cannot silently create payable settlement', () => fails(f => f.after.subcontract_payment_allocations.push(row({id:'new',allocated_amount:'694.69'})), 'M6_04_FINANCE_ROW_COUNT_DRIFT:subcontract_payment_allocations'));
test('new retention entry rejected even when original survives', () => fails(f => f.after.retention_ledger_entries.push(row({id:'new'})), 'M6_04_FINANCE_ROW_COUNT_DRIFT:retention_ledger_entries'));
test('variation insertion rejected', () => fails(f => f.after.subcontract_variations.push(row({id:'new'})), 'M6_04_FINANCE_ROW_COUNT_DRIFT:subcontract_variations'));
test('changed payment cancellation evidence rejected', () => fails(f => f.after.payments[0] = row({id:'payments-1',amount:'731.25',state:'CANCELLED'}), 'M6_04_FINANCE_ROW_DRIFT:payments'));
test('supplier invoice precision drift cannot hide in JSON rounding', () => {
  const f=fixture(); const a='{"id":"supplier_invoices-1","amount":9007199254740992.01}', b='{"id":"supplier_invoices-1","amount":9007199254740992.02}';
  assert.deepEqual(JSON.parse(a), JSON.parse(b));
  f.before.supplier_invoices=[{__fm03_exact_row_json:a}]; f.after.supplier_invoices=[{__fm03_exact_row_json:b}];
  assert.throws(()=>verify(f), {message:'M6_04_FINANCE_ROW_DRIFT:supplier_invoices'});
});
test('missing empty table is not preservation proof', () => fails(f => delete f.after.client_receipt_allocations, 'M6_04_FINANCE_TABLE_MISSING:client_receipt_allocations'));
test('empty required payment baseline rejected', () => fails(f => {f.before.payments=[];f.after.payments=[];}, 'M6_04_FINANCE_REQUIRED_POPULATION_EMPTY:payments'));
test('duplicate rows rejected', () => fails(f => f.after.payments.push(f.after.payments[0]), 'M6_04_FINANCE_DUPLICATE_ID:payments'));
test('missing exact SQL rejected', () => fails(f => f.after.client_invoices[0]={id:'client_invoices-1'}, 'M6_04_FINANCE_EXACT_SQL_REQUIRED:client_invoices'));
test('order independent exact records including reversed/cancelled history', () => {
  const f=fixture(); f.before.payments.push(row({id:'cancelled',state:'CANCELLED'})); f.after.payments=structuredClone(f.before.payments).reverse();
  assert.equal(verify(f).population.payments,2);
});
