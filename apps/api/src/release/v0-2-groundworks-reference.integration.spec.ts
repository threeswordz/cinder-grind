import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { Prisma } from '@prisma/client';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SchedulingProgressService } from '../scheduling/scheduling-progress.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import { V02_GROUNDWORKS_REFERENCE } from './v0-2-groundworks-reference';

function auth(
  companyId: string,
  userId: string,
  roleCodes: string[],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: userId + '@example.com',
    displayName: userId,
    roleCodes,
    permissions: [
      'schedule.programme.view',
      'schedule.baseline.create',
      'schedule.baseline.approve',
      'schedule.progress.record',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

function date(value: string) {
  return new Date(value + 'T00:00:00.000Z');
}

function dateKey(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value.slice(0, 10);
}

test('V0.2-G Ground Floor Slab reference programme proves backend schedule and Gantt presentation agree', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const reference = V02_GROUNDWORKS_REFERENCE;
    const suffix = randomUUID().slice(0, 8);

    assert.equal(
      reference.activities.reduce(
        (total, row) => total + row.durationWorkDays,
        0,
      ),
      reference.planned.workDays,
      'The eight detailed reference Activities must total exactly 20 working days.',
    );

    const company = await prisma.company.create({
      data: {
        companyCode: 'UAT2-' + suffix,
        companyName: 'V0.2 UAT ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'CUS-' + suffix,
        customerName: 'Reference Customer',
      },
    });
    const projectStatus = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'PROJECT',
        statusCode: 'ACTIVE-' + suffix,
        statusLabel: 'Active',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PLAN-' + suffix,
        employeeName: 'Reference Planner',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'CHK-' + suffix,
        employeeName: 'Reference Approver',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'uat2-maker-' + suffix + '@example.com',
        displayName: 'Reference Planner',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'uat2-checker-' + suffix + '@example.com',
        displayName: 'Reference Approver',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'FACT-' + suffix,
        projectName: reference.projectName,
        customerId: customer.id,
        statusDefinitionId: projectStatus.id,
        contractValue: '90000000.00',
        plannedStartDate: date(reference.planned.startDate),
        plannedCompletionDate: date('2027-09-30'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          employeeId: makerEmployee.id,
          projectRole: 'Planner',
        },
        {
          projectId: project.id,
          employeeId: checkerEmployee.id,
          projectRole: 'Project Manager',
        },
      ],
    });

    const groundworks = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: reference.wbs.root.code + '-' + suffix,
        wbsName: reference.wbs.root.name,
      },
    });
    const slab = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        parentId: groundworks.id,
        wbsCode: reference.wbs.slab.code + '-' + suffix,
        wbsName: reference.wbs.slab.name,
      },
    });
    assert.equal(slab.parentId, groundworks.id);

    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'Reference Mon-Fri Calendar',
        timezoneName: reference.calendar.timezoneName,
        isDefault: true,
      },
    });
    await prisma.workingCalendarWeekday.createMany({
      data: reference.calendar.workingWeekdays.map((weekdayNo) => ({
        workingCalendarId: calendar.id,
        weekdayNo,
        isWorking: true,
        startTime: new Date('1970-01-01T08:00:00.000Z'),
        endTime: new Date('1970-01-01T17:00:00.000Z'),
      })),
    });

    const summary = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: slab.id,
        workingCalendarId: calendar.id,
        activityCode: reference.summary.code + '-' + suffix,
        activityName: reference.summary.name,
        isSummary: true,
        plannedDurationWorkDays: String(reference.summary.durationWorkDays),
        plannedStartDate: date(reference.summary.plannedStartDate),
        plannedFinishDate: date(reference.summary.plannedFinishDate),
      },
    });

    const detailRows = [];
    for (const row of reference.activities) {
      detailRows.push(
        await prisma.activity.create({
          data: {
            companyId: company.id,
            projectId: project.id,
            wbsId: slab.id,
            parentActivityId: summary.id,
            workingCalendarId: calendar.id,
            activityCode: row.code + '-' + suffix,
            activityName: row.name,
            plannedDurationWorkDays: String(row.durationWorkDays),
            plannedStartDate: date(row.plannedStartDate),
            plannedFinishDate: date(row.plannedFinishDate),
          },
        }),
      );
    }

    for (let index = 1; index < detailRows.length; index += 1) {
      await prisma.activityDependency.create({
        data: {
          projectId: project.id,
          predecessorActivityId: detailRows[index - 1]!.id,
          successorActivityId: detailRows[index]!.id,
          dependencyType: 'FS',
          lagWorkDays: '0',
        },
      });
    }

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const scheduling = new SchedulingService(prisma, access, audit);
    const progress = new SchedulingProgressService(
      prisma,
      access,
      audit,
      approvals,
      scheduling,
    );
    const makerAuth = auth(company.id, maker.id, ['PLANNER']);

    const planned = await scheduling.scheduleAnalysis(
      makerAuth,
      project.id,
      'planned',
    );
    assert.equal(planned.projectFinishDate, reference.planned.finishDate);

    const plannedByName = new Map(
      planned.activities.map((row) => [row.activityName, row]),
    );
    const summaryPlanned = plannedByName.get(reference.summary.name);
    assert.equal(
      summaryPlanned?.calculatedStartDate,
      reference.planned.startDate,
    );
    assert.equal(
      summaryPlanned?.calculatedFinishDate,
      reference.planned.finishDate,
    );
    assert.equal(summaryPlanned?.totalFloatWorkDays, 0);
    assert.equal(summaryPlanned?.isCritical, true);

    for (const expected of reference.activities) {
      const calculated = plannedByName.get(expected.name);
      assert.equal(
        calculated?.calculatedStartDate,
        expected.plannedStartDate,
        expected.name + ' planned start mismatch',
      );
      assert.equal(
        calculated?.calculatedFinishDate,
        expected.plannedFinishDate,
        expected.name + ' planned finish mismatch',
      );
      assert.equal(
        calculated?.totalFloatWorkDays,
        0,
        expected.name + ' must be on the reference critical chain',
      );
      assert.equal(calculated?.isCritical, true);
    }

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'UAT2_APPROVER_' + suffix,
        roleName: 'V0.2 Reference Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SCHEDULE_BASELINE_UAT2_' + suffix,
        entityType: 'SCHEDULE_BASELINE',
        workflowName: 'V0.2 Reference Baseline Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Approve Reference Baseline',
              requiredApprovals: 1,
              stepRoles: {
                create: [{ roleId: approverRole.id }],
              },
            },
          ],
        },
      },
    });
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);

    const submitted = await progress.submitBaseline(
      { auth: makerAuth },
      project.id,
      workflow.workflowCode,
    );
    assert.equal(submitted._count.activities, 9);

    const approved = await progress.approveBaseline(
      { auth: checkerAuth },
      submitted.id,
      'Approved V0.2 reference baseline.',
    );
    assert.equal(approved.approvalInstance?.approvalState, 'APPROVED');
    assert.equal(approved.isCurrent, true);

    const baselineByName = new Map(
      approved.activities.map((row) => [row.activityName, row]),
    );
    for (const expected of reference.activities) {
      const snapshot = baselineByName.get(expected.name);
      assert.equal(dateKey(snapshot?.plannedStartDate), expected.plannedStartDate);
      assert.equal(
        dateKey(snapshot?.plannedFinishDate),
        expected.plannedFinishDate,
      );
    }

    await prisma.activity.update({
      where: { id: summary.id },
      data: {
        forecastStartDate: date(reference.forecast.startDate),
        forecastFinishDate: date(reference.forecast.finishDate),
      },
    });
    await prisma.activity.update({
      where: { id: detailRows[0]!.id },
      data: {
        actualStartDate: date('2026-10-02'),
        actualFinishDate: date('2026-10-02'),
        forecastStartDate: date(
          reference.activities[0]!.forecastStartDate,
        ),
        forecastFinishDate: date(
          reference.activities[0]!.forecastFinishDate,
        ),
      },
    });
    await prisma.activity.update({
      where: { id: detailRows[1]!.id },
      data: {
        actualStartDate: date('2026-10-05'),
      },
    });

    await progress.recordProgress(
      { auth: makerAuth },
      detailRows[0]!.id,
      {
        progressDate: date('2026-10-02'),
        percentComplete: new Prisma.Decimal('100'),
        note: 'Setting Out completed one working day behind baseline.',
      },
    );
    await progress.recordProgress(
      { auth: makerAuth },
      detailRows[1]!.id,
      {
        progressDate: date('2026-10-06'),
        percentComplete: new Prisma.Decimal('25'),
        note: 'Excavation first progress observation.',
      },
    );
    await progress.recordProgress(
      { auth: makerAuth },
      detailRows[1]!.id,
      {
        progressDate: date('2026-10-07'),
        percentComplete: new Prisma.Decimal('50'),
        note: 'Excavation latest progress observation.',
      },
    );

    const progressHistory = await progress.progressHistory(
      makerAuth,
      detailRows[1]!.id,
    );
    assert.equal(progressHistory.length, 2);
    assert.deepEqual(
      new Set(progressHistory.map((row) => row.percentComplete.toNumber())),
      new Set([25, 50]),
    );

    const forecast = await scheduling.scheduleAnalysis(
      makerAuth,
      project.id,
      'forecast',
    );
    assert.equal(forecast.projectFinishDate, reference.forecast.finishDate);

    const forecastByName = new Map(
      forecast.activities.map((row) => [row.activityName, row]),
    );
    for (const expected of reference.activities) {
      const calculated = forecastByName.get(expected.name);
      assert.equal(
        calculated?.calculatedStartDate,
        expected.forecastStartDate,
        expected.name + ' forecast start mismatch',
      );
      assert.equal(
        calculated?.calculatedFinishDate,
        expected.forecastFinishDate,
        expected.name + ' forecast finish mismatch',
      );
    }

    const gantt = await progress.presentation(makerAuth, project.id);
    assert.equal(gantt.currentBaseline?.versionNo, 1);

    const ganttByName = new Map(
      gantt.activities.map((row) => [row.activityName, row]),
    );
    for (const expected of reference.activities) {
      const backend = forecastByName.get(expected.name);
      const presented = ganttByName.get(expected.name);
      assert.ok(backend && presented);
      assert.equal(
        dateKey(presented.forecastStartDate),
        backend.calculatedStartDate,
        expected.name + ' Gantt start must equal backend forecast',
      );
      assert.equal(
        dateKey(presented.forecastFinishDate),
        backend.calculatedFinishDate,
        expected.name + ' Gantt finish must equal backend forecast',
      );
      assert.equal(
        presented.totalFloatWorkDays,
        backend.totalFloatWorkDays,
        expected.name + ' Gantt float must equal backend result',
      );
      assert.equal(
        presented.isCritical,
        backend.isCritical,
        expected.name + ' Gantt critical flag must equal backend result',
      );
      assert.equal(
        dateKey(presented.baselineStartDate),
        expected.plannedStartDate,
      );
      assert.equal(
        dateKey(presented.baselineFinishDate),
        expected.plannedFinishDate,
      );
      assert.equal(
        presented.delayWorkDays,
        reference.forecast.delayWorkDays,
      );
      assert.equal(presented.delayStatus, 'DELAYED');
    }

    const settingOut = ganttByName.get('Setting Out');
    assert.equal(dateKey(settingOut?.actualStartDate), '2026-10-02');
    assert.equal(dateKey(settingOut?.actualFinishDate), '2026-10-02');
    assert.equal(settingOut?.currentPercentComplete, 100);

    const excavation = ganttByName.get('Excavation');
    assert.equal(dateKey(excavation?.actualStartDate), '2026-10-05');
    assert.equal(excavation?.currentPercentComplete, 50);

    for (let index = 0; index < detailRows.length; index += 1) {
      const presented = ganttByName.get(reference.activities[index]!.name);
      assert.deepEqual(
        presented?.predecessorActivityIds,
        index === 0 ? [] : [detailRows[index - 1]!.id],
      );
    }

    const twoWeek = await progress.lookahead(
      makerAuth,
      project.id,
      date('2026-10-01'),
      14,
    );
    assert.deepEqual(twoWeek.window, {
      asOfDate: '2026-10-01',
      endDate: '2026-10-14',
      days: 14,
    });
    const twoWeekNames = new Set(
      twoWeek.activities.map((row) => row.activityName),
    );
    for (const name of [
      'Setting Out',
      'Excavation',
      'Compaction',
      'Blinding Concrete',
      'Formwork',
    ]) {
      assert.equal(twoWeekNames.has(name), true, name + ' must be in 2-week lookahead');
    }
    for (const name of [
      'Reinforcement',
      'Inspection',
      'Concrete Pour',
    ]) {
      assert.equal(
        twoWeekNames.has(name),
        false,
        name + ' must be outside 2-week lookahead',
      );
    }

    const fourWeek = await progress.lookahead(
      makerAuth,
      project.id,
      date('2026-10-01'),
      28,
    );
    assert.deepEqual(fourWeek.window, {
      asOfDate: '2026-10-01',
      endDate: '2026-10-28',
      days: 28,
    });
    const fourWeekNames = new Set(
      fourWeek.activities.map((row) => row.activityName),
    );
    for (const expected of reference.activities) {
      assert.equal(
        fourWeekNames.has(expected.name),
        true,
        expected.name + ' must overlap the 4-week lookahead',
      );
    }

    const hierarchy = await prisma.activity.findMany({
      where: { projectId: project.id, parentActivityId: summary.id },
      select: { id: true },
    });
    assert.equal(hierarchy.length, 8);
  } finally {
    await prisma.$disconnect();
  }
});
