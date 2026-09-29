import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AdministrationService } from '../administration/administration.service';
import { NumberSequenceService } from '../administration/number-sequence.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { REQUIRED_PERMISSIONS_KEY } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SubcontractsController } from './subcontracts.controller';
import { SubcontractsService } from './subcontracts.service';

function auth(
  companyId: string,
  userId: string,
  accessAll = false,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'Subcontracts User',
    roleCodes: ['SUBCONTRACTS_USER'],
    permissions: [
      'subcontracts.subcontractor.view',
      'subcontracts.subcontractor.manage',
      'subcontracts.subcontractor.archive',
      'subcontracts.agreement.view',
      'subcontracts.agreement.create',
      'subcontracts.agreement.edit',
      ...(accessAll ? ['projects.access_all'] : []),
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.5-A enforces Subcontractor Company scope and agreement Project scope', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SUB-' + suffix,
        companyName: 'Subcontracts Test ' + suffix,
        baseCurrencyCode: 'SGD',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'SBX-' + suffix,
        companyName: 'Other Subcontracts Company ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SUB-C-' + suffix,
        customerName: 'Subcontracts Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompany.id,
        customerCode: 'SBX-C-' + suffix,
        customerName: 'Other Customer',
      },
    });
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'SUB-S-' + suffix,
        supplierName: 'Linked Supplier',
      },
    });
    const otherSupplier = await prisma.supplier.create({
      data: {
        companyId: otherCompany.id,
        supplierCode: 'SBX-S-' + suffix,
        supplierName: 'Other Supplier',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'SUB-E-' + suffix,
        employeeName: 'Subcontracts Manager',
      },
    });
    const scopedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'sub-' + suffix + '@example.com',
        displayName: 'Subcontracts Manager',
        passwordHash: 'x',
      },
    });
    const allUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'sub-all-' + suffix + '@example.com',
        displayName: 'Subcontracts Administrator',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SUB-P-' + suffix,
        projectName: 'Assigned Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-31T00:00:00.000Z'),
      },
    });
    const unassigned = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SUB-U-' + suffix,
        projectName: 'Unassigned Project',
        customerId: customer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-31T00:00:00.000Z'),
      },
    });
    await prisma.project.create({
      data: {
        companyId: otherCompany.id,
        projectCode: 'SBX-P-' + suffix,
        projectName: 'Other Project',
        customerId: otherCustomer.id,
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Subcontracts Manager',
      },
    });
    const status = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'SUBCONTRACT_AGREEMENT',
        statusCode: 'ACTIVE',
        statusLabel: 'Active',
      },
    });

    const authorization = new AuthorizationService();
    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(authorization),
    );
    const service = new SubcontractsService(
      prisma,
      access,
      new AuditService(prisma),
      new NumberSequenceService(prisma),
      authorization,
    );
    const scoped = auth(company.id, scopedUser.id);
    const all = auth(company.id, allUser.id, true);

    const subcontractor = await service.createSubcontractor(
      { auth: scoped },
      {
        subcontractorCode: 'SC-' + suffix,
        subcontractorName: 'Foundation Subcontractor',
        supplierId: supplier.id,
      },
    );
    assert.equal(subcontractor.supplierId, supplier.id);

    const agreementOnly = {
      ...scoped,
      permissions: [
        'subcontracts.agreement.view',
        'subcontracts.agreement.create',
      ],
    };
    const selectorRows = await service.agreementSubcontractors(agreementOnly);
    assert.deepEqual(selectorRows, [
      {
        id: subcontractor.id,
        subcontractorCode: subcontractor.subcontractorCode,
        subcontractorName: subcontractor.subcontractorName,
      },
    ]);
    assert.deepEqual(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        SubcontractsController.prototype.agreementSubcontractors,
      ),
      ['subcontracts.agreement.view'],
      'agreement selector must not require Company-register view permission',
    );

    await assert.rejects(
      () =>
        service.createSubcontractor(
          { auth: scoped },
          {
            subcontractorCode: 'BAD-' + suffix,
            subcontractorName: 'Cross Company',
            supplierId: otherSupplier.id,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(
      () =>
        prisma.subcontractor.create({
          data: {
            companyId: company.id,
            subcontractorCode: 'DBX-' + suffix,
            subcontractorName: 'Database Cross Company',
            supplierId: otherSupplier.id,
          },
        }),
      'composite foreign key must deny a cross-Company Supplier link',
    );

    const created = await service.createAgreement(
      { auth: scoped },
      {
        projectId: project.id,
        subcontractorId: subcontractor.id,
        originalValue: '25000.00',
        scopeOfWork: 'Structural steel installation',
        currencyCode: 'SGD',
        operationalStatusId: status.id,
        createKey: 'stage-a-' + suffix,
      },
    );
    assert.match(created.agreementNumber, /^SC\d{4}-\d{3}$/);
    assert.equal(created.approvalState, 'DRAFT');
    assert.equal(created.projectId, project.id);

    const reservedSequence = await prisma.numberSequence.findUniqueOrThrow({
      where: {
        companyId_sequenceCode: {
          companyId: company.id,
          sequenceCode: 'SUBCONTRACT_AGREEMENT',
        },
      },
    });
    const administration = new AdministrationService(
      prisma,
      new AuditService(prisma),
      new NumberSequenceService(prisma),
    );
    await assert.rejects(
      () =>
        administration.updateNumberSequence(
          { auth: scoped },
          reservedSequence.id,
          { formatTemplate: 'BAD-###', resetRule: 'NONE' },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const retry = await service.createAgreement(
      { auth: scoped },
      {
        projectId: project.id,
        subcontractorId: subcontractor.id,
        originalValue: '25000.00',
        scopeOfWork: 'Structural steel installation',
        currencyCode: 'SGD',
        operationalStatusId: status.id,
        createKey: 'stage-a-' + suffix,
      },
    );
    assert.equal(retry.id, created.id);

    const createOnly = {
      ...scoped,
      permissions: ['subcontracts.agreement.create'],
    };
    await assert.rejects(
      () =>
        service.createAgreement(
          { auth: createOnly },
          {
            projectId: project.id,
            subcontractorId: subcontractor.id,
            originalValue: '25000.00',
            scopeOfWork: 'Must not disclose an existing create-key result',
            currencyCode: 'SGD',
            createKey: 'stage-a-' + suffix,
          },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        service.createAgreement(
          { auth: scoped },
          {
            projectId: unassigned.id,
            subcontractorId: subcontractor.id,
            originalValue: '1000.00',
            scopeOfWork: 'Unauthorized Project',
            currencyCode: 'SGD',
          },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const restricted = await service.createAgreement(
      { auth: all },
      {
        projectId: unassigned.id,
        subcontractorId: subcontractor.id,
        originalValue: '5000.00',
        scopeOfWork: 'Access-all Project',
        currencyCode: 'SGD',
        createKey: 'restricted-' + suffix,
      },
    );
    await assert.rejects(
      () =>
        service.createAgreement(
          { auth: scoped },
          {
            projectId: project.id,
            subcontractorId: subcontractor.id,
            originalValue: '5000.00',
            scopeOfWork: 'Must not disclose another Project retry',
            currencyCode: 'SGD',
            createKey: 'restricted-' + suffix,
          },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => service.getAgreement(scoped, restricted.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    let releaseArchive!: () => void;
    let archiveLocked!: () => void;
    const releaseArchivePromise = new Promise<void>((resolve) => {
      releaseArchive = resolve;
    });
    const archiveLockedPromise = new Promise<void>((resolve) => {
      archiveLocked = resolve;
    });
    const concurrentArchive = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id"
        FROM "subcontractors"
        WHERE "id" = ${subcontractor.id}::uuid
        FOR UPDATE`;
      archiveLocked();
      await releaseArchivePromise;
      await tx.subcontractor.update({
        where: { id: subcontractor.id },
        data: { isActive: false },
      });
    });
    await archiveLockedPromise;
    let concurrentCreateSettled = false;
    const concurrentCreate = service
      .createAgreement(
        { auth: scoped },
        {
          projectId: project.id,
          subcontractorId: subcontractor.id,
          originalValue: '1200.00',
          scopeOfWork: 'Concurrent archive guard',
          currencyCode: 'SGD',
          createKey: 'archive-race-' + suffix,
        },
      )
      .finally(() => {
        concurrentCreateSettled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      concurrentCreateSettled,
      false,
      'agreement creation must wait for the Subcontractor lifecycle lock',
    );
    releaseArchive();
    await concurrentArchive;
    await assert.rejects(
      concurrentCreate,
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await service.reactivateSubcontractor({ auth: scoped }, subcontractor.id);

    let releaseProjectArchive!: () => void;
    let projectArchiveLocked!: () => void;
    const releaseProjectArchivePromise = new Promise<void>((resolve) => {
      releaseProjectArchive = resolve;
    });
    const projectArchiveLockedPromise = new Promise<void>((resolve) => {
      projectArchiveLocked = resolve;
    });
    const concurrentProjectArchive = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id"
        FROM "projects"
        WHERE "id" = ${project.id}::uuid
        FOR UPDATE`;
      projectArchiveLocked();
      await releaseProjectArchivePromise;
      await tx.project.update({
        where: { id: project.id },
        data: { isActive: false },
      });
    });
    await projectArchiveLockedPromise;
    let projectCreateSettled = false;
    const concurrentProjectCreate = service
      .createAgreement(
        { auth: scoped },
        {
          projectId: project.id,
          subcontractorId: subcontractor.id,
          originalValue: '1300.00',
          scopeOfWork: 'Concurrent Project archive guard',
          currencyCode: 'SGD',
          createKey: 'project-archive-race-' + suffix,
        },
      )
      .finally(() => {
        projectCreateSettled = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      projectCreateSettled,
      false,
      'agreement creation must wait for the Project lifecycle lock',
    );
    releaseProjectArchive();
    await concurrentProjectArchive;
    await assert.rejects(
      concurrentProjectCreate,
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await prisma.project.update({
      where: { id: project.id },
      data: { isActive: true },
    });

    const rejectAfterConcurrentStatusArchive = async (
      operation: () => Promise<unknown>,
      waitingMessage: string,
    ) => {
      let releaseStatusArchive!: () => void;
      let statusArchiveLocked!: () => void;
      const releaseStatusArchivePromise = new Promise<void>((resolve) => {
        releaseStatusArchive = resolve;
      });
      const statusArchiveLockedPromise = new Promise<void>((resolve) => {
        statusArchiveLocked = resolve;
      });
      const concurrentStatusArchive = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id"
          FROM "status_definitions"
          WHERE "id" = ${status.id}::uuid
          FOR UPDATE`;
        statusArchiveLocked();
        await releaseStatusArchivePromise;
        await tx.statusDefinition.update({
          where: { id: status.id },
          data: { isActive: false },
        });
      });
      await statusArchiveLockedPromise;
      let operationSettled = false;
      const pendingOperation = operation().finally(() => {
        operationSettled = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(operationSettled, false, waitingMessage);
      releaseStatusArchive();
      await concurrentStatusArchive;
      await assert.rejects(
        pendingOperation,
        (error: unknown) => error instanceof UnprocessableEntityException,
      );
      await prisma.statusDefinition.update({
        where: { id: status.id },
        data: { isActive: true },
      });
    };

    await rejectAfterConcurrentStatusArchive(
      () =>
        service.createAgreement(
          { auth: scoped },
          {
            projectId: project.id,
            subcontractorId: subcontractor.id,
            originalValue: '1400.00',
            scopeOfWork: 'Concurrent status archive creation guard',
            currencyCode: 'SGD',
            operationalStatusId: status.id,
            createKey: 'status-create-race-' + suffix,
          },
        ),
      'agreement creation must wait for the status lifecycle lock',
    );
    await rejectAfterConcurrentStatusArchive(
      () =>
        service.updateAgreement(
          { auth: scoped },
          created.id,
          { operationalStatusId: status.id },
        ),
      'agreement edit must wait for the status lifecycle lock',
    );

    await service.archiveSubcontractor({ auth: scoped }, subcontractor.id);
    await assert.rejects(
      () =>
        service.createAgreement(
          { auth: scoped },
          {
            projectId: project.id,
            subcontractorId: subcontractor.id,
            originalValue: '1000.00',
            scopeOfWork: 'Inactive reference',
            currencyCode: 'SGD',
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: created.id },
          data: { agreementNumber: 'SC0000-999' },
        }),
      'Agreement number must remain immutable below the API boundary',
    );
    await assert.rejects(
      () =>
        prisma.subcontractAgreement.update({
          where: { id: created.id },
          data: { projectId: unassigned.id },
        }),
      'Agreement Project identity must remain immutable below the API boundary',
    );

    await assert.rejects(
      () => prisma.subcontractor.delete({ where: { id: subcontractor.id } }),
      'Subcontractor history must be archived, never deleted',
    );
    await assert.rejects(
      () => prisma.subcontractAgreement.delete({ where: { id: created.id } }),
      'Agreement history cannot be deleted',
    );

    const audit = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: {
          in: ['SUBCONTRACTOR', 'SUBCONTRACT_AGREEMENT'],
        },
      },
      select: { action: true },
    });
    assert.ok(audit.some((row) => row.action === 'CREATE'));
    assert.ok(audit.some((row) => row.action === 'CREATE_DRAFT'));
    assert.ok(audit.some((row) => row.action === 'ARCHIVE'));

    const permissionCount = await prisma.permission.count({
      where: { permissionCode: { startsWith: 'subcontracts.' } },
    });
    assert.equal(permissionCount, 6);
  } finally {
    await prisma.$disconnect();
  }
});
