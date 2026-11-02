import assert from 'node:assert/strict';
export const materialPlanCatalog=[
  {
    "id": "d1021400-0000-4000-8000-000000000001",
    "permission_code": "inventory.material_plan.view",
    "module_code": "INVENTORY",
    "description": "View scoped material usage plans"
  },
  {
    "id": "d1021400-0000-4000-8000-000000000002",
    "permission_code": "inventory.material_plan.create",
    "module_code": "INVENTORY",
    "description": "Prepare scoped material usage plans"
  },
  {
    "id": "d1021400-0000-4000-8000-000000000003",
    "permission_code": "inventory.material_plan.revise",
    "module_code": "INVENTORY",
    "description": "Append material usage plan revisions"
  },
  {
    "id": "d1021400-0000-4000-8000-000000000004",
    "permission_code": "inventory.material_plan.submit",
    "module_code": "INVENTORY",
    "description": "Submit material usage plan revisions"
  },
  {
    "id": "d1021400-0000-4000-8000-000000000005",
    "permission_code": "inventory.material_plan.approve",
    "module_code": "INVENTORY",
    "description": "Independently decide material usage plans"
  }
];
export function verifyMaterialPlanCatalog(rows,required=false){
 if(!rows.length&&!required)return;
 assert.equal(rows.length,materialPlanCatalog.length,'Complete exact material plan catalog required');
 for(const expected of materialPlanCatalog){
  const row=rows.find(r=>r.id===expected.id);assert.ok(row,'Material plan permission definition missing');
  const {created_at,...definition}=row;
  // Only the newly minted rows have no predecessor timestamp to compare.
  // Existing catalog rows, including their timestamps, stay in the old digest.
  if(created_at!==undefined)assert.ok((created_at instanceof Date || typeof created_at==='string') && Number.isFinite(new Date(created_at).getTime()),'Material plan permission creation timestamp invalid');
  assert.deepEqual(definition,expected,'Material plan permission definition changed');
 }

}
