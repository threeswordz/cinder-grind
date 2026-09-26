INSERT INTO "permissions" ("id", "permission_code", "module_code", "description")
VALUES
  (gen_random_uuid(), 'documents.document.view', 'DOCUMENTS', 'View documents within effective data scope'),
  (gen_random_uuid(), 'documents.document.upload', 'DOCUMENTS', 'Upload document bytes and metadata'),
  (gen_random_uuid(), 'documents.document.link', 'DOCUMENTS', 'Link documents to authorized ERP records'),
  (gen_random_uuid(), 'documents.document.archive', 'DOCUMENTS', 'Archive or reactivate documents'),
  (gen_random_uuid(), 'documents.type.manage', 'DOCUMENTS', 'Manage configurable Document Types')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), r.id, p.id
FROM "roles" r
JOIN "permissions" p ON p.permission_code IN (
  'documents.document.view',
  'documents.document.upload',
  'documents.document.link',
  'documents.document.archive',
  'documents.type.manage'
)
WHERE r.role_code = 'SYS_ADMIN'
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
