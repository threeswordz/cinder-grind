INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'procurement.rfq.view','PROCUREMENT','View RFQs in accessible Projects'),
  (gen_random_uuid(),'procurement.rfq.manage','PROCUREMENT','Create RFQs and invite Suppliers'),
  (gen_random_uuid(),'procurement.quotation.view','PROCUREMENT','View Supplier Quotations and comparison'),
  (gen_random_uuid(),'procurement.quotation.manage','PROCUREMENT','Capture and correct Supplier Quotations before award'),
  (gen_random_uuid(),'procurement.award.select','PROCUREMENT','Record line-level Supplier Award decisions')
ON CONFLICT ("permission_code") DO NOTHING;

-- Technical SYS_ADMIN receives Stage C read/maintenance permissions for support,
-- but not the commercial Supplier Award selection authority.
INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT gen_random_uuid(),r.id,p.id
FROM "roles" r
JOIN "permissions" p ON p."permission_code" IN (
  'procurement.rfq.view',
  'procurement.rfq.manage',
  'procurement.quotation.view',
  'procurement.quotation.manage'
)
WHERE r."role_code"='SYS_ADMIN'
ON CONFLICT ("role_id","permission_id") DO NOTHING;
