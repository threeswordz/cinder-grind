import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import {
  SS02_ENTITY, ss02Decision, ss02Propose, ss02Replay, ss02Uuid,
  type Ss02Case,
} from './material-code-request-contract';

type Db = PrismaService | Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
type Stage = 'VIEW' | 'REQUEST' | 'PM' | 'CREATOR';
const conflict = (code: string): never => { throw new ConflictException({code}); };
const denied = (): never => { throw new ForbiddenException({code:'SS02_LIVE_ROLE_OR_PERMISSION_DENIED'}); };
const invalid = (): never => { throw new UnprocessableEntityException({code:'SS02_INPUT_INVALID'}); };

/** SS02 request and completion evidence only. This service NEVER creates Materials. */
@Injectable()
export class MaterialCodeRequestService {
  constructor(private readonly prisma: PrismaService,
    private readonly access: ProjectAccessService) {}

  private async actor(supplied: AuthenticatedUserContext, db: Db, stage: Stage) {
    const session = await db.userSession.findFirst({
      where: { id: supplied.sessionId, userId: supplied.userId, revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { companyId: supplied.companyId, isActive: true,
          company: {isActive:true} } },
      select: { user: { select: {
        employee: {select:{companyId:true,isActive:true}},
        userRoles:{ select:{ role:{ select:{
          companyId:true,isActive:true,roleCode:true,
          rolePermissions:{select:{permission:{select:{permissionCode:true}}}},
        }}} },
      }}},
    });
    if (!session?.user.employee?.isActive ||
        session.user.employee.companyId!==supplied.companyId) return denied();
    const roles=session.user.userRoles.map(x=>x.role)
      .filter(x=>x.isActive && x.companyId===supplied.companyId);
    const permitted=new Set(roles.flatMap(r=>r.rolePermissions.map(x=>x.permission.permissionCode)));
    const has=(right:string)=>supplied.permissions.includes(right)&&permitted.has(right);
    const store=roles.some(r=>r.roleCode==='STOREKEEPER')&&has('inventory.material_request.view');
    const pm=roles.some(r=>r.roleCode==='PROJECT_MANAGER')&&has('inventory.stock.view');
    const creator=roles.some(r=>r.roleCode==='PROCUREMENT_OFFICER'||r.roleCode==='FINANCE_MANAGER')&&
      has('master.material.manage');
    if (!(stage==='VIEW' ? store||pm||creator : stage==='REQUEST' ? store :
      stage==='PM' ? pm : creator)) return denied();
    return { ...supplied,roleCodes:roles.map(r=>r.roleCode),
      permissions:[...permitted].filter(right=>supplied.permissions.includes(right)) };
  }

  private async project(auth: AuthenticatedUserContext, projectId: string, db: Db) {
    await this.access.assertAccess(auth,projectId,db);
    const p=await db.project.findFirst({
      where:{id:projectId,companyId:auth.companyId,isActive:true},
      select:{id:true,projectCode:true,projectName:true},
    });
    if(!p)throw new NotFoundException({code:'SS02_ACTIVE_PROJECT_REQUIRED'});
    return p;
  }

  async projects(supplied: AuthenticatedUserContext) {
    const auth=await this.actor(supplied,this.prisma,'VIEW');
    const scope=await this.access.scopeWhere(auth);
    return this.prisma.project.findMany({
      where:{AND:[scope,{isActive:true}]},
      select:{id:true,projectCode:true,projectName:true},
      orderBy:{projectCode:'asc'},take:101,
    });
  }

  private async history(companyId:string,requestId:string,db:Db) {
    const rows=await db.auditLog.findMany({
      where:{companyId,entityType:SS02_ENTITY,entityId:requestId},
      select:{id:true,entityId:true,actorUserId:true,action:true,
        newValues:true,occurredAt:true},
      take:21,
    });
    if(rows.length>20)return conflict('SS02_HISTORY_LIMIT');
    return rows;
  }

  private async current(companyId:string,projectId:string,requestId:string,db:Db) {
    let state: Ss02Case | null;
    try {
      state=ss02Replay(await this.history(companyId,requestId,db),
        companyId,projectId,requestId);
    } catch {
      return conflict('SS02_AUDIT_HISTORY_INVALID');
    }
    if(!state)throw new NotFoundException({code:'SS02_REQUEST_NOT_FOUND'});
    return state;
  }

  async list(supplied:AuthenticatedUserContext,projectId:string){
    const auth=await this.actor(supplied,this.prisma,'VIEW');
    await this.project(auth,projectId,this.prisma);
    const events=await this.prisma.auditLog.findMany({
      where:{companyId:auth.companyId,entityType:SS02_ENTITY,
        newValues:{path:['projectId'],equals:projectId}},
      select:{id:true,entityId:true,actorUserId:true,action:true,
        newValues:true,occurredAt:true},
      take:1001,
    });
    if(events.length>1000)return conflict('SS02_REQUEST_LIST_LIMIT');
    const groups=new Map<string,typeof events>();
    for(const e of events)groups.set(e.entityId,[...(groups.get(e.entityId)??[]),e]);
    const result:Ss02Case[]=[];
    for(const [id,rows] of groups){
      try {
        const state=ss02Replay(rows,auth.companyId,projectId,id);
        if(state) result.push(state);
      } catch { return conflict('SS02_AUDIT_HISTORY_INVALID'); }
    }
    return result.sort((a,b)=>b.version-a.version||
      a.requestId.localeCompare(b.requestId));
  }

  async create(context:Context,projectId:string,input:unknown) {
    let proposal:ReturnType<typeof ss02Propose>;
    try {proposal=ss02Propose(input)} catch {return invalid();}
    const auth=await this.actor(context.auth,this.prisma,'REQUEST');
    await this.project(auth,projectId,this.prisma);
    const existing=await this.prisma.material.findFirst({
      where:{companyId:auth.companyId,isActive:true,
        materialName:{equals:proposal.requestedName,mode:'insensitive'}},
      select:{id:true},
    });
    if(existing)return conflict('SS02_MATERIAL_ALREADY_EXISTS');
    const requestId=randomUUID();
    const event=await this.prisma.auditLog.create({
      data:{companyId:auth.companyId,entityType:SS02_ENTITY,
        entityId:requestId,action:'REQUEST',actorUserId:auth.userId,
        ...(context.correlationId?{correlationId:context.correlationId}:{}),
        newValues:{requestId,companyId:auth.companyId,projectId,
          ...proposal,requestedByUserId:auth.userId,pmUserId:null,
          creatorUserId:null,linkedMaterialId:null,status:'PENDING_PM',
          version:1,previousEventId:null,effect:'NO_MATERIAL_WRITE'}},
      select:{id:true},
    });
    return {requestId,status:'PENDING_PM' as const,version:1,
      expectedEventId:event.id,materialCreated:false};
  }

  async decide(context:Context,projectId:string,requestId:string,input:unknown) {
    let cmd:ReturnType<typeof ss02Decision>;
    try {cmd=ss02Decision(input)} catch {return invalid();}
    if(!ss02Uuid(requestId))return invalid();
    return this.prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        ['ss02',context.auth.companyId,requestId].join(':'));
      const stage:Stage=cmd.action==='CREATOR_LINK'?'CREATOR':'PM';
      const auth=await this.actor(context.auth,tx,stage);
      await this.project(auth,projectId,tx);
      const prior=await this.current(auth.companyId,projectId,requestId,tx);
      if(cmd.expectedVersion!==prior.version||cmd.expectedEventId!==prior.lastEventId)
        return conflict('SS02_STALE_REVIEW');
      let status:'PENDING_CREATOR'|'RETURNED'|'COMPLETED';
      let createdId:string|null=null;
      let pm=prior.pmUserId,creator=prior.creatorUserId;
      if(cmd.action==='CREATOR_LINK'){
        if(prior.status!=='PENDING_CREATOR'||!prior.pmUserId ||
            auth.userId===prior.pmUserId||auth.userId===prior.requestedByUserId)
          return denied();
        const material=await tx.material.findFirst({
          where:{id:cmd.createdMaterialId!,companyId:auth.companyId,isActive:true},
          select:{id:true,materialName:true,createdAt:true,defaultUomId:true},
        });
        if(!material||material.materialName.toLocaleLowerCase()!==
          prior.requestedName.toLocaleLowerCase())
          return conflict('SS02_MATERIAL_NOT_MATCHING_REQUEST');
        const pmEvent=await tx.auditLog.findUnique({
          where:{id:prior.lastEventId},select:{occurredAt:true},
        });
        const source=await tx.auditLog.findFirst({
          where:{companyId:auth.companyId,entityType:'MATERIAL',
            entityId:material.id,action:'CREATE',actorUserId:auth.userId,
            occurredAt:{gte:pmEvent?.occurredAt??new Date()}},
          select:{id:true},
        });
        if(!source)return conflict('SS02_AUTHORIZED_CANONICAL_CREATE_EVIDENCE_REQUIRED');
        status='COMPLETED';creator=auth.userId;createdId=material.id;
      } else {
        if(prior.status!=='PENDING_PM'||auth.userId===prior.requestedByUserId)
          return denied();
        pm=auth.userId;
        status=cmd.action==='PM_APPROVE'?'PENDING_CREATOR':'RETURNED';
      }
      const event=await tx.auditLog.create({
        data:{companyId:auth.companyId,entityType:SS02_ENTITY,
          entityId:requestId,actorUserId:auth.userId,action:cmd.action,
          ...(context.correlationId?{correlationId:context.correlationId}:{}),
          newValues:{requestId,companyId:auth.companyId,projectId,
            requestedName:prior.requestedName,suggestedCode:prior.suggestedCode,
            suggestedUomCode:prior.suggestedUomCode,requestReason:prior.requestReason,
            requestedByUserId:prior.requestedByUserId,pmUserId:pm,
            creatorUserId:creator,linkedMaterialId:createdId,status,
            version:prior.version+1,previousEventId:prior.lastEventId,
            note:cmd.note,effect:'NO_MATERIAL_WRITE'}},
        select:{id:true},
      });
      return {requestId,status,version:prior.version+1,
        expectedEventId:event.id,linkedMaterialId:createdId,
        materialCreated:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  }
}
