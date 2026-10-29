import { Controller, Get, Header, Param, ParseUUIDPipe, Query, Req, StreamableFile, UnprocessableEntityException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PROJECT_SUMMARY_VIEW, ProjectSummaryService } from './project-summary.service';

function noFilters(query: Record<string,unknown>) {
  if(Object.keys(query).length) throw new UnprocessableEntityException({code:'PROJECT_SUMMARY_FILTER_DENIED',detail:'This summary supports whole Projects only; filters are not supported.'});
}
const csv=(value:string)=>'"'+(/^(?:[\t\r\n]|\s*[=+\-@])/.test(value)?"'":'')+value.replaceAll('"','""')+'"';

@Controller('budget/summary')
@UseGuards(AuthGuard,PermissionGuard)
@RequirePermissions(PROJECT_SUMMARY_VIEW)
export class ProjectSummaryController {
  constructor(private readonly service:ProjectSummaryService) {}
  @Get('projects') @Header('Cache-Control','private, no-store')
  async projects(@Req() r:AuthenticatedRequest,@Query() query:Record<string,unknown>){noFilters(query);return {data:await this.service.projects(r.auth!)};}
  @Get('projects/:projectId') @Header('Cache-Control','private, no-store')
  async summary(@Req() r:AuthenticatedRequest,@Param('projectId',new ParseUUIDPipe({version:'4'})) p:string,@Query() query:Record<string,unknown>){noFilters(query);return {data:await this.service.summary(r.auth!,p.toLowerCase())};}
  @Get('projects/:projectId/export') @Header('Cache-Control','private, no-store')
  @Header('Content-Type','text/csv; charset=utf-8') @Header('Content-Disposition','attachment; filename="project-summary.csv"')
  async export(@Req() r:AuthenticatedRequest,@Param('projectId',new ParseUUIDPipe({version:'4'})) p:string,@Query() query:Record<string,unknown>){
    noFilters(query);const s=await this.service.summary(r.auth!,p.toLowerCase());
    const rows=[['Project code','Project name','Currency','Contract including active approved variations','Billed: approved Client Invoices','Received: approved non-cancelled inbound Payments'],
      [s.project.projectCode,s.project.projectName,s.currencyCode,s.contractAmount,s.billedAmount,s.receivedAmount]];
    return new StreamableFile(Buffer.from('\uFEFF'+rows.map(row=>row.map(csv).join(',')).join('\r\n')+'\r\n','utf8'));
  }
}
