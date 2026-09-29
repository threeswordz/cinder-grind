INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'subcontracts.subcontractor.view','SUBCONTRACTS','View the Company Subcontractor register'),
  (gen_random_uuid(),'subcontracts.subcontractor.manage','SUBCONTRACTS','Create and edit Company Subcontractor records'),
  (gen_random_uuid(),'subcontracts.subcontractor.archive','SUBCONTRACTS','Archive and reactivate Subcontractor records'),
  (gen_random_uuid(),'subcontracts.agreement.view','SUBCONTRACTS','View Subcontract agreements within effective Project scope'),
  (gen_random_uuid(),'subcontracts.agreement.create','SUBCONTRACTS','Create Project-scoped Subcontract agreement Drafts'),
  (gen_random_uuid(),'subcontracts.agreement.edit','SUBCONTRACTS','Edit Project-scoped Subcontract agreement Drafts')
ON CONFLICT ("permission_code") DO NOTHING;

-- Technical provisioning supplies Stage A access only. No agreement approval,
-- certification, retention, Variation or Finance authority is granted here.
INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(), r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."permission_code" LIKE 'subcontracts.%'
WHERE r."role_code" = 'SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
