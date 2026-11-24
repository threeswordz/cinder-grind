import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {NestFactory} from '@nestjs/core';
import {AppModule} from '../app.module';
import {SessionService} from '../auth/session.service';
import {ProblemDetailsFilter} from '../common/problem-details.filter';
import {securityHeadersMiddleware} from '../common/security-headers';
import {PrismaService} from '../prisma/prisma.service';
import {EquipmentService} from './equipment.service';
import {EquipmentCustodyService} from './equipment-custody.service';

const target=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid/');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.M4_NON_PRODUCTION_CONFIRMED!=='YES'||
 !['localhost','127.0.0.1'].includes(target.hostname)||target.pathname!=='/erp_m4_jai_asset')
 throw Error('JAI_ASSET_DISPOSABLE_DB_ONLY');
test('JAI-ASSET native HTTP acquisition history, canonical CG identity, custody and live scope',async()=>{
 const prior=process.env.STORAGE_ROOT,storage=await mkdtemp(join(tmpdir(),'jai-asset-'));
 process.env.STORAGE_ROOT=storage;
 const app=await NestFactory.create(AppModule,{logger:false});
 app.setGlobalPrefix('api/v1');app.use(securityHeadersMiddleware(false));app.useGlobalFilters(new ProblemDetailsFilter());
 await app.listen(0,'127.0.0.1');
 const db=app.get(PrismaService),sessions=app.get(SessionService);
 try{
  const key=randomUUID().slice(0,8);
  const company=await db.company.create({data:{companyCode:'JA-'+key,companyName:'Disposable asset'}});
  const foreign=await db.company.create({data:{companyCode:'JAF-'+key,companyName:'Foreign asset'}});
  const customer=await db.customer.create({data:{companyId:company.id,customerCode:'C-'+key,customerName:'Customer'}});
  const fc=await db.customer.create({data:{companyId:foreign.id,customerCode:'C-'+key,customerName:'Foreign customer'}});
  const fields={contractValue:'1000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')};
  async function project(code:string,c=company.id,customerId=customer.id){
   return db.project.create({data:{companyId:c,customerId,projectCode:code+'-'+key,projectName:code,...fields}});
  }
  const a=await project('A'),b=await project('B'),f=await project('F',foreign.id,fc.id);
  const grants=['equipment.equipment.view','equipment.equipment.manage','equipment.custody.view','equipment.custody.manage','projects.access_all'];
  const ids=new Map<string,string>();
  for(const code of grants){const p=await db.permission.findUniqueOrThrow({where:{permissionCode:code}});ids.set(code,p.id);}
  async function actor(label:string,roleCode:string,codes:string[],projects:string[],c=company.id){
   const employee=await db.employee.create({data:{companyId:c,employeeCode:label+'-'+key,employeeName:label}});
   const user=await db.user.create({data:{companyId:c,employeeId:employee.id,email:label+'-'+key+'@example.invalid',displayName:label,passwordHash:'no-login'}});
   const role=await db.role.upsert({where:{companyId_roleCode:{companyId:c,roleCode}},update:{},create:{companyId:c,roleCode,roleName:roleCode}});
   await db.rolePermission.createMany({data:codes.map(code=>({roleId:role.id,permissionId:ids.get(code)!})),skipDuplicates:true});
   await db.userRole.create({data:{companyId:c,userId:user.id,roleId:role.id}});
   await db.projectMember.createMany({data:projects.map(projectId=>({projectId,employeeId:employee.id,projectRole:roleCode}))});
   const session=await sessions.create(user.id),auth=await sessions.resolve(session.sessionToken);assert.ok(auth);
   return {employee,user,role,session,auth};
  }
  const jai=await actor('Jai','PROCUREMENT_OFFICER',grants.slice(0,3),[a.id]);
  const nancy=await actor('Nancy','FINANCE_MANAGER',['equipment.equipment.view'],[a.id]);
  const store=await actor('Store','STOREKEEPER',grants.slice(0,4),[a.id]);
  const other=await actor('Outside','PROCUREMENT_OFFICER',grants.slice(0,3),[b.id]);
  const foreignActor=await actor('Foreign','PROCUREMENT_OFFICER',grants,[f.id],foreign.id);
  const equipment=app.get(EquipmentService),custody=app.get(EquipmentCustodyService);
  const type=await equipment.createType({auth:jai.auth},{equipmentTypeCode:'T',equipmentTypeName:'Tools'});
  const tool=await equipment.createEquipment({auth:jai.auth},{equipmentTypeId:type.id,equipmentCode:'CG00001',equipmentName:'Tool',operationalStatus:'AVAILABLE'});
  const unassigned=await equipment.createEquipment({auth:jai.auth},{equipmentTypeId:type.id,equipmentCode:'CG00002',equipmentName:'Central tool',operationalStatus:'AVAILABLE'});
  const issued=new Date(Date.now()-4*86400000);issued.setUTCHours(0,0,0,0);
  const due=new Date(issued.getTime()+10*86400000);
  await equipment.assign({auth:jai.auth},tool.id,{projectId:a.id,assignedFrom:issued});
  const loan=await custody.checkout({auth:store.auth},{equipmentId:tool.id,projectId:a.id,borrowerEmployeeId:store.employee.id,
    siteLabel:'Block A',issuedOn:issued,dueOn:due,conditionOut:'Good'});
  const path=(id:string)=>(app.getUrl().then(x=>x+'/api/v1/equipment/register/'+id+'/asset'));
  async function req(who:typeof jai,method:'GET'|'POST',id:string,input?:unknown){
   const response=await fetch(await path(id),{method,headers:{Cookie:'erp_session='+who.session.sessionToken,
    ...(method==='POST'?{'Content-Type':'application/json','x-csrf-token':who.session.csrfToken}:{})},
    ...(method==='POST'?{body:JSON.stringify(input)}:{})});
   return {status:response.status,raw:await response.json() as any};
  }
  const initial={expectedVersionId:null,purchaseDate:'2026-01-01',acquisitionValueTHB:'1250.25',evidenceReference:'Synthetic supplier invoice reference',recordedBaseLocation:'Main store',reason:'Initial source record'};
  assert.equal((await req(jai,'GET',unassigned.id)).status,403);
  assert.equal((await req(other,'GET',tool.id)).status,403);
  assert.equal((await req(foreignActor,'GET',tool.id)).status,404);
  assert.equal((await req(store,'GET',tool.id)).status,403);
  assert.equal((await req(nancy,'POST',tool.id,initial)).status,403);
  assert.equal((await req(jai,'POST',tool.id,{...initial,acquisitionValueTHB:'-1'})).status,422);
  const stockBefore=await db.stockTransaction.count({where:{companyId:company.id}});
  const apBefore=await db.supplierInvoice.count({where:{companyId:company.id}});
  const first=await req(jai,'POST',tool.id,initial);
  assert.equal(first.status,201,JSON.stringify(first.raw));
  const id=first.raw.data.id;
  const read=await req(jai,'GET',tool.id);assert.equal(read.status,200,JSON.stringify(read.raw));
  assert.equal(read.raw.data.current.acquisitionValueTHB,'1250.25');
  assert.equal(read.raw.data.currentProject.id,a.id);
  assert.equal(read.raw.data.currentCustody.borrowerName,'Store');
  assert.equal(read.raw.data.currentCustody.siteLabel,'Block A');
  assert.equal((await req(jai,'POST',tool.id,initial)).status,409);
  const updated=await req(jai,'POST',tool.id,{...initial,expectedVersionId:id,purchaseDate:null,acquisitionValueTHB:null,reason:'Unverified source; explicitly unknown'});
  assert.equal(updated.status,201,JSON.stringify(updated.raw));
  const finance=await req(nancy,'GET',tool.id);assert.equal(finance.status,200,JSON.stringify(finance.raw));
  assert.equal(finance.raw.data.current.acquisitionValueTHB,null);
  assert.equal(finance.raw.data.current.purchaseDate,null);
  assert.equal(finance.raw.data.history[1].acquisitionValueTHB,'1250.25');
  assert.equal(finance.raw.data.canEdit,false);
  assert.equal(finance.raw.data.custodyVisible,false);
  assert.equal(finance.raw.data.currentCustody,null);
  await assert.rejects(db.$executeRawUnsafe('UPDATE equipment_asset_register_versions SET acquisition_value_thb=0 WHERE id=$1::uuid',id));
  await assert.rejects(db.$executeRawUnsafe('DELETE FROM equipment_asset_register_versions WHERE id=$1::uuid',id));
  await assert.rejects(db.equipment.update({where:{id:tool.id},data:{equipmentCode:'CG00099'}}));
  const audit=await db.auditLog.findMany({where:{companyId:company.id,entityType:'EQUIPMENT_ASSET_REGISTER',entityId:tool.id}});
  assert.equal(audit.length,2);
  assert.ok(!JSON.stringify(audit).includes('1250.25'));
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stockBefore);
  assert.equal(await db.supplierInvoice.count({where:{companyId:company.id}}),apBefore);
  await custody.returnLoan({auth:store.auth},loan.id,{returnedOn:issued,conditionIn:'Good'});
  assert.equal((await req(jai,'GET',tool.id)).raw.data.currentCustody,null);
  await db.rolePermission.delete({where:{roleId_permissionId:{roleId:jai.role.id,permissionId:ids.get('equipment.equipment.manage')!}}});
  assert.equal((await req(jai,'POST',tool.id,{...initial,expectedVersionId:updated.raw.data.id})).status,403);
  await db.projectMember.updateMany({where:{projectId:a.id,employeeId:jai.employee.id},data:{isActive:false}});
  assert.equal((await req(jai,'GET',tool.id)).status,403);
  console.log('JAI_ASSET_NATIVE_CG_ACQUISITION_IMMUTABLE_HISTORY_CUSTODY_SCOPE_PASS');
 }finally{
  await app.close();if(prior===undefined)delete process.env.STORAGE_ROOT;else process.env.STORAGE_ROOT=prior;
  await rm(storage,{recursive:true,force:true});
 }
});
