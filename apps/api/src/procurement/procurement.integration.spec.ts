import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { NumberSequenceService } from '../administration/number-sequence.service';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProcurementService } from './procurement.service';

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
      'procurement.pr.view',
      'procurement.pr.manage',
      'procurement.pr.submit',
      'procurement.pr.approve',
      'procurement.pr.cancel',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.3-B Purchase Requests preserve demand, approval and retained history', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'PR-' + suffix,
        companyName: 'Procurement Test ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'PR-C-' + suffix,
        customerName: 'Procurement Customer',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PR-M-' + suffix,
        employeeName: 'Procurement Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PR-CHECK-' + suffix,
        employeeName: 'Procurement Checker',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PR-OUT-' + suffix,
        employeeName: 'Unassigned User',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'pr-maker-' + suffix + '@example.com',
        displayName: 'Procurement Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'pr-checker-' + suffix + '@example.com',
        displayName: 'Procurement Checker',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'pr-outsider-' + suffix + '@example.com',
        displayName: 'Unassigned User',
        passwordHash: 'x',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'PR-P-' + suffix,
        projectName: 'Procurement Project',
        customerId: customer.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'PR-O-' + suffix,
        projectName: 'Other Project',
        customerId: customer.id,
        contractValue: '500000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          employeeId: makerEmployee.id,
          projectRole: 'Procurement Maker',
        },
        {
          projectId: project.id,
          employeeId: checkerEmployee.id,
          projectRole: 'Procurement Checker',
        },
      ],
    });

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: '01',
        wbsName: 'Groundworks',
      },
    });
    const otherWbs = await prisma.wbsElement.create({
      data: {
        projectId: otherProject.id,
        wbsCode: '01',
        wbsName: 'Other Project WBS',
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'MAT-' + suffix,
        costName: 'Materials',
      },
    });
    const uom = await prisma.unitOfMeasure.create({
      data: {
        companyId: company.id,
        uomCode: 'EA-' + suffix,
        uomName: 'Each',
        decimalPlaces: 2,
      },
    });
    const material = await prisma.material.create({
      data: {
        companyId: company.id,
        materialCode: 'STEEL-' + suffix,
        materialName: 'Reinforcement steel',
        defaultUomId: uom.id,
      },
    });
    const calendar = await prisma.workingCalendar.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        calendarName: 'PR Calendar ' + suffix,
        timezoneName: 'Asia/Singapore',
        isDefault: true,
      },
    });
    const activity = await prisma.activity.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        wbsId: wbs.id,
        workingCalendarId: calendar.id,
        activityCode: 'ACT-' + suffix,
        activityName: 'Install reinforcement',
        plannedDurationWorkDays: '5',
        plannedStartDate: new Date('2026-10-05T00:00:00.000Z'),
        plannedFinishDate: new Date('2026-10-09T00:00:00.000Z'),
      },
    });

    await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'PURCHASE_REQUEST',
        sequenceCode: 'PURCHASE_REQUEST',
        formatTemplate: 'PRYYMM-###',
        resetRule: 'MONTHLY',
      },
    });

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PR_APPROVER_' + suffix,
        roleName: 'PR Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PR_' + suffix,
        entityType: 'PURCHASE_REQUEST',
        workflowName: 'Purchase Request Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Procurement Approval',
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
    const service = new ProcurementService(
      prisma,
      access,
      new AuditService(prisma),
      new ApprovalService(prisma),
      new NumberSequenceService(prisma),
    );
    const makerAuth = auth(company.id, maker.id, ['PR_MAKER']);
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);
    const outsiderAuth = auth(company.id, outsider.id, ['PR_OUTSIDER']);

    const draft = await service.createRequest(
      { auth: makerAuth },
      project.id,
      'Site reinforcement demand',
    );
    assert.equal(draft.lifecycleState, 'DRAFT');
    assert.match(draft.prNumber, /^PR\d{4}-\d{3}$/);

    const materialLine = await service.createLine(
      { auth: makerAuth },
      draft.id,
      {
        lineType: 'MATERIAL',
        materialId: material.id,
        quantity: new Prisma.Decimal('25.5'),
        uomId: uom.id,
        wbsId: wbs.id,
        costCodeId: costCode.id,
        activityId: activity.id,
        requiredOnSite: new Date('2026-10-04T00:00:00.000Z'),
      },
    );
    assert.equal(materialLine.lineNo, 1);
    assert.equal(materialLine.materialCodeSnapshot, material.materialCode);
    assert.equal(materialLine.description, material.materialName);

    const serviceLine = await service.createLine(
      { auth: makerAuth },
      draft.id,
      {
        lineType: 'SERVICE',
        materialId: null,
        description: 'Mobile crane service',
        quantity: new Prisma.Decimal('2'),
        uomId: uom.id,
        wbsId: null,
        costCodeId: costCode.id,
        activityId: null,
        requiredOnSite: new Date('2026-10-06T00:00:00.000Z'),
      },
    );
    assert.equal(serviceLine.lineNo, 2);
    assert.equal(serviceLine.materialId, null);

    await assert.rejects(
      () =>
        service.createLine(
          { auth: makerAuth },
          draft.id,
          {
            lineType: 'SERVICE',
            description: 'Wrong Project allocation',
            quantity: new Prisma.Decimal('1'),
            uomId: uom.id,
            wbsId: otherWbs.id,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const beforeSubmitActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });

    const submitted = await service.submitRequest(
      { auth: makerAuth },
      draft.id,
      workflow.workflowCode,
    );
    assert.equal(submitted.lifecycleState, 'SUBMITTED');

    await assert.rejects(
      () =>
        service.updateRequest(
          { auth: makerAuth },
          draft.id,
          'Must remain immutable after submission',
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () =>
        service.updateLine(
          { auth: makerAuth },
          materialLine.id,
          { quantity: new Prisma.Decimal('99') },
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () =>
        service.approveRequest(
          { auth: makerAuth },
          draft.id,
          'Maker cannot self-approve.',
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const rejected = await service.rejectRequest(
      { auth: checkerAuth },
      draft.id,
      'Revise the demand.',
    );
    assert.equal(rejected.lifecycleState, 'REJECTED');
    const rejectedDetail = await service.getRequest(makerAuth, draft.id);
    assert.equal(rejectedDetail.approvalInstance?.actions.length, 1);
    assert.equal(
      rejectedDetail.approvalInstance?.actions[0]?.action,
      'REJECT',
    );
    assert.equal(
      rejectedDetail.approvalInstance?.actions[0]?.comment,
      'Revise the demand.',
    );
    assert.equal(
      rejectedDetail.approvalInstance?.actions[0]?.actionByUser.id,
      checker.id,
    );

    await prisma.material.update({
      where: { id: material.id },
      data: {
        materialCode: 'STEEL-RENAMED-' + suffix,
        materialName: 'Renamed reinforcement steel',
      },
    });
    const immutableMaterialHistory = await service.getRequest(
      makerAuth,
      draft.id,
    );
    assert.equal(
      immutableMaterialHistory.lines[0]?.materialCodeSnapshot,
      'STEEL-' + suffix,
    );
    assert.equal(
      immutableMaterialHistory.lines[0]?.description,
      'Reinforcement steel',
    );

    const afterRejectActivity = await prisma.activity.findUniqueOrThrow({
      where: { id: activity.id },
    });
    assert.equal(
      afterRejectActivity.plannedStartDate.toISOString(),
      beforeSubmitActivity.plannedStartDate.toISOString(),
    );
    assert.equal(
      afterRejectActivity.plannedFinishDate.toISOString(),
      beforeSubmitActivity.plannedFinishDate.toISOString(),
    );

    const copied = await service.copyRejected(
      { auth: makerAuth },
      draft.id,
    );
    assert.equal(copied.lifecycleState, 'DRAFT');
    assert.notEqual(copied.prNumber, draft.prNumber);
    assert.equal(copied.sourceRequestId, draft.id);
    const copiedDetail = await service.getRequest(makerAuth, copied.id);
    assert.equal(copiedDetail.lines.length, 2);
    assert.equal(copiedDetail.sourceRequest?.id, draft.id);
    assert.equal(
      copiedDetail.lines[0]?.materialCodeSnapshot,
      'STEEL-' + suffix,
    );
    assert.equal(copiedDetail.lines[0]?.description, 'Reinforcement steel');

    const cancelledDraft = await service.cancelRequest(
      { auth: makerAuth },
      copied.id,
    );
    assert.equal(cancelledDraft.lifecycleState, 'CANCELLED');
    await assert.rejects(
      () => prisma.purchaseRequest.delete({ where: { id: copied.id } }),
      'Cancelled Purchase Request must remain retained history.',
    );

    const approvedDraft = await service.createRequest(
      { auth: makerAuth },
      project.id,
      'Approval candidate',
    );
    await service.createLine(
      { auth: makerAuth },
      approvedDraft.id,
      {
        lineType: 'SERVICE',
        description: 'Survey service',
        quantity: new Prisma.Decimal('1'),
        uomId: uom.id,
        requiredOnSite: new Date('2026-10-07T00:00:00.000Z'),
      },
    );
    await service.submitRequest(
      { auth: makerAuth },
      approvedDraft.id,
      workflow.workflowCode,
    );
    const approved = await service.approveRequest(
      { auth: checkerAuth },
      approvedDraft.id,
      'Approved.',
    );
    assert.equal(approved.lifecycleState, 'APPROVED');

    const cancelledApproved = await service.cancelRequest(
      { auth: makerAuth },
      approvedDraft.id,
    );
    assert.equal(cancelledApproved.lifecycleState, 'CANCELLED');
    const retainedApproval = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: approved.approvalInstance!.id },
    });
    assert.equal(retainedApproval.approvalState, 'APPROVED');

    const multiApprovalWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PR_MULTI_' + suffix,
        entityType: 'PURCHASE_REQUEST',
        workflowName: 'Purchase Request Multi Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Two-person Procurement Approval',
              requiredApprovals: 2,
              stepRoles: {
                create: [{ roleId: approverRole.id }],
              },
            },
          ],
        },
      },
    });
    const partialDraft = await service.createRequest(
      { auth: makerAuth },
      project.id,
      'Partial approval cancellation candidate',
    );
    await service.createLine(
      { auth: makerAuth },
      partialDraft.id,
      {
        lineType: 'SERVICE',
        description: 'Temporary access service',
        quantity: new Prisma.Decimal('1'),
        uomId: uom.id,
      },
    );
    await service.submitRequest(
      { auth: makerAuth },
      partialDraft.id,
      multiApprovalWorkflow.workflowCode,
    );
    const partiallyApproved = await service.approveRequest(
      { auth: checkerAuth },
      partialDraft.id,
      'First of two approvals.',
    );
    assert.equal(partiallyApproved.lifecycleState, 'SUBMITTED');
    const cancelledAfterPartialApproval = await service.cancelRequest(
      { auth: checkerAuth },
      partialDraft.id,
    );
    assert.equal(cancelledAfterPartialApproval.lifecycleState, 'CANCELLED');
    const partialActions = await prisma.approvalAction.findMany({
      where: {
        approvalInstanceId: partiallyApproved.approvalInstance!.id,
        actionByUserId: checker.id,
      },
      orderBy: { actionAt: 'asc' },
      select: { action: true },
    });
    assert.deepEqual(
      partialActions.map((action) => action.action),
      ['APPROVE', 'CANCEL'],
    );

    await assert.rejects(
      () => service.listRequests(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        prisma.purchaseRequest.update({
          where: { id: draft.id },
          data: { prNumber: 'PR9999-999' },
        }),
      'Purchase Request business identity must be immutable.',
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: ['PURCHASE_REQUEST', 'PURCHASE_REQUEST_LINE'],
        },
      },
    });
    assert.ok(auditCount >= 10);
  } finally {
    await prisma.$disconnect();
  }
});
