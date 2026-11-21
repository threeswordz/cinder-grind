// DEC-054 additive permission catalog; never an implicit user or role grant.
import assert from 'node:assert/strict';

export const dec054Catalog = Object.freeze([
  Object.freeze({id:'b0540000-0000-4000-8000-000000000001',permission_code:'budget.cost.self_approve',module_code:'BUDGET'}),
  Object.freeze({id:'b0540000-0000-4000-8000-000000000002',permission_code:'budget.cost.full_view',module_code:'BUDGET'}),
]);

// The predecessor upgrade may ignore only verified new catalog rows while
// preserving exact hashes of ALL older permissions and every historical grant.
export function verifyDec054Catalog(rows){
  assert.ok(Array.isArray(rows),'DEC-054 permission catalog query must return rows');
  const normalized=rows.map(row=>({
    id:String(row.id),permission_code:row.permission_code,module_code:row.module_code,
  })).sort((a,b)=>a.id.localeCompare(b.id));
  assert.deepEqual(normalized,dec054Catalog.map(row=>({...row})).sort((a,b)=>a.id.localeCompare(b.id)),
    'DEC-054 permission definitions must be exactly the two reviewed catalog entries');
}
