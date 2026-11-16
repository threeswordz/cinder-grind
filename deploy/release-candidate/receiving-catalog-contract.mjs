import assert from 'node:assert/strict';
export const receivingCatalog=[
  {
    "id": "d1151300-0000-4000-8000-000000000001",
    "permission_code": "inventory.receiving.view",
    "module_code": "INVENTORY",
    "description": "View scoped physical receiving custody and history"
  },
  {
    "id": "d1151300-0000-4000-8000-000000000002",
    "permission_code": "inventory.receiving.capture",
    "module_code": "INVENTORY",
    "description": "Capture physical delivery outside usable stock"
  },
  {
    "id": "d1151300-0000-4000-8000-000000000003",
    "permission_code": "inventory.receiving.edit",
    "module_code": "INVENTORY",
    "description": "Correct own unposted receiving custody and evidence with history"
  },
  {
    "id": "d1151300-0000-4000-8000-000000000004",
    "permission_code": "inventory.receiving.link_po",
    "module_code": "INVENTORY",
    "description": "Link receiving custody to a current approved PO"
  },
  {
    "id": "d1151300-0000-4000-8000-000000000005",
    "permission_code": "inventory.receiving.check",
    "module_code": "INVENTORY",
    "description": "Independently check physical receiving documents and quantities"
  },
  {
    "id": "d1151300-0000-4000-8000-000000000006",
    "permission_code": "inventory.receiving.configure",
    "module_code": "INVENTORY",
    "description": "Configure explicit synthetic Project receiving enforcement"
  }
];
export function verifyReceivingCatalog(rows,required=false){
 if(!rows.length&&!required)return;
 assert.equal(rows.length,receivingCatalog.length,'Complete exact receiving permission catalog required');
 for(const expected of receivingCatalog){
  const row=rows.find(r=>r.id===expected.id);assert.ok(row,'Site issue permission missing');
  const {created_at,...definition}=row;
  if(created_at!==undefined)assert.ok((created_at instanceof Date||typeof created_at==='string')&&Number.isFinite(new Date(created_at).getTime()),'Invalid generated receiving catalog timestamp');
  assert.deepEqual(definition,expected,'Site issue permission definition changed');
 }
}
