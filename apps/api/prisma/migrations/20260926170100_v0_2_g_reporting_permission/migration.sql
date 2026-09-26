INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'reporting.operational.view','REPORTING','View Project-scoped operational reporting and Project Engineer dashboard')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" = 'reporting.operational.view'
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
