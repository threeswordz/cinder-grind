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
import { CostControlService } from '../cost-control/cost-control.service';
import { BudgetService } from './budget.service';

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
      'budget.boq.view',
      'budget.boq.manage',
      'budget.revision.view',
      'budget.revision.submit',
      'budget.revision.approve',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.3-A BOQ/Budget preserves draft snapshots, approval history and reporting dimensions', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'BUD-' + suffix,
        companyName: 'Budget Test ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'BUD-C-' + suffix,
        customerName: 'Budget Customer',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'BUD-M-' + suffix,
        employeeName: 'Quantity Surveyor',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'BUD-CHECK-' + suffix,
        employeeName: 'Commercial Manager',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'budget-maker-' + suffix + '@example.com',
        displayName: 'Quantity Surveyor',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'budget-checker-' + suffix + '@example.com',
        displayName: 'Commercial Manager',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'BUD-P-' + suffix,
        projectName: 'Budget Project',
        customerId: customer.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    const otherProject = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'BUD-O-' + suffix,
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
          projectRole: 'Quantity Surveyor',
        },
        {
          projectId: project.id,
          employeeId: checkerEmployee.id,
          projectRole: 'Commercial Manager',
        },
      ],
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: otherProject.id,
          employeeId: makerEmployee.id,
          projectRole: 'Quantity Surveyor',
        },
        {
          projectId: otherProject.id,
          employeeId: checkerEmployee.id,
          projectRole: 'Commercial Manager',
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
        wbsName: 'Other Groundworks',
      },
    });
    const costCode = await prisma.costCode.create({
      data: {
        companyId: company.id,
        costCode: 'CONC-' + suffix,
        costName: 'Concrete',
      },
    });
    const uom = await prisma.unitOfMeasure.create({
      data: {
        companyId: company.id,
        uomCode: 'M3-' + suffix,
        uomName: 'Cubic metre',
        decimalPlaces: 2,
      },
    });
    await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'BUDGET_REVISION',
        sequenceCode: 'BUDGET_REVISION',
        formatTemplate: 'BRYY-###',
        resetRule: 'YEARLY',
      },
    });

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'BUDGET_APPROVER_' + suffix,
        roleName: 'Budget Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'BUDGET_' + suffix,
        entityType: 'BUDGET_REVISION',
        workflowName: 'Budget Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Commercial Approval',
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
    const service = new BudgetService(
      prisma,
      access,
      new AuditService(prisma),
      new ApprovalService(prisma),
      new NumberSequenceService(prisma),
    );
    const makerAuth = auth(company.id, maker.id, ['BUDGET_MAKER']);
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);

    const boq = await service.createBoq(
      { auth: makerAuth },
      project.id,
      'Main Contract BOQ',
    );
    assert.equal(boq.projectId, project.id);
    await assert.rejects(
      () =>
        service.createBoq(
          { auth: makerAuth },
          project.id,
          'Duplicate BOQ',
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const section = await service.createSection(
      { auth: makerAuth },
      boq.id,
      {
        sectionCode: 'A',
        sectionName: 'Groundworks',
        description: null,
        sortOrder: 10,
      },
    );

    const item = await service.createItem(
      { auth: makerAuth },
      boq.id,
      {
        sectionId: section.id,
        itemCode: 'A001',
        description: 'Blinding concrete',
        quantity: new Prisma.Decimal('10'),
        uomId: uom.id,
        rate: new Prisma.Decimal('25'),
        wbsId: wbs.id,
        costCodeId: costCode.id,
        sortOrder: 10,
      },
    );
    assert.equal(item.amount.toString(), '250');

    await assert.rejects(
      () =>
        service.createItem(
          { auth: makerAuth },
          boq.id,
          {
            sectionId: section.id,
            itemCode: 'A002',
            description: 'Wrong Project allocation',
            quantity: new Prisma.Decimal('1'),
            uomId: uom.id,
            rate: new Prisma.Decimal('1'),
            wbsId: otherWbs.id,
            costCodeId: null,
            sortOrder: 20,
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const draft1 = await service.createRevisionDraft(
      { auth: makerAuth },
      project.id,
      'Original Budget',
    );
    assert.equal(draft1.lifecycleState, 'DRAFT');
    assert.equal(draft1.revisionNo, 1);
    assert.equal(draft1.lineCount, 1);
    assert.match(draft1.revisionNumber, /^BR26-\d{3}$/);

    await service.updateItem(
      { auth: makerAuth },
      item.id,
      { rate: new Prisma.Decimal('30') },
    );
    const immutableDraft = await service.getRevision(
      makerAuth,
      draft1.id,
    );
    assert.equal(immutableDraft.lines[0]?.amount.toString(), '250');

    const submitted1 = await service.submitRevision(
      { auth: makerAuth },
      draft1.id,
      workflow.workflowCode,
    );
    assert.equal(
      submitted1.approvalInstance?.approvalState,
      'SUBMITTED',
    );

    await assert.rejects(
      () =>
        service.approveRevision(
          { auth: makerAuth },
          draft1.id,
          'Maker must not self-approve.',
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const approved1 = await service.approveRevision(
      { auth: checkerAuth },
      draft1.id,
      'Approved Original Budget.',
    );
    assert.equal(
      approved1.approvalInstance?.approvalState,
      'APPROVED',
    );
    assert.equal(approved1.isOriginal, true);
    assert.equal(approved1.isCurrent, true);

    const originalSummary = await service.summary(
      makerAuth,
      project.id,
    );
    assert.equal(originalSummary.original?.total.toString(), '250');
    assert.equal(originalSummary.current?.total.toString(), '250');
    assert.equal(
      originalSummary.current?.byWbs[0]?.wbsId,
      wbs.id,
    );
    assert.equal(
      originalSummary.current?.byCostCode[0]?.costCodeId,
      costCode.id,
    );

    await assert.rejects(
      () =>
        prisma.budgetRevisionLine.update({
          where: { id: approved1.lines[0]!.id },
          data: { amount: '999' },
        }),
      'Budget Revision lines must remain immutable',
    );
    await assert.rejects(
      () =>
        prisma.budgetRevisionLine.delete({
          where: { id: approved1.lines[0]!.id },
        }),
      'Budget Revision lines must not be physically deleted',
    );

    const draft2 = await service.createRevisionDraft(
      { auth: makerAuth },
      project.id,
      'Revised Budget',
    );
    assert.equal(draft2.revisionNo, 2);
    await service.submitRevision(
      { auth: makerAuth },
      draft2.id,
      workflow.workflowCode,
    );
    const approved2 = await service.approveRevision(
      { auth: checkerAuth },
      draft2.id,
      'Approved Revised Budget.',
    );
    assert.equal(approved2.isOriginal, false);
    assert.equal(approved2.isCurrent, true);

    const revisedSummary = await service.summary(
      makerAuth,
      project.id,
    );
    assert.equal(revisedSummary.original?.total.toString(), '250');
    assert.equal(revisedSummary.current?.total.toString(), '300');

    await service.updateItem(
      { auth: makerAuth },
      item.id,
      { rate: new Prisma.Decimal('40') },
    );
    const draft3 = await service.createRevisionDraft(
      { auth: makerAuth },
      project.id,
      'Rejected candidate',
    );
    await service.submitRevision(
      { auth: makerAuth },
      draft3.id,
      workflow.workflowCode,
    );
    const rejected3 = await service.rejectRevision(
      { auth: checkerAuth },
      draft3.id,
      'Do not accept this increase.',
    );
    assert.equal(
      rejected3.approvalInstance?.approvalState,
      'REJECTED',
    );
    assert.equal(rejected3.isCurrent, false);

    const approvedBudget = await service.approvedBudget(
      makerAuth,
      project.id,
    );
    assert.equal(approvedBudget?.id, approved2.id);
    assert.equal(approvedBudget?.lines[0]?.amount.toString(), '300');

    const revisions = await service.listRevisions(
      makerAuth,
      project.id,
    );
    assert.equal(revisions.length, 3);
    assert.equal(revisions.find((row) => row.id === draft1.id)?.isOriginal, true);
    assert.equal(revisions.find((row) => row.id === draft2.id)?.isCurrent, true);
    assert.equal(
      revisions.find((row) => row.id === draft3.id)?.lifecycleState,
      'REJECTED',
    );

    await assert.rejects(
      () =>
        prisma.budgetRevision.delete({
          where: { id: approved2.id },
        }),
      'Budget Revision history must not be physically deleted',
    );

    const otherBoq = await service.createBoq(
      { auth: makerAuth },
      otherProject.id,
      'Out-of-order Approval BOQ',
    );
    const otherSection = await service.createSection(
      { auth: makerAuth },
      otherBoq.id,
      {
        sectionCode: 'B',
        sectionName: 'Out-of-order Budget',
        description: null,
        sortOrder: 10,
      },
    );
    const otherItem = await service.createItem(
      { auth: makerAuth },
      otherBoq.id,
      {
        sectionId: otherSection.id,
        itemCode: 'B001',
        description: 'Approval-order test item',
        quantity: new Prisma.Decimal('1'),
        uomId: uom.id,
        rate: new Prisma.Decimal('100'),
        wbsId: otherWbs.id,
        costCodeId: costCode.id,
        sortOrder: 10,
      },
    );
    const olderRevision = await service.createRevisionDraft(
      { auth: makerAuth },
      otherProject.id,
      'Revision 1 awaiting approval',
    );
    await service.updateItem(
      { auth: makerAuth },
      otherItem.id,
      { rate: new Prisma.Decimal('200') },
    );
    const firstApprovedRevision = await service.createRevisionDraft(
      { auth: makerAuth },
      otherProject.id,
      'Revision 2 approved first',
    );
    await service.submitRevision(
      { auth: makerAuth },
      olderRevision.id,
      workflow.workflowCode,
    );
    await service.submitRevision(
      { auth: makerAuth },
      firstApprovedRevision.id,
      workflow.workflowCode,
    );

    const approvedSecond = await service.approveRevision(
      { auth: checkerAuth },
      firstApprovedRevision.id,
      'Approve Revision 2 first.',
    );
    const approvedOlder = await service.approveRevision(
      { auth: checkerAuth },
      olderRevision.id,
      'Approve Revision 1 later.',
    );

    await prisma.approvalInstance.update({
      where: { id: approvedSecond.approvalInstance!.id },
      data: { completedAt: new Date('2026-10-01T09:00:00.000Z') },
    });
    await prisma.approvalInstance.update({
      where: { id: approvedOlder.approvalInstance!.id },
      data: { completedAt: new Date('2026-10-01T10:00:00.000Z') },
    });

    const approvalOrderRevisions = await service.listRevisions(
      makerAuth,
      otherProject.id,
    );
    assert.equal(
      approvalOrderRevisions.find(
        (row) => row.id === firstApprovedRevision.id,
      )?.isOriginal,
      true,
      'The first actually approved revision must remain Original Budget.',
    );
    assert.equal(
      approvalOrderRevisions.find((row) => row.id === olderRevision.id)
        ?.isOriginal,
      false,
      'A lower revision number approved later must not replace Original Budget.',
    );
    assert.equal(
      approvalOrderRevisions.find(
        (row) => row.id === firstApprovedRevision.id,
      )?.isCurrent,
      true,
      'The highest approved revision remains Current Revised Budget.',
    );

    const approvalOrderSummary = await service.summary(
      makerAuth,
      otherProject.id,
    );
    assert.equal(
      approvalOrderSummary.original?.id,
      firstApprovedRevision.id,
    );
    assert.equal(
      approvalOrderSummary.original?.total.toString(),
      '200',
    );
    assert.equal(
      approvalOrderSummary.current?.id,
      firstApprovedRevision.id,
    );

    const auditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: ['BOQ', 'BOQ_SECTION', 'BOQ_ITEM', 'BUDGET_REVISION'],
        },
      },
    });
    assert.ok(auditCount >= 12);
    assert.equal(approved1.currencyCode, 'SGD');
    const costControl = new CostControlService(prisma, access);
    const beforeCurrencyChange = await costControl.projectCostControl(makerAuth, project.id);
    await prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode: 'USD' } });
    await assert.rejects(
      () => costControl.projectCostControl(makerAuth, project.id),
      (error: unknown) => error instanceof UnprocessableEntityException &&
        (error.getResponse() as { code: string }).code === 'COST_CONTROL_CURRENCY_UNSUPPORTED',
      'A Budget-only Project must not reinterpret retained SGD Budget as USD.',
    );
    await prisma.company.update({ where: { id: company.id }, data: { baseCurrencyCode: 'SGD' } });
    assert.equal((await costControl.projectCostControl(makerAuth, project.id)).totals.originalBudget.toString(),
      beforeCurrencyChange.totals.originalBudget.toString());
  } finally {
    await prisma.$disconnect();
  }
});
