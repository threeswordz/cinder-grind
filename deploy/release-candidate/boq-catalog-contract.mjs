import assert from 'node:assert/strict';
export const boqCatalog = [
  ['budget.quantity.view','Read cost BOQ quantities without monetary fields'],
  ['budget.customer.view','Read Customer BOQ commercial versions'],
  ['budget.customer.manage','Prepare Customer BOQ versions and edits'],
  ['budget.customer.submit','Submit Customer BOQ for configured approval'],
  ['budget.customer.approve','Decide Customer BOQ through configured maker-checker'],
  ['budget.project_summary.view','Read Project contract billed and received totals without BOQ detail'],
].map(([code,description],i)=>({id:'b0130000-0000-4000-8000-'+String(i+1).padStart(12,'0'),permission_code:code,module_code:'BUDGET',description}));
// Only these exact NEW catalog definitions may be separated from the old table
// hash. Role assignments, old permission definitions and every business row stay strict.
export function verifyBoqCatalog(rows) {
  for (const row of rows) {
    const expected=boqCatalog.find(x=>x.id===row.id);
    assert.ok(expected,'Unapproved BOQ capability identity');
    for(const [key,value] of Object.entries(expected)) assert.equal(row[key],value,'BOQ catalog definition changed: '+key);
  }
}
