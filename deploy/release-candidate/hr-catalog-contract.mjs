import assert from 'node:assert/strict';
export const hrCatalog = [
  {
    "id": "b0140000-0000-4000-8000-000000000001",
    "permission_code": "hr.employment.view",
    "module_code": "HR",
    "description": "Read explicitly authorized HR employment data"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000002",
    "permission_code": "hr.employment.manage",
    "module_code": "HR",
    "description": "Record reasoned employment revisions"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000003",
    "permission_code": "hr.identity.view",
    "module_code": "HR",
    "description": "Explicitly reveal authorized private identity data"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000004",
    "permission_code": "hr.identity.manage",
    "module_code": "HR",
    "description": "Record private identity revisions and verified person links"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000005",
    "permission_code": "hr.bank.view",
    "module_code": "HR",
    "description": "Explicitly reveal authorized bank fields"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000006",
    "permission_code": "hr.bank.manage",
    "module_code": "HR",
    "description": "Record protected bank revisions"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000007",
    "permission_code": "hr.documents.view",
    "module_code": "HR",
    "description": "Read authorized HR private documents through HR routes"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000008",
    "permission_code": "hr.documents.manage",
    "module_code": "HR",
    "description": "Manage authorized canonical HR private documents"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000009",
    "permission_code": "hr.operational.view",
    "module_code": "HR",
    "description": "Read salary-free employees within existing Project scope"
  },
  {
    "id": "b0140000-0000-4000-8000-000000000010",
    "permission_code": "hr.access.manage",
    "module_code": "HR",
    "description": "Administer target-owned HR Company/category scope without self-grant"
  }
];
export function verifyHrCatalog(rows, complete=false) {
 if(complete) assert.equal(rows.length,10,'Complete migrated HR capability catalog required');
 for(const row of rows){const expected=hrCatalog.find(x=>x.id===row.id);assert.ok(expected,'Unapproved HR capability identity');for(const [key,value] of Object.entries(expected))assert.equal(row[key],value,'HR capability definition changed');}
}
