-- V0.1-B system-defined Foundation / Administration permission catalogue.

INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  ('10000000-0000-4000-8000-000000000001', 'projects.access_all', 'PROJECTS', 'Access project data across all projects, subject to action permissions.'),
  ('10000000-0000-4000-8000-000000000002', 'admin.company.manage', 'ADMIN', 'Manage company configuration.'),
  ('10000000-0000-4000-8000-000000000003', 'admin.users.manage', 'ADMIN', 'Manage application users.'),
  ('10000000-0000-4000-8000-000000000004', 'admin.roles.manage', 'ADMIN', 'Manage application roles.'),
  ('10000000-0000-4000-8000-000000000005', 'admin.permissions.assign', 'ADMIN', 'Assign system-defined permissions to roles.'),
  ('10000000-0000-4000-8000-000000000006', 'admin.approval_matrix.manage', 'ADMIN', 'Manage approval workflow role configuration.'),
  ('10000000-0000-4000-8000-000000000007', 'admin.number_sequences.manage', 'ADMIN', 'Manage business number sequence configuration.'),
  ('10000000-0000-4000-8000-000000000008', 'admin.status.manage', 'ADMIN', 'Manage configurable operational statuses.'),
  ('10000000-0000-4000-8000-000000000009', 'admin.project_types.manage', 'ADMIN', 'Manage project type configuration.'),
  ('10000000-0000-4000-8000-000000000010', 'admin.activity_types.manage', 'ADMIN', 'Manage activity type configuration.'),
  ('10000000-0000-4000-8000-000000000011', 'admin.system_settings.manage', 'ADMIN', 'Manage approved system settings.'),
  ('10000000-0000-4000-8000-000000000012', 'admin.audit_config.manage', 'ADMIN', 'Manage approved audit configuration without altering history.'),
  ('10000000-0000-4000-8000-000000000013', 'audit.log.view', 'AUDIT', 'View global audit history where authorized.')
ON CONFLICT ("permission_code") DO NOTHING;
