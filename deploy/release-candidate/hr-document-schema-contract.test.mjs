import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifySchema } from './schema-contract.mjs';
import { hrDocumentTables, stripHrDocumentSchema } from './hr-document-schema-contract.mjs';
import { assertHistoricalTables } from './historical-snapshot.mjs';

const current = readFileSync(new URL('../../apps/api/prisma/schema.prisma', import.meta.url), 'utf8');
const predecessor = stripHrDocumentSchema(current).text;

test('only the exact Company/Employee/Document bounded HR custody model introduces the new schema mode', () => {
  assert.equal(hrDocumentTables.length, 1);
  assert.equal(hrDocumentTables[0], 'hr_document_attachments');
  assert.equal(classifySchema(predecessor, current), 'migration-aware-hr-document-schema');
  assert.equal(classifySchema(current, current), 'migration-aware-sql-only');
  assert.throws(() => classifySchema(current, predecessor), /removal/);
  for (const altered of [
    current.replace('version Int', 'version String'),
    current.replace('encryptedMetadata String @map("encrypted_metadata") @db.Text',
      'encryptedMetadata String? @map("encrypted_metadata") @db.Text'),
    current.replace('document Document @relation(fields: [companyId, documentId]',
      'document Document @relation(fields: [documentId]'),
    current.replace('hrDocumentAttachment HrDocumentAttachment?', ''),
    current.replace('@@unique([companyId, employeeId, version])', '@@index([companyId, employeeId, version])'),
    current.replace('model HrDocumentAttachment {', 'model OtherDocumentAttachment {'),
    current.replace('hrDocumentAttachments HrDocumentAttachment[]',
      'hrDocumentAttachments HrDocumentAttachment?'),
    current + '\nmodel ArbitraryEmployeeData {\n id String @id\n}',
  ]) assert.throws(() => classifySchema(predecessor, altered));
});

test('an added custody table is empty, old tables are byte-identical and other additions are rejected', () => {
  const empty = { count: '0', digest: createHash('sha256').update('').digest('hex') };
  const before = { employees: { count: '1', digest: 'fixed-employee-history' },
    documents: { count: '2', digest: 'fixed-canonical-documents' },
    hr_replays: { count: '1', digest: 'fixed-authenticated-replay' },
    customer_boq_versions: { count: '0', digest: empty.digest } };
  assertHistoricalTables(before, { ...before, hr_document_attachments: empty }, false, true);
  for (const changed of [
    { ...before },
    { ...before, hr_document_attachments: { count: '1', digest: empty.digest } },
    { ...before, hr_document_attachments: empty, employees: { count: '1', digest: 'modified' } },
    { ...before, hr_document_attachments: empty, arbitrary_table: empty },
  ]) assert.throws(() => assertHistoricalTables(before, changed, false, true));
  assert.throws(() => assertHistoricalTables(before, { ...before, hr_document_attachments: empty }, false, false));
});

test('rollback tests the exact predecessor WITHOUT new HR custody tables', () => {
  const script = readFileSync(new URL('./rehearse-migration.sh', import.meta.url), 'utf8');
  assert.ok(script.includes('HR_SCHEMA_UPGRADE=NO HR_DOCUMENT_SCHEMA_UPGRADE=NO DATABASE_URL="$rollback_url" node "$RC_DIR/legacy-fixture.mjs" verify'));
  assert.ok(script.includes('HR_DOCUMENT_SCHEMA_UPGRADE=NO DATABASE_URL="$rollback_url" node "$RC_DIR/hr-upgrade.mjs" rollback'));
  // Candidate (fresh/upgraded) checks still require the bounded new table.
  assert.ok(script.includes('export HR_DOCUMENT_SCHEMA_UPGRADE=YES'));
});
