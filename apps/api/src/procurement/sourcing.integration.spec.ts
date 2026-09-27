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
    ],
    csrfTokenHash: '0'.repeat(64),
  };
}

test('V0.3-C RFQ / Quotations preserves approved-demand sourcing, comparison and line awards', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const suffix = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {
        companyCode: 'RFQ-' + suffix,
        companyName: 'Sourcing Test ' + suffix,
      },
    });
    const otherCompany = await prisma.company.create({
      data: {
        companyCode: 'RFQ-X-' + suffix,
        companyName: 'Other Sourcing Company ' + suffix,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        companyId: company.id,
        customerCode: 'RFQ-C-' + suffix,
        customerName: 'RFQ Customer',
      },
    });
    const makerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'RFQ-M-' + suffix,
        employeeName: 'Procurement Maker',
      },
    });
    const checkerEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'RFQ-CHECK-' + suffix,
        employeeName: 'PR Approver',
      },
    });
    const outsiderEmployee = await prisma.employee.create({
      data: {
        companyId: company.id,
        employeeCode: 'RFQ-OUT-' + suffix,
        employeeName: 'Unassigned Sourcing User',
      },
    });
    const maker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: makerEmployee.id,
        email: 'rfq-maker-' + suffix + '@example.com',
        displayName: 'Procurement Maker',
        passwordHash: 'x',
      },
    });
    const checker = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: checkerEmployee.id,
        email: 'rfq-checker-' + suffix + '@example.com',
        displayName: 'PR Approver',
        passwordHash: 'x',
      },
    });
    const outsider = await prisma.user.create({
      data: {
        companyId: company.id,
        employeeId: outsiderEmployee.id,
        email: 'rfq-outsider-' + suffix + '@example.com',
        displayName: 'Unassigned Sourcing User',
        passwordHash: 'x',
      },
    });
    const project = await prisma.project.create({
      data: {
        companyId: company.id,
        projectCode: 'RFQ-P-' + suffix,
        projectName: 'RFQ Project',
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
          projectRole: 'PR Approver',
        },
      ],
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
        materialCode: 'BAR-' + suffix,
        materialName: 'Reinforcement bar',
        defaultUomId: uom.id,
      },
    });
    const supplierA = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'SUP-A-' + suffix,
        supplierName: 'Supplier A',
      },
    });
    const supplierB = await prisma.supplier.create({
      data: {
        companyId: company.id,
        supplierCode: 'SUP-B-' + suffix,
        supplierName: 'Supplier B',
      },
    });
    const otherSupplier = await prisma.supplier.create({
      data: {
        companyId: otherCompany.id,
        supplierCode: 'SUP-X-' + suffix,
        supplierName: 'Cross Company Supplier',
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
      ],
    });

    const approverRole = await prisma.role.create({
      data: {
        companyId: company.id,
        roleCode: 'RFQ_PR_APPROVER_' + suffix,
        roleName: 'PR Approver',
      },
    });
    const workflow = await prisma.approvalWorkflow.create({
      data: {
        companyId: company.id,
        workflowCode: 'RFQ_PR_' + suffix,
        entityType: 'PURCHASE_REQUEST',
        workflowName: 'Purchase Request Approval',
        steps: {
          create: [
            {
              stepNo: 1,
              stepName: 'Approve Demand',
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

    const makerAuth = auth(company.id, maker.id, ['RFQ_MAKER']);
    const checkerAuth = auth(company.id, checker.id, [
      approverRole.roleCode,
    ]);
    const outsiderAuth = auth(company.id, outsider.id, [
      'RFQ_OUTSIDER',
    ]);

    const pr = await procurement.createRequest(
      { auth: makerAuth },
      project.id,
      'Approved sourcing demand',
    );
    const materialLine = await procurement.createLine(
      { auth: makerAuth },
      pr.id,
      {
        lineType: 'MATERIAL',
        materialId: material.id,
        quantity: new Prisma.Decimal('10'),
        uomId: uom.id,
        requiredOnSite: new Date('2026-10-15T00:00:00.000Z'),
      },
    );
    const serviceLine = await procurement.createLine(
      { auth: makerAuth },
      pr.id,
      {
        lineType: 'SERVICE',
        description: 'Mobile crane service',
        quantity: new Prisma.Decimal('2'),
        uomId: uom.id,
        requiredOnSite: new Date('2026-10-16T00:00:00.000Z'),
      },
    );
    await procurement.submitRequest(
      { auth: makerAuth },
      pr.id,
      workflow.workflowCode,
    );
    const approvedPr = await procurement.approveRequest(
      { auth: checkerAuth },
      pr.id,
      'Demand approved.',
    );
    assert.equal(approvedPr.lifecycleState, 'APPROVED');

    const demand = await sourcing.approvedDemand(
      makerAuth,
      project.id,
    );
    assert.equal(demand.length, 2);
    assert.equal(
      demand.find((line) => line.id === materialLine.id)
        ?.remainingAwardQuantity.toString(),
      '10',
    );

    const rfq = await sourcing.createRfq(
      { auth: makerAuth },
      project.id,
      {
        closingDate: new Date('2026-10-10T00:00:00.000Z'),
        remarks: 'Competitive sourcing',
        lines: [
          {
            purchaseRequestLineId: materialLine.id,
            quantity: new Prisma.Decimal('6'),
          },
          {
            purchaseRequestLineId: serviceLine.id,
            quantity: new Prisma.Decimal('2'),
          },
        ],
      },
    );
    assert.match(rfq.rfqNumber, /^RFQ\d{4}-\d{3}$/);
    assert.equal(rfq.lines.length, 2);
    assert.equal(
      rfq.lines[0]?.materialCodeSnapshot,
      material.materialCode,
    );

    await assert.rejects(
      () =>
        sourcing.createRfq(
          { auth: makerAuth },
          project.id,
          {
            lines: [
              {
                purchaseRequestLineId: materialLine.id,
                quantity: new Prisma.Decimal('11'),
              },
            ],
          },
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );

    const inviteA = await sourcing.inviteSupplier(
      { auth: makerAuth },
      rfq.id,
      supplierA.id,
    );
    const inviteB = await sourcing.inviteSupplier(
      { auth: makerAuth },
      rfq.id,
      supplierB.id,
    );
    assert.equal(inviteA.supplierCodeSnapshot, supplierA.supplierCode);
    assert.equal(inviteB.supplierCodeSnapshot, supplierB.supplierCode);

    await assert.rejects(
      () =>
        sourcing.inviteSupplier(
          { auth: makerAuth },
          rfq.id,
          otherSupplier.id,
        ),
      (error: unknown) => error instanceof UnprocessableEntityException,
    );
    await assert.rejects(
      () =>
        sourcing.inviteSupplier(
          { auth: makerAuth },
          rfq.id,
          supplierA.id,
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const quoteA = await sourcing.createQuotation(
      { auth: makerAuth },
      rfq.id,
      supplierA.id,
      {
        supplierReference: 'A-001',
        quotationDate: new Date('2026-10-05T00:00:00.000Z'),
        validityDate: new Date('2026-11-05T00:00:00.000Z'),
        remarks: 'Supplier A offer',
      },
    );
    const quoteB = await sourcing.createQuotation(
      { auth: makerAuth },
      rfq.id,
      supplierB.id,
      {
        supplierReference: 'B-001',
        quotationDate: new Date('2026-10-05T00:00:00.000Z'),
        validityDate: new Date('2026-11-05T00:00:00.000Z'),
        remarks: 'Supplier B offer',
      },
    );
    await assert.rejects(
      () =>
        sourcing.createQuotation(
          { auth: makerAuth },
          rfq.id,
          supplierA.id,
          {
            quotationDate: new Date('2026-10-06T00:00:00.000Z'),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const rfqDetail = await sourcing.getRfq(makerAuth, rfq.id);
    const rfqMaterialLine = rfqDetail.lines.find(
      (line) => line.purchaseRequestLineId === materialLine.id,
    )!;
    const rfqServiceLine = rfqDetail.lines.find(
      (line) => line.purchaseRequestLineId === serviceLine.id,
    )!;

    const quoteAMaterial = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quoteA.id,
      rfqMaterialLine.id,
      {
        quantity: new Prisma.Decimal('6'),
        unitPrice: new Prisma.Decimal('10'),
        remarks: 'A material',
      },
    );
    const quoteAService = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quoteA.id,
      rfqServiceLine.id,
      {
        quantity: new Prisma.Decimal('2'),
        unitPrice: new Prisma.Decimal('100'),
        remarks: 'A service',
      },
    );
    const quoteBMaterial = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quoteB.id,
      rfqMaterialLine.id,
      {
        quantity: new Prisma.Decimal('5'),
        unitPrice: new Prisma.Decimal('9'),
        remarks: 'B material',
      },
    );
    const quoteBService = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quoteB.id,
      rfqServiceLine.id,
      {
        quantity: new Prisma.Decimal('2'),
        unitPrice: new Prisma.Decimal('90'),
        remarks: 'B service',
      },
    );
    assert.equal(quoteAMaterial.amount.toString(), '60');
    assert.equal(quoteAService.amount.toString(), '200');
    assert.equal(quoteBMaterial.amount.toString(), '45');
    assert.equal(quoteBService.amount.toString(), '180');

    const correctedBMaterial = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      quoteB.id,
      rfqMaterialLine.id,
      {
        quantity: new Prisma.Decimal('5'),
        unitPrice: new Prisma.Decimal('8.5'),
        remarks: 'B corrected material',
      },
    );
    assert.equal(correctedBMaterial.amount.toString(), '42.5');

    const comparison = await sourcing.comparison(makerAuth, rfq.id);
    assert.equal(comparison.lines.length, 2);
    assert.equal(comparison.suppliers.length, 2);
    assert.equal(
      comparison.lines
        .find((line) => line.id === rfqMaterialLine.id)
        ?.offers.find((offer) => offer.supplierId === supplierB.id)
        ?.unitPrice?.toString(),
      '8.5',
    );

    await prisma.supplier.update({
      where: { id: supplierB.id },
      data: {
        supplierCode: 'SUP-B-RENAMED-' + suffix,
        supplierName: 'Supplier B Renamed',
      },
    });

    await assert.rejects(
      () =>
        prisma.quotationAward.create({
          data: {
            rfqId: rfq.id,
            rfqLineId: rfqMaterialLine.id,
            supplierQuotationId: quoteA.id,
            supplierQuotationLineId: correctedBMaterial.id,
            supplierId: supplierA.id,
            supplierCodeSnapshot: supplierA.supplierCode,
            supplierNameSnapshot: supplierA.supplierName,
            supplierReferenceSnapshot: quoteA.supplierReference,
            quotationDateSnapshot: quoteA.quotationDate,
            quantity: correctedBMaterial.quantity,
            uomId: correctedBMaterial.uomId,
            uomCodeSnapshot: correctedBMaterial.uomCodeSnapshot,
            unitPrice: correctedBMaterial.unitPrice,
            amount: correctedBMaterial.amount,
            decisionReason: 'Invalid cross-quotation pairing.',
            selectedByUserId: maker.id,
          },
        }),
      'Award database guard must reject a quotation line from a different quotation header.',
    );

    const materialAward = await sourcing.selectAward(
      { auth: makerAuth },
      rfqMaterialLine.id,
      correctedBMaterial.id,
      'Best commercial offer for material line.',
    );
    const serviceAward = await sourcing.selectAward(
      { auth: makerAuth },
      rfqServiceLine.id,
      quoteAService.id,
      'Selected Supplier A for service capability.',
    );
    assert.equal(materialAward.supplierId, supplierB.id);
    assert.equal(
      materialAward.supplierCodeSnapshot,
      'SUP-B-' + suffix,
    );
    assert.equal(materialAward.supplierNameSnapshot, 'Supplier B');
    assert.equal(serviceAward.supplierId, supplierA.id);
    assert.equal(materialAward.quantity.toString(), '5');
    assert.equal(materialAward.unitPrice.toString(), '8.5');

    const rfqOnlyDetail = await sourcing.getRfqDetail(
      {
        ...makerAuth,
        permissions: ['procurement.rfq.view'],
      },
      rfq.id,
    );
    assert.equal(
      'quotations' in rfqOnlyDetail,
      false,
      'RFQ-only viewers must not receive Supplier Quotation commercial data.',
    );
    assert.equal(
      'awards' in rfqOnlyDetail,
      false,
      'RFQ-only viewers must not receive Supplier Award commercial data.',
    );
    assert.equal(
      rfqOnlyDetail.lines.some((line) => 'award' in line),
      false,
      'RFQ-only viewers must not receive line-level award commercial data.',
    );

    const quotationOnlyDetail = await sourcing.getRfqDetail(
      {
        ...makerAuth,
        permissions: [
          'procurement.quotation.view',
          'procurement.quotation.manage',
        ],
      },
      rfq.id,
    );
    assert.equal(
      'quotations' in quotationOnlyDetail,
      true,
      'Quotation-authorized viewers must receive canonical quotation detail.',
    );
    if (!('quotations' in quotationOnlyDetail)) {
      throw new Error(
        'Quotation-authorized RFQ detail unexpectedly redacted quotations.',
      );
    }
    assert.equal(quotationOnlyDetail.quotations.length, 2);

    const awardGuardDefinition = await prisma.$queryRaw<
      Array<{ definition: string }>
    >`
      SELECT pg_get_functiondef(
        'validate_quotation_award()'::regprocedure
      ) AS definition
    `;
    assert.match(
      awardGuardDefinition[0]?.definition ?? '',
      /pg_advisory_xact_lock/,
      'Database award guard must serialize aggregate demand checks.',
    );
    assert.match(
      awardGuardDefinition[0]?.definition ?? '',
      /pr-demand-award:/,
      'Database award guard must lock by source Purchase Request line.',
    );

    await assert.rejects(
      () =>
        sourcing.upsertQuotationLine(
          { auth: makerAuth },
          quoteB.id,
          rfqMaterialLine.id,
          {
            quantity: new Prisma.Decimal('5'),
            unitPrice: new Prisma.Decimal('7'),
          },
        ),
      (error: unknown) => error instanceof ConflictException,
    );
    await assert.rejects(
      () =>
        sourcing.updateQuotation(
          { auth: makerAuth },
          quoteB.id,
          { supplierReference: 'B-002' },
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const secondRfq = await sourcing.createRfq(
      { auth: makerAuth },
      project.id,
      {
        lines: [
          {
            purchaseRequestLineId: materialLine.id,
            quantity: new Prisma.Decimal('6'),
          },
        ],
      },
    );
    await sourcing.inviteSupplier(
      { auth: makerAuth },
      secondRfq.id,
      supplierA.id,
    );
    const secondQuote = await sourcing.createQuotation(
      { auth: makerAuth },
      secondRfq.id,
      supplierA.id,
      {
        quotationDate: new Date('2026-10-07T00:00:00.000Z'),
      },
    );
    const secondDetail = await sourcing.getRfq(
      makerAuth,
      secondRfq.id,
    );
    const secondQuoteLine = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      secondQuote.id,
      secondDetail.lines[0]!.id,
      {
        quantity: new Prisma.Decimal('6'),
        unitPrice: new Prisma.Decimal('9.5'),
      },
    );
    await assert.rejects(
      () =>
        sourcing.selectAward(
          { auth: makerAuth },
          secondDetail.lines[0]!.id,
          secondQuoteLine.id,
          'Would exceed approved demand.',
        ),
      (error: unknown) => error instanceof ConflictException,
    );

    const correctedSecond = await sourcing.upsertQuotationLine(
      { auth: makerAuth },
      secondQuote.id,
      secondDetail.lines[0]!.id,
      {
        quantity: new Prisma.Decimal('5'),
        unitPrice: new Prisma.Decimal('9.5'),
      },
    );
    const secondAward = await sourcing.selectAward(
      { auth: makerAuth },
      secondDetail.lines[0]!.id,
      correctedSecond.id,
      'Award remaining approved quantity.',
    );
    assert.equal(secondAward.quantity.toString(), '5');

    const demandAfterAwards = await sourcing.approvedDemand(
      makerAuth,
      project.id,
    );
    assert.equal(
      demandAfterAwards.find((line) => line.id === materialLine.id)
        ?.awardedQuantity.toString(),
      '10',
    );
    assert.equal(
      demandAfterAwards.find((line) => line.id === materialLine.id)
        ?.remainingAwardQuantity.toString(),
      '0',
    );
    assert.equal(
      demandAfterAwards.some((line) => 'rfqLines' in line),
      false,
      'Approved-demand response must not expose nested Supplier Award details.',
    );

    await assert.rejects(
      () =>
        prisma.quotationAward.delete({
          where: { id: materialAward.id },
        }),
      'Supplier Award must remain immutable retained history.',
    );
    await assert.rejects(
      () =>
        prisma.rfqLine.update({
          where: { id: rfqMaterialLine.id },
          data: { quantity: '1' },
        }),
      'RFQ source line must remain immutable.',
    );

    await assert.rejects(
      () => sourcing.listRfqs(outsiderAuth, project.id),
      (error: unknown) => error instanceof ForbiddenException,
    );

    const correctionAudit = await prisma.auditLog.findMany({
      where: {
        companyId: company.id,
        entityType: 'SUPPLIER_QUOTATION_LINE',
        action: 'CORRECT_LINE',
      },
    });
    assert.ok(correctionAudit.length >= 2);

    const sourcingAuditCount = await prisma.auditLog.count({
      where: {
        companyId: company.id,
        entityType: {
          in: [
            'RFQ',
            'RFQ_SUPPLIER',
            'SUPPLIER_QUOTATION',
            'SUPPLIER_QUOTATION_LINE',
            'QUOTATION_AWARD',
          ],
        },
      },
    });
    assert.ok(sourcingAuditCount >= 12);
  } finally {
    await prisma.$disconnect();
  }
});
