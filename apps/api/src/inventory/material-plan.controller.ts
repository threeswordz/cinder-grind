import {Body,Controller,Get,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {MaterialPlanService} from './material-plan.service';
const context=(r:AuthenticatedRequest)=>({auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})});
@Controller('inventory/material-plans')
export class MaterialPlanController{
 constructor(private readonly service:MaterialPlanService){}
 @Get('projects') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 projects(@Req() r:AuthenticatedRequest){return this.service.projects(r.auth!).then(data=>({data}));}
 @Get('choices') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 choices(@Req() r:AuthenticatedRequest,@Query('projectId') project:string,@Query('kind') kind:string,@Query('budgetRevisionId') basis?:string,@Query('after') after?:string){return this.service.choices(r.auth!,project,kind,basis,after).then(data=>({data}));}
 @Get() @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 list(@Req() r:AuthenticatedRequest,@Query('projectId') project:string,@Query('after') after?:string){return this.service.list(r.auth!,project,after).then(data=>({data}));}
 @Get(':id') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 get(@Req() r:AuthenticatedRequest,@Param('id') id:string){return this.service.get(r.auth!,id).then(data=>({data}));}
 @Get(':id/revisions') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 history(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Query('after') after?:string){return this.service.history(r.auth!,id,after).then(data=>({data}));}
 @Get(':id/revisions/:revisionId') @UseGuards(AuthGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view')
 revision(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Param('revisionId') revisionId:string){return this.service.revision(r.auth!,id,revisionId).then(data=>({data}));}
 @Post() @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.material_plan.create')
 create(@Req() r:AuthenticatedRequest,@Body() body:unknown){return this.service.create(context(r),body).then(data=>({data}));}
 @Post(':id/revisions') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.material_plan.revise')
 revise(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.revise(context(r),id,body).then(data=>({data}));}
 @Post(':id/submit') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.material_plan.submit')
 submit(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.submit(context(r),id,body).then(data=>({data}));}
 @Post(':id/decision') @UseGuards(AuthGuard,CsrfGuard,PermissionGuard) @RequirePermissions('inventory.material_plan.view','inventory.material_plan.approve')
 decide(@Req() r:AuthenticatedRequest,@Param('id') id:string,@Body() body:unknown){return this.service.decide(context(r),id,body).then(data=>({data}));}
}
