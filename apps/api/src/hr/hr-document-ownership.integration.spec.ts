import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { PrismaService } from '../prisma/prisma.service';
import { isHrPrivateDocumentSource } from '../documents/document-source-permissions';

/**
 * Synthetic schema-only custody tests against disposable CI PostgreSQL.
 * No real files, retained people, live Company grants or Production resources.
 * Actual encrypted upload/download and byte-equal restore belong to #295's
 * subsequent dedicated service/route increment, not this schema test.
 */
test('HR attachment ownership is same-Company, private-link-only, versioned and immutable', async () => {
  const db = new PrismaService();
  await db.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await db.company.create({ data: { companyCode: 'HDA-' + suffix, companyName: 'Synthetic custody Company A' } });
    const foreign = await db.company.create({ data: { companyCode: 'HDB-' + suffix, companyName: 'Synthetic custody Company B' } });
    const employee = await db.employee.create({ data: { companyId: company.id, employeeCode: 'HDA-' + suffix, employeeName: 'Synthetic worker A' } });
    const otherEmployee = await db.employee.create({ data: { companyId: foreign.id, employeeCode: 'HDB-' + suffix, employeeName: 'Synthetic worker B' } });
    const actor = await db.user.create({ data: { companyId: company.id, email: 'hda-' + suffix + '@example.invalid', displayName: 'Synthetic HR actor', passwordHash: 'not-a-login' } });
    const customer = await db.customer.create({ data: { companyId: company.id,
      customerCode: 'HDA-' + suffix, customerName: 'Synthetic Document Project customer' } });
    const project = await db.project.create({ data: { companyId: company.id, customerId: customer.id,
      projectCode: 'HDA-PROJ-' + suffix, projectName: 'Synthetic authorized Project',
      contractValue: '0', contractCurrencyCode: 'THB', plannedStartDate: new Date('2026-01-01'),
      plannedCompletionDate: new Date('2027-01-01') } });
    const type = await db.documentType.create({ data: { companyId: company.id, documentTypeCode: 'GEN-' + suffix, documentTypeName: 'Generic evidence' } });
    assert.equal(isHrPrivateDocumentSource('HR_ATTACHMENT'), true);
    const mkDocument = (overrides: Record<string, unknown> = {}) => db.document.create({ data: {
      companyId: company.id, documentTypeId: type.id, fileName: 'hr-private.enc',
      mimeType: 'application/octet-stream', fileSizeBytes: 345,
      storageProvider: 'LOCAL', storageKey: randomUUID(),
      checksum: 'a'.repeat(64), uploadedByUserId: actor.id,
      ...overrides,
    } });
    const sealedMetadata = '{"v":1,"k":"synthetic","n":"nonce","t":"tag","c":"ciphertext-only-placeholder"}';
    const attach = (documentId: string, version: number, employeeId = employee.id, companyId = company.id) => db.hrDocumentAttachment.create({
      data: { companyId, employeeId, documentId, version, encryptedMetadata: sealedMetadata, actorUserId: actor.id },
    });
    const document = await mkDocument();
    const link = await db.documentLink.create({ data: {
      documentId: document.id, entityType: 'HR_ATTACHMENT', entityId: employee.id, linkedByUserId: actor.id,
    } });
    const record = await attach(document.id, 1);
    assert.equal(record.companyId, company.id);
    assert.equal(record.employeeId, employee.id);
    assert.equal(record.documentId, document.id);
    assert.equal(record.version, 1);
    assert.equal((await db.document.findUniqueOrThrow({ where: { id: document.id } })).fileName, 'hr-private.enc');

    // Composite Company+Employee and Company+Document FK are independent.
    await assert.rejects(attach(document.id, 2, otherEmployee.id));
    await assert.rejects(attach(document.id, 2, employee.id, foreign.id));

    // Append-only history and source security survive direct Prisma mutations.
    await assert.rejects(db.hrDocumentAttachment.update({ where: { id: record.id }, data: { encryptedMetadata: '{"x":"plaintext"}' } }));
    await assert.rejects(db.hrDocumentAttachment.delete({ where: { id: record.id } }));
    await assert.rejects(db.documentLink.update({ where: { id: link.id }, data: { entityType: 'PROJECT' } }));
    await assert.rejects(db.documentLink.delete({ where: { id: link.id } }));
    await assert.rejects(db.documentLink.create({ data: {
      documentId: document.id, entityType: 'PROJECT', entityId: project.id, linkedByUserId: actor.id,
    } }));
    await assert.rejects(db.document.update({ where: { id: document.id }, data: { fileName: 'identity.pdf' } }));
    await assert.rejects(db.employee.update({ where: { id: employee.id }, data: { employeeCode: 'MOVED-' + suffix } }));
    assert.equal(await db.documentLink.count({ where: { documentId: document.id } }), 1);

    const skipped = await mkDocument();
    await db.documentLink.create({ data: { documentId: skipped.id, entityType: 'HR_ATTACHMENT',
      entityId: employee.id, linkedByUserId: actor.id } });
    await assert.rejects(attach(skipped.id, 3)); // Can't skip version 2.
    assert.equal(await db.hrDocumentAttachment.count({ where: { employeeId: employee.id } }), 1);
    await attach(skipped.id, 2);
    await assert.rejects(attach(skipped.id, 2)); // One canonical Document per attachment.

    // Missing HR link and mixed Project/HR associations fail at COMMIT, not just
    // via a route filter. Failure must roll back the inserted private history.
    const noLink = await mkDocument();
    await assert.rejects(attach(noLink.id, 3));
    const mixed = randomUUID();
    await assert.rejects(db.$transaction(async tx => {
      await tx.document.create({ data: { id: mixed, companyId: company.id, documentTypeId: type.id,
        fileName: 'hr-private.enc', mimeType: 'application/octet-stream',
        fileSizeBytes: 345, storageProvider: 'LOCAL', storageKey: randomUUID(),
        checksum: 'a'.repeat(64), uploadedByUserId: actor.id } });
      await tx.documentLink.create({ data: { documentId: mixed, entityType: 'PROJECT',
        entityId: project.id, linkedByUserId: actor.id } });
      await tx.documentLink.create({ data: { documentId: mixed, entityType: 'HR_ATTACHMENT',
        entityId: employee.id, linkedByUserId: actor.id } });
      await tx.hrDocumentAttachment.create({ data: { companyId: company.id, employeeId: employee.id,
        documentId: mixed, version: 3, encryptedMetadata: sealedMetadata, actorUserId: actor.id } });
    }));
    assert.equal(await db.document.count({ where: { id: mixed } }), 0);

    // Canonical private storage metadata is required before a custody row is
    // allowed; a caller cannot register an ordinary named PDF as HR ciphertext.
    const named = await mkDocument({ fileName: 'passport.pdf' });
    await assert.rejects(db.documentLink.create({ data: { documentId: named.id,
      entityType: 'HR_ATTACHMENT', entityId: employee.id, linkedByUserId: actor.id } }));
    await assert.rejects(attach(named.id, 3));
    assert.equal(await db.hrDocumentAttachment.count({ where: { employeeId: employee.id } }), 2);

    // A generic Document Type is not automatically a Company-owned HR type:
    // reject foreign-Company IDs and inactive types even if generic Document
    // creation itself accepted their globally unique ID.
    const foreignType = await db.documentType.create({ data: {
      companyId: foreign.id, documentTypeCode: 'FOR-' + suffix,
      documentTypeName: 'Synthetic foreign-Company type',
    } });
    const inactiveType = await db.documentType.create({ data: {
      companyId: company.id, documentTypeCode: 'OFF-' + suffix,
      documentTypeName: 'Synthetic inactive type', isActive: false,
    } });
    for (const id of [foreignType.id, inactiveType.id]) {
      const invalidTypeDocument = await mkDocument({ documentTypeId: id });
      await assert.rejects(db.documentLink.create({ data: {
        documentId: invalidTypeDocument.id, entityType: 'HR_ATTACHMENT',
        entityId: employee.id, linkedByUserId: actor.id,
      } }));
      await assert.rejects(attach(invalidTypeDocument.id, 3));
    }
    assert.equal(await db.hrDocumentAttachment.count({ where: { employeeId: employee.id } }), 2);
  } finally {
    await db.$disconnect();
  }
});
