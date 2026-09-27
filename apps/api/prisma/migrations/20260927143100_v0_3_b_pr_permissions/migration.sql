INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'procurement.pr.view','PROCUREMENT','View Purchase Requests in accessible Projects'),
  (gen_random_uuid(),'procurement.pr.manage','PROCUREMENT','Create and maintain Draft Purchase Requests'),
  (gen_random_uuid(),'procurement.pr.submit','PROCUREMENT','Submit Purchase Requests for approval'),
  (gen_random_uuid(),'procurement.pr.approve','PROCUREMENT','Approve or reject Purchase Requests'),
  (gen_random_uuid(),'procurement.pr.cancel','PROCUREMENT','Cancel retained Purchase Requests')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" IN (
  'procurement.pr.view',
  'procurement.pr.manage',
  'procurement.pr.submit',
  'procurement.pr.approve',
  'procurement.pr.cancel'
)
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
