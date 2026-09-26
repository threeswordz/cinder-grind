-- Keep existing SYS_ADMIN roles aligned with the approved Project
-- administration baseline when Stage E permissions are introduced.

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT
  gen_random_uuid(),
  r."id",
  p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."role_code" = 'SYS_ADMIN'
  AND p."permission_code" IN (
    'projects.access_all',
    'projects.project.view',
    'projects.project.create',
    'projects.project.edit',
    'projects.project.archive',
    'projects.team.view',
    'projects.team.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
