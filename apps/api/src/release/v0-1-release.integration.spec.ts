import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { DocumentsService } from '../documents/documents.service';
import { LocalDocumentStorage } from '../documents/local-document-storage.service';
import { MasterDataService } from '../master-data/master-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsService } from '../projects/projects.service';
import { WbsService } from '../wbs/wbs.service';

function auth(
  companyId: string,
  userId: string,
  permissions: string[],
  label: string,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: label.toLowerCase().replaceAll(' ', '-') + '@example.com',
    displayName: label,
    roleCodes: ['V01_RELEASE_TEST'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.1 release reference scenario works across Foundation modules', async () => {
  const prisma = new PrismaService();
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'construction-erp-v01-'));
  const previousRoot = process.env.STORAGE_ROOT;
  process.env.STORAGE_ROOT = tempRoot;
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'V01-' + suffix,
        companyName: 'V0.1 Release Acceptance',
      },
    });

    const adminUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'v01-admin-' + suffix + '@example.com',
        displayName: 'V0.1 Administrator',
        passwordHash: 'not-used-by-release-service-test',
      },
    });
    const adminAuth = auth(
      company.id,
      adminUser.id,
      ['projects.access_all'],
      'V0.1 Administrator',
    );

    const audit = new AuditService(prisma);
    const master = new MasterDataService(prisma, audit);

    const customer = await master.createCustomer(
      { auth: adminAuth },
      {
        customerCode: 'CUST-' + suffix,
        customerName: 'Factory Customer',
      },
    );
    const projectManagerEmployee = await master.createEmployee(
      { auth: adminAuth },
      {
        employeeCode: 'PM-' + suffix,
        employeeName: 'Project Manager',
        jobTitle: 'Project Manager',
      },
    );
    const unassignedEmployee = await master.createEmployee(
      { auth: adminAuth },
      {
        employeeCode: 'PE-' + suffix,
        employeeName: 'Unassigned Engineer',
        jobTitle: 'Project Engineer',
      },
    );
    const uom = await master.createUnitOfMeasure(
      { auth: adminAuth },
      {
        uomCode: 'EA-' + suffix,
        uomName: 'Each',
        decimalPlaces: 0,
      },
    );
    const material = await master.createMaterial(
      { auth: adminAuth },
      {
        materialCode: 'STEEL-' + suffix,
        materialName: 'Reinforcement Steel',
        defaultUomId: uom.id,
        materialCategory: 'Steel',
      },
    );
    assert.equal(material.defaultUom.id, uom.id);

    const projectManagerUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: projectManagerEmployee.id,
        email: 'v01-pm-' + suffix + '@example.com',
        displayName: 'Project Manager',
        passwordHash: 'not-used-by-release-service-test',
      },
    });
    const unassignedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: unassignedEmployee.id,
        email: 'v01-unassigned-' + suffix + '@example.com',
        displayName: 'Unassigned Engineer',
        passwordHash: 'not-used-by-release-service-test',
      },
    });

    const status = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'PROJECT',
        statusCode: 'ACTIVE-' + suffix,
        statusLabel: 'Active',
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const projects = new ProjectsService(prisma, access, audit);
    const wbs = new WbsService(prisma, access, audit);
    const storage = new LocalDocumentStorage();
    const documents = new DocumentsService(
      prisma,
      access,
      audit,
      storage,
      new DocumentPolicyService(),
    );

    const projectPermissions = [
      'projects.project.view',
      'projects.project.create',
      'wbs.wbs.view',
      'wbs.wbs.create',
      'wbs.cost_code.view',
      'wbs.cost_code.create',
      'documents.document.view',
      'documents.document.upload',
      'documents.document.link',
    ];
    const pmAuth = auth(
      company.id,
      projectManagerUser.id,
      projectPermissions,
      'Project Manager',
    );
    const unassignedAuth = auth(
      company.id,
      unassignedUser.id,
      projectPermissions,
      'Unassigned Engineer',
    );

    const project = await projects.createProject(
      { auth: pmAuth },
      {
        projectCode: 'PJ26001',
        projectName: 'Factory Construction',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: new Prisma.Decimal('90000000.00'),
        location: 'Project Site',
        description: 'V0.1 end-to-end acceptance project',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-09-30T00:00:00.000Z'),
      },
    );
    assert.equal(project.customerId, customer.id);

    const creatorMembership = await prisma.projectMember.findFirst({
      where: {
        projectId: project.id,
        employeeId: projectManagerEmployee.id,
        projectRole: 'Project Creator',
        isActive: true,
      },
    });
    assert.ok(creatorMembership);

    const groundworks = await wbs.createWbs(
      { auth: pmAuth },
      project.id,
      {
        wbsCode: '01',
        wbsName: 'Groundworks',
      },
    );
    const slab = await wbs.createWbs(
      { auth: pmAuth },
      project.id,
      {
        parentId: groundworks.id,
        wbsCode: '01.01',
        wbsName: 'Ground Floor Slab',
      },
    );
    assert.equal(slab.parentId, groundworks.id);

    const costCode = await wbs.createCostCode(
      { auth: pmAuth },
      {
        costCode: 'MAT-STEEL',
        costName: 'Steel Materials',
      },
    );
    assert.equal(costCode.companyId, company.id);
    const costCodeShape = Prisma.dmmf.datamodel.models.find(
      (model) => model.name === 'CostCode',
    );
    assert.ok(costCodeShape);
    assert.equal(costCodeShape.fields.some((field) => field.name === 'wbsId'), false);

    const documentType = await documents.createDocumentType(
      { auth: adminAuth },
      {
        documentTypeCode: 'CONTRACT-' + suffix,
        documentTypeName: 'Contract',
      },
    );
    const fileBytes = Buffer.from('%PDF-V0.1-release-acceptance');
    const document = await documents.uploadProjectDocument(
      { auth: pmAuth },
      project.id,
      documentType.id,
      {
        originalname: 'factory-contract.pdf',
        mimetype: 'application/pdf',
        size: fileBytes.length,
        buffer: fileBytes,
      },
    );
    assert.equal('storageKey' in document, false);

    const assignedProject = await projects.getProject(pmAuth, project.id);
    assert.equal(assignedProject.id, project.id);
    const assignedDocuments = await documents.listProjectDocuments(
      pmAuth,
      project.id,
    );
    assert.equal(assignedDocuments.length, 1);
    assert.equal(assignedDocuments[0]!.id, document.id);
    const downloaded = await documents.downloadProjectDocument(
      pmAuth,
      project.id,
      document.id,
    );
    assert.deepEqual(downloaded.bytes, fileBytes);

    await assert.rejects(
      () => projects.getProject(unassignedAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => documents.listProjectDocuments(unassignedAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const auditedTypes = await prisma.auditLog.findMany({
      where: { companyId: company.id },
      select: { entityType: true, actorUserId: true },
    });
    const entityTypes = new Set(auditedTypes.map((row) => row.entityType));
    for (const expected of [
      'CUSTOMER',
      'EMPLOYEE',
      'UNIT_OF_MEASURE',
      'MATERIAL',
      'PROJECT',
      'WBS',
      'COST_CODE',
      'DOCUMENT_TYPE',
      'DOCUMENT',
      'DOCUMENT_LINK',
    ]) {
      assert.equal(entityTypes.has(expected), true, expected + ' audit missing');
    }
    assert.equal(
      auditedTypes.some((row) => row.actorUserId === projectManagerUser.id),
      true,
    );
  } finally {
    await prisma.$disconnect();
    if (previousRoot === undefined) delete process.env.STORAGE_ROOT;
    else process.env.STORAGE_ROOT = previousRoot;
    await rm(tempRoot, { recursive: true, force: true });
  }
});
