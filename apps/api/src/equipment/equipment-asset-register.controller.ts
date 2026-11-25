import { Body,Controller,Get,Header,Param,ParseUUIDPipe,Post,Req,UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { EquipmentAssetRegisterService } from './equipment-asset-register.service';

@Controller('equipment/register/:id/asset')
export class EquipmentAssetRegisterController {
 constructor(private readonly assets:EquipmentAssetRegisterService){}
 @Get()
 @Header('Cache-Control','private, no-store')
 @UseGuards(AuthGuard,PermissionGuard)
 @RequirePermissions('equipment.equipment.view')
 async read(@Req() r:AuthenticatedRequest,@Param('id',new ParseUUIDPipe({version:'4'})) id:string){
  return {data:await this.assets.read(r.auth!,id)};
 }
 @Post()
 @Header('Cache-Control','private, no-store')
 @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
 @RequirePermissions('equipment.equipment.view','equipment.equipment.manage')
 async set(@Req() r:AuthenticatedRequest,@Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
  return {data:await this.assets.set({auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})},id,body)};
 }
}
