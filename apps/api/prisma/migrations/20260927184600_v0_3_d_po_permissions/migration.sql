INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'procurement.po.view','PROCUREMENT','View Purchase Orders in accessible Projects'),
  (gen_random_uuid(),'procurement.po.create','PROCUREMENT','Create Purchase Orders from awarded sourcing'),
  (gen_random_uuid(),'procurement.po.edit','PROCUREMENT','Edit Draft Purchase Order revisions'),
  (gen_random_uuid(),'procurement.po.submit','PROCUREMENT','Submit Purchase Order revisions for approval'),
  (gen_random_uuid(),'procurement.po.approve','PROCUREMENT','Approve Purchase Order revisions'),
  (gen_random_uuid(),'procurement.po.reject','PROCUREMENT','Reject Purchase Order revisions'),
  (gen_random_uuid(),'procurement.po.cancel','PROCUREMENT','Cancel retained Purchase Order revisions'),
  (gen_random_uuid(),'procurement.po.revise','PROCUREMENT','Create a new Purchase Order revision from the latest approved revision')
ON CONFLICT ("permission_code") DO NOTHING;

-- Purchase Order permissions are business commercial authorities.
-- They are intentionally not assigned implicitly to the technical SYS_ADMIN role.
-- Business roles receive them explicitly through Administration role configuration.
