import {randomUUID,randomBytes} from 'node:crypto';
import {PasswordService} from '../auth/password.service';
import {Prisma} from '@prisma/client';
import {PrismaService} from '../prisma/prisma.service';
import {SessionService} from '../auth/session.service';
import {AuthorizationService} from '../authorization/authorization.service';
import {ProjectScopeService} from '../authorization/project-scope.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {AuditService} from '../audit/audit.service';
import {ApprovalService} from '../approval/approval.service';
import {NumberSequenceService} from '../administration/number-sequence.service';
import {ProcurementService} from '../procurement/procurement.service';
import {SourcingService} from '../procurement/sourcing.service';
import {PurchaseOrderService} from '../procurement/purchase-order.service';

// Synthetic source setup uses the existing PR → RFQ → quotation/award → approved PO services.
// No acceptance, receiving policy, grants in retained Companies or stock is backfilled.
export async function receivingFixture(db:PrismaService,mixed=false){
 const password=randomBytes(32).toString('hex'),passwordHash=await new PasswordService().hash(password);
 const suffix=randomUUID().slice(0,8), company=await db.company.create({data:{companyCode:'RC-'+suffix,companyName:'Synthetic receiving'}});
 const customer=await db.customer.create({data:{companyId:company.id,customerCode:'RC-C',customerName:'Synthetic customer'}});
 const project=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'RC-P',projectName:'Synthetic receipt site',contractValue:'10000',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
 const unassigned=await db.project.create({data:{companyId:company.id,customerId:customer.id,projectCode:'RC-X',projectName:'Unassigned site',contractValue:'0',plannedStartDate:new Date('2026-01-01'),plannedCompletionDate:new Date('2027-12-31')}});
 const sessions=new SessionService(db);
 const actor=async(label:string,codes:string[],member=true)=>{
  const employee=await db.employee.create({data:{companyId:company.id,employeeCode:label,employeeName:'Synthetic '+label}});
  const user=await db.user.create({data:{companyId:company.id,employeeId:employee.id,email:label.toLowerCase()+'-'+suffix+'@example.invalid',displayName:label,passwordHash}});
  const role=await db.role.create({data:{companyId:company.id,roleCode:label,roleName:label}});
  const permissions=await db.permission.findMany({where:{permissionCode:{in:codes}}});
  if(permissions.length!==new Set(codes).size)throw Error('Receiving fixture permission unavailable: '+codes.filter(c=>!permissions.some(p=>p.permissionCode===c)).join(','));
  await db.rolePermission.createMany({data:permissions.map(p=>({roleId:role.id,permissionId:p.id}))});
  await db.userRole.create({data:{companyId:company.id,userId:user.id,roleId:role.id}});
  if(member)await db.projectMember.create({data:{projectId:project.id,employeeId:employee.id,projectRole:label}});
  const session=await sessions.create(user.id),auth=await sessions.resolve(session.sessionToken);if(!auth)throw Error('Synthetic session unavailable');return {employee,user,role,session,auth,password};
 };
 const doc=['documents.document.view','documents.document.upload','documents.document.link'];
 const store=await actor('Store',['inventory.receiving.view','inventory.receiving.capture','inventory.receiving.edit','inventory.receiving.link_po','inventory.receipt.view','inventory.receipt.create','inventory.receipt.edit','inventory.receipt.submit','inventory.receipt.reverse',...doc]);
 const jai=await actor('Jai',['inventory.receiving.view','inventory.receiving.check','inventory.receipt.view','documents.document.view']);
 const pm=await actor('Khaimook',['inventory.receiving.view','inventory.receipt.view','inventory.receipt.approve','documents.document.view']);
 const config=await actor('Config',['inventory.receiving.view','inventory.receiving.configure']);
 const outsider=await actor('Outsider',['inventory.receiving.view','inventory.receiving.capture'],false);
 const viewer=await actor('Viewer',['inventory.receiving.view']);
 const procurementCodes=['procurement.pr.view','procurement.pr.manage','procurement.pr.submit','procurement.pr.approve','procurement.rfq.view','procurement.rfq.manage','procurement.quotation.view','procurement.quotation.manage','procurement.award.select','procurement.po.view','procurement.po.create','procurement.po.edit','procurement.po.submit','procurement.po.approve','procurement.po.reject','procurement.po.cancel','procurement.po.revise'];
 const buyer=await actor('Buyer',procurementCodes), buyerChecker=await actor('BuyerChecker',procurementCodes);
 const wbs=await db.wbsElement.create({data:{projectId:project.id,wbsCode:'01',wbsName:'Structure'}}),costCode=await db.costCode.create({data:{companyId:company.id,costCode:'MAT',costName:'Materials'}});
 const uom=await db.unitOfMeasure.create({data:{companyId:company.id,uomCode:'EA',uomName:'Each',decimalPlaces:4}});
 const material=await db.material.create({data:{companyId:company.id,materialCode:'STEEL',materialName:'Synthetic steel',defaultUomId:uom.id}});
 const secondaryMaterial=mixed?await db.material.create({data:{companyId:company.id,materialCode:'LEGACY',materialName:'Synthetic unchanged legacy material',defaultUomId:uom.id}}):null;
 const supplier=await db.supplier.create({data:{companyId:company.id,supplierCode:'RC-S',supplierName:'Synthetic supplier'}});
 const warehouse=await db.warehouse.create({data:{companyId:company.id,projectId:project.id,warehouseCode:'RC-W',warehouseName:'Site store',isSiteWarehouse:true}});
 const documentType=await db.documentType.create({data:{companyId:company.id,documentTypeCode:'DELIVERY',documentTypeName:'Delivery evidence'}});
 for(const [code,prefix] of [['PURCHASE_REQUEST','PR'],['RFQ','RFQ'],['PURCHASE_ORDER','PO'],['GOODS_RECEIPT','GRN']])await db.numberSequence.create({data:{companyId:company.id,entityType:code!,sequenceCode:code!,formatTemplate:prefix+'YYMM-###',resetRule:'MONTHLY'}});
 const workflow=async(entityType:string,roleId:string)=>db.approvalWorkflow.create({data:{companyId:company.id,workflowCode:'RC-'+entityType,workflowName:'Synthetic '+entityType,entityType,steps:{create:[{stepNo:1,stepName:'Independent approval',requiredApprovals:1,stepRoles:{create:[{roleId}]}}]}}});
 const prWorkflow=await workflow('PURCHASE_REQUEST',buyerChecker.role.id),poWorkflow=await workflow('PURCHASE_ORDER',buyerChecker.role.id),receiptWorkflow=await workflow('GOODS_RECEIPT',pm.role.id);
 const access=new ProjectAccessService(db,new ProjectScopeService(new AuthorizationService())),audit=new AuditService(db),approvals=new ApprovalService(db),numbers=new NumberSequenceService(db);
 const procurement=new ProcurementService(db,access,audit,approvals,numbers),sourcing=new SourcingService(db,access,audit,numbers),orders=new PurchaseOrderService(db,access,audit,approvals,numbers);
 const today=new Date(new Date().toISOString().slice(0,10)+'T00:00:00.000Z'),later=new Date(today.getTime()+14*86400000);
 const pr=await procurement.createRequest({auth:buyer.auth},project.id,'Synthetic receiving source');
 const prLine=await procurement.createLine({auth:buyer.auth},pr.id,{lineType:'MATERIAL',materialId:material.id,quantity:new Prisma.Decimal(10),uomId:uom.id,wbsId:wbs.id,costCodeId:costCode.id,requiredOnSite:later});
 const extraPrLine=secondaryMaterial?await procurement.createLine({auth:buyer.auth},pr.id,{lineType:'MATERIAL',materialId:secondaryMaterial.id,quantity:new Prisma.Decimal(10),uomId:uom.id,wbsId:wbs.id,costCodeId:costCode.id,requiredOnSite:later}):null;
 await procurement.submitRequest({auth:buyer.auth},pr.id,prWorkflow.workflowCode);await procurement.approveRequest({auth:buyerChecker.auth},pr.id,'Synthetic demand checked');
 const rfq=await sourcing.createRfq({auth:buyer.auth},project.id,{closingDate:later,lines:[{purchaseRequestLineId:prLine.id,quantity:new Prisma.Decimal(10)},...(extraPrLine?[{purchaseRequestLineId:extraPrLine.id,quantity:new Prisma.Decimal(10)}]:[])]});
 await sourcing.inviteSupplier({auth:buyer.auth},rfq.id,supplier.id);
 const quote=await sourcing.createQuotation({auth:buyer.auth},rfq.id,supplier.id,{quotationDate:today,supplierReference:'RC-Q'});
 const awards:string[]=[];
 for(const rfqLine of (await sourcing.getRfq(buyer.auth,rfq.id)).lines){
  const quoted=await sourcing.upsertQuotationLine({auth:buyer.auth},quote.id,rfqLine.id,{quantity:new Prisma.Decimal(10),unitPrice:new Prisma.Decimal(12)});
  const award=await sourcing.selectAward({auth:buyer.auth},rfqLine.id,quoted.id,'Synthetic source selection');awards.push(award.id);
 }
 const po=await orders.createOrder({auth:buyer.auth},project.id,awards,'Synthetic receiving PO');
 await orders.submit({auth:buyer.auth},po.id,poWorkflow.workflowCode);await orders.approve({auth:buyerChecker.auth},po.id,'Synthetic PO checked');
 const input=(extra={})=>({requestKey:randomUUID(),projectId:project.id,warehouseId:warehouse.id,supplierId:supplier.id,receivedAt:new Date(Date.now()-60000).toISOString(),receiverName:'Store receiver',reason:'Actual physical delivery captured',qualityRequired:false,lines:[{materialId:material.id,uomId:uom.id,observedQuantity:'4.0000',goodQuantity:'3.0000',condition:'DAMAGED',note:'One damaged item remains held'}],...extra});
 return {secondaryMaterial,company,project,unassigned,store,jai,pm,config,outsider,viewer,buyer,buyerChecker,uom,material,supplier,warehouse,documentType,receiptWorkflow,po,sessions,input,access,audit,orders};
}
