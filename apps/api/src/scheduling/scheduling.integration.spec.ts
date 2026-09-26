import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SchedulingService } from './scheduling.service';

function auth(
  companyId: string,
  userId: string,
  permissions: string[],
): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(),
    userId,
    companyId,
    email: 'schedule@example.com',
    displayName: 'Schedule User',
    roleCodes: ['TEST'],
    permissions,
    csrfTokenHash: '0'.repeat(64),
  };
}

test('Scheduling data model enforces Project scope and hierarchy integrity in PostgreSQL', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'SCH-' + suffix,
        companyName: 'Scheduling Test',
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'SCX-' + suffix,
        companyName: 'Other Scheduling Test',
      },
    });

    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'C-' + suffix,
        customerName: 'Schedule Customer',
      },
    });
    const otherCustomer = await prisma.customer.create({
      data: {
        companyId: otherCompany.id,
        customerCode: 'OC-' + suffix,
        customerName: 'Other Schedule Customer',
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
    const otherProjectStatus = await prisma.statusDefinition.create({
      data: {
        companyId: otherCompany.id,
        entityType: 'PROJECT',
        statusCode: 'ACTIVE-' + suffix,
        statusLabel: 'Active',
      },
    });
    const activityStatus = await prisma.statusDefinition.create({
      data: {
        companyId: company.id,
        entityType: 'ACTIVITY',
        statusCode: 'PLANNED-' + suffix,
        statusLabel: 'Planned',
      },
    });

    const employee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PE-' + suffix,
        employeeName: 'Project Engineer',
      },
    });
    const scopedUser = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: employee.id,
        email: 'scoped-' + suffix + '@example.com',
        displayName: 'Scoped Scheduler',
        passwordHash: 'x',
      },
    });
    const allUser = await prisma.user.create({
      data: {
        companyId: company.id,
        email: 'all-' + suffix + '@example.com',
        displayName: 'All Scheduler',
        passwordHash: 'x',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'P-' + suffix,
        projectName: 'Assigned Project',
        customerId: customer.id,
        statusDefinitionId: projectStatus.id,
        contractValue: '1000000.00',
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
        statusDefinitionId: projectStatus.id,
        contractValue: '500000.00',
        plannedStartDate: new Date('2026-10-01T00:00:00Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: otherCompany.id,
        projectCode: 'OP-' + suffix,
        projectName: 'Other Company Project',
        customerId: otherCustomer.id,
        statusDefinitionId: otherProjectStatus.id,
        contractValue: '500000.00',
        plannedStartDate: new Date('2026-10-01T00:00:00Z'),
        plannedCompletionDate: new Date('2027-03-31T00:00:00Z'),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'Project Engineer',
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const service = new SchedulingService(
      prisma,
      access,
      new AuditService(prisma),
    );
    const scoped = auth(company.id, scopedUser.id, [
      'schedule.programme.view',
      'schedule.activity.create',
      'schedule.activity.edit',
      'schedule.activity.archive',
      'schedule.dependency.manage',
      'schedule.calendar.manage',
      'admin.activity_types.manage',
    ]);
    const all = auth(company.id, allUser.id, [
      'projects.access_all',
      'schedule.programme.view',
      'schedule.calendar.manage',
    ]);

    assert.deepEqual(
      (await service.projects(scoped)).map((row) => row.id),
      [project.id],
    );
    assert.deepEqual(
      (await service.projects(all))
        .map((row) => row.id)
        .sort(),
      [project.id, unassignedProject.id].sort(),
    );

    const activityType = await service.createActivityType(
      { auth: scoped },
      {
        activityTypeCode: 'TASK-' + suffix,
        activityTypeName: 'Task',
      },
    );
    await prisma.activityType.create({
      data: {
        companyId: otherCompany.id,
        activityTypeCode: 'TASK-' + suffix,
        activityTypeName: 'Other Task',
      },
    });
    assert.equal((await service.listActivityTypes(company.id)).length, 1);

    const calendar = await service.createCalendar(
      { auth: scoped },
      {
        calendarName: 'Company Calendar ' + suffix,
        timezoneName: 'Asia/Singapore',
      },
    );
    const projectCalendar = await service.createCalendar(
      { auth: scoped },
      {
        projectId: project.id,
        calendarName: 'Project Calendar ' + suffix,
        timezoneName: 'Asia/Singapore',
      },
    );
    await assert.rejects(
      () =>
        service.createCalendar(
          { auth: scoped },
          {
            projectId: unassignedProject.id,
            calendarName: 'Unauthorized Calendar',
            timezoneName: 'Asia/Singapore',
          },
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const standardWeekdays = [1, 2, 3, 4, 5].map((weekdayNo) => ({
      weekdayNo,
      isWorking: true,
      startTime: new Date('1970-01-01T08:00:00.000Z'),
      endTime: new Date('1970-01-01T17:00:00.000Z'),
    }));
    await service.replaceWeekdays(
      { auth: scoped },
      calendar.id,
      standardWeekdays,
    );
    await service.replaceWeekdays(
      { auth: scoped },
      projectCalendar.id,
      standardWeekdays,
    );
    await service.replaceExceptions(
      { auth: scoped },
      calendar.id,
      [
        {
          exceptionDate: new Date('2026-12-25T00:00:00.000Z'),
          isWorkingOverride: false,
          startTime: null,
          endTime: null,
          reason: 'Holiday',
        },
      ],
    );

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: '01-' + suffix,
        wbsName: 'Groundworks',
      },
    });
    const otherWbs = await prisma.wbsElement.create({
      data: {
        projectId: unassignedProject.id,
        wbsCode: '02-' + suffix,
        wbsName: 'Other WBS',
      },
    });

    const root = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        activityTypeId: activityType.id,
        workingCalendarId: calendar.id,
        statusDefinitionId: activityStatus.id,
        activityCode: 'A100-' + suffix,
        activityName: 'Excavation',
        plannedDurationWorkDays: new Prisma.Decimal('5'),
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-05T00:00:00.000Z'),
        responsibleEmployeeId: employee.id,
        ownerUserId: scopedUser.id,
      },
    );
    const child = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        parentActivityId: root.id,
        workingCalendarId: projectCalendar.id,
        activityCode: 'A110-' + suffix,
        activityName: 'Detailed Excavation',
        plannedDurationWorkDays: new Prisma.Decimal('2'),
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-02T00:00:00.000Z'),
      },
    );
    assert.equal(child.parentActivityId, root.id);

    await assert.rejects(
      () =>
        service.createActivity(
          { auth: scoped },
          project.id,
          {
            wbsId: otherWbs.id,
            workingCalendarId: calendar.id,
            activityCode: 'BAD-' + suffix,
            activityName: 'Bad WBS',
            plannedDurationWorkDays: new Prisma.Decimal('1'),
            plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
            plannedFinishDate: new Date('2026-10-01T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(() =>
      prisma.activity.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          wbsId: otherWbs.id,
          workingCalendarId: calendar.id,
          activityCode: 'DBBAD-' + suffix,
          activityName: 'DB Bad WBS',
          plannedDurationWorkDays: '1',
          plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
          plannedFinishDate: new Date('2026-10-01T00:00:00.000Z'),
        },
      }),
    );

    await assert.rejects(
      () =>
        service.updateActivity(
          { auth: scoped },
          root.id,
          { parentActivityId: child.id },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(() =>
      prisma.activity.update({
        where: { id: root.id },
        data: { parentActivityId: child.id },
      }),
    );

    await assert.rejects(
      () => service.listActivities(scoped, unassignedProject.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const unassignedCalendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: unassignedProject.id,
        calendarName: 'Unassigned Calendar ' + suffix,
        timezoneName: 'Asia/Singapore',
      },
    });
    const unassignedActivity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: unassignedProject.id,
        wbsId: otherWbs.id,
        workingCalendarId: unassignedCalendar.id,
        activityCode: 'UA-' + suffix,
        activityName: 'Unassigned Activity',
        plannedDurationWorkDays: '1',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-01T00:00:00.000Z'),
      },
    });

    const dependency = await service.createDependency(
      { auth: scoped },
      project.id,
      {
        predecessorActivityId: root.id,
        successorActivityId: child.id,
        dependencyType: 'FS',
        lagWorkDays: new Prisma.Decimal('-1'),
      },
    );
    assert.equal(dependency.lagWorkDays.toString(), '-1');


    await assert.rejects(
      () =>
        service.createDependency(
          { auth: scoped },
          project.id,
          {
            predecessorActivityId: child.id,
            successorActivityId: root.id,
            dependencyType: 'FS',
            lagWorkDays: new Prisma.Decimal('0'),
          },
        ),
      (error: unknown) =>
        error instanceof UnprocessableEntityException &&
        (error.getResponse() as { code?: string }).code ===
          'ACTIVITY_DEPENDENCY_CYCLE',
    );

    await assert.rejects(() =>
      prisma.activityDependency.create({
        data: {
          projectId: project.id,
          predecessorActivityId: child.id,
          successorActivityId: root.id,
          dependencyType: 'SS',
          lagWorkDays: '0',
        },
      }),
    );

    await assert.rejects(
      () =>
        service.createActivity(
          { auth: scoped },
          project.id,
          {
            wbsId: wbs.id,
            workingCalendarId: calendar.id,
            activityCode: 'BAD-MILESTONE-' + suffix,
            activityName: 'Invalid Milestone',
            isMilestone: true,
            plannedDurationWorkDays: new Prisma.Decimal('1'),
            plannedStartDate: new Date('2026-10-09T00:00:00.000Z'),
            plannedFinishDate: new Date('2026-10-09T00:00:00.000Z'),
          },
        ),
      (error: unknown) =>
        error instanceof UnprocessableEntityException &&
        (error.getResponse() as { code?: string }).code ===
          'INVALID_MILESTONE_DURATION',
    );

    await assert.rejects(() =>
      prisma.activity.create({
        data: {
          companyId: company.id,
          projectId: project.id,
          wbsId: wbs.id,
          workingCalendarId: calendar.id,
          activityCode: 'DB-BAD-MILESTONE-' + suffix,
          activityName: 'DB Invalid Milestone',
          isMilestone: true,
          plannedDurationWorkDays: '1',
          plannedStartDate: new Date('2026-10-09T00:00:00.000Z'),
          plannedFinishDate: new Date('2026-10-09T00:00:00.000Z'),
        },
      }),
    );

    const milestone = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'M100-' + suffix,
        activityName: 'Inspection Milestone',
        isMilestone: true,
        plannedDurationWorkDays: new Prisma.Decimal('0'),
        plannedStartDate: new Date('2026-10-09T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-09T00:00:00.000Z'),
      },
    );
    assert.equal(milestone.isMilestone, true);

    const plannedAnalysis = await service.scheduleAnalysis(
      scoped,
      project.id,
      'planned',
    );
    const analysisById = new Map(
      plannedAnalysis.activities.map((row) => [row.id, row]),
    );
    assert.equal(
      analysisById.get(root.id)?.calculatedStartDate,
      '2026-10-01',
    );
    assert.equal(
      analysisById.get(child.id)?.calculatedStartDate,
      '2026-10-07',
    );
    assert.equal(
      analysisById.get(child.id)?.calculatedFinishDate,
      '2026-10-08',
    );
    assert.equal(
      analysisById.get(milestone.id)?.calculatedFinishDate,
      '2026-10-09',
    );
    assert.ok(
      plannedAnalysis.activities.some((row) => row.isCritical),
    );


    const concurrentCycleA = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'CYCLE-A-' + suffix,
        activityName: 'Concurrent Cycle A',
        plannedDurationWorkDays: new Prisma.Decimal('1'),
        plannedStartDate: new Date('2026-10-12T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-12T00:00:00.000Z'),
      },
    );
    const concurrentCycleB = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'CYCLE-B-' + suffix,
        activityName: 'Concurrent Cycle B',
        plannedDurationWorkDays: new Prisma.Decimal('1'),
        plannedStartDate: new Date('2026-10-12T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-12T00:00:00.000Z'),
      },
    );
    const concurrentCycleResults = await Promise.allSettled([
      prisma.activityDependency.create({
        data: {
          projectId: project.id,
          predecessorActivityId: concurrentCycleA.id,
          successorActivityId: concurrentCycleB.id,
          dependencyType: 'FS',
          lagWorkDays: '0',
        },
      }),
      prisma.activityDependency.create({
        data: {
          projectId: project.id,
          predecessorActivityId: concurrentCycleB.id,
          successorActivityId: concurrentCycleA.id,
          dependencyType: 'FS',
          lagWorkDays: '0',
        },
      }),
    ]);
    assert.equal(
      concurrentCycleResults.filter((result) => result.status === 'fulfilled')
        .length,
      1,
    );
    assert.equal(
      concurrentCycleResults.filter((result) => result.status === 'rejected')
        .length,
      1,
    );

    const milestoneConstraint = await prisma.$queryRaw<
      Array<{ convalidated: boolean }>
    >`
      SELECT convalidated
      FROM pg_constraint
      WHERE conname = 'activities_milestone_schedule_check'
    `;
    assert.equal(milestoneConstraint[0]?.convalidated, false);

    await assert.rejects(
      () =>
        service.createDependency(
          { auth: scoped },
          project.id,
          {
            predecessorActivityId: root.id,
            successorActivityId: root.id,
            dependencyType: 'FS',
            lagWorkDays: new Prisma.Decimal('0'),
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(
      () =>
        service.createDependency(
          { auth: scoped },
          project.id,
          {
            predecessorActivityId: root.id,
            successorActivityId: unassignedActivity.id,
            dependencyType: 'FS',
            lagWorkDays: new Prisma.Decimal('0'),
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    await assert.rejects(() =>
      prisma.activityDependency.create({
        data: {
          projectId: project.id,
          predecessorActivityId: root.id,
          successorActivityId: unassignedActivity.id,
          dependencyType: 'FS',
          lagWorkDays: '0',
        },
      }),
    );
    await assert.rejects(() =>
      prisma.$executeRawUnsafe(
        'INSERT INTO "activity_dependencies" ("project_id","predecessor_activity_id","successor_activity_id","dependency_type","lag_work_days") VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5)',
        project.id,
        root.id,
        child.id,
        'XX',
        0,
      ),
    );

    const archivedChild = await service.setActivityActive(
      { auth: scoped },
      child.id,
      false,
    );
    assert.equal(archivedChild.isActive, false);

    const unaffectedActivity = await service.createActivity(
      { auth: scoped },
      project.id,
      {
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'UNAFFECTED-' + suffix,
        activityName: 'Unaffected Activity',
        plannedDurationWorkDays: new Prisma.Decimal('1'),
        plannedStartDate: new Date('2026-10-13T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-13T00:00:00.000Z'),
      },
    );
    const unaffectedDependency = await service.createDependency(
      { auth: scoped },
      project.id,
      {
        predecessorActivityId: root.id,
        successorActivityId: unaffectedActivity.id,
        dependencyType: 'FS',
        lagWorkDays: new Prisma.Decimal('0'),
      },
    );
    assert.equal(unaffectedDependency.isActive, true);

    const archivedDependency = await service.setDependencyActive(
      { auth: scoped },
      dependency.id,
      false,
    );
    assert.equal(archivedDependency.isActive, false);

    const archivedCalendar = await service.setCalendarActive(
      { auth: scoped },
      projectCalendar.id,
      false,
    );
    assert.equal(archivedCalendar.isActive, false);

    const archivedType = await service.setActivityTypeActive(
      { auth: scoped },
      activityType.id,
      false,
    );
    assert.equal(archivedType.isActive, false);

    assert.equal(
      (await service.listCalendars(scoped)).some(
        (row) => row.projectId === unassignedProject.id,
      ),
      false,
    );
    assert.equal(
      (await service.listCalendars(scoped)).some(
        (row) => row.projectId === otherProject.id,
      ),
      false,
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: [
            'WORKING_CALENDAR',
            'ACTIVITY_TYPE',
            'ACTIVITY',
            'ACTIVITY_DEPENDENCY',
          ],
        },
      },
    });
    assert.ok(auditCount >= 8);

    const permissionCount = await prisma.permission.count({
      where: {
        permissionCode: {
          in: [
            'schedule.programme.view',
            'schedule.activity.create',
            'schedule.activity.edit',
            'schedule.activity.archive',
            'schedule.dependency.manage',
            'schedule.calendar.manage',
            'admin.activity_types.manage',
          ],
        },
      },
    });
    assert.equal(permissionCount, 7);
  } finally {
    await prisma.$disconnect();
  }
});
