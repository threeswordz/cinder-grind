import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UnprocessableEntityException } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { parseSchedulingDate, requireSchedulingObject, requiredSchedulingString, validateSchedulingUuid } from './scheduling-validation';
import { ProjectProgressPlanService, WorkPlanLineInput } from './project-progress-plan.service';

const auth = (r: AuthenticatedRequest) => {
 if(!r.auth)throw Error('Authentication context missing');
 return r.auth;
};
const context=(r:AuthenticatedRequest)=>({auth:auth(r),...(r.correlationId?{correlationId:r.correlationId}:{})});
const uid=(input:Record<string,unknown>,field:string)=>validateSchedulingUuid(input[field] as string,field);
function projectId(input:unknown) {const x=requireSchedulingObject(input);return uid(x,'projectId');}
const version=(raw:unknown)=>{
 if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<1)throw new UnprocessableEntityException({code:'FM02_PLAN_VERSION_INVALID'});
 return raw;
};
@Controller('project-progress-plans')
export class ProjectProgressPlanController {
 constructor(private readonly plans:ProjectProgressPlanService){}

 @Get('options')
 @UseGuards(AuthGuard,PermissionGuard)
 @RequirePermissions('schedule.work_plan.prepare')
 async options(@Req() req:AuthenticatedRequest,@Query('projectId',new ParseUUIDPipe({version:'4'})) id:string) {
  return {data:await this.plans.options(auth(req),id)};
 }

 @Get('current')
 @UseGuards(AuthGuard,PermissionGuard)
 @RequirePermissions('schedule.programme.view')
 async current(@Req() req:AuthenticatedRequest,@Query('projectId',new ParseUUIDPipe({version:'4'})) id:string) {
  return {data:await this.plans.current(auth(req),id)};
 }

 @Get()
 @UseGuards(AuthGuard,PermissionGuard)
 @RequirePermissions('schedule.programme.view')
 async list(@Req() req:AuthenticatedRequest,@Query('projectId',new ParseUUIDPipe({version:'4'})) id:string) {
  return {data:await this.plans.list(auth(req),id)};
 }

 @Post('prepare')
 @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
 @RequirePermissions('schedule.work_plan.prepare')
 async prepare(@Req() req:AuthenticatedRequest,@Body() raw:unknown) {
  const body=requireSchedulingObject(raw),id=projectId(body);
  const reason=requiredSchedulingString(body,'reason',2000);
  if(!Array.isArray(body.lines)||body.lines.length<1||body.lines.length>100)throw new UnprocessableEntityException({code:'FM02_PLAN_LINE_COUNT_INVALID'});
  const lines:WorkPlanLineInput[]=body.lines.map((raw:unknown)=>{
   const x=requireSchedulingObject(raw),activityId=uid(x,'activityId');
   const weightPercent=requiredSchedulingString(x,'weightPercent',16);
   if(x.sourceKind!=='QUANTITY'&&x.sourceKind!=='MILESTONE')throw new UnprocessableEntityException({code:'FM02_SOURCE_KIND_INVALID'});
   const sourceKind=x.sourceKind as WorkPlanLineInput['sourceKind'];
   const approvedBudgetRevisionLineId=sourceKind==='QUANTITY'?uid(x,'approvedBudgetRevisionLineId'):undefined;
   return {activityId,weightPercent,sourceKind,...(approvedBudgetRevisionLineId?{approvedBudgetRevisionLineId}:{})};
  });
  return {data:await this.plans.prepare(context(req),{projectId:id,reason,lines})};
 }

 @Post('activity/:activityId/quantity')
 @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
 @RequirePermissions('schedule.progress.record')
 async quantity(@Req() req:AuthenticatedRequest,@Param('activityId',new ParseUUIDPipe({version:'4'})) activityId:string,
   @Body() raw:unknown) {
  const body=requireSchedulingObject(raw);
  return {data:await this.plans.recordQuantity(context(req),activityId,{
   progressDate:parseSchedulingDate(body.progressDate,'progressDate'),
   completedQuantity:requiredSchedulingString(body,'completedQuantity',32),
   note:requiredSchedulingString(body,'note',10000),
  })};
 }

 @Post(':id/confirm')
 @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
 @RequirePermissions('schedule.work_plan.confirm')
 async confirm(@Req() req:AuthenticatedRequest,@Param('id',new ParseUUIDPipe({version:'4'})) id:string,
   @Body() raw:unknown) {
  const body=requireSchedulingObject(raw);
  return {data:await this.plans.confirm(context(req),id,version(body.expectedVersion))};
 }
}
