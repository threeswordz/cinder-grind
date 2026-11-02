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
 for(const expected of materialPlanCatalog)assert.deepEqual(rows.find(r=>r.id===expected.id),expected,'Material plan permission definition changed');
}
