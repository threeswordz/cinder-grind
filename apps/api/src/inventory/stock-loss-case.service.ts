import {
  ConflictException,ForbiddenException,Injectable,NotFoundException,UnprocessableEntityException,
} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../audit/audit.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {DocumentsService} from '../documents/documents.service';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {
  caseUuid,lossCasePayload,lossDocumentDigest,replayLossCase,
  LOSS_CASE_ENTITY,LOSS_OPEN,LOSS_SCREEN,LOSS_BEN,LOSS_NANCY,
  type CaseDocument,type LossCaseState,
} from './stock-loss-case-contract';
type Db=Prisma.TransactionClient|PrismaService;
type Context={auth:AuthenticatedUserContext;correlationId?:string};
type Role='STOREKEEPER'|'PROJECT_MANAGER'|'MANAGEMENT'|'FINANCE_MANAGER';
const conflict=(code:string):never=>{throw new ConflictException({code});};
const denied=(code:string):never=>{throw new ForbiddenException({code});};
const invalid=(code:string):never=>{throw new UnprocessableEntityException({code});};

@Injectable()
export class StockLossCaseService{
  constructor(
    private readonly prisma:PrismaService,
    private readonly access:ProjectAccessService,
    private readonly documents:DocumentsService,
    private readonly audit:AuditService,
  ){}

  private async actor(auth:AuthenticatedUserContext,db:Db,action:'VIEW'|Role){
    const session=await db.userSession.findFirst({
      where:{id:auth.sessionId,userId:auth.userId,revokedAt:null,
        expiresAt:{gt:new Date()},
        user:{companyId:auth.companyId,isActive:true,company:{isActive:true}}},
      select:{user:{select:{
        employee:{select:{companyId:true,isActive:true}},
        userRoles:{select:{role:{select:{
          companyId:true,isActive:true,roleCode:true,
          rolePermissions:{select:{permission:{select:{permissionCode:true}}}},
        }}}},
      }}},
    });
    const roles=session?.user.userRoles.filter(r=>r.role.companyId===auth.companyId&&r.role.isActive)
      .map(r=>r.role)??[];
    const livePerms=new Set(roles.flatMap(r=>r.rolePermissions.map(x=>x.permission.permissionCode)));
    if(!session||!session.user.employee?.isActive||
      session.user.employee.companyId!==auth.companyId||
      !roles.some(r=>action==='VIEW'
        ?['STOREKEEPER','PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(r.roleCode)
        :r.roleCode===action)||
      !['inventory.stock.view','documents.document.view'].every(p=>
        auth.permissions.includes(p)&&livePerms.has(p)))
      return denied('SS13_CURRENT_ACTOR_PERMISSION_DENIED');
    return {...auth,roleCodes:roles.map(r=>r.roleCode),
      permissions:[...livePerms].filter(p=>auth.permissions.includes(p))};
  }

  private async scope(auth:AuthenticatedUserContext,projectId:string,warehouseId:string,
    materialId:string,uomId:string,db:Db){
    await this.access.assertAccess(auth,projectId,db);
    const [warehouse,material,uom]=await Promise.all([
      db.warehouse.findFirst({where:{id:warehouseId,companyId:auth.companyId,
        projectId,isSiteWarehouse:true,isActive:true,project:{isActive:true}},select:{id:true}}),
      db.material.findFirst({where:{id:materialId,companyId:auth.companyId,isActive:true},
        select:{id:true}}),
      db.unitOfMeasure.findFirst({where:{id:uomId,companyId:auth.companyId,isActive:true},
        select:{id:true}}),
    ]);
    if(!warehouse||!material||!uom)
      return invalid('SS13_ACTIVE_PROJECT_SITE_MATERIAL_UOM_REQUIRED');
  }

  private async sourceDocs(auth:AuthenticatedUserContext,projectId:string,ids:string[],db:Db){
    if(!ids.length||ids.length>20||new Set(ids).size!==ids.length||
      ids.some(id=>!caseUuid(id)))return invalid('SS13_DOCUMENT_IDS_INVALID');
    const rows=await db.document.findMany({
      where:{id:{in:ids},companyId:auth.companyId,isActive:true,
        links:{some:{entityType:'PROJECT',entityId:projectId}}},
      select:{id:true,checksum:true,fileSizeBytes:true,uploadedAt:true,
        links:{select:{id:true,entityType:true,entityId:true}}},
    });
    if(rows.length!==ids.length)return conflict('SS13_DOCUMENT_SOURCE_MISSING');
    const visible=await this.documents.filterSourceDocuments(auth,projectId,rows,db as Prisma.TransactionClient);
    if(visible.length!==ids.length)return denied('SS13_DOCUMENT_SOURCE_NOT_AUTHORIZED');
    const docs:CaseDocument[]=[];
    for(const row of visible){
      const projectLinks=row.links.filter(l=>l.entityType==='PROJECT'&&l.entityId===projectId);
      const otherProject=row.links.some(l=>l.entityType==='PROJECT'&&l.entityId!==projectId);
      if(!projectLinks.length||otherProject||!row.checksum)
        return conflict('SS13_DOCUMENT_PROJECT_OR_CHECKSUM_INVALID');
      docs.push({
        id:row.id,checksum:row.checksum,fileSizeBytes:row.fileSizeBytes,
        uploadedAt:row.uploadedAt.toISOString(),
        linkIds:row.links.map(l=>l.id),
      });
    }
    return lossDocumentDigest(docs);
  }

  private async events(auth:AuthenticatedUserContext,id:string,db:Db){
    const rows=await db.auditLog.findMany({
      where:{companyId:auth.companyId,entityType:LOSS_CASE_ENTITY,entityId:id,
        action:{in:[LOSS_OPEN,LOSS_SCREEN,LOSS_BEN,LOSS_NANCY]}},
      select:{id:true,actorUserId:true,action:true,occurredAt:true,newValues:true},
      take:101,
    });
    if(rows.length>100)return conflict('SS13_HISTORY_LIMIT_EXCEEDED');
    try{return replayLossCase(id,rows);}
    catch{return conflict('SS13_AUDIT_HISTORY_INVALID');}
  }

  private async current(auth:AuthenticatedUserContext,id:string,db:Db){
    const state=await this.events(auth,id,db);
    if(!state)throw new NotFoundException({code:'SS13_CASE_NOT_FOUND'});
    await this.scope(auth,state.projectId,state.warehouseId,state.materialId,state.uomId,db);
    const digest=await this.sourceDocs(auth,state.projectId,state.evidenceDocumentIds,db);
    if(digest!==state.evidenceFingerprint)
      return conflict('SS13_DOCUMENT_EVIDENCE_CHANGED');
    return state;
  }

  async read(auth:AuthenticatedUserContext,id:string){
    const currentAuth=await this.actor(auth,this.prisma,'VIEW');
    const state=await this.current(currentAuth,id,this.prisma);
    // All source and document permissions verified BEFORE disclosing IDs/notes.
    return state;
  }

  async open(context:Context,body:unknown){
    let input:ReturnType<typeof lossCasePayload>;
    try{input=lossCasePayload(body);}
    catch{return invalid('SS13_REPORT_FIELDS_INVALID');}
    return this.prisma.$transaction(async tx=>{
      const auth=await this.actor(context.auth,tx,'STOREKEEPER');
      await this.scope(auth,input.projectId,input.warehouseId,input.materialId,input.uomId,tx);
      const fingerprint=await this.sourceDocs(auth,input.projectId,input.evidenceDocumentIds,tx);
      const id=randomUUID();
      await this.audit.record({
        ...context,auth,entityType:LOSS_CASE_ENTITY,entityId:id,action:LOSS_OPEN,
        newValues:{
          ...input,evidenceFingerprint: fingerprint,
          reportedByUserId:auth.userId,previousEventId:null,version:1,
          effect:'NONE_OPERATIONAL_PROPOSAL',
        },
      },tx);
      return {caseId:id,projectId:input.projectId,status:'OPEN',
        financialWriteOffPosted:false,stockDisposalExecuted:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  private async transition(
    context:Context,id:string,expectedEventId:string,role:Role,
    action:string,fields:Record<string,unknown>,
  ){
    if(!caseUuid(expectedEventId))return invalid('SS13_EXPECTED_EVENT_ID_REQUIRED');
    return this.prisma.$transaction(async tx=>{
      const auth=await this.actor(context.auth,tx,role);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',
        'stock-loss-case:'+auth.companyId+':'+id);
      const state=await this.current(auth,id,tx);
      if(state.latestEventId!==expectedEventId)
        return conflict('SS13_STALE_EVENT_VERSION');
      if(role==='PROJECT_MANAGER'){
        if(state.status!=='OPEN'||auth.userId===state.makerUserId)
          return denied('SS13_INDEPENDENT_PM_REQUIRED');
      }else if(role==='MANAGEMENT'){
        if(state.status!=='BEN_PENDING'||auth.userId===state.makerUserId||
          auth.userId===state.pmUserId)return denied('SS13_INDEPENDENT_BEN_REQUIRED');
      }else if(role==='FINANCE_MANAGER'){
        if(state.status!=='NANCY_PENDING'||state.proposedDisposition!=='DISPOSAL'||
          [state.makerUserId,state.pmUserId,state.benUserId].includes(auth.userId))
          return denied('SS13_INDEPENDENT_NANCY_DISPOSAL_REQUIRED');
      }else return denied('SS13_ACTION_ROLE_INVALID');
      await this.audit.record({
        ...context,auth,entityType:LOSS_CASE_ENTITY,entityId:id,action,
        newValues:{...fields,previousEventId:state.latestEventId,
          version:state.version+1,
          stockDisposalExecuted:false,financeWriteOffPosted:false},
      },tx);
      return {caseId:id,projectId:state.projectId,action,
        newVersion:state.version+1,stockDisposalExecuted:false,
        financeWriteOffPosted:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async screen(context:Context,id:string,expectedEventId:string,
    decision:'RETURN'|'NONDISPOSAL_REVIEW'|'FORWARD_DISPOSAL',
    escalateToBen:boolean,note:string){
    if(!['RETURN','NONDISPOSAL_REVIEW','FORWARD_DISPOSAL'].includes(decision)||
      typeof escalateToBen!=='boolean'||typeof note!=='string'||
      !note.trim()||note.trim()!==note||note.length>2000)
      return invalid('SS13_PM_DECISION_FIELDS_INVALID');
    return this.transition(context,id,expectedEventId,'PROJECT_MANAGER',LOSS_SCREEN,
      {decision,escalateToBen,note});
  }

  async benReview(context:Context,id:string,expectedEventId:string,note:string){
    if(typeof note!=='string'||!note.trim()||note.trim()!==note||note.length>2000)
      return invalid('SS13_BEN_NOTE_REQUIRED');
    return this.transition(context,id,expectedEventId,'MANAGEMENT',LOSS_BEN,{note});
  }

  async nancyDecision(context:Context,id:string,expectedEventId:string,
    decision:'APPROVE_PROPOSAL'|'REJECT_PROPOSAL',note:string){
    if(!['APPROVE_PROPOSAL','REJECT_PROPOSAL'].includes(decision)||
      typeof note!=='string'||!note.trim()||note.trim()!==note||note.length>2000)
      return invalid('SS13_NANCY_DECISION_FIELDS_INVALID');
    return this.transition(context,id,expectedEventId,'FINANCE_MANAGER',LOSS_NANCY,
      {decision,note});
  }
}
