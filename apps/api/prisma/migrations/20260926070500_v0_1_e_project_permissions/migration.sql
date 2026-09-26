-- V0.1-E system-defined Project permissions.
-- projects.access_all already exists from the Foundation permission catalogue.

INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  ('30000000-0000-4000-8000-000000000001', 'projects.project.view', 'PROJECTS', 'View Project records within effective project scope.'),
  ('30000000-0000-4000-8000-000000000002', 'projects.project.create', 'PROJECTS', 'Create Project records.'),
  ('30000000-0000-4000-8000-000000000003', 'projects.project.edit', 'PROJECTS', 'Edit Project records within effective project scope.'),
  ('30000000-0000-4000-8000-000000000004', 'projects.project.archive', 'PROJECTS', 'Archive or reactivate Project records within effective project scope.'),
  ('30000000-0000-4000-8000-000000000005', 'projects.team.view', 'PROJECTS', 'View Project Team and Project Contacts within effective project scope.'),
  ('30000000-0000-4000-8000-000000000006', 'projects.team.manage', 'PROJECTS', 'Manage Project Team and Project Contacts within effective project scope.')
ON CONFLICT ("permission_code") DO NOTHING;
