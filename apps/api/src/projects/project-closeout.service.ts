import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from './project-access.service';
import {
  BEN_CLOSEOUT_SIGN, CLOSEOUT_ENTITY, NANCY_CLOSEOUT_SIGN, PREPARE_CLOSEOUT,
  closeoutFingerprint, parseCloseoutEvents, validateCloseoutPreparation,
} from './project-closeout-contract';

type AuditContext={auth:AuthenticatedUserContext;correlationId?:string};
type Db=Prisma.TransactionClient;
const actions=[PREPARE_CLOSEOUT,BEN_CLOSEOUT_SIGN,NANCY_CLOSEOUT_SIGN];
const err=(code:string,detail:string)=>({code,detail});
function closureViewer(auth:AuthenticatedUserContext){
  return auth.permissions.includes('projects.project.view')&&
    auth.roleCodes.some(role=>['PROJECT_MANAGER','MANAGEMENT','FINANCE_MANAGER'].includes(role));
}
function preparer(auth:AuthenticatedUserContext){
  return auth.roleCodes.includes('PROJECT_MANAGER')&&
    auth.permissions.includes('projects.project.edit');
}
function reviewer(auth:AuthenticatedUserContext):'BEN'|'NANCY'|null {
  const ben=auth.roleCodes.includes('MANAGEMENT');
  const nancy=auth.roleCodes.includes('FINANCE_MANAGER');
  if(ben===nancy||!auth.permissions.includes('projects.project.view'))return null;
  return ben?'BEN':'NANCY';
}
function noteValue(v:unknown,required:boolean){
  if(typeof v!=='string'||v.trim().length>(1000)||required&&v.trim().length<8)
    throw new UnprocessableEntityException(err('BEN04_SIGN_NOTE_INVALID',
      'A reasoned note up to 1000 characters is required when unresolved obligations remain.'));
  return v.trim();
}

@Injectable()
export class ProjectCloseoutService {
  constructor(
    private readonly prisma:PrismaService,
    private readonly access:ProjectAccessService,
    private readonly audit:AuditService,
  ) {}

  private async current(auth:AuthenticatedUserContext,projectId:string,db:Db) {
    const records=await db.auditLog.findMany({
      where:{companyId:auth.companyId,entityType:CLOSEOUT_ENTITY,
        entityId:projectId,action:{in:actions}},
      orderBy:[{occurredAt:'asc'},{id:'asc'}],
      select:{id:true,action:true,actorUserId:true,occurredAt:true,newValues:true},
    });
    return parseCloseoutEvents(records,projectId);
  }

  async get(auth:AuthenticatedUserContext,projectId:string) {
    if(!closureViewer(auth))
      throw new ForbiddenException(err('BEN04_ROLE_VIEW_DENIED',
        'Operational closeout detail is restricted to the scoped Project Manager, Ben and Nancy.'));
    await this.access.assertAccess(auth,projectId);
    const project=await this.prisma.project.findFirst({
      where:{id:projectId,companyId:auth.companyId},
      select:{id:true,projectCode:true,projectName:true,isActive:true},
    });
    if(!project)throw new NotFoundException(err('BEN04_PROJECT_MISSING','Project not found.'));
    const result=await this.current(auth,projectId,this.prisma);
    return {...result,project,authority:'OPERATIONAL_ONLY_NO_ARCHIVE_OR_FINANCIAL_SETTLEMENT' as const,
      canPrepare:preparer(auth)&&project.isActive,
      canSignBen:reviewer(auth)==='BEN'&&project.isActive,
      canSignNancy:reviewer(auth)==='NANCY'&&project.isActive};
  }

  async prepare(context:AuditContext,projectId:string,body:unknown) {
    if(!preparer(context.auth))
      throw new ForbiddenException(err('BEN04_KHAIMOOK_REQUIRED',
        'Only an authorized assigned Project Manager may prepare the six-category closeout.'));
    await this.prisma.$transaction(async tx=>{
      await this.access.assertAccess(context.auth,projectId,tx);
      const project=await tx.project.findFirst({
        where:{id:projectId,companyId:context.auth.companyId},select:{id:true,isActive:true},
      });
      if(!project?.isActive)
        throw new ConflictException(err('BEN04_PROJECT_INACTIVE','Archived projects cannot start operational closure.'));
      // Serialize preparation/revision and signatures on the same Project row.
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const before=await this.current(context.auth,projectId,tx);
      let preparation;
      try {preparation=validateCloseoutPreparation(body,Boolean(before.current));}
      catch(e) {
        throw new UnprocessableEntityException(err(
          e instanceof RangeError?e.message:'BEN04_PREPARATION_INVALID',
          'All six checks require evidence; warnings require remaining items, reason, owner and due date.'));
      }
      const ownerIds=[...new Set(preparation.outstandingItems.map(item=>item.ownerUserId))];
      if(ownerIds.length){
        const owners=await tx.user.findMany({
          where:{id:{in:ownerIds},companyId:context.auth.companyId,isActive:true,
            employee:{is:{companyId:context.auth.companyId,isActive:true}}},
          select:{id:true},
        });
        if(owners.length!==ownerIds.length)
          throw new UnprocessableEntityException(err('BEN04_OWNER_SCOPE_INVALID',
            'Every outstanding item owner must be an active Employee in this Company.'));
      }
      const version=(before.current?.version??0)+1;
      const fingerprint=closeoutFingerprint({
        projectId,version,preparedBy:context.auth.userId,preparation,
      });
      await this.audit.record({
        ...context,entityType:CLOSEOUT_ENTITY,entityId:projectId,action:PREPARE_CLOSEOUT,
        newValues:{
          projectId,version,preparedBy:context.auth.userId,preparation,
          previousEventId:before.current?.eventId??null,
          fingerprint,
          purpose:'OPERATIONAL_CLOSURE_REVIEW_ONLY_NOT_ARCHIVE_OR_PAYMENT',
        },
      },tx);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return this.get(context.auth,projectId);
  }

  async sign(
    context:AuditContext,projectId:string,expectedFingerprint:string,noteInput:unknown,
  ) {
    const role=reviewer(context.auth);
    if(!role)
      throw new ForbiddenException(err('BEN04_REVIEW_ROLE_REQUIRED',
        'Ben and Nancy must independently sign from their respective configured functions.'));
    if(!/^[a-f0-9]{64}$/.test(expectedFingerprint))
      throw new UnprocessableEntityException(err('BEN04_FINGERPRINT_REQUIRED',
        'Refresh the current prepared checklist and provide its fingerprint.'));
    await this.prisma.$transaction(async tx=>{
      await this.access.assertAccess(context.auth,projectId,tx);
      const project=await tx.project.findFirst({
        where:{id:projectId,companyId:context.auth.companyId},
        select:{id:true,isActive:true},
      });
      if(!project?.isActive)
        throw new ConflictException(err('BEN04_PROJECT_INACTIVE','Cannot sign an archived Project.'));
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId}::uuid FOR UPDATE`;
      const state=await this.current(context.auth,projectId,tx);
      const current=state.current;
      if(!current||current.fingerprint!==expectedFingerprint)
        throw new ConflictException(err('BEN04_STALE_PREPARATION',
          'The six-category preparation has changed. Refresh before signing.'));
      if(current.preparedBy===context.auth.userId)
        throw new ForbiddenException(err('BEN04_SELF_APPROVAL_DENIED',
          'The Project preparer cannot sign as Ben or Nancy.'));
      if(current.signatures[role]||Object.values(current.signatures).some(s=>s?.userId===context.auth.userId))
        throw new ConflictException(err('BEN04_DUPLICATE_SIGNATURE',
          'This actor or role has already signed the exact preparation.'));
      const hasWarnings=current.preparation.outstandingItems.length>0;
      const note=noteValue(noteInput,hasWarnings);
      await this.audit.record({
        ...context,entityType:CLOSEOUT_ENTITY,entityId:projectId,
        action:role==='BEN'?BEN_CLOSEOUT_SIGN:NANCY_CLOSEOUT_SIGN,
        newValues:{
          projectId,preparationEventId:current.eventId,preparedBy:current.preparedBy,
          fingerprint:expectedFingerprint,note,
          outstandingCount:current.preparation.outstandingItems.length,
          meaning:'JOINT_OPERATIONAL_SIGNOFF_NOT_FINANCIAL_SETTLEMENT_OR_ARCHIVE',
        },
      },tx);
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return this.get(context.auth,projectId);
  }
}
