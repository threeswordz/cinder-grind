INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'budget.boq.view','BUDGET','View Project BOQ and budget structure'),
  (gen_random_uuid(),'budget.boq.manage','BUDGET','Create and maintain Project BOQ sections and items'),
  (gen_random_uuid(),'budget.revision.view','BUDGET','View Budget revision history and summaries'),
  (gen_random_uuid(),'budget.revision.submit','BUDGET','Submit immutable Budget revision snapshots for approval'),
  (gen_random_uuid(),'budget.revision.approve','BUDGET','Approve or reject Budget revisions')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" IN (
  'budget.boq.view',
  'budget.boq.manage',
  'budget.revision.view',
  'budget.revision.submit',
  'budget.revision.approve'
)
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
