import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { equipmentDate, equipmentObject, equipmentUuid, requiredEquipmentString } from './equipment-validation';
import { EquipmentCustodyService } from './equipment-custody.service';

function auth(request:AuthenticatedRequest) {
  if (!request.auth) throw new Error('Authentication context missing.');
  return request.auth;
}
function context(request:AuthenticatedRequest) {
  return {auth:auth(request),...(request.correlationId?{correlationId:request.correlationId}:{})};
}

@Controller('equipment/custody')
export class EquipmentCustodyController {
  constructor(private readonly custody:EquipmentCustodyService) {}

  @Get('projects')
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('equipment.custody.view')
  async projects(@Req() request:AuthenticatedRequest) {
    return { data:await this.custody.projects(auth(request)) };
  }

  @Get('borrowers')
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('equipment.custody.view')
  async borrowers(@Req() request:AuthenticatedRequest,@Query('projectId') projectId:string,@Query('on') on:string) {
    return { data:await this.custody.borrowers(auth(request),equipmentUuid(projectId,'projectId'),equipmentDate(on,'on')) };
  }

  @Get()
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('equipment.custody.view')
  async list(@Req() request:AuthenticatedRequest,@Query('projectId') projectId:string,@Query('equipmentId') equipmentId?:string) {
    return { data:await this.custody.list(auth(request),equipmentUuid(projectId,'projectId'),
      equipmentId?equipmentUuid(equipmentId,'equipmentId'):undefined) };
  }

  @Post()
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('equipment.custody.manage')
  async checkout(@Req() request:AuthenticatedRequest,@Body() body:unknown) {
    const input=equipmentObject(body);
    return {data:await this.custody.checkout(context(request),{
      equipmentId:equipmentUuid(input.equipmentId,'equipmentId'),
      projectId:equipmentUuid(input.projectId,'projectId'),
      borrowerEmployeeId:equipmentUuid(input.borrowerEmployeeId,'borrowerEmployeeId'),
      siteLabel:requiredEquipmentString(input,'siteLabel',150),
      issuedOn:equipmentDate(input.issuedOn,'issuedOn'),
      dueOn:equipmentDate(input.dueOn,'dueOn'),
      conditionOut:requiredEquipmentString(input,'conditionOut',300),
    })};
  }

  @Post(':id/return')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('equipment.custody.manage')
  async returnLoan(@Req() request:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown) {
    const input=equipmentObject(body);
    return {data:await this.custody.returnLoan(context(request),id,{
      returnedOn:equipmentDate(input.returnedOn,'returnedOn'),
      conditionIn:requiredEquipmentString(input,'conditionIn',300),
    })};
  }
}
