import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
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

// Isolated PM02-only native PostgreSQL proof. Do not run the full procurement suite.
function auth(companyId: string, userId: string, roleCodes: string[]): AuthenticatedUserContext {
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
      'procurement.rfq.view',
      'procurement.rfq.manage',
      'procurement.quotation.view',
      'procurement.quotation.manage',
      'procurement.award.select',
      'procurement.po.view',
      'procurement.po.create',
      'procurement.po.edit',
      'procurement.po.submit',
      'procurement.po.approve',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('PM02: mixed approval, immutable returned demand, and rejected-correction chain', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: { companyCode: 'PM02-' + suffix, companyName: 'PM02 Test ' + suffix },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id, customerCode: 'PM02-C-' + suffix,
        customerName: 'PM02 Customer',
      },
    });
    const employees = await Promise.all(
      ['Maker', 'Reviewer', 'Other', 'Jai', 'Ben'].map((name) => prisma.employee.create({
        data: {
          companyId: company.id,
          employeeCode: 'PM02-' + name.slice(0, 2).toUpperCase() + '-' + suffix,
          employeeName: 'PM02 ' + name,
        },
      })),
    );
    const users = await Promise.all(
      employees.map((employee, index) => prisma.user.create({
        data: {
          companyId: company.id,
          employeeId: employee.id,
          email: 'pm02-' + index + '-' + suffix + '@example.com',
          displayName: 'PM02 ' + index,
          passwordHash: 'x',
        },
      })),
    );
    const maker = users[0]!;
    const reviewer = users[1]!;
    const otherMaker = users[2]!;
    const jai = users[3]!;
    const ben = users[4]!;
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        projectCode: 'PM02-P-' + suffix,
        projectName: 'PM02 Project',
        contractValue: '100000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-01-01T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: employees.map((employee) => ({
        projectId: project.id,
        employeeId: employee.id,
        projectRole: 'PM02 fixture',
      })),
    });
    const uom = await prisma.unitOfMeasure.create({
      data: {
        companyId: company.id,
        uomCode: 'EA-' + suffix, uomName: 'Each', decimalPlaces: 2,
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
    await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'RFQ',
        sequenceCode: 'RFQ',
        formatTemplate: 'RFQYYMM-###',
        resetRule: 'MONTHLY',
      },
    });
    await prisma.numberSequence.create({
      data: {
        companyId: company.id,
        entityType: 'PURCHASE_ORDER',
        sequenceCode: 'PURCHASE_ORDER',
        formatTemplate: 'POYYMM-###',
        resetRule: 'MONTHLY',
      },
    });
    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PM02_APPROVER_' + suffix,
        roleName: 'PM02 Project Manager Approver',
      },
    });
    const poApproverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PM02_PO_APPROVER_' + suffix,
        roleName: 'PM02 Ben PO Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PM02_' + suffix,
        entityType: 'PURCHASE_REQUEST',
        workflowName: 'PM02 single checker',
        steps: {
          create: [{
            stepNo: 1, stepName: 'Project Manager decision',
            requiredApprovals: 1,
            stepRoles: { create: [{ roleId: approverRole.id }] },
          }],
        },
      },
    });

    const poWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PM02_PO_' + suffix,
        entityType: 'PURCHASE_ORDER',
        workflowName: 'PM02 Ben PO approval',
        steps: {
          create: [{
            stepNo: 1, stepName: 'Ben commitment check',
            requiredApprovals: 1,
            stepRoles: { create: [{ roleId: poApproverRole.id }] },
          }],
        },
      },
    });
    const access = new ProjectAccessService(
      prisma, new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const service = new ProcurementService(
      prisma, access, audit, new ApprovalService(prisma), numbers,
    );
    const sourcing = new SourcingService(prisma, access, audit, numbers);
    const purchaseOrders = new PurchaseOrderService(
      prisma, access, audit, new ApprovalService(prisma), numbers,
    );
    const makerAuth = auth(company.id, maker.id, ['STOREKEEPER']);
    const reviewerAuth = auth(company.id, reviewer.id, [
      'PROJECT_MANAGER', approverRole.roleCode,
    ]);
    const otherAuth = auth(company.id, otherMaker.id, ['STOREKEEPER']);
    const jaiAuth = auth(company.id, jai.id, ['PROCUREMENT_OFFICER']);
    const benAuth = auth(company.id, ben.id, [
      'MANAGEMENT', poApproverRole.roleCode,
    ]);

    const draft = await service.createRequest(
      { auth: makerAuth }, project.id, 'Two-line PM02 A/B decision',
    );
    const lineA = await service.createLine({ auth: makerAuth }, draft.id, {
      lineType: 'SERVICE', description: 'Valid concrete service',
      quantity: new Prisma.Decimal('3'), uomId: uom.id,
    });
    const lineB = await service.createLine({ auth: makerAuth }, draft.id, {
      lineType: 'SERVICE', description: 'Incorrect transport service',
      quantity: new Prisma.Decimal('5'), uomId: uom.id,
    });
    const submitted = await service.submitRequest(
      { auth: makerAuth }, draft.id, workflow.workflowCode,
    );
    const instanceId = submitted.approvalInstanceId!;
    const mixed = [
      { lineId: lineA.id, decision: 'APPROVED' as const },
      { lineId: lineB.id, decision: 'RETURNED' as const,
        reason: 'Quantity and scope need correction' },
    ];

    await assert.rejects(
      () => service.decideRequestLines(
        { auth: makerAuth }, draft.id, instanceId, mixed,
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => service.decideRequestLines(
        { auth: otherAuth }, draft.id, instanceId, mixed,
      ),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => service.decideRequestLines(
        { auth: reviewerAuth }, draft.id, randomUUID(), mixed,
      ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.decideRequestLines(
        { auth: reviewerAuth }, draft.id, instanceId,
        [{ lineId: lineA.id, decision: 'APPROVED' }],
      ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.decideRequestLines(
        { auth: reviewerAuth }, draft.id, instanceId, [
          { lineId: lineA.id, decision: 'APPROVED' },
          { lineId: lineB.id, decision: 'RETURNED' },
        ],
      ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const approved = await service.decideRequestLines(
      { auth: reviewerAuth }, draft.id, instanceId, mixed, 'A accepted, B returned',
    );
    assert.equal(approved.lifecycleState, 'APPROVED');
    assert.equal(approved.lines.find((line) => line.id === lineA.id)?.reviewDecision, 'APPROVED');
    assert.equal(approved.lines.find((line) => line.id === lineB.id)?.reviewDecision, 'RETURNED');
    assert.equal(approved.lines.find((line) => line.id === lineB.id)?.reviewReason,
      'Quantity and scope need correction');
    assert.equal(approved.approvalInstance?.actions.length, 1);

    // Actual sourcing admission: A proceeds, B cannot enter a new RFQ.
    const eligible = await sourcing.approvedDemand(makerAuth, project.id);
    assert.ok(eligible.some((line) => line.id === lineA.id));
    assert.ok(!eligible.some((line) => line.id === lineB.id));
    await assert.rejects(
      () => sourcing.createRfq({ auth: makerAuth }, project.id, {
        lines: [{ purchaseRequestLineId: lineB.id, quantity: new Prisma.Decimal('1') }],
      }),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    const rfq = await sourcing.createRfq({ auth: makerAuth }, project.id, {
      lines: [{ purchaseRequestLineId: lineA.id, quantity: new Prisma.Decimal('1') }],
    });
    assert.equal(rfq.lines.length, 1);
    assert.equal(rfq.lines[0]?.purchaseRequestLineId, lineA.id);

    // Real downstream source lineage, with separate synthetic Jai buyer
    // and Ben approver. B cannot get an RFQ/award/PO through normal APIs.
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'PM02-SUP-' + suffix,
        supplierName: 'PM02 test supplier',
      },
    });
    await sourcing.inviteSupplier({ auth: jaiAuth }, rfq.id, supplier.id);
    const quote = await sourcing.createQuotation(
      { auth: jaiAuth }, rfq.id, supplier.id,
      { quotationDate: new Date(), supplierReference: 'PM02-Q-' + suffix },
    );
    const quoteLine = await sourcing.upsertQuotationLine(
      { auth: jaiAuth }, quote.id, rfq.lines[0]!.id,
      { quantity: new Prisma.Decimal('1'), unitPrice: new Prisma.Decimal('125') },
    );
    const award = await sourcing.selectAward(
      { auth: jaiAuth }, rfq.lines[0]!.id, quoteLine.id,
      'Valid approved A only',
    );
    const available = await purchaseOrders.availableAwards(jaiAuth, project.id);
    assert.ok(available.some((row) => row.id === award.id));
    assert.ok(!available.some((row) => row.purchaseRequestLineId === lineB.id));
    const draftPo = await purchaseOrders.createOrder(
      { auth: jaiAuth }, project.id, [award.id], 'PM02 only approved A',
    );
    assert.equal(draftPo.lines.length, 1);
    assert.equal(draftPo.lines[0]?.purchaseRequestLineId, lineA.id);
    await purchaseOrders.submit({ auth: jaiAuth }, draftPo.id, poWorkflow.workflowCode);
    await assert.rejects(
      () => purchaseOrders.approve({ auth: jaiAuth }, draftPo.id, 'Self approval denied'),
      (error: unknown) => error instanceof ForbiddenException,
    );
    const benApproved = await purchaseOrders.approve(
      { auth: benAuth }, draftPo.id, 'Ben approves A-only supplier commitment',
    );
    assert.equal(benApproved.lifecycleState, 'APPROVED');
    assert.equal(benApproved.lines.length, 1);
    assert.equal(benApproved.lines[0]?.purchaseRequestLineId, lineA.id);
    assert.equal(await prisma.purchaseOrderLine.count({
      where: { purchaseRequestLineId: lineB.id },
    }), 0);

    // Compatibility: historically whole-approved PR lines retain NULL and
    // remain eligible; PM02 must not require retroactive backfill/reapproval.
    const legacyDraft = await service.createRequest(
      { auth: makerAuth }, project.id, 'Whole-request legacy compatibility',
    );
    const legacyLine = await service.createLine({ auth: makerAuth }, legacyDraft.id, {
      lineType: 'SERVICE', description: 'Previous whole approval compatible',
      quantity: new Prisma.Decimal('2'), uomId: uom.id,
    });
    await service.submitRequest(
      { auth: makerAuth }, legacyDraft.id, workflow.workflowCode,
    );
    await service.approveRequest({ auth: reviewerAuth }, legacyDraft.id, 'Whole approved');
    assert.equal(
      (await service.getRequest(makerAuth, legacyDraft.id)).lines[0]?.reviewDecision,
      null,
    );
    const withLegacy = await sourcing.approvedDemand(makerAuth, project.id);
    assert.ok(withLegacy.some((line) => line.id === legacyLine.id));

    await assert.rejects(
      () => service.decideRequestLines(
        { auth: reviewerAuth }, draft.id, instanceId, mixed,
      ),
      (error: unknown) => error instanceof ConflictException,
    );
    // The one-time PM02 transaction cannot be reproduced through ad-hoc SQL.
    // Business content and review metadata remain protected after approval.
    await assert.rejects(
      () => prisma.purchaseRequestLine.update({
        where: { id: lineA.id },
        data: { quantity: new Prisma.Decimal('99') },
      }),
    );
    await assert.rejects(
      () => prisma.purchaseRequestLine.update({
        where: { id: lineB.id },
        data: { reviewDecision: 'APPROVED' },
      }),
    );
    await assert.rejects(
      () => service.copyReturned({ auth: otherAuth }, draft.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const correction = await service.copyReturned({ auth: makerAuth }, draft.id);
    const corrected = await service.getRequest(makerAuth, correction.id);
    assert.equal(corrected.lifecycleState, 'DRAFT');
    assert.equal(corrected.lines.length, 1);
    assert.equal(corrected.lines[0]?.correctionSourceLineId, lineB.id);
    await assert.rejects(
      () => service.copyReturned({ auth: makerAuth }, draft.id),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.createLine({ auth: makerAuth }, correction.id, {
        lineType: 'SERVICE', description: 'New unrelated service',
        quantity: new Prisma.Decimal('1'), uomId: uom.id,
      }),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.deleteLine({ auth: makerAuth }, corrected.lines[0]!.id),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.cancelRequest({ auth: makerAuth }, correction.id),
      (error: unknown) => error instanceof ConflictException,
    );

    await service.updateLine({ auth: makerAuth }, corrected.lines[0]!.id, {
      quantity: new Prisma.Decimal('2'),
    });
    await service.submitRequest(
      { auth: makerAuth }, correction.id, workflow.workflowCode,
    );
    const rejectedCorrection = await service.rejectRequest(
      { auth: reviewerAuth }, correction.id, 'Please clarify updated scope',
    );
    assert.equal(rejectedCorrection.lifecycleState, 'REJECTED');
    await assert.rejects(
      () => service.copyRejected({ auth: otherAuth }, correction.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const successor = await service.copyRejected({ auth: makerAuth }, correction.id);
    const successorDetails = await service.getRequest(makerAuth, successor.id);
    assert.equal(successorDetails.lifecycleState, 'DRAFT');
    assert.equal(successorDetails.sourceRequestId, correction.id);
    assert.equal(successorDetails.lines.length, 1);
    assert.equal(successorDetails.lines[0]?.correctionSourceLineId, corrected.lines[0]!.id);
    await assert.rejects(
      () => service.copyRejected({ auth: makerAuth }, correction.id),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.cancelRequest({ auth: makerAuth }, successor.id),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => service.createLine({ auth: makerAuth }, successor.id, {
        lineType: 'SERVICE', description: 'Another unrelated service',
        quantity: new Prisma.Decimal('1'), uomId: uom.id,
      }),
      (error: unknown) => error instanceof ConflictException,
    );
    const original = await service.getRequest(makerAuth, draft.id);
    assert.equal(original.lifecycleState, 'APPROVED');
    assert.equal(original.lines.find((line) => line.id === lineB.id)?.reviewDecision, 'RETURNED');
    assert.equal(await prisma.purchaseOrder.count({ where: { companyId: company.id } }), 1);
    assert.equal(await prisma.rfq.count({ where: { companyId: company.id } }), 1);

    // Adversarial PostgreSQL-only proof. The immutable PO award/lineage
    // trigger refuses this fabricated returned B source at INSERT, BEFORE
    // PurchaseOrderService.submit can be reached. The distinct service-level
    // fail-closed assertion lives in purchase-order.pm02-source-guard.spec.ts.
    // Never bypass or weaken the canonical database trigger for a test.
    const originalPoLine = await prisma.purchaseOrderLine.findFirstOrThrow({
      where: { purchaseOrderId: draftPo.id },
    });
    const forgedDraft = await prisma.purchaseOrder.create({
      data: {
        companyId: company.id,
        projectId: project.id,
        supplierId: supplier.id,
        poNumber: 'PM02-FORGED-' + suffix,
        revisionNo: 0,
        createdByUserId: jai.id,
      },
    });
    await assert.rejects(
      () => prisma.purchaseOrderLine.create({
        data: {
          purchaseOrderId: forgedDraft.id,
          lineNo: 1,
          quotationAwardId: originalPoLine.quotationAwardId,
          purchaseRequestLineId: lineB.id,
          rfqId: originalPoLine.rfqId,
          rfqLineId: originalPoLine.rfqLineId,
          supplierQuotationId: originalPoLine.supplierQuotationId,
          supplierQuotationLineId: originalPoLine.supplierQuotationLineId,
          lineType: originalPoLine.lineType,
          materialId: originalPoLine.materialId,
          materialCodeSnapshot: originalPoLine.materialCodeSnapshot,
          description: originalPoLine.description,
          quantity: originalPoLine.quantity,
          uomId: originalPoLine.uomId,
          uomCodeSnapshot: originalPoLine.uomCodeSnapshot,
          unitPrice: originalPoLine.unitPrice,
          amount: originalPoLine.amount,
          wbsId: originalPoLine.wbsId,
          costCodeId: originalPoLine.costCodeId,
          requiredOnSite: originalPoLine.requiredOnSite,
          expectedDelivery: originalPoLine.expectedDelivery,
          remarks: originalPoLine.remarks,
        },
      }),
      (error: unknown) =>
        String(error).includes('Purchase Order source traceability is inconsistent with the selected award') &&
        String(error).includes('P0001'),
      'Canonical SQL trigger must deny attaching returned B to approved A award',
    );
    const blockedPo = await prisma.purchaseOrder.findUniqueOrThrow({
      where: { id: forgedDraft.id },
      select: { submittedAt: true, approvalInstanceId: true },
    });
    assert.equal(blockedPo.submittedAt, null);
    assert.equal(blockedPo.approvalInstanceId, null);
    assert.equal(await prisma.purchaseOrderLine.count({
      where: { purchaseOrderId: forgedDraft.id },
    }), 0);
  } finally {
    await prisma.$disconnect();
  }
});
