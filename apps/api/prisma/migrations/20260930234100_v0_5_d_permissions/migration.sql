INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'subcontracts.certification.view','SUBCONTRACTS','View Payment Certifications and retention withholding in authorized Projects'),
  (gen_random_uuid(),'subcontracts.certification.create','SUBCONTRACTS','Create Payment Certification Drafts'),
  (gen_random_uuid(),'subcontracts.certification.edit','SUBCONTRACTS','Edit Payment Certification Draft gross value'),
  (gen_random_uuid(),'subcontracts.certification.submit','SUBCONTRACTS','Submit Payment Certifications for configured approval'),
  (gen_random_uuid(),'subcontracts.certification.approve','SUBCONTRACTS','Approve Payment Certifications through configured maker-checker'),
  (gen_random_uuid(),'subcontracts.certification.reject','SUBCONTRACTS','Reject submitted Payment Certifications through configured maker-checker'),
  (gen_random_uuid(),'subcontracts.certification.reverse','SUBCONTRACTS','Reverse approved Payment Certifications with retained reason and history')
ON CONFLICT ("permission_code") DO NOTHING;

-- Stage D business permissions remain explicitly assigned through Role
-- administration. Technical SYS_ADMIN receives no implicit Certification authority.
