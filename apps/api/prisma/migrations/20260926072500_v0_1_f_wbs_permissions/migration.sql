INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  (gen_random_uuid(), 'wbs.wbs.view', 'WBS', 'View WBS within effective Project scope'),
  (gen_random_uuid(), 'wbs.wbs.create', 'WBS', 'Create WBS within effective Project scope'),
  (gen_random_uuid(), 'wbs.wbs.edit', 'WBS', 'Edit WBS within effective Project scope'),
  (gen_random_uuid(), 'wbs.wbs.archive', 'WBS', 'Archive or reactivate WBS within effective Project scope'),
  (gen_random_uuid(), 'wbs.cost_code.view', 'WBS', 'View company Cost Codes'),
  (gen_random_uuid(), 'wbs.cost_code.create', 'WBS', 'Create company Cost Codes'),
  (gen_random_uuid(), 'wbs.cost_code.edit', 'WBS', 'Edit company Cost Codes'),
  (gen_random_uuid(), 'wbs.cost_code.archive', 'WBS', 'Archive or reactivate company Cost Codes')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.permission_code IN (
  'wbs.wbs.view','wbs.wbs.create','wbs.wbs.edit','wbs.wbs.archive',
  'wbs.cost_code.view','wbs.cost_code.create','wbs.cost_code.edit','wbs.cost_code.archive'
)
WHERE r.role_code = 'SYS_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
