import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../auth/session.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { AuditService } from '../audit/audit.service';
import { ApprovalService } from '../approval/approval.service';
import { NumberSequenceService } from '../administration/number-sequence.service';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { DocumentsService } from '../documents/documents.service';
import { DocumentTargetsService } from '../documents/document-targets.service';
import { LocalDocumentStorage } from '../documents/local-document-storage.service';
import { InventoryQuantityService } from './inventory-quantity.service';
import { StockCountService } from './stock-count.service';
import { MaterialIssueService } from './material-issue.service';
import { MaterialRequestService, MaterialRequestCreate } from './material-request.service';
export async function materialRequestFixture(db: PrismaService) {
    const suffix = randomUUID().slice(0, 8), company = await db.company.create({ data: { companyCode: 'MR-' + suffix, companyName: 'Synthetic request Company' } });
    const foreign = await db.company.create({ data: { companyCode: 'MRX-' + suffix, companyName: 'Synthetic foreign Company' } });
    const customer = await db.customer.create({ data: { companyId: company.id, customerCode: 'MR-C', customerName: 'Synthetic customer' } });
    const project = await db.project.create({ data: { companyId: company.id, customerId: customer.id, projectCode: 'MR-P', projectName: 'Synthetic site', contractValue: '0', contractCurrencyCode: 'THB', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-01-01') } });
    const unassigned = await db.project.create({ data: { companyId: company.id, customerId: customer.id, projectCode: 'MR-NO', projectName: 'Unassigned site', contractValue: '0', contractCurrencyCode: 'THB', plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-01-01') } });
    const sessions = new SessionService(db);
    const actor = async (label: string, codes: string[], member = true) => {
        const employee = await db.employee.create({ data: { companyId: company.id, employeeCode: label, employeeName: 'Synthetic ' + label } });
        const user = await db.user.create({ data: { companyId: company.id, employeeId: employee.id, email: label + '-' + suffix + '@example.invalid', displayName: label, passwordHash: 'synthetic-session-only' } });
        const role = await db.role.create({ data: { companyId: company.id, roleCode: label + '-' + suffix, roleName: label } });
        const permissions = await db.permission.findMany({ where: { permissionCode: { in: codes } } });
        if (permissions.length !== codes.length)
            throw new Error('Missing material request fixture permission definitions');
        await db.rolePermission.createMany({ data: permissions.map(p => ({ roleId: role.id, permissionId: p.id })) });
        await db.userRole.create({ data: { companyId: company.id, userId: user.id, roleId: role.id } });
        if (member)
            await db.projectMember.create({ data: { projectId: project.id, employeeId: employee.id, projectRole: label } });
        const session = await sessions.create(user.id), auth = await sessions.resolve(session.sessionToken);
        if (!auth)
            throw Error('Synthetic session failed');
        return { employee, user, role, session, auth };
    };
    const requestCodes = ['inventory.material_request.view', 'inventory.material_request.create', 'inventory.material_request.edit', 'inventory.material_request.link', 'inventory.material_request.acknowledge'];
    const store = await actor('Store', [...requestCodes, 'inventory.issue.view', 'inventory.issue.create', 'inventory.issue.edit', 'inventory.issue.submit', 'documents.document.view', 'documents.document.upload', 'documents.document.link', 'inventory.stock_count.view', 'inventory.stock_count.create', 'inventory.stock_count.submit']);
    const manager = await actor('Manager', ['inventory.stock_count.view', 'inventory.stock_count.approve', 'inventory.issue.view', 'inventory.issue.approve']);
    const foreman = await actor('Foreman', ['inventory.material_request.view']);
    const outsider = await actor('Outsider', requestCodes.concat('inventory.issue.view', 'documents.document.view'), false);
    const administrator = await actor('SYS_ADMIN', [], false);
    const documentOnly = await actor('DocumentOnly', ['documents.document.view']);
    const uom = await db.unitOfMeasure.create({ data: { companyId: company.id, uomCode: 'EA', uomName: 'Each', decimalPlaces: 4 } });
    const material = await db.material.create({ data: { companyId: company.id, materialCode: 'MR-M', materialName: 'Synthetic steel', defaultUomId: uom.id } });
    const warehouse = await db.warehouse.create({ data: { companyId: company.id, projectId: project.id, warehouseCode: 'MR-W', warehouseName: 'Synthetic site store', isSiteWarehouse: true } });
    const access = new ProjectAccessService(db, new ProjectScopeService(new AuthorizationService())), audit = new AuditService(db), quantities = new InventoryQuantityService(db), numbers = new NumberSequenceService(db);
    const documents = new DocumentsService(db, access, audit, new LocalDocumentStorage(), new DocumentPolicyService());
    const targets = new DocumentTargetsService(db, access, audit, documents);
    const service = new MaterialRequestService(db, access, audit, documents);
    const counts = new StockCountService(db, access, audit, quantities);
    const count = await counts.create({ auth: store.auth }, { projectId: project.id, warehouseId: warehouse.id, materialId: material.id, uomId: uom.id, countedAt: new Date(), actualQuantity: new Prisma.Decimal(20), evidenceReference: 'Synthetic initial physical count' });
    const submitted = await counts.submit({ auth: store.auth }, count.id, count.version);
    await counts.approve({ auth: manager.auth }, count.id, submitted.version, randomUUID());
    await db.numberSequence.create({ data: { companyId: company.id, entityType: 'MATERIAL_ISSUE', sequenceCode: 'MATERIAL_ISSUE', formatTemplate: 'MIYYMM-###', resetRule: 'MONTHLY' } });
    const workflow = await db.approvalWorkflow.create({ data: { companyId: company.id, workflowCode: 'MR-ISSUE', entityType: 'MATERIAL_ISSUE', workflowName: 'Synthetic existing issue approval', steps: { create: [{ stepNo: 1, stepName: 'Independent checker', requiredApprovals: 1, stepRoles: { create: [{ roleId: manager.role.id }] } }] } } });
    const issues = new MaterialIssueService(db, access, audit, new ApprovalService(db), numbers, quantities);
    const issue = async (quantity: string, post = true) => {
        const row = await issues.create({ auth: store.auth }, { projectId: project.id, warehouseId: warehouse.id, issueDate: new Date('2026-11-02T00:00:00Z'), issuedToEmployeeId: foreman.employee.id, lines: [{ materialId: material.id, uomId: uom.id, quantity: new Prisma.Decimal(quantity) }] });
        if (!post)
            return issues.get(store.auth, row.id);
        await issues.submit({ auth: store.auth }, row.id, workflow.workflowCode);
        await issues.approve({ auth: manager.auth }, row.id, randomUUID());
        return issues.get(store.auth, row.id);
    };
    const documentType = await db.documentType.create({ data: { companyId: company.id, documentTypeCode: 'SIGNED', documentTypeName: 'Synthetic signed receipt' } });
    const bytes = Buffer.from('%PDF-1.4\nSynthetic signed paper receipt evidence\n');
    const upload = async (requestId: string) => targets.upload({ auth: store.auth }, project.id, 'MATERIAL_REQUEST', requestId, documentType.id, { originalname: 'signed-receipt.pdf', mimetype: 'application/pdf', size: bytes.length, buffer: bytes });
    const input = (quantity = '10.0000'): MaterialRequestCreate => ({ requestKey: randomUUID(), projectId: project.id, warehouseId: warehouse.id, requesterEmployeeId: foreman.employee.id, requestDate: '2026-11-02', remarks: 'Oral Foreman request captured by Store', lines: [{ materialId: material.id, uomId: uom.id, requestedQuantity: quantity, wbsId: null, costCodeId: null, activityId: null, remarks: null }] });
    return { db, company, foreign, project, unassigned, store, manager, foreman, outsider, administrator, documentOnly, uom, material, warehouse, service, documents, targets, issues, issue, upload, input, bytes, sessions };
}
