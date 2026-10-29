import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Post, Req, UseGuards, StreamableFile } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { budgetInteger, budgetObject, budgetString } from './budget-validation';
import { CustomerBoqService } from './customer-boq.service';
import { canonicalUuid, customerDraft, exactKeys } from './customer-boq-validation';
const context = (r: AuthenticatedRequest) => ({ auth:r.auth!, ...(r.correlationId ? {correlationId:r.correlationId}: {}) });
const uuid = () => new ParseUUIDPipe({ version:'4' });
const scope = (p: string) => p.toLowerCase();
const csv = (v: unknown) => {let text = String(v ?? ''); if (/^(?:[\t\r\n]|\s*[=+\-@])/.test(text)) text = "'"+text; return '"'+text.replaceAll('"','""')+'"';};

@Controller('budget/customer')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view')
export class CustomerBoqController {
  constructor(private readonly service: CustomerBoqService) {}
  @Get('projects') @Header('Cache-Control','private, no-store')
  async projects(@Req() r: AuthenticatedRequest) {return {data:await this.service.projects(r.auth!)};}
  @Get('projects/:projectId/options') @Header('Cache-Control','private, no-store')
  async options(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string){return{data:await this.service.options(r.auth!,scope(p))};}
  @Get('projects/:projectId/versions') @Header('Cache-Control','private, no-store')
  async list(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string){return{data:await this.service.list(r.auth!,scope(p))};}
  @Get('projects/:projectId/versions/:id') @Header('Cache-Control','private, no-store')
  async history(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Param('id',uuid()) id:string){return{data:await this.service.history(r.auth!,scope(p),scope(id))};}
  @Get('projects/:projectId/versions/:id/export') @Header('Cache-Control','private, no-store') @Header('Content-Type','text/csv; charset=utf-8')
  @Header('Content-Disposition','attachment; filename="customer-boq.csv"')
  async export(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Param('id',uuid()) id:string){
    const {version:v}=await this.service.history(r.auth!,scope(p),scope(id));
    const e=v.edits.find((e)=>e.editNo===v.currentEditNo)!;
    const lines=[['Version','State','Edit','Source revision','Description','Quantity','UOM','Rate','Amount','Currency'],
      ...e.lines.map(l=>[v.versionNo,v.approvalInstance?.approvalState??'DRAFT',e.editNo,v.sourceRevisionId,l.description,l.quantity.toFixed(4),
        (l.uomSnapshot as {code:string}).code,l.rate.toFixed(4),l.amount.toFixed(2),v.currencyCode])];
    return new StreamableFile(Buffer.from('\uFEFF'+lines.map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n','utf8'));
  }
  @Post('projects/:projectId/preview') @UseGuards(CsrfGuard) @RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage')
  async preview(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Body() value:unknown){const b=budgetObject(value);exactKeys(b,['draft','versionId']);return{data:await this.service.preview(context(r),scope(p),customerDraft(b.draft),b.versionId!==undefined?canonicalUuid(b.versionId,'versionId'):undefined)};}
  @Post('projects/:projectId/versions') @UseGuards(CsrfGuard) @RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage')
  async create(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Body() value:unknown){const b=budgetObject(value);exactKeys(b,['requestId','draft']);return{data:await this.service.create(context(r),scope(p),canonicalUuid(b.requestId,'requestId'),customerDraft(b.draft))};}
  @Post('projects/:projectId/versions/:id/edit') @UseGuards(CsrfGuard) @RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.manage')
  async edit(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Param('id',uuid()) id:string,@Body() value:unknown){const b=budgetObject(value);exactKeys(b,['requestId','expectedEditNo','draft']);return{data:await this.service.edit(context(r),scope(p),canonicalUuid(b.requestId,'requestId'),scope(id),budgetInteger(b.expectedEditNo,'expectedEditNo'),customerDraft(b.draft))};}
  @Post('projects/:projectId/versions/:id/submit') @UseGuards(CsrfGuard) @RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.submit')
  async submit(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Param('id',uuid()) id:string,@Body() value:unknown){const b=budgetObject(value);exactKeys(b,['requestId','expectedEditNo','workflowCode']);return{data:await this.service.submit(context(r),scope(p),canonicalUuid(b.requestId,'requestId'),scope(id),budgetInteger(b.expectedEditNo,'expectedEditNo'),budgetString(b,'workflowCode',100))};}
  @Post('projects/:projectId/versions/:id/decision') @UseGuards(CsrfGuard) @RequirePermissions('budget.boq.view','budget.revision.view','budget.customer.view','budget.customer.approve')
  async decide(@Req() r:AuthenticatedRequest,@Param('projectId',uuid()) p:string,@Param('id',uuid()) id:string,@Body() value:unknown){const b=budgetObject(value);exactKeys(b,['requestId','expectedInstanceId','decision','comment']);const d=budgetString(b,'decision',10);
    return{data:await this.service.decide(context(r),scope(p),canonicalUuid(b.requestId,'requestId'),scope(id),canonicalUuid(b.expectedInstanceId,'expectedInstanceId'),d as 'APPROVE'|'REJECT',b.comment===undefined?undefined:budgetString(b,'comment',4000))};}
}
