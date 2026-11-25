import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { NestFactory } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AppModule } from '../app.module';
import { SessionService } from '../auth/session.service';
import type { AuthenticatedUserContext } from '../auth/auth.types';
import { ProblemDetailsFilter } from '../common/problem-details.filter';
import { securityHeadersMiddleware } from '../common/security-headers';
import { PrismaService } from '../prisma/prisma.service';
import { ProcurementService } from '../procurement/procurement.service';
import { EquipmentService } from '../equipment/equipment.service';
import { EquipmentCustodyService } from '../equipment/equipment-custody.service';

const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.M4_NON_PRODUCTION_CONFIRMED!=='YES'||
  !['localhost','127.0.0.1'].includes(target.hostname)||
  target.pathname!=='/erp_m4_pm15_portfolio')throw Error('PM15_DISPOSABLE_DB_ONLY');

test('PM15 native HTTP authorized Company portfolio, returned PR lineage, due tools and capability revocation',async()=>{
 const prior=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'m4-pm15-'));
 process.env.STORAGE_ROOT=storage;
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');
 app.use(securityHeadersMiddleware(false));
 app.useGlobalFilters(new ProblemDetailsFilter());
 await app.listen(0,'127.0.0.1');
 const db=app.get(PrismaService), sessions=app.get(SessionService);
 try{
  const key=randomUUID().slice(0,8);
  const company=await db.company.create({data:{companyCode:'PM15-'+key,companyName:'Disposable PM15'}});
  const foreign=await db.company.create({data:{companyCode:'PM15F-'+key,companyName:'Foreign'}});
  const customer=await db.customer.create({data:{companyId:company.id,customerCode:'C-'+key,customerName:'Synthetic'}});
  const foreignCustomer=await db.customer.create({data:{companyId:foreign.id,customerCode:'C-'+key,customerName:'Foreign'}});
  const fields={contractValue:'1000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')};
  async function project(code:string,c=company.id,customerId=customer.id){
    return db.project.create({data:{companyId:c,customerId,projectCode:code+'-'+key,projectName:code,...fields}});
  }
  const a=await project('A'), b=await project('B'), hidden=await project('H'), outside=await project('F',foreign.id,foreignCustomer.id);
  const grants=['inventory.stock.view','procurement.pr.view','inventory.stock_count.view',
    'equipment.custody.view','equipment.custody.manage','subcontracts.work_order.view',
    'subcontracts.claim.view','subcontracts.certification.view','procurement.pr.manage',
    'procurement.pr.submit','procurement.pr.approve'];
  const permissionIds=new Map<string,string>();
  for(const code of grants){
    const p=await db.permission.upsert({where:{permissionCode:code},update:{},
      create:{permissionCode:code,moduleCode:code.split('.')[0]!.toUpperCase()}});
    permissionIds.set(code,p.id);
  }
  async function actor(label:string,roleCode:string,codes:string[],projectIds:string[],c=company.id){
    const employee=await db.employee.create({data:{companyId:c,employeeCode:label+'-'+key,employeeName:label}});
    const user=await db.user.create({data:{companyId:c,employeeId:employee.id,email:label+'-'+key+'@example.invalid',
      displayName:label,passwordHash:'not-a-login'}});
    const role=await db.role.create({data:{companyId:c,roleCode,roleName:roleCode}});
    await db.rolePermission.createMany({data:codes.map(code=>({roleId:role.id,permissionId:permissionIds.get(code)!}))});
    await db.userRole.create({data:{companyId:c,userId:user.id,roleId:role.id}});
    await db.projectMember.createMany({data:projectIds.map(projectId=>({projectId,employeeId:employee.id,projectRole:roleCode}))});
    const session=await sessions.create(user.id);
    const auth={companyId:c,userId:user.id,sessionId:session.sessionId,email:user.email,
      displayName:user.displayName,roleCodes:[roleCode],permissions:codes,csrfTokenHash:'0'.repeat(64)} as AuthenticatedUserContext;
    return {user,employee,role,session,auth};
  }
  const pm=await actor('PM','PROJECT_MANAGER',grants,[a.id,b.id]);
  const store=await actor('Store','STOREKEEPER',['inventory.stock.view','procurement.pr.view',
    'procurement.pr.manage','procurement.pr.submit'],[a.id,b.id,hidden.id]);
  const other=await actor('ForeignPM','PROJECT_MANAGER',grants,[outside.id],foreign.id);
  const uom=await db.unitOfMeasure.create({data:{companyId:company.id,uomCode:'EA-'+key,uomName:'Each',decimalPlaces:2}});
  await db.numberSequence.create({data:{companyId:company.id,entityType:'PURCHASE_REQUEST',
    sequenceCode:'PURCHASE_REQUEST',formatTemplate:'PRYYMM-###',resetRule:'MONTHLY'}});
  const workflow=await db.approvalWorkflow.create({data:{companyId:company.id,workflowCode:'PM15-'+key,
    workflowName:'Synthetic PM review',entityType:'PURCHASE_REQUEST',steps:{create:[{
      stepNo:1,stepName:'Review',requiredApprovals:1,stepRoles:{create:[{roleId:pm.role.id}]}}]}}});
  const prs=app.get(ProcurementService);
  async function submit(projectId:string,two=false){
    const pr=await prs.createRequest({auth:store.auth},projectId,'PM15 source');
    const first=await prs.createLine({auth:store.auth},pr.id,{lineType:'SERVICE',description:'Actual source A',quantity:new Prisma.Decimal(1),uomId:uom.id});
    const second=two?await prs.createLine({auth:store.auth},pr.id,{lineType:'SERVICE',description:'Actual source B',quantity:new Prisma.Decimal(2),uomId:uom.id}):null;
    const submitted=await prs.submitRequest({auth:store.auth},pr.id,workflow.workflowCode);
    return {pr,first,second,instanceId:submitted.approvalInstanceId!};
  }
  await submit(a.id);await submit(b.id);await submit(hidden.id);
  const mixed=await submit(a.id,true);
  await prs.decideRequestLines({auth:pm.auth},mixed.pr.id,mixed.instanceId,[
    {lineId:mixed.first.id,decision:'APPROVED'},
    {lineId:mixed.second!.id,decision:'RETURNED',reason:'Correct requested scope and quantity'},
  ],'Independent PM decision');
  const equipment=app.get(EquipmentService),custody=app.get(EquipmentCustodyService);
  const type=await equipment.createType({auth:pm.auth},{equipmentTypeCode:'T-'+key,equipmentTypeName:'Tools'});
  // Dates are derived from the same Thai calendar as the report, while issue
  // date is safely before the current UTC date for the canonical custody guard.
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const today=new Date(day+'T00:00:00.000Z');
  const yesterday=new Date(today.getTime()-86400000);
  const issued=new Date(today.getTime()-3*86400000);
  async function loan(code:string,due:Date){
    const tool=await equipment.createEquipment({auth:pm.auth},{equipmentTypeId:type.id,equipmentCode:code,
      equipmentName:'Synthetic tool',operationalStatus:'AVAILABLE'});
    await equipment.assign({auth:pm.auth},tool.id,{projectId:a.id,assignedFrom:issued});
    return custody.checkout({auth:pm.auth},{equipmentId:tool.id,projectId:a.id,borrowerEmployeeId:store.employee.id,
      siteLabel:'A',issuedOn:issued,dueOn:due,conditionOut:'Good condition'});
  }
  await loan('CG00001',today);await loan('CG00002',yesterday);
  const returned=await loan('CG00003',yesterday);
  await custody.returnLoan({auth:pm.auth},returned.id,{returnedOn:yesterday,conditionIn:'Good'});
  const base=(await app.getUrl())+'/api/v1/inventory/stock-minimums/portfolio-work-queue';
  async function get(who:typeof pm){
    const r=await fetch(base,{headers:{Cookie:'erp_session='+who.session.sessionToken}});
    return {status:r.status,body:await r.json() as any};
  }
  const beforeStock=await db.stockTransaction.count({where:{companyId:company.id}});
  const beforeAudit=await db.auditLog.count({where:{companyId:company.id}});
  const result=await get(pm);
  assert.equal(result.status,200,JSON.stringify(result.body));
  const rows=result.body.data.projects;
  assert.deepEqual(rows.map((r:any)=>r.id),[a.id,b.id]);
  assert.equal(rows[0].pendingPurchaseRequests,1);
  assert.equal(rows[1].pendingPurchaseRequests,1);
  assert.equal(rows[0].returnedLinesWithoutCorrection,1);
  assert.equal(rows[0].correctionRequestsNotApproved,0);
  assert.equal(rows[0].toolsDueToday,1);
  assert.equal(rows[0].toolsOverdue,1);
  assert.equal(rows[1].toolsOverdue,0);
  assert.equal(rows[0].pendingStockCounts,0);
  assert.equal(rows[0].pendingWorkOrders,0);
  assert.equal(rows[0].pendingClaims,0);
  assert.equal(rows[0].pendingCertifications,0);
  assert.equal(result.body.data.financeEffect,false);
  assert.equal(await db.auditLog.count({where:{companyId:company.id}}),beforeAudit);
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),beforeStock);
  assert.equal((await get(store)).status,403);
  const foreignView=await get(other);
  assert.equal(foreignView.status,200,JSON.stringify(foreignView.body));
  assert.deepEqual(foreignView.body.data.projects.map((r:any)=>r.id),[outside.id]);
  await prs.copyReturned({auth:store.auth},mixed.pr.id);
  const corrected=await get(pm);
  assert.equal(corrected.body.data.projects[0].returnedLinesWithoutCorrection,0);
  assert.equal(corrected.body.data.projects[0].correctionRequestsNotApproved,1);
  await db.rolePermission.delete({where:{roleId_permissionId:{roleId:pm.role.id,permissionId:permissionIds.get('equipment.custody.view')!}}});
  const limited=await get(pm);
  assert.equal(limited.status,200);
  assert.equal(limited.body.data.projects[0].toolsDueToday,null);
  assert.equal(limited.body.data.projects[0].toolsOverdue,null);
  await db.projectMember.updateMany({where:{projectId:b.id,employeeId:pm.employee.id},data:{isActive:false}});
  assert.deepEqual((await get(pm)).body.data.projects.map((r:any)=>r.id),[a.id]);
  await db.userSession.update({where:{id:pm.session.sessionId},data:{revokedAt:new Date()}});
  const denied=await get(pm);
  assert.ok([401,403].includes(denied.status),JSON.stringify(denied.body));
  console.log('PM15_NATIVE_PORTFOLIO_SCOPE_PR_CORRECTION_TOOLS_AND_REVOCATION_PASS');
 }finally{
  await app.close();
  if(prior===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=prior;
  await rm(storage,{recursive:true,force:true});
 }
});
