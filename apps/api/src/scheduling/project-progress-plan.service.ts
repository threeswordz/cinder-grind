import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { calculateConfirmedProjectProgress, WeightedProgressContractError } from './project-progress-weighting';

type Tx = Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
const userInclude = {userRoles:{include:{role:{include:{rolePermissions:{include:{permission:true}}}}}}} as const;
export type WorkPlanLineInput = {activityId: string; weightPercent: string; sourceKind: 'QUANTITY' | 'MILESTONE'; approvedBudgetRevisionLineId?: string};
const denied = (code: string): never => { throw new ForbiddenException({code}); };
const fail = (code: string): never => { throw new UnprocessableEntityException({code}); };
const stale = (): never => { throw new ConflictException({code:'FM02_VERSION_OR_SCOPE_CONFLICT'}); };
const decimal = (s: string, scale: number) => new RegExp('^(?:0|[1-9][0-9]{0,13})(?:\\.[0-9]{1,' + scale + '})?$').test(s);

@Injectable()
export class ProjectProgressPlanService {
  constructor(private readonly prisma: PrismaService, private readonly access: ProjectAccessService,
    private readonly audit: AuditService) {}


  // Confirm the live session and current role permissions in the same
  // serializable transaction; stale login claims cannot confirm work weights.
  private async live(tx:Tx,auth:AuthenticatedUserContext,code:string){
    const session=await tx.userSession.findFirst({where:{id:auth.sessionId,userId:auth.userId,
      revokedAt:null,expiresAt:{gt:new Date()},user:{companyId:auth.companyId,isActive:true,
        company:{isActive:true}}},include:{user:{include:userInclude}}});
    if(!session)denied('FM02_SESSION_REVOKED');
    // A permission granted through another Company/Role must never authorize
    // this Company's Project. Confirmation is reserved to Ben's configured
    // MANAGEMENT role; the permission catalog alone grants nobody this right.
    const activeRoles=session.user.userRoles.filter(x=>
      x.companyId===auth.companyId&&x.role.companyId===auth.companyId&&x.role.isActive);
    const permissions=new Set(activeRoles.flatMap(x=>
      x.role.rolePermissions.map(r=>r.permission.permissionCode)));
    if(!auth.permissions.includes(code)||!permissions.has(code))denied('FM02_PERMISSION_REVOKED');
    if(code==='schedule.work_plan.confirm'&&!activeRoles.some(x=>
      x.role.roleCode==='MANAGEMENT'&&x.role.rolePermissions.some(r=>
        r.permission.permissionCode===code)))denied('FM02_MANAGEMENT_ROLE_REQUIRED');
  }

  private async project(tx: Tx, auth: AuthenticatedUserContext, projectId: string) {
    const project = await tx.project.findFirst({where:{id:projectId,companyId:auth.companyId,isActive:true},
      select:{id:true,companyId:true}});
    if (!project) throw new NotFoundException({code:'FM02_ACTIVE_PROJECT_NOT_FOUND'});
    await this.access.assertAccess(auth,projectId,tx);
    return project;
  }
  private async serial<T>(work: (tx: Tx)=>Promise<T>) {
    for(let tries=0;;tries++){
      try {return await this.prisma.$transaction(work,{isolationLevel:'Serializable',timeout:20000});}
      catch(e){
        if(e instanceof Prisma.PrismaClientKnownRequestError && ['P2034','P2002'].includes(e.code)){
          if(tries<2)continue;
          stale();
        }
        throw e;
      }
    }
  }
  async options(auth: AuthenticatedUserContext, projectId: string) {
    return this.serial(async tx=>{
      await this.live(tx,auth,'schedule.work_plan.prepare');
      await this.project(tx,auth,projectId);
      const activities=await tx.activity.findMany({where:{companyId:auth.companyId,projectId,isActive:true,isSummary:false},
        select:{id:true,activityCode:true,activityName:true,wbsId:true,isMilestone:true,parentActivityId:true},
        orderBy:{activityCode:'asc'},take:200});
      const approved=await tx.budgetRevision.findFirst({where:{companyId:auth.companyId,projectId,
        approvalInstance:{is:{approvalState:'APPROVED'}}},orderBy:{revisionNo:'desc'},
        select:{id:true,revisionNo:true}});
      const quantityLines=approved?await tx.budgetRevisionLine.findMany({where:{budgetRevisionId:approved.id,wbsId:{not:null},
        quantity:{gt:0}},select:{id:true,description:true,quantity:true,uomId:true,uomCode:true,wbsId:true},
        orderBy:[{sortOrder:'asc'},{id:'asc'}],take:500}):[];
      // No rate, amount, cost or client price is returned.
      return {activities,approvedBudgetRevision:approved,quantityLines};
    });
  }
  async list(auth: AuthenticatedUserContext, projectId: string) {
    return this.serial(async tx=>{
      await this.live(tx,auth,'schedule.programme.view');
      await this.project(tx,auth,projectId);
      return tx.projectProgressPlan.findMany({where:{companyId:auth.companyId,projectId},
        include:{_count:{select:{lines:true}},preparedBy:{select:{id:true,displayName:true}},
          confirmedBy:{select:{id:true,displayName:true}}},orderBy:{versionNo:'desc'},take:100});
    });
  }
  async prepare(context: Context, input: {projectId:string;reason:string;lines:WorkPlanLineInput[]}) {
    const a=context.auth;
    return this.serial(async tx=>{
      await this.live(tx,a,'schedule.work_plan.prepare');
      await this.project(tx,a,input.projectId);
      if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>100)fail('FM02_PLAN_LINE_COUNT_INVALID');
      if(typeof input.reason!=='string'||input.reason.trim().length<1||input.reason.length>2000)fail('FM02_PLAN_REASON_REQUIRED');
      const planId=randomUUID();
      try{
        calculateConfirmedProjectProgress({planId,versionNo:1,confirmationVerified:false,
          lines:input.lines.map(x=>({activityId:x.activityId,weightPercent:x.weightPercent,source:null}))});
      }catch(e){if(e instanceof WeightedProgressContractError)fail(e.code);throw e;}
      const ids=input.lines.map(x=>x.activityId);
      const activities=await tx.activity.findMany({where:{companyId:a.companyId,projectId:input.projectId,id:{in:ids},
        isActive:true,isSummary:false},select:{id:true,wbsId:true,isMilestone:true,parentActivityId:true}});
      if(activities.length!==ids.length)denied('FM02_ACTIVITY_PROJECT_SCOPE');
      const selected=new Map(activities.map(x=>[x.id,x]));
      // Do not count an Activity and its parent/ancestor as separate work packages.
      for(const row of activities){
        let parent=row.parentActivityId;
        for(let depth=0;parent&&depth<101;depth++){
          if(selected.has(parent))fail('FM02_PARENT_CHILD_DOUBLE_COUNT');
          const ancestor=await tx.activity.findFirst({where:{id:parent,projectId:input.projectId,companyId:a.companyId},
            select:{parentActivityId:true}});
          if(!ancestor)denied('FM02_ANCESTOR_SCOPE_INVALID');
          parent=ancestor.parentActivityId;
          if(depth===100)fail('FM02_ACTIVITY_HIERARCHY_CYCLE');
        }
      }
      const selectedBudgetLineIds=input.lines.filter(l=>l.sourceKind==='QUANTITY').map(l=>l.approvedBudgetRevisionLineId);
      if(new Set(selectedBudgetLineIds).size!==selectedBudgetLineIds.length)fail('FM02_DUPLICATE_BOQ_SOURCE');
      const currentBudget=await tx.budgetRevision.findFirst({where:{companyId:a.companyId,projectId:input.projectId,
        approvalInstance:{is:{approvalState:'APPROVED'}}},select:{id:true},orderBy:{revisionNo:'desc'}});
      const budgetLines=selectedBudgetLineIds.length&&currentBudget?await tx.budgetRevisionLine.findMany({
        where:{id:{in:selectedBudgetLineIds.filter((id):id is string=>typeof id==='string')},
          budgetRevisionId:currentBudget.id},select:{id:true,wbsId:true,quantity:true,uomId:true}}):[];
      const bound=new Map(budgetLines.map(line=>[line.id,line]));
      const lines=input.lines.map(line=>{
        const activity=selected.get(line.activityId)!;
        if(line.sourceKind==='MILESTONE'){
          if(line.approvedBudgetRevisionLineId!==undefined)fail('FM02_MILESTONE_BOQ_SOURCE_INVALID');
          return {activityId:line.activityId,weightPercent:line.weightPercent,sourceKind:'MILESTONE',
            approvedBudgetRevisionLineId:null,plannedQuantity:null,uomId:null};
        }
        if(line.sourceKind!=='QUANTITY'||!line.approvedBudgetRevisionLineId)fail('FM02_SOURCE_KIND_INVALID');
        const budget=bound.get(line.approvedBudgetRevisionLineId);
        if(!budget||budget.wbsId!==activity.wbsId||budget.quantity.lte(0))denied('FM02_APPROVED_BOQ_PROJECT_SOURCE');
        return {activityId:line.activityId,weightPercent:line.weightPercent,sourceKind:'QUANTITY',
          approvedBudgetRevisionLineId:budget.id,plannedQuantity:budget.quantity,uomId:budget.uomId};
      });
      const latest=await tx.projectProgressPlan.findFirst({where:{companyId:a.companyId,projectId:input.projectId},
        orderBy:{versionNo:'desc'},select:{versionNo:true,confirmedAt:true}});
      if(latest&&!latest.confirmedAt)stale();
      const created=await tx.projectProgressPlan.create({data:{
        id:planId,companyId:a.companyId,projectId:input.projectId,versionNo:(latest?.versionNo??0)+1,
        reason:input.reason.trim(),preparedByUserId:a.userId,lines:{create:lines.map(line=>({
          activity:{connect:{id:line.activityId}},weightPercent:line.weightPercent,sourceKind:line.sourceKind,
          ...(line.approvedBudgetRevisionLineId?{
            approvedBudgetRevisionLine:{connect:{id:line.approvedBudgetRevisionLineId}},
            plannedQuantity:line.plannedQuantity,uomId:line.uomId}:{}),
        }))}},include:{lines:true}});
      await this.audit.record({...context,entityType:'PROJECT_PROGRESS_PLAN',entityId:created.id,action:'PREPARE',
        newValues:{projectId:input.projectId,versionNo:created.versionNo,lineCount:created.lines.length}},tx);
      return created;
    });
  }
  async confirm(context: Context,id: string,expectedVersion: number) {
    const a=context.auth;
    return this.serial(async tx=>{
      await this.live(tx,a,'schedule.work_plan.confirm');
      const plan=await tx.projectProgressPlan.findFirst({where:{id,companyId:a.companyId},
        include:{lines:true}});
      if(!plan)throw new NotFoundException({code:'FM02_PLAN_NOT_FOUND'});
      await this.project(tx,a,plan.projectId);
      if(plan.versionNo!==expectedVersion||plan.confirmedAt||plan.preparedByUserId===a.userId)stale();
      const newest=await tx.projectProgressPlan.findFirst({where:{projectId:plan.projectId,companyId:a.companyId},
        orderBy:{versionNo:'desc'},select:{id:true}});
      if(newest?.id!==id)stale();
      const result=await tx.projectProgressPlan.update({where:{id},data:{
        confirmedByUserId:a.userId,confirmedAt:new Date()},include:{lines:true}});
      await this.audit.record({...context,entityType:'PROJECT_PROGRESS_PLAN',entityId:id,action:'CONFIRM',
        oldValues:{confirmedAt:null},newValues:{versionNo:result.versionNo,confirmedByUserId:a.userId,confirmedAt:result.confirmedAt}},tx);
      return result;
    });
  }
  async current(auth: AuthenticatedUserContext,projectId: string) {
    return this.serial(async tx=>{
      await this.live(tx,auth,'schedule.programme.view');
      await this.project(tx,auth,projectId);
      const plan=await tx.projectProgressPlan.findFirst({where:{companyId:auth.companyId,projectId,
        confirmedAt:{not:null}},include:{lines:true,confirmedBy:{select:{id:true,displayName:true}}},
        orderBy:{versionNo:'desc'}});
      if(!plan)return {status:'NO_CONFIRMED_WORK_PLAN',projectId,percentComplete:null};
      const activities=await tx.activity.findMany({where:{companyId:auth.companyId,projectId,
        id:{in:plan.lines.map(x=>x.activityId)},isActive:true},select:{id:true}});
      const active=new Set(activities.map(x=>x.id));
      // A newer work-plan version must never inherit measured quantity records
      // from a previous plan or a different BOQ/UOM pin. Milestone assessments
      // must not be impersonated by a BOQ_QUANTITY row that happens to have a note.
      const evidence=await Promise.all(plan.lines.map(line=>active.has(line.activityId)?tx.activityProgress.findFirst({
        where:{companyId:auth.companyId,projectId,activityId:line.activityId,
          ...(line.sourceKind==='QUANTITY'?{
            sourceType:'BOQ_QUANTITY',
            sourceEntityId:plan.id,
            sourceBudgetRevisionLineId:line.approvedBudgetRevisionLineId,
            sourceUomId:line.uomId,
          }:{sourceType:{not:'BOQ_QUANTITY'}})},
        orderBy:[{createdAt:'desc'},{id:'desc'}],
        select:{id:true,sourceType:true,sourceEntityId:true,percentComplete:true,note:true,completedQuantity:true,
          sourceBudgetRevisionLineId:true,sourceUomId:true}}):Promise.resolve(null)));
      const lines=plan.lines.map((line,i)=>{
        const progress=evidence[i];let source=null;
        if(progress&&line.sourceKind==='QUANTITY'&&progress.sourceType==='BOQ_QUANTITY'&&
          progress.completedQuantity!==null&&progress.sourceBudgetRevisionLineId===line.approvedBudgetRevisionLineId&&
          progress.sourceUomId===line.uomId&&line.plannedQuantity!==null&&line.approvedBudgetRevisionLineId&&line.uomId){
          source={kind:'QUANTITY' as const,sourceRecordId:progress.id,
            approvedBudgetRevisionLineId:line.approvedBudgetRevisionLineId,uomId:line.uomId,
            plannedQuantity:line.plannedQuantity.toFixed(4),completedQuantity:progress.completedQuantity.toFixed(4)};
        } else if(progress&&line.sourceKind==='MILESTONE'&&progress.note?.trim()){
          source={kind:'MILESTONE' as const,sourceRecordId:progress.id,
            percentComplete:progress.percentComplete.toFixed(2),assessmentReason:progress.note};
        }
        return {activityId:line.activityId,weightPercent:line.weightPercent.toFixed(2),source};
      });
      const calculation=calculateConfirmedProjectProgress({planId:plan.id,versionNo:plan.versionNo,
        confirmationVerified:!!plan.confirmedAt&&!!plan.confirmedByUserId,lines});
      // Keep the immutable plan's intended basis distinct from the observed
      // evidence type. An unmeasured QUANTITY line still needs a quantity input,
      // even though the calculator correctly reports sourceKind:null.
      return {projectId,confirmedAt:plan.confirmedAt,confirmedBy:plan.confirmedBy,...calculation,
        lines:calculation.lines.map((item,i)=>({...item,planSourceKind:plan.lines[i]!.sourceKind}))};
    });
  }
  async recordQuantity(context:Context,activityId:string,input:{
    progressDate:Date;completedQuantity:string;note:string;
  }) {
    const a=context.auth;
    return this.serial(async tx=>{
      await this.live(tx,a,'schedule.progress.record');
      const activity=await tx.activity.findFirst({where:{id:activityId,companyId:a.companyId,isActive:true},
        select:{id:true,projectId:true}});
      if(!activity)throw new NotFoundException({code:'FM02_ACTIVITY_NOT_FOUND'});
      await this.project(tx,a,activity.projectId);
      if(!decimal(input.completedQuantity,4))fail('FM02_COMPLETED_QUANTITY_INVALID');
      if(typeof input.note!=='string'||!input.note.trim()||input.note.length>10000)fail('FM02_QUANTITY_NOTE_REQUIRED');
      const plan=await tx.projectProgressPlan.findFirst({where:{companyId:a.companyId,projectId:activity.projectId,
        confirmedAt:{not:null}},include:{lines:{where:{activityId,sourceKind:'QUANTITY'}}},
        orderBy:{versionNo:'desc'}});
      const line=plan?.lines[0];
      if(!line||!line.plannedQuantity||!line.approvedBudgetRevisionLineId||!line.uomId)stale();
      const actual=new Prisma.Decimal(input.completedQuantity);
      if(actual.lt(0)||actual.gt(line.plannedQuantity))fail('FM02_QUANTITY_OUTSIDE_APPROVED_SOURCE');
      const percent=actual.div(line.plannedQuantity).mul(100).toDecimalPlaces(2,Prisma.Decimal.ROUND_HALF_UP);
      const record=await tx.activityProgress.create({data:{
        companyId:a.companyId,projectId:activity.projectId,activityId,
        progressDate:input.progressDate,percentComplete:percent,note:input.note.trim(),
        sourceType:'BOQ_QUANTITY',sourceEntityId:plan!.id,completedQuantity:actual,
        sourceBudgetRevisionLineId:line.approvedBudgetRevisionLineId,sourceUomId:line.uomId,
        recordedByUserId:a.userId}});
      await this.audit.record({...context,entityType:'ACTIVITY_PROGRESS',entityId:record.id,action:'BOQ_QUANTITY_RECORD',
        newValues:{activityId,projectId:activity.projectId,workPlanId:plan!.id,
          approvedBudgetRevisionLineId:line.approvedBudgetRevisionLineId,completedQuantity:actual.toString()}},tx);
      return record;
    });
  }
}
