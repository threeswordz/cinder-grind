import assert from 'node:assert/strict';
export const planIssueCatalog=[
  {
    "id": "d1030800-0000-4000-8000-000000000001",
    "permission_code": "inventory.material_plan.issue.post",
    "module_code": "INVENTORY",
    "description": "Record source-backed within-plan issues and request overage"
  },
  {
    "id": "d1030800-0000-4000-8000-000000000002",
    "permission_code": "inventory.material_plan.overage.review",
    "module_code": "INVENTORY",
    "description": "Independently review material plan overage"
  },
  {
    "id": "d1030800-0000-4000-8000-000000000003",
    "permission_code": "inventory.material_plan.overage.approve",
    "module_code": "INVENTORY",
    "description": "Independently approve reviewed material plan overage"
  },
  {
    "id": "d1030800-0000-4000-8000-000000000004",
    "permission_code": "inventory.material_plan.prototype.enable",
    "module_code": "INVENTORY",
    "description": "Explicitly enable isolated synthetic material plan policy"
  }
];
export function verifyPlanIssueCatalog(rows,required=false){
 if(!rows.length&&!required)return;
 assert.equal(rows.length,planIssueCatalog.length,'Complete exact plan issue permission catalog required');
 for(const expected of planIssueCatalog){
  const row=rows.find(r=>r.id===expected.id);assert.ok(row,'Plan issue permission missing');
  const {created_at,...definition}=row;
  if(created_at!==undefined)assert.ok((created_at instanceof Date||typeof created_at==='string')&&Number.isFinite(new Date(created_at).getTime()),'Invalid generated plan issue catalog timestamp');
  assert.deepEqual(definition,expected,'Plan issue permission definition changed');
 }
}
