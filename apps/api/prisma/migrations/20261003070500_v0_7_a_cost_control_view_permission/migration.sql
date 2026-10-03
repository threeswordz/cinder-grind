-- V0.7-A Cost Control read permission.
-- Forward-only: do not modify prior executed migrations.

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES (
  gen_random_uuid(),
  'cost.control.view',
  'COST_CONTROL',
  'View authorized derived Cost Control measures within effective Project scope'
)
ON CONFLICT ("permission_code") DO NOTHING;
