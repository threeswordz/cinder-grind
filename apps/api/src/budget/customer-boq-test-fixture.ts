import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { BudgetService } from './budget.service';
import { CustomerBoqDraft, CustomerBoqService } from './customer-boq.service';


// Disposable database fixture only; never imported by runtime modules.
export async function customerBoqFixture(db: PrismaService) {
  const suffix = randomUUID().slice(0, 8);
  const company = await db.company.create({ data: { companyCode: 'CBQ-' + suffix, companyName: 'Customer BOQ fixture' } });
  const customer = await db.customer.create({ data: { companyId: company.id, customerCode: 'C', customerName: 'Customer' } });
  const project = await db.project.create({ data: { companyId: company.id, customerId: customer.id, projectCode: 'P', projectName: 'Project', contractValue: '1000', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2026-12-31') } });
  const uom = await db.unitOfMeasure.create({ data: { companyId: company.id, uomCode: 'EA', uomName: 'Each', decimalPlaces: 0 } });
  const costCode=await db.costCode.create({data:{companyId:company.id,costCode:'CONCRETE',costName:'Concrete'}});
  const codes = ['budget.boq.view', 'budget.revision.view', 'budget.customer.view', 'budget.customer.manage', 'budget.customer.submit', 'budget.customer.approve'];
  for (const permissionCode of codes) await db.permission.upsert({ where: { permissionCode }, update: {}, create: { permissionCode, moduleCode: 'BUDGET' } });
  const role = await db.role.create({ data: { companyId: company.id, roleCode: 'COMMERCIAL', roleName: 'Commercial', rolePermissions: { create: codes.map((permissionCode) => ({ permission: { connect: { permissionCode } } })) } } });
  const actors: AuthenticatedUserContext[] = [];
  for (let i = 0; i < 4; i++) {
    const employee = await db.employee.create({ data: { companyId: company.id, employeeCode: 'E' + i, employeeName: 'Actor' } });
    const user = await db.user.create({ data: { companyId: company.id, employeeId: employee.id, email: suffix + '-' + i + '@example.invalid', displayName: 'Actor', passwordHash: 'not-a-login', userRoles: { create: { companyId: company.id, roleId: role.id } } } });
    if (i !== 3) await db.projectMember.create({ data: { projectId: project.id, employeeId: employee.id, projectRole: 'Commercial' } });
    actors.push({ sessionId: randomUUID(), userId: user.id, companyId: company.id, email: user.email, displayName: user.displayName, roleCodes: [role.roleCode], permissions: codes, csrfTokenHash: '' });
  }
  const [maker, checker, editor, outsider] = actors as [AuthenticatedUserContext, AuthenticatedUserContext, AuthenticatedUserContext, AuthenticatedUserContext];
  const access = new ProjectAccessService(db, new ProjectScopeService(new AuthorizationService()));
  const audit = new AuditService(db), approvals = new ApprovalService(db);
  const budget = new BudgetService(db, access, audit, approvals, new NumberSequenceService(db));
  const service = new CustomerBoqService(db, access, audit, approvals);
  async function workflow(entityType: string) {
    return db.approvalWorkflow.create({ data: { companyId: company.id, entityType, workflowCode: entityType, workflowName: entityType,
      steps: { create: { stepNo: 1, stepName: 'Checker', requiredApprovals: 1, stepRoles: { create: { roleId: role.id } } } } } });
  }
  await workflow('BUDGET_REVISION'); const wf = await workflow('CUSTOMER_BOQ');
  await db.numberSequence.create({ data: { companyId: company.id, entityType: 'BUDGET_REVISION', sequenceCode: 'BUDGET_REVISION', formatTemplate: 'CBYY-###', resetRule: 'YEARLY' } });
  const boq = await budget.createBoq({ auth: maker }, project.id, 'Source');
  const section = await budget.createSection({ auth: maker }, boq.id, { sectionCode: 'A', sectionName: 'Cost', sortOrder: 0 });
  await budget.createItem({ auth: maker }, boq.id, { sectionId: section.id, itemCode: 'A1', description: 'Approved cost', quantity: new Prisma.Decimal(10), uomId: uom.id, costCodeId:costCode.id, rate: new Prisma.Decimal(100), sortOrder: 0 });
  const draft = await budget.createRevisionDraft({ auth: maker }, project.id);
  await budget.submitRevision({ auth: maker }, draft.id, 'BUDGET_REVISION');
  const source = await budget.approveRevision({ auth: checker }, draft.id, 'Approved cost');
  const pending = await budget.createRevisionDraft({ auth: maker }, project.id);
  const sourceLine = (await db.budgetRevisionLine.findFirstOrThrow({ where: { budgetRevisionId: source.id } }));
  const lineKey = randomUUID();
  function input(rate = '120'): CustomerBoqDraft {
    return { sourceRevisionId: source.id, reason: 'Prepare customer offer', lines: [{ lineId: lineKey, description: 'Customer work', quantity: '10', uomId: uom.id, method: 'MANUAL', manualRate: rate, mappings: [{ sourceLineId: sourceLine.id, sharePercent: '100' }] }] };
  }
  return { db, company, project, uom, costCode, role, maker, checker, editor, outsider, access, audit, approvals, service, source, pending, sourceLine, input, wf };
}
