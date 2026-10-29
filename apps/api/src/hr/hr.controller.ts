import { Body, Controller, Get, Param, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { HrService } from './hr.service';
import * as input from './hr-input';

function auth(request: AuthenticatedRequest) {
  if (!request.auth) throw new UnauthorizedException();
  return request.auth;
}
function category(value: string) { return input.choice(value, ['identity','bank'] as const); }

@Controller('hr')
@UseGuards(AuthGuard, PermissionGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  @Get('companies')
  async companies(@Req() request: AuthenticatedRequest) { return { data: await this.hr.companies(auth(request)) }; }

  @Get('companies/:companyId/employees')
  @RequirePermissions('hr.employment.view')
  async list(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Query() query: unknown) {
    const value = input.object(query, ['after']);
    return { data: await this.hr.list(auth(request), companyId, value.after === undefined ? undefined : input.uuid(value.after)) };
  }

  @Post('companies/:companyId/employees')
  @RequirePermissions('hr.employment.manage')
  @UseGuards(CsrfGuard)
  async create(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Body() body: unknown) {
    return { data: await this.hr.create(auth(request), companyId, body) };
  }

  @Get('companies/:companyId/employees/:employeeId/employment')
  @RequirePermissions('hr.employment.view')
  async history(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string) {
    return { data: await this.hr.history(auth(request), companyId, employeeId) };
  }

  @Post('companies/:companyId/employees/:employeeId/employment')
  @RequirePermissions('hr.employment.manage')
  @UseGuards(CsrfGuard)
  async employment(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string, @Body() body: unknown) {
    return { data: await this.hr.employment(auth(request), companyId, employeeId, body) };
  }

  @Post('companies/:companyId/employees/:employeeId/employment/:revisionId/reveal')
  @RequirePermissions('hr.identity.view')
  @UseGuards(CsrfGuard)
  async employmentReason(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string,
    @Param('employeeId') employeeId: string, @Param('revisionId') revisionId: string, @Body() body: unknown) {
    input.object(body ?? {}, []);
    return { data: await this.hr.employmentReason(auth(request), companyId, employeeId, revisionId) };
  }

  @Post('companies/:companyId/employees/:employeeId/person-link')
  @RequirePermissions('hr.identity.manage')
  @UseGuards(CsrfGuard)
  async link(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string, @Body() body: unknown) {
    return { data: await this.hr.linkEpisodes(auth(request), companyId, employeeId, body) };
  }

  @Get('companies/:companyId/employees/:employeeId/private/:category')
  async masked(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string, @Param('category') kind: string) {
    return { data: await this.hr.privateRead(auth(request), companyId, employeeId, category(kind)) };
  }

  @Get('companies/:companyId/employees/:employeeId/private/:category/history')
  async privateHistory(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string, @Param('category') kind: string) {
    return { data: await this.hr.privateHistory(auth(request), companyId, employeeId, category(kind)) };
  }

  @Post('companies/:companyId/employees/:employeeId/private/:category/revisions')
  @UseGuards(CsrfGuard)
  async privateWrite(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string,
    @Param('category') kind: string, @Body() body: unknown) {
    return { data: await this.hr.privateWrite(auth(request), companyId, employeeId, category(kind), body) };
  }

  @Post('companies/:companyId/employees/:employeeId/private/:category/reveal')
  @UseGuards(CsrfGuard)
  async reveal(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string,
    @Param('category') kind: string, @Body() body: unknown) {
    const value = input.object(body, ['version']);
    return { data: await this.hr.privateRead(auth(request), companyId, employeeId, category(kind), input.integer(value.version, 1)) };
  }

  @Post('companies/:companyId/employees/:employeeId/private/:category/reason')
  @UseGuards(CsrfGuard)
  async privateReason(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Param('employeeId') employeeId: string,
    @Param('category') kind: string, @Body() body: unknown) {
    const value = input.object(body, ['version']);
    return { data: await this.hr.privateReason(auth(request), companyId, employeeId, category(kind), input.integer(value.version, 1)) };
  }

  @Get('companies/:companyId/access')
  @RequirePermissions('hr.access.manage')
  async access(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string) {
    return { data: await this.hr.accessList(auth(request), companyId) };
  }

  @Post('companies/:companyId/access')
  @RequirePermissions('hr.access.manage')
  @UseGuards(CsrfGuard)
  async grant(@Req() request: AuthenticatedRequest, @Param('companyId') companyId: string, @Body() body: unknown) {
    return { data: await this.hr.accessWrite(auth(request), companyId, body) };
  }

  @Get('projects/:projectId/employees')
  @RequirePermissions('hr.operational.view')
  async operational(@Req() request: AuthenticatedRequest, @Param('projectId') projectId: string) {
    return { data: await this.hr.operational(auth(request), projectId) };
  }
}
