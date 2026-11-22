// FM02 only adds two immutable permission catalogue definitions. No implicit grants.
import assert from 'node:assert/strict';
export const fm02Catalog=Object.freeze([
  Object.freeze({id:'f0020000-0000-4000-8000-000000000001',permission_code:'schedule.work_plan.prepare',module_code:'SCHEDULING',description:'Prepare an immutable FM02 weighted Project work-plan version'}),
  Object.freeze({id:'f0020000-0000-4000-8000-000000000002',permission_code:'schedule.work_plan.confirm',module_code:'SCHEDULING',description:'Confirm FM02 weighted work plan as explicitly configured Ben role'})
]);

// Reject partial, altered or unexpected FM02 rows before removing only these
// two new definitions from a preserved-predecessor permission digest.
// Historical permissions and every role/user grant remain strictly compared.
export function verifyFm02Catalog(rows){
  assert.ok(Array.isArray(rows),'FM02 permission catalogue rows required');
  const sort=records=>records.sort((a,b)=>a.id.localeCompare(b.id));
  const normalized=sort(rows.map(row=>({
    id:String(row.id),permission_code:row.permission_code,
    module_code:row.module_code,description:row.description,
  })));
  assert.deepEqual(normalized,sort(fm02Catalog.map(row=>({...row}))),
    'Only the exact two additive FM02 permission definitions may be excluded');
}
