INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  (gen_random_uuid(), 'site.daily_report.view', 'SITE', 'View Daily Site Reports within effective Project scope'),
  (gen_random_uuid(), 'site.daily_report.create', 'SITE', 'Create Daily Site Reports within effective Project scope'),
  (gen_random_uuid(), 'site.daily_report.edit', 'SITE', 'Edit draft Daily Site Reports and append submitted-report corrections within effective Project scope'),
  (gen_random_uuid(), 'site.daily_report.submit', 'SITE', 'Submit Daily Site Reports and append linked Activity Progress within effective Project scope')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.permission_code IN (
  'site.daily_report.view',
  'site.daily_report.create',
  'site.daily_report.edit',
  'site.daily_report.submit'
)
WHERE r.role_code = 'SYS_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
