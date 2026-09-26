-- Keep existing company-scoped SYS_ADMIN roles aligned with the approved
-- technical administration baseline when V0.1-D permissions are introduced.

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT
  gen_random_uuid(),
  r."id",
  p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."role_code" = 'SYS_ADMIN'
  AND p."permission_code" IN (
    'master.customer.view',
    'master.customer.manage',
    'master.supplier.view',
    'master.supplier.manage',
    'master.employee.view',
    'master.employee.manage',
    'master.material.view',
    'master.material.manage',
    'master.uom.view',
    'master.uom.manage'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
