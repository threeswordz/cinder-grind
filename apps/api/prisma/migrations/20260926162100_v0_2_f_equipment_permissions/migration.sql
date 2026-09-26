INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'equipment.type.view','EQUIPMENT','View Equipment Types'),
  (gen_random_uuid(),'equipment.type.manage','EQUIPMENT','Create and maintain Equipment Types'),
  (gen_random_uuid(),'equipment.equipment.view','EQUIPMENT','View Equipment register and derived availability'),
  (gen_random_uuid(),'equipment.equipment.manage','EQUIPMENT','Create and maintain Equipment records'),
  (gen_random_uuid(),'equipment.assignment.view','EQUIPMENT','View Project Equipment assignment history within effective scope'),
  (gen_random_uuid(),'equipment.assignment.manage','EQUIPMENT','Assign and release Equipment within effective Project scope'),
  (gen_random_uuid(),'equipment.usage.view','EQUIPMENT','View Equipment Usage history within effective Project scope'),
  (gen_random_uuid(),'equipment.usage.create','EQUIPMENT','Record Equipment Usage within effective Project scope'),
  (gen_random_uuid(),'equipment.usage.edit','EQUIPMENT','Correct manual Equipment Usage within effective Project scope')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" LIKE 'equipment.%'
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
