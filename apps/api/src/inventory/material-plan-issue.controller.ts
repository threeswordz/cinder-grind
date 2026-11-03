import {Body,Controller,Get,Header,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {MaterialPlanIssueService} from './material-plan-issue.service';
const context=(r:AuthenticatedRequest)=>({auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})});
@Controller('inventory/material-plan-issues')
export class MaterialPlanIssueController{
 constructor(private readonly service:MaterialPlanIssueService){}
 @Get('projects/:id/policy') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view')
 policy(@Req() r:AuthenticatedRequest,@Param('id') id:string){return this.service.policy(r.auth!,id).then(data=>({data}));}
 @Post('projects/:id/enable') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.material_plan.prototype.enable')
 enable(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.enable(context(r),id,body).then(data=>({data}));}
 @Get('issues/:id') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view')
 history(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Query('after') after?:string){return this.service.history(r.auth!,id,after).then(data=>({data}));}
 @Post('issues/:id/preview') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view')
 preview(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.preview(r.auth!,id,body).then(data=>({data}));}
 @Post('issues/:id/within-plan') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view','inventory.material_plan.issue.post')
 post(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.withinPlan(context(r),id,body).then(data=>({data}));}
 @Post('issues/:id/overage') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view','inventory.material_plan.issue.post')
 submit(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.submitOverage(context(r),id,body).then(data=>({data}));}
 @Post('authorizations/:id/review') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view','inventory.material_plan.overage.review')
 review(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.decide(context(r),id,body,'REVIEW').then(data=>({data}));}
 @Post('authorizations/:id/decision') @Header('Cache-Control','private, no-store') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.issue.view','inventory.material_plan.overage.approve')
 decide(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.decide(context(r),id,body,'DECIDE').then(data=>({data}));}
}
