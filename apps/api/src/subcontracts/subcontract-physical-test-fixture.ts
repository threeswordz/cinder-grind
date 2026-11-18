import { randomBytes, randomUUID } from 'node:crypto';
import { PasswordService } from '../auth/password.service';
import { PrismaService } from '../prisma/prisma.service';

// Disposable technical fixtures only; never an operator for a populated target.
export async function subcontractPhysicalFixture(db: PrismaService) {
  const suffix = randomUUID().slice(0, 8), password = randomBytes(32).toString('hex');
  const passwordHash = await new PasswordService().hash(password);
  const company = await db.company.create({ data: { companyCode: 'PA-' + suffix, companyName: 'Synthetic physical acceptance' } });
  const customer = await db.customer.create({ data: { companyId: company.id, customerCode: 'CUSTOMER', customerName: 'Synthetic customer' } });
  const project = await db.project.create({ data: { companyId: company.id, customerId: customer.id, projectCode: 'SITE', projectName: 'Physical work site',
    contractValue: '10000', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-12-31') } });
  async function grant(roleId: string, codes: string[]) {
    const rows = await db.permission.findMany({ where: { permissionCode: { in: codes } } });
    if (rows.length !== new Set(codes).size) throw Error('Physical fixture requires its complete migrated capability catalog');
    await db.rolePermission.createMany({ data: rows.map(row => ({ roleId, permissionId: row.id })), skipDuplicates: true });
  }
  async function actor(label: string, codes: string[], member = true, employeeLinked = true) {
    const employee = employeeLinked ? await db.employee.create({ data: { companyId: company.id, employeeCode: label, employeeName: 'Synthetic ' + label } }) : null;
    const user = await db.user.create({ data: { companyId: company.id, employeeId: employee?.id ?? null,
      email: label.toLowerCase() + '-' + suffix + '@example.invalid', displayName: label, passwordHash } });
    const role = await db.role.create({ data: { companyId: company.id, roleCode: label, roleName: label } });
    await grant(role.id, codes);
    await db.userRole.create({ data: { companyId: company.id, userId: user.id, roleId: role.id } });
    if (member && employee) await db.projectMember.create({ data: { projectId: project.id, employeeId: employee.id, projectRole: label } });
    return { user, employee, role, password };
  }
  const view = ['subcontracts.claim.view', 'subcontracts.physical.view', 'documents.document.view'];
  const maker = await actor('Khaimook', [...view, 'subcontracts.claim.create', 'subcontracts.claim.edit', 'subcontracts.claim.submit', 'subcontracts.claim.withdraw',
    'subcontracts.physical.edit', 'documents.document.upload', 'documents.document.link']);
  const ben = await actor('Ben', [...view, 'subcontracts.physical.configure', 'subcontracts.physical.decide', 'subcontracts.assessment.assess', 'subcontracts.assessment.view', 'subcontracts.assessment.reject']);
  const porn = await actor('Porn', [...view, 'subcontracts.assessment.view', 'subcontracts.certification.view', 'subcontracts.certification.create', 'subcontracts.certification.edit', 'subcontracts.certification.submit']);
  const nancy = await actor('Nancy', [...view, 'subcontracts.certification.view', 'subcontracts.certification.approve']);
  const outsider = await actor('Outsider', view, false);
  const technical = await actor('SYS_ADMIN', [...view, 'projects.access_all', 'subcontracts.physical.configure', 'subcontracts.physical.decide', 'subcontracts.assessment.assess'], false, false);
  const subcontractor = await db.subcontractor.create({ data: { companyId: company.id, subcontractorCode: 'SC', subcontractorName: 'Synthetic subcontractor' } });
  const agreement = await db.subcontractAgreement.create({ data: { companyId: company.id, projectId: project.id, subcontractorId: subcontractor.id,
    agreementNumber: 'SC-PA-' + suffix, originalValue: '10000.00', currencyCode: 'THB', scopeOfWork: 'Synthetic approved agreement scope',
    retentionRate: '5.00', approvalState: 'APPROVED', firstApprovedAt: new Date(), createdByUserId: maker.user.id } });
  const uom = await db.unitOfMeasure.create({ data: { companyId: company.id, uomCode: 'EA', uomName: 'Each', decimalPlaces: 4 } });
  const documentType = await db.documentType.create({ data: { companyId: company.id, documentTypeCode: 'WORK', documentTypeName: 'Physical work evidence' } });
  const workflow = await db.approvalWorkflow.create({ data: { companyId: company.id, entityType: 'SUBCONTRACT_CERTIFICATION', workflowCode: 'PA-CERT', workflowName: 'Independent Nancy certification decision',
    steps: { create: [{ stepNo: 1, stepName: 'Nancy', requiredApprovals: 1, stepRoles: { create: [{ roleId: nancy.role.id }] } }] } } });
  return { company, project, agreement, uom, documentType, workflow, maker, ben, porn, nancy, outsider, technical, grant };
}
