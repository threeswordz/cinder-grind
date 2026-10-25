import { randomUUID } from 'node:crypto';

// Invoked only on the real previous-release schema/client before the policy
// upgrade. Existing scope/approval/evidence triggers remain enabled throughout.
export async function seedLegacyCorrections(prisma, fixture) {
  const companyId = fixture.companyId;
  const projectId = fixture.projectId;
  const makerId = fixture.userId;
  const employee = await prisma.employee.create({ data: { companyId, employeeCode: 'LEGACY-CHECKER', employeeName: 'Legacy checker' } });
  const checker = await prisma.user.create({ data: { companyId, employeeId: employee.id, email: randomUUID() + '@example.invalid', displayName: 'Legacy checker', passwordHash: 'x' } });
  await prisma.projectMember.create({ data: { projectId, employeeId: employee.id, projectRole: 'Legacy approver' } });
  const costCode = await prisma.costCode.create({ data: { companyId, costCode: 'LEGACY-COST', costName: 'Legacy source dimension' } });
  const makerRole = await prisma.role.create({ data: { companyId, roleCode: 'LEGACY-MAKER', roleName: 'Disposable legacy maker' } });
  for (const permissionCode of ['projects.access_all','admin.company.manage','cost.direct_posting.create','cost.direct_posting.submit','cost.variation.create','cost.variation.submit']) {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { permissionCode } });
    await prisma.rolePermission.create({ data: { roleId: makerRole.id, permissionId: permission.id } });
  }
  await prisma.userRole.create({ data: { companyId, userId: makerId, roleId: makerRole.id } });
  const output = { checkerId: checker.id, costCodeId: costCode.id };
  for (const [model, entityType, permission, rowData, key] of [
    ['directCostPosting','DIRECT_COST_POSTING','cost.direct_posting.approve', {
      postingDate: new Date('2026-10-03'), description: 'Legacy Direct Cost', amount: '88.75', costCodeId: costCode.id,
    }, 'directCost'],
    ['projectVariation','PROJECT_VARIATION','cost.variation.approve', {
      variationNumber: 'LEGACY-PV-001', description: 'Legacy Project Variation', reason: 'Legacy source', valueDelta: '25.50',
    }, 'projectVariation'],
  ]) {
    const row = await prisma[model].create({ data: { companyId, projectId, currencyCode: 'SGD',
      createKey: randomUUID(), createPayloadHash: 'a'.repeat(64), createdByUserId: makerId, ...rowData } });
    const role = await prisma.role.create({ data: { companyId, roleCode: 'LEGACY-' + key.toUpperCase(), roleName: 'Legacy checker role' } });
    const requiredPermission = await prisma.permission.findUniqueOrThrow({ where: { permissionCode: permission } });
    await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: requiredPermission.id } });
    await prisma.userRole.create({ data: { companyId, userId: checker.id, roleId: role.id } });
    const workflow = await prisma.approvalWorkflow.create({ data: { companyId, workflowCode: 'LEGACY-' + key.toUpperCase(), entityType, workflowName: 'Legacy approval' } });
    const step = await prisma.approvalStep.create({ data: { approvalWorkflowId: workflow.id, stepNo: 1, stepName: 'Approve legacy source', requiredApprovals: 1 } });
    await prisma.approvalStepRole.create({ data: { approvalStepId: step.id, roleId: role.id } });
    const instance = await prisma.approvalInstance.create({ data: { companyId, approvalWorkflowId: workflow.id, entityType, entityId: row.id, currentStepNo: 1, approvalState: 'SUBMITTED' } });
    await prisma[model].update({ where: { id: row.id }, data: { state: 'SUBMITTED', approvalInstanceId: instance.id, submittedByUserId: makerId, submittedAt: new Date() } });
    const decision = await prisma.approvalAction.create({ data: { approvalInstanceId: instance.id, approvalStepId: step.id, action: 'APPROVE', actionByUserId: checker.id, comment: 'Genuine previous-release approval' } });
    await prisma.approvalInstance.update({ where: { id: instance.id }, data: { approvalState: 'APPROVED', completedAt: decision.actionAt } });
    await prisma[model].update({ where: { id: row.id }, data: { state: 'APPROVED', approvedByUserId: checker.id, approvedAt: decision.actionAt, decidedAt: decision.actionAt } });
    output[key + 'Id'] = row.id;
    output[key + 'Role'] = role.roleCode;
    output[key + 'Workflow'] = workflow.workflowCode;
  }
  return output;
}
