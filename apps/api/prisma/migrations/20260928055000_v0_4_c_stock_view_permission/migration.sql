INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'inventory.stock.view','INVENTORY','View derived Stock Balance within effective Company and Project scope')
ON CONFLICT ("permission_code") DO NOTHING;

-- Derived balance is business Inventory visibility.
-- Do not grant it implicitly to technical SYS_ADMIN.
