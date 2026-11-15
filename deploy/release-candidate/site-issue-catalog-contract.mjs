import assert from 'node:assert/strict';
export const siteIssueCatalog=[
  {
    "id": "d1141400-0000-4000-8000-000000000001",
    "permission_code": "site.issue.view",
    "module_code": "SITE",
    "description": "View site issues within effective Project scope"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000002",
    "permission_code": "site.issue.report",
    "module_code": "SITE",
    "description": "Report site issues within effective Project scope"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000003",
    "permission_code": "site.issue.follow_up",
    "module_code": "SITE",
    "description": "Record assigned site issue follow-up and asset severity assessment"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000004",
    "permission_code": "site.issue.verify",
    "module_code": "SITE",
    "description": "Verify resolution of own reported site issues"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000005",
    "permission_code": "site.issue.close",
    "module_code": "SITE",
    "description": "Close assigned site issues after successful reporter verification"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000006",
    "permission_code": "site.issue.escalation.view",
    "module_code": "SITE",
    "description": "Read site issue escalations addressed to the assigned recipient"
  },
  {
    "id": "d1141400-0000-4000-8000-000000000007",
    "permission_code": "site.issue.routing.manage",
    "module_code": "SITE",
    "description": "Configure explicit Project site issue owner and escalation recipient"
  }
];
export function verifySiteIssueCatalog(rows,required=false){
 if(!rows.length&&!required)return;
 assert.equal(rows.length,siteIssueCatalog.length,'Complete exact site issue permission catalog required');
 for(const expected of siteIssueCatalog){
  const row=rows.find(r=>r.id===expected.id);assert.ok(row,'Site issue permission missing');
  const {created_at,...definition}=row;
  if(created_at!==undefined)assert.ok((created_at instanceof Date||typeof created_at==='string')&&Number.isFinite(new Date(created_at).getTime()),'Invalid generated site issue catalog timestamp');
  assert.deepEqual(definition,expected,'Site issue permission definition changed');
 }
}
