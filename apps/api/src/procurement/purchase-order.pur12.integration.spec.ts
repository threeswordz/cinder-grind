import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { UnprocessableEntityException } from '@nestjs/common';
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

// NEW PUR12-only native integration, NOT the previously passed PUR01 or PM02
// suite. It must fail closed before touching any retained/production database.
const url = new URL(process.env.DATABASE_URL ?? 'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED, 'YES');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.port, '5432');
assert.equal(url.pathname, '/erp_m4_pur12_native');
const D = (s: string) => new Prisma.Decimal(s);

function actor(
  companyId: string,
  userId: string,
  roleCodes: string[],
): AuthenticatedUserContext {
  return {
    companyId, userId, sessionId: randomUUID(),
    email: 'pur12-' + userId + '@example.invalid',
    displayName: 'PUR12 synthetic actor', roleCodes,
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

test('PUR12 native: MKE/TCJ source-backed PO snapshots, revision, no fake names, SQL denial', async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    const access = new ProjectAccessService(
      prisma, new ProjectScopeService(new AuthorizationService()),
    );
    const audit = new AuditService(prisma);
    const approvals = new ApprovalService(prisma);
    const numbers = new NumberSequenceService(prisma);
    const prs = new ProcurementService(prisma, access, audit, approvals, numbers);
    const sourcing = new SourcingService(prisma, access, audit, numbers);
    const pos = new PurchaseOrderService(prisma, access, audit, approvals, numbers);
    const created: Array<{companyId: string; orderId: string; maker: AuthenticatedUserContext}> = [];

    for (const [companyCode, prefix] of [['MKE', 'K'], ['TCJ', 'T']] as const) {
      const key = randomUUID().slice(0, 8);
      const company = await prisma.company.create({
        data: { companyCode, companyName: 'PUR12 synthetic ' + companyCode },
      });
      const customer = await prisma.customer.create({
        data: { companyId: company.id, customerCode: 'CUS' + key,
          customerName: 'PUR12 synthetic customer', shortName: 'Client' },
      });
      const users = [];
      for (const [index, person] of ['Store', 'Khaimook', 'Jai', 'Ben'].entries()) {
        const emp = await prisma.employee.create({
          data: { companyId: company.id, employeeCode: 'P12E' + index + key,
            employeeName: 'PUR12 ' + person },
        });
        const user = await prisma.user.create({
          data: { companyId: company.id, employeeId: emp.id,
            email: 'pur12-' + person.toLowerCase() + '-' + key + '@example.invalid',
            displayName: person, passwordHash: 'test-only' },
        });
        users.push({emp, user});
      }
      const project = await prisma.project.create({
        data: {
          companyId: company.id, customerId: customer.id,
          projectCode: 'P12' + key, projectName: 'PUR12 test project',
          contractValue: D('250000'),
          plannedStartDate: new Date('2026-11-01T00:00:00Z'),
          plannedCompletionDate: new Date('2027-12-31T00:00:00Z'),
        },
      });
      await prisma.projectMember.createMany({
        data: users.map(({emp}) => ({
          projectId: project.id, employeeId: emp.id, projectRole: 'PUR12 test only',
        })),
      });
      const uom = await prisma.unitOfMeasure.create({
        data: { companyId: company.id, uomCode: 'EA' + key,
          uomName: 'Each', decimalPlaces: 2 },
      });
      for (const [entityType, code, fmt] of [
        ['PURCHASE_REQUEST', 'PURCHASE_REQUEST', 'PRYYMM-###'],
        ['RFQ', 'RFQ', 'RFQYYMM-###'],
        ['PURCHASE_ORDER', 'PURCHASE_ORDER', 'POYYMM-###'],
      ] as const) {
        await prisma.numberSequence.create({
          data: { companyId: company.id, entityType,
            sequenceCode: code, formatTemplate: fmt, resetRule: 'MONTHLY' },
        });
      }
      const pmRole = await prisma.role.create({
        data: { companyId: company.id, roleCode: 'P12_PM_' + key, roleName: 'PM' },
      });
      const benRole = await prisma.role.create({
        data: { companyId: company.id, roleCode: 'P12_BEN_' + key, roleName: 'Ben' },
      });
      const pmFlow = await prisma.approvalWorkflow.create({
        data: { companyId: company.id, workflowCode: 'P12_PR_' + key,
          entityType: 'PURCHASE_REQUEST', workflowName: 'PM',
          steps: { create: [{ stepNo: 1, stepName: 'PM',
            requiredApprovals: 1, stepRoles: { create: [{roleId: pmRole.id}] } }] } },
      });
      const poFlow = await prisma.approvalWorkflow.create({
        data: { companyId: company.id, workflowCode: 'P12_PO_' + key,
          entityType: 'PURCHASE_ORDER', workflowName: 'Ben',
          steps: { create: [{ stepNo: 1, stepName: 'Ben',
            requiredApprovals: 1, stepRoles: { create: [{roleId: benRole.id}] } }] } },
      });
      const store = actor(company.id, users[0]!.user.id, ['STOREKEEPER']);
      const pm = actor(company.id, users[1]!.user.id, ['PROJECT_MANAGER', pmRole.roleCode]);
      const jai = actor(company.id, users[2]!.user.id, ['PROCUREMENT_OFFICER']);
      const ben = actor(company.id, users[3]!.user.id, ['MANAGEMENT', benRole.roleCode]);
      const supplier = await prisma.supplier.create({
        data: { companyId: company.id, supplierCode: 'SUP' + key,
          supplierName: 'Long legal supplier', shortName: 'ABC' },
      });

      async function selectedAward(label: string) {
        const request = await prs.createRequest({auth: store}, project.id, label);
        const line = await prs.createLine({auth: store}, request.id, {
          lineType: 'SERVICE', description: label, quantity: D('1'), uomId: uom.id,
        });
        await prs.submitRequest({auth: store}, request.id, pmFlow.workflowCode);
        await prs.approveRequest({auth: pm}, request.id, 'Independent source approval');
        const rfq = await sourcing.createRfq({auth: jai}, project.id, {
          lines: [{ purchaseRequestLineId: line.id, quantity: D('1') }],
        });
        await sourcing.inviteSupplier({auth: jai}, rfq.id, supplier.id);
        const quote = await sourcing.createQuotation(
          {auth: jai}, rfq.id, supplier.id,
          {quotationDate: new Date(), supplierReference: label},
        );
        const quoteLine = await sourcing.upsertQuotationLine(
          {auth: jai}, quote.id, rfq.lines[0]!.id,
          {quantity: D('1'), unitPrice: D('1000')},
        );
        return sourcing.selectAward({auth: jai}, rfq.lines[0]!.id,
          quoteLine.id, 'PUR12 test selection');
      }

      const award = await selectedAward(companyCode + '-first');
      const order = await pos.createOrder({auth: jai}, project.id, [award.id]);
      assert.match(order.poNumber, /^PO\d{4}-\d{3}$/);
      assert.equal(order.displayNumber, prefix + '-' + order.poNumber + ' ABC');
      assert.equal(order.supplierShortNameSnapshot, 'ABC');
      assert.notEqual(order.supplierShortNameSnapshot, supplier.supplierCode);

      // Partner master edits must never change an existing PO identity.
      await prisma.supplier.update({
        where: {id: supplier.id}, data: {shortName: 'LATER'},
      });
      const old = await pos.getOrder(jai, order.id);
      assert.equal(old.displayNumber, order.displayNumber);
      assert.equal(old.supplierShortNameSnapshot, 'ABC');

      await assert.rejects(
        prisma.$executeRaw`UPDATE "purchase_orders"
          SET "po_display_number" = 'FORGED'
          WHERE "id" = ${order.id}::uuid`,
        /PO_DOCUMENT_IDENTITY_IMMUTABLE/,
      );
      const safe = await prisma.purchaseOrder.findUniqueOrThrow({where:{id:order.id}});
      assert.equal(safe.displayNumber, order.displayNumber);

      // No short name is not a supplier code: it must deny BEFORE allocating
      // another canonical PO number, even with a real approved RFQ/award.
      await prisma.supplier.update({
        where: {id: supplier.id}, data: {shortName: null},
      });
      const beforeSequence = await prisma.numberSequence.findUniqueOrThrow({
        where:{companyId_sequenceCode:{companyId:company.id, sequenceCode:'PURCHASE_ORDER'}},
      });
      const secondAward = await selectedAward(companyCode + '-missing-name');
      await assert.rejects(
        () => pos.createOrder({auth: jai}, project.id, [secondAward.id]),
        (error: unknown) => error instanceof UnprocessableEntityException &&
          (error.getResponse() as {code?:string}).code === 'PO_SUPPLIER_SHORT_NAME_REQUIRED',
      );
      const afterSequence = await prisma.numberSequence.findUniqueOrThrow({
        where:{companyId_sequenceCode:{companyId:company.id, sequenceCode:'PURCHASE_ORDER'}},
      });
      assert.equal(afterSequence.nextValue, beforeSequence.nextValue);

      // Rejected duplicate award and an error AFTER sequence allocation
      // must not consume a number or leave a partial PO/line/audit.
      await prisma.supplier.update({where:{id:supplier.id},data:{shortName:'LATER'}});
      const seq=()=>prisma.numberSequence.findUniqueOrThrow({
        where:{companyId_sequenceCode:{companyId:company.id,sequenceCode:'PURCHASE_ORDER'}},
      });
      const snapshot=await seq();
      const poCount=await prisma.purchaseOrder.count({where:{companyId:company.id}});
      await assert.rejects(()=>pos.createOrder({auth:jai},project.id,[award.id]),
        (e:unknown)=>typeof e==='object'&&e!==null&&'getResponse' in e&&
          typeof e.getResponse==='function'&&e.getResponse()?.code==='PO_AWARD_ALREADY_USED');
      assert.equal((await seq()).nextValue,snapshot.nextValue);
      const realRecord=audit.record.bind(audit);
      audit.record=async (...args:Parameters<AuditService['record']>)=>{
        if(args[0].entityType==='PURCHASE_ORDER'&&args[0].action==='CREATE_DRAFT'){
          assert.ok(args[1],'PO audit must be in the same transaction');
          throw Error('PUR12_TEST_POST_ALLOCATION_FAILURE');
        }
        return realRecord(...args);
      };
      try {
        await assert.rejects(()=>pos.createOrder({auth:jai},project.id,[secondAward.id]),
          /PUR12_TEST_POST_ALLOCATION_FAILURE/);
      }finally{audit.record=realRecord;}
      assert.equal((await seq()).nextValue,snapshot.nextValue);
      assert.equal((await seq()).lastPeriodKey,snapshot.lastPeriodKey);
      assert.equal(await prisma.purchaseOrder.count({where:{companyId:company.id}}),poCount);
      const retry=await pos.createOrder({auth:jai},project.id,[secondAward.id]);
      assert.equal(retry.displayNumber,prefix+'-'+retry.poNumber+' LATER');
      assert.equal((await seq()).nextValue,snapshot.nextValue+1);
      console.log('PUR12_NATIVE_FAILED_DRAFT_ATOMIC_SEQUENCE_ROLLBACK_AND_RETRY_PASS',companyCode);

      // Distinct source awards compete for the same Company sequence. The
      // SERIALIZABLE loser must be a controlled conflict, not an HTTP 500;
      // no implicit server retry or sequence gap is permitted.
      const concurrentAwards = [
        await selectedAward(companyCode + '-concurrent-a'),
        await selectedAward(companyCode + '-concurrent-b'),
      ];
      const startSequence = await seq();
      const startCount = await prisma.purchaseOrder.count({where:{companyId:company.id}});
      const attempts = await Promise.allSettled(concurrentAwards.map(source =>
        pos.createOrder({auth:jai},project.id,[source.id])));
      const successful = attempts.filter(result => result.status === 'fulfilled');
      assert.ok(successful.length >= 1, 'At least one competing transaction must commit');
      assert.equal((await seq()).nextValue, startSequence.nextValue + successful.length);
      assert.equal(await prisma.purchaseOrder.count({where:{companyId:company.id}}),
        startCount + successful.length);
      for (const [index, result] of attempts.entries()) {
        if (result.status === 'rejected') {
          const error = result.reason;
          assert.equal(error?.getStatus?.(), 409);
          assert.equal(error?.getResponse?.()?.code, 'PO_CREATE_CONCURRENT_SOURCE_CHANGE');
          // Explicit fresh request from the maker after checking the source.
          await pos.createOrder({auth:jai},project.id,[concurrentAwards[index]!.id]);
        }
      }
      const committed = await prisma.purchaseOrder.findMany({
        where:{companyId:company.id,lines:{some:{quotationAwardId:{in:concurrentAwards.map(source=>source.id)}}}},
        include:{lines:true},
      });
      assert.equal(committed.length,2);
      assert.equal(new Set(committed.map(row=>row.poNumber)).size,2);
      assert.deepEqual(committed.map(row=>Number(row.poNumber.split('-').at(-1))).sort((a,b)=>a-b),
        [startSequence.nextValue,startSequence.nextValue+1]);
      for (const row of committed) {
        assert.equal(row.displayNumber,prefix+'-'+row.poNumber+' LATER');
        assert.equal(row.lines.length,1);
      }
      assert.equal((await seq()).nextValue,startSequence.nextValue+2);
      assert.equal(await prisma.purchaseOrder.count({where:{companyId:company.id}}),startCount+2);
      assert.equal(await prisma.auditLog.count({
        where:{companyId:company.id,entityType:'PURCHASE_ORDER',action:'CREATE_DRAFT',
          entityId:{in:committed.map(row=>row.id)}},
      }),2);
      console.log('PUR12_NATIVE_CONCURRENT_DISTINCT_AWARD_NUMBERING_PASS',companyCode);
      await prisma.supplier.update({where:{id:supplier.id},data:{shortName:null}});

      // Approved PO revision inherits immutable initial snapshot.
      await pos.updateOrder({auth: jai}, order.id, {
        discountAmount:D('0'), freightAmount:D('0'),
        additionalChargeAmount:D('0'), vatRatePercent:D('7'),
      });
      await pos.submit({auth: jai}, order.id, poFlow.workflowCode);
      await pos.approve({auth: ben}, order.id, 'PUR12 approved PO');
      const revision = await pos.revise({auth: jai}, order.id, 'Correction');
      assert.equal(revision.poNumber, order.poNumber);
      assert.equal(revision.displayNumber, order.displayNumber);
      assert.equal(revision.supplierShortNameSnapshot, 'ABC');
      assert.equal(revision.revisionNo, 1);
      created.push({companyId:company.id, orderId:order.id, maker:jai});
    }

    // Same canonical sequence value in separate Companies remains isolated;
    // different visible prefixes and exact Company guard, never cross-Company.
    assert.equal(created.length, 2);
    assert.notEqual(created[0]!.companyId, created[1]!.companyId);
    await assert.rejects(
      () => pos.getOrder(created[0]!.maker, created[1]!.orderId),
    );
    console.log('PUR12_NATIVE_MKE_TCJ_NEW_PO_REVISION_SQL_GUARD_SCOPE_PASS');
  } finally {
    await prisma.$disconnect();
  }
});
