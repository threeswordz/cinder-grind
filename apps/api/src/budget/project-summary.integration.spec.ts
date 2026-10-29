import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {NestFactory} from '@nestjs/core';
import {Prisma} from '@prisma/client';
import {AppModule} from '../app.module';
import {SessionService} from '../auth/session.service';
import {securityHeadersMiddleware} from '../common/security-headers';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {NumberSequenceService} from '../administration/number-sequence.service';
import {ClientInvoiceService} from '../finance/client-invoice.service';
import {PaymentService} from '../finance/payment.service';
import {ProjectVariationService} from '../cost-control/project-variation.service';
import {PrismaService} from '../prisma/prisma.service';
import {customerBoqFixture} from './customer-boq-test-fixture';
import {PROJECT_SUMMARY_VIEW} from './project-summary.service';

test('Project summary and seven-function disclosure use actual persisted HTTP authority and approved canonical Finance sources',async t=>{
  const db=new PrismaService();await db.$connect();
  const app=await NestFactory.create(AppModule,{logger:false});app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());await app.listen(0,'127.0.0.1');
  try{
    const catalog=await db.permission.findUniqueOrThrow({where:{permissionCode:PROJECT_SUMMARY_VIEW}});assert.equal(catalog.id,'b0130000-0000-4000-8000-000000000006');assert.equal(catalog.moduleCode,'BUDGET');assert.equal(catalog.description,'Read Project contract billed and received totals without BOQ detail');
    const f=await customerBoqFixture(db),foreign=await customerBoqFixture(db),pid=f.project.id;
    const sessions=new SessionService(db),token=await sessions.create(f.editor.userId),outsideToken=await sessions.create(f.outsider.userId),foreignToken=await sessions.create(foreign.maker.userId);
    const base=(await app.getUrl())+'/api/v1';
    const read=async(path:string,status=200,cookie=token.sessionToken)=>{const r=await fetch(base+path,{headers:{Cookie:'erp_session='+cookie}});assert.equal(r.status,status,await r.clone().text());return r;};
    async function grants(codes:string[],userId=f.editor.userId,roleCode='FUNCTION-'+randomUUID().slice(0,8)){
      for(const permissionCode of codes)await db.permission.upsert({where:{permissionCode},update:{},create:{permissionCode,moduleCode:'TEST'}});
      const role=await db.role.create({data:{companyId:f.company.id,roleCode,roleName:'Disposable business function',rolePermissions:{create:codes.map(permissionCode=>({permission:{connect:{permissionCode}}}))}}});
      await db.userRole.deleteMany({where:{userId}});await db.userRole.create({data:{companyId:f.company.id,userId,roleId:role.id}});return role;
    }
    const financeCodes=['finance.client_invoice.view','finance.client_invoice.create','finance.client_invoice.submit','finance.client_invoice.approve','finance.payment.view','finance.payment.create','finance.payment.submit','finance.payment.approve','finance.payment.cancel','cost.variation.view','cost.variation.create','cost.variation.submit','cost.variation.approve'];
    for(const permissionCode of financeCodes){const permission=await db.permission.upsert({where:{permissionCode},update:{},create:{permissionCode,moduleCode:'TEST'}});await db.rolePermission.create({data:{roleId:f.role.id,permissionId:permission.id}});}
    const maker={...f.maker,permissions:[...f.maker.permissions,...financeCodes]},checker={...f.checker,permissions:[...f.checker.permissions,...financeCodes]};
    const numbers=new NumberSequenceService(db),invoices=new ClientInvoiceService(db,f.access,f.approvals,f.audit,numbers),payments=new PaymentService(db,f.access,f.approvals,f.audit,numbers),variations=new ProjectVariationService(db,f.access,f.approvals,f.audit);
    for(const [entityType,prefix] of [['CLIENT_INVOICE','CI'],['PAYMENT','PAY']] as const)await db.numberSequence.create({data:{companyId:f.company.id,entityType,sequenceCode:entityType,formatTemplate:prefix+'YYMM-###',resetRule:'MONTHLY'}});
    for(const entityType of ['CLIENT_INVOICE','PAYMENT','PROJECT_VARIATION'])await db.approvalWorkflow.create({data:{companyId:f.company.id,entityType,workflowCode:entityType,workflowName:entityType,steps:{create:{stepNo:1,stepName:'Checker',requiredApprovals:1,stepRoles:{create:{roleId:f.role.id}}}}}});
    const customerId=f.project.customerId,date=new Date('2026-10-01');
    async function invoice(amount:string,approved=true,projectId=pid){const row=await invoices.create({auth:maker},projectId,{customerId,invoiceDate:date,createKey:randomUUID(),lines:[{description:'Confidential invoice line',amount:new Prisma.Decimal(amount)}]});if(approved){await invoices.submit({auth:maker},row.id,'CLIENT_INVOICE',randomUUID());await invoices.approve({auth:checker},row.id,randomUUID());}return row;}
    const supplier=await db.supplier.create({data:{companyId:f.company.id,supplierCode:'SUMMARY-S',supplierName:'Summary supplier'}});
    async function payment(amount:string,approved=true,direction:'INBOUND'|'OUTBOUND'='INBOUND'){const row=await payments.create({auth:maker},pid,{direction,paymentDate:date,...(direction==='INBOUND'?{customerId}:{supplierId:supplier.id}),amount:new Prisma.Decimal(amount),createKey:randomUUID()});if(approved){await payments.submit({auth:maker},row.id,'PAYMENT',randomUUID());await payments.approve({auth:checker},row.id,randomUUID());}return row;}
    async function variation(amount:string){const row=await variations.create({auth:maker},pid,{variationNumber:randomUUID(),description:'Confidential variation',valueDelta:new Prisma.Decimal(amount),createKey:randomUUID()});await variations.submit({auth:maker},row.id,'PROJECT_VARIATION',randomUUID());await variations.approve({auth:checker},row.id,randomUUID());return row;}
    await invoice('200.11');await invoice('0.19');await invoice('999',false);
    const otherProject=await db.project.create({data:{companyId:f.company.id,customerId,projectCode:'OTHER',projectName:'Other Project',contractValue:'0',plannedStartDate:date,plannedCompletionDate:new Date('2027-01-01')}});
    for(const actor of [f.maker,f.checker]){const user=await db.user.findUniqueOrThrow({where:{id:actor.userId}});await db.projectMember.create({data:{projectId:otherProject.id,employeeId:user.employeeId!,projectRole:'Disposable Finance'}});}
    await invoice('54321.99',true,otherProject.id);
    // Unallocated approved receipts contribute; drafts and cancelled receipts do not.
    await payment('88.88',true,'OUTBOUND');await payment('20.10');await payment('0.20');await payment('555',false);const cancelled=await payment('999');await payments.cancel({auth:maker},cancelled.id,randomUUID(),'Disposable cancellation');
    await variation('125.50');const reversed=await variation('40');const reversal=await variations.createReversal({auth:maker},reversed.id,{variationNumber:randomUUID(),reason:'Reverse source',createKey:randomUUID()});await variations.submit({auth:maker},reversal.id,'PROJECT_VARIATION',randomUUID());await variations.approve({auth:checker},reversal.id,randomUUID());
    const sourceBefore=JSON.stringify(await db.budgetRevision.findUniqueOrThrow({where:{id:f.source.id},include:{lines:true}}));
    const before=await Promise.all([db.payment.count(),db.stockTransaction.count(),db.directCostPosting.count(),db.auditLog.count()]);
    const commercial=['budget.boq.view','budget.revision.view','budget.customer.view'];
    const functionRoles=new Map<string,string>();
    await t.test('all seven approved functions have distinct source and aggregate disclosure',async()=>{
      const cases=[
        {name:'BEN',codes:[...commercial,'budget.boq.manage','budget.revision.submit','budget.customer.manage','budget.customer.submit'],full:true,customer:true,quantity:false,summary:false},
        {name:'NANCY',codes:[...commercial,'budget.customer.approve'],full:true,customer:true,quantity:false,summary:false},
        {name:'KHAIMOOK',codes:['budget.boq.view','budget.revision.view','budget.revision.approve'],full:true,customer:false,quantity:false,summary:false},
        ...['JAI','STORE_SITE','FOREMAN'].map(name=>({name,codes:['budget.quantity.view'],full:false,customer:false,quantity:true,summary:false})),
        {name:'PORN',codes:[PROJECT_SUMMARY_VIEW],full:false,customer:false,quantity:false,summary:true},
      ];
      for(const c of cases){functionRoles.set(c.name,(await grants(c.codes,undefined,c.name)).id);await read('/budget/projects/'+pid+'/boq',c.full?200:403);await read('/budget/customer/projects/'+pid+'/versions',c.customer?200:403);await read('/budget/quantity/projects/'+pid+'/boq',c.quantity?200:403);await read('/budget/summary/projects/'+pid,c.summary?200:403);}
    });
    await t.test('Project summary is exactly three whole-Project totals, with safe CSV, no filters or source grants',async()=>{
      await grants([PROJECT_SUMMARY_VIEW,'cost.control.view','management.dashboard.view','cost.forecast.view']);
      for(const path of ['/projects/'+pid+'/cost-control','/management/projects/'+pid+'/summary?asOf=2026-10-01','/cost-control/projects/'+pid+'/forecast-options']){const denied=await read(path,403);assert.equal((await denied.json() as any).code,'BOQ_COST_DISCLOSURE_DENIED');}
      await grants([PROJECT_SUMMARY_VIEW]);const response=await read('/budget/summary/projects/'+pid.toUpperCase());assert.equal(response.headers.get('cache-control'),'private, no-store');
      const value=await response.json() as any;assert.deepEqual(value.data,{project:{id:pid,projectCode:'P',projectName:'Project'},currencyCode:'THB',contractAmount:'1125.50',billedAmount:'200.30',receivedAmount:'20.30'});
      for(const query of ['wbsId='+randomUUID(),'costCodeId='+randomUUID(),'lineId='+f.sourceLine.id,'asOf=2026-10-01']){await read('/budget/summary/projects/'+pid+'?'+query,422);await read('/budget/summary/projects/'+pid+'/export?'+query,422);}
      const csv=await(await read('/budget/summary/projects/'+pid+'/export')).text();assert.match(csv,/1125\.50.*200\.30.*20\.30/);assert.doesNotMatch(csv,/Confidential|sourceLine|markup|margin|costBasis/);
      await db.project.update({where:{id:pid},data:{projectCode:'=DANGEROUS',projectName:'@FORMULA'}});const escaped=await(await read('/budget/summary/projects/'+pid+'/export')).text();assert.match(escaped,/"'=DANGEROUS"/);assert.match(escaped,/"'@FORMULA"/);
      await read('/finance/projects/'+pid+'/client-invoices',403);
    });
    await t.test('Company, Project membership, combined grants and technical role names never imply summary authority',async()=>{
      assert.deepEqual((await(await read('/budget/summary/projects')).json() as any).data.map((p:any)=>p.id),[pid]);
      await grants([PROJECT_SUMMARY_VIEW],f.outsider.userId);await read('/budget/summary/projects/'+pid,403,outsideToken.sessionToken);
      await read('/budget/summary/projects/'+foreign.project.id,404);await read('/budget/summary/projects/'+pid,403,foreignToken.sessionToken);
      await grants([PROJECT_SUMMARY_VIEW,'projects.access_all']);await read('/budget/summary/projects/'+foreign.project.id,404);
      await grants(['projects.access_all'],undefined,'SYS_ADMIN');await read('/budget/summary/projects/'+pid,403);
      await grants([PROJECT_SUMMARY_VIEW,'budget.quantity.view']);await read('/budget/summary/projects/'+pid);await read('/budget/customer/projects/'+pid+'/versions',403);
      await db.userRole.deleteMany({where:{userId:f.editor.userId}});await read('/budget/summary/projects/'+pid,403);await read('/budget/summary/projects/'+pid+'/export',403);
      assert.deepEqual(await Promise.all([db.payment.count(),db.stockTransaction.count(),db.directCostPosting.count(),db.auditLog.count()]),before,'Summary reads cannot create a ledger or audit write');
    });
    await t.test('persisted Ben prepares both, Khaimook approves Internal and Nancy independently approves Customer',async()=>{
      for(const [userId,name] of [[f.maker.userId,'BEN'],[f.editor.userId,'KHAIMOOK'],[f.checker.userId,'NANCY']] as const){
        await db.userRole.deleteMany({where:{userId}});await db.userRole.create({data:{companyId:f.company.id,userId:userId!,roleId:functionRoles.get(name!)!}});
      }
      for(const [entityType,workflowCode,actor] of [['BUDGET_REVISION','MATRIX_INTERNAL','KHAIMOOK'],['CUSTOMER_BOQ','MATRIX_CUSTOMER','NANCY']])await db.approvalWorkflow.create({data:{companyId:f.company.id,entityType:entityType!,workflowCode:workflowCode!,workflowName:workflowCode!,steps:{create:{stepNo:1,stepName:'Independent checker',requiredApprovals:1,stepRoles:{create:{roleId:functionRoles.get(actor!)!}}}}}});
      const makerSession=await sessions.create(f.maker.userId),nancy=await sessions.create(f.checker.userId);
      const post=async(session:typeof token,path:string,body:unknown,status=201)=>{const r=await fetch(base+path,{method:'POST',headers:{Cookie:'erp_session='+session.sessionToken,'x-csrf-token':session.csrfToken,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json() as Promise<any>;};
      await post(makerSession,'/budget/revisions/'+f.pending.id+'/submit',{workflowCode:'MATRIX_INTERNAL'});
      await post(nancy,'/budget/revisions/'+f.pending.id+'/approve',{},403);
      await post(token,'/budget/revisions/'+f.pending.id+'/approve',{});
      const root='/budget/customer/projects/'+pid;
      const created=await post(makerSession,root+'/versions',{requestId:randomUUID(),draft:f.input()});
      await post(makerSession,root+'/versions/'+created.data.id+'/submit',{requestId:randomUUID(),expectedEditNo:1,workflowCode:'MATRIX_CUSTOMER'});
      const history=await(await read(root+'/versions/'+created.data.id,200,makerSession.sessionToken)).json() as any;
      const decision={requestId:randomUUID(),expectedInstanceId:history.data.version.approvalInstanceId,decision:'APPROVE'};
      await post(makerSession,root+'/versions/'+created.data.id+'/decision',decision,403);
      await post(token,root+'/versions/'+created.data.id+'/decision',decision,403);
      const approved=await post(nancy,root+'/versions/'+created.data.id+'/decision',{...decision,requestId:randomUUID()});assert.equal(approved.data.approvalState,'APPROVED');
      assert.equal(JSON.stringify(await db.budgetRevision.findUniqueOrThrow({where:{id:f.source.id},include:{lines:true}})),sourceBefore);
    });
  }finally{await app.close();await db.$disconnect();}
});
