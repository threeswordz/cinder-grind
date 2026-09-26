import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { DocumentsService } from '../documents/documents.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SiteExecutionService } from './site-execution.service';

function auth(
  companyId: string,
  userId: string,
  permissions: string[] = [
    'site.daily_report.view',
    'site.daily_report.create',
    'site.daily_report.edit',
    'site.daily_report.submit',
  ],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: userId,
    roleCodes: ['SITE_USER'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('Stage E keeps Daily Site Reports project-scoped, immutable after submission and linked to append-only Activity Progress', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SE-' + suffix,
        companyName: 'Site Execution ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'SE-CUS-' + suffix,
        customerName: 'Site Customer',
      },
    });
    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'SE-EMP-' + suffix,
        employeeName: 'Site Engineer',
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'site-' + suffix + '@example.com',
        displayName: 'Site Engineer',
        passwordHash: 'x',
      },
    });
    const unassigned = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'unassigned-site-' + suffix + '@example.com',
        displayName: 'Unassigned Site User',
        passwordHash: 'x',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SE-P-' + suffix,
        projectName: 'Site Project',
        customerId: customer.id,
        contractValue: '1000000.00',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Site Engineer',
      },
    });

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: 'SE-WBS-' + suffix,
        wbsName: 'Ground Floor',
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'Site Calendar',
        timezoneName: 'Asia/Singapore',
      },
    });
    const activity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'SE-A-' + suffix,
        activityName: 'Concrete Pour',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
      },
    });
    const uom = await prisma.unitOfMeasure.create({
      data: {
        companyId: company.id,
        uomCode: 'M3-' + suffix,
        uomName: 'Cubic metre',
        decimalPlaces: 2,
      },
    });
    const material = await prisma.material.create({
      data: {
        companyId: company.id,
        materialCode: 'CONC-' + suffix,
        materialName: 'Concrete',
        defaultUomId: uom.id,
      },
    });

    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'SE-P2-' + suffix,
        projectName: 'Other Site Project',
        customerId: customer.id,
        contractValue: '100.00',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-10-31T00:00:00.000Z'),
      },
    });
    const otherWbs = await prisma.wbsElement.create({
      data: {
        projectId: otherProject.id,
        wbsCode: 'SE-WBS2-' + suffix,
        wbsName: 'Other WBS',
      },
    });
    const otherCalendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: otherProject.id,
        calendarName: 'Other Calendar',
        timezoneName: 'Asia/Singapore',
      },
    });
    const otherActivity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: otherProject.id,
        wbsId: otherWbs.id,
        workingCalendarId: otherCalendar.id,
        activityCode: 'SE-A2-' + suffix,
        activityName: 'Other Activity',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const service = new SiteExecutionService(
      prisma,
      access,
      audit,
      {} as DocumentsService,
    );
    const siteAuth = auth(company.id, user.id);

    const created = await service.create(
      { auth: siteAuth },
      {
        projectId: project.id,
        reportDate: new Date('2026-10-05T00:00:00.000Z'),
        weatherObservation: 'Dry morning; light rain after 15:00.',
        generalRemarks: 'Ground floor concrete activities.',
        manpower: [
          {
            tradeRole: 'Carpenter',
            headcount: 8,
            remarks: 'Formwork crew',
          },
          {
            tradeRole: 'General Worker',
            headcount: 4,
          },
        ],
        materialUsage: [
          {
            materialId: material.id,
            uomId: uom.id,
            quantity: new Prisma.Decimal('12.5'),
            activityId: activity.id,
            wbsId: wbs.id,
            remarks: 'Observed concrete consumption only',
          },
        ],
        progress: [
          {
            activityId: activity.id,
            percentComplete: new Prisma.Decimal('65'),
            note: 'Daily site progress',
          },
        ],
        issues: [
          {
            activityId: activity.id,
            issueText: 'Access route partially blocked.',
          },
        ],
        delays: [
          {
            activityId: activity.id,
            delayReason: 'Afternoon rain slowed delivery.',
          },
        ],
        inspections: [
          {
            activityId: activity.id,
            inspectionReference: 'IR-' + suffix,
            remarks: 'Pre-pour inspection',
          },
        ],
      },
    );

    assert.equal(created.status, 'DRAFT');
    assert.equal(created.totalManpower, 12);
    assert.equal(created.progressLines.length, 1);
    assert.equal(created.materialUsage.length, 1);

    await assert.rejects(
      () =>
        service.get(
          auth(company.id, unassigned.id),
          created.id,
        ),
      (error: unknown) => error instanceof ForbiddenException,
      'unassigned user must be denied Daily Site Report access',
    );

    await assert.rejects(
      () =>
        service.create(
          { auth: siteAuth },
          {
            projectId: project.id,
            reportDate: new Date('2026-10-05T00:00:00.000Z'),
            manpower: [],
            materialUsage: [],
            progress: [],
            issues: [],
            delays: [],
            inspections: [],
          },
        ),
      (error: unknown) => error instanceof ConflictException,
      'duplicate Project/date Daily Site Report must be rejected',
    );

    await assert.rejects(
      () =>
        service.create(
          { auth: siteAuth },
          {
            projectId: project.id,
            reportDate: new Date('2026-10-06T00:00:00.000Z'),
            manpower: [],
            materialUsage: [],
            progress: [
              {
                activityId: otherActivity.id,
                percentComplete: new Prisma.Decimal('10'),
              },
            ],
            issues: [],
            delays: [],
            inspections: [],
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'cross-Project Activity reference must be rejected',
    );

    const updated = await service.update(
      { auth: siteAuth },
      created.id,
      {
        generalRemarks: 'Updated while report is still draft.',
        manpower: [
          {
            tradeRole: 'Carpenter',
            headcount: 9,
          },
        ],
      },
    );
    assert.equal(updated.status, 'DRAFT');
    assert.equal(updated.totalManpower, 9);

    const submitted = await service.submit(
      { auth: siteAuth },
      created.id,
    );
    assert.equal(submitted.status, 'SUBMITTED');
    assert.equal(submitted.progressLines[0]?.activityProgress?.percentComplete.toNumber(), 65);

    const progress = await prisma.activityProgress.findMany({
      where: {
        activityId: activity.id,
        sourceType: 'DAILY_SITE_REPORT',
        sourceEntityId: created.id,
      },
    });
    assert.equal(progress.length, 1);
    assert.equal(progress[0]?.progressDate.toISOString().slice(0, 10), '2026-10-05');
    assert.equal(progress[0]?.percentComplete.toNumber(), 65);

    await assert.rejects(
      () =>
        service.update(
          { auth: siteAuth },
          created.id,
          { generalRemarks: 'Must not overwrite submitted report.' },
        ),
      (error: unknown) => error instanceof ConflictException,
      'submitted report must reject service-layer edits',
    );

    await assert.rejects(
      () =>
        prisma.dailySiteReport.update({
          where: { id: created.id },
          data: { generalRemarks: 'Database bypass must fail.' },
        }),
      'submitted report must reject direct database edits',
    );

    await assert.rejects(
      () =>
        prisma.dailySiteReportManpower.create({
          data: {
            reportId: created.id,
            tradeRole: 'Late edit',
            headcount: 1,
          },
        }),
      'submitted report child rows must be immutable in the database',
    );

    const correction = await service.addCorrection(
      { auth: siteAuth },
      created.id,
      'Correction: rain started at 14:45, not 15:00.',
    );
    assert.ok(correction);
    assert.equal(correction?.correctionNote.includes('14:45'), true);

    await assert.rejects(
      () =>
        prisma.dailySiteReportCorrection.update({
          where: { id: correction!.id },
          data: { correctionNote: 'Must remain append-only.' },
        }),
      'Daily Site Report corrections must be append-only',
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: [
            'DAILY_SITE_REPORT',
            'DAILY_SITE_REPORT_CORRECTION',
            'ACTIVITY_PROGRESS',
          ],
        },
      },
    });
    assert.ok(auditCount >= 5);
  } finally {
    await prisma.$disconnect();
  }
});
