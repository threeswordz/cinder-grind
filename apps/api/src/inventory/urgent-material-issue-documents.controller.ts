import {
  Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import {AuthGuard} from '../auth/auth.guard';
import {CsrfGuard} from '../auth/csrf.guard';
import {AuthenticatedRequest} from '../auth/auth.types';
import {PermissionGuard} from '../authorization/permission.guard';
import {RequirePermissions} from '../authorization/permissions.decorator';
import {
  inventoryInvalid,inventoryObject,inventoryUuid,requiredInventoryString,
} from './inventory-validation';
import {UrgentMaterialIssueDocumentsService} from './urgent-material-issue-documents.service';

const context=(request:AuthenticatedRequest)=>({
  auth:request.auth!,
  ...(request.correlationId?{correlationId:request.correlationId}:{}),
});
function fields(body:unknown,allow:readonly string[]){
  const input=inventoryObject(body);
  if(Object.keys(input).some(key=>!allow.includes(key)))
    inventoryInvalid('body','Unsupported PM09 field: only the documented attributes are accepted.');
  return input;
}

@Controller('inventory/urgent-issue-documents')
export class UrgentMaterialIssueDocumentsController{
  constructor(private readonly urgent:UrgentMaterialIssueDocumentsService){}

  @Get(':id')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,PermissionGuard)
  @RequirePermissions('inventory.issue.view','documents.document.view')
  status(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string){
    return this.urgent.read(r.auth!,id).then(data=>({data}));
  }

  @Post(':id/register')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.issue.view','inventory.issue.create')
  register(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const value=fields(body,['reason']);
    return this.urgent.register(context(r),id,requiredInventoryString(value,'reason',2000))
      .then(data=>({data}));
  }

  @Post(':id/submit')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.issue.view','inventory.issue.create','documents.document.view')
  submit(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const value=fields(body,['documentIds','completionNote']);
    if(!Array.isArray(value.documentIds)||!value.documentIds.length||value.documentIds.length>100)
      inventoryInvalid('documentIds','Provide 1 to 100 canonical linked Document IDs.');
    const documentIds=(value.documentIds as unknown[]).map((raw,i)=>
      inventoryUuid(raw,'documentIds['+i+']'));
    if(new Set(documentIds).size!==documentIds.length)
      inventoryInvalid('documentIds','Duplicate Document IDs are not permitted.');
    return this.urgent.submit(context(r),id,documentIds,
      requiredInventoryString(value,'completionNote',2000)).then(data=>({data}));
  }

  @Post(':id/decision')
  @Header('Cache-Control','private, no-store')
  @UseGuards(AuthGuard,CsrfGuard,PermissionGuard)
  @RequirePermissions('inventory.issue.view','inventory.issue.approve','documents.document.view')
  decide(@Req() r:AuthenticatedRequest,
    @Param('id',new ParseUUIDPipe({version:'4'})) id:string,@Body() body:unknown){
    const value=fields(body,['decision','expectedSubmissionEventId','expectedFingerprint','note']);
    if(value.decision!=='CLOSE'&&value.decision!=='RETURN')
      inventoryInvalid('decision','Use CLOSE or RETURN.');
    const digest=requiredInventoryString(value,'expectedFingerprint',64);
    if(!/^[a-f0-9]{64}$/.test(digest))
      inventoryInvalid('expectedFingerprint','Provide the exact lowercase SHA256 snapshot.');
    return this.urgent.decide(context(r),id,value.decision as 'CLOSE'|'RETURN',
      inventoryUuid(value.expectedSubmissionEventId,'expectedSubmissionEventId'),
      digest,requiredInventoryString(value,'note',2000)).then(data=>({data}));
  }
}
