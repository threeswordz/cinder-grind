import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SiteExecutionService } from '../site-execution/site-execution.service';
import { EquipmentService } from './equipment.service';

function auth(companyId: string, userId: string): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'Equipment User',
    roleCodes: ['EQUIPMENT_USER'],
    permissions: [
      'equipment.type.view',
      'equipment.type.manage',
      'equipment.equipment.view',
      'equipment.equipment.manage',
      'equipment.assignment.view',
      'equipment.assignment.manage',
      'equipment.usage.view',
      'equipment.usage.create',
      'equipment.usage.edit',
      'site.daily_report.view',
      'site.daily_report.create',
      'site.daily_report.edit',
      'site.daily_report.submit',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.2-F Equipment retains assignment/usage history and integrates canonical Daily Site Report usage', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'EQ-' + suffix,
        companyName: 'Equipment Test ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'EQ-CUS-' + suffix,
        customerName: 'Equipment Customer',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'EQ-EMP-' + suffix,
        employeeName: 'Plant Engineer',
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'eq-' + suffix + '@example.com',
        displayName: 'Plant Engineer',
        passwordHash: 'x',
      },
    });
    const projectA = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'EQ-PA-' + suffix,
        projectName: 'Equipment Project A',
        customerId: customer.id,
        contractValue: '1000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    const projectB = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'EQ-PB-' + suffix,
        projectName: 'Equipment Project B',
        customerId: customer.id,
        contractValue: '1000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: projectA.id,
          employeeId: employee.id,
          projectRole: 'Plant Engineer',
        },
        {
          projectId: projectB.id,
          employeeId: employee.id,
          projectRole: 'Plant Engineer',
        },
      ],
    });

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: projectA.id,
        wbsCode: 'EQ-WBS-' + suffix,
        wbsName: 'Earthworks',
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: projectA.id,
        calendarName: 'Equipment Calendar',
        timezoneName: 'Asia/Singapore',
      },
    });
    const activity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: projectA.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'EQ-A-' + suffix,
        activityName: 'Excavation',
        plannedDurationWorkDays: '5',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const service = new EquipmentService(prisma, access, audit);
    const site = new SiteExecutionService(
      prisma,
      access,
      audit,
      {} as DocumentsService,
    );
    const userAuth = auth(company.id, user.id);

    const type = await service.createType(
      { auth: userAuth },
      {
        equipmentTypeCode: 'EXC-' + suffix,
        equipmentTypeName: 'Excavator',
      },
    );
    const equipment = await service.createEquipment(
      { auth: userAuth },
      {
        equipmentTypeId: type.id,
        equipmentCode: 'EQ-' + suffix,
        equipmentName: 'Excavator 01',
        operationalStatus: 'AVAILABLE',
      },
    );

    const initiallyAvailable = await service.listEquipment(
      userAuth,
      new Date('2026-10-01T00:00:00.000Z'),
    );
    assert.equal(
      initiallyAvailable.find((row) => row.id === equipment.id)?.availability,
      'AVAILABLE',
    );

    const assignmentA = await service.assign(
      { auth: userAuth },
      equipment.id,
      {
        projectId: projectA.id,
        assignedFrom: new Date('2026-10-01T00:00:00.000Z'),
        remarks: 'Initial deployment',
      },
    );
    assert.ok(assignmentA);

    const assigned = await service.listEquipment(
      userAuth,
      new Date('2026-10-05T00:00:00.000Z'),
    );
    assert.equal(
      assigned.find((row) => row.id === equipment.id)?.availability,
      'ASSIGNED',
    );

    const daily = await site.create(
      { auth: userAuth },
      {
        projectId: projectA.id,
        reportDate: new Date('2026-10-05T00:00:00.000Z'),
        manpower: [],
        materialUsage: [],
        equipmentUsage: [
          {
            equipmentId: equipment.id,
            operatingHours: new Prisma.Decimal('3.5'),
            activityId: activity.id,
            wbsId: wbs.id,
            remarks: 'Excavation shift',
          },
        ],
        progress: [],
        issues: [],
        delays: [],
        inspections: [],
      },
    );
    assert.equal(daily.equipmentUsage.length, 1);

    const submitted = await site.submit({ auth: userAuth }, daily.id);
    assert.equal(submitted.status, 'SUBMITTED');
    assert.equal(submitted.equipmentUsage[0]?.equipmentUsage?.sourceType, 'DAILY_SITE_REPORT');

    const reportUsage = await prisma.equipmentUsage.findFirstOrThrow({
      where: {
        equipmentId: equipment.id,
        sourceType: 'DAILY_SITE_REPORT',
        sourceEntityId: daily.id,
      },
    });
    assert.equal(reportUsage.operatingHours?.toNumber(), 3.5);

    await assert.rejects(
      () =>
        prisma.equipmentUsage.update({
          where: { id: reportUsage.id },
          data: { remarks: 'Must not rewrite submitted report usage' },
        }),
      'Daily Site Report-origin Equipment Usage must be immutable',
    );

    const correction = await site.addCorrection(
      { auth: userAuth },
      daily.id,
      'Correct Equipment hours.',
      [],
      [
        {
          equipmentId: equipment.id,
          operatingHours: new Prisma.Decimal('4'),
          activityId: activity.id,
          wbsId: wbs.id,
          remarks: 'Corrected hours retained as later history',
        },
      ],
    );
    assert.ok(correction);
    assert.equal(correction?.equipmentCorrections.length, 1);
    assert.equal(
      correction?.equipmentCorrections[0]?.sourceType,
      'DAILY_SITE_REPORT_CORRECTION',
    );

    const manual = await service.createUsage(
      { auth: userAuth },
      {
        equipmentId: equipment.id,
        projectId: projectA.id,
        usageDate: new Date('2026-10-06T00:00:00.000Z'),
        operatingHours: new Prisma.Decimal('5'),
        activityId: activity.id,
        wbsId: wbs.id,
        remarks: 'Manual usage',
      },
    );
    assert.ok(manual);
    assert.equal(manual?.sourceType, 'MANUAL');

    const correctedManual = await service.updateUsage(
      { auth: userAuth },
      manual!.id,
      {
        operatingHours: new Prisma.Decimal('5.5'),
        remarks: 'Audited manual correction',
      },
    );
    assert.equal(correctedManual?.operatingHours?.toNumber(), 5.5);

    const assignmentB = await service.assign(
      { auth: userAuth },
      equipment.id,
      {
        projectId: projectB.id,
        assignedFrom: new Date('2026-10-10T00:00:00.000Z'),
        remarks: 'Reassigned',
      },
    );
    assert.ok(assignmentB);

    const history = await prisma.equipmentAssignment.findMany({
      where: { equipmentId: equipment.id },
      orderBy: { assignedFrom: 'asc' },
    });
    assert.equal(history.length, 2);
    assert.equal(history[0]?.assignedTo?.toISOString().slice(0, 10), '2026-10-09');
    assert.equal(history[1]?.projectId, projectB.id);

    await assert.rejects(
      () =>
        service.createUsage(
          { auth: userAuth },
          {
            equipmentId: equipment.id,
            projectId: projectA.id,
            usageDate: new Date('2026-10-10T00:00:00.000Z'),
          },
        ),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string }).code ===
          'EQUIPMENT_NOT_ASSIGNED',
    );

    await service.updateEquipment(
      { auth: userAuth },
      equipment.id,
      { operationalStatus: 'UNAVAILABLE' },
    );
    const unavailable = await service.listEquipment(
      userAuth,
      new Date('2026-10-10T00:00:00.000Z'),
    );
    assert.equal(
      unavailable.find((row) => row.id === equipment.id)?.availability,
      'UNAVAILABLE',
    );
    const selectable = await service.projectEquipment(
      userAuth,
      projectB.id,
      new Date('2026-10-10T00:00:00.000Z'),
    );
    assert.equal(selectable.some((row) => row.equipment.id === equipment.id), false);

    await assert.rejects(
      () =>
        service.createUsage(
          { auth: userAuth },
          {
            equipmentId: equipment.id,
            projectId: projectB.id,
            usageDate: new Date('2026-10-10T00:00:00.000Z'),
          },
        ),
      (error: unknown) =>
        error instanceof ConflictException &&
        (error.getResponse() as { code?: string }).code ===
          'EQUIPMENT_NOT_OPERATIONALLY_AVAILABLE',
    );

    await assert.rejects(
      () =>
        prisma.equipmentAssignment.delete({
          where: { id: assignmentB!.id },
        }),
      'Equipment assignment history must not be deletable',
    );
    await assert.rejects(
      () =>
        prisma.equipmentUsage.delete({
          where: { id: manual!.id },
        }),
      'Equipment Usage history must not be deletable',
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: [
            'EQUIPMENT_TYPE',
            'EQUIPMENT',
            'EQUIPMENT_ASSIGNMENT',
            'EQUIPMENT_USAGE',
            'DAILY_SITE_REPORT',
            'DAILY_SITE_REPORT_CORRECTION',
          ],
        },
      },
    });
    assert.ok(auditCount >= 10);
  } finally {
    await prisma.$disconnect();
  }
});
