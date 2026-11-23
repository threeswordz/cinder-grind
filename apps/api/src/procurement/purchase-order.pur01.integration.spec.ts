import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
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
import { PurchaseOrderService } from './purchase-order.service';
import { SourcingService } from './sourcing.service';

// One isolated genuine PostgreSQL 17.11 actor test of the NEW PUR01 scope.
// Not the historic PO suite, Mac, or browser harness.
const D = (v: string) => new Prisma.Decimal(v);
function actor(companyId: string, userId: string, roleCodes: string[]): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(), userId, companyId,
    email: userId + '@example.com', displayName: userId, roleCodes,
    permissions: [
      'procurement.pr.view', 'procurement.pr.manage',
      'procurement.pr.submit', 'procurement.pr.approve',
      'procurement.rfq.view', 'procurement.rfq.manage',
      'procurement.quotation.view', 'procurement.quotation.manage',
      'procurement.award.select', 'procurement.po.view',
      'procurement.po.create', 'procurement.po.edit',
      'procurement.po.submit', 'procurement.po.approve',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}
const hasCode = (code: string) => (error: unknown) =>
  error instanceof UnprocessableEntityException &&
  typeof error.getResponse() === 'object' &&
  (error.getResponse() as {code?: string}).code === code;

test('PUR01 native: whole-PO 2/3 comparable THB supplier gates, shortage reason, independent Ben override', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: { companyCode: 'QPOL-' + suffix, companyName: 'Quote threshold ' + suffix },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id, customerCode: 'QPOL-C-' + suffix,
        customerName: 'Quote Test Customer',
      },
    });
    const people = await Promise.all(
      ['Store', 'Khaimook', 'Jai', 'Ben', 'Delegate'].map(async (name, i) => {
        const employee = await prisma.employee.create({
          data: {
            companyId: company.id,
            employeeCode: 'QP-E-' + i + suffix,
            employeeName: 'Test ' + name,
          },
        });
        const user = await prisma.user.create({
          data: {
            companyId: company.id, employeeId: employee.id,
            email: 'qp-' + i + '-' + suffix + '@example.com',
            displayName: name, passwordHash: 'x',
          },
        });
        return { employee, user };
      }),
    );
    const project = await prisma.project.create({
      data: {
        companyId: company.id, customerId: customer.id,
        projectCode: 'QPOL-P-' + suffix,
        projectName: 'Quote policy',
        contractValue: D('200000'),
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: people.map(({employee}) => ({
        projectId: project.id, employeeId: employee.id, projectRole: 'PUR01 actor proof',
      })),
    });
    const uom = await prisma.unitOfMeasure.create({
      data: { companyId: company.id, uomCode: 'QP-EA-' + suffix, uomName: 'Each', decimalPlaces: 2 },
    });
    for (const [entityType, code, fmt] of [
      ['PURCHASE_REQUEST', 'PURCHASE_REQUEST', 'PRYYMM-###'],
      ['RFQ', 'RFQ', 'RFQYYMM-###'],
      ['PURCHASE_ORDER', 'PURCHASE_ORDER', 'POYYMM-###'],
    ]) {
      await prisma.numberSequence.create({
        data: {
          companyId: company.id,
          entityType, sequenceCode: code, formatTemplate: fmt, resetRule: 'MONTHLY',
        },
      });
    }
    const prRole = await prisma.role.create({
      data: { companyId: company.id, roleCode: 'QPOL_PR_' + suffix, roleName: 'Khaimook test' },
    });
    const poRole = await prisma.role.create({
      data: { companyId: company.id, roleCode: 'QPOL_PO_' + suffix, roleName: 'Ben test' },
    });
    const prFlow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id, workflowCode: 'QPOL_PR_' + suffix,
        entityType: 'PURCHASE_REQUEST', workflowName: 'Khaimook approval',
        steps: { create: [{
          stepNo: 1, stepName: 'PM approval', requiredApprovals: 1,
          stepRoles: { create: [{roleId: prRole.id}] },
        }] },
      },
    });
    const poFlow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id, workflowCode: 'QPOL_PO_' + suffix,
        entityType: 'PURCHASE_ORDER', workflowName: 'Ben PO approval',
        steps: { create: [{
          stepNo: 1, stepName: 'Ben approval', requiredApprovals: 1,
          stepRoles: { create: [{roleId: poRole.id}] },
        }] },
      },
    });
    const scope = new ProjectAccessService(
      prisma, new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const number = new NumberSequenceService(prisma);
    const prs = new ProcurementService(prisma, scope, audit, approvals, number);
    const sourcing = new SourcingService(prisma, scope, audit, number);
    const pos = new PurchaseOrderService(prisma, scope, audit, approvals, number);
    const maker = actor(company.id, people[0]!.user.id, ['STOREKEEPER']);
    const khaimook = actor(company.id, people[1]!.user.id, ['PROJECT_MANAGER', prRole.roleCode]);
    const jai = actor(company.id, people[2]!.user.id, ['PROCUREMENT_OFFICER']);
    const ben = actor(company.id, people[3]!.user.id, ['MANAGEMENT', poRole.roleCode]);
    const delegate = actor(company.id, people[4]!.user.id, [poRole.roleCode]);

    const supplierRows = await Promise.all(
      [1,2,3].map((n) => prisma.supplier.create({
        data: {
          companyId: company.id, supplierCode: 'QP-S-' + n + '-' + suffix,
          supplierName: 'Test quotation supplier ' + n,
        },
      })),
    );

    // Each case has authentic fresh approved demand and an awarded quotation,
    // not forged direct database fixtures or an already-used supplier award.
    async function makeOrder(
      label: string, selectedUnitPrice: string, count: number,
      partialLast = false,
    ) {
      const request = await prs.createRequest({auth: maker}, project.id, label);
      const line = await prs.createLine({auth: maker}, request.id, {
        lineType: 'SERVICE', description: label,
        quantity: D('1'), uomId: uom.id,
      });
      await prs.submitRequest({auth: maker}, request.id, prFlow.workflowCode);
      await prs.approveRequest({auth: khaimook}, request.id, 'Valid purchasing scope');
      const rfq = await sourcing.createRfq({auth: maker}, project.id, {
        lines: [{ purchaseRequestLineId: line.id, quantity: D('1') }],
      });
      const quotes = [];
      for (let i = 0; i < count; i++) {
        const supplier = supplierRows[i]!;
        await sourcing.inviteSupplier({auth: jai}, rfq.id, supplier.id);
        const q = await sourcing.createQuotation(
          {auth: jai}, rfq.id, supplier.id,
          {quotationDate: new Date(), supplierReference: label + '-Q-' + i},
        );
        assert.equal(q.currencyCode, 'THB');
        const quotationLine = await sourcing.upsertQuotationLine(
          {auth: jai}, q.id, rfq.lines[0]!.id,
          {quantity: partialLast && i===count-1 ? D('0.50') : D('1'),
            unitPrice: i===0 ? D(selectedUnitPrice) : D('100')},
        );
        quotes.push({q,quotationLine});
      }
      const award = await sourcing.selectAward(
        {auth: jai}, rfq.lines[0]!.id, quotes[0]!.quotationLine.id,
        'Supplier one awarded using source line',
      );
      const po = await pos.createOrder({auth: jai}, project.id, [award.id], label);
      await pos.updateOrder({auth: jai}, po.id, {
        discountAmount: D('0'), freightAmount: D('0'),
        additionalChargeAmount: D('0'), vatRatePercent: D('7'),
      });
      return {po,rfq,quotes};
    }

    // > 10,000 requires two complete, genuinely distinct THB offers. A
    // partial quote must not count as the second supplier; after correction
    // the same PO can be submitted without the special-supplier exception.
    const two = await makeOrder('QPOL-TWO', '10000.01', 2, true);
    await assert.rejects(
      () => pos.submit({auth: jai},two.po.id,poFlow.workflowCode),
      hasCode('PO_QUOTE_SUPPLIERS_INSUFFICIENT'),
    );
    const pendingTwo = await prisma.purchaseOrder.findUniqueOrThrow({where:{id:two.po.id}});
    assert.equal(pendingTwo.approvalInstanceId,null);
    await sourcing.upsertQuotationLine(
      {auth: jai},two.quotes[1]!.q.id,two.rfq.lines[0]!.id,
      {quantity: D('1'),unitPrice:D('100')},
    );
    await pos.submit({auth: jai},two.po.id,poFlow.workflowCode);
    const approvedTwo = await pos.approve({auth: ben},two.po.id,'Two suppliers compared');
    assert.equal(approvedTwo.lifecycleState,'APPROVED');

    // > 50,000 requires THREE distinct comparable quotes, not two. Three
    // partial quotes or invitations alone cannot satisfy the evidence.
    const three = await makeOrder('QPOL-THREE', '50000.01', 3, true);
    await assert.rejects(
      () => pos.submit({auth: jai},three.po.id,poFlow.workflowCode),
      hasCode('PO_QUOTE_SUPPLIERS_INSUFFICIENT'),
    );
    await sourcing.upsertQuotationLine(
      {auth: jai},three.quotes[2]!.q.id,three.rfq.lines[0]!.id,
      {quantity: D('1'),unitPrice:D('100')},
    );
    await pos.submit({auth: jai},three.po.id,poFlow.workflowCode);
    const approvedThree = await pos.approve(
      {auth: ben},three.po.id,'Three distinct supplier quotes accepted',
    );
    assert.equal(approvedThree.lifecycleState,'APPROVED');

    // Special supplier: valid THB awarded quote but only one where three
    // required. Missing reason cannot enter an approval workflow. A maker
    // enters a specific reason, but only independent MANAGEMENT can approve.
    const special = await makeOrder('QPOL-EXCEPTION', '60000', 1);
    await assert.rejects(
      () => pos.submit({auth: jai},special.po.id,poFlow.workflowCode),
      hasCode('PO_QUOTE_SUPPLIERS_INSUFFICIENT'),
    );
    await pos.updateOrder({auth: jai},special.po.id,{
      supplierQuoteExceptionReason:'Only certified supplier is qualified for this Project',
    });
    const submittedException = await pos.submit(
      {auth: jai},special.po.id,poFlow.workflowCode,
    );
    assert.equal(submittedException.lifecycleState,'SUBMITTED');
    await assert.rejects(
      () => pos.approve({auth: delegate},special.po.id,'Non-management delegated approver'),
      (error: unknown) => error instanceof ForbiddenException &&
        typeof error.getResponse()==='object' &&
        (error.getResponse() as {code?:string}).code==='PO_QUOTE_EXCEPTION_BEN_REQUIRED',
    );
    await assert.rejects(
      () => pos.approve({auth: jai},special.po.id,'Buyer self-approval'),
      (error: unknown) => error instanceof ForbiddenException,
    );
    const approvedException = await pos.approve(
      {auth: ben},special.po.id,'Ben: special source justified',
    );
    assert.equal(approvedException.lifecycleState,'APPROVED');

    // Canonical approval-action identity remains on the real actor, not an
    // unreviewed auto-approval, and rejected attempts must not leave actions.
    const approvedPoActions = await prisma.approvalAction.count({
      where: {
        approvalInstanceId: approvedException.approvalInstanceId!,
        action: 'APPROVE',
      },
    });
    assert.equal(approvedPoActions,1);
  } finally {
    await prisma.$disconnect();
  }
});
