INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'inventory.warehouse.view','INVENTORY','View Warehouses within effective Company and Project scope'),
  (gen_random_uuid(),'inventory.warehouse.create','INVENTORY','Create Company or Project-scoped Warehouses'),
  (gen_random_uuid(),'inventory.warehouse.edit','INVENTORY','Edit Warehouse master data within effective scope'),
  (gen_random_uuid(),'inventory.warehouse.archive','INVENTORY','Archive and reactivate Warehouses within effective scope')
ON CONFLICT ("permission_code") DO NOTHING;

-- Warehouse administration is technical Inventory foundation authority.
-- It does not confer stock posting, approval, reversal or other later-stage authority.
INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" LIKE 'inventory.warehouse.%'
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
