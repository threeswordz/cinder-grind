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

// NEW bounded PUR04 actual PostgreSQL17.11 behavior, not a rerun of the
// previously passed PUR04 draft-edit/THB quote/Chrome flows.
// Disposable DB only: never retained MKE/TCJ, Mac or Production.
// Bounded PUR04 replay of #421: PUR01 supplier exception fields deliberately
// excluded until that separate increment is integrated; all nine PUR04 fields remain.
const D=(value:string)=>new Prisma.Decimal(value);
test('PUR04 native: approved PO revision preserves commercial snapshot and rejects Company/Project outsiders', async () => {
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
    };
    await orders.updateOrder({auth:jai.auth},original.id,fields);
    // Force the stale PATCH to read the Draft before another transaction
    // submits it, then release its write only after submit commits.
    let entered!:()=>void, resume!:()=>void;
    const readDraft=new Promise<void>(resolve=>{entered=resolve;});
    const release=new Promise<void>(resolve=>{resume=resolve;});
    const delayedScope=new ProjectAccessService(prisma,new ProjectScopeService(new AuthorizationService()));
    const normalAssert=delayedScope.assertAccess.bind(delayedScope);
    delayedScope.assertAccess=async (...args:Parameters<typeof normalAssert>)=>{
      await normalAssert(...args);entered();await release;
    };
    const delayedOrders=new PurchaseOrderService(prisma,delayedScope,audit,approval,numbers);
    const auditBefore=await prisma.auditLog.count({where:{companyId:company.id,entityId:original.id,action:'UPDATE_DRAFT'}});
    const delayed=delayedOrders.updateOrder({auth:jai.auth},original.id,{freightAmount:D('999')});
    const rejected=assert.rejects(delayed,(e:unknown)=>e instanceof ConflictException &&
      (e.getResponse() as {code?:string}).code==='PO_NOT_DRAFT');
    try { await readDraft; await orders.submit({auth:jai.auth},original.id,poFlow.workflowCode); }
    finally { resume(); }
    await rejected;
    assert.equal(await prisma.auditLog.count({where:{companyId:company.id,entityId:original.id,action:'UPDATE_DRAFT'}}),auditBefore);
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({where:{id:original.id}})).freightAmount?.toString(),'20.5');
    const changes=[{deliveryLocation:'forged'},{deliveryContact:'forged'},{deliveryTerms:'forged'},
      {paymentTerms:'forged'},{creditTerms:'forged'},{discountAmount:D('1')},
      {freightAmount:D('1')},{additionalChargeAmount:null},{vatRatePercent:D('0')},
      {supplierQuoteExceptionReason:'forged exception'}];
    for(const data of changes)await assert.rejects(prisma.purchaseOrder.update({where:{id:original.id},data}),/PO_COMMERCIAL_HISTORY_IMMUTABLE/);
    console.log('M4_PUR04_CONCURRENT_SUBMIT_STALE_PATCH_AND_DIRECT_DB_GUARD_PASS');
    const approved=await orders.approve({auth:ben.auth},original.id,'Commercial offer reviewed');
    assert.equal(approved.lifecycleState,'APPROVED');
    for(const data of changes)await assert.rejects(prisma.purchaseOrder.update({where:{id:original.id},data}),/PO_COMMERCIAL_HISTORY_IMMUTABLE/);
    const approvedOriginal=await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:original.id},include:{lines:true},
    });
    assert.ok(approvedOriginal.approvalInstanceId);
    assert.equal(approvedOriginal.lines.length,1);

    const before=await prisma.purchaseOrder.count({
      where:{companyId:company.id,poNumber:original.poNumber},
    });
    const expectNoRows=async()=>{
      assert.equal(await prisma.purchaseOrder.count({
        where:{companyId:company.id,poNumber:original.poNumber},
      }),before);
    };
    await assert.rejects(
      ()=>orders.revise({auth:foreignActor.auth},original.id,'Forged cross-Company'),
      (e:unknown)=>e instanceof NotFoundException,
    );
    await expectNoRows();
    await assert.rejects(
      ()=>orders.revise({auth:wrongProjectActor.auth},original.id,'Unauthorized other Project'),
      (e:unknown)=>e instanceof ForbiddenException &&
        typeof e.getResponse()==='object' &&
        (e.getResponse() as {code?:string}).code==='PROJECT_ACCESS_DENIED',
    );
    await expectNoRows();
    console.log('M4_PUR04_NATIVE_FOREIGN_COMPANY_AND_OTHER_PROJECT_REVISION_DENIED_PASS');

    const revised=await orders.revise(
      {auth:jai.auth},original.id,'Preserve commercial terms for approved PO Rev 1',
    );
    assert.equal(revised.lifecycleState,'DRAFT');
    assert.equal(revised.revisionNo,approvedOriginal.revisionNo+1);
    assert.equal(revised.previousRevisionId,original.id);
    assert.equal(revised.companyId,company.id);
    assert.equal(revised.projectId,project.id);
    assert.equal(revised.supplierId,approvedOriginal.supplierId);
    assert.equal(revised.poNumber,approvedOriginal.poNumber);
    assert.equal(revised.approvalInstanceId,null);
    assert.equal(revised.submittedAt,null);
    for(const key of [
      'deliveryLocation','deliveryContact','deliveryTerms','paymentTerms',
      'creditTerms',
    ] as const)assert.equal(revised[key],approvedOriginal[key],key);
    for(const key of [
      'discountAmount','freightAmount','additionalChargeAmount','vatRatePercent',
    ] as const)assert.equal(revised[key]?.toString(),approvedOriginal[key]?.toString(),key);
    const revisionLines=await prisma.purchaseOrderLine.findMany({
      where:{purchaseOrderId:revised.id},
    });
    assert.equal(revisionLines.length,1);
    assert.equal(revisionLines[0]!.quotationAwardId,approvedOriginal.lines[0]!.quotationAwardId);
    assert.equal(revisionLines[0]!.purchaseRequestLineId,approvedOriginal.lines[0]!.purchaseRequestLineId);
    assert.equal(revisionLines[0]!.quantity.toString(),approvedOriginal.lines[0]!.quantity.toString());
    console.log('M4_PUR04_NATIVE_APPROVED_REVISION_ALL_HEADER_FIELDS_AND_SOURCE_PROVENANCE_PASS');

    await assert.rejects(
      ()=>orders.updateOrder({auth:jai.auth},original.id,{deliveryLocation:'Unauthorized historic edit'}),
      (e:unknown)=>e instanceof ConflictException &&
        typeof e.getResponse()==='object' &&
        (e.getResponse() as {code?:string}).code==='PO_NOT_DRAFT',
    );
    await orders.updateOrder({auth:jai.auth},revised.id,{
      deliveryLocation:'Revised site entrance after approval',
      freightAmount:D('25.50'),
    });
    const oldStill=await prisma.purchaseOrder.findUniqueOrThrow({where:{id:original.id}});
    const newDraft=await prisma.purchaseOrder.findUniqueOrThrow({where:{id:revised.id}});
    assert.equal(oldStill.deliveryLocation,'Site loading dock 3');
    assert.equal(oldStill.freightAmount?.toString(),'20.5');
    assert.equal(newDraft.deliveryLocation,'Revised site entrance after approval');
    assert.equal(newDraft.freightAmount?.toString(),'25.5');
    assert.equal(oldStill.approvalInstanceId,approvedOriginal.approvalInstanceId);
    await assert.rejects(
      ()=>orders.revise({auth:jai.auth},original.id,'Forbidden second successor'),
      (e:unknown)=>e instanceof ConflictException &&
        typeof e.getResponse()==='object' &&
        (e.getResponse() as {code?:string}).code==='PO_REVISION_ALREADY_EXISTS',
    );
    await assert.rejects(
      ()=>orders.updateOrder({auth:wrongProjectActor.auth},revised.id,{
        deliveryLocation:'Forged other Project',
      }),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:revised.id},
    })).deliveryLocation,'Revised site entrance after approval');
    const revisionAudit=await prisma.auditLog.count({
      where:{companyId:company.id,entityType:'PURCHASE_ORDER',
        entityId:revised.id,action:'CREATE_REVISION'},
    });
    assert.equal(revisionAudit,1);
    console.log('M4_PUR04_NATIVE_HISTORY_IMMUTABLE_DRAFT_ONLY_AUDIT_AND_DUPLICATE_DENIAL_PASS');
    // Owner PUR05: a revised commercial commitment is a NEW DRAFT, and Ben
    // must approve the NEW submitted revision. Reuse the already source-backed
    // PUR04 fixture but make one genuinely NEW business assertion; do not
    // rerun historical separate PUR01/PM02/Mac/Chrome suites.
    const submittedRevision=await orders.submit(
      {auth:jai.auth},revised.id,poFlow.workflowCode,
    );
    assert.equal(submittedRevision.lifecycleState,'SUBMITTED');
    assert.ok(submittedRevision.approvalInstanceId);
    assert.notEqual(submittedRevision.approvalInstanceId,approvedOriginal.approvalInstanceId,
      'Revised commitment must create a distinct approval instance');
    const beforeRejectedActions=await prisma.approvalAction.count({
      where:{approvalInstanceId:submittedRevision.approvalInstanceId},
    });
    await assert.rejects(
      ()=>orders.approve({auth:jai.auth},revised.id,'Buyer cannot approve own revision'),
      (e:unknown)=>e instanceof ForbiddenException,
    );
    assert.equal(await prisma.approvalAction.count({
      where:{approvalInstanceId:submittedRevision.approvalInstanceId},
    }),beforeRejectedActions,
    'Buyer self-approval may not record an approval action');
    const approvedRevision=await orders.approve(
      {auth:ben.auth},revised.id,'Ben independently approves Rev1 amendment',
    );
    assert.equal(approvedRevision.lifecycleState,'APPROVED');
    assert.equal(approvedRevision.revisionNo,1);
    assert.equal(approvedRevision.previousRevisionId,original.id);
    assert.equal(approvedRevision.deliveryLocation,'Revised site entrance after approval');
    assert.equal(approvedRevision.freightAmount?.toString(),'25.5');
    assert.equal(await prisma.approvalAction.count({
      where:{approvalInstanceId:submittedRevision.approvalInstanceId,
        action:'APPROVE',actionByUserId:ben.user.id},
    }),1,'Exactly one independent Ben approval for revised commitment');
    const previousApproval=await prisma.approvalInstance.findUniqueOrThrow({
      where:{id:approvedOriginal.approvalInstanceId!},
    });
    assert.equal(previousApproval.approvalState,'APPROVED');
    assert.equal((await prisma.purchaseOrder.findUniqueOrThrow({
      where:{id:original.id},
    })).freightAmount?.toString(),'20.5',
    'Revised approval must never rewrite the previously approved commercial snapshot');
    await assert.rejects(
      ()=>orders.updateOrder({auth:jai.auth},revised.id,{
        paymentTerms:'Cannot mutate an approved revision',
      }),
      (e:unknown)=>e instanceof ConflictException &&
        typeof e.getResponse()==='object' &&
        (e.getResponse() as {code?:string}).code==='PO_NOT_DRAFT',
    );
    console.log('M4_PUR05_NEW_REVISION_REQUIRES_NEW_APPROVAL_AND_DISTINCT_BEN_ACTION_PASS');
    console.log('M4_PUR04_ACTUAL_POSTGRES17_REVISION_COMPANY_PROJECT_SCOPED_PASS');
  } finally {
    await prisma.$disconnect();
  }
});
