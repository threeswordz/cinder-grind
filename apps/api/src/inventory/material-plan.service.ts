import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {AuditService} from '../audit/audit.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {materialPlanIntegrityException} from './material-plan-errors';
import {MP_VIEW,MPContent,mpId,mpCreate,mpRevise,mpAction,mpInvalid} from './material-plan-contract';
type Db=Prisma.TransactionClient|PrismaService;
type Context={auth:AuthenticatedUserContext;correlationId?:string};
const lineSelect={id:true,budgetRevisionLineId:true,materialId:true,uomId:true,quantity:true,
 material:{select:{materialCode:true,materialName:true}},uom:{select:{uomCode:true}}} satisfies Prisma.MaterialUsagePlanLineSelect;
const revisionSelect={id:true,revisionNo:true,validFrom:true,validTo:true,reason:true,status:true,createdByUserId:true,createdAt:true,
 submittedByUserId:true,submittedAt:true,decidedByUserId:true,decidedAt:true,decisionComment:true,
 lines:{orderBy:{budgetRevisionLineId:'asc' as const},select:lineSelect}} satisfies Prisma.MaterialUsagePlanRevisionSelect;
const headerSelect={id:true,companyId:true,projectId:true,warehouseId:true,budgetRevisionId:true,workPackageCode:true,version:true,createdByUserId:true,createdAt:true} satisfies Prisma.MaterialUsagePlanSelect;
type Header=Prisma.MaterialUsagePlanGetPayload<{select:typeof headerSelect}>;
const conflict=(code='MATERIAL_PLAN_VERSION_CONFLICT'):never=>{throw new ConflictException({code});};
const invalid=(code:string):never=>{throw new UnprocessableEntityException({code});};
@Injectable()
export class MaterialPlanService{
 constructor(private readonly prisma:PrismaService,private readonly access:ProjectAccessService,private readonly audit:AuditService){}
 private async authorize(auth:AuthenticatedUserContext,extra:string[]=[],db:Db=this.prisma){
  const session=await db.userSession.findFirst({where:{id:auth.sessionId,userId:auth.userId,revokedAt:null,expiresAt:{gt:new Date()},user:{companyId:auth.companyId,isActive:true,company:{isActive:true}}},
   select:{user:{select:{userRoles:{select:{role:{select:{companyId:true,isActive:true,rolePermissions:{select:{permission:{select:{permissionCode:true}}}}}}}}}}}});
  const permissions=[...new Set(session?.user.userRoles.filter(x=>x.role.isActive&&x.role.companyId===auth.companyId).flatMap(x=>x.role.rolePermissions.map(p=>p.permission.permissionCode))??[])];
  if(!session||![MP_VIEW,...extra].every(p=>auth.permissions.includes(p)&&permissions.includes(p)))throw new ForbiddenException({code:'MATERIAL_PLAN_PERMISSION_DENIED'});
  return {...auth,permissions};
 }
 private sourceRight(auth:AuthenticatedUserContext){if(!['budget.quantity.view','budget.revision.view'].some(p=>auth.permissions.includes(p)))throw new ForbiddenException({code:'MATERIAL_PLAN_SOURCE_PERMISSION_DENIED'});}
 private async header(auth:AuthenticatedUserContext,id:string,db:Db){
  const p=await db.materialUsagePlan.findFirst({where:{id,companyId:auth.companyId},select:headerSelect});if(!p)throw new NotFoundException({code:'MATERIAL_PLAN_NOT_FOUND'});
  await this.access.assertAccess(auth,p.projectId,db);return p;
 }
 private presentRevision(r:Prisma.MaterialUsagePlanRevisionGetPayload<{select:typeof revisionSelect}>|null){return r?{...r,validFrom:r.validFrom.toISOString().slice(0,10),validTo:r.validTo.toISOString().slice(0,10),lines:r.lines.map(l=>({...l,quantity:l.quantity.toFixed(4)}))}:null;}
 private async detail(auth:AuthenticatedUserContext,id:string,db:Db){
  const p=await this.header(auth,id,db);
  const [latest,approved]=await Promise.all([db.materialUsagePlanRevision.findFirst({where:{planId:id},orderBy:{revisionNo:'desc'},select:revisionSelect}),db.materialUsagePlanRevision.findFirst({where:{planId:id,status:'APPROVED'},orderBy:{revisionNo:'desc'},select:revisionSelect})]);
  return {...p,latestRevision:this.presentRevision(latest),approvedRevision:this.presentRevision(approved),issueEnforcement:'NOT_ENABLED_BY_FOUNDATION'};
 }
 async projects(supplied:AuthenticatedUserContext){const auth=await this.authorize(supplied);return this.prisma.project.findMany({where:{AND:[await this.access.scopeWhere(auth),{isActive:true}]},select:{id:true,projectCode:true,projectName:true},orderBy:{id:'asc'},take:100});}
 async choices(supplied:AuthenticatedUserContext,projectId:string,kind:string,budgetRevisionId?:string,after?:string){
  projectId=mpId(projectId,'projectId');if(after)after=mpId(after,'after');const auth=await this.authorize(supplied);await this.access.assertAccess(auth,projectId);this.sourceRight(auth);
  const page={take:101,orderBy:{id:'asc' as const}},cursor=after?{id:{gt:after}}:{};let rows:unknown[];
  if(kind==='warehouses')rows=await this.prisma.warehouse.findMany({...page,where:{...cursor,companyId:auth.companyId,projectId,isActive:true},select:{id:true,warehouseCode:true,warehouseName:true}});
  else if(kind==='materials')rows=await this.prisma.material.findMany({...page,where:{...cursor,companyId:auth.companyId,isActive:true},select:{id:true,materialCode:true,materialName:true,defaultUomId:true}});
  else if(kind==='revisions')rows=await this.prisma.budgetRevision.findMany({...page,where:{...cursor,companyId:auth.companyId,projectId,approvalInstance:{approvalState:'APPROVED'}},select:{id:true,revisionNo:true,revisionNumber:true}});
  else if(kind==='source-lines'){
   const basis=mpId(budgetRevisionId,'budgetRevisionId');await this.basis(auth,projectId,basis,this.prisma);
   const source=await this.prisma.budgetRevisionLine.findMany({...page,where:{...cursor,budgetRevisionId:basis,quantity:{gt:0}},select:{id:true,itemCode:true,description:true,quantity:true,uomId:true,uomCode:true}});rows=source.map(l=>({...l,quantity:l.quantity.toFixed(4)}));
  }else return mpInvalid('kind');
  return {items:rows.slice(0,100),nextCursor:rows.length>100?(rows[99] as {id:string}).id:null};
 }
 async list(supplied:AuthenticatedUserContext,projectId:string,after?:string){
  projectId=mpId(projectId,'projectId');if(after)after=mpId(after,'after');const auth=await this.authorize(supplied);await this.access.assertAccess(auth,projectId);
  const rows=await this.prisma.materialUsagePlan.findMany({where:{companyId:auth.companyId,projectId,...(after?{id:{gt:after}}:{})},select:headerSelect,orderBy:{id:'asc'},take:101});return {items:rows.slice(0,100),nextCursor:rows.length>100?rows[99]!.id:null};
 }
 async get(supplied:AuthenticatedUserContext,id:string){return this.detail(await this.authorize(supplied),mpId(id),this.prisma);}
 async history(supplied:AuthenticatedUserContext,id:string,after?:string){
  id=mpId(id);if(after)after=mpId(after,'after');const auth=await this.authorize(supplied);await this.header(auth,id,this.prisma);
  const cursor=after?await this.prisma.materialUsagePlanRevision.findFirst({where:{id:after,planId:id},select:{revisionNo:true}}):null;if(after&&!cursor)invalid('MATERIAL_PLAN_HISTORY_CURSOR_INVALID');
  const rows=await this.prisma.materialUsagePlanRevision.findMany({where:{planId:id,...(cursor?{revisionNo:{lt:cursor.revisionNo}}:{})},orderBy:{revisionNo:'desc'},take:26,select:{id:true,revisionNo:true,status:true,reason:true,createdByUserId:true,createdAt:true,submittedAt:true,decidedAt:true,decidedByUserId:true,decisionComment:true}});
  return {items:rows.slice(0,25),nextCursor:rows.length>25?rows[24]!.id:null};
 }
 async revision(supplied:AuthenticatedUserContext,id:string,revisionId:string){
  id=mpId(id);revisionId=mpId(revisionId);const auth=await this.authorize(supplied);await this.header(auth,id,this.prisma);const r=await this.prisma.materialUsagePlanRevision.findFirst({where:{id:revisionId,planId:id},select:revisionSelect});if(!r)throw new NotFoundException({code:'MATERIAL_PLAN_REVISION_NOT_FOUND'});return this.presentRevision(r);
 }
 private async basis(auth:AuthenticatedUserContext,projectId:string,budgetRevisionId:string,tx:Db){
  const basis=await tx.budgetRevision.findFirst({where:{id:budgetRevisionId,companyId:auth.companyId,projectId,approvalInstance:{approvalState:'APPROVED'}},select:{id:true}});if(!basis)invalid('MATERIAL_PLAN_APPROVED_BASIS_REQUIRED');
 }
 private async dimensions(auth:AuthenticatedUserContext,p:Pick<Header,'projectId'|'warehouseId'|'budgetRevisionId'>,tx:Db){
  await this.access.assertAccess(auth,p.projectId,tx);await this.basis(auth,p.projectId,p.budgetRevisionId,tx);
  if(!await tx.warehouse.findFirst({where:{id:p.warehouseId,companyId:auth.companyId,projectId:p.projectId,isActive:true},select:{id:true}}))invalid('MATERIAL_PLAN_WAREHOUSE_INVALID');
 }
 private async addRevision(auth:AuthenticatedUserContext,p:Header,input:MPContent,tx:Prisma.TransactionClient){
  await this.dimensions(auth,p,tx);
  const latest=await tx.materialUsagePlanRevision.findFirst({where:{planId:p.id},orderBy:{revisionNo:'desc'},select:{revisionNo:true,status:true}});
  if(latest?.status==='SUBMITTED')conflict('MATERIAL_PLAN_PENDING_DECISION');
  const sources=await tx.budgetRevisionLine.findMany({where:{budgetRevisionId:p.budgetRevisionId,id:{in:input.lines.map(l=>l.budgetRevisionLineId)}},select:{id:true,uomId:true,quantity:true}});
  for(const l of input.lines){const source=sources.find(s=>s.id===l.budgetRevisionLineId);if(!source||source.uomId!==l.uomId||source.quantity.lt(l.quantity))invalid('MATERIAL_PLAN_SOURCE_QUANTITY_INVALID');
   if(!await tx.material.findFirst({where:{id:l.materialId,companyId:auth.companyId,isActive:true,defaultUomId:l.uomId},select:{id:true}})||!await tx.unitOfMeasure.findFirst({where:{id:l.uomId,companyId:auth.companyId,isActive:true},select:{id:true}}))invalid('MATERIAL_PLAN_MATERIAL_UOM_INVALID');
   if(await tx.materialUsagePlanLine.findFirst({where:{budgetRevisionLineId:l.budgetRevisionLineId,revision:{planId:p.id,status:'APPROVED'},materialId:{not:l.materialId}},select:{id:true}}))invalid('MATERIAL_PLAN_MAPPING_IMMUTABLE');
  }
  return tx.materialUsagePlanRevision.create({data:{planId:p.id,revisionNo:(latest?.revisionNo??0)+1,validFrom:new Date(input.validFrom),validTo:new Date(input.validTo),reason:input.reason,createdByUserId:auth.userId,lines:{create:input.lines.map(l=>({...l,quantity:new Prisma.Decimal(l.quantity)}))}},select:{id:true}});
 }
 private async operation(context:Context,action:string,key:string,input:unknown,planId:string|undefined,projectId:string|undefined,work:(auth:AuthenticatedUserContext,tx:Prisma.TransactionClient,p?:Header)=>Promise<{id:string;revisionId:string}>){
  const capability={CREATE:'create',REVISE:'revise',SUBMIT:'submit',APPROVE:'approve',REJECT:'approve'}[action];if(!capability)throw Error('Unknown plan operation');
  const digest=createHash('sha256').update(JSON.stringify([planId??null,input])).digest('hex');
  for(let attempt=0;attempt<3;attempt++)try{return await this.prisma.$transaction(async tx=>{
   const auth=await this.authorize(context.auth,['inventory.material_plan.'+capability],tx);this.sourceRight(auth);
   if(projectId)await this.access.assertAccess(auth,projectId,tx);if(planId)await this.header(auth,planId,tx);
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-plan-key',auth.companyId,auth.userId,action,key].join(':')},0))`;
   const prior=await tx.materialUsagePlanOperation.findUnique({where:{companyId_actorUserId_action_requestKey:{companyId:auth.companyId,actorUserId:auth.userId,action,requestKey:key}}});
   if(prior){await this.header(auth,prior.planId,tx);if(prior.bodyDigest!==digest)conflict('MATERIAL_PLAN_REPLAY_CONFLICT');return prior.outcome;}
   let p:Header|undefined;if(planId){await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'material-plan:'+planId},0))`;p=await this.header(auth,planId,tx);}
   const result=await work(auth,tx,p);const current=await this.header(auth,result.id,tx);
   const [snap]=await tx.$queryRaw<Array<{snapshot:Prisma.InputJsonValue}>>`SELECT erp_material_usage_plan_snapshot(${result.id}::uuid) AS snapshot`;
   const revision=await tx.materialUsagePlanRevision.findUniqueOrThrow({where:{id:result.revisionId},select:{revisionNo:true,status:true}});
   const outcome={id:result.id,projectId:current.projectId,version:current.version,revisionId:result.revisionId,revisionNo:revision.revisionNo,status:revision.status} satisfies Prisma.InputJsonValue;
   await tx.materialUsagePlanOperation.create({data:{companyId:auth.companyId,actorUserId:auth.userId,action,requestKey:key,bodyDigest:digest,planId:result.id,revisionId:result.revisionId,planVersion:current.version,snapshot:snap!.snapshot,outcome}});
   await this.audit.record({...context,auth,entityType:'MATERIAL_USAGE_PLAN',entityId:result.id,action,newValues:{version:current.version,revisionId:result.revisionId}},tx);return outcome;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034'&&attempt<2)continue;if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')conflict('MATERIAL_PLAN_DUPLICATE');const integrity=materialPlanIntegrityException(error);if(integrity)throw integrity;throw error;}
  throw new ConflictException({code:'MATERIAL_PLAN_RETRY_REQUIRED'});
 }
 async create(context:Context,value:unknown){const input=mpCreate(value);return this.operation(context,'CREATE',input.requestKey,input,undefined,input.projectId,async(auth,tx)=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-plan-scope',auth.companyId,input.projectId,input.warehouseId,input.workPackageCode].join(':')},0))`;
  await this.dimensions(auth,input,tx);
  const p=await tx.materialUsagePlan.create({data:{companyId:auth.companyId,projectId:input.projectId,warehouseId:input.warehouseId,budgetRevisionId:input.budgetRevisionId,workPackageCode:input.workPackageCode,createdByUserId:auth.userId},select:headerSelect});
  const revision=await this.addRevision(auth,p,input,tx);return {id:p.id,revisionId:revision.id};
 });}
 async revise(context:Context,id:string,value:unknown){id=mpId(id);const input=mpRevise(value);return this.operation(context,'REVISE',input.requestKey,input,id,undefined,async(auth,tx,p)=>{
  if(p!.version!==input.expectedVersion)conflict();const r=await this.addRevision(auth,p!,input,tx);await tx.materialUsagePlan.update({where:{id},data:{version:{increment:1}}});return {id,revisionId:r.id};
 });}
 async submit(context:Context,id:string,value:unknown){id=mpId(id);const input=mpAction(value);return this.transition(context,id,input,'SUBMIT');}
 async decide(context:Context,id:string,value:unknown){id=mpId(id);const input=mpAction(value,true);return this.transition(context,id,input,input.decision!);}
 private transition(context:Context,id:string,input:ReturnType<typeof mpAction>,action:string){return this.operation(context,action,input.requestKey,input,id,undefined,async(auth,tx,p)=>{
  if(p!.version!==input.expectedVersion)conflict();if(action!=='REJECT')await this.dimensions(auth,p!,tx);
  const r=await tx.materialUsagePlanRevision.findFirstOrThrow({where:{planId:id},orderBy:{revisionNo:'desc'}});
  if(r.status!==(action==='SUBMIT'?'DRAFT':'SUBMITTED'))conflict('MATERIAL_PLAN_STATE_CONFLICT');
  if(action!=='SUBMIT'&&[p!.createdByUserId,r.createdByUserId,r.submittedByUserId].includes(auth.userId))throw new ForbiddenException({code:'MATERIAL_PLAN_SELF_APPROVAL_DENIED'});
  await tx.materialUsagePlanRevision.update({where:{id:r.id},data:action==='SUBMIT'?{status:'SUBMITTED',submittedByUserId:auth.userId,submittedAt:new Date()}:{status:action==='APPROVE'?'APPROVED':'REJECTED',decidedByUserId:auth.userId,decidedAt:new Date(),decisionComment:input.comment!}});
  await tx.materialUsagePlan.update({where:{id},data:{version:{increment:1}}});return {id,revisionId:r.id};
 });}
}
