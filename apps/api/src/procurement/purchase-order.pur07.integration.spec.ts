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
import { PurchaseOrderPur07Service } from './purchase-order-pur07.service';
import { PurchaseOrderService } from './purchase-order.service';
import { SourcingService } from './sourcing.service';

// One NEW scoped native PUR07 proof: no historic procurement suite, no real
// staff data, no actual outbound email or LINE.
const databaseUrl = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED, 'YES');
assert.ok(['localhost', '127.0.0.1'].includes(databaseUrl.hostname));
assert.equal(databaseUrl.pathname, '/erp_m4_pur07_native');
const D = (value: string) => new Prisma.Decimal(value);

function actor(companyId: string, userId: string, roleCodes: string[]): AuthenticatedUserContext {
  return {
    sessionId: randomUUID(), companyId, userId,
    email: userId + '@example.invalid', displayName: 'PUR07 synthetic actor',
    roleCodes, csrfTokenHash: '0'.repeat(64),
    permissions: [
      'procurement.pr.view', 'procurement.pr.manage',
      'procurement.pr.submit', 'procurement.pr.approve',
      'procurement.rfq.view', 'procurement.rfq.manage',
      'procurement.quotation.view', 'procurement.quotation.manage',
      'procurement.award.select', 'procurement.po.view',
      'procurement.po.create', 'procurement.po.edit',
      'procurement.po.submit', 'procurement.po.approve',
    ],
  };
}

test('PUR07 native: approved PDF bytes and Jai-only append-only external send/ack proof', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const key = randomUUID().slice(0, 8);
    const company = await prisma.company.create({
      data: {companyCode: 'MKE', companyName: 'MKE synthetic PDF'},
    });
    const customer = await prisma.customer.create({
      data: {companyId: company.id, customerCode:'CPDF' + key,
        customerName:'PDF Customer'},
    });
    const people = [];
    for (const [index, name] of ['Store','Khaimook','Jai','Ben','Outsider'].entries()) {
      const employee = await prisma.employee.create({
        data: {companyId: company.id, employeeCode:'PDFE'+index+key,
          employeeName:'Test '+name},
      });
      const user = await prisma.user.create({
        data: {companyId: company.id, employeeId:employee.id,
          displayName:name, email:'pdf-'+index+'-'+key+'@example.invalid',
          passwordHash:'fake-only'},
      });
      people.push({employee,user});
    }
    const project = await prisma.project.create({
      data: {
        companyId:company.id,customerId:customer.id,projectCode:'PDFPR'+key,
        projectName:'Construction Site PDF',
        contractValue:D('100000'),plannedStartDate:new Date('2026-10-01T00:00:00Z'),
        plannedCompletionDate:new Date('2027-01-01T00:00:00Z'),
      },
    });
    await prisma.projectMember.createMany({
      data: people.slice(0,4).map(({employee})=>({
        projectId:project.id,employeeId:employee.id,projectRole:'PUR07 test',
      })),
    });
    const uom = await prisma.unitOfMeasure.create({
      data:{companyId:company.id,uomCode:'EA'+key,uomName:'Each',decimalPlaces:2},
    });
    for(const [entityType,sequenceCode,formatTemplate] of [
      ['PURCHASE_REQUEST','PURCHASE_REQUEST','PRYYMM-###'],
      ['RFQ','RFQ','RFQYYMM-###'],
      ['PURCHASE_ORDER','PURCHASE_ORDER','POYYMM-###'],
    ] as const) {
      await prisma.numberSequence.create({
        data: {companyId:company.id,entityType,sequenceCode,formatTemplate,resetRule:'MONTHLY'},
      });
    }
    const pmRole = await prisma.role.create({
      data: {companyId:company.id,roleCode:'PDF_PM_'+key,roleName:'PM actor'},
    });
    const benRole = await prisma.role.create({
      data: {companyId:company.id,roleCode:'PDF_BEN_'+key,roleName:'Ben actor'},
    });
    const pmFlow = await prisma.approvalWorkflow.create({
      data: {companyId:company.id,workflowCode:'PDF_PR_'+key,
        entityType:'PURCHASE_REQUEST',workflowName:'Independent Khaimook',
        steps:{create:[{stepNo:1,stepName:'PM',requiredApprovals:1,
          stepRoles:{create:[{roleId:pmRole.id}]}}]}},
    });
    const poFlow = await prisma.approvalWorkflow.create({
      data: {companyId:company.id,workflowCode:'PDF_PO_'+key,
        entityType:'PURCHASE_ORDER',workflowName:'Independent Ben',
        steps:{create:[{stepNo:1,stepName:'Ben',requiredApprovals:1,
          stepRoles:{create:[{roleId:benRole.id}]}}]}},
    });
    const access = new ProjectAccessService(prisma,
      new ProjectScopeService(new AuthorizationService()));
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const prs = new ProcurementService(prisma,access,audit,approvals,numbers);
    const sourcing = new SourcingService(prisma,access,audit,numbers);
    const pos = new PurchaseOrderService(prisma,access,audit,approvals,numbers);
    const pur07 = new PurchaseOrderPur07Service(prisma,access,audit,pos);
    const store = actor(company.id,people[0]!.user.id,['STOREKEEPER']);
    const khaimook = actor(company.id,people[1]!.user.id,['PROJECT_MANAGER',pmRole.roleCode]);
    const jai = actor(company.id,people[2]!.user.id,['PROCUREMENT_OFFICER']);
    const ben = actor(company.id,people[3]!.user.id,['MANAGEMENT',benRole.roleCode]);
    const outsider = actor(company.id,people[4]!.user.id,['FINANCE_OFFICER']);
    const supplier = await prisma.supplier.create({
      data:{companyId:company.id,supplierCode:'PDF'+key,
        supplierName:'ABC Concrete Company Limited',shortName:'ABC'},
    });
    const request = await prs.createRequest({auth:store},project.id,'Concrete order');
    const line = await prs.createLine({auth:store},request.id,{
      lineType:'SERVICE',description:'Concrete blocks',quantity:D('2'),uomId:uom.id,
    });
    await prs.submitRequest({auth:store},request.id,pmFlow.workflowCode);
    await prs.approveRequest({auth:khaimook},request.id,'Approved building need');
    const rfq = await sourcing.createRfq({auth:jai},project.id,{
      lines:[{purchaseRequestLineId:line.id,quantity:D('2')}],
    });
    await sourcing.inviteSupplier({auth:jai},rfq.id,supplier.id);
    const quotation = await sourcing.createQuotation({auth:jai},rfq.id,supplier.id,{
      quotationDate:new Date(),supplierReference:'PDF quote',
    });
    const quoteLine = await sourcing.upsertQuotationLine({auth:jai},quotation.id,rfq.lines[0]!.id,{
      quantity:D('2'),unitPrice:D('1000'),
    });
    const award = await sourcing.selectAward({auth:jai},rfq.lines[0]!.id,quoteLine.id,'PDF sourced award');
    const order = await pos.createOrder({auth:jai},project.id,[award.id]);
    assert.match(order.displayNumber ?? '',/^K-PO\d{4}-\d{3} ABC$/);
    await assert.rejects(()=>pur07.approvedPdf(jai,order.id));
    await assert.rejects(()=>pur07.record({auth:jai},order.id,{
      kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',
      evidenceReference:'Email thread ABC-001',
    }));
    await pos.updateOrder({auth:jai},order.id,{
      discountAmount:D('0'),freightAmount:D('0'),additionalChargeAmount:D('0'),
      vatRatePercent:D('7'),deliveryLocation:'SITE 1',
      paymentTerms:'Net 30',
    });
    await pos.submit({auth:jai},order.id,poFlow.workflowCode);
    await pos.approve({auth:ben},order.id,'Approved vendor commitment');
    const file = await pur07.approvedPdf(jai,order.id);
    assert.match(file.fileName,/^K-PO\d{4}-\d{3} ABC\.pdf$/);
    assert.ok(file.bytes.subarray(0,8).toString('ascii').startsWith('%PDF-1.4'));
    assert.ok(file.bytes.toString('ascii').includes('ABC Concrete Company Limited'));
    assert.ok(file.bytes.toString('ascii').includes('Total incl VAT: 2140.00'));
    assert.match(file.sha256,/^[a-f0-9]{64}$/);
    assert.equal((await pur07.approvedPdf(jai,order.id)).sha256,file.sha256);
    await assert.rejects(
      ()=>pur07.record({auth:outsider},order.id,{
        kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',
        evidenceReference:'Fake send without purchasing role',
      }),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    await assert.rejects(
      ()=>pur07.record({auth:jai},order.id,{
        kind:'ACKNOWLEDGMENT',channel:'EMAIL',recipient:'supplier@example.invalid',
        evidenceReference:'Fake reply to nonexisting send',acknowledgesEventId:randomUUID(),
      }),
    );
    await assert.rejects(
      ()=>pur07.record({auth:jai},order.id,{
        kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',
        evidenceReference:'Attempt to link cross-scope evidence',evidenceDocumentId:randomUUID(),
      }),
    );
    const sent = await pur07.record({auth:jai},order.id,{
      kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',
      evidenceReference:'SYNTHETIC email thread PDF-001; no email actually transmitted',
    });
    assert.equal(sent.kind,'DISPATCH');
    assert.equal(sent.pdfFileName,file.fileName);
    assert.equal(sent.pdfSha256,null,'ERP must not fabricate hash of external sent attachment');
    const ack = await pur07.record({auth:jai},order.id,{
      kind:'ACKNOWLEDGMENT',channel:'LINE',recipient:'supplier LINE contact',
      evidenceReference:'SYNTHETIC LINE screenshot reference; no message transmitted',
      acknowledgesEventId:sent.id,
    });
    assert.equal(ack.acknowledgesEventId,sent.id);
    assert.equal((await pur07.events(jai,order.id)).length,2);
    await assert.rejects(prisma.poDispatchEvent.update({
      where:{id:sent.id},data:{evidenceReference:'MUTATED'},
    }),/PO_DISPATCH_EVENT_IMMUTABLE/);
    await assert.rejects(prisma.poDispatchEvent.delete({where:{id:ack.id}}),
      /PO_DISPATCH_EVENT_IMMUTABLE/);
    const otherCompany = await prisma.company.create({
      data:{companyCode:'OTHER'+key,companyName:'Other company'},
    });
    const wrongCompany = actor(otherCompany.id,jai.userId,['PROCUREMENT_OFFICER']);
    await assert.rejects(()=>pur07.events(wrongCompany,order.id));
    await assert.rejects(()=>pur07.approvedPdf(wrongCompany,order.id));
    const rows = await prisma.auditLog.findMany({
      where:{companyId:company.id,entityType:'PURCHASE_ORDER',entityId:order.id,
        action:{in:['EXTERNAL_SEND_REPORTED','EXTERNAL_ACK_REPORTED']}},
    });
    assert.equal(rows.length,2);
    console.log('PUR07_NATIVE_APPROVED_PDF_REPORTED_SEND_ACK_IMMUTABILITY_SCOPE_PASS');
  } finally {
    await prisma.$disconnect();
  }
});
