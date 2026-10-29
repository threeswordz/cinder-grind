import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { HrPrivateCrypto } from './hr-private-crypto';
import { HrService } from './hr.service';

/** Synthetic disposable fixtures only; never run against retained data. */
export async function hrFixture(db: PrismaService) {
  const suffix = randomUUID().slice(0,8);
  const company = await db.company.create({ data: { companyCode: 'HRA-' + suffix, companyName: 'Synthetic HR A' } });
  const other = await db.company.create({ data: { companyCode: 'HRB-' + suffix, companyName: 'Synthetic HR B' } });
  const hidden = await db.company.create({ data: { companyCode: 'HRC-' + suffix, companyName: 'Synthetic HR C' } });
  const sessions = new SessionService(db);
  const actor = async (companyId: string, label: string, codes: string[], site = false) => {
    const employee = site ? await db.employee.create({ data: { companyId, employeeCode: label + '-' + suffix, employeeName: 'Synthetic ' + label } }) : null;
    const user = await db.user.create({ data: { companyId, ...(employee ? { employeeId: employee.id } : {}),
      email: label.toLowerCase() + '-' + suffix + '@example.invalid', displayName: 'Synthetic ' + label, passwordHash: 'sessions-only-not-a-login' } });
    const role = await db.role.create({ data: { companyId, roleCode: label + '_' + suffix, roleName: label } });
    const permissions = await db.permission.findMany({ where: { permissionCode: { in: codes } } });
    if (permissions.length !== codes.length) throw new Error('Required migrated HR fixture capabilities are absent.');
    await db.userRole.create({ data: { companyId, userId: user.id, roleId: role.id } });
    await db.rolePermission.createMany({ data: permissions.map(p => ({ roleId: role.id, permissionId: p.id })) });
    const session = await sessions.create(user.id), auth = await sessions.resolve(session.sessionToken);
    if (!auth) throw new Error('Synthetic HR session failed.');
    return { auth, session, role, user, employee };
  };
  const admin = await actor(company.id, 'SYS_ADMIN', ['hr.access.manage']);
  const otherAdmin = await actor(other.id, 'SCOPE_ADMIN', ['hr.access.manage']);
  const hr = await actor(company.id, 'HR', ['hr.employment.view','hr.employment.manage','hr.identity.view','hr.identity.manage',
    'hr.bank.view','hr.bank.manage','master.employee.view','master.employee.manage','projects.project.view','projects.access_all']);
  const nancy = await actor(company.id, 'FINANCE_MANAGER', ['hr.employment.view','hr.identity.view','hr.bank.view']);
  const ben = await actor(company.id, 'MANAGEMENT', ['hr.employment.view']);
  const porn = await actor(company.id, 'FINANCE_OFFICER', ['hr.employment.view','hr.bank.view']);
  const pm = await actor(company.id, 'PM', ['hr.operational.view'], true);
  const store = await actor(company.id, 'STORE', ['hr.operational.view'], true);
  const foreman = await actor(company.id, 'FOREMAN', ['hr.operational.view'], true);
  const outsider = await actor(company.id, 'NO_HR', []);
  for (const target of [company,other]) {
    for (const [subject, categories] of [[hr,['employment','identity','bank']], [nancy,['employment','identity','bank']],
      [ben,['employment']], [porn,['employment','bank']]] as const) {
      for (const category of categories) await db.hrCompanyAccess.create({ data: { companyId: target.id, userId: subject.auth.userId,
        category, reasonCode: 'OWNER_APPROVED_SCOPE', updatedByUserId: target.id === company.id ? admin.auth.userId : otherAdmin.auth.userId } });
    }
  }
  const makeProject = async (companyId: string, code: string) => {
    const customer = await db.customer.create({ data: { companyId, customerCode: code + '-' + suffix, customerName: 'Synthetic customer' } });
    return db.project.create({ data: { companyId, customerId: customer.id, projectCode: code + '-' + suffix,
      projectName: 'Synthetic Project', contractValue: '0', contractCurrencyCode: 'THB',
      plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-01-01') } });
  };
  const project = await makeProject(company.id, 'SITE'), unassigned = await makeProject(company.id, 'UNASSIGNED'), foreignProject = await makeProject(other.id, 'FOREIGN');
  for (const site of [pm,store,foreman]) await db.projectMember.create({ data: { projectId: project.id, employeeId: site.employee!.id, projectRole: 'Synthetic site role' } });
  const legacy = await db.employee.create({ data: { companyId: company.id, employeeCode: 'Legacy-' + suffix,
    employeeName: 'Synthetic existing worker', jobTitle: 'Site worker', email: 'public-' + suffix + '@example.invalid', phone: 'public-contact' } });
  const legacyUser = await db.user.create({ data: { companyId: company.id, employeeId: legacy.id, email: 'legacy-' + suffix + '@example.invalid',
    displayName: 'Synthetic existing account', passwordHash: 'sessions-only-not-a-login' } });
  const legacyMember = await db.projectMember.create({ data: { projectId: project.id, employeeId: legacy.id, projectRole: 'Existing worker' } });
  const projects = new ProjectAccessService(db, new ProjectScopeService(new AuthorizationService()));
  const crypto = new HrPrivateCrypto(), audit = new AuditService(db), service = new HrService(db, audit, projects, crypto);
  const actors = { admin, otherAdmin, hr, nancy, ben, porn, pm, store, foreman, outsider };
  return { company, other, hidden, actors, project, unassigned, foreignProject, legacy, legacyUser, legacyMember, service, crypto, projects, sessions, suffix };
}

export function hrFacts(overrides: Record<string, unknown> = {}) {
  return { payBasis: 'DAILY', employmentForm: 'PERMANENT', siteKind: 'SITE', startDate: '2026-10-01',
    endDate: null, projectId: null, hiringApprovalReference: 'EXTERNAL_APPROVAL_VERIFIED_SYNTHETIC', reason: 'Synthetic recorded start', ...overrides };
}
