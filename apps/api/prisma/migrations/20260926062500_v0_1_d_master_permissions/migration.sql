-- V0.1-D system-defined Master Data permissions.

INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  ('20000000-0000-4000-8000-000000000001', 'master.customer.view', 'MASTER_DATA', 'View Customer Master records.'),
  ('20000000-0000-4000-8000-000000000002', 'master.customer.manage', 'MASTER_DATA', 'Create, edit and deactivate Customer Master records.'),
  ('20000000-0000-4000-8000-000000000003', 'master.supplier.view', 'MASTER_DATA', 'View Supplier Master records.'),
  ('20000000-0000-4000-8000-000000000004', 'master.supplier.manage', 'MASTER_DATA', 'Create, edit and deactivate Supplier Master records.'),
  ('20000000-0000-4000-8000-000000000005', 'master.employee.view', 'MASTER_DATA', 'View Employee Master records.'),
  ('20000000-0000-4000-8000-000000000006', 'master.employee.manage', 'MASTER_DATA', 'Create, edit and deactivate Employee Master records.'),
  ('20000000-0000-4000-8000-000000000007', 'master.material.view', 'MASTER_DATA', 'View Material Master records.'),
  ('20000000-0000-4000-8000-000000000008', 'master.material.manage', 'MASTER_DATA', 'Create, edit and deactivate Material Master records.'),
  ('20000000-0000-4000-8000-000000000009', 'master.uom.view', 'MASTER_DATA', 'View Unit of Measure Master records.'),
  ('20000000-0000-4000-8000-000000000010', 'master.uom.manage', 'MASTER_DATA', 'Create, edit and deactivate Unit of Measure Master records.')
ON CONFLICT ("permission_code") DO NOTHING;
