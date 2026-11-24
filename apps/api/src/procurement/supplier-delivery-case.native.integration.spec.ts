import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { Prisma } from '@prisma/client';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';

// ONE bounded, disposable PostgreSQL test, not retained MKE/TCJ/Production.
// No deletes of immutable operational or audit records, no owner role grants.
// Normal PO/GR approval functional acceptance is verified separately.
test('PUR08/PUR14 native: scoped live actors, real PUR07 source, append-only cases, concurrency, no postings', async () => {
  const db = new PrismaService();
  await db.$connect();
  try {
    const key = randomUUID().slice(0, 8);
    const company = await db.company.create({ data: {
      companyCode: 'PUR0814-'+key, companyName: 'PUR08/14 disposable company',
    } });
    const foreignCompany = await db.company.create({ data: {
      companyCode: 'X0814-'+key, companyName: 'Foreign disposable company',
    } });
    const customer = await db.customer.create({ data: {
      companyId: company.id, customerCode: 'CUS-'+key, customerName: 'Native test customer',
    } });
    const project = await db.project.create({ data: {
      companyId: company.id, customerId: customer.id, projectCode: 'SRC-'+key,
      projectName: 'Source project', contractValue: new Prisma.Decimal('10000'),
      plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-12-31'),
    } });
    const outsiderProject = await db.project.create({ data: {
      companyId: company.id, customerId: customer.id, projectCode: 'OUT-'+key,
      projectName: 'Other project', contractValue: new Prisma.Decimal('10000'),
      plannedStartDate: new Date('2026-01-01'), plannedCompletionDate: new Date('2027-12-31'),
    } });
    const supplier = await db.supplier.create({ data: {
      companyId: company.id, supplierCode: 'SUP-'+key, supplierName: 'Synthetic supplier',
    } });
    const permissions = ['procurement.po.view', 'documents.document.view',
      'inventory.receipt.view', 'inventory.receiving.view'];
    const permIds = new Map<string,string>();
    for (const code of permissions) {
      const row = await db.permission.upsert({
        where: {permissionCode:code}, update: {},
        create: {permissionCode:code, moduleCode:'TEST'},
      });
      permIds.set(code,row.id);
    }
    async function actor(name:string, roleCode:string, grants:string[],
      companyId:string=company.id, memberProjectId:string | null=project.id) {
      const employee = await db.employee.create({data:{
        companyId, employeeCode:name.slice(0,5)+key, employeeName:'Synthetic '+name,
      }});
      const user = await db.user.create({data:{
        companyId, employeeId:employee.id,
        email:name.toLowerCase()+'-'+key+'@example.invalid',
        displayName:'Synthetic '+name, passwordHash:'not-a-login',
      }});
      const role = await db.role.create({data:{
        companyId, roleCode, roleName:'Disposable '+name,
      }});
      for (const permission of grants) {
        const pid=permIds.get(permission);
        assert.ok(pid);
        await db.rolePermission.create({data:{roleId:role.id,permissionId:pid}});
      }
      await db.userRole.create({data:{companyId,userId:user.id,roleId:role.id}});
      if (memberProjectId) await db.projectMember.create({data:{
        employeeId:employee.id,projectId:memberProjectId,projectRole:'Native supplier test',
      }});
      const session = await db.userSession.create({data:{
        userId:user.id,tokenHash:randomUUID().replaceAll('-',''),
        csrfTokenHash:'1'.repeat(64),expiresAt:new Date(Date.now()+60*60*1000),
      }});
      return {user,employee,session,auth:{
        companyId,userId:user.id,sessionId:session.id,email:user.email,
        displayName:user.displayName, roleCodes:[roleCode],permissions:grants,
        csrfTokenHash:'1'.repeat(64),
      } satisfies AuthenticatedUserContext};
    }
    const jai = await actor('Jai','PROCUREMENT_OFFICER',
      ['procurement.po.view','documents.document.view']);
    const store = await actor('Store','STOREKEEPER',
      ['inventory.receiving.view','documents.document.view']);
    const pm = await actor('Khaimook','PROJECT_MANAGER',
      ['inventory.receipt.view','documents.document.view']);
    const wrongProject = await actor('WrongSite','STOREKEEPER',
      ['inventory.receiving.view','documents.document.view'],company.id,outsiderProject.id);
    const foreign = await actor('Foreign','STOREKEEPER',
      ['inventory.receiving.view','documents.document.view'],foreignCompany.id,null);
    const docType = await db.documentType.create({data:{
      companyId:company.id,documentTypeCode:'PUR0814-'+key,documentTypeName:'Supplier source evidence',
    }});
    async function document(projectId:string) {
      const row = await db.document.create({data:{
        companyId:company.id,documentTypeId:docType.id,
        fileName:'external-evidence.txt',storageProvider:'LOCAL',
        storageKey:'synthetic-pur0814-'+randomUUID(),mimeType:'text/plain',
        fileSizeBytes:20,uploadedByUserId:jai.user.id,
      }});
      await db.documentLink.create({data:{
        documentId:row.id,entityType:'PROJECT',entityId:projectId,linkedByUserId:jai.user.id,
      }});
      return row.id;
    }
    const evidenceDocumentId=await document(project.id);
    const wrongDocId=await document(outsiderProject.id);
    const workflow=await db.approvalWorkflow.create({data:{
      companyId:company.id,workflowCode:'PUR0814-'+key,
      workflowName:'Synthetic PO signoff',entityType:'PURCHASE_ORDER',
    }});
    async function po(suffix:string) {
      const order=await db.purchaseOrder.create({data:{
        companyId:company.id,projectId:project.id,supplierId:supplier.id,
        poNumber:'TESTPUR0814-'+key+'-'+suffix,createdByUserId:jai.user.id,
        currencyCode:'THB',
      }});
      const approval=await db.approvalInstance.create({data:{
        companyId:company.id,approvalWorkflowId:workflow.id,
        entityType:'PURCHASE_ORDER',entityId:order.id,
        currentStepNo:1,approvalState:'APPROVED',completedAt:new Date(),
      }});
      await db.purchaseOrder.update({
        where:{id:order.id},data:{approvalInstanceId:approval.id},
      });
      return order;
    }
    const scope=new ProjectAccessService(
      db,new ProjectScopeService(new AuthorizationService()),
    );
    const service=new SupplierDeliveryCaseService(db,scope);
    const ctx=(auth:AuthenticatedUserContext)=>({auth});
    const input=(action:string,version:number,previous:string|null,opts:Record<string,unknown>={})=>({
      action,expectedVersion:version,expectedPreviousEventId:previous,
      evidenceDocumentId,note:'Actual external evidence manually recorded',...opts,
    });
    async function expectCode(work:Promise<unknown>, code:string) {
      await assert.rejects(work,err=>{
        const response=err instanceof Error && 'getResponse' in err &&
          typeof err.getResponse==='function' ? err.getResponse() : null;
        return Boolean(response && typeof response==='object' &&
          'code' in response && response.code===code);
      },code);
    }

    const acknowledgedPo=await po('ACK');
    const dispatch=await db.poDispatchEvent.create({data:{
      companyId:company.id,projectId:project.id,purchaseOrderId:acknowledgedPo.id,
      kind:'DISPATCH',channel:'EMAIL',recipient:'buyer@example.invalid',
      evidenceReference:'real external thread independently documented',
      recordedByUserId:jai.user.id,
    }});
    const acknowledgment=await db.poDispatchEvent.create({data:{
      companyId:company.id,projectId:project.id,purchaseOrderId:acknowledgedPo.id,
      kind:'ACKNOWLEDGMENT',channel:'EMAIL',recipient:'buyer@example.invalid',
      evidenceReference:'supplier acknowledgment evidence independently recorded',
      acknowledgesEventId:dispatch.id,recordedByUserId:jai.user.id,
    }});
    await expectCode(service.transition(ctx(jai.auth),acknowledgedPo.id,
      input('ACKNOWLEDGE',0,null,{
        recordedPoAcknowledgmentEventId:randomUUID(),
      }) as never),'SUPPLIER_CASE_PUR07_ACK_NOT_FOUND');
    const recorded=await service.transition(ctx(jai.auth),acknowledgedPo.id,
      input('ACKNOWLEDGE',0,null,{
        recordedPoAcknowledgmentEventId:acknowledgment.id,
      }) as never);
    assert.equal(recorded.case.stage,'ACKNOWLEDGED');
    assert.equal(recorded.case.version,1);
    await expectCode(service.transition(ctx(jai.auth),acknowledgedPo.id,
      input('REPORT_DELAY',0,null,{newSupplierExpectedDate:'2026-12-09'}) as never),
      'SUPPLIER_CASE_STALE_EVENT');
    const delayed=await service.transition(ctx(jai.auth),acknowledgedPo.id,
      input('REPORT_DELAY',1,recorded.expectedPreviousEventId,{
        newSupplierExpectedDate:'2026-12-09',
      }) as never);
    assert.equal(delayed.case.stage,'DELAY_REPORTED');
    assert.equal((await service.read(store.auth,acknowledgedPo.id)).case?.version,2);

    // First event may be a genuine Store discrepancy, with NO supplier ACK.
    const receiptPo=await po('DISCREP');
    await expectCode(service.transition(ctx(store.auth),receiptPo.id,
      input('REPORT_DISCREPANCY',0,null,{
        evidenceDocumentId:wrongDocId,discrepancyKind:'DAMAGED',
      }) as never),'SUPPLIER_CASE_SCOPED_DOCUMENT_EVIDENCE_REQUIRED');
    await expectCode(service.read(wrongProject.auth,receiptPo.id),
      'PROJECT_ACCESS_DENIED');
    await expectCode(service.read(foreign.auth,receiptPo.id),
      'SUPPLIER_CASE_PO_NOT_FOUND');
    const discrepancy=await service.transition(ctx(store.auth),receiptPo.id,
      input('REPORT_DISCREPANCY',0,null,{discrepancyKind:'DAMAGED'}) as never);
    assert.equal(discrepancy.case.stage,'DISCREPANCY_REPORTED');
    const [resultA,resultB]=await Promise.allSettled([
      service.transition(ctx(pm.auth),receiptPo.id,
        input('PM_REVIEW_DISCREPANCY',1,discrepancy.expectedPreviousEventId,{
          pmDecision:'REQUEST_REPLACEMENT',
        }) as never),
      service.transition(ctx(pm.auth),receiptPo.id,
        input('PM_REVIEW_DISCREPANCY',1,discrepancy.expectedPreviousEventId,{
          pmDecision:'REQUEST_RETURN',
        }) as never),
    ]);
    assert.equal([resultA,resultB].filter(x=>x.status==='fulfilled').length,1,
      'PostgreSQL must serialize stale concurrent PM decisions');
    const latest=await service.read(pm.auth,receiptPo.id);
    assert.equal(latest.case?.version,2);
    const review=latest.case!;
    const claimed=await service.transition(ctx(jai.auth),receiptPo.id,
      input('JAI_RECORD_CLAIM',review.version,latest.expectedPreviousEventId) as never);
    assert.equal(claimed.case.stage,'CLAIM_RECORDED');
    if (review.pmDecision==='REQUEST_REPLACEMENT') {
      await expectCode(service.transition(ctx(store.auth),receiptPo.id,
        input('STORE_RECORD_REPLACEMENT_RECEIPT',claimed.case.version,
          claimed.expectedPreviousEventId,{
            recordedGoodsReceiptId:randomUUID(),
          }) as never),'SUPPLIER_CASE_ACTUAL_POSTED_GR_REQUIRED');
    } else {
      const returned=await service.transition(ctx(store.auth),receiptPo.id,
        input('STORE_RECORD_RETURN_DISPATCH',claimed.case.version,
          claimed.expectedPreviousEventId) as never);
      assert.equal(returned.case.stage,'RETURN_DISPATCH_RECORDED');
    }
    await db.userSession.update({where:{id:store.session.id},data:{revokedAt:new Date()}});
    await expectCode(service.read(store.auth,receiptPo.id),
      'SUPPLIER_CASE_LIVE_EMPLOYEE_REQUIRED');
    assert.equal(await db.auditLog.count({
      where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:receiptPo.id},
    }),review.pmDecision==='REQUEST_RETURN'?4:3);
    assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),0);
    assert.equal(await db.supplierInvoice.count({where:{companyId:company.id}}),0);
    assert.equal(await db.payment.count({where:{companyId:company.id}}),0);
  } finally {
    await db.$disconnect();
  }
});
