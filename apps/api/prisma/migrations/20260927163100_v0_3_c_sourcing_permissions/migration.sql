INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'procurement.rfq.view','PROCUREMENT','View RFQs in accessible Projects'),
  (gen_random_uuid(),'procurement.rfq.manage','PROCUREMENT','Create RFQs and invite Suppliers'),
  (gen_random_uuid(),'procurement.quotation.view','PROCUREMENT','View Supplier Quotations and comparison'),
  (gen_random_uuid(),'procurement.quotation.manage','PROCUREMENT','Capture and correct Supplier Quotations before award'),
  (gen_random_uuid(),'procurement.award.select','PROCUREMENT','Record line-level Supplier Award decisions')
ON CONFLICT ("permission_code") DO NOTHING;

-- Stage C sourcing permissions are business authorities and are not assigned
-- implicitly to the technical SYS_ADMIN role. Business roles receive them
-- explicitly through Administration role configuration.
