import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SchedulingProgressService } from './scheduling-progress.service';
import { SchedulingService } from './scheduling.service';

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

test('Stage C preserves immutable baselines and append-only progress with approved comparison rules', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'C-' + suffix,
        companyName: 'Stage C ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'CUS-' + suffix,
        customerName: 'Stage C Customer',
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
        employeeCode: 'MK-' + suffix,
        employeeName: 'Baseline Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'CK-' + suffix,
        employeeName: 'Baseline Checker',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'maker-' + suffix + '@example.com',
        displayName: 'Baseline Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'checker-' + suffix + '@example.com',
        displayName: 'Baseline Checker',
        passwordHash: 'x',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P-' + suffix,
        projectName: 'Stage C Project',
        customerId: customer.id,
        statusDefinitionId: projectStatus.id,
        contractValue: '1000000.00',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00.000Z'),
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

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: '01-' + suffix,
        wbsName: 'Groundworks',
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'Stage C Calendar',
        timezoneName: 'Asia/Singapore',
        isDefault: true,
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

    const activityA = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'A100-' + suffix,
        activityName: 'Setting Out',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
      },
    });
    const activityB = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'A200-' + suffix,
        activityName: 'Excavation',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-06T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-06T00:00:00.000Z'),
      },
    });
    await prisma.activityDependency.create({
      data: {
        projectId: project.id,
        predecessorActivityId: activityA.id,
        successorActivityId: activityB.id,
        dependencyType: 'FS',
        lagWorkDays: '0',
      },
    });

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'BASELINE_APPROVER_' + suffix,
        roleName: 'Baseline Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'SCHEDULE_BASELINE_' + suffix,
        entityType: 'SCHEDULE_BASELINE',
        workflowName: 'Schedule Baseline Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Approve Baseline',
              requiredApprovals: 1,
              stepRoles: {
                create: [{ roleId: approverRole.id }],
              },
            },
          ],
        },
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const scheduling = new SchedulingService(prisma, access, audit);
    const service = new SchedulingProgressService(
      prisma,
      access,
      audit,
      approvals,
      scheduling,
    );
    const makerAuth = auth(company.id, maker.id, ['PLANNER']);
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);

    const submitted = await service.submitBaseline(
      { auth: makerAuth },
      project.id,
      workflow.workflowCode,
    );
    assert.equal(submitted.versionNo, 1);
    assert.equal(submitted.approvalInstance?.approvalState, 'SUBMITTED');
    assert.equal(submitted._count.activities, 2);

    await assert.rejects(
      () =>
        service.approveBaseline(
          { auth: makerAuth },
          submitted.id,
          'Maker cannot self-approve',
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const approved = await service.approveBaseline(
      { auth: checkerAuth },
      submitted.id,
      'Approved',
    );
    assert.equal(approved.approvalInstance?.approvalState, 'APPROVED');
    assert.equal(approved.isCurrent, true);

    const snapshot = approved.activities[0]!;
    await assert.rejects(() =>
      prisma.scheduleBaselineActivity.update({
        where: { id: snapshot.id },
        data: { activityName: 'Must Not Change' },
      }),
    );
    await assert.rejects(() =>
      prisma.scheduleBaseline.delete({ where: { id: submitted.id } }),
    );

    const firstProgress = await service.recordProgress(
      { auth: makerAuth },
      activityA.id,
      {
        progressDate: new Date('2026-10-06T00:00:00.000Z'),
        percentComplete: new Prisma.Decimal('50'),
        note: 'Initial field report',
      },
    );
    const correctedProgress = await service.recordProgress(
      { auth: makerAuth },
      activityA.id,
      {
        progressDate: new Date('2026-10-05T00:00:00.000Z'),
        percentComplete: new Prisma.Decimal('40'),
        note: 'Backdated correction appended later',
      },
    );
    assert.equal(firstProgress.percentComplete.toString(), '50');
    assert.equal(correctedProgress.percentComplete.toString(), '40');

    const history = await service.progressHistory(
      makerAuth,
      activityA.id,
    );
    assert.equal(history.length, 2);
    assert.equal(history[0]!.percentComplete.toString(), '40');

    await assert.rejects(() =>
      prisma.activityProgress.update({
        where: { id: firstProgress.id },
        data: { percentComplete: '60' },
      }),
    );
    await assert.rejects(() =>
      prisma.activityProgress.delete({
        where: { id: firstProgress.id },
      }),
    );

    await prisma.activity.update({
      where: { id: activityA.id },
      data: {
        forecastStartDate: new Date('2026-10-07T00:00:00.000Z'),
        forecastFinishDate: new Date('2026-10-07T00:00:00.000Z'),
      },
    });

    const comparison = await service.comparison(
      makerAuth,
      project.id,
    );
    const comparedA = comparison.activities.find(
      (row) => row.activityId === activityA.id,
    );
    assert.equal(comparison.currentBaseline?.versionNo, 1);
    assert.equal(comparedA?.currentPercentComplete, 40);
    assert.equal(comparedA?.finishVarianceWorkDays, 2);
    assert.equal(comparedA?.delayWorkDays, 2);
    assert.equal(comparedA?.delayStatus, 'DELAYED');

    await prisma.activity.update({
      where: { id: activityA.id },
      data: {
        plannedStartDate: new Date('2026-10-08T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-08T00:00:00.000Z'),
      },
    });

    const version2 = await service.submitBaseline(
      { auth: makerAuth },
      project.id,
      workflow.workflowCode,
    );
    assert.equal(version2.versionNo, 2);

    const approved2 = await service.approveBaseline(
      { auth: checkerAuth },
      version2.id,
      'Approved rebaseline',
    );
    assert.equal(approved2.isCurrent, true);

    const versions = await service.listBaselines(
      makerAuth,
      project.id,
    );
    assert.equal(versions[0]!.versionNo, 2);
    assert.equal(versions[0]!.isCurrent, true);
    assert.equal(versions[1]!.versionNo, 1);
    assert.equal(versions[1]!.isCurrent, false);

    const noBaselineProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P2-' + suffix,
        projectName: 'No Baseline',
        customerId: customer.id,
        statusDefinitionId: projectStatus.id,
        contractValue: '100.00',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedCompletionDate: new Date('2026-10-31T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: noBaselineProject.id,
        employeeId: makerEmployee.id,
        projectRole: 'Planner',
      },
    });
    const noBaselineWbs = await prisma.wbsElement.create({
      data: {
        projectId: noBaselineProject.id,
        wbsCode: '01B-' + suffix,
        wbsName: 'No Baseline WBS',
      },
    });
    const noBaselineCalendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: noBaselineProject.id,
        calendarName: 'No Baseline Calendar',
        timezoneName: 'Asia/Singapore',
      },
    });
    await prisma.workingCalendarWeekday.createMany({
      data: [1, 2, 3, 4, 5].map((weekdayNo) => ({
        workingCalendarId: noBaselineCalendar.id,
        weekdayNo,
        isWorking: true,
        startTime: new Date('1970-01-01T08:00:00.000Z'),
        endTime: new Date('1970-01-01T17:00:00.000Z'),
      })),
    });
    const noBaselineActivity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: noBaselineProject.id,
        wbsId: noBaselineWbs.id,
        workingCalendarId: noBaselineCalendar.id,
        activityCode: 'NB-' + suffix,
        activityName: 'No Baseline Activity',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
      },
    });

    const noBaselineComparison = await service.comparison(
      makerAuth,
      noBaselineProject.id,
    );
    const unavailable = noBaselineComparison.activities.find(
      (row) => row.activityId === noBaselineActivity.id,
    );
    assert.equal(noBaselineComparison.currentBaseline, null);
    assert.equal(unavailable?.delayWorkDays, null);
    assert.equal(unavailable?.delayStatus, 'UNAVAILABLE');

    const stageCAuditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: ['SCHEDULE_BASELINE', 'ACTIVITY_PROGRESS'],
        },
      },
    });
    assert.ok(stageCAuditCount >= 6);
  } finally {
    await prisma.$disconnect();
  }
});
