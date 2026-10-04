-- V0.8-A Management permissions.
-- Forward-only: do not modify prior executed migrations.
-- Technical SYS_ADMIN is intentionally not granted these business permissions.

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (
    gen_random_uuid(),
    'management.dashboard.view',
    'MANAGEMENT',
    'View authorized Project-scoped Management summaries within effective Project scope'
  ),
  (
    gen_random_uuid(),
    'management.portfolio.view',
    'MANAGEMENT',
    'View authorized cross-Project Management portfolio summaries'
  ),
  (
    gen_random_uuid(),
    'management.report.export',
    'MANAGEMENT',
    'Export an already-authorized Management report result'
  )
ON CONFLICT ("permission_code") DO NOTHING;
