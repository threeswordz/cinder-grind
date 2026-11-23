import {
  Body,Controller,Get,Header,Param,ParseUUIDPipe,Post,Req,UseGuards,
} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {inventoryInvalid,inventoryObject,inventoryUuid,requiredInventoryString} from './inventory-validation';
import {StockLossCaseService} from './stock-loss-case.service';
const context=(r:AuthenticatedRequest)=>({
  auth:r.auth!,...(r.correlationId?{correlationId:r.correlationId}:{})
});
const strict=(body:unknown,keys:readonly string[])=>{
  const x=inventoryObject(body);
  if(Object.keys(x).some(k=>!keys.includes(k)))
    inventoryInvalid('body','Unexpected SS13 field.');
  return x;
};
@Controller('inventory/stock-loss-cases')
export class StockLossCaseController{
  constructor(private readonly cases:StockLossCaseService){}

  @Post()
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.stock.view','documents.document.view')
  open(@Req() r:AuthenticatedRequest,@Body() body:unknown){
    return this.cases.open(context(r),body).then(data=>({data}));
  }
  @Get(':id')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('inventory.stock.view','documents.document.view')
  get(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string){
    return this.cases.read(r.auth!,id).then(data=>({data}));
  }
  @Post(':id/pm-screen')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.stock.view','documents.document.view')
  screen(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const x=strict(body,['expectedPreviousEventId','decision','escalateToBen','note']);
    if(x.decision!=='RETURN'&&x.decision!=='NONDISPOSAL_REVIEW'&&x.decision!=='FORWARD_DISPOSAL')
      inventoryInvalid('decision','Use RETURN, NONDISPOSAL_REVIEW or FORWARD_DISPOSAL.');
    if(typeof x.escalateToBen!=='boolean')
      inventoryInvalid('escalateToBen','A deliberate true or false decision is required.');
    return this.cases.screen(context(r),id,
      inventoryUuid(x.expectedPreviousEventId,'expectedPreviousEventId'),
      x.decision as 'RETURN'|'NONDISPOSAL_REVIEW'|'FORWARD_DISPOSAL',
      x.escalateToBen as boolean,requiredInventoryString(x,'note',2000)).then(data=>({data}));
  }
  @Post(':id/ben-review')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.stock.view','documents.document.view')
  benReview(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const x=strict(body,['expectedPreviousEventId','note']);
    return this.cases.benReview(context(r),id,
      inventoryUuid(x.expectedPreviousEventId,'expectedPreviousEventId'),
      requiredInventoryString(x,'note',2000)).then(data=>({data}));
  }
  @Post(':id/nancy-decision')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.stock.view','documents.document.view')
  nancyDecision(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const x=strict(body,['expectedPreviousEventId','decision','note']);
    if(x.decision!=='APPROVE_PROPOSAL'&&x.decision!=='REJECT_PROPOSAL')
      inventoryInvalid('decision','Use APPROVE_PROPOSAL or REJECT_PROPOSAL.');
    return this.cases.nancyDecision(context(r),id,
      inventoryUuid(x.expectedPreviousEventId,'expectedPreviousEventId'),
      x.decision as 'APPROVE_PROPOSAL'|'REJECT_PROPOSAL',
      requiredInventoryString(x,'note',2000)).then(data=>({data}));
  }
}
