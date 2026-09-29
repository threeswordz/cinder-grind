INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'subcontracts.agreement.submit','SUBCONTRACTS','Submit an agreement version for configured approval'),
  (gen_random_uuid(),'subcontracts.agreement.approve','SUBCONTRACTS','Approve an agreement version through the configured workflow'),
  (gen_random_uuid(),'subcontracts.agreement.reject','SUBCONTRACTS','Reject an agreement version through the configured workflow'),
  (gen_random_uuid(),'subcontracts.agreement.revise','SUBCONTRACTS','Create and edit non-commercial agreement revisions'),
  (gen_random_uuid(),'subcontracts.agreement.cancel','SUBCONTRACTS','Cancel an approved agreement with guarded evidence'),
  (gen_random_uuid(),'subcontracts.work_order.view','SUBCONTRACTS','View Work Orders in authorized Projects'),
  (gen_random_uuid(),'subcontracts.work_order.create','SUBCONTRACTS','Create agreement-linked Work Order Drafts'),
  (gen_random_uuid(),'subcontracts.work_order.edit','SUBCONTRACTS','Edit Work Order Drafts'),
  (gen_random_uuid(),'subcontracts.work_order.submit','SUBCONTRACTS','Submit Work Orders for configured approval'),
  (gen_random_uuid(),'subcontracts.work_order.approve','SUBCONTRACTS','Approve Work Orders through the configured workflow'),
  (gen_random_uuid(),'subcontracts.work_order.reject','SUBCONTRACTS','Reject Work Orders through the configured workflow')
ON CONFLICT ("permission_code") DO NOTHING;

-- Role administration assigns business permissions explicitly; technical SYS_ADMIN
-- is never granted Stage B approval/cancellation authority by migration.
