import {
  Body,Controller,Get,Header,Param,ParseUUIDPipe,Post,Query,Req,UseGuards,
} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {inventoryInvalid,inventoryObject,inventoryUuid} from './inventory-validation';
import {StockCountScheduleService} from './stock-count-schedule.service';

const context=(r:AuthenticatedRequest)=>({
  auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})
});
@Controller('inventory/stock-count-schedules')
export class StockCountScheduleController{
  constructor(private readonly schedules:StockCountScheduleService){}

  @Get('projects/:projectId/sites/:warehouseId')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  read(@Req() r:AuthenticatedRequest,
    @Param('projectId',new ParseUUIDPipe({version:'4'})) projectId:string,
    @Param('warehouseId',new ParseUUIDPipe({version:'4'})) warehouseId:string,
    @Query('asOfDate') asOfDate:unknown){
    if(typeof asOfDate!=='string')inventoryInvalid('asOfDate','Provide YYYY-MM-DD explicitly.');
    return this.schedules.read(r.auth!,projectId,warehouseId,asOfDate as string)
      .then(data=>({data}));
  }

  @Post('projects/:projectId/sites/:warehouseId')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.stock_count.view')
  set(@Req() r:AuthenticatedRequest,
    @Param('projectId',new ParseUUIDPipe({version:'4'})) projectId:string,
    @Param('warehouseId',new ParseUUIDPipe({version:'4'})) warehouseId:string,
    @Body() body:unknown){
    const x=inventoryObject(body);
    const allowed=new Set(['materialCategory','firstDueDate','intervalDays','status',
      'reason','expectedPreviousEventId']);
    if(Object.keys(x).some(key=>!allowed.has(key)) ||
      !Object.prototype.hasOwnProperty.call(x,'expectedPreviousEventId'))
      inventoryInvalid('body','Provide only schedule fields and explicit expectedPreviousEventId.');
    const prev=x.expectedPreviousEventId===null?null:
      inventoryUuid(x.expectedPreviousEventId,'expectedPreviousEventId');
    return this.schedules.set(context(r),projectId,warehouseId,{
      materialCategory:x.materialCategory,firstDueDate:x.firstDueDate,
      intervalDays:x.intervalDays,status:x.status,reason:x.reason,
    },prev).then(data=>({data}));
  }
}
