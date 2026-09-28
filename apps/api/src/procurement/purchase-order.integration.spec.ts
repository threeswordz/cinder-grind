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
import { GoodsReceiptService } from '../inventory/goods-receipt.service';
import { InventoryQuantityService } from '../inventory/inventory-quantity.service';
import { MaterialIssueService } from '../inventory/material-issue.service';
import { MaterialReservationService } from '../inventory/material-reservation.service';
import { MaterialReturnService } from '../inventory/material-return.service';
import { StockBalanceService } from '../inventory/stock-balance.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { ReportingService } from '../reporting/reporting.service';
import { SchedulingProgressService } from '../scheduling/scheduling-progress.service';
import { ProcurementService } from './procurement.service';
import { PurchaseOrderService } from './purchase-order.service';
import { SourcingService } from './sourcing.service';

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
      'procurement.po.reject',
      'procurement.po.cancel',
      'procurement.po.revise',
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.3-D Purchase Orders preserve awarded-source traceability, approval and revision history', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const [clock] = await prisma.$queryRaw<Array<{ today: string }>>`
      SELECT CURRENT_DATE::text AS today
    `;
    assert.ok(clock?.today);
    const today = new Date(clock.today + 'T00:00:00.000Z');
    const closingDate = new Date(today);
    closingDate.setUTCDate(closingDate.getUTCDate() + 7);
    const requiredOnSite = new Date(today);
    requiredOnSite.setUTCDate(requiredOnSite.getUTCDate() + 21);
    const expectedDelivery = new Date(today);
    expectedDelivery.setUTCDate(expectedDelivery.getUTCDate() + 14);
    const revisedExpectedDelivery = new Date(today);
    revisedExpectedDelivery.setUTCDate(
      revisedExpectedDelivery.getUTCDate() + 18,
    );

    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'PO-' + suffix,
        companyName: 'Purchase Order Test ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'PO-C-' + suffix,
        customerName: 'PO Customer',
      },
    });

    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PO-M-' + suffix,
        employeeName: 'PO Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PO-CHECK-' + suffix,
        employeeName: 'PO Checker',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'PO-OUT-' + suffix,
        employeeName: 'PO Outsider',
      },
    });

    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'po-maker-' + suffix + '@example.com',
        displayName: 'PO Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'po-checker-' + suffix + '@example.com',
        displayName: 'PO Checker',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'po-outsider-' + suffix + '@example.com',
        displayName: 'PO Outsider',
        passwordHash: 'x',
      },
    });

    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'PO-P-' + suffix,
        projectName: 'PO Project',
        customerId: customer.id,
        contractValue: '1000000',
        plannedStartDate: new Date('2026-10-01T00:00:00.000Z'),
        plannedCompletionDate: new Date('2027-06-30T00:00:00.000Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: [
        {
          projectId: project.id,
          employeeId: makerEmployee.id,
          projectRole: 'Procurement',
        },
        {
          projectId: project.id,
          employeeId: checkerEmployee.id,
          projectRole: 'PO Approver',
        },
      ],
    });

    const wbs = await prisma.wbsElement.create({
      data: {
        projectId: project.id,
        wbsCode: '01',
        wbsName: 'Structure',
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
    const supplier = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'SUP-' + suffix,
        supplierName: 'PO Supplier',
      },
    });

    await prisma.numberSequence.createMany({
      data: [
        {
          companyId: company.id,
          entityType: 'PURCHASE_REQUEST',
          sequenceCode: 'PURCHASE_REQUEST',
          formatTemplate: 'PRYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'RFQ',
          sequenceCode: 'RFQ',
          formatTemplate: 'RFQYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'PURCHASE_ORDER',
          sequenceCode: 'PURCHASE_ORDER',
          formatTemplate: 'POYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'GOODS_RECEIPT',
          sequenceCode: 'GOODS_RECEIPT',
          formatTemplate: 'GRNYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'MATERIAL_RESERVATION',
          sequenceCode: 'MATERIAL_RESERVATION',
          formatTemplate: 'RSVYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'MATERIAL_ISSUE',
          sequenceCode: 'MATERIAL_ISSUE',
          formatTemplate: 'MIYYMM-###',
          resetRule: 'MONTHLY',
        },
        {
          companyId: company.id,
          entityType: 'MATERIAL_RETURN',
          sequenceCode: 'MATERIAL_RETURN',
          formatTemplate: 'MRTYYMM-###',
          resetRule: 'MONTHLY',
        },
      ],
    });

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'PO_APPROVER_' + suffix,
        roleName: 'PO Approver',
      },
    });
    const prWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PO_PR_' + suffix,
        entityType: 'PURCHASE_REQUEST',
        workflowName: 'PR Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Approve demand',
              requiredApprovals: 1,
              stepRoles: {
                create: [{ roleId: approverRole.id }],
              },
            },
          ],
        },
      },
    });
    const poWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PO_WORKFLOW_' + suffix,
        entityType: 'PURCHASE_ORDER',
        workflowName: 'PO Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Approve commitment',
              requiredApprovals: 1,
              stepRoles: {
                create: [{ roleId: approverRole.id }],
              },
            },
          ],
        },
      },
    });

    const receiptWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'PO_RECEIPT_' + suffix,
        entityType: 'GOODS_RECEIPT',
        workflowName: 'Receipt Approval',
        steps: {
          create: [{
            stepNo: 1, stepName: 'Approve received stock',
            requiredApprovals: 1,
            stepRoles: { create: [{ roleId: approverRole.id }] },
          }],
        },
      },
    });

    const issueWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'MATERIAL_ISSUE_' + suffix,
        entityType: 'MATERIAL_ISSUE',
        workflowName: 'Material Issue Approval',
        steps: {
          create: [{
            stepNo: 1,
            stepName: 'Approve material issue',
            requiredApprovals: 1,
            stepRoles: { create: [{ roleId: approverRole.id }] },
          }],
        },
      },
    });
    const returnWorkflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'MATERIAL_RETURN_' + suffix,
        entityType: 'MATERIAL_RETURN',
        workflowName: 'Material Return Approval',
        steps: {
          create: [{
            stepNo: 1,
            stepName: 'Approve material return',
            requiredApprovals: 1,
            stepRoles: { create: [{ roleId: approverRole.id }] },
          }],
        },
      },
    });

    const access = new ProjectAccessService(
      prisma,
      new ProjectScopeService(new AuthorizationService()),
    );
    const reporting = new ReportingService(
      prisma,
      access,
      null as unknown as SchedulingProgressService,
    );
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const procurement = new ProcurementService(
      prisma,
      access,
      audit,
      approvals,
      numbers,
    );
    const sourcing = new SourcingService(
      prisma,
      access,
      audit,
      numbers,
    );
    const purchaseOrders = new PurchaseOrderService(
      prisma,
      access,
      audit,
      approvals,
      numbers,
    );

    const receipts = new GoodsReceiptService(prisma, access, audit, approvals, numbers);
    const balances = new StockBalanceService(prisma, access);
    const quantities = new InventoryQuantityService(prisma);
    const reservations = new MaterialReservationService(
      prisma, access, audit, numbers, quantities,
    );
    const materialIssues = new MaterialIssueService(
      prisma, access, audit, approvals, numbers, quantities,
    );
    const materialReturns = new MaterialReturnService(
      prisma, access, audit, approvals, numbers, quantities,
    );

    const makerAuth = auth(company.id, maker.id, ['PO_MAKER']);
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);
    const outsiderAuth = auth(company.id, outsider.id, [
      'PO_OUTSIDER',
    ]);

    const pr = await procurement.createRequest(
      { auth: makerAuth },
      project.id,
      'PO source demand',
    );
    const prLine = await procurement.createLine(
      { auth: makerAuth },
      pr.id,
      {
        lineType: 'MATERIAL',
        materialId: material.id,
        quantity: new Prisma.Decimal('10'),
        uomId: uom.id,
        wbsId: wbs.id,
        costCodeId: costCode.id,
        requiredOnSite,
      },
    );
    await procurement.submitRequest(
      { auth: makerAuth },
      pr.id,
      prWorkflow.workflowCode,
    );
    const approvedPr = await procurement.approveRequest(
      { auth: checkerAuth },
      pr.id,
      'Approved for sourcing.',
    );
    assert.equal(approvedPr.lifecycleState, 'APPROVED');

    const rfq = await sourcing.createRfq(
      { auth: makerAuth },
      project.id,
      {
        closingDate,
        lines: [
          {
            purchaseRequestLineId: prLine.id,
            quantity: new Prisma.Decimal('10'),
          },
        ],
      },
    );
    await sourcing.inviteSupplier(
      { auth: makerAuth },
      rfq.id,
      supplier.id,
    );
    const quotation = await sourcing.createQuotation(
      { auth: makerAuth },
      rfq.id,
      supplier.id,
      {
        quotationDate: today,
        supplierReference: 'Q-' + suffix,
      },
    );
    const rfqDetail = await sourcing.getRfq(makerAuth, rfq.id);
    const rfqLine = rfqDetail.lines[0]!;
    const quotationLine = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quotation.id,
      rfqLine.id,
      {
        quantity: new Prisma.Decimal('10'),
        unitPrice: new Prisma.Decimal('12.5'),
      },
    );
    const award = await sourcing.selectAward(
      { auth: makerAuth },
      rfqLine.id,
      quotationLine.id,
      'Selected supplier.',
    );

    const options = await purchaseOrders.availableAwards(
      makerAuth,
      project.id,
    );
    assert.equal(options.some((item) => item.id === award.id), true);

    const draft = await purchaseOrders.createOrder(
      { auth: makerAuth },
      project.id,
      [award.id],
      'Initial PO',
    );
    assert.match(draft.poNumber, /^PO\d{4}-\d{3}$/);
    assert.equal(draft.revisionNo, 0);
    assert.equal(draft.supplierId, supplier.id);
    assert.equal(draft.lines.length, 1);
    assert.equal(draft.lines[0]?.quotationAwardId, award.id);
    assert.equal(
      draft.lines[0]?.purchaseRequestLineId,
      prLine.id,
    );
    assert.equal(draft.lines[0]?.rfqId, rfq.id);
    assert.equal(
      draft.lines[0]?.supplierQuotationId,
      quotation.id,
    );
    assert.equal(draft.lines[0]?.quantity.toString(), '10');
    assert.equal(draft.lines[0]?.unitPrice.toString(), '12.5');
    assert.equal(draft.lines[0]?.amount.toString(), '125');
    assert.equal(draft.lines[0]?.wbsId, wbs.id);
    assert.equal(draft.lines[0]?.costCodeId, costCode.id);

    await assert.rejects(
      () =>
        purchaseOrders.createOrder(
          { auth: makerAuth },
          project.id,
          [award.id],
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    await assert.rejects(
      () =>
        purchaseOrders.updateLine(
          { auth: makerAuth },
          draft.lines[0]!.id,
          { quantity: new Prisma.Decimal('11') },
        ),
      (error: unknown) =>
        error instanceof UnprocessableEntityException,
      'PO quantity above the Supplier Award must be rejected.',
    );
    await assert.rejects(
      () =>
        prisma.purchaseOrderLine.update({
          where: { id: draft.lines[0]!.id },
          data: {
            quantity: new Prisma.Decimal('11'),
            amount: new Prisma.Decimal('137.5'),
          },
        }),
      'Database guard must reject PO quantity above its Supplier Award.',
    );

    const updatedLine = await purchaseOrders.updateLine(
      { auth: makerAuth },
      draft.lines[0]!.id,
      {
        quantity: new Prisma.Decimal('9'),
        unitPrice: new Prisma.Decimal('13'),
        expectedDelivery,
        remarks: 'Confirmed delivery.',
      },
    );
    assert.equal(updatedLine.amount.toString(), '117');
    assert.equal(
      updatedLine.expectedDelivery?.toISOString().slice(0, 10),
      expectedDelivery.toISOString().slice(0, 10),
    );

    await purchaseOrders.submit(
      { auth: makerAuth },
      draft.id,
      poWorkflow.workflowCode,
    );
    const approved = await purchaseOrders.approve(
      { auth: checkerAuth },
      draft.id,
      'Approved initial PO.',
    );
    assert.equal(approved.lifecycleState, 'APPROVED');
    assert.equal(approved.revisionNo, 0);

    const procurementReport = await reporting.procurement(
      makerAuth,
      project.id,
    );
    const procurementLine = procurementReport.lines.find(
      (line) => line.id === prLine.id,
    );
    assert.ok(procurementLine);
    assert.equal(procurementLine.pr.prNumber, pr.prNumber);
    assert.equal(procurementLine.scheduleRisk, 'ON_TIME');
    assert.equal(
      procurementLine.requiredOnSite,
      requiredOnSite.toISOString().slice(0, 10),
    );
    assert.equal(
      procurementLine.expectedDelivery,
      expectedDelivery.toISOString().slice(0, 10),
    );
    assert.equal(
      procurementLine.rfqs.some(
        (row) =>
          row.rfqNumber === rfq.rfqNumber &&
          row.award?.id === award.id &&
          row.award.supplierQuotationId === quotation.id &&
          row.award.supplierQuotationLineId === quotationLine.id,
      ),
      true,
    );
    assert.equal(
      procurementLine.rfqs
        .flatMap((row) => row.quotations)
        .some(
          (quotation) =>
            quotation.id === quotation.id &&
            quotation.quotationDate ===
              quotation.quotationDate.slice(0, 10),
        ),
      true,
    );
    assert.equal(
      procurementLine.purchaseOrders.some(
        (row) =>
          row.poNumber === draft.poNumber &&
          row.lifecycleState === 'APPROVED',
      ),
      true,
    );
    assert.equal(
      JSON.stringify(procurementLine).includes('unitPrice'),
      false,
      'Operational procurement reporting must not leak quotation/PO commercial pricing.',
    );
    await assert.rejects(
      () => reporting.procurement(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    await assert.rejects(
      () =>
        purchaseOrders.updateLine(
          { auth: makerAuth },
          draft.lines[0]!.id,
          { unitPrice: new Prisma.Decimal('14') },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const revision = await purchaseOrders.revise(
      { auth: makerAuth },
      draft.id,
      'Supplier delivery and price update.',
    );
    assert.equal(revision.poNumber, draft.poNumber);
    assert.equal(revision.revisionNo, 1);
    assert.equal(revision.previousRevisionId, draft.id);
    assert.equal(revision.lifecycleState, 'DRAFT');

    const revisionDetail = await purchaseOrders.getOrder(
      makerAuth,
      revision.id,
    );
    assert.equal(revisionDetail.lines.length, 1);
    assert.equal(
      revisionDetail.lines[0]?.quotationAwardId,
      award.id,
    );
    assert.equal(
      revisionDetail.lines[0]?.unitPrice.toString(),
      '13',
    );

    const revisedLine = await purchaseOrders.updateLine(
      { auth: makerAuth },
      revisionDetail.lines[0]!.id,
      {
        unitPrice: new Prisma.Decimal('13.75'),
        expectedDelivery: revisedExpectedDelivery,
      },
    );
    assert.equal(revisedLine.amount.toString(), '123.75');

    await purchaseOrders.submit(
      { auth: makerAuth },
      revision.id,
      poWorkflow.workflowCode,
    );
    const approvedRevision = await purchaseOrders.approve(
      { auth: checkerAuth },
      revision.id,
      'Approved revision.',
    );
    assert.equal(approvedRevision.lifecycleState, 'APPROVED');

    const history = await purchaseOrders.revisions(
      makerAuth,
      revision.id,
    );
    assert.equal(history.length, 2);
    assert.deepEqual(
      history.map((row) => row.revisionNo),
      [0, 1],
    );
    assert.equal(history[0]?.lifecycleState, 'APPROVED');
    assert.equal(history[1]?.lifecycleState, 'APPROVED');

    const originalAfterRevision = await purchaseOrders.getOrder(
      makerAuth,
      draft.id,
    );
    assert.equal(
      originalAfterRevision.lines[0]?.unitPrice.toString(),
      '13',
      'Earlier approved PO revision must remain immutable.',
    );

    await assert.rejects(
      () =>
        prisma.purchaseOrder.update({
          where: { id: draft.id },
          data: { remarks: 'Direct history rewrite' },
        }),
      'Approved Purchase Order header must be immutable.',
    );
    await assert.rejects(
      () =>
        prisma.purchaseOrderLine.update({
          where: { id: draft.lines[0]!.id },
          data: {
            expectedDelivery: revisedExpectedDelivery,
          },
        }),
      'Approved Purchase Order lines must be immutable.',
    );

    const warehouse = await prisma.warehouse.create({
      data: {
        companyId: company.id,
        warehouseCode: 'PO-RECEIPT-' + suffix,
        warehouseName: 'Receipt integration store',
        projectId: project.id,
        isSiteWarehouse: true,
      },
    });
    const sourceLine = revisionDetail.lines[0]!;
    const createReceipt = (qty: string) =>
      receipts.create({ auth: makerAuth }, {
        projectId: project.id, purchaseOrderId: revision.id,
        warehouseId: warehouse.id,
        lines: [{ purchaseOrderLineId: sourceLine.id, quantity: new Prisma.Decimal(qty) }],
      });
    const first = await createReceipt('3');
    await receipts.submit({ auth: makerAuth }, first.id, receiptWorkflow.workflowCode);
    await assert.rejects(
      () => receipts.approve({ auth: makerAuth }, first.id, 'maker-post'),
      (error: unknown) => error instanceof ForbiddenException,
    );
    const posted = await receipts.approve({ auth: checkerAuth }, first.id, 'receipt-first');
    assert.equal(posted.stockTransactions.length, 1);
    assert.equal(posted.stockTransactions[0]?.quantity.toString(), '3');
    const retried = await receipts.approve({ auth: checkerAuth }, first.id, 'receipt-first');
    assert.equal(retried.stockTransactions.length, 1);

    const postedBalance = await balances.balances(makerAuth, {
      projectId: project.id,
      warehouseId: warehouse.id,
      materialId: material.id,
    });
    assert.equal(postedBalance.length, 1);
    assert.equal(postedBalance[0]?.quantity, '3.0000');
    assert.equal(postedBalance[0]?.projectId, project.id);
    assert.equal(postedBalance[0]?.warehouseProjectId, project.id);
    assert.equal(postedBalance[0]?.isSiteWarehouse, true);
    assert.deepEqual(await balances.balances(outsiderAuth, {}), []);

    const competingReservationA = await reservations.create(
      { auth: makerAuth },
      {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
        uomId: uom.id,
        wbsId: wbs.id,
        quantity: new Prisma.Decimal('2'),
      },
    );
    const competingReservationB = await reservations.create(
      { auth: makerAuth },
      {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
        uomId: uom.id,
        wbsId: wbs.id,
        quantity: new Prisma.Decimal('2'),
      },
    );
    const competingActivations = await Promise.allSettled([
      reservations.activate({ auth: makerAuth }, competingReservationA.id),
      reservations.activate({ auth: makerAuth }, competingReservationB.id),
    ]);
    assert.equal(
      competingActivations.filter((result) => result.status === 'fulfilled').length,
      1,
      'Concurrent Reservations must not double-reserve the final available quantity.',
    );
    const activeCompeting =
      competingActivations[0]?.status === 'fulfilled'
        ? competingReservationA
        : competingReservationB;
    await reservations.release(
      { auth: makerAuth },
      activeCompeting.id,
      'Release concurrency test reservation',
    );

    const reservation = await reservations.create(
      { auth: makerAuth },
      {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
        uomId: uom.id,
        wbsId: wbs.id,
        quantity: new Prisma.Decimal('2'),
      },
    );
    const activeReservation = await reservations.activate(
      { auth: makerAuth },
      reservation.id,
    );
    assert.equal(activeReservation.status, 'ACTIVE');
    const reservedAvailability = await reservations.availability(makerAuth, {
      projectId: project.id,
      warehouseId: warehouse.id,
      materialId: material.id,
      uomId: uom.id,
    });
    assert.equal(reservedAvailability.onHand, '3.0000');
    assert.equal(reservedAvailability.reserved, '2.0000');
    assert.equal(reservedAvailability.available, '1.0000');

    const issue = await materialIssues.create(
      { auth: makerAuth },
      {
        projectId: project.id,
        warehouseId: warehouse.id,
        issueDate: today,
        issuedToEmployeeId: makerEmployee.id,
        lines: [{
          materialId: material.id,
          quantity: new Prisma.Decimal('2'),
          uomId: uom.id,
          reservationId: reservation.id,
          wbsId: wbs.id,
          costCodeId: costCode.id,
        }],
      },
    );
    await materialIssues.submit(
      { auth: makerAuth },
      issue.id,
      issueWorkflow.workflowCode,
    );
    await assert.rejects(
      () => materialIssues.approve(
        { auth: makerAuth },
        issue.id,
        'issue-maker-post',
      ),
      (error: unknown) => error instanceof ForbiddenException,
      'Material Issue must preserve maker-checker.',
    );
    const postedIssue = await materialIssues.approve(
      { auth: checkerAuth },
      issue.id,
      'issue-post',
    );
    assert.equal(postedIssue.stockTransactions.length, 1);
    assert.equal(postedIssue.stockTransactions[0]?.movementType, 'MATERIAL_ISSUE');
    assert.equal(postedIssue.stockTransactions[0]?.quantity.toString(), '-2');
    assert.equal(
      (await reservations.get(makerAuth, reservation.id)).status,
      'FULFILLED',
      'Linked Reservation must be fulfilled atomically with Issue posting.',
    );
    assert.equal(
      (await balances.balances(makerAuth, {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
      }))[0]?.quantity,
      '1.0000',
    );

    const materialReturn = await materialReturns.create(
      { auth: makerAuth },
      {
        projectId: project.id,
        warehouseId: warehouse.id,
        returnDate: today,
        lines: [{
          materialIssueItemId: postedIssue.items[0]!.id,
          quantity: new Prisma.Decimal('1'),
        }],
      },
    );
    await materialReturns.submit(
      { auth: makerAuth },
      materialReturn.id,
      returnWorkflow.workflowCode,
    );
    const postedReturn = await materialReturns.approve(
      { auth: checkerAuth },
      materialReturn.id,
      'return-post',
    );
    assert.equal(postedReturn.stockTransactions.length, 1);
    assert.equal(postedReturn.stockTransactions[0]?.movementType, 'MATERIAL_RETURN');
    assert.equal(postedReturn.stockTransactions[0]?.quantity.toString(), '1');

    await assert.rejects(
      () => materialIssues.reverse(
        { auth: makerAuth },
        issue.id,
        'issue-reverse-too-early',
        'Must reverse Return first',
      ),
      (error: unknown) => error instanceof ConflictException,
      'Issue reversal must be blocked while a non-reversed Return remains.',
    );
    await assert.rejects(
      () => materialReturns.create(
        { auth: makerAuth },
        {
          projectId: project.id,
          warehouseId: warehouse.id,
          returnDate: today,
          lines: [{
            materialIssueItemId: postedIssue.items[0]!.id,
            quantity: new Prisma.Decimal('2'),
          }],
        },
      ),
      (error: unknown) => error instanceof UnprocessableEntityException,
      'Cumulative Return quantity must not exceed the issued quantity.',
    );

    const reversedReturn = await materialReturns.reverse(
      { auth: makerAuth },
      materialReturn.id,
      'return-reverse',
      'Reverse Stage D integration return',
    );
    assert.equal(
      reversedReturn.stockTransactions.reduce(
        (sum, row) => sum.plus(row.quantity),
        new Prisma.Decimal(0),
      ).toString(),
      '0',
    );
    const reversedIssue = await materialIssues.reverse(
      { auth: makerAuth },
      issue.id,
      'issue-reverse',
      'Reverse Stage D integration issue',
    );
    assert.equal(
      reversedIssue.stockTransactions.reduce(
        (sum, row) => sum.plus(row.quantity),
        new Prisma.Decimal(0),
      ).toString(),
      '0',
    );
    assert.equal(
      (await reservations.get(makerAuth, reservation.id)).status,
      'FULFILLED',
      'Issue reversal preserves historical Reservation fulfillment.',
    );
    assert.equal(
      (await balances.balances(makerAuth, {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
      }))[0]?.quantity,
      '3.0000',
      'Return and Issue reversals must restore the original receipt balance exactly.',
    );

    await assert.rejects(
      () => receipts.get(outsiderAuth, first.id),
      (error: unknown) => error instanceof ForbiddenException,
    );
    await assert.rejects(
      () => prisma.stockTransaction.update({
        where: { id: posted.stockTransactions[0]!.id },
        data: { quantity: new Prisma.Decimal('8') },
      }),
      'Posted Stock Transaction must be immutable in PostgreSQL.',
    );
    await assert.rejects(
      () => prisma.warehouse.update({ where: { id: warehouse.id }, data: { projectId: null } }),
      'Warehouse with stock history cannot change Project.',
    );
    await assert.rejects(
      () => prisma.warehouse.update({ where: { id: warehouse.id }, data: { isActive: false } }),
      'Warehouse with positive on-hand stock cannot be archived.',
    );
    await assert.rejects(
      () => purchaseOrders.cancel({ auth: makerAuth }, revision.id, 'Cannot cancel with stock'),
      (error: unknown) => error instanceof ConflictException,
    );

    const afterReceiptRevision = await purchaseOrders.revise(
      { auth: makerAuth }, revision.id, 'Try to reduce delivered quantity',
    );
    const afterReceiptDetail = await purchaseOrders.getOrder(makerAuth, afterReceiptRevision.id);
    await assert.rejects(
      () => purchaseOrders.updateLine(
        { auth: makerAuth }, afterReceiptDetail.lines[0]!.id,
        { quantity: new Prisma.Decimal('2') },
      ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () => purchaseOrders.deleteLine({ auth: makerAuth }, afterReceiptDetail.lines[0]!.id),
      (error: unknown) => error instanceof ConflictException,
    );

    const second = await createReceipt('6');
    const third = await createReceipt('6');
    await receipts.submit({ auth: makerAuth }, second.id, receiptWorkflow.workflowCode);
    await receipts.submit({ auth: makerAuth }, third.id, receiptWorkflow.workflowCode);
    const simultaneous = await Promise.allSettled([
      receipts.approve({ auth: checkerAuth }, second.id, 'receipt-second'),
      receipts.approve({ auth: checkerAuth }, third.id, 'receipt-third'),
    ]);
    assert.equal(simultaneous.filter((result) => result.status === 'fulfilled').length, 1,
      'Concurrent receipts must not both consume the same remaining PO quantity.');
    const stillOne = await prisma.stockTransaction.count({
      where: { goodsReceiptId: { in: [second.id, third.id] } },
    });
    assert.equal(stillOne, 1);

    const successfulId = simultaneous[0]?.status === 'fulfilled' ? second.id : third.id;
    const concurrentReversal = await receipts.reverse(
      { auth: makerAuth }, successfulId, 'concurrent-reverse', 'Restore PO cancellation eligibility',
    );
    assert.equal(concurrentReversal.stockTransactions.length, 2);

    const reversal = await receipts.reverse({ auth: makerAuth }, first.id, 'receipt-reverse', 'Integration reversal');
    assert.equal(reversal.stockTransactions.length, 2);
    assert.equal(reversal.stockTransactions.reduce((sum, row) => sum.plus(row.quantity), new Prisma.Decimal(0)).toString(), '0');
    await assert.rejects(
      () => prisma.stockTransaction.delete({ where: { id: reversal.stockTransactions[0]!.id } }),
      'Posted Stock Transaction deletion must be rejected.',
    );
    const repeat = await receipts.reverse({ auth: makerAuth }, first.id, 'receipt-reverse', 'Integration reversal');
    assert.equal(repeat.stockTransactions.length, 2);

    assert.deepEqual(
      await balances.balances(makerAuth, {
        projectId: project.id,
        warehouseId: warehouse.id,
        materialId: material.id,
      }),
      [],
      'Net-zero historical balance groups are hidden by default.',
    );
    const zeroBalance = await balances.balances(makerAuth, {
      projectId: project.id,
      warehouseId: warehouse.id,
      materialId: material.id,
      includeInactiveWarehouses: true,
      includeZero: true,
    });
    assert.equal(zeroBalance.length, 1);
    assert.equal(zeroBalance[0]?.quantity, '0.0000');
    const archivedAfterReversal = await prisma.warehouse.update({
      where: { id: warehouse.id },
      data: { isActive: false },
    });
    assert.equal(archivedAfterReversal.isActive, false);

    await purchaseOrders.cancel(
      { auth: makerAuth }, afterReceiptRevision.id, 'Draft revision withdrawn after reversal',
    );

    const cancelled = await purchaseOrders.cancel(
      { auth: makerAuth },
      revision.id,
      'Supplier order cancelled.',
    );
    assert.equal(cancelled.lifecycleState, 'CANCELLED');
    assert.equal(
      cancelled.cancellationReason,
      'Supplier order cancelled.',
    );
    const retainedApproval =
      await prisma.approvalInstance.findUniqueOrThrow({
        where: {
          id: approvedRevision.approvalInstance!.id,
        },
      });
    assert.equal(retainedApproval.approvalState, 'APPROVED');

    await assert.rejects(
      () => prisma.purchaseOrder.delete({ where: { id: revision.id } }),
      'Cancelled Purchase Order revision must remain retained history.',
    );

    await assert.rejects(
      () =>
        purchaseOrders.listOrders(
          outsiderAuth,
          project.id,
        ),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const orderAuditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: ['PURCHASE_ORDER', 'PURCHASE_ORDER_LINE'],
        },
      },
    });
    assert.ok(orderAuditCount >= 9);

    const availableAfterUse =
      await purchaseOrders.availableAwards(
        makerAuth,
        project.id,
      );
    assert.equal(
      availableAfterUse.some((item) => item.id === award.id),
      false,
      'Award already assigned to a PO must not remain available for a second PO.',
    );

    const poLineGuard = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_functiondef(
        'validate_purchase_order_line()'::regprocedure
      ) AS definition
    `;
    assert.match(
      poLineGuard[0]?.definition ?? '',
      /pg_advisory_xact_lock/,
      'Database PO-line guard must serialize the Supplier Award key before checking assignment history.',
    );
    assert.match(
      poLineGuard[0]?.definition ?? '',
      /po-award:/,
      'Database PO-line guard must use the same Supplier Award lock namespace as the service.',
    );
  } finally {
    await prisma.$disconnect();
  }
});
