import { randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from '../auth/password.service';

// Disposable test setup only; never an operator for the populated Mac prototype.
export async function siteIssueFixture(db: PrismaService) {
  const token = randomUUID().slice(0, 8), password = randomBytes(32).toString('hex');
  const hash = await new PasswordService().hash(password);
  const company = await db.company.create({ data: { companyCode: 'FM3-' + token, companyName: 'FM03 synthetic' } });
  const foreignCompany = await db.company.create({ data: { companyCode: 'FM3-F-' + token, companyName: 'FM03 foreign synthetic' } });
  async function project(companyId: string, code: string) {
    const customer = await db.customer.create({ data: { companyId, customerCode: code, customerName: 'Synthetic customer' } });
    return db.project.create({ data: { companyId, customerId: customer.id, projectCode: code, projectName: code,
      contractValue: '0', plannedStartDate: new Date('2026-11-01'), plannedCompletionDate: new Date('2027-01-01') } });
  }
  const assigned = await project(company.id, 'FM3-A'), unassigned = await project(company.id, 'FM3-B');
  const foreign = await project(foreignCompany.id, 'FM3-F');
  const permissions = {
    REPORTER: ['site.issue.view', 'site.issue.report', 'site.issue.verify', 'site.daily_report.view'],
    OWNER: ['site.issue.view', 'site.issue.follow_up', 'site.issue.close'],
    MANAGER: ['site.issue.view', 'site.issue.escalation.view'],
    CONFIG: ['site.issue.routing.manage'],
    OTHER: ['site.issue.view', 'site.issue.report', 'site.issue.verify'],
    OTHER_OWNER: ['site.issue.view', 'site.issue.follow_up', 'site.issue.close'],
    OUTSIDER: ['site.issue.view', 'site.issue.report', 'site.issue.verify'],
  };
  const actors = {} as Record<keyof typeof permissions, {
    userId: string; roleId: string; employeeId: string; email: string; password: string; permissions: string[];
  }>;
  for (const key of Object.keys(permissions) as Array<keyof typeof permissions>) {
    const employee = await db.employee.create({ data: { companyId: company.id, employeeCode: key, employeeName: 'FM03 ' + key } });
    const user = await db.user.create({ data: { companyId: company.id, employeeId: employee.id,
      email: 'fm3-' + token + '-' + key.toLowerCase() + '@example.invalid', passwordHash: hash, displayName: 'FM03 ' + key } });
    const role = await db.role.create({ data: { companyId: company.id, roleCode: key === 'CONFIG' ? 'SYS_ADMIN' : 'FM3_' + key,
      roleName: 'FM03 ' + key } });
    const rights = ['projects.project.view', ...permissions[key]];
    const catalog = await db.permission.findMany({ where: { permissionCode: { in: rights } } });
    if (catalog.length !== rights.length) throw new Error('FM03 test catalogue incomplete');
    await db.rolePermission.createMany({ data: catalog.map(p => ({ roleId: role.id, permissionId: p.id })) });
    await db.userRole.create({ data: { companyId: company.id, userId: user.id, roleId: role.id } });
    if (key !== 'OUTSIDER') await db.projectMember.create({ data: { projectId: assigned.id, employeeId: employee.id, projectRole: key } });
    actors[key] = { userId: user.id, employeeId: employee.id, roleId: role.id, email: user.email, password, permissions: rights };
  }
  const report = await db.dailySiteReport.create({ data: { companyId: company.id, projectId: assigned.id,
    reportDate: new Date('2026-11-14'), createdByUserId: actors.REPORTER.userId, generalRemarks: 'Retained report',
    issues: { create: { issueText: 'Original report observation remains unchanged' } } }, include: { issues: true } });
  const wbs = await db.wbsElement.create({ data: { projectId: assigned.id, wbsCode: 'FM3', wbsName: 'Synthetic work' } });
  const calendar = await db.workingCalendar.create({ data: { companyId: company.id, projectId: assigned.id,
    calendarName: 'FM03 calendar', timezoneName: 'Asia/Bangkok' } });
  const activity = await db.activity.create({ data: { companyId: company.id, projectId: assigned.id, wbsId: wbs.id,
    workingCalendarId: calendar.id, activityCode: 'FM3-A', activityName: 'Synthetic work',
    plannedDurationWorkDays: '1', plannedStartDate: new Date('2026-11-14'), plannedFinishDate: new Date('2026-11-14') } });
  return { company, assigned, unassigned, foreign, actors, report, activity,
    input: (change: Record<string, unknown> = {}) => ({ requestKey: randomUUID(), projectId: assigned.id,
      reportId: report.id, activityId: activity.id, description: 'FM03 synthetic site observation', category: 'GENERAL',
      affectsCostOrDelivery: false, workStopped: false, deliveryDelayRisk: false, ...change }) };
}
