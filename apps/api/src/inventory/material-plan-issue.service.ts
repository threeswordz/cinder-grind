import {ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {AuditService} from '../audit/audit.service';
import {ApprovalService} from '../approval/approval.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {MaterialIssueService} from './material-issue.service';
import {materialPlanActor,materialPlanSourceRight} from './material-plan-actor';
import {materialPlanIntegrityException} from './material-plan-errors';
import {MPI,mpiEnable,mpiPost,mpiDecision,mpiIntegrity} from './material-plan-issue-contract';
import {lockMaterialPlanIds,lockMaterialPlanIssues} from './material-plan-issue-locks';
import {mpId,mpInvalid} from './material-plan-contract';
type Context={auth:AuthenticatedUserContext;correlationId?:string};
type Tx=Prisma.TransactionClient;
type Policy=Prisma.MaterialPlanProjectPolicyGetPayload<{}>;
type Issue=Awaited<ReturnType<MaterialIssueService['get']>>;
type Target={projectId?:string;issueId?:string;authorizationId?:string};
type Result={policyId:string;issueId?:string;authorizationId?:string};
type Pins=ReturnType<typeof mpiPost>['bindings'];
function conflict(code:string):never{throw new ConflictException({code});}
function invalid(code:string):never{throw new UnprocessableEntityException({code});}
const authSelect={id:true,sequence:true,mode:true,bodyDigest:true,createdByUserId:true,createdAt:true,approvalInstanceId:true,
 approval:{select:{approvalState:true,currentStepNo:true,actions:{orderBy:{actionAt:'asc' as const},select:{id:true,approvalStepId:true,action:true,actionByUserId:true,actionAt:true,comment:true}}}},
 lines:{orderBy:{issueItemId:'asc' as const},select:{issueItemId:true,planId:true,planLineId:true,planVersion:true,quantity:true,overageQuantity:true,planLine:{select:{revisionId:true,budgetRevisionLineId:true}}}}} satisfies Prisma.MaterialPlanIssueAuthorizationSelect;
@Injectable()
export class MaterialPlanIssueService{
 constructor(private readonly prisma:PrismaService,private readonly access:ProjectAccessService,private readonly audit:AuditService,private readonly approvals:ApprovalService,private readonly issues:MaterialIssueService){}
 private async authorize(context:AuthenticatedUserContext,tx:Tx|PrismaService,cap?:string){
  const auth=await materialPlanActor(context,tx,[...(cap?[cap]:[]),...(cap===MPI.enable?[]:['inventory.issue.view'])]);materialPlanSourceRight(auth);return auth;
 }
 private async retry<T>(work:(tx:Tx)=>Promise<T>):Promise<T>{
  for(let attempt=0;attempt<3;attempt++)try{return await this.prisma.$transaction(work,{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}
  catch(error){
   if(error instanceof Prisma.PrismaClientKnownRequestError&&(['P2034','P2002'].includes(error.code)||(error.code==='P2010'&&['40001','40P01'].includes(String(error.meta?.code))))){if(attempt<2)continue;conflict('MATERIAL_PLAN_ISSUE_RETRY_REQUIRED');}
   const integrity=mpiIntegrity(error)??materialPlanIntegrityException(error);if(integrity)throw integrity;throw error;
  }
  return conflict('MATERIAL_PLAN_ISSUE_RETRY_REQUIRED');
 }
 private async scopedBinding(auth:AuthenticatedUserContext,issueId:string,tx:Tx|PrismaService){
  const binding=await tx.materialPlanIssueBinding.findFirst({where:{issueId,policy:{companyId:auth.companyId}},include:{policy:true}});
  if(!binding)throw new NotFoundException({code:'MATERIAL_PLAN_ISSUE_BINDING_NOT_FOUND'});await this.access.assertAccess(auth,binding.policy.projectId,tx);return binding;
 }
 private async operation(context:Context,action:'ENABLE'|'DIRECT'|'SUBMIT'|'REVIEW'|'DECIDE',key:string,input:unknown,target:Target,work:(auth:AuthenticatedUserContext,tx:Tx,policy?:Policy,issueId?:string)=>Promise<Result>){
  const cap={ENABLE:MPI.enable,DIRECT:MPI.post,SUBMIT:MPI.post,REVIEW:MPI.review,DECIDE:MPI.approve}[action];
  const digest=createHash('sha256').update(JSON.stringify([target,input])).digest('hex');
  return this.retry(async tx=>{
   const auth=await this.authorize(context.auth,tx,cap);let issueId=target.issueId,policy:Policy|undefined;
   if(target.authorizationId){const a=await tx.materialPlanIssueAuthorization.findFirst({where:{id:target.authorizationId,binding:{policy:{companyId:auth.companyId}}},select:{issueId:true}});if(!a)throw new NotFoundException({code:'MATERIAL_PLAN_AUTHORIZATION_NOT_FOUND'});issueId=a.issueId;}
   if(issueId)policy=(await this.scopedBinding(auth,issueId,tx)).policy;
   if(target.projectId)await this.access.assertAccess(auth,target.projectId,tx);
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${['material-plan-issue-key',auth.companyId,auth.userId,action,key].join(':')},0))`;
   const prior=await tx.materialPlanIssueOperation.findUnique({where:{companyId_actorUserId_action_requestKey:{companyId:auth.companyId,actorUserId:auth.userId,action,requestKey:key}}});
   if(prior){const p=await tx.materialPlanProjectPolicy.findFirstOrThrow({where:{id:prior.policyId,companyId:auth.companyId}});await this.access.assertAccess(auth,p.projectId,tx);if(prior.bodyDigest!==digest)conflict('MATERIAL_PLAN_ISSUE_REPLAY_CONFLICT');return prior.outcome;}
   if(issueId)await lockMaterialPlanIssues(tx,[issueId]);
   if(target.projectId)await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'material-plan-policy:'+target.projectId},0))`;
   const result=await work(auth,tx,policy,issueId);
   const [proof]=await tx.$queryRaw<Array<{snapshot:Prisma.InputJsonValue;outcome:Prisma.InputJsonValue}>>`SELECT erp_mpi_snapshot(${result.policyId}::uuid,${result.issueId??null}::uuid,${result.authorizationId??null}::uuid) AS snapshot,erp_mpi_outcome(${result.policyId}::uuid,${result.issueId??null}::uuid,${result.authorizationId??null}::uuid) AS outcome`;
   if(!proof)throw Error('Missing material plan issue proof');
   await tx.materialPlanIssueOperation.create({data:{companyId:auth.companyId,actorUserId:auth.userId,action,requestKey:key,bodyDigest:digest,policyId:result.policyId,issueId:result.issueId??null,authorizationId:result.authorizationId??null,snapshot:proof.snapshot,outcome:proof.outcome}});
   await this.audit.record({...context,auth,entityType:action==='ENABLE'?'MATERIAL_PLAN_POLICY':'MATERIAL_PLAN_ISSUE',entityId:result.issueId??result.policyId,action,newValues:proof.outcome},tx);
   return proof.outcome;
  });
 }
 async policy(supplied:AuthenticatedUserContext,projectId:string){
  projectId=mpId(projectId);const auth=await this.authorize(supplied,this.prisma);await this.access.assertAccess(auth,projectId);
  const p=await this.prisma.materialPlanProjectPolicy.findFirst({where:{projectId,companyId:auth.companyId},select:{id:true,projectId:true,syntheticOnly:true,reason:true,createdAt:true,workflow:{select:{workflowCode:true}}}});
  return p?{enabled:true,...p}:{enabled:false,projectId};
 }
 async enable(context:Context,projectId:string,value:unknown){
  projectId=mpId(projectId);const input=mpiEnable(value);
  if(process.env.NODE_ENV==='production')throw new ForbiddenException({code:'MATERIAL_PLAN_SYNTHETIC_ENABLEMENT_ONLY'});
  return this.operation(context,'ENABLE',input.requestKey,input,{projectId},async(auth,tx)=>{
   if(await tx.materialPlanProjectPolicy.findUnique({where:{projectId},select:{id:true}}))conflict('MATERIAL_PLAN_POLICY_ALREADY_ENABLED');
   const workflow=await tx.approvalWorkflow.findFirst({where:{companyId:auth.companyId,workflowCode:input.workflowCode,entityType:'MATERIAL_PLAN_OVERAGE',isActive:true}});
   if(!workflow)invalid('MATERIAL_PLAN_OVERAGE_WORKFLOW_REQUIRED');
   const p=await tx.materialPlanProjectPolicy.create({data:{companyId:auth.companyId,projectId,approvalWorkflowId:workflow.id,enabledByUserId:auth.userId,syntheticOnly:true,reason:input.reason}});return {policyId:p.id};
  });
 }
 private async currentIssue(auth:AuthenticatedUserContext,id:string,tx:Tx){
  const issue=await this.issues.get(auth,id,tx);if(issue.postedAt||issue.reversedAt)conflict('MATERIAL_PLAN_ISSUE_ALREADY_POSTED');return issue;
 }
 private async evaluate(auth:AuthenticatedUserContext,issue:Issue,pins:Pins,tx:Tx,locking:boolean){
  if(pins.length!==issue.items.length)invalid('MATERIAL_PLAN_COMPLETE_BINDINGS_REQUIRED');
  let lines=await tx.materialUsagePlanLine.findMany({where:{id:{in:pins.map(p=>p.planLineId)},revision:{plan:{companyId:auth.companyId,projectId:issue.projectId,warehouseId:issue.warehouseId}}},include:{revision:{include:{plan:true}}}});
  if(locking){await lockMaterialPlanIds(tx,lines.map(l=>l.revision.planId));lines=await tx.materialUsagePlanLine.findMany({where:{id:{in:pins.map(p=>p.planLineId)},revision:{plan:{companyId:auth.companyId,projectId:issue.projectId,warehouseId:issue.warehouseId}}},include:{revision:{include:{plan:true}}}});}
  const spent=new Map<string,Prisma.Decimal>(),usage=new Map<string,Prisma.Decimal>(),allocations=[];let overage=new Prisma.Decimal(0);
  for(const item of issue.items){
   const pin=pins.find(p=>p.issueItemId===item.id),line=lines.find(l=>l.id===pin?.planLineId);
   if(!pin||!line||line.materialId!==item.materialId||line.uomId!==item.uomId||line.revision.status!=='APPROVED'||line.revision.plan.version!==pin.expectedPlanVersion||issue.issueDate<line.revision.validFrom||issue.issueDate>line.revision.validTo)invalid('MATERIAL_PLAN_BINDING_OR_VERSION_INVALID');
   const latest=await tx.materialUsagePlanRevision.findFirst({where:{planId:line.revision.planId,status:'APPROVED'},orderBy:{revisionNo:'desc'},select:{id:true}});if(latest?.id!==line.revisionId)conflict('MATERIAL_PLAN_EFFECTIVE_VERSION_CHANGED');
   await tx.$executeRaw`SELECT erp_mp_assert_lines(${line.revisionId}::uuid,false)`;
   const k=[line.revision.planId,line.budgetRevisionLineId,item.materialId,item.uomId].join(':');
   let used=usage.get(k);if(!used){const [r]=await tx.$queryRaw<Array<{quantity:Prisma.Decimal}>>`SELECT erp_mpi_usage(${line.revision.planId}::uuid,${line.budgetRevisionLineId}::uuid,${item.materialId}::uuid,${item.uomId}::uuid,${issue.id}::uuid) AS quantity`;used=new Prisma.Decimal(r!.quantity);usage.set(k,used);}
   const remaining=line.quantity.minus(used).minus(spent.get(k)??0),excess=Prisma.Decimal.max(0,item.quantity.minus(Prisma.Decimal.max(0,remaining)));
   spent.set(k,(spent.get(k)??new Prisma.Decimal(0)).plus(item.quantity));overage=overage.plus(excess);
   allocations.push({issueItemId:item.id,planId:line.revision.planId,planLineId:line.id,planVersion:line.revision.plan.version,quantity:item.quantity,overageQuantity:excess,allowance:line.quantity,used,remaining,revisionId:line.revisionId});
  }
  return {allocations,overage};
 }
 async preview(supplied:AuthenticatedUserContext,id:string,value:unknown){
  id=mpId(id);const input=mpiPost(value);return this.retry(async tx=>{const auth=await this.authorize(supplied,tx);await this.scopedBinding(auth,id,tx);const issue=await this.currentIssue(auth,id,tx);const e=await this.evaluate(auth,issue,input.bindings,tx,false);
   return {issueId:id,result:e.overage.gt(0)?'OVERAGE_REQUIRED':'WITHIN_PLAN',overageQuantity:e.overage.toFixed(4),items:e.allocations.map(l=>({...l,quantity:l.quantity.toFixed(4),overageQuantity:l.overageQuantity.toFixed(4),allowance:l.allowance.toFixed(4),used:l.used.toFixed(4),remaining:l.remaining.toFixed(4)}))};});
 }
 private async authorization(auth:AuthenticatedUserContext,issue:Issue,policy:Policy,input:ReturnType<typeof mpiPost>,mode:'DIRECT'|'OVERAGE',tx:Tx){
  const e=await this.evaluate(auth,issue,input.bindings,tx,true);
  if(mode==='DIRECT'&&e.overage.gt(0))conflict('MATERIAL_PLAN_OVERAGE_REQUIRED');if(mode==='OVERAGE'&&e.overage.isZero())conflict('MATERIAL_PLAN_OVERAGE_NOT_REQUIRED');
  const previous=await tx.materialPlanIssueAuthorization.findFirst({where:{issueId:issue.id},orderBy:{sequence:'desc'},include:{approval:true}});
  if(previous?.approval?.approvalState==='SUBMITTED')await this.approvals.cancel(previous.approval.id,auth,tx);
  const [r]=await tx.$queryRaw<Array<{digest:string;workflow:string}>>`SELECT erp_mpi_issue_digest(${issue.id}::uuid) AS digest,erp_mpi_workflow_digest(${policy.approvalWorkflowId}::uuid) AS workflow`;
  const id=randomUUID();let approvalId:string|null=null;
  if(mode==='OVERAGE'){
   const workflow=await tx.approvalWorkflow.findUniqueOrThrow({where:{id:policy.approvalWorkflowId},select:{workflowCode:true}});
   const a=await this.approvals.start({companyId:auth.companyId,workflowCode:workflow.workflowCode,entityType:'MATERIAL_PLAN_OVERAGE',entityId:id},tx);approvalId=a.id;
  }
  await tx.materialPlanIssueAuthorization.create({data:{id,issueId:issue.id,sequence:(previous?.sequence??0)+1,mode,bodyDigest:r!.digest,approvalInstanceId:approvalId,workflowDigest:mode==='OVERAGE'?r!.workflow:null,createdByUserId:auth.userId,
   lines:{create:e.allocations.map(l=>({issueItemId:l.issueItemId,planId:l.planId,planLineId:l.planLineId,planVersion:l.planVersion,quantity:l.quantity,overageQuantity:l.overageQuantity}))}}});
  if(!issue.submittedAt)await tx.materialIssue.update({where:{id:issue.id},data:{submittedAt:new Date(),submittedByUserId:auth.userId}});
  return id;
 }
 private async post(auth:AuthenticatedUserContext,id:string,authorizationId:string,key:string,tx:Tx){
  const pins=await tx.materialPlanIssueAllocation.findMany({where:{authorizationId},select:{planId:true}});await lockMaterialPlanIds(tx,pins.map(p=>p.planId));
  await tx.$executeRaw`SELECT erp_mpi_validate_auth(${authorizationId}::uuid,true,${auth.userId}::uuid)`;
  const issue=await this.issues.get(auth,id,tx);
  await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))','inventory-warehouse:'+issue.warehouseId);
  await tx.$queryRaw`SELECT id FROM warehouses WHERE id=${issue.warehouseId}::uuid FOR NO KEY UPDATE`;
  await tx.materialPlanIssueBinding.update({where:{issueId:id},data:{authorizationId}});
  await this.issues.postInTransaction({auth},id,key,tx);
 }
 async withinPlan(context:Context,id:string,value:unknown){
  id=mpId(id);const input=mpiPost(value);return this.operation(context,'DIRECT',input.requestKey,input,{issueId:id},async(auth,tx,policy)=>{
   const issue=await this.currentIssue(auth,id,tx),authorizationId=await this.authorization(auth,issue,policy!,input,'DIRECT',tx);await this.post(auth,id,authorizationId,input.requestKey,tx);return {policyId:policy!.id,issueId:id,authorizationId};
  });
 }
 async submitOverage(context:Context,id:string,value:unknown){
  id=mpId(id);const input=mpiPost(value);return this.operation(context,'SUBMIT',input.requestKey,input,{issueId:id},async(auth,tx,policy)=>{const issue=await this.currentIssue(auth,id,tx),authorizationId=await this.authorization(auth,issue,policy!,input,'OVERAGE',tx);return {policyId:policy!.id,issueId:id,authorizationId};});
 }
 async decide(context:Context,id:string,value:unknown,stage:'REVIEW'|'DECIDE'){
  id=mpId(id);const input=mpiDecision(value);return this.operation(context,stage,input.requestKey,input,{authorizationId:id},async(auth,tx,policy,issueId)=>{
   const issue=await this.currentIssue(auth,issueId!,tx);const a=await tx.materialPlanIssueAuthorization.findUniqueOrThrow({where:{id},include:{lines:{select:{planId:true}},approval:{include:{actions:true,workflow:{include:{steps:{orderBy:{stepNo:'asc'}}}}}}}});
   const latest=await tx.materialPlanIssueAuthorization.findFirst({where:{issueId:issueId!},orderBy:{sequence:'desc'},select:{id:true}});
   if(latest?.id!==a.id||a.mode!=='OVERAGE'||!a.approval||a.approval.approvalState!=='SUBMITTED')conflict('MATERIAL_PLAN_AUTHORIZATION_STALE');
   const steps=a.approval.workflow.steps,expected=stage==='REVIEW'?steps[0]:steps[1];if(steps.length!==2||!expected||a.approval.currentStepNo!==expected.stepNo)conflict('MATERIAL_PLAN_OVERAGE_STAGE_INVALID');
   if([issue.createdByUserId,issue.submittedByUserId,a.createdByUserId].includes(auth.userId)||a.approval.actions.some(x=>x.action==='APPROVE'&&x.actionByUserId===auth.userId))throw new ForbiddenException({code:'MATERIAL_PLAN_INDEPENDENCE_REQUIRED'});
   await lockMaterialPlanIds(tx,a.lines.map(l=>l.planId));await tx.$executeRaw`SELECT erp_mpi_validate_auth(${id}::uuid,false)`;
   if(input.decision==='REJECT')await this.approvals.reject(a.approval.id,auth,a.createdByUserId,input.comment,tx);
   else await this.approvals.approve(a.approval.id,auth,a.createdByUserId,input.comment,async inner=>this.post(auth,issueId!,id,input.requestKey,inner),tx);
   return {policyId:policy!.id,issueId:issueId!,authorizationId:id};
  });
 }
 async history(supplied:AuthenticatedUserContext,id:string,after?:string){
  id=mpId(id);if(after)after=mpId(after);const auth=await this.authorize(supplied,this.prisma);await this.issues.get(auth,id);const binding=await this.prisma.materialPlanIssueBinding.findFirst({where:{issueId:id,policy:{companyId:auth.companyId}},select:{issueId:true,policyId:true,authorizationId:true}});
  if(!binding)return {binding:null,items:[],nextCursor:null};await this.scopedBinding(auth,id,this.prisma);
  const cursor=after?await this.prisma.materialPlanIssueAuthorization.findFirst({where:{id:after,issueId:id},select:{sequence:true}}):null;if(after&&!cursor)mpInvalid('after');
  const rows=await this.prisma.materialPlanIssueAuthorization.findMany({where:{issueId:id,...(cursor?{sequence:{lt:cursor.sequence}}:{})},select:authSelect,orderBy:{sequence:'desc'},take:26});
  return {binding,items:rows.slice(0,25).map(a=>({...a,lines:a.lines.map(l=>({...l,quantity:l.quantity.toFixed(4),overageQuantity:l.overageQuantity.toFixed(4)}))})),nextCursor:rows.length>25?rows[24]!.id:null};
 }
}
