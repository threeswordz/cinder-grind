INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'subcontracts.claim.view','SUBCONTRACTS','View Progress Claims in authorized Projects'),
  (gen_random_uuid(),'subcontracts.claim.create','SUBCONTRACTS','Create Progress Claim Drafts'),
  (gen_random_uuid(),'subcontracts.claim.edit','SUBCONTRACTS','Edit Progress Claim Drafts and lines'),
  (gen_random_uuid(),'subcontracts.claim.submit','SUBCONTRACTS','Submit Progress Claims'),
  (gen_random_uuid(),'subcontracts.claim.withdraw','SUBCONTRACTS','Withdraw submitted Progress Claims before assessment'),
  (gen_random_uuid(),'subcontracts.assessment.view','SUBCONTRACTS','View retained Claim Assessment history in authorized Projects'),
  (gen_random_uuid(),'subcontracts.assessment.assess','SUBCONTRACTS','Record an authorized Progress Claim assessment'),
  (gen_random_uuid(),'subcontracts.assessment.reject','SUBCONTRACTS','Reject an assessed Claim before certification')
ON CONFLICT ("permission_code") DO NOTHING;

-- Role administration assigns Stage C business permissions explicitly.
-- Technical SYS_ADMIN receives no implicit Claim or Assessment authority.
