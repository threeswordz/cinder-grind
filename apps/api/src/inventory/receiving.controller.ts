import {Body,Controller,Get,Param,ParseUUIDPipe,Post,Query,Req,UseGuards} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {inventoryUuid} from './inventory-validation';
import {ReceivingService} from './receiving.service';
const uuid=()=>new ParseUUIDPipe({version:'4'});
const context=(r:AuthenticatedRequest)=>({auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})});
@Controller('inventory/receiving')
@UseGuards(AuthGuard,PermissionGuard)
export class ReceivingController{
 constructor(private readonly service:ReceivingService){}
 @Get('projects') @RequirePermissions('inventory.receiving.view')
 async projects(@Req() r:AuthenticatedRequest){return {data:await this.service.projects(r.auth!)};}
 @Get('projects/:id/policy') @RequirePermissions('inventory.receiving.view')
 async policy(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string){return {data:await this.service.policy(r.auth!,id)};}
 @Post('projects/:id/enable') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.configure')
 async enable(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.enable(context(r),id,value)};}
 @Get('projects/:id/choices/:kind') @RequirePermissions('inventory.receiving.view')
 async choices(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Param('kind') kind:string,@Query('after') after?:unknown){return {data:await this.service.choices(r.auth!,id,kind,after===undefined?undefined:inventoryUuid(after,'after'))};}
 @Get('projects/:id/deliveries') @RequirePermissions('inventory.receiving.view')
 async list(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Query('after') after?:unknown){return {data:await this.service.list(r.auth!,id,after===undefined?undefined:inventoryUuid(after,'after'))};}
 @Get('deliveries/:id') @RequirePermissions('inventory.receiving.view')
 async get(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string){return {data:await this.service.get(r.auth!,id)};}
 @Post('deliveries') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.capture')
 async capture(@Req() r:AuthenticatedRequest,@Body() value:unknown){return {data:await this.service.capture(context(r),value)};}
 @Post('deliveries/:id/revise') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.edit')
 async revise(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.revise(context(r),id,value)};}
 @Post('deliveries/:id/link-po') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.link_po','inventory.receipt.view')
 async link(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.link(context(r),id,value)};}
 @Post('deliveries/:id/evidence') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.edit','documents.document.view')
 async evidence(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.attach(context(r),id,value)};}
 @Post('deliveries/:id/check') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.check','inventory.receipt.view','documents.document.view')
 async check(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.check(context(r),id,value)};}
 @Post('deliveries/:id/void') @UseGuards(CsrfGuard) @RequirePermissions('inventory.receiving.view','inventory.receiving.edit')
 async void(@Req() r:AuthenticatedRequest,@Param('id',uuid()) id:string,@Body() value:unknown){return {data:await this.service.void(context(r),id,value)};}
}
