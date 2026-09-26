INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  (gen_random_uuid(), 'schedule.programme.view', 'SCHEDULE', 'View scheduling data within effective Project scope'),
  (gen_random_uuid(), 'schedule.activity.create', 'SCHEDULE', 'Create Activities within effective Project scope'),
  (gen_random_uuid(), 'schedule.activity.edit', 'SCHEDULE', 'Edit Activities within effective Project scope'),
  (gen_random_uuid(), 'schedule.activity.archive', 'SCHEDULE', 'Archive or reactivate Activities within effective Project scope'),
  (gen_random_uuid(), 'schedule.dependency.manage', 'SCHEDULE', 'Manage Activity dependencies within effective Project scope'),
  (gen_random_uuid(), 'schedule.calendar.manage', 'SCHEDULE', 'Manage company and Project Working Calendars within effective scope'),
  (gen_random_uuid(), 'admin.activity_types.manage', 'ADMIN', 'Manage company Activity Types')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.permission_code IN (
  'schedule.programme.view',
  'schedule.activity.create',
  'schedule.activity.edit',
  'schedule.activity.archive',
  'schedule.dependency.manage',
  'schedule.calendar.manage',
  'admin.activity_types.manage'
)
WHERE r.role_code = 'SYS_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
