import assert from 'node:assert/strict';
export const materialRequestCatalog=[
  {
    "id": "d1020000-0000-4000-8000-000000000001",
    "permission_code": "inventory.material_request.view",
    "module_code": "INVENTORY",
    "description": "View scoped material requests and fulfillment"
  },
  {
    "id": "d1020000-0000-4000-8000-000000000002",
    "permission_code": "inventory.material_request.create",
    "module_code": "INVENTORY",
    "description": "Record Foreman material requests through Store"
  },
  {
    "id": "d1020000-0000-4000-8000-000000000003",
    "permission_code": "inventory.material_request.edit",
    "module_code": "INVENTORY",
    "description": "Append reasoned material request revisions"
  },
  {
    "id": "d1020000-0000-4000-8000-000000000004",
    "permission_code": "inventory.material_request.link",
    "module_code": "INVENTORY",
    "description": "Link posted canonical material issue lines"
  },
  {
    "id": "d1020000-0000-4000-8000-000000000005",
    "permission_code": "inventory.material_request.acknowledge",
    "module_code": "INVENTORY",
    "description": "Record explicit signed receipt evidence"
  }
];
export function verifyMaterialRequestCatalog(rows,complete=false){
 if(complete)assert.equal(rows.length,materialRequestCatalog.length,'Complete material request catalog required');
 for(const row of rows){const expected=materialRequestCatalog.find(x=>x.id===row.id);assert.ok(expected,'Unapproved material request permission');for(const [k,v] of Object.entries(expected))assert.equal(row[k],v,'Material request permission changed');}
}
