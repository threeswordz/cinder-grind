INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  (gen_random_uuid(), 'schedule.baseline.create', 'SCHEDULE', 'Submit immutable Schedule Baseline versions within effective Project scope'),
  (gen_random_uuid(), 'schedule.baseline.approve', 'SCHEDULE', 'Approve or reject submitted Schedule Baselines when authorized by the configured Approval Matrix'),
  (gen_random_uuid(), 'schedule.progress.record', 'SCHEDULE', 'Record append-only Activity Progress within effective Project scope')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.permission_code IN (
  'schedule.baseline.create',
  'schedule.baseline.approve',
  'schedule.progress.record'
)
WHERE r.role_code = 'SYS_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
