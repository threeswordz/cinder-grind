import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SchedulingProgressService } from '../scheduling/scheduling-progress.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { ReportingService } from './reporting.service';

function auth(
  companyId: string,
  userId: string,
  employeeId?: string,
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: 'Reporting User',
    roleCodes: ['PROJECT_ENGINEER'],
    permissions: ['reporting.operational.view'],
    csrfTokenHash: '0'.repeat(64),
    ...(employeeId ? {} : {}),
  };
}

test('Project Engineer reporting derives current source-module data within Project scope', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'RPT-' + suffix,
        companyName: 'Reporting Test',
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'RPT-C-' + suffix,
        customerName: 'Reporting Customer',
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
        employeeCode: 'RPT-E-' + suffix,
        employeeName: 'Project Engineer',
      },
    });
    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'report-' + suffix + '@example.com',
        displayName: 'Project Engineer',
        passwordHash: 'x',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'RPT-O-' + suffix,
        employeeName: 'Unassigned Engineer',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'report-outsider-' + suffix + '@example.com',
        displayName: 'Unassigned Engineer',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'RPT-P-' + suffix,
        projectName: 'Reporting Project',
        customerId: customer.id,
        statusDefinitionId: status.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-12-31T00:00:00.000Z'),
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
        wbsCode: 'RPT-W-' + suffix,
        wbsName: 'Groundworks',
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'Reporting Calendar',
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
        activityCode: 'RPT-A-' + suffix,
        activityName: 'Excavation',
        plannedDurationWorkDays: '3',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
        forecastStartDate: new Date('2026-10-02T00:00:00.000Z'),
        forecastFinishDate: new Date('2026-10-06T00:00:00.000Z'),
      },
    });
    await prisma.activityProgress.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        activityId: activity.id,
        progressDate: new Date('2026-10-05T00:00:00.000Z'),
        percentComplete: '50',
        recordedByUserId: user.id,
      },
    });
    await prisma.dailySiteReport.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        reportDate: new Date('2026-10-05T00:00:00.000Z'),
        weatherObservation: 'Dry',
        generalRemarks: 'Reference site report',
        createdByUserId: user.id,
        manpowerLines: {
          create: [
            { tradeRole: 'General Worker', headcount: 4 },
            { tradeRole: 'Operator', headcount: 1 },
          ],
        },
        issues: {
          create: [{ activityId: activity.id, issueText: 'Access constrained' }],
        },
        delays: {
          create: [{ activityId: activity.id, delayReason: 'Rain recovery' }],
        },
      },
    });
    const type = await prisma.equipmentType.create({
      data: {
        companyId: company.id,
        equipmentTypeCode: 'EXC-' + suffix,
        equipmentTypeName: 'Excavator',
      },
    });
    const equipment = await prisma.equipment.create({
      data: {
        companyId: company.id,
        equipmentTypeId: type.id,
        equipmentCode: 'EQ-' + suffix,
        equipmentName: 'Excavator 01',
        operationalStatus: 'AVAILABLE',
      },
    });
    await prisma.equipmentAssignment.create({
      data: {
        companyId: company.id,
        equipmentId: equipment.id,
        projectId: project.id,
        assignedFrom: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const scheduling = new SchedulingService(prisma, access, audit);
    const progress = new SchedulingProgressService(
      prisma,
      access,
      audit,
      new ApprovalService(prisma),
      scheduling,
    );
    const reporting = new ReportingService(
      prisma,
      access,
      progress,
    );
    const scoped = auth(company.id, user.id, employee.id);
    const unassigned = auth(
      company.id,
      outsider.id,
      outsiderEmployee.id,
    );

    assert.deepEqual(
      (await reporting.projects(scoped)).map((row) => row.id),
      [project.id],
    );
    assert.deepEqual(await reporting.projects(unassigned), []);

    const dashboard = await reporting.projectEngineer(
      scoped,
      project.id,
      new Date('2026-10-06T00:00:00.000Z'),
      14,
    );
    assert.equal(dashboard.project.id, project.id);
    assert.equal(dashboard.asOfDate, '2026-10-06');
    assert.equal(dashboard.schedule.summary.total, 1);
    assert.equal(dashboard.schedule.activities[0]?.currentPercentComplete, 50);
    assert.equal(dashboard.schedule.lookahead.window.days, 14);
    assert.equal(dashboard.schedule.lookahead.activities.length, 1);
    assert.equal(dashboard.siteExecution.latestReports.length, 1);
    assert.equal(dashboard.siteExecution.latestReports[0]?.totalManpower, 5);
    assert.equal(dashboard.siteExecution.latestReports[0]?.counts.issues, 1);
    assert.equal(dashboard.siteExecution.latestReports[0]?.counts.delays, 1);
    assert.equal(dashboard.equipment.assignedCount, 1);
    assert.equal(
      dashboard.equipment.assignments[0]?.equipment.id,
      equipment.id,
    );

    await assert.rejects(
      () =>
        reporting.projectEngineer(
          unassigned,
          project.id,
          new Date('2026-10-06T00:00:00.000Z'),
          14,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );
  } finally {
    await prisma.$disconnect();
  }
});
