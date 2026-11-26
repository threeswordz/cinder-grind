import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { DocumentsService } from '../documents/documents.service';
import { LocalDocumentStorage } from '../documents/local-document-storage.service';
import { DocumentPolicyService } from '../documents/document-policy.service';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProjectScopeService } from '../authorization/project-scope.service';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { SupplierDeliveryCaseService } from './supplier-delivery-case.service';

// ONE bounded, disposable PostgreSQL test, not retained MKE/TCJ/Production.
// No deletes of immutable operational or audit records, no owner role grants.
// Normal PO/GR approval functional acceptance is verified separately.
test('PUR14 actual PG17: non-damaged claim is evidence-only and document-only cannot advance', async () => {
  const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.equal(url.port,'5432');
  assert.equal(url.pathname,'/erp_m4_supplier_attribution');
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
      const role = await db.role.upsert({
        where:{companyId_roleCode:{companyId,roleCode}},
        create:{companyId,roleCode,roleName:'Disposable '+name},
        update:{},
      });
      for (const permission of grants) {
        const pid=permIds.get(permission);
        assert.ok(pid);
        await db.rolePermission.upsert({
          where:{roleId_permissionId:{roleId:role.id,permissionId:pid}},
          create:{roleId:role.id,permissionId:pid},
          update:{},
        });
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
    const documents=new DocumentsService(db,scope,new AuditService(db),
      new LocalDocumentStorage(),new DocumentPolicyService());
    const service=new SupplierDeliveryCaseService(db,scope,documents);
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

    const counters=async()=>({stock:await db.stockTransaction.count({where:{companyId:company.id}}),invoice:await db.supplierInvoice.count({where:{companyId:company.id}}),payment:await db.payment.count({where:{companyId:company.id}}),finance:await db.directCostPosting.count({where:{companyId:company.id}})});
    const before=await counters();
    for(const kind of ['SHORT','WRONG_ITEM','EXCESS'] as const){
      const order=await po(kind);
      const reported=await service.transition(ctx(store.auth),order.id,input('REPORT_DISCREPANCY',0,null,{discrepancyKind:kind}) as never);
      const reviewed=await service.transition(ctx(pm.auth),order.id,input('PM_REVIEW_DISCREPANCY',1,reported.expectedPreviousEventId,{pmDecision:'REQUEST_RETURN'}) as never);
      const claimed=await service.transition(ctx(jai.auth),order.id,input('JAI_RECORD_CLAIM',2,reviewed.expectedPreviousEventId) as never);
      assert.equal(claimed.case.stage,'CLAIM_RECORDED');
      assert.equal(claimed.case.discrepancyKind,kind);
      const unchanged=await service.read(store.auth,order.id);
      await expectCode(service.transition(ctx(store.auth),order.id,input('STORE_RECORD_RETURN_DISPATCH',3,claimed.expectedPreviousEventId,{originalReceivingDeliveryLineId:randomUUID(),returnQuantity:'1.0000',supplierSignatory:'Synthetic signed evidence',supplierSignatureConfirmed:true}) as never),'PUR14_RETURN_KIND_REQUIRES_ATTRIBUTION_POLICY');
      assert.deepEqual(await service.read(store.auth,order.id),unchanged);
      assert.equal(await db.auditLog.count({where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:order.id}}),3);
      const docOnly=await po(kind+'-DOC');
      const d=await service.transition(ctx(store.auth),docOnly.id,input('REPORT_DISCREPANCY',0,null,{discrepancyKind:kind}) as never);
      const v=await service.transition(ctx(pm.auth),docOnly.id,input('PM_REVIEW_DISCREPANCY',1,d.expectedPreviousEventId,{pmDecision:'DOCUMENT_ONLY'}) as never);
      const snapshot=await service.read(pm.auth,docOnly.id);
      await expectCode(service.transition(ctx(jai.auth),docOnly.id,input('JAI_RECORD_CLAIM',2,v.expectedPreviousEventId) as never),'PUR14_JAI_AFTER_PM_DECISION_REQUIRED');
      assert.deepEqual(await service.read(pm.auth,docOnly.id),snapshot);
      assert.equal(await db.auditLog.count({where:{companyId:company.id,entityType:'SUPPLIER_DELIVERY_CASE',entityId:docOnly.id}}),2);
      assert.deepEqual(await counters(),before);
      console.log('M4_PUR14_ACTUAL_NON_DAMAGED_CLAIM_ONLY_AND_DOCUMENT_ONLY_TERMINAL_PASS',kind);
    }
  } finally {
    await db.$disconnect();
  }
});
