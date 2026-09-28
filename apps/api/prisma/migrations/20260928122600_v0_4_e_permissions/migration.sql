INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
 (gen_random_uuid(),'inventory.transfer.view','INVENTORY','View Stock Transfers within effective Project scope'),
 (gen_random_uuid(),'inventory.transfer.create','INVENTORY','Create Stock Transfer Drafts'),
 (gen_random_uuid(),'inventory.transfer.edit','INVENTORY','Edit Stock Transfer Drafts'),
 (gen_random_uuid(),'inventory.transfer.submit','INVENTORY','Submit Stock Transfers for configured approval'),
 (gen_random_uuid(),'inventory.transfer.approve','INVENTORY','Approve and atomically post Stock Transfers through the Approval Matrix'),
 (gen_random_uuid(),'inventory.transfer.reverse','INVENTORY','Reverse posted Stock Transfers with exact opposite ledger effects'),
 (gen_random_uuid(),'inventory.report.view','INVENTORY','View derived Inventory balance and movement reports within effective Project scope')
ON CONFLICT ("permission_code") DO NOTHING;

-- Stage E business permissions are deliberately not granted to technical SYS_ADMIN.
-- Business Roles receive authority explicitly through existing role administration.
