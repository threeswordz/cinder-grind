import assert from 'node:assert/strict';
export const materialUomCatalog=[{id:'f0500000-0000-4000-8000-000000000001',permission_code:'master.material.conversion.manage',module_code:'MASTER_DATA',description:'Prepare explicit immutable material-specific conversion definitions; no inventory activation.'}];
export function verifyMaterialUomCatalog(rows,required=false){
 if(!rows.length&&!required)return;
 assert.equal(rows.length,materialUomCatalog.length);
 for(const expected of materialUomCatalog){
  const row=rows.find(r=>r.id===expected.id);assert.ok(row);
  const {created_at,...fields}=row;
  if(created_at!==undefined)assert.ok(Number.isFinite(new Date(created_at).getTime()));
  assert.deepEqual(fields,expected);
 }
}
