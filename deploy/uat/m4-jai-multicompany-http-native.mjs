// JAI-SCOPE-01 / PUR12: actual authenticated multi-project, two-company PO and revision/PDF denial.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const apiRequire=createRequire(path.join(ROOT,'apps/api/package.json'));
const url=new URL(process.env.DATABASE_URL??'postgresql://invalid.invalid');
assert.equal(process.env.GITHUB_ACTIONS,'true');
assert.equal(process.env.M4_NON_PRODUCTION_CONFIRMED,'YES');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.port,'5432');
assert.equal(url.pathname,'/erp_m4_jai_multicompany');
const API='http://127.0.0.1:31364';
const temp=await mkdtemp(path.join(os.tmpdir(),'erp-m4-ben01-'));
process.env.STORAGE_ROOT=path.join(temp,'docs');
process.env.DOCUMENT_UPLOAD_TEMP_ROOT=path.join(temp,'uploads');
const {NestFactory}=apiRequire('@nestjs/core');
apiRequire('reflect-metadata');
const {AppModule}=apiRequire('./dist/app.module.js');
const {PrismaService}=apiRequire('./dist/prisma/prisma.service.js');
const {SessionService}=apiRequire('./dist/auth/session.service.js');
const {ProcurementService}=apiRequire('./dist/procurement/procurement.service.js');
const {SourcingService}=apiRequire('./dist/procurement/sourcing.service.js');
const {PurchaseOrderService}=apiRequire('./dist/procurement/purchase-order.service.js');
const {ProblemDetailsFilter}=apiRequire('./dist/common/problem-details.filter.js');
const {securityHeadersMiddleware}=apiRequire('./dist/common/security-headers.js');
const {Prisma}=apiRequire('@prisma/client');
const D=value=>new Prisma.Decimal(value);
const app=await NestFactory.create(AppModule,{logger:['warn','error']});
app.setGlobalPrefix('api/v1');
app.use(securityHeadersMiddleware(false));
app.useGlobalFilters(new ProblemDetailsFilter());
await app.listen(31364,'127.0.0.1');
const db=app.get(PrismaService),sessions=app.get(SessionService),prs=app.get(ProcurementService),sourcing=app.get(SourcingService),pos=app.get(PurchaseOrderService);
async function fixture(companyCode){
 const suffix=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode,companyName:'Disposable purchasing '+companyCode,
 }});
 const customer=await db.customer.create({data:{
  companyId:company.id,customerCode:'P01C-'+suffix,
  customerName:'PUR07 Browser synthetic customer',
 }});
 const project=await db.project.create({data:{
  companyId:company.id,customerId:customer.id,
  projectCode:'P01P-'+suffix,projectName:'PUR07 synthetic Project',
  contractValue:D('180000'),
  plannedStartDate:new Date('2026-10-01T00:00:00Z'),
  plannedCompletionDate:new Date('2027-12-31T00:00:00Z'),
 }});
 const uom=await db.unitOfMeasure.create({data:{
  companyId:company.id,uomCode:'EA-'+suffix,uomName:'Each',decimalPlaces:2,
 }});
 const permissions=[
  'procurement.pr.view','procurement.pr.manage','procurement.pr.submit',
  'procurement.pr.approve','procurement.rfq.view','procurement.rfq.manage',
  'procurement.quotation.view','procurement.quotation.manage',
  'procurement.award.select','procurement.po.view','procurement.po.create',
  'procurement.po.edit','procurement.po.submit','procurement.po.approve','procurement.po.revise',
 ];
 const permissionIds=new Map();
 for(const code of permissions){
  const v=await db.permission.upsert({where:{permissionCode:code},
   update:{},create:{permissionCode:code,moduleCode:'PROCUREMENT'}});
  permissionIds.set(code,v.id);
 }
 const roleCache=new Map();
 async function role(code){
  if(roleCache.has(code))return roleCache.get(code);
  const found=await db.role.create({data:{
   companyId:company.id,roleCode:code,roleName:'Synthetic '+code,
  }});
  roleCache.set(code,found);
  return found;
 }
 const prRole=await role('PUR07_PR_REVIEW_'+suffix);
 const poRole=await role('PUR07_PO_REVIEW_'+suffix);
 async function actor(label,assignment){
  const employee=await db.employee.create({data:{
   companyId:company.id,employeeCode:label.slice(0,3).toUpperCase()+suffix,
   employeeName:'Synthetic '+label,
  }});
  const user=await db.user.create({data:{
   companyId:company.id,employeeId:employee.id,
   email:label.toLowerCase()+'-'+suffix+'@example.invalid',
   displayName:'Synthetic '+label,passwordHash:'not-an-auth-password',
  }});
  const roleCodes=[];
  for(const {code,grants} of assignment){
   const r=await role(code);
   roleCodes.push(code);
   await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:r.id}});
   if(grants.length){
    await db.rolePermission.createMany({data:grants.map(g=>({
     roleId:r.id,permissionId:permissionIds.get(g),
    })),skipDuplicates:true});
   }
  }
  await db.projectMember.create({data:{
   projectId:project.id,employeeId:employee.id,projectRole:'PUR07 fixture',
  }});
  const live=await sessions.create(user.id);
  return {
   id:user.id,token:live.sessionToken,csrf:live.csrfToken,roleCodes,
   auth:{
    sessionId:randomUUID(),userId:user.id,companyId:company.id,
    email:user.email,displayName:user.displayName,roleCodes,
    permissions,csrfTokenHash:'0'.repeat(64),
   },
  };
 }
 const maker=await actor('Store',[{code:'STOREKEEPER',grants:[
  'procurement.pr.view','procurement.pr.manage','procurement.pr.submit',
 ]}]);
 const khaimook=await actor('Khaimook',[
  {code:'PROJECT_MANAGER',grants:['procurement.pr.view','procurement.pr.approve']},
  {code:prRole.roleCode,grants:[]},
 ]);
 const jai=await actor('Jai',[{code:'PROCUREMENT_OFFICER',grants:[
  'procurement.po.view','procurement.po.create','procurement.po.edit',
  'procurement.po.submit','procurement.po.revise','procurement.rfq.view','procurement.rfq.manage',
  'procurement.quotation.view','procurement.quotation.manage',
  'procurement.award.select',
 ]}]);
 const ben=await actor('Ben',[
  {code:'MANAGEMENT',grants:['procurement.po.view','procurement.po.approve']},
  {code:poRole.roleCode,grants:[]},
 ]);
 // The real PO panel now also reads PUR10. Configure only the three
 // already-created independent synthetic actors for this disposable company.
 // Do not grant new permissions, fabricate a cancellation or suppress HTTP409.
 await db.systemSetting.create({data:{
  companyId:company.id,settingKey:'PUR10_NAMED_ACTORS_V1',
  settingValue:{jai:jai.id,khaimook:khaimook.id,ben:ben.id},
 }});
 for(const [entityType,sequenceCode,formatTemplate] of [
  ['PURCHASE_REQUEST','PURCHASE_REQUEST','PRYYMM-###'],
  ['RFQ','RFQ','RFQYYMM-###'],
  ['PURCHASE_ORDER','PURCHASE_ORDER','POYYMM-###'],
 ]){
  await db.numberSequence.create({data:{
   companyId:company.id,entityType,sequenceCode,formatTemplate,resetRule:'MONTHLY',
  }});
 }
 const prFlow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PUR07-PR-'+suffix,
  entityType:'PURCHASE_REQUEST',workflowName:'Synthetic Khaimook PR',
  steps:{create:[{stepNo:1,stepName:'Khaimook review',requiredApprovals:1,
   stepRoles:{create:[{roleId:prRole.id}]}}]},
 }});
 const poFlow=await db.approvalWorkflow.create({data:{
  companyId:company.id,workflowCode:'PUR07-PO-'+suffix,
  entityType:'PURCHASE_ORDER',workflowName:'Synthetic Ben PO',
  steps:{create:[{stepNo:1,stepName:'Independent Ben',requiredApprovals:1,
   stepRoles:{create:[{roleId:poRole.id}]}}]},
 }});
 const supplier=await db.supplier.create({data:{
  companyId:company.id,supplierCode:'PUR07-S-'+suffix,
  supplierName:'บริษัท เซมิคอนกรีต จำกัด',shortName:'SEMICON',
 }});
 // Fixture-only genuine backend services: normal approved Store PR,
 // Khaimook decision, Jai RFQ/THB quotation/award, real draft PO.
 // Only the approval authority actions below use real authenticated HTTP.
 const request=await prs.createRequest({auth:maker.auth},project.id,'PUR07 quote exception');
 const prLine=await prs.createLine({auth:maker.auth},request.id,{
  lineType:'SERVICE',description:'บริการคอนกรีตสำหรับไซต์',
  quantity:D('1'),uomId:uom.id,
 });
 await prs.submitRequest({auth:maker.auth},request.id,prFlow.workflowCode);
 await prs.approveRequest({auth:khaimook.auth},request.id,'Synthetic valid demand');
 const rfq=await sourcing.createRfq({auth:maker.auth},project.id,{
  lines:[{purchaseRequestLineId:prLine.id,quantity:D('1')}],
 });
 await sourcing.inviteSupplier({auth:jai.auth},rfq.id,supplier.id);
 const quote=await sourcing.createQuotation({auth:jai.auth},rfq.id,supplier.id,{
  quotationDate:new Date(),supplierReference:'PUR07-AUTH-CHROME-'+suffix,
 });
 assert.equal(quote.currencyCode,'THB');
 const quotedLine=await sourcing.upsertQuotationLine(
  {auth:jai.auth},quote.id,rfq.lines[0].id,
  {quantity:D('1'),unitPrice:D('2000')},
 );
 const award=await sourcing.selectAward(
  {auth:jai.auth},rfq.lines[0].id,quotedLine.id,'Valid synthetic sole-supplier award',
 );
 const po=await pos.createOrder(
  {auth:jai.auth},project.id,[award.id],'Multi-company scoped PO fixture',
 );
 await pos.updateOrder({auth:jai.auth},po.id,{
  discountAmount:D('100'),freightAmount:D('50'),
  additionalChargeAmount:D('20'),vatRatePercent:D('7'),
  deliveryLocation:'โกดังไซต์งาน',paymentTerms:'เครดิต 30 วัน',
 });
 await pos.submit({auth:jai.auth},po.id,poFlow.workflowCode);

 await pos.approve({auth:ben.auth},po.id,'Synthetic approved PO for scope proof');
 const other=await db.project.create({data:{companyId:company.id,customerId:project.customerId,projectCode:'OTHER-'+suffix,projectName:'Second assigned Project',contractValue:D('10000'),plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
 const third=await db.project.create({data:{companyId:company.id,customerId:project.customerId,projectCode:'THIRD-'+suffix,projectName:'Unassigned Project',contractValue:D('10000'),plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
 const jaiEmployee=(await db.user.findUniqueOrThrow({where:{id:jai.id}})).employeeId;
 assert.ok(jaiEmployee);
 await db.projectMember.create({data:{projectId:other.id,employeeId:jaiEmployee,projectRole:'Synthetic purchasing'}});
 const outsider=await actor('OtherBuyer',[{code:'PROCUREMENT_OFFICER',grants:[]}]);
 const outsiderEmployee=(await db.user.findUniqueOrThrow({where:{id:outsider.id}})).employeeId;
 await db.projectMember.updateMany({where:{projectId:project.id,employeeId:outsiderEmployee},data:{isActive:false}});
 await db.projectMember.create({data:{projectId:third.id,employeeId:outsiderEmployee,projectRole:'Synthetic purchasing'}});
 return {company,project,other,third,jai,outsider,po,ben};
}
async function run(){
 const mke=await fixture('MKE'),tcj=await fixture('TCJ');
 const root='/api/v1/procurement';
 async function request(a,route,method='GET',body){return fetch(API+root+route,{method,headers:{Cookie:'erp_session='+a.token,'X-CSRF-Token':a.csrf,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});}
 async function data(a,route){const r=await request(a,route);assert.equal(r.status,200,route);return (await r.json()).data;}
 async function denied(a,route,status,code,method='GET',body){const r=await request(a,route,method,body);assert.equal(r.status,status,route);assert.equal((await r.json()).code,code,route);}
 for(const [own,foreign,prefix] of [[mke,tcj,'K-'],[tcj,mke,'T-']]){
  const {jai,outsider,project,other,third,po,company}=own;
  const ids=(await data(jai,'/po-projects')).map(x=>x.id).sort();
  assert.deepEqual(ids,[project.id,other.id].sort());
  assert.deepEqual((await data(jai,'/po-create-projects')).map(x=>x.id).sort(),ids);
  assert.deepEqual((await data(outsider,'/po-projects')).map(x=>x.id),[third.id]);
  const list=await data(jai,'/projects/'+project.id+'/purchase-orders');
  assert.equal(list.length,1);assert.equal(list[0].id,po.id);
  assert.deepEqual(await data(jai,'/projects/'+other.id+'/purchase-orders'),[]);
  const detail=await data(jai,'/purchase-orders/'+po.id);
  assert.equal(detail.displayNumber,prefix+po.poNumber+' SEMICON');
  assert.equal(detail.companyId,company.id);
  await denied(jai,'/projects/'+third.id+'/purchase-orders',403,'PROJECT_ACCESS_DENIED');
  await denied(jai,'/projects/'+foreign.project.id+'/purchase-orders',404,'PROJECT_NOT_FOUND');
  const before=await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}});
  const audit=await db.auditLog.count({where:{companyId:company.id}});
  const count=await db.purchaseOrder.count({where:{companyId:company.id}});
  const stock=await db.stockTransaction.count({where:{companyId:company.id}}),finance=await db.directCostPosting.count({where:{companyId:company.id}});
  const route='/purchase-orders/'+po.id;
  for(const end of ['', '/revisions','/pdf','/dispatch-events']){
   await denied(outsider,route+end,403,'PROJECT_ACCESS_DENIED');
   await denied(foreign.jai,route+end,404,'PURCHASE_ORDER_NOT_FOUND');
  }
  await denied(outsider,route+'/revise',403,'PROJECT_ACCESS_DENIED','POST',{revisionReason:'Unauthorized'});
  await denied(foreign.jai,route+'/revise',404,'PURCHASE_ORDER_NOT_FOUND','POST',{revisionReason:'Unauthorized'});
  assert.deepEqual(await db.purchaseOrder.findUniqueOrThrow({where:{id:po.id}}),before);
  assert.equal(await db.purchaseOrder.count({where:{companyId:company.id}}),count);
  assert.equal(await db.auditLog.count({where:{companyId:company.id}}),audit);
  assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stock);
  assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),finance);
  console.log('M4_JAI_REAL_MULTI_PROJECT_COMPANY_PO_REVISION_PDF_SCOPE_PASS',company.companyCode);
 }
 assert.equal(mke.po.poNumber,tcj.po.poNumber,'Independent companies may use same sequence; identity and scope must still be distinct');
 assert.notEqual(mke.po.id,tcj.po.id);
 console.log('M4_PUR12_REAL_HTTP_SAME_SEQUENCE_DISTINCT_COMPANY_DISPLAY_ID_PASS');
}

try{await run();}finally{await app.close();await rm(temp,{recursive:true,force:true});}
