import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {AuditService} from '../audit/audit.service';
import {DocumentsService} from '../documents/documents.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {receivingActor,ReceivingDb} from './receiving-actor';
import {RECEIVING,receivingAction,receivingCapture,receivingCheck,receivingDeadline,receivingDue,receivingEnable,receivingEvidence,receivingLink,receivingRevise} from './receiving-contract';

type Context={auth:AuthenticatedUserContext;correlationId?:string};
type Tx=Prisma.TransactionClient;
const include={lines:{orderBy:{lineNo:'asc' as const},include:{material:{select:{materialCode:true,materialName:true}},uom:{select:{uomCode:true}}}},
 evidence:{orderBy:{recordedAt:'asc' as const},include:{replacement:{select:{id:true}},document:{select:{id:true,fileName:true,isActive:true,checksum:true}}}},
 goodsReceipt:{select:{id:true,receiptNumber:true,postedAt:true,reversedAt:true,submittedAt:true,approvalInstance:{select:{approvalState:true}}}},
 events:{orderBy:{version:'asc' as const},select:{id:true,version:true,action:true,note:true,recordedAt:true,actor:{select:{id:true,displayName:true}}}},
} satisfies Prisma.ReceivingDeliveryInclude;
type Delivery=Prisma.ReceivingDeliveryGetPayload<{include:typeof include}>;
type ReceiptInput={projectId:string;purchaseOrderId:string;warehouseId:string;remarks?:string|null;lines:Array<{purchaseOrderLineId:string;quantity:Prisma.Decimal}>;deliveryId?:string|null;requestKey?:string;expectedDeliveryVersion?:number};
type ReceiptPin={deliveryId:string;projectId:string;requestKey:string;digest:string;replayId?:string};
function conflict(code:string):never{throw new ConflictException({code});}
function invalid(code:string):never{throw new UnprocessableEntityException({code});}
function denied():never{throw new ForbiddenException({code:'RECEIVING_ACTOR_DENIED'});}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const dbCodes=['RECEIVING_DIMENSION_INVALID','RECEIVING_HISTORY_IMMUTABLE','RECEIVING_VERSION_EVENT_REQUIRED','RECEIVING_SOURCE_FROZEN','RECEIVING_EVIDENCE_INVALID','RECEIVING_CHECK_REQUIRED','RECEIVING_PO_INVALID','RECEIVING_GR_SOURCE_INVALID','RECEIVING_CUSTODY_REQUIRED','RECEIVING_DEADLINE_IMMUTABLE','RECEIVING_REPLACEMENT_INVALID'];
@Injectable()
export class ReceivingService{
 constructor(private readonly prisma:PrismaService,private readonly access:ProjectAccessService,private readonly audit:AuditService,private readonly documents:DocumentsService){}
 async receiptTransaction<T>(work:(tx:Tx)=>Promise<T>):Promise<T>{return this.retry(work);}
 private async retry<T>(work:(tx:Tx)=>Promise<T>):Promise<T>{
  for(let attempt=0;attempt<3;attempt++)try{return await this.prisma.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}
  catch(e){
   if(e instanceof Prisma.PrismaClientKnownRequestError){
    if(['P2034','P2002'].includes(e.code)||e.code==='P2010'&&['40001','40P01'].includes(String(e.meta?.code))){if(attempt<2)continue;conflict('RECEIVING_RETRY_REQUIRED');}
    const code=dbCodes.find(c=>String(e.meta?.message??e.message).includes(c));if(code)conflict(code);
   }throw e;
  }return conflict('RECEIVING_RETRY_REQUIRED');
 }
 private async project(auth:AuthenticatedUserContext,id:string,db:ReceivingDb){
  await this.access.assertAccess(auth,id,db);
  if(!await db.project.findFirst({where:{id,companyId:auth.companyId,isActive:true},select:{id:true}}))throw new NotFoundException({code:'RECEIVING_PROJECT_NOT_FOUND'});
 }
 private async find(auth:AuthenticatedUserContext,id:string,db:ReceivingDb=this.prisma){
  const row=await db.receivingDelivery.findFirst({where:{id,companyId:auth.companyId},include});
  if(!row)throw new NotFoundException({code:'RECEIVING_DELIVERY_NOT_FOUND'});
  await this.project(auth,row.projectId,db);return row;
 }
 private present(auth:AuthenticatedUserContext,row:Delivery){
  const documentVisible=auth.permissions.includes('documents.document.view'),receiptVisible=auth.permissions.includes('inventory.receipt.view');
  return {id:row.id,projectId:row.projectId,warehouseId:row.warehouseId,supplierId:row.supplierId,receivedAt:row.receivedAt,poLinkDueAt:row.poLinkDueAt,
   receiverName:row.receiverName,reason:row.reason,qualityRequired:row.qualityRequired,purchaseOrderId:row.purchaseOrderId,linkedAt:row.linkedAt,
   deadline:receivingDeadline(row.poLinkDueAt,row.linkedAt),status:row.status,version:row.version,createdByUserId:row.createdByUserId,
   checkedByUserId:row.checkedByUserId,checkedAt:row.checkedAt,checkNote:row.checkNote,voidReason:row.voidReason,supersedesId:row.supersedesId,
   goodsReceipt:receiptVisible?row.goodsReceipt:null,usable:Boolean(row.status==='CHECKED'&&row.goodsReceipt?.postedAt&&!row.goodsReceipt.reversedAt),
   lines:row.lines.map(l=>({id:l.id,lineNo:l.lineNo,materialId:l.materialId,uomId:l.uomId,material:l.material,uom:l.uom,
    observedQuantity:l.observedQuantity.toFixed(4),goodQuantity:l.goodQuantity.toFixed(4),condition:l.condition,note:l.note,purchaseOrderLineId:l.purchaseOrderLineId,
    heldQuantity:row.status==='VOID'?'0.0000':l.observedQuantity.minus(row.goodsReceipt?.postedAt&&!row.goodsReceipt.reversedAt?l.goodQuantity:0).toFixed(4)})),
   evidence:row.evidence.map(e=>({id:e.id,purpose:e.purpose,recordedAt:e.recordedAt,supersedesId:e.supersedesId,superseded:Boolean(e.replacement),
    documentId:documentVisible?e.documentId:null,checksum:documentVisible?e.checksum:null,fileName:documentVisible?e.document.fileName:null,active:e.document.isActive})),events:row.events};
 }
 async projects(supplied:AuthenticatedUserContext){const auth=await receivingActor(supplied,this.prisma);return this.prisma.project.findMany({where:{AND:[await this.access.scopeWhere(auth),{isActive:true}]},select:{id:true,projectCode:true,projectName:true},orderBy:{id:'asc'}});}
 async list(supplied:AuthenticatedUserContext,projectId:string,after?:string){
  const auth=await receivingActor(supplied,this.prisma);await this.project(auth,projectId,this.prisma);
  const rows=await this.prisma.receivingDelivery.findMany({where:{companyId:auth.companyId,projectId,...(after?{id:{gt:after}}:{})},orderBy:{id:'asc'},take:51,
   select:{id:true,receivedAt:true,poLinkDueAt:true,linkedAt:true,status:true,version:true,receiverName:true}});
  return {items:rows.slice(0,50).map(r=>({...r,deadline:receivingDeadline(r.poLinkDueAt,r.linkedAt)})),nextCursor:rows.length>50?rows[49]!.id:null};
 }
 async get(supplied:AuthenticatedUserContext,id:string){const auth=await receivingActor(supplied,this.prisma);return this.present(auth,await this.find(auth,id));}
 async policy(supplied:AuthenticatedUserContext,projectId:string){const auth=await receivingActor(supplied,this.prisma);await this.project(auth,projectId,this.prisma);const p=await this.prisma.receivingProjectPolicy.findFirst({where:{projectId,companyId:auth.companyId}});return p?{enabled:true,projectId,createdAt:p.createdAt,reason:p.reason,syntheticOnly:p.syntheticOnly}:{enabled:false,projectId};}
 async choices(supplied:AuthenticatedUserContext,projectId:string,kind:string,after?:string){
  const auth=await receivingActor(supplied,this.prisma);await this.project(auth,projectId,this.prisma);
  const page={orderBy:{id:'asc' as const},take:101},cursor=after?{id:{gt:after}}:{};let rows:Array<{id:string;[key:string]:unknown}>;
  if(kind==='warehouses')rows=await this.prisma.warehouse.findMany({...page,where:{...cursor,companyId:auth.companyId,isActive:true,OR:[{projectId},{projectId:null}]},select:{id:true,warehouseName:true,warehouseCode:true}});
  else if(kind==='suppliers')rows=await this.prisma.supplier.findMany({...page,where:{...cursor,companyId:auth.companyId,isActive:true},select:{id:true,supplierCode:true,supplierName:true}});
  else if(kind==='materials')rows=await this.prisma.material.findMany({...page,where:{...cursor,companyId:auth.companyId,isActive:true,defaultUom:{isActive:true}},select:{id:true,materialCode:true,materialName:true,defaultUomId:true}});
  else if(kind==='uoms')rows=await this.prisma.unitOfMeasure.findMany({...page,where:{...cursor,companyId:auth.companyId,isActive:true},select:{id:true,uomCode:true,uomName:true}});
  else if(kind==='orders'){
   await receivingActor(supplied,this.prisma,['inventory.receipt.view']);
   rows=await this.prisma.purchaseOrder.findMany({...page,where:{...cursor,companyId:auth.companyId,projectId,cancelledAt:null,approvalInstance:{approvalState:'APPROVED'}},select:{id:true,poNumber:true,supplierId:true,lines:{where:{lineType:'MATERIAL'},orderBy:{lineNo:'asc'},select:{id:true,lineNo:true,materialId:true,uomId:true,quantity:true,description:true}}}});
  }else return invalid('RECEIVING_CHOICE_INVALID');
  if(kind==='orders'){const current=[];for(const row of rows.slice(0,100)){const po=await this.prisma.purchaseOrder.findUniqueOrThrow({where:{id:row.id},select:{poNumber:true,revisionNo:true}});if(!await this.prisma.purchaseOrder.count({where:{companyId:auth.companyId,poNumber:po.poNumber,revisionNo:{gt:po.revisionNo},cancelledAt:null,approvalInstance:{approvalState:'APPROVED'}}}))current.push(row);}return {items:current.slice(0,100),nextCursor:rows.length>100?rows[99]!.id:null};}
  return {items:rows.slice(0,100),nextCursor:rows.length>100?rows[99]!.id:null};
 }
 private async key(tx:Tx,auth:AuthenticatedUserContext,key:string){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['receiving-key',auth.companyId,auth.userId,key].join(':')},0))`;}
 private async projectLock(tx:Tx,projectId:string){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'receiving-project:'+projectId},0))`;}
 private async prior(tx:Tx,auth:AuthenticatedUserContext,key:string,action:string,hash:string){const prior=await tx.receivingOperation.findUnique({where:{companyId_actorUserId_requestKey:{companyId:auth.companyId,actorUserId:auth.userId,requestKey:key}}});if(!prior)return null;await this.project(auth,prior.projectId,tx);if(prior.action!==action||prior.bodyDigest!==hash)conflict('RECEIVING_REPLAY_CONFLICT');return prior;}
 private async operation(tx:Tx,context:Context,auth:AuthenticatedUserContext,action:string,key:string,hash:string,projectId:string,deliveryId:string|null,outcome:Prisma.InputJsonValue){
  await tx.receivingOperation.create({data:{companyId:auth.companyId,projectId,actorUserId:auth.userId,requestKey:key,action,bodyDigest:hash,deliveryId,outcome}});
  await this.audit.record({...context,auth,entityType:'RECEIVING_DELIVERY',entityId:deliveryId??projectId,action,newValues:outcome},tx);return outcome;
 }
 private async event(tx:Tx,auth:AuthenticatedUserContext,id:string,action:string,note:string){
  const row=await tx.receivingDelivery.findUniqueOrThrow({where:{id},select:{version:true}});
  const [proof]=await tx.$queryRaw<Array<{facts:Prisma.InputJsonValue}>>`SELECT erp_receiving_snapshot(${id}::uuid) AS facts`;
  await tx.receivingDeliveryEvent.create({data:{companyId:auth.companyId,deliveryId:id,actorUserId:auth.userId,version:row.version,action,note,facts:proof!.facts}});
  return {id,version:row.version};
 }
 private async lock(tx:Tx,id:string){await tx.$queryRaw`SELECT id FROM receiving_deliveries WHERE id=${id}::uuid FOR UPDATE`;}
 private editable(auth:AuthenticatedUserContext,row:Delivery){if(row.createdByUserId!==auth.userId)denied();if(row.status==='VOID'||row.goodsReceipt)conflict('RECEIVING_SOURCE_FROZEN');}
 private async bump(tx:Tx,row:Delivery,data:Prisma.ReceivingDeliveryUncheckedUpdateInput={}){return tx.receivingDelivery.update({where:{id:row.id,version:row.version},data:{...data,version:{increment:1}}});}
 async enable(context:Context,projectId:string,value:unknown){
  const input=receivingEnable(value);if(process.env.NODE_ENV==='production')throw new ForbiddenException({code:'RECEIVING_SYNTHETIC_ENABLEMENT_ONLY'});
  return this.retry(async tx=>{const auth=await receivingActor(context.auth,tx,[RECEIVING+'configure']);await this.project(auth,projectId,tx);await this.key(tx,auth,input.requestKey);
   const hash=digest(['ENABLE',projectId,input]),prior=await this.prior(tx,auth,input.requestKey,'ENABLE',hash);if(prior)return prior.outcome;
   await this.projectLock(tx,projectId);
   if(await tx.receivingProjectPolicy.findUnique({where:{projectId}}))conflict('RECEIVING_POLICY_ALREADY_ENABLED');
   if(await tx.goodsReceipt.count({where:{companyId:auth.companyId,projectId,postedAt:null,reversedAt:null}}))conflict('RECEIVING_LEGACY_DRAFT_DISPOSITION_REQUIRED');
   const row=await tx.receivingProjectPolicy.create({data:{companyId:auth.companyId,projectId,enabledByUserId:auth.userId,reason:input.reason,syntheticOnly:true}});
   return this.operation(tx,context,auth,'ENABLE',input.requestKey,hash,projectId,null,{projectId,enabled:true,createdAt:row.createdAt.toISOString()});});
 }
 async capture(context:Context,value:unknown){
  const input=receivingCapture(value),hash=digest(['CAPTURE',input]);
  return this.retry(async tx=>{const auth=await receivingActor(context.auth,tx,[RECEIVING+'capture']);await this.project(auth,input.projectId,tx);await this.key(tx,auth,input.requestKey);
   const prior=await this.prior(tx,auth,input.requestKey,'CAPTURE',hash);if(prior)return prior.outcome;await this.projectLock(tx,input.projectId);
   if(!await tx.receivingProjectPolicy.findFirst({where:{projectId:input.projectId,companyId:auth.companyId}}))conflict('RECEIVING_POLICY_REQUIRED');
   if(new Date(input.receivedAt)>new Date())invalid('RECEIVING_FUTURE_RECEIPT');
   if(!await tx.warehouse.findFirst({where:{id:input.warehouseId,companyId:auth.companyId,isActive:true,OR:[{projectId:input.projectId},{projectId:null}]}})||!await tx.supplier.findFirst({where:{id:input.supplierId,companyId:auth.companyId,isActive:true}}))invalid('RECEIVING_DIMENSION_INVALID');
   if(input.supersedesId){await this.lock(tx,input.supersedesId);const old=await this.find(auth,input.supersedesId,tx);
    if(old.status!=='VOID'||old.createdByUserId!==auth.userId||old.projectId!==input.projectId||old.warehouseId!==input.warehouseId||old.supplierId!==input.supplierId||old.receivedAt.toISOString()!==input.receivedAt||await tx.receivingDelivery.count({where:{supersedesId:old.id}}))invalid('RECEIVING_REPLACEMENT_INVALID');}
   for(const l of input.lines)if(!await tx.material.findFirst({where:{id:l.materialId,companyId:auth.companyId,isActive:true}})||!await tx.unitOfMeasure.findFirst({where:{id:l.uomId,companyId:auth.companyId,isActive:true}}))invalid('RECEIVING_DIMENSION_INVALID');
   const row=await tx.receivingDelivery.create({data:{companyId:auth.companyId,projectId:input.projectId,warehouseId:input.warehouseId,supplierId:input.supplierId,createdByUserId:auth.userId,receivedAt:new Date(input.receivedAt),poLinkDueAt:receivingDue(new Date(input.receivedAt)),receiverName:input.receiverName,reason:input.reason,qualityRequired:input.qualityRequired,supersedesId:input.supersedesId,
    lines:{create:input.lines.map((l,i)=>({...l,lineNo:i+1}))}}});
   const result=await this.event(tx,auth,row.id,'CAPTURE',input.reason);return this.operation(tx,context,auth,'CAPTURE',input.requestKey,hash,input.projectId,row.id,result);});
 }
 private async command(context:Context,id:string,action:string,input:{requestKey:string;expectedVersion:number;reason:string},work:(tx:Tx,auth:AuthenticatedUserContext,row:Delivery)=>Promise<void>){
  const capability={REVISE:'edit',LINK_PO:'link_po',ATTACH:'edit',CHECK:'check',RETURN:'check',VOID:'edit'}[action];if(!capability)throw Error('Unknown receiving action');
  const extra=[RECEIVING+capability,...(['LINK_PO','CHECK','RETURN'].includes(action)?['inventory.receipt.view']:[]),...(['ATTACH','CHECK','RETURN'].includes(action)?['documents.document.view']:[])];
  const hash=digest([action,id,input]);return this.retry(async tx=>{const auth=await receivingActor(context.auth,tx,extra);await this.find(auth,id,tx);await this.key(tx,auth,input.requestKey);
   const prior=await this.prior(tx,auth,input.requestKey,action,hash);if(prior)return prior.outcome;await this.lock(tx,id);const row=await this.find(auth,id,tx);
   if(row.version!==input.expectedVersion)conflict('RECEIVING_VERSION_CONFLICT');if(row.status==='VOID')conflict('RECEIVING_SOURCE_FROZEN');await work(tx,auth,row);
   const result=await this.event(tx,auth,id,action,input.reason);return this.operation(tx,context,auth,action,input.requestKey,hash,row.projectId,id,result);});
 }
 async revise(context:Context,id:string,value:unknown){const input=receivingRevise(value);return this.command(context,id,'REVISE',input,async(tx,auth,row)=>{
  this.editable(auth,row);if(input.lines.length!==row.lines.length||input.lines.some(l=>!row.lines.some(old=>old.id===l.id)))invalid('RECEIVING_COMPLETE_LINES_REQUIRED');
  await this.bump(tx,row,{receiverName:input.receiverName,reason:input.reason,qualityRequired:input.qualityRequired,status:'HELD',checkedAt:null,checkedByUserId:null,checkNote:null});
  for(const l of input.lines)await tx.receivingDeliveryLine.update({where:{id:l.id},data:{observedQuantity:l.observedQuantity,goodQuantity:l.goodQuantity,condition:l.condition,note:l.note}});
 });}
 private async approvedOrder(tx:Tx,auth:AuthenticatedUserContext,row:{projectId:string;supplierId:string},id:string){
  const order=await tx.purchaseOrder.findFirst({where:{id,companyId:auth.companyId,projectId:row.projectId,supplierId:row.supplierId,cancelledAt:null,approvalInstance:{approvalState:'APPROVED'}},include:{lines:true}});
  if(!order||await tx.purchaseOrder.count({where:{companyId:auth.companyId,poNumber:order.poNumber,revisionNo:{gt:order.revisionNo},cancelledAt:null,approvalInstance:{approvalState:'APPROVED'}}}))invalid('RECEIVING_PO_INVALID');return order;
 }
 async link(context:Context,id:string,value:unknown){const input=receivingLink(value);return this.command(context,id,'LINK_PO',input,async(tx,auth,row)=>{
  if(row.goodsReceipt)conflict('RECEIVING_SOURCE_FROZEN');
  const order=await this.approvedOrder(tx,auth,row,input.purchaseOrderId);
  if(input.lines.length!==row.lines.length||input.lines.some(l=>!row.lines.some(old=>old.id===l.id)))invalid('RECEIVING_COMPLETE_LINES_REQUIRED');
  for(const l of row.lines){const pin=input.lines.find(p=>p.id===l.id)!;const source=order.lines.find(s=>s.id===pin.purchaseOrderLineId);
   if(l.goodQuantity.gt(0)&&!source||source&&(source.lineType!=='MATERIAL'||source.materialId!==l.materialId||source.uomId!==l.uomId||l.goodQuantity.gt(source.quantity)))invalid('RECEIVING_PO_LINE_INVALID');
   await tx.receivingDeliveryLine.update({where:{id:l.id},data:{purchaseOrderLineId:pin.purchaseOrderLineId}});}
  await this.bump(tx,row,{purchaseOrderId:order.id,linkedAt:row.linkedAt??new Date(),status:'HELD',checkedAt:null,checkedByUserId:null,checkNote:null});
 });}
 private async document(tx:Tx,auth:AuthenticatedUserContext,row:Delivery,id:string,expected?:string){
  await tx.$queryRaw`SELECT id FROM documents WHERE id=${id}::uuid FOR SHARE`;
  const d=await tx.document.findFirst({where:{id,companyId:auth.companyId,isActive:true,mimeType:{in:['application/pdf','image/png','image/jpeg']},AND:[{links:{some:{entityType:'RECEIVING_DELIVERY',entityId:row.id}}},{links:{some:{entityType:'PROJECT',entityId:row.projectId}}}]},include:{links:{select:{entityType:true,entityId:true}}}});
  if(!d?.checksum||expected&&d.checksum!==expected||!(await this.documents.filterSourceDocuments(auth,row.projectId,[d],tx)).length)invalid('RECEIVING_EVIDENCE_INVALID');
  await this.documents.downloadProjectDocument(auth,row.projectId,id,tx);return d;
 }
 async attach(context:Context,id:string,value:unknown){const input=receivingEvidence(value);return this.command(context,id,'ATTACH',input,async(tx,auth,row)=>{
  this.editable(auth,row);const d=await this.document(tx,auth,row,input.documentId);
  if(row.evidence.some(e=>e.documentId===d.id&&e.purpose===input.purpose))conflict('RECEIVING_EVIDENCE_ALREADY_LINKED');
  if(input.supersedesId&&!row.evidence.some(e=>e.id===input.supersedesId&&e.purpose===input.purpose&&!e.replacement))invalid('RECEIVING_EVIDENCE_REPLACEMENT_INVALID');
  await this.bump(tx,row,{status:'HELD',checkedAt:null,checkedByUserId:null,checkNote:null});
  await tx.receivingDeliveryEvidence.create({data:{companyId:auth.companyId,deliveryId:id,documentId:d.id,purpose:input.purpose,checksum:d.checksum!,signatureConfirmed:input.signedEvidenceConfirmed,recordedByUserId:auth.userId,supersedesId:input.supersedesId}});
 });}
 private async evidence(tx:Tx,auth:AuthenticatedUserContext,row:Delivery){
  const active=row.evidence.filter(e=>!e.replacement),required=['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO',...(row.qualityRequired?['QUALITY_RESULT']:[])];
  if(required.some(p=>!active.some(e=>e.purpose===p)))invalid('RECEIVING_EVIDENCE_REQUIRED');
  for(const e of active)await this.document(tx,auth,row,e.documentId,e.checksum);
 }
 async check(context:Context,id:string,value:unknown){const input=receivingCheck(value),action=input.decision==='ACCEPT'?'CHECK':'RETURN';return this.command(context,id,action,input,async(tx,auth,row)=>{
  if(auth.userId===row.createdByUserId)denied();if(row.goodsReceipt?.postedAt||row.goodsReceipt?.reversedAt)conflict('RECEIVING_SOURCE_FROZEN');
  if(action==='CHECK'){
   if(!row.purchaseOrderId)conflict('RECEIVING_APPROVED_PO_REQUIRED');await this.approvedOrder(tx,auth,row,row.purchaseOrderId);await this.evidence(tx,auth,row);
   await tx.$executeRaw`SELECT erp_receiving_assert_lines(${row.id}::uuid)`;
  }
  await this.bump(tx,row,{status:action==='CHECK'?'CHECKED':'HELD',checkedByUserId:action==='CHECK'?auth.userId:null,checkedAt:action==='CHECK'?new Date():null,checkNote:action==='CHECK'?input.reason:null});
 });}
 async void(context:Context,id:string,value:unknown){const input=receivingAction(value);return this.command(context,id,'VOID',input,async(tx,auth,row)=>{
  if(row.createdByUserId!==auth.userId)denied();const gr=row.goodsReceipt;
  if(gr&&(gr.postedAt||gr.reversedAt||gr.submittedAt&&gr.approvalInstance?.approvalState!=='REJECTED'))conflict('RECEIVING_SOURCE_FROZEN');
  await this.bump(tx,row,{status:'VOID',voidReason:input.reason,checkedAt:null,checkedByUserId:null,checkNote:null});
 });}
 async beforeReceiptCreate(context:Context,input:ReceiptInput,tx:Tx):Promise<ReceiptPin|null>{
  if(input.deliveryId){
   if(!input.requestKey||!Number.isSafeInteger(input.expectedDeliveryVersion)||input.expectedDeliveryVersion!<1)invalid('RECEIVING_GR_OPERATION_REQUIRED');
   const auth=await receivingActor(context.auth,tx,['inventory.receipt.create']);await this.project(auth,input.projectId,tx);await this.key(tx,auth,input.requestKey);
   const hash=digest(['CREATE_GR',{...input,lines:input.lines.map(l=>({...l,quantity:l.quantity.toFixed(4)}))}]);
   const prior=await this.prior(tx,auth,input.requestKey,'CREATE_GR',hash);
   if(prior){const id=(prior.outcome as {id?:unknown}).id;if(typeof id!=='string')throw Error('Invalid receiving GR receipt');return {deliveryId:input.deliveryId,projectId:input.projectId,requestKey:input.requestKey,digest:hash,replayId:id};}
   await this.projectLock(tx,input.projectId);await this.lock(tx,input.deliveryId);const row=await this.find(auth,input.deliveryId,tx);
   if(row.version!==input.expectedDeliveryVersion)conflict('RECEIVING_VERSION_CONFLICT');
   if(row.goodsReceipt)conflict('RECEIVING_GR_ALREADY_LINKED');
   if(row.status!=='CHECKED'||row.projectId!==input.projectId||row.purchaseOrderId!==input.purchaseOrderId||row.warehouseId!==input.warehouseId)conflict('RECEIVING_CHECK_REQUIRED');
   const good=row.lines.filter(l=>l.goodQuantity.gt(0));
   if(!good.length||good.length!==input.lines.length||good.some(l=>!input.lines.some(p=>p.purchaseOrderLineId===l.purchaseOrderLineId&&p.quantity.equals(l.goodQuantity))))invalid('RECEIVING_GR_SOURCE_INVALID');
   await this.assertReceiptReady(tx,auth,row);return {deliveryId:row.id,projectId:row.projectId,requestKey:input.requestKey,digest:hash};
  }
  await this.projectLock(tx,input.projectId);
  if(await tx.receivingProjectPolicy.findFirst({where:{projectId:input.projectId,companyId:context.auth.companyId}}))conflict('RECEIVING_CUSTODY_REQUIRED');return null;
 }
 async receiptCreated(context:Context,pin:ReceiptPin,id:string,tx:Tx){const auth=await receivingActor(context.auth,tx,['inventory.receipt.create']);return this.operation(tx,context,auth,'CREATE_GR',pin.requestKey,pin.digest,pin.projectId,pin.deliveryId,{id});}
 private async assertReceiptReady(tx:Tx,auth:AuthenticatedUserContext,row:Delivery){
  if(row.status!=='CHECKED')conflict('RECEIVING_CHECK_REQUIRED');
  try{await tx.$executeRaw`SELECT erp_receiving_assert_ready(${row.id}::uuid)`;}catch(e){
   if(e instanceof Prisma.PrismaClientKnownRequestError){const code=dbCodes.find(c=>String(e.meta?.message??e.message).includes(c));if(code)conflict(code);}
   throw e;
  }
  // Canonical GR submit/approve actors also need scoped evidence entitlement.
  await receivingActor(auth,tx,['documents.document.view']);await this.evidence(tx,auth,row);
 }
 async receiptReady(auth:AuthenticatedUserContext,receipt:{deliveryId:string|null},tx:Tx){if(!receipt.deliveryId)return;await this.lock(tx,receipt.deliveryId);const fresh=await receivingActor(auth,tx,['documents.document.view']);await this.assertReceiptReady(tx,fresh,await this.find(fresh,receipt.deliveryId,tx));}
}
