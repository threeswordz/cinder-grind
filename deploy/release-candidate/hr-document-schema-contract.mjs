// DEC-039/#295: explicitly bounded canonical encrypted HR attachment schema,
// independent of and strictly additive to the existing HR1-A seven-model gate.
const exactModel = `model HrDocumentAttachment {
  id String @id @default(uuid()) @db.Uuid
  companyId String @map("company_id") @db.Uuid
  employeeId String @map("employee_id") @db.Uuid
  documentId String @unique @map("document_id") @db.Uuid
  version Int
  encryptedMetadata String @map("encrypted_metadata") @db.Text
  actorUserId String @map("actor_user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict)
  employee Employee @relation(fields: [companyId, employeeId], references: [companyId, id], onDelete: Restrict)
  document Document @relation(fields: [companyId, documentId], references: [companyId, id], onDelete: Restrict)
  actor User @relation("HrDocumentActor", fields: [actorUserId], references: [id], onDelete: Restrict)

  @@unique([companyId, employeeId, version])
  @@unique([companyId, documentId])
  @@index([companyId, employeeId])
  @@map("hr_document_attachments")
}`;
const normalize = value => value.replace(/\s+/g,' ').trim();
const relations = {
  Company: ['hrDocumentAttachments HrDocumentAttachment[]'],
  Employee: ['hrDocumentAttachments HrDocumentAttachment[]'],
  User: ['hrDocumentAttachments HrDocumentAttachment[] @relation("HrDocumentActor")'],
  Document: ['hrDocumentAttachment HrDocumentAttachment?', '@@unique([companyId, id])'],
};
const comment = `// Private HR file custody points at the canonical Document byte identity.
// Company is enforced on BOTH Employee and Document foreign keys. A dedicated
// HR source link is committed in the same transaction; generic Project/WBS
// access is never an HR authorization surface.`;

export const hrDocumentTables = ['hr_document_attachments'];
export function stripHrDocumentSchema(schema) {
  const models = new Set(), removed = new Set();
  const stripped = schema.replace(/^model (\w+) \{[\s\S]*?^\}/gm, (block, name) => {
    if (name === 'HrDocumentAttachment') {
      if (models.has(name) || normalize(block) !== normalize(exactModel)) {
        throw new Error('HR attachment model differs from the exact bounded custody contract.');
      }
      models.add(name);
      return '';
    }
    return block.split('\n').filter(line => {
      const value = normalize(line);
      if (!(relations[name] ?? []).includes(value)) return true;
      const key = name + ':' + value;
      if (removed.has(key)) throw new Error('Duplicate HR attachment relation or scoped Document index.');
      removed.add(key);
      return false;
    }).join('\n');
  });
  if ((models.size && models.size !== 1) || (removed.size && removed.size !== 5) ||
      Boolean(models.size) !== Boolean(removed.size)) {
    throw new Error('Partial HR private attachment schema is not an approved release mode.');
  }
  return { text: stripped.replace(comment, ''), present: models.size === 1 };
}
