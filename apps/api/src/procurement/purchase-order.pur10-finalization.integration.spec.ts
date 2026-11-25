import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import {
  ConflictException, ForbiddenException, NotFoundException,
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
import { PurchaseOrderService } from './purchase-order.service';
import { SourcingService } from './sourcing.service';
import { PurchaseOrderCancellationCaseService } from './purchase-order-cancellation-case.service';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';

// NEW bounded PUR04 actual PostgreSQL17.11 behavior, not a rerun of the
// previously passed PUR04 draft-edit/THB quote/Chrome flows.
// Disposable DB only: never retained MKE/TCJ, Mac or Production.
const D=(value:string)=>new Prisma.Decimal(value);
test('PUR10 native: real approved PO, independent named Jai/Khaimook/Ben, atomic single cancellation, protected audit history', async () => {
  const prisma=new PrismaService();
  await prisma.$connect();
  try {
    const key=randomUUID().slice(0,8);
    const company=await prisma.company.create({data:{
      companyCode:'P04REV-'+key,companyName:'Disposable PUR04 revision '+key,
    }});
    const outsiderCompany=await prisma.company.create({data:{
      companyCode:'P04EXT-'+key,companyName:'Disposable outsider Company',
    }});
    const customer=await prisma.customer.create({data:{
      companyId:company.id,customerCode:'P04-C-'+key,
      customerName:'Synthetic PUR04 customer',
    }});
    const project=await prisma.project.create({data:{
      companyId:company.id,customerId:customer.id,
      projectCode:'P04-SITE-'+key,projectName:'Eligible single Project',
      contractValue:D('100000'),
      plannedStartDate:new Date('2026-10-01T00:00:00Z'),
      plannedCompletionDate:new Date('2027-12-31T00:00:00Z'),
    }});
    const otherProject=await prisma.project.create({data:{
      companyId:company.id,customerId:customer.id,
      projectCode:'P04-OTHER-'+key,projectName:'Unrelated same-Company Project',
      contractValue:D('100000'),
      plannedStartDate:new Date('2026-10-01T00:00:00Z'),
      plannedCompletionDate:new Date('2027-12-31T00:00:00Z'),
    }});
    const uom=await prisma.unitOfMeasure.create({data:{
      companyId:company.id,uomCode:'EA-'+key,uomName:'Each',
      decimalPlaces:2,
    }});
    for(const [entityType,sequenceCode,formatTemplate] of [
      ['PURCHASE_REQUEST','PURCHASE_REQUEST','PRYYMM-###'],
      ['RFQ','RFQ','RFQYYMM-###'],
      ['PURCHASE_ORDER','PURCHASE_ORDER','POYYMM-###'],
    ] as const){
      await prisma.numberSequence.create({data:{
        companyId:company.id,entityType,sequenceCode,formatTemplate,
        resetRule:'MONTHLY',
      }});
    }
    async function actor(label:string, companyId:string, projectId?:string) {
      const employee=await prisma.employee.create({data:{
        companyId,employeeCode:label.slice(0,4)+key,
        employeeName:'Synthetic '+label,
      }});
      const user=await prisma.user.create({data:{
        companyId,employeeId:employee.id,
        email:label.toLowerCase()+'-'+key+'@example.invalid',
        displayName:'Synthetic '+label,passwordHash:'no-login',
      }});
      if(projectId)await prisma.projectMember.create({data:{
        employeeId:employee.id,projectId,projectRole:'PUR04 isolated test',
      }});
      return {user,auth:{
        companyId,userId:user.id,sessionId:randomUUID(),
        email:user.email,displayName:user.displayName,
        roleCodes:label==='Ben'?['MANAGEMENT','PUR04_BEN_'+key]:
          label==='Khaimook'?['PROJECT_MANAGER','PUR04_PM_'+key]:
          ['PROCUREMENT_OFFICER'],
        permissions:[
          'procurement.pr.view','procurement.pr.manage',
          'procurement.pr.submit','procurement.pr.approve',
          'procurement.rfq.view','procurement.rfq.manage',
          'procurement.quotation.view','procurement.quotation.manage',
          'procurement.award.select','procurement.po.view',
          'procurement.po.create','procurement.po.edit',
          'procurement.po.submit','procurement.po.approve',
          'procurement.po.revise',
        ],
        csrfTokenHash:'0'.repeat(64),
      } as AuthenticatedUserContext};
    }
    const store=await actor('Store',company.id,project.id);
    const khaimook=await actor('Khaimook',company.id,project.id);
    const jai=await actor('Jai',company.id,project.id);
    const ben=await actor('Ben',company.id,project.id);
    const wrongProjectActor=await actor('OtherPM',company.id,otherProject.id);
    const foreignActor=await actor('Foreign',outsiderCompany.id);
    const prRole=await prisma.role.create({data:{
      companyId:company.id,roleCode:'PUR04_PM_'+key,
      roleName:'Synthetic independent PR approver',
    }});
    const poRole=await prisma.role.create({data:{
      companyId:company.id,roleCode:'PUR04_BEN_'+key,
      roleName:'Synthetic independent PO approver',
    }});
    const prFlow=await prisma.approvalWorkflow.create({data:{
      companyId:company.id,workflowCode:'PUR04_PR_'+key,
      workflowName:'PUR04 test PM approval',
      entityType:'PURCHASE_REQUEST',
      steps:{create:[{stepNo:1,stepName:'PM check',requiredApprovals:1,
        stepRoles:{create:[{roleId:prRole.id}]}}]},
    }});
    const poFlow=await prisma.approvalWorkflow.create({data:{
      companyId:company.id,workflowCode:'PUR04_PO_'+key,
      workflowName:'PUR04 test Ben approval',
      entityType:'PURCHASE_ORDER',
      steps:{create:[{stepNo:1,stepName:'Ben approval',requiredApprovals:1,
        stepRoles:{create:[{roleId:poRole.id}]}}]},
    }});
    const supplier=await prisma.supplier.create({data:{
      companyId:company.id,supplierCode:'P04S-'+key,
      supplierName:'PUR04 disposable THB supplier',
    }});
    const scope=new ProjectAccessService(
      prisma,new ProjectScopeService(new AuthorizationService()),
    );
    const audit=new AuditService(prisma);
    const approval=new ApprovalService(prisma);
    const numbers=new NumberSequenceService(prisma);
    const prs=new ProcurementService(prisma,scope,audit,approval,numbers);
    const sourcing=new SourcingService(prisma,scope,audit,numbers);
    const orders=new PurchaseOrderService(prisma,scope,audit,approval,numbers);

    // Normal published services, not direct fake award/PO rows:
    // original Store demand, real Khaimook approval, Jai THB RFQ/award,
    // final Ben-approved PO. Distinct test asserts only the NEW revision.
    const request=await prs.createRequest({auth:store.auth},project.id,'PUR04 approved revision');
    const requestLine=await prs.createLine({auth:store.auth},request.id,{
      lineType:'SERVICE',description:'One-Project synthetic service',
      quantity:D('1'),uomId:uom.id,
    });
    await prs.submitRequest({auth:store.auth},request.id,prFlow.workflowCode);
    await prs.approveRequest({auth:khaimook.auth},request.id,'Demand valid');
    const rfq=await sourcing.createRfq({auth:store.auth},project.id,{
      lines:[{purchaseRequestLineId:requestLine.id,quantity:D('1')}],
    });
    await sourcing.inviteSupplier({auth:jai.auth},rfq.id,supplier.id);
    const quotation=await sourcing.createQuotation(
      {auth:jai.auth},rfq.id,supplier.id,
      {quotationDate:new Date(),supplierReference:'P04REV-'+key},
    );
    assert.equal(quotation.currencyCode,'THB');
    const quoteLine=await sourcing.upsertQuotationLine(
      {auth:jai.auth},quotation.id,rfq.lines[0]!.id,
      {quantity:D('1'),unitPrice:D('9000')},
    );
    const award=await sourcing.selectAward(
      {auth:jai.auth},rfq.lines[0]!.id,quoteLine.id,
      'PUR04 bona fide THB supplier source',
    );
    const original=await orders.createOrder(
      {auth:jai.auth},project.id,[award.id],'Original commercial baseline',
    );
    const fields={
      deliveryLocation:'Site loading dock 3',
      deliveryContact:null,
      deliveryTerms:'Delivery by scheduled pickup',
      paymentTerms:'30 days after accepted goods',
      creditTerms:null,
      discountAmount:D('100.25'),
      freightAmount:D('20.50'),
      additionalChargeAmount:D('3.75'),
      vatRatePercent:D('7.00'),
      supplierQuoteExceptionReason:null,
    };
    await orders.updateOrder({auth:jai.auth},original.id,fields);
    await orders.submit({auth:jai.auth},original.id,poFlow.workflowCode);
    const approved=await orders.approve({auth:ben.auth},original.id,'Commercial offer reviewed');
    assert.equal(approved.lifecycleState,'APPROVED');
    const approvedOriginal=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:original.id},include:{lines:true},
    });
    assert.ok(approvedOriginal.approvalInstanceId);
    assert.equal(approvedOriginal.lines.length,1);

    // This test uses the already-proven real PR/RFQ/award/PO service journey
    // to establish a bona-fide approved THB PO before exercising ONLY the
    // new PUR10 cancellation path. No existing PUR04 browser/PG rerun.

    const roleSetup: Array<{
      person: typeof jai;
      code: string;
      permissions: string[];
    }> = [
      { person: jai, code: 'PROCUREMENT_OFFICER',
        permissions: ['procurement.po.view', 'procurement.po.create'] },
      { person: khaimook, code: 'PROJECT_MANAGER',
        permissions: ['procurement.po.view'] },
      { person: ben, code: 'MANAGEMENT',
        permissions: ['procurement.po.view', 'procurement.po.approve', 'procurement.po.cancel'] },
    ];
    const auths=new Map<string,AuthenticatedUserContext>();
    for (const entry of roleSetup) {
      const role=await prisma.role.create({data:{
        companyId:company.id,roleCode:entry.code,roleName:'PUR10 synthetic '+entry.code,
      }});
      await prisma.userRole.create({data:{
        companyId:company.id,userId:entry.person.user.id,roleId:role.id,
      }});
      for(const permissionCode of entry.permissions){
        const permission=await prisma.permission.upsert({where:{permissionCode},
          create:{permissionCode,moduleCode:'PROCUREMENT',description:'PUR10 synthetic role'},
          update:{},
        });
        await prisma.rolePermission.create({data:{roleId:role.id,permissionId:permission.id}});
      }
      const session=await prisma.userSession.create({data:{
        userId:entry.person.user.id,
        tokenHash:randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,''),
        csrfTokenHash:'c'.repeat(64),
        expiresAt:new Date(Date.now()+3_600_000),
      }});
      auths.set(entry.code,{
        ...entry.person.auth, sessionId:session.id,
        permissions:[...new Set([...entry.person.auth.permissions,...entry.permissions])],
      });
    }
    const jaiAuth=auths.get('PROCUREMENT_OFFICER')!;
    const pmAuth=auths.get('PROJECT_MANAGER')!;
    const benAuth=auths.get('MANAGEMENT')!;
    await prisma.systemSetting.create({data:{
      companyId:company.id,settingKey:'PUR10_NAMED_ACTORS_V1',
      settingValue:{
        jai:jai.user.id,khaimook:khaimook.user.id,ben:ben.user.id,
      },
    }});

    const cases=new PurchaseOrderCancellationCaseService(prisma,scope,orders);
    const unchanged=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:approvedOriginal.id},select:{cancelledAt:true,updatedAt:true},
    });
    assert.equal(unchanged.cancelledAt,null);
    await assert.rejects(
      ()=>orders.cancel({auth:jaiAuth},approvedOriginal.id,'Direct bypass should never work'),
      (e:unknown)=>e instanceof ConflictException &&
        (e.getResponse() as {code?:string}).code==='PUR10_INDEPENDENT_CANCELLATION_REVIEW_REQUIRED',
    );

    const zero=await cases.read(jaiAuth,approvedOriginal.id);
    assert.equal(zero.case,null);
    const proposed=await cases.transition({auth:jaiAuth},approvedOriginal.id,
      'PROPOSE',0,null,'Supplier cancellation discussed and documented');
    assert.deepEqual([proposed.status,proposed.poCancelled,proposed.version],
      ['PM_PENDING',false,1]);

    await assert.rejects(
      ()=>cases.transition({auth:jaiAuth},approvedOriginal.id,'PM_FORWARD',1,
        proposed.expectedPreviousEventId,'Jai cannot self-review'),
      (e:unknown)=>e instanceof ForbiddenException || e instanceof ConflictException,
    );
    await assert.rejects(
      ()=>cases.transition({auth:pmAuth},approvedOriginal.id,'PM_FORWARD',0,
        proposed.expectedPreviousEventId,'Stale version attempt'),
      (e:unknown)=>e instanceof ConflictException,
    );
    const checked=await cases.transition({auth:pmAuth},approvedOriginal.id,
      'PM_FORWARD',1,proposed.expectedPreviousEventId,
      'Project requires no further quantities');
    assert.deepEqual([checked.status,checked.version],['BEN_PENDING',2]);
    const approvedCase=await cases.transition({auth:benAuth},approvedOriginal.id,
      'BEN_APPROVE',2,checked.expectedPreviousEventId,
      'Approved after Khaimook site review');
    assert.equal(approvedCase.status,'BEN_APPROVED');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:approvedOriginal.id},select:{cancelledAt:true},
    })).cancelledAt,null);

    const finalArgs={
      supplierAgreementEvidence:'Supplier confirmed cancellation reference PUR10-TEST-'+key,
      supplierAgreed:true,noDepositOrPenalty:true,noDeliveryOrInvoice:true,
    };

    // Missing PUR10 negatives only. They share the already-proven real
    // synthetic approved PO fixture, without rerunning unrelated packages.
    // A cached all-projects claim MUST NOT bypass a revoked live DB grant.
    const pmRole=await prisma.role.findFirstOrThrow({where:{
      companyId:company.id,roleCode:'PROJECT_MANAGER',
    }});
    await prisma.userRole.create({data:{
      companyId:company.id,userId:wrongProjectActor.user.id,roleId:pmRole.id,
    }});
    const wrongSession=await prisma.userSession.create({data:{
      userId:wrongProjectActor.user.id,
      tokenHash:randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,''),
      csrfTokenHash:'d'.repeat(64),expiresAt:new Date(Date.now()+3_600_000),
    }});
    const wrongScopeAuth:AuthenticatedUserContext={
      ...wrongProjectActor.auth,sessionId:wrongSession.id,
      roleCodes:['PROJECT_MANAGER'],
      permissions:['procurement.po.view','projects.access_all'],
    };
    const allProjectsPermission=await prisma.permission.upsert({where:{
      permissionCode:'projects.access_all',
    },create:{
      permissionCode:'projects.access_all',moduleCode:'PROJECTS',
      description:'Synthetic scoped test capability',
    },update:{}});
    const temporarilyGranted=await prisma.rolePermission.create({data:{
      roleId:pmRole.id,permissionId:allProjectsPermission.id,
    }});
    assert.equal((await cases.read(wrongScopeAuth,approvedOriginal.id)).case?.status,
      'BEN_APPROVED');
    await prisma.rolePermission.delete({where:{id:temporarilyGranted.id}});
    await assert.rejects(
      ()=>cases.read(wrongScopeAuth,approvedOriginal.id),
      (e:unknown)=>e instanceof ForbiddenException &&
        (e.getResponse() as {code?:string}).code==='PROJECT_ACCESS_DENIED',
    );
    const foreignRole=await prisma.role.create({data:{
      companyId:outsiderCompany.id,roleCode:'PROJECT_MANAGER',
      roleName:'Synthetic outside-Company Project Manager',
    }});
    const viewPermission=await prisma.permission.findUniqueOrThrow({where:{
      permissionCode:'procurement.po.view',
    }});
    await prisma.rolePermission.create({data:{
      roleId:foreignRole.id,permissionId:viewPermission.id,
    }});
    await prisma.userRole.create({data:{
      companyId:outsiderCompany.id,userId:foreignActor.user.id,roleId:foreignRole.id,
    }});
    const foreignSession=await prisma.userSession.create({data:{
      userId:foreignActor.user.id,
      tokenHash:randomUUID().replace(/-/g,'')+randomUUID().replace(/-/g,''),
      csrfTokenHash:'e'.repeat(64),expiresAt:new Date(Date.now()+3_600_000),
    }});
    await assert.rejects(
      ()=>cases.read({
        ...foreignActor.auth,sessionId:foreignSession.id,
        roleCodes:['PROJECT_MANAGER'],permissions:['procurement.po.view'],
      },approvedOriginal.id),
      (e:unknown)=>e instanceof NotFoundException,
    );
    assert.equal((await cases.read(benAuth,approvedOriginal.id)).case?.status,'BEN_APPROVED');

    // Actual server-side revocations must invalidate Ben immediately, even
    // while the client retains a cached token permission set.
    await prisma.userSession.update({where:{id:benAuth.sessionId},
      data:{revokedAt:new Date()}});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    await prisma.userSession.update({where:{id:benAuth.sessionId},
      data:{revokedAt:null}});
    const benEmployeeId=ben.user.employeeId;
    assert.ok(benEmployeeId,'synthetic Ben must have a linked employee');
    await prisma.employee.update({where:{id:benEmployeeId},
      data:{isActive:false}});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    await prisma.employee.update({where:{id:benEmployeeId},
      data:{isActive:true}});
    const benRole=await prisma.role.findFirstOrThrow({where:{
      companyId:company.id,roleCode:'MANAGEMENT',
    }});
    await prisma.role.update({where:{id:benRole.id},data:{isActive:false}});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ForbiddenException || e instanceof ConflictException,
    );
    await prisma.role.update({where:{id:benRole.id},data:{isActive:true}});
    await prisma.role.update({where:{id:pmRole.id},data:{isActive:false}});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ConflictException,
    );
    await prisma.role.update({where:{id:pmRole.id},data:{isActive:true}});
    const cancelPermission=await prisma.permission.findUniqueOrThrow({where:{
      permissionCode:'procurement.po.cancel',
    }});
    await prisma.rolePermission.deleteMany({where:{
      roleId:benRole.id,permissionId:cancelPermission.id,
    }});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    await prisma.rolePermission.create({data:{
      roleId:benRole.id,permissionId:cancelPermission.id,
    }});

    // PostgreSQL forbids deletion of Goods Receipt history (P0001).
    // Never remove test evidence to reopen a source for cancellation. Create
    // separate bona-fide approved/reviewed POs for negative cases instead.
    async function reviewedExceptionOrder(tag: string) {
      const req=await prs.createRequest({auth:store.auth},project.id,'PUR10 '+tag);
      const line=await prs.createLine({auth:store.auth},req.id,{
        lineType:'SERVICE',description:'Independent PUR10 '+tag+' negative case',
        quantity:D('1'),uomId:uom.id,
      });
      await prs.submitRequest({auth:store.auth},req.id,prFlow.workflowCode);
      await prs.approveRequest({auth:khaimook.auth},req.id,'PUR10 source demand valid');
      const reqRfq=await sourcing.createRfq({auth:store.auth},project.id,{
        lines:[{purchaseRequestLineId:line.id,quantity:D('1')}],
      });
      await sourcing.inviteSupplier({auth:jai.auth},reqRfq.id,supplier.id);
      const quote=await sourcing.createQuotation(
        {auth:jai.auth},reqRfq.id,supplier.id,
        {quotationDate:new Date(),supplierReference:'PUR10-'+tag+'-'+key},
      );
      const quoteLine=await sourcing.upsertQuotationLine(
        {auth:jai.auth},quote.id,reqRfq.lines[0]!.id,
        {quantity:D('1'),unitPrice:D('9000')},
      );
      const awarded=await sourcing.selectAward(
        {auth:jai.auth},reqRfq.lines[0]!.id,quoteLine.id,
        'PUR10 separate '+tag+' exception evidence',
      );
      const po=await orders.createOrder(
        {auth:jai.auth},project.id,[awarded.id], 'PUR10 reviewed '+tag,
      );
      // Reuse a valid submitted commercial basis; the source PO needs all
      // tax/discount/charge facts before the quote-policy guard can run.
      await orders.updateOrder({auth:jai.auth},po.id,fields);
      await orders.submit({auth:jai.auth},po.id,poFlow.workflowCode);
      await orders.approve({auth:ben.auth},po.id,'PUR10 scoped new PO');
      const loaded=await prisma.purchaseOrder.findUniqueOrThrow({
        where:{id:po.id},include:{lines:true},
      });
      const a=await cases.transition({auth:jaiAuth},po.id,
        'PROPOSE',0,null,'Supplier cancellation requested for '+tag);
      const b=await cases.transition({auth:pmAuth},po.id,
        'PM_FORWARD',1,a.expectedPreviousEventId,
        'Khaimook checked no continuing need for '+tag);
      const c=await cases.transition({auth:benAuth},po.id,
        'BEN_APPROVE',2,b.expectedPreviousEventId,
        'Ben independently approved '+tag+' review');
      assert.equal(c.status,'BEN_APPROVED');
      return {po:loaded,case:c};
    }

    // Any GR, including an unposted draft, must prohibit cancellation.
    const receiptSource=await reviewedExceptionOrder('GR');
    const warehouse=await prisma.warehouse.create({data:{
      companyId:company.id,projectId:project.id,
      warehouseCode:'P10WH-'+key,warehouseName:'PUR10 test quarantine',
      isSiteWarehouse:true,
    }});
    const gr=await prisma.goodsReceipt.create({data:{
      companyId:company.id,projectId:project.id,supplierId:supplier.id,
      warehouseId:warehouse.id,purchaseOrderId:receiptSource.po.id,
      receiptNumber:'P10GR-'+key,createdByUserId:store.user.id,
    }});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},receiptSource.po.id,3,
        receiptSource.case.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ConflictException,
    );
    assert.ok(await prisma.goodsReceipt.findUnique({where:{id:gr.id}}),
      'Historical Goods Receipt remains recorded; never delete evidence');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:receiptSource.po.id},select:{cancelledAt:true},
    })).cancelledAt,null);

    // Separate draft Supplier Invoice source; preserve the invoice and line
    // after proving the denial. No immutable Finance history is destroyed.
    const invoiceSource=await reviewedExceptionOrder('AP');
    const invoice=await prisma.supplierInvoice.create({data:{
      companyId:company.id,projectId:project.id,supplierId:supplier.id,
      supplierInvoiceNumber:'P10SI-'+key,
      supplierReference:'P10SUP-'+key,invoiceDate:new Date(),
      currencyCode:'THB',totalAmount:D('100.00'),state:'DRAFT',
      createKey:'P10KEY-'+key,createPayloadHash:'a'.repeat(64),
      createdByUserId:jai.user.id,
    }});
    const invoiceLine=await prisma.supplierInvoiceItem.create({data:{
      companyId:company.id,projectId:project.id,
      supplierInvoiceId:invoice.id,purchaseOrderLineId:invoiceSource.po.lines[0]!.id,
      lineNo:1,description:'Blocked PUR10 Finance source',amount:D('100.00'),
    }});
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},invoiceSource.po.id,3,
        invoiceSource.case.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ConflictException,
    );
    assert.ok(await prisma.supplierInvoiceItem.findUnique({where:{id:invoiceLine.id}}),
      'Draft Finance evidence remains immutable through cancelled attempt');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:invoiceSource.po.id},select:{cancelledAt:true},
    })).cancelledAt,null);

    // Every blocked attempt preserves the reviewed state and produces no
    // final cancellation/audit. A genuine contested pair must yield one
    // durable finalization and one losing transaction (including P2034).
    assert.equal(await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'PURCHASE_ORDER_CANCELLATION',
      entityId:approvedOriginal.id,action:'FINALIZE',
    }}),0);
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:approvedOriginal.id},select:{cancelledAt:true},
    })).cancelledAt,null);
    await assert.rejects(
      ()=>cases.finalize({auth:jaiAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,2,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ConflictException,
    );

    // A live revision and Ben's reviewed cancellation must never both commit.
    // Use independent approved source history and the actual owning writers.
    const raceSource=await reviewedExceptionOrder('REVISION-RACE');
    const race=await Promise.allSettled([
      cases.finalize({auth:benAuth},raceSource.po.id,3,
        raceSource.case.expectedPreviousEventId,finalArgs),
      orders.revise({auth:jai.auth},raceSource.po.id,'Concurrent legitimate revision'),
    ]);
    assert.equal(race.filter(r=>r.status==='fulfilled').length,1,
      'Exactly one of cancellation and revision may commit');
    const raceOrder=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:raceSource.po.id},include:{nextRevision:{select:{id:true}}},
    });
    const raceFinals=await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'PURCHASE_ORDER_CANCELLATION',
      entityId:raceSource.po.id,action:'FINALIZE',
    }});
    const raceCancelAudits=await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'PURCHASE_ORDER',
      entityId:raceSource.po.id,action:'CANCEL',
    }});
    if(race[0]!.status==='fulfilled'){
      assert.ok(raceOrder.cancelledAt);
      assert.equal(raceOrder.nextRevision,null);
      assert.ok(race[1]!.status==='rejected' && race[1]!.reason instanceof ConflictException,
        'Losing revision must return a controlled conflict');
      assert.equal(raceFinals,1);assert.equal(raceCancelAudits,1);
    }else{
      assert.ok(race[0]!.reason instanceof ConflictException,
        'Losing cancellation must return an explicit conflict');
      assert.equal(raceOrder.cancelledAt,null);
      assert.ok(raceOrder.nextRevision);
      assert.equal(raceFinals,0);assert.equal(raceCancelAudits,0);
    }
    assert.equal(await prisma.goodsReceipt.count({where:{purchaseOrderId:raceSource.po.id}}),0);
    assert.equal(await prisma.supplierInvoiceItem.count({where:{
      purchaseOrderLineId:{in:raceSource.po.lines.map(l=>l.id)},
    }}),0);
    console.log('PUR10_NATIVE_FINALIZE_VS_REVISION_EXCLUSIVE_COMMIT_PASS');

    const competing=await Promise.allSettled([
      cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
    ]);
    const winners=competing.filter(value=>value.status==='fulfilled');
    assert.equal(winners.length,1,'Exactly one concurrent finalization may commit');
    assert.equal(competing.filter(value=>value.status==='rejected').length,1);
    const loser=competing.find(value=>value.status==='rejected');
    assert.ok(loser?.status==='rejected' && loser.reason instanceof ConflictException,
      'Losing finalizer must return a controlled conflict');
    if (winners[0]?.status !== 'fulfilled') throw new Error('Missing PUR10 finalizer');
    const finalize=winners[0].value;
    assert.deepEqual([finalize.status,finalize.poCancelled,finalize.financePosted],
      ['FINALIZED',true,false]);
    const cancelled=await prisma.purchaseOrder.findUniqueOrThrow({where:{id:approvedOriginal.id}});
    assert.ok(cancelled.cancelledAt);
    assert.equal(cancelled.cancelledByUserId,ben.user.id);
    await assert.rejects(
      ()=>orders.revise({auth:jai.auth},approvedOriginal.id,'Revision after finalized cancellation'),
      (e:unknown)=>e instanceof ConflictException &&
        (e.getResponse() as {code?:string}).code==='PO_REVISION_SOURCE_INVALID',
    );
    assert.equal(await prisma.purchaseOrder.count({where:{previousRevisionId:approvedOriginal.id}}),0,
      'A finalized cancelled PO must never acquire a successor revision');
    assert.equal(await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'PURCHASE_ORDER_CANCELLATION',
      entityId:approvedOriginal.id,action:'FINALIZE',
    }}),1);
    assert.equal(await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'PURCHASE_ORDER',
      entityId:approvedOriginal.id,action:'CANCEL',
    }}),1);
    assert.equal((await cases.read(benAuth,approvedOriginal.id)).case?.status,'FINALIZED');
    await assert.rejects(
      ()=>cases.finalize({auth:benAuth},approvedOriginal.id,3,
        approvedCase.expectedPreviousEventId,finalArgs),
      (e:unknown)=>e instanceof ConflictException,
    );
    // The finalization never inserts/reverses receipts, invoices or payments.
    assert.equal(await prisma.goodsReceipt.count({where:{
      purchaseOrderId:approvedOriginal.id,
    }}),0);
    assert.equal(await prisma.supplierInvoiceItem.count({where:{
      purchaseOrderLineId:{in:approvedOriginal.lines.map(l=>l.id)},
    }}),0);
    // Combined successor boundary: a real supplier report on an approved
    // PO remains historical after independent cancellation. New supplier
    // transitions on the cancelled source must fail without new effects.
    const linked=await reviewedExceptionOrder('SUPPLIER-HISTORY');
    const buyerRole=await prisma.role.findUniqueOrThrow({where:{
      companyId_roleCode:{companyId:company.id,roleCode:'PROCUREMENT_OFFICER'},
    }});
    const docPermission=await prisma.permission.findUniqueOrThrow({where:{permissionCode:'documents.document.view'}});
    await prisma.rolePermission.upsert({where:{roleId_permissionId:{roleId:buyerRole.id,permissionId:docPermission.id}},update:{},create:{roleId:buyerRole.id,permissionId:docPermission.id}});
    const buyer={...jaiAuth,permissions:[...new Set([...jaiAuth.permissions,'documents.document.view'])]};
    const docType=await prisma.documentType.create({data:{companyId:company.id,documentTypeCode:'PUR10-LINK-'+key,documentTypeName:'Synthetic supplier evidence'}});
    const doc=await prisma.document.create({data:{companyId:company.id,documentTypeId:docType.id,fileName:'supplier-evidence.txt',storageProvider:'LOCAL',storageKey:'pur10-linked-'+key,mimeType:'text/plain',fileSizeBytes:20,uploadedByUserId:jai.user.id}});
    await prisma.documentLink.create({data:{documentId:doc.id,entityType:'PROJECT',entityId:project.id,linkedByUserId:jai.user.id}});
    const dispatch=await prisma.poDispatchEvent.create({data:{companyId:company.id,projectId:project.id,purchaseOrderId:linked.po.id,kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',evidenceReference:'Synthetic reported external dispatch',recordedByUserId:jai.user.id}});
    const ack=await prisma.poDispatchEvent.create({data:{companyId:company.id,projectId:project.id,purchaseOrderId:linked.po.id,kind:'ACKNOWLEDGMENT',channel:'EMAIL',recipient:'supplier@example.invalid',evidenceReference:'Synthetic reported supplier acknowledgement',acknowledgesEventId:dispatch.id,recordedByUserId:jai.user.id}});
    const supplierCases=new SupplierDeliveryCaseService(prisma,scope);
    const event=await supplierCases.transition({auth:buyer},linked.po.id,{
      action:'ACKNOWLEDGE',expectedVersion:0,expectedPreviousEventId:null,evidenceDocumentId:doc.id,note:'Reported supplier acknowledgment',recordedPoAcknowledgmentEventId:ack.id,
    });
    assert.equal(event.case.stage,'ACKNOWLEDGED');
    const result=await cases.finalize({auth:benAuth},linked.po.id,3,linked.case.expectedPreviousEventId,finalArgs);
    assert.equal(result.poCancelled,true);
    const historical=await supplierCases.read(buyer,linked.po.id);
    assert.equal(historical.approvedLatest,false);
    assert.equal(historical.case?.version,1);
    await assert.rejects(()=>supplierCases.transition({auth:buyer},linked.po.id,{
      action:'REPORT_DELAY',expectedVersion:1,expectedPreviousEventId:event.expectedPreviousEventId,evidenceDocumentId:doc.id,note:'Reported delay after cancellation',newSupplierExpectedDate:'2026-12-09',
    }),(e:unknown)=>e instanceof ConflictException&&(e.getResponse() as {code?:string}).code==='SUPPLIER_CASE_APPROVED_LATEST_SOURCE_REQUIRED');
    assert.equal(await prisma.auditLog.count({where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:linked.po.id}}),1);
    assert.equal(await prisma.poDispatchEvent.count({where:{purchaseOrderId:linked.po.id}}),2);
    assert.equal(await prisma.goodsReceipt.count({where:{purchaseOrderId:linked.po.id}}),0);
    assert.equal(await prisma.supplierInvoiceItem.count({where:{purchaseOrderLineId:{in:linked.po.lines.map(l=>l.id)}}}),0);
    console.log('PUR10_PUR08_CANCELLED_SOURCE_HISTORY_AND_WRITE_DENIAL_PASS');

    // Deterministically hold the real canonical cancellation transaction
    // after its PO update but before commit. A competing supplier report
    // must wait on the same row, then reject its now-stale snapshot.
    const collision=await reviewedExceptionOrder('SUPPLIER-CANCEL-RACE');
    const raceDispatch=await prisma.poDispatchEvent.create({data:{companyId:company.id,projectId:project.id,purchaseOrderId:collision.po.id,kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',evidenceReference:'Synthetic race dispatch',recordedByUserId:jai.user.id}});
    const raceAck=await prisma.poDispatchEvent.create({data:{companyId:company.id,projectId:project.id,purchaseOrderId:collision.po.id,kind:'ACKNOWLEDGMENT',channel:'EMAIL',recipient:'supplier@example.invalid',evidenceReference:'Synthetic race acknowledgment',acknowledgesEventId:raceDispatch.id,recordedByUserId:jai.user.id}});
    const raceEvent=await supplierCases.transition({auth:buyer},collision.po.id,{
      action:'ACKNOWLEDGE',expectedVersion:0,expectedPreviousEventId:null,evidenceDocumentId:doc.id,
      note:'Reported supplier acknowledgment',recordedPoAcknowledgmentEventId:raceAck.id,
    });
    let enter!:()=>void;
    let release!:()=>void;
    const entered=new Promise<void>(resolve=>{enter=resolve;});
    const held=new Promise<void>(resolve=>{release=resolve;});
    const originalCancel=orders.cancelForReviewedCase.bind(orders);
    orders.cancelForReviewedCase=async (...args:Parameters<typeof orders.cancelForReviewedCase>)=>{
      const actual=await originalCancel(...args);
      enter();
      await held;
      return actual;
    };
    const finalizing=Promise.allSettled([cases.finalize({auth:benAuth},collision.po.id,3,collision.case.expectedPreviousEventId,finalArgs)]);
    let reporting:Promise<PromiseSettledResult<Awaited<ReturnType<typeof supplierCases.transition>>>[]>|undefined;
    let waited=false;
    let timeout:ReturnType<typeof setTimeout>|undefined;
    try {
      await Promise.race([
        entered,
        finalizing.then(()=>{throw new Error('Cancellation ended before the deterministic hold');}),
        new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Canonical cancellation did not reach hold')),3000);}),
      ]);
      reporting=Promise.allSettled([supplierCases.transition({auth:buyer},collision.po.id,{
        action:'REPORT_DELAY',expectedVersion:1,expectedPreviousEventId:raceEvent.expectedPreviousEventId,
        evidenceDocumentId:doc.id,note:'Competing supplier report',newSupplierExpectedDate:'2026-12-09',
      })]);
      for(let attempt=0;attempt<40;attempt++){
        const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>(Prisma.sql`
          SELECT EXISTS(
            SELECT 1 FROM pg_stat_activity
            WHERE datname=current_database() AND pid<>pg_backend_pid()
              AND wait_event_type='Lock' AND query LIKE '%purchase_orders%'
              AND query LIKE '%FOR UPDATE%'
          ) AS waiting
        `);
        if(rows[0]?.waiting){waited=true;break;}
        await new Promise(resolve=>setTimeout(resolve,35));
      }
    } finally {
      if(timeout)clearTimeout(timeout);
      release();
      orders.cancelForReviewedCase=originalCancel;
    }
    const [finished]=await finalizing;
    assert.ok(reporting,'Actual competing supplier transition started');
    const [reported]=await reporting;
    assert.equal(waited,true,'Supplier transition must have waited on the actual locked PO row');
    assert.ok(finished?.status==='fulfilled'&&finished.value.poCancelled,'Actual cancellation committed');
    assert.ok(reported?.status==='rejected'&&reported.reason instanceof ConflictException&&
      (reported.reason.getResponse() as {code?:string}).code==='SUPPLIER_CASE_CONCURRENT_SOURCE_CHANGE',
      'Losing supplier report must return a controlled conflict');
    assert.equal((await supplierCases.read(buyer,collision.po.id)).case?.version,1);
    assert.equal(await prisma.auditLog.count({where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:collision.po.id}}),1);
    assert.equal(await prisma.goodsReceipt.count({where:{purchaseOrderId:collision.po.id}}),0);
    assert.equal(await prisma.supplierInvoiceItem.count({where:{purchaseOrderLineId:{in:collision.po.lines.map(l=>l.id)}}}),0);
    console.log('PUR10_PUR08_DETERMINISTIC_CANCELLATION_SUPPLIER_ROW_LOCK_PASS');

    // PUR08 vs a real PO revision (distinct from the canonical cancellation
    // collision above). Do not permit a supplier report using the old approved
    // PO's snapshot once a newer revision has been durably inserted.
    const revisionRace=await reviewedExceptionOrder('SUPPLIER-REVISION-RACE');
    const revisionDispatch=await prisma.poDispatchEvent.create({data:{
      companyId:company.id,projectId:project.id,purchaseOrderId:revisionRace.po.id,
      kind:'DISPATCH',channel:'EMAIL',recipient:'supplier@example.invalid',
      evidenceReference:'Synthetic revision-race dispatch',recordedByUserId:jai.user.id,
    }});
    const revisionAck=await prisma.poDispatchEvent.create({data:{
      companyId:company.id,projectId:project.id,purchaseOrderId:revisionRace.po.id,
      kind:'ACKNOWLEDGMENT',channel:'EMAIL',recipient:'supplier@example.invalid',
      evidenceReference:'Synthetic revision-race acknowledgment',
      acknowledgesEventId:revisionDispatch.id,recordedByUserId:jai.user.id,
    }});
    const revisionSupplierEvent=await supplierCases.transition({auth:buyer},revisionRace.po.id,{
      action:'ACKNOWLEDGE',expectedVersion:0,expectedPreviousEventId:null,
      evidenceDocumentId:doc.id,note:'Real approved source reported acknowledgment',
      recordedPoAcknowledgmentEventId:revisionAck.id,
    });
    // The row-version write is technical serialization only: no historic field
    // (including updatedAt) may change as a side effect of revising.
    const predecessorBefore=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:revisionRace.po.id},
    });
    let enteredRevision!:()=>void;
    let releaseRevision!:()=>void;
    const atRevisionAudit=new Promise<void>(resolve=>{enteredRevision=resolve;});
    const heldRevision=new Promise<void>(resolve=>{releaseRevision=resolve;});
    const originalAuditRecord=audit.record.bind(audit);
    // The canonical revision has already inserted its child PO and its
    // immutable audit record while inside the real serializable transaction.
    // Pause at this existing service seam, not by creating fake PO rows.
    audit.record=async (...args:Parameters<typeof audit.record>)=>{
      await originalAuditRecord(...args);
      const data=args[0].newValues;
      if(args[0].entityType==='PURCHASE_ORDER'&&args[0].action==='CREATE_REVISION'&&
        typeof data==='object'&&data!==null&&
        'previousRevisionId' in data&&data.previousRevisionId===revisionRace.po.id){
        enteredRevision();
        await heldRevision;
      }
    };
    const revising=Promise.allSettled([
      orders.revise({auth:jai.auth},revisionRace.po.id,'Actual overlapping source revision'),
    ]);
    let revisionReporting:
      Promise<PromiseSettledResult<Awaited<ReturnType<typeof supplierCases.transition>>>[]>|undefined;
    let revisionWaited=false;
    let revisionTimer:ReturnType<typeof setTimeout>|undefined;
    try{
      await Promise.race([
        atRevisionAudit,
        revising.then(()=>{throw new Error('Revision completed before real transaction hold');}),
        new Promise<never>((_,reject)=>{
          revisionTimer=setTimeout(()=>reject(new Error('Revision never reached audit hold')),3000);
        }),
      ]);
      revisionReporting=Promise.allSettled([supplierCases.transition({auth:buyer},revisionRace.po.id,{
        action:'REPORT_DELAY',expectedVersion:1,
        expectedPreviousEventId:revisionSupplierEvent.expectedPreviousEventId,
        evidenceDocumentId:doc.id,note:'Old approved source reported after overlapping revision',
        newSupplierExpectedDate:'2026-12-09',
      })]);
      for(let attempt=0;attempt<40;attempt++){
        const rows=await prisma.$queryRaw<Array<{waiting:boolean}>>(Prisma.sql`
          SELECT EXISTS(
            SELECT 1 FROM pg_stat_activity
            WHERE datname=current_database() AND pid<>pg_backend_pid()
              AND wait_event_type='Lock' AND query LIKE '%purchase_orders%'
              AND query LIKE '%FOR UPDATE%'
          ) AS waiting
        `);
        if(rows[0]?.waiting){revisionWaited=true;break;}
        await new Promise(resolve=>setTimeout(resolve,35));
      }
    } finally {
      if(revisionTimer)clearTimeout(revisionTimer);
      releaseRevision();
      audit.record=originalAuditRecord;
    }
    const [completedRevision]=await revising;
    assert.ok(revisionReporting,'Real supplier report was started before revision commit');
    const [revisionReport]=await revisionReporting;
    assert.equal(revisionWaited,true,'Supplier report must wait behind real revision FK source lock');
    assert.equal(completedRevision?.status,'fulfilled','Actual revised PO must commit');
    assert.ok(revisionReport?.status==='rejected'&&revisionReport.reason instanceof ConflictException&&
      (revisionReport.reason.getResponse() as {code?:string}).code===
        'SUPPLIER_CASE_CONCURRENT_SOURCE_CHANGE',
      'Post-revision stale supplier report must fail with controlled concurrency conflict');
    const revisions=await prisma.purchaseOrder.findMany({
      where:{previousRevisionId:revisionRace.po.id},select:{id:true,revisionNo:true},
    });
    assert.equal(revisions.length,1,'Exactly one actual successor PO revision');
    const predecessorAfter=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:revisionRace.po.id},
    });
    assert.deepEqual(predecessorAfter,predecessorBefore,
      'Revision row-version guard must preserve every predecessor field and timestamp');
    await assert.rejects(
      ()=>supplierCases.transition({auth:buyer},revisionRace.po.id,{
        action:'REPORT_DELAY',expectedVersion:1,
        expectedPreviousEventId:revisionSupplierEvent.expectedPreviousEventId,
        evidenceDocumentId:doc.id,note:'Explicit retry against superseded source',
        newSupplierExpectedDate:'2026-12-09',
      }),
      (err:unknown)=>err instanceof ConflictException &&
        (err.getResponse() as {code?:string}).code===
          'SUPPLIER_CASE_APPROVED_LATEST_SOURCE_REQUIRED',
      'A fresh retry cannot append to a superseded PO');
    assert.equal((await supplierCases.read(buyer,revisionRace.po.id)).approvedLatest,false);
    assert.equal((await supplierCases.read(buyer,revisionRace.po.id)).case?.version,1,
      'Only the historical supplier acknowledgment survives source supersession');
    assert.equal(await prisma.auditLog.count({where:{
      companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:revisionRace.po.id,
    }}),1,'Stale supplier report did not create a second audit event');
    assert.equal(await prisma.goodsReceipt.count({where:{purchaseOrderId:revisionRace.po.id}}),0);
    assert.equal(await prisma.supplierInvoiceItem.count({where:{
      purchaseOrderLineId:{in:revisionRace.po.lines.map(l=>l.id)},
    }}),0);
    console.log('PUR08_PO_REVISION_SUPPLIER_SERIALIZABLE_COLLISION_PASS');

    console.log('M4_PUR10_REAL_PG_ATOMIC_FINALIZATION_AND_REPLAY_PASS');
  } finally {
    await prisma.$disconnect();
  }
});
