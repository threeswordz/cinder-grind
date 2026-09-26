import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from './project-access.service';
import { ProjectsService } from './projects.service';

function auth(
  companyId: string,
  userId: string,
  permissions: string[],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'project-user@example.com',
    displayName: 'Project User',
    roleCodes: ['TEST'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('Project scope and Team/Contact boundaries are enforced in PostgreSQL', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'PRJ-' + suffix,
        companyName: 'Projects Integration Test',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'PRX-' + suffix,
        companyName: 'Other Project Company',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'C-' + suffix,
        customerName: 'Project Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompany.id,
        customerCode: 'OC-' + suffix,
        customerName: 'Other Customer',
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

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'E-' + suffix,
        employeeName: 'Scoped Employee',
      },
    });
    const secondEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'E2-' + suffix,
        employeeName: 'Second Employee',
      },
    });
    const otherEmployee = await prisma.employee.create({
      data: {
        companyId: otherCompany.id,
        employeeCode: 'OE-' + suffix,
        employeeName: 'Other Employee',
      },
    });

    const scopedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'scoped-' + suffix + '@example.com',
        displayName: 'Scoped User',
        passwordHash: 'not-used-in-this-test',
      },
    });
    const allUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'all-' + suffix + '@example.com',
        displayName: 'All Projects User',
        passwordHash: 'not-used-in-this-test',
      },
    });
    const unlinkedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'unlinked-' + suffix + '@example.com',
        displayName: 'Unlinked User',
        passwordHash: 'not-used-in-this-test',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P-' + suffix,
        projectName: 'Assigned Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: '1000000.00',
        location: 'Singapore',
        description: 'Scope integration test',
        plannedStartDate: new Date('2026-10-01T00:00:00Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00Z'),
      },
    });
    const unassignedProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P2-' + suffix,
        projectName: 'Unassigned Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: '500000.00',
        plannedStartDate: new Date('2026-11-01T00:00:00Z'),
        plannedCompletionDate: new Date('2027-01-31T00:00:00Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Project Engineer',
      },
    });

    const authorization = new AuthorizationService();
    const projectScope = new ProjectScopeService(authorization);
    const access = new ProjectAccessService(prisma, projectScope);
    const service = new ProjectsService(
      prisma,
      access,
      new AuditService(prisma),
    );

    const scopedAuth = auth(company.id, scopedUser.id, [
      'projects.project.view',
      'projects.project.create',
      'projects.project.edit',
      'projects.project.archive',
      'projects.team.view',
      'projects.team.manage',
    ]);
    const allAuth = auth(company.id, allUser.id, [
      'projects.access_all',
      'projects.project.view',
      'projects.project.create',
      'projects.project.edit',
      'projects.project.archive',
      'projects.team.view',
      'projects.team.manage',
    ]);
    const unlinkedAuth = auth(company.id, unlinkedUser.id, [
      'projects.project.view',
    ]);

    const createdByScopedUser = await service.createProject(
      { auth: scopedAuth },
      {
        projectCode: 'PC-' + suffix,
        projectName: 'Creator Membership Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: new (await import('@prisma/client')).Prisma.Decimal(
          '250000.00',
        ),
        plannedStartDate: new Date('2026-12-01T00:00:00Z'),
        plannedCompletionDate: new Date('2027-02-28T00:00:00Z'),
      },
    );
    const creatorMembership = await prisma.projectMember.findFirst({
      where: {
        projectId: createdByScopedUser.id,
        employeeId: employee.id,
        projectRole: 'Project Creator',
        isActive: true,
      },
    });
    assert.ok(creatorMembership);

    await assert.rejects(
      () =>
        service.createProject(
          {
            auth: auth(company.id, unlinkedUser.id, [
              'projects.project.create',
            ]),
          },
          {
            projectCode: 'PU-' + suffix,
            projectName: 'Unlinked Creator Project',
            customerId: customer.id,
            statusDefinitionId: status.id,
            contractValue: new (await import('@prisma/client')).Prisma.Decimal(
              '1000.00',
            ),
            plannedStartDate: new Date('2026-12-01T00:00:00Z'),
            plannedCompletionDate: new Date('2026-12-31T00:00:00Z'),
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const scopedProjects = await service.listProjects(scopedAuth);
    assert.deepEqual(
      scopedProjects.map((item) => item.id).sort(),
      [project.id, createdByScopedUser.id].sort(),
    );

    const allProjects = await service.listProjects(allAuth);
    assert.equal(allProjects.length, 3);

    const noProjects = await service.listProjects(unlinkedAuth);
    assert.equal(noProjects.length, 0);

    await assert.rejects(
      () => service.getProject(scopedAuth, unassignedProject.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const updated = await service.updateProject(
      { auth: scopedAuth },
      project.id,
      {
        projectName: 'Assigned Project Updated',
        contractValue: new (await import('@prisma/client')).Prisma.Decimal(
          '1100000.00',
        ),
      },
    );
    assert.equal(updated.projectName, 'Assigned Project Updated');

    await assert.rejects(
      () =>
        service.updateProject(
          { auth: scopedAuth },
          project.id,
          { customerId: otherCustomer.id },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const member = await service.addMember(
      { auth: scopedAuth },
      project.id,
      {
        employeeId: secondEmployee.id,
        projectRole: 'Project Manager',
      },
    );
    assert.equal(member.employee.id, secondEmployee.id);

    await assert.rejects(
      () =>
        service.addMember(
          { auth: scopedAuth },
          project.id,
          {
            employeeId: otherEmployee.id,
            projectRole: 'Invalid Cross Company',
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const contact = await service.addContact(
      { auth: scopedAuth },
      project.id,
      {
        contactName: 'Client Contact',
        organizationName: 'Client',
        email: 'client@example.com',
      },
    );
    assert.equal(contact.contactName, 'Client Contact');

    const contacts = await service.listContacts(scopedAuth, project.id);
    assert.equal(contacts.length, 1);

    const archived = await service.setProjectActive(
      { auth: scopedAuth },
      project.id,
      false,
    );
    assert.equal(archived.isActive, false);

    const auditCount = await prisma.auditLog.count({
      where: { companyId: company.id },
    });
    assert.ok(auditCount >= 4);

    const permissionCount = await prisma.permission.count({
      where: {
        permissionCode: {
          in: [
            'projects.project.view',
            'projects.project.create',
            'projects.project.edit',
            'projects.project.archive',
            'projects.team.view',
            'projects.team.manage',
          ],
        },
      },
    });
    assert.equal(permissionCount, 6);
  } finally {
    await prisma.$disconnect();
  }
});
