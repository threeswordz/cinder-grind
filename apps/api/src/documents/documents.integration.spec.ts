import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  DocumentPolicyService,
  UploadedDocumentFile,
} from './document-policy.service';
import { DocumentTargetsService } from './document-targets.service';
import { DocumentsService } from './documents.service';
import { LocalDocumentStorage } from './local-document-storage.service';

function auth(
  companyId: string,
  userId: string,
  permissions: string[],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'documents@example.com',
    displayName: 'Documents User',
    roleCodes: ['TEST'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

function uploadFile(
  name = 'contract.pdf',
  mime = 'application/pdf',
  bytes = Buffer.from('%PDF-test'),
): UploadedDocumentFile {
  return {
    originalname: name,
    mimetype: mime,
    size: bytes.length,
    buffer: bytes,
  };
}

test('Project Documents enforce scope, safe storage and metadata boundaries', async () => {
  const prisma = new PrismaService();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'construction-erp-docs-'));
  const previousRoot = process.env.STORAGE_ROOT;
  const previousMax = process.env.DOCUMENT_MAX_FILE_BYTES;
  const previousMimes = process.env.DOCUMENT_ALLOWED_MIME_TYPES;
  process.env.STORAGE_ROOT = tempRoot;
  delete process.env.DOCUMENT_MAX_FILE_BYTES;
  delete process.env.DOCUMENT_ALLOWED_MIME_TYPES;

  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'DOC-' + suffix,
        companyName: 'Documents Integration Test',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'DOX-' + suffix,
        companyName: 'Other Documents Company',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'C-' + suffix,
        customerName: 'Document Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompany.id,
        customerCode: 'OC-' + suffix,
        customerName: 'Other Document Customer',
      },
    });
    const status = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'PROJECT',
        statusCode: 'A-' + suffix,
        statusLabel: 'Active',
      },
    });
    const otherStatus = await prisma.statusDefinition.create({
      data: {
        companyId: otherCompany.id,
        entityType: 'PROJECT',
        statusCode: 'A-' + suffix,
        statusLabel: 'Active',
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'E-' + suffix,
        employeeName: 'Document Employee',
      },
    });
    const scopedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'doc-scoped-' + suffix + '@example.com',
        displayName: 'Scoped Documents User',
        passwordHash: 'unused',
      },
    });
    const allUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'doc-all-' + suffix + '@example.com',
        displayName: 'All Documents User',
        passwordHash: 'unused',
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        companyId: otherCompany.id,
        email: 'doc-other-' + suffix + '@example.com',
        displayName: 'Other Documents User',
        passwordHash: 'unused',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P-' + suffix,
        projectName: 'Assigned Document Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: '1000.00',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    const unassigned = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P2-' + suffix,
        projectName: 'Unassigned Document Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: '1000.00',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: otherCompany.id,
        projectCode: 'OP-' + suffix,
        projectName: 'Other Company Project',
        customerId: otherCustomer.id,
        statusDefinitionId: otherStatus.id,
        contractValue: '1000.00',
        plannedStartDate: new Date('2026-10-01'),
        plannedCompletionDate: new Date('2027-01-01'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Project Engineer',
      },
    });

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: 'DOC-WBS-' + suffix,
        wbsName: 'Document WBS',
      },
    });
    const unassignedWbs = await prisma.wbsElement.create({
      data: {
        projectId: unassigned.id,
        wbsCode: 'DOC-UA-' + suffix,
        wbsName: 'Unassigned WBS',
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'Document Activity Calendar',
        timezoneName: 'Asia/Singapore',
      },
    });
    await prisma.workingCalendarWeekday.createMany({
      data: [1, 2, 3, 4, 5].map((weekdayNo) => ({
        workingCalendarId: calendar.id,
        weekdayNo,
        isWorking: true,
        startTime: new Date('1970-01-01T08:00:00.000Z'),
        endTime: new Date('1970-01-01T17:00:00.000Z'),
      })),
    });
    const activity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'DOC-A-' + suffix,
        activityName: 'Document Activity',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });
    const purchaseRequest = await prisma.purchaseRequest.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        prNumber: 'PR2609-001',
        remarks: 'Procurement document target',
        createdByUserId: scopedUser.id,
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const storage = new LocalDocumentStorage();
    const policy = new DocumentPolicyService();
    const service = new DocumentsService(
      prisma,
      access,
      new AuditService(prisma),
      storage,
      policy,
    );
    const targets = new DocumentTargetsService(
      prisma,
      access,
      new AuditService(prisma),
      service,
    );

    const permissions = [
      'documents.document.view',
      'documents.document.upload',
      'documents.document.link',
      'documents.document.archive',
      'documents.type.manage',
    ];
    const scoped = auth(company.id, scopedUser.id, permissions);
    const all = auth(company.id, allUser.id, [
      'projects.access_all',
      ...permissions,
    ]);
    const other = auth(otherCompany.id, otherUser.id, [
      'projects.access_all',
      ...permissions,
    ]);

    assert.deepEqual(
      (await service.projects(scoped)).map((item) => item.id),
      [project.id],
    );
    assert.equal((await service.projects(all)).length, 2);

    const type = await service.createDocumentType(
      { auth: scoped },
      {
        documentTypeCode: 'CONTRACT-' + suffix,
        documentTypeName: 'Contract',
      },
    );
    const otherType = await service.createDocumentType(
      { auth: other },
      {
        documentTypeCode: 'CONTRACT-' + suffix,
        documentTypeName: 'Other Contract',
      },
    );

    const source = uploadFile();
    const created = await service.uploadProjectDocument(
      { auth: scoped },
      project.id,
      type.id,
      source,
    );

    assert.equal(created.fileName, source.originalname);
    assert.equal(created.storageProvider, 'LOCAL');
    assert.equal(created.fileSizeBytes, source.buffer.length);
    assert.equal('storageKey' in created, false);
    assert.equal(JSON.stringify(created).includes(tempRoot), false);

    const persisted = await prisma.document.findUniqueOrThrow({
      where: { id: created.id },
    });
    assert.match(
      persisted.storageKey,
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    assert.equal(persisted.storageKey.includes('/'), false);
    assert.equal(
      await prisma.documentLink.count({
        where: {
          documentId: created.id,
          entityType: 'PROJECT',
          entityId: project.id,
        },
      }),
      1,
    );

    const wbsDocument = await targets.upload(
      { auth: scoped },
      project.id,
      'WBS',
      wbs.id,
      type.id,
      uploadFile('wbs-plan.pdf'),
    );
    const activityDocument = await targets.upload(
      { auth: scoped },
      project.id,
      'ACTIVITY',
      activity.id,
      type.id,
      uploadFile('activity-method.pdf'),
    );
    const purchaseRequestDocument = await targets.upload(
      { auth: scoped },
      project.id,
      'PURCHASE_REQUEST',
      purchaseRequest.id,
      type.id,
      uploadFile('purchase-request-support.pdf'),
    );
    const targetOptions = await targets.options(scoped, project.id);
    assert.equal(targetOptions.wbs.some((row) => row.id === wbs.id), true);
    assert.equal(
      targetOptions.activities.some((row) => row.id === activity.id),
      true,
    );
    assert.equal(
      targetOptions.purchaseRequests.some(
        (row) => row.id === purchaseRequest.id,
      ),
      true,
    );

    const wbsDocuments = await targets.list(
      scoped,
      project.id,
      'WBS',
      wbs.id,
    );
    assert.equal(wbsDocuments.some((row) => row.id === wbsDocument.id), true);
    const activityDocuments = await targets.list(
      scoped,
      project.id,
      'ACTIVITY',
      activity.id,
    );
    assert.equal(
      activityDocuments.some((row) => row.id === activityDocument.id),
      true,
    );
    const purchaseRequestDocuments = await targets.list(
      scoped,
      project.id,
      'PURCHASE_REQUEST',
      purchaseRequest.id,
    );
    assert.equal(
      purchaseRequestDocuments.some(
        (row) => row.id === purchaseRequestDocument.id,
      ),
      true,
    );
    assert.equal(JSON.stringify(wbsDocuments).includes('storageKey'), false);

    const targetDownload = await targets.download(
      scoped,
      project.id,
      'ACTIVITY',
      activity.id,
      activityDocument.id,
    );
    assert.deepEqual(targetDownload.bytes, Buffer.from('%PDF-test'));

    assert.equal(
      await prisma.documentLink.count({
        where: {
          documentId: wbsDocument.id,
          entityType: 'PROJECT',
          entityId: project.id,
        },
      }),
      1,
    );
    assert.equal(
      await prisma.documentLink.count({
        where: {
          documentId: wbsDocument.id,
          entityType: 'WBS',
          entityId: wbs.id,
        },
      }),
      1,
    );

    await assert.rejects(
      () =>
        targets.list(
          scoped,
          project.id,
          'WBS',
          unassignedWbs.id,
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(() =>
      prisma.documentLink.create({
        data: {
          documentId: created.id,
          entityType: 'WBS',
          entityId: unassignedWbs.id,
          linkedByUserId: scopedUser.id,
        },
      }),
    );

    await assert.rejects(() =>
      prisma.documentLink.create({
        data: {
          documentId: created.id,
          entityType: 'UNSUPPORTED',
          entityId: wbs.id,
          linkedByUserId: scopedUser.id,
        },
      }),
    );

    const listed = await service.listProjectDocuments(scoped, project.id);
    assert.equal(listed.length, 4);
    assert.equal(listed.some((row) => row.id === created.id), true);
    assert.equal(listed.some((row) => row.id === wbsDocument.id), true);
    assert.equal(listed.some((row) => row.id === activityDocument.id), true);
    assert.equal(
      listed.some((row) => row.id === purchaseRequestDocument.id),
      true,
    );
    assert.equal('storageKey' in listed[0]!, false);
    assert.equal(JSON.stringify(listed).includes(tempRoot), false);

    const downloaded = await service.downloadProjectDocument(
      scoped,
      project.id,
      created.id,
    );
    assert.deepEqual(downloaded.bytes, source.buffer);
    assert.equal(JSON.stringify({
      id: downloaded.id,
      fileName: downloaded.fileName,
      mimeType: downloaded.mimeType,
      fileSizeBytes: downloaded.fileSizeBytes,
    }).includes(tempRoot), false);

    await assert.rejects(
      () => service.listProjectDocuments(scoped, unassigned.id),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () =>
        service.downloadProjectDocument(
          scoped,
          unassigned.id,
          created.id,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () =>
        service.uploadProjectDocument(
          { auth: scoped },
          project.id,
          otherType.id,
          source,
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      () =>
        service.downloadProjectDocument(
          other,
          otherProject.id,
          created.id,
        ),
    );

    const archived = await service.setProjectDocumentActive(
      { auth: scoped },
      project.id,
      created.id,
      false,
    );
    assert.equal(archived.isActive, false);
    const afterArchive = await service.downloadProjectDocument(
      scoped,
      project.id,
      created.id,
    );
    assert.deepEqual(afterArchive.bytes, source.buffer);

    await assert.rejects(
      () => storage.read('../outside'),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    assert.throws(
      () => policy.validate(uploadFile('../evil.pdf')),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    assert.throws(
      () => policy.validate(uploadFile('payload.exe', 'application/x-msdownload')),
      (error: unknown) => error instanceof UnsupportedMediaTypeException,
    );

    process.env.DOCUMENT_MAX_FILE_BYTES = '4';
    const tinyPolicy = new DocumentPolicyService();
    assert.throws(
      () => tinyPolicy.validate(uploadFile('large.pdf')),
      (error: unknown) => error instanceof PayloadTooLargeException,
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: { in: ['DOCUMENT', 'DOCUMENT_LINK', 'DOCUMENT_TYPE'] },
      },
    });
    assert.ok(auditCount >= 4);
  } finally {
    await prisma.$disconnect();
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousRoot;
    if (previousMax === undefined) delete process.env.DOCUMENT_MAX_FILE_BYTES;
    else process.env.DOCUMENT_MAX_FILE_BYTES = previousMax;
    if (previousMimes === undefined) delete process.env.DOCUMENT_ALLOWED_MIME_TYPES;
    else process.env.DOCUMENT_ALLOWED_MIME_TYPES = previousMimes;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
