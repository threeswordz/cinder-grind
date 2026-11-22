import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuditService} from '../audit/audit.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {DocumentsService} from '../documents/documents.service';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {
  URGENT_DOC_ENTITY, URGENT_DOC_REGISTER, URGENT_DOC_SUBMIT,
  URGENT_DOC_RETURN, URGENT_DOC_CLOSE, urgentDueAt, urgentIssueEvidence,
  urgentSnapshotDigest, type UrgentDocumentSnapshot,
} from './urgent-material-issue-contract';

type Tx=Prisma.TransactionClient;
type Context={auth:AuthenticatedUserContext;correlationId?:string};
type Action='VIEW'|'MAKER'|'REVIEW';
const conflict=(code:string):never=>{throw new ConflictException({code});};
const missing=():never=>{throw new NotFoundException({code:'PM09_ISSUE_NOT_FOUND'});};

@Injectable()
export class UrgentMaterialIssueDocumentsService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly access:ProjectAccessService,
    private readonly audit:AuditService,
    private readonly documents:DocumentsService,
  ) {}

  private async liveActor(auth:AuthenticatedUserContext,db:Tx|PrismaService,action:Action){
    const session=await db.userSession.findFirst({
      where:{
        id:auth.sessionId,userId:auth.userId,revokedAt:null,
        expiresAt:{gt:new Date()},
        user:{companyId:auth.companyId,isActive:true,company:{isActive:true}},
      },
      select:{user:{select:{
        employee:{select:{isActive:true,companyId:true}},
        userRoles:{select:{role:{select:{
          isActive:true,companyId:true,roleCode:true,
          rolePermissions:{select:{permission:{select:{permissionCode:true}}}},
        }}}},
      }}},
    });
    const roles=session?.user.userRoles.filter(row=>row.role.isActive&&row.role.companyId===auth.companyId)
      .map(row=>row.role)??[];
    const effective=new Set(roles.flatMap(row=>row.rolePermissions.map(p=>p.permission.permissionCode)));
    const role=action==='MAKER'?'STOREKEEPER':'PROJECT_MANAGER';
    const permissions=action==='MAKER'?['inventory.issue.view','inventory.issue.create','documents.document.view']:
      action==='REVIEW'?['inventory.issue.view','inventory.issue.approve','documents.document.view']:
      ['inventory.issue.view','documents.document.view'];
    const hasRole=action==='VIEW'
      ?roles.some(row=>['STOREKEEPER','PROJECT_MANAGER'].includes(row.roleCode))
      :roles.some(row=>row.roleCode===role);
    if (!session || !session.user.employee?.isActive ||
      session.user.employee.companyId!==auth.companyId ||
      !hasRole || !permissions.every(p=>auth.permissions.includes(p)&&effective.has(p)))
      throw new ForbiddenException({code:'PM09_CURRENT_ACTOR_PERMISSION_DENIED'});
    return {...auth,roleCodes:roles.map(r=>r.roleCode),
      permissions:[...effective].filter(permission=>auth.permissions.includes(permission))};
  }

  private async source(auth:AuthenticatedUserContext,id:string,db:Tx|PrismaService){
    const issue=await db.materialIssue.findFirst({
      where:{id,companyId:auth.companyId},
      select:{id:true,companyId:true,projectId:true,createdByUserId:true,postedAt:true,reversedAt:true},
    });
    if(!issue) return missing();
    await this.access.assertAccess(auth,issue.projectId,db);
    if(!issue.postedAt || issue.reversedAt)
      return conflict('PM09_CANONICAL_POSTED_ISSUE_REQUIRED');
    return issue;
  }

  private async history(auth:AuthenticatedUserContext,id:string,db:Tx|PrismaService){
    return db.auditLog.findMany({
      where:{companyId:auth.companyId,entityType:URGENT_DOC_ENTITY,entityId:id,
        action:{in:[URGENT_DOC_REGISTER,URGENT_DOC_SUBMIT,URGENT_DOC_RETURN,URGENT_DOC_CLOSE]}},
      select:{id:true,action:true,actorUserId:true,occurredAt:true,newValues:true},
    });
  }

  private async snapshot(auth:AuthenticatedUserContext,projectId:string,id:string,
    documentIds:string[],postedAt:Date,db:Tx|PrismaService){
    if(!documentIds.length || documentIds.length>100 || new Set(documentIds).size!==documentIds.length)
      return conflict('PM09_DOCUMENT_SELECTION_INVALID');
    const rows=await db.document.findMany({
      where:{id:{in:documentIds},companyId:auth.companyId,isActive:true,
        links:{some:{entityType:'MATERIAL_ISSUE',entityId:id}}},
      select:{
        id:true,checksum:true,fileSizeBytes:true,uploadedAt:true,uploadedByUserId:true,
        links:{select:{id:true,entityType:true,entityId:true}},
      },
    });
    if(rows.length!==documentIds.length) return conflict('PM09_EVIDENCE_SOURCE_MISSING');
    const authorized=await this.documents.filterSourceDocuments(auth,projectId,rows,db as Tx);
    if(authorized.length!==documentIds.length) return conflict('PM09_EVIDENCE_SOURCE_NOT_AUTHORIZED');
    const documents:UrgentDocumentSnapshot[]=[];
    for(const row of authorized){
      const projectLinks=row.links.filter(link=>link.entityType==='PROJECT'&&link.entityId===projectId);
      const sourceLinks=row.links.filter(link=>link.entityType==='MATERIAL_ISSUE'&&link.entityId===id);
      if(!projectLinks.length||!sourceLinks.length||!row.checksum)
        return conflict('PM09_EVIDENCE_LINK_OR_CHECKSUM_REQUIRED');
      documents.push({
        id:row.id,checksum:row.checksum,uploadedAt:row.uploadedAt.toISOString(),
        fileSizeBytes:row.fileSizeBytes,
        linkIds:[...projectLinks,...sourceLinks].map(link=>link.id),
      });
    }
    return {
      documents,
      digest:urgentSnapshotDigest(documents),
      onTimeUploaded:documents.every(doc=>Date.parse(doc.uploadedAt)<=Date.parse(urgentDueAt(
        // The caller checks against the canonical posted-at instant.
        // Do not derive a deadline from document or form timestamps.
        postedAt,
      ))),
      uploaderIds:authorized.map(row=>row.uploadedByUserId),
    };
  }

  async read(auth:AuthenticatedUserContext,id:string){
    const currentAuth=await this.liveActor(auth,this.prisma,'VIEW');
    const issue=await this.source(currentAuth,id,this.prisma);
    const state=urgentIssueEvidence(issue.postedAt!,await this.history(currentAuth,id,this.prisma));
    if(!state) return {issueId:id,projectId:issue.projectId,record:null};
    let sourceCurrent=false;
    if(state.evidenceFingerprint&&state.documentIds.length){
      try{
        const snapshot=await this.snapshot(currentAuth,issue.projectId,id,state.documentIds,issue.postedAt!,this.prisma);
        sourceCurrent=snapshot.digest===state.evidenceFingerprint;
      }catch{
        sourceCurrent=false;
      }
    }
    return {
      issueId:id,projectId:issue.projectId,
      record:{
        ...state,sourceCurrent,
        overdue:new Date()>new Date(state.dueAt) &&
          state.status!=='CLOSED',
        authority:'DOCUMENT_TRACKING_ONLY_NO_STOCK_POSTING',
      },
    };
  }

  async register(context:Context,id:string,reason:string){
    return this.prisma.$transaction(async tx=>{
      const currentAuth=await this.liveActor(context.auth,tx,'MAKER');
      const issue=await this.source(currentAuth,id,tx);
      if(issue.createdByUserId!==context.auth.userId)
        throw new ForbiddenException({code:'PM09_ORIGINAL_ISSUE_PREPARER_REQUIRED'});
      if((await this.history(currentAuth,id,tx)).length)
        return conflict('PM09_ALREADY_REGISTERED');
      await this.audit.record({
        ...context,auth:currentAuth,entityType:URGENT_DOC_ENTITY,entityId:id,action:URGENT_DOC_REGISTER,
        newValues:{
          reason,sourcePostedAt:issue.postedAt!.toISOString(),dueAt:urgentDueAt(issue.postedAt!),
          authority:'DOCUMENT_TRACKING_ONLY_NO_STOCK_POSTING',
        },
      },tx);
      return {issueId:id,projectId:issue.projectId,dueAt:urgentDueAt(issue.postedAt!),
        recordedAsLate:new Date()>new Date(urgentDueAt(issue.postedAt!))};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async submit(context:Context,id:string,documentIds:string[],completionNote:string){
    return this.prisma.$transaction(async tx=>{
      const currentAuth=await this.liveActor(context.auth,tx,'MAKER');
      const issue=await this.source(currentAuth,id,tx);
      if(issue.createdByUserId!==context.auth.userId)
        throw new ForbiddenException({code:'PM09_ORIGINAL_ISSUE_PREPARER_REQUIRED'});
      const current=urgentIssueEvidence(issue.postedAt!,await this.history(currentAuth,id,tx));
      if(!current || !['OPEN','RETURNED'].includes(current.status))
        return conflict('PM09_NOT_OPEN_FOR_EVIDENCE');
      const evidence=await this.snapshot(currentAuth,issue.projectId,id,documentIds,issue.postedAt!,tx);
      await this.audit.record({
        ...context,auth:currentAuth,entityType:URGENT_DOC_ENTITY,entityId:id,action:URGENT_DOC_SUBMIT,
        newValues:{
          previousEventId:current.lastEventId,documentIds:[...documentIds].sort(),
          completionNote,evidenceFingerprint:evidence.digest,
          docsUploadedByDeadline:evidence.onTimeUploaded,
        },
      },tx);
      return {issueId:id,projectId:issue.projectId,evidenceFingerprint:evidence.digest,
        dueAt:current.dueAt,submittedForIndependentCheck:true};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }

  async decide(context:Context,id:string,decision:'CLOSE'|'RETURN',
    expectedSubmissionEventId:string,expectedFingerprint:string,note:string){
    return this.prisma.$transaction(async tx=>{
      const currentAuth=await this.liveActor(context.auth,tx,'REVIEW');
      const issue=await this.source(currentAuth,id,tx);
      if(issue.createdByUserId===context.auth.userId)
        throw new ForbiddenException({code:'PM09_INDEPENDENT_PROJECT_MANAGER_REQUIRED'});
      const current=urgentIssueEvidence(issue.postedAt!,await this.history(currentAuth,id,tx));
      if(!current||current.status!=='SUBMITTED'||current.evidenceFingerprint!==expectedFingerprint ||
        current.lastEventId!==expectedSubmissionEventId)
        return conflict('PM09_STALE_OR_UNSUBMITTED_EVIDENCE');
      const evidence=await this.snapshot(currentAuth,issue.projectId,id,current.documentIds,issue.postedAt!,tx);
      if(evidence.digest!==current.evidenceFingerprint)
        return conflict('PM09_DOCUMENT_EVIDENCE_CHANGED');
      if(evidence.uploaderIds.includes(context.auth.userId))
        throw new ForbiddenException({code:'PM09_SELF_UPLOADED_EVIDENCE_REVIEW_DENIED'});
      await this.audit.record({
        ...context,auth:currentAuth,entityType:URGENT_DOC_ENTITY,entityId:id,
        action:decision=== 'CLOSE'?URGENT_DOC_CLOSE:URGENT_DOC_RETURN,
        newValues:{
          previousEventId:current.lastEventId,reviewedSubmissionEventId:current.lastEventId,note,
          evidenceFingerprint:expectedFingerprint,
          onTime:decision==='CLOSE'&&current.submittedAt!==null &&
            Date.parse(current.submittedAt)<=Date.parse(current.dueAt)&&current.docsUploadedByDeadline,
          outstandingStockOrPaymentChanged:false,
        },
      },tx);
      return {issueId:id,projectId:issue.projectId,decision,
        onTime:Date.parse(current.submittedAt!)<=Date.parse(current.dueAt)&&current.docsUploadedByDeadline,
        dueAt:current.dueAt};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  }
}
