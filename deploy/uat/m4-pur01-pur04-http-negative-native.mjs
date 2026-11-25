// Actual PUR01/PUR04 transport boundary and stale comparison recovery. Disposable company only.
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
assert.equal(url.pathname,'/erp_m4_pur01_pur04_http');
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
async function run(){
 const suffix=randomUUID().slice(0,8);
 const company=await db.company.create({data:{
  companyCode:'MKE',companyName:'BEN01 disposable native only',
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
  'procurement.po.edit','procurement.po.submit','procurement.po.approve','procurement.po.revise','procurement.po.reject',
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
  {code:'MANAGEMENT',grants:['procurement.po.view','procurement.po.approve','procurement.po.reject']},
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
  {auth:jai.auth},project.id,[award.id],'PUR01/PUR04 stale comparison fixture',
 );
 await pos.updateOrder({auth:jai.auth},po.id,{
  discountAmount:D('100'),freightAmount:D('50'),
  additionalChargeAmount:D('20'),vatRatePercent:D('7'),
  deliveryLocation:'โกดังไซต์งาน',paymentTerms:'เครดิต 30 วัน',
 });
 const route=API+'/api/v1/procurement/purchase-orders/'+po.id;
 const call=(a,url,method,body)=>fetch(url,{method,headers:{Cookie:'erp_session='+a.token,'X-CSRF-Token':a.csrf,'Content-Type':'application/json'},body:JSON.stringify(body)});
 async function ok(a,url,method,body,status){const r=await call(a,url,method,body);assert.equal(r.status,status,url);return (await r.json()).data;}
 async function denied(a,url,method,body,status,code){const r=await call(a,url,method,body);assert.equal(r.status,status,url);assert.equal((await r.json()).code,code,url);}
 const snapshot=id=>db.purchaseOrder.findUniqueOrThrow({where:{id},include:{approvalInstance:true}});
 const audits=id=>db.auditLog.count({where:{companyId:company.id,entityType:'PURCHASE_ORDER',entityId:id}});
 const stock=await db.stockTransaction.count({where:{companyId:company.id}}),finance=await db.directCostPosting.count({where:{companyId:company.id}});
 let before=await snapshot(po.id),audit=await audits(po.id);
 for(const [body,code] of [
  [{freightAmount:'-0.01'},'VALIDATION_ERROR'],
  [{freightAmount:'NaN'},'VALIDATION_ERROR'],
  [{freightAmount:'Infinity'},'VALIDATION_ERROR'],
  [{freightAmount:'0.001'},'PO_COMMERCIAL_PRECISION_INVALID'],
  [{vatRatePercent:'100.01'},'PO_VAT_PERCENT_INVALID'],
  [{discountAmount:'100000000000000'},'VALIDATION_ERROR'],
 ]){
  await denied(jai,route,'PATCH',body,422,code);
  assert.deepEqual(await snapshot(po.id),before);
  assert.equal(await audits(po.id),audit);
 }
 console.log('M4_PUR04_REAL_HTTP_INVALID_COMMERCIAL_PATCH_ATOMIC_DENIAL_PASS');
 const nulled=await ok(jai,route,'PATCH',{freightAmount:null,deliveryContact:null},200);
 assert.equal(nulled.freightAmount,null);assert.equal(nulled.discountAmount,'100');
 before=await snapshot(po.id);audit=await audits(po.id);
 await denied(jai,route+'/submit','POST',{workflowCode:poFlow.workflowCode},422,'PO_QUOTE_COMMERCIAL_BASIS_UNKNOWN');
 assert.deepEqual(await snapshot(po.id),before);assert.equal(await audits(po.id),audit);
 const explicit=await ok(jai,route,'PATCH',{freightAmount:'0',discountAmount:'0',additionalChargeAmount:'0',vatRatePercent:'0',deliveryContact:'Site contact'},200);
 assert.equal(explicit.freightAmount,'0');assert.equal(explicit.vatRatePercent,'0');
 assert.equal(explicit.deliveryLocation,'โกดังไซต์งาน');assert.equal(explicit.paymentTerms,'เครดิต 30 วัน');
 console.log('M4_PUR04_REAL_HTTP_NULL_NOT_ZERO_AND_OMITTED_TERMS_PRESERVED_PASS');
 // 2,000 line subtotal + 8,000.01 freight makes TWO bids mandatory.
 await ok(jai,route,'PATCH',{freightAmount:'8000.01',supplierQuoteExceptionReason:null},200);
 before=await snapshot(po.id);audit=await audits(po.id);
 await denied(jai,route+'/submit','POST',{workflowCode:poFlow.workflowCode},422,'PO_QUOTE_SUPPLIERS_INSUFFICIENT');
 assert.deepEqual(await snapshot(po.id),before);assert.equal(await audits(po.id),audit);
 // Add one actual comparable THB offer, submit without exception; after
 // submission deactivate only the competing supplier to make final gate stale.
 const competing=await db.supplier.create({data:{companyId:company.id,supplierCode:'COMP-'+suffix,supplierName:'Competing supplier',shortName:'COMP'}});
 await sourcing.inviteSupplier({auth:jai.auth},rfq.id,competing.id);
 const compQuote=await sourcing.createQuotation({auth:jai.auth},rfq.id,competing.id,{quotationDate:new Date(),supplierReference:'COMP-'+suffix});
 await sourcing.upsertQuotationLine({auth:jai.auth},compQuote.id,rfq.lines[0].id,{quantity:D('1'),unitPrice:D('2100')});
 const submitted=await ok(jai,route+'/submit','POST',{workflowCode:poFlow.workflowCode},201);
 assert.equal(submitted.lifecycleState,'SUBMITTED');
 const pending=await snapshot(po.id),pendingAudit=await audits(po.id);
 await db.supplier.update({where:{id:competing.id},data:{isActive:false}});
 await denied(ben,route+'/approve','POST',{comment:'Cannot approve stale comparison'},422,'PO_QUOTE_SUPPLIERS_INSUFFICIENT');
 assert.deepEqual(await snapshot(po.id),pending);assert.equal(await audits(po.id),pendingAudit);
 assert.equal(await db.approvalAction.count({where:{approvalInstanceId:pending.approvalInstanceId}}),0);
 assert.equal(await db.auditLog.count({where:{companyId:company.id,entityId:po.id,action:'PUR01_FINAL_QUOTE_POLICY'}}),0);
 console.log('M4_PUR01_REAL_HTTP_COMPARABLE_BID_DEACTIVATED_AFTER_SUBMIT_ATOMIC_DENIAL_PASS');
 // Reject and issue new immutable revision instead of editing submitted PO.
 const rejected=await ok(ben,route+'/reject','POST',{comment:'Comparison no longer complete'},201);
 assert.equal(rejected.lifecycleState,'REJECTED');
 const original=await snapshot(po.id);
 const rev=await ok(jai,route+'/revise','POST',{revisionReason:'Supplier comparison changed'},201);
 assert.equal(rev.revisionNo,1);
 const revisedRoute=API+'/api/v1/procurement/purchase-orders/'+rev.id;
 await ok(jai,revisedRoute,'PATCH',{supplierQuoteExceptionReason:'Competing supplier no longer active; certified sole source'},200);
 await ok(jai,revisedRoute+'/submit','POST',{workflowCode:poFlow.workflowCode},201);
 const approved=await ok(ben,revisedRoute+'/approve','POST',{comment:'Independent sole-source decision'},201);
 assert.equal(approved.lifecycleState,'APPROVED');
 assert.deepEqual(await snapshot(po.id),original);
 const final=await db.auditLog.findMany({where:{companyId:company.id,entityId:rev.id,action:'PUR01_FINAL_QUOTE_POLICY'}});
 assert.equal(final.length,1);assert.equal(final[0].actorUserId,ben.id);
 assert.equal(final[0].newValues.netExVatTHB,'10000.01');assert.equal(final[0].newValues.requiredSuppliers,2);assert.equal(final[0].newValues.comparableSuppliers,1);
 assert.equal(await db.stockTransaction.count({where:{companyId:company.id}}),stock);
 assert.equal(await db.directCostPosting.count({where:{companyId:company.id}}),finance);
 console.log('M4_PUR01_PUR04_REAL_HTTP_REJECT_NEW_REVISION_INDEPENDENT_EXCEPTION_AUDIT_PASS');
}

try{await run();}finally{await app.close();await rm(temp,{recursive:true,force:true});}
