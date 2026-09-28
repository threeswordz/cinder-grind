INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
 (gen_random_uuid(),'inventory.reservation.view','INVENTORY','View Material Reservations and availability within effective Project scope'),
 (gen_random_uuid(),'inventory.reservation.create','INVENTORY','Create Material Reservation Drafts'),
 (gen_random_uuid(),'inventory.reservation.edit','INVENTORY','Edit Material Reservation Drafts'),
 (gen_random_uuid(),'inventory.reservation.activate','INVENTORY','Activate Material Reservations against available stock'),
 (gen_random_uuid(),'inventory.reservation.release','INVENTORY','Release or cancel Material Reservations with retained history'),
 (gen_random_uuid(),'inventory.issue.view','INVENTORY','View Material Issues within effective Project scope'),
 (gen_random_uuid(),'inventory.issue.create','INVENTORY','Create Material Issue Drafts'),
 (gen_random_uuid(),'inventory.issue.edit','INVENTORY','Edit Material Issue Drafts'),
 (gen_random_uuid(),'inventory.issue.submit','INVENTORY','Submit Material Issues for configured approval'),
 (gen_random_uuid(),'inventory.issue.approve','INVENTORY','Approve and atomically post Material Issues through the Approval Matrix'),
 (gen_random_uuid(),'inventory.issue.reverse','INVENTORY','Reverse posted Material Issues with exact opposite ledger effects'),
 (gen_random_uuid(),'inventory.return.view','INVENTORY','View Material Returns and eligible issued quantities within effective Project scope'),
 (gen_random_uuid(),'inventory.return.create','INVENTORY','Create Material Return Drafts'),
 (gen_random_uuid(),'inventory.return.edit','INVENTORY','Edit Material Return Drafts'),
 (gen_random_uuid(),'inventory.return.submit','INVENTORY','Submit Material Returns for configured approval'),
 (gen_random_uuid(),'inventory.return.approve','INVENTORY','Approve and atomically post Material Returns through the Approval Matrix'),
 (gen_random_uuid(),'inventory.return.reverse','INVENTORY','Reverse posted Material Returns with exact opposite ledger effects')
ON CONFLICT ("permission_code") DO NOTHING;

-- Stage D business permissions are deliberately not granted to technical SYS_ADMIN.
-- Business Roles receive authority explicitly through existing role administration.
