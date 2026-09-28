INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
 (gen_random_uuid(),'inventory.receipt.view','INVENTORY','View Goods Receipts and eligible PO material demand in effective Project scope'),
 (gen_random_uuid(),'inventory.receipt.create','INVENTORY','Create Goods Receipt Drafts'),
 (gen_random_uuid(),'inventory.receipt.edit','INVENTORY','Edit Goods Receipt Drafts'),
 (gen_random_uuid(),'inventory.receipt.submit','INVENTORY','Submit Goods Receipts for configured approval'),
 (gen_random_uuid(),'inventory.receipt.approve','INVENTORY','Approve and atomically post Goods Receipts as authorized by Approval Matrix'),
 (gen_random_uuid(),'inventory.receipt.reverse','INVENTORY','Reverse posted Goods Receipts with retained reason and opposite ledger movement')
ON CONFLICT ("permission_code") DO NOTHING;

-- No receipt post/approval/reversal grant is assigned to SYS_ADMIN.
-- Business roles receive these permissions explicitly through existing role administration.
