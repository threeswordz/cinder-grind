import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';

type Ctx={auth:AuthenticatedUserContext;correlationId?:string};
@Injectable()
export class WbsService {
 constructor(private readonly prisma:PrismaService,private readonly access:ProjectAccessService,private readonly audit:AuditService){}
 async projects(auth:AuthenticatedUserContext){const scope=await this.access.scopeWhere(auth);return this.prisma.project.findMany({where:{...scope,isActive:true},select:{id:true,projectCode:true,projectName:true},orderBy:{projectName:'asc'}});}
 async listWbs(auth:AuthenticatedUserContext,projectId:string){await this.access.assertAccess(auth,projectId);return this.prisma.wbsElement.findMany({where:{projectId},orderBy:[{wbsCode:'asc'}]});}
 async createWbs(ctx:Ctx,projectId:string,data:{parentId?:string|null;wbsCode:string;wbsName:string;description?:string|null}){
  try{return await this.prisma.$transaction(async tx=>{await this.access.assertAccess(ctx.auth,projectId,tx);if(data.parentId)await this.assertParent(tx,projectId,data.parentId);
   const row=await tx.wbsElement.create({data:{projectId,...data}});await this.audit.record({...ctx,entityType:'WBS',entityId:row.id,action:'CREATE',newValues:row},tx);return row;});}
  catch(e){this.duplicate(e,'WBS code is already in use for this Project.');throw e;}
 }
 async updateWbs(ctx:Ctx,projectId:string,id:string,data:{parentId?:string|null;wbsCode?:string;wbsName?:string;description?:string|null}){
  try{return await this.prisma.$transaction(async tx=>{await this.access.assertAccess(ctx.auth,projectId,tx);const before=await tx.wbsElement.findFirst({where:{id,projectId}});if(!before)throw new NotFoundException({code:'WBS_NOT_FOUND',detail:'WBS element not found.'});
   if(data.parentId===id)throw new UnprocessableEntityException({code:'WBS_INVALID_PARENT',detail:'A WBS element cannot be its own parent.'});
   if(data.parentId){await this.assertParent(tx,projectId,data.parentId);await this.assertNoCycle(tx,projectId,id,data.parentId);}
   const row=await tx.wbsElement.update({where:{id},data});await this.audit.record({...ctx,entityType:'WBS',entityId:id,action:'UPDATE',oldValues:before,newValues:row},tx);return row;});}
  catch(e){this.duplicate(e,'WBS code is already in use for this Project.');throw e;}
 }
 async setWbsActive(ctx:Ctx,projectId:string,id:string,isActive:boolean){return this.prisma.$transaction(async tx=>{await this.access.assertAccess(ctx.auth,projectId,tx);const before=await tx.wbsElement.findFirst({where:{id,projectId}});if(!before)throw new NotFoundException({code:'WBS_NOT_FOUND',detail:'WBS element not found.'});const row=await tx.wbsElement.update({where:{id},data:{isActive}});await this.audit.record({...ctx,entityType:'WBS',entityId:id,action:isActive?'REACTIVATE':'ARCHIVE',oldValues:before,newValues:row},tx);return row;});}
 async listCostCodes(auth:AuthenticatedUserContext,search?:string,active?:boolean){return this.prisma.costCode.findMany({where:{companyId:auth.companyId,...(active!==undefined?{isActive:active}:{}),...(search?{OR:[{costCode:{contains:search,mode:'insensitive'}},{costName:{contains:search,mode:'insensitive'}}]}:{})},orderBy:[{costCode:'asc'}]});}
 async createCostCode(ctx:Ctx,data:{costCode:string;costName:string;description?:string|null}){try{return await this.prisma.$transaction(async tx=>{const row=await tx.costCode.create({data:{companyId:ctx.auth.companyId,...data}});await this.audit.record({...ctx,entityType:'COST_CODE',entityId:row.id,action:'CREATE',newValues:row},tx);return row;});}catch(e){this.duplicate(e,'Cost Code is already in use.');throw e;}}
 async updateCostCode(ctx:Ctx,id:string,data:{costCode?:string;costName?:string;description?:string|null}){try{return await this.prisma.$transaction(async tx=>{const before=await tx.costCode.findFirst({where:{id,companyId:ctx.auth.companyId}});if(!before)throw new NotFoundException({code:'COST_CODE_NOT_FOUND',detail:'Cost Code not found.'});const row=await tx.costCode.update({where:{id},data});await this.audit.record({...ctx,entityType:'COST_CODE',entityId:id,action:'UPDATE',oldValues:before,newValues:row},tx);return row;});}catch(e){this.duplicate(e,'Cost Code is already in use.');throw e;}}
 async setCostCodeActive(ctx:Ctx,id:string,isActive:boolean){return this.prisma.$transaction(async tx=>{const before=await tx.costCode.findFirst({where:{id,companyId:ctx.auth.companyId}});if(!before)throw new NotFoundException({code:'COST_CODE_NOT_FOUND',detail:'Cost Code not found.'});const row=await tx.costCode.update({where:{id},data:{isActive}});await this.audit.record({...ctx,entityType:'COST_CODE',entityId:id,action:isActive?'REACTIVATE':'ARCHIVE',oldValues:before,newValues:row},tx);return row;});}
 private async assertNoCycle(tx:Prisma.TransactionClient,projectId:string,id:string,parentId:string){let current:string|null=parentId;const seen=new Set<string>();while(current){if(current===id)throw new UnprocessableEntityException({code:'WBS_HIERARCHY_CYCLE',detail:'WBS hierarchy cannot contain a cycle.'});if(seen.has(current))throw new UnprocessableEntityException({code:'WBS_HIERARCHY_CYCLE',detail:'WBS hierarchy cannot contain a cycle.'});seen.add(current);const row: { parentId: string | null } | null = await tx.wbsElement.findFirst({where:{id:current,projectId},select:{parentId:true}});current=row?.parentId??null;}}
 private async assertParent(tx:Prisma.TransactionClient,projectId:string,parentId:string){const p=await tx.wbsElement.findFirst({where:{id:parentId,projectId}});if(!p)throw new UnprocessableEntityException({code:'WBS_PARENT_PROJECT_MISMATCH',detail:'Parent WBS must belong to the same Project.'});}
 private duplicate(error:unknown,detail:string){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')throw new ConflictException({code:'DUPLICATE_CODE',detail});}
}
