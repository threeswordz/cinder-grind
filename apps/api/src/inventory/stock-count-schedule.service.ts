import {
  ConflictException,ForbiddenException,Injectable,UnprocessableEntityException,
} from '@nestjs/common';
import {Prisma} from '@prisma/client';
import {AuditService} from '../audit/audit.service';
import {AuthenticatedUserContext} from '../auth/auth.types';
import {PrismaService} from '../prisma/prisma.service';
import {ProjectAccessService} from '../projects/project-access.service';
import {
  countScheduleContract,countScheduleDay,nextScheduledCountDate,
  replayCountSchedules,STOCK_COUNT_SCHEDULE_ENTITY,STOCK_COUNT_SCHEDULE_SET,
} from './stock-count-schedule-contract';

type Tx=Prisma.TransactionClient;
type Db=Tx|PrismaService;
type Context={auth:AuthenticatedUserContext;correlationId?:string};
const conflict=(code:string):never=>{throw new ConflictException({code});};
const forbidden=(code:string):never=>{throw new ForbiddenException({code});};
const invalid=(code:string):never=>{throw new UnprocessableEntityException({code});};

@Injectable()
export class StockCountScheduleService{
  constructor(
    private readonly prisma:PrismaService,
    private readonly access:ProjectAccessService,
    private readonly audit:AuditService,
  ){}

  private async liveActor(auth:AuthenticatedUserContext,db:Db,edit:boolean){
    const session=await db.userSession.findFirst({
      where:{
        id:auth.sessionId,userId:auth.userId,revokedAt:null,expiresAt:{gt:new Date()},
        user:{companyId:auth.companyId,isActive:true,company:{isActive:true}},
      },
      select:{user:{select:{
        employee:{select:{companyId:true,isActive:true}},
        userRoles:{select:{role:{select:{
          companyId:true,isActive:true,roleCode:true,
          rolePermissions:{select:{permission:{select:{permissionCode:true}}}},
        }}}},
      }}},
    });
    const roles=session?.user.userRoles.filter(x=>x.role.isActive&&x.role.companyId===auth.companyId)
      .map(x=>x.role)??[];
    const permissions=new Set(roles.flatMap(x=>x.rolePermissions.map(p=>p.permission.permissionCode)));
    if(!session||!session.user.employee?.isActive||
      session.user.employee.companyId!==auth.companyId||
      !roles.some(r=>edit?r.roleCode==='FINANCE_MANAGER':
        ['FINANCE_MANAGER','PROJECT_MANAGER','STOREKEEPER'].includes(r.roleCode))||
      !auth.permissions.includes('inventory.stock_count.view')||
      !permissions.has('inventory.stock_count.view'))
      return forbidden('COUNT_SCHEDULE_LIVE_PERMISSION_DENIED');
    return {
      ...auth,roleCodes:roles.map(r=>r.roleCode),
      // Scope checks must not retain revoked projects.access_all.
      permissions:[...permissions].filter(p=>auth.permissions.includes(p)),
    };
  }

  private async site(auth:AuthenticatedUserContext,projectId:string,warehouseId:string,db:Db){
    await this.access.assertAccess(auth,projectId,db);
    const warehouse=await db.warehouse.findFirst({
      where:{id:warehouseId,companyId:auth.companyId,projectId,isActive:true,
        isSiteWarehouse:true,project:{isActive:true}},
      select:{id:true,projectId:true,warehouseCode:true,warehouseName:true},
    });
    if(!warehouse)return invalid('COUNT_SCHEDULE_ACTIVE_SITE_WAREHOUSE_REQUIRED');
    return warehouse;
  }

  private async scheduleEvents(auth:AuthenticatedUserContext,warehouseId:string,db:Db){
    const rows=await db.auditLog.findMany({
      where:{companyId:auth.companyId,entityType:STOCK_COUNT_SCHEDULE_ENTITY,
        entityId:warehouseId,action:STOCK_COUNT_SCHEDULE_SET},
      select:{id:true,action:true,actorUserId:true,occurredAt:true,newValues:true},
      take:5001,
    });
    if(rows.length>5000)return conflict('COUNT_SCHEDULE_HISTORY_LIMIT');
    try{
      const result=replayCountSchedules(rows);
      if(result.some(state=>state.warehouseId!==warehouseId))
        return conflict('COUNT_SCHEDULE_SCOPE_TAMPERED');
      return result;
    }catch{
      return conflict('COUNT_SCHEDULE_AUDIT_CHAIN_INVALID');
    }
  }

  async read(auth:AuthenticatedUserContext,projectId:string,warehouseId:string,asOfDate:string){
    if(!countScheduleDay(asOfDate))return invalid('COUNT_SCHEDULE_AS_OF_DATE_REQUIRED');
    const currentAuth=await this.liveActor(auth,this.prisma,false);
    const site=await this.site(currentAuth,projectId,warehouseId,this.prisma);
    const states=await this.scheduleEvents(currentAuth,warehouseId,this.prisma);
    if(states.some(state=>state.projectId!==projectId))
      return conflict('COUNT_SCHEDULE_PROJECT_SCOPE_TAMPERED');
    return {
      projectId,warehouseId,warehouseCode:site.warehouseCode,asOfDate,
      schedules:states.map(state=>({
        ...state,
        nextDueDate:state.status==='ACTIVE'
          ?nextScheduledCountDate(state.firstDueDate,state.intervalDays,asOfDate):null,
      })),
      // Scheduling is not a completed-count receipt or financial posting.
      completedPhysicalCountsAssessed:false,financeWriteOffAuthorized:false,
    };
  }

  async set(context:Context,projectId:string,warehouseId:string,input:unknown,
    expectedPreviousEventId:string|null){
    let body:ReturnType<typeof countScheduleContract>;
    try{body=countScheduleContract(input);}
    catch{return invalid('COUNT_SCHEDULE_INVALID_CONFIGURATION');}
    return this.prisma.$transaction(async tx=>{
      const currentAuth=await this.liveActor(context.auth,tx,true);
      await this.site(currentAuth,projectId,warehouseId,tx);
      // A schedule is for a real material category in the company master.
      // Null targets explicitly unclassified materials, not ALL materials.
      const available=await tx.material.count({
        where:{companyId:currentAuth.companyId,isActive:true,
          materialCategory:body.materialCategory},
      });
      if(!available)return invalid('COUNT_SCHEDULE_CATEGORY_NOT_IN_MASTER');
      // Do not allow concurrent updates to append two alternative versions.
      // The same key locks independently for each site/category.
      const mutex='stock-count-schedule:'+currentAuth.companyId+':'+warehouseId+':'+
        (body.materialCategory??'<UNCATEGORIZED>');
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))',mutex);
      const rows=await this.scheduleEvents(currentAuth,warehouseId,tx);
      if(rows.some(state=>state.projectId!==projectId))
        return conflict('COUNT_SCHEDULE_PROJECT_SCOPE_TAMPERED');
      const prior=rows.find(state=>state.materialCategory===body.materialCategory)??null;
      if(expectedPreviousEventId!==(prior?.lastEventId??null))
        return conflict('COUNT_SCHEDULE_STALE_VERSION');
      const version=(prior?.version??0)+1;
      await this.audit.record({
        ...context,auth:currentAuth,entityType:STOCK_COUNT_SCHEDULE_ENTITY,
        entityId:warehouseId,action:STOCK_COUNT_SCHEDULE_SET,
        newValues:{
          projectId,warehouseId,...body,version,
          previousEventId:prior?.lastEventId??null,
          effect:'SITE_COUNT_CALENDAR_ONLY_NO_QUANTITY_OR_FINANCE',
        },
      },tx);
      return {projectId,warehouseId,materialCategory:body.materialCategory,
        firstDueDate:body.firstDueDate,intervalDays:body.intervalDays,
        status:body.status,version,
        changedByUserId:currentAuth.userId,liveConfigurationOnly:true,
        completedPhysicalCountsAssessed:false,financeWriteOffAuthorized:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});
  }
}
