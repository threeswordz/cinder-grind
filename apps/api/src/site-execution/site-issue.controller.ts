import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { issueCommandInput, issueCreateInput, issueInvalid, issueVersion } from './site-issue-contract';
import { requiredSiteString, siteObject, siteUuid } from './site-execution-validation';
import { SiteIssueService } from './site-issue.service';

function context(r: AuthenticatedRequest) {
  if (!r.auth) throw new Error('Authentication context is missing.');
  return { auth: r.auth, ...(r.correlationId ? { correlationId: r.correlationId } : {}) };
}
@Controller('site-issues')
export class SiteIssueController {
  constructor(private readonly issues: SiteIssueService) {}

  @Get('projects')
  @UseGuards(AuthGuard)
  async projects(@Req() r: AuthenticatedRequest) { return { data: await this.issues.projects(context(r).auth) }; }

  @Get('options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.report')
  async options(@Req() r: AuthenticatedRequest, @Query('projectId') projectId?: string) {
    return { data: await this.issues.options(context(r).auth, siteUuid(projectId, 'projectId')) };
  }
  @Get('escalations')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.escalation.view')
  async escalations(@Req() r: AuthenticatedRequest) { return { data: await this.issues.escalations(context(r).auth) }; }

  @Get('projects/:projectId/routing')
  @UseGuards(AuthGuard)
  async routing(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string) {
    return { data: await this.issues.routing(context(r).auth, projectId) };
  }
  @Get('projects/:projectId/routing-candidates')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.issue.routing.manage')
  async candidates(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string) {
    return { data: await this.issues.candidates(context(r).auth, projectId) };
  }
  @Post('projects/:projectId/routing')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.issue.routing.manage')
  async configure(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Body() value: unknown) {
    const b = siteObject(value);
    if (Object.keys(b).some(k => !['requestKey', 'expectedVersion', 'ownerUserId', 'escalationUserId', 'reason'].includes(k))) issueInvalid();
    return { data: await this.issues.configure(context(r), projectId, { requestKey: siteUuid(b.requestKey, 'requestKey'),
      expectedVersion: issueVersion(b.expectedVersion, 0), ownerUserId: siteUuid(b.ownerUserId, 'ownerUserId'),
      escalationUserId: siteUuid(b.escalationUserId, 'escalationUserId'), reason: requiredSiteString(b, 'reason', 10000) }) };
  }
  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.issue.view')
  async list(@Req() r: AuthenticatedRequest, @Query('projectId') projectId?: string, @Query('after') after?: string) {
    return { data: await this.issues.list(context(r).auth, siteUuid(projectId, 'projectId'),
      after === undefined ? undefined : siteUuid(after, 'after')) };
  }
  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.report')
  async create(@Req() r: AuthenticatedRequest, @Body() body: unknown) {
    return { data: await this.issues.create(context(r), issueCreateInput(body)) };
  }
  @Get(':id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('site.issue.view')
  async get(@Req() r: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query('beforeVersion') before?: string) {
    if (before !== undefined && !/^[1-9]\d*$/.test(before)) issueInvalid();
    return { data: await this.issues.get(context(r).auth, id, before === undefined ? undefined : issueVersion(Number(before))) };
  }
  @Post(':id/follow-up')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.follow_up')
  async followUp(@Req() r: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.issues.command(context(r), id, 'FOLLOW_UP', issueCommandInput(body, 'FOLLOW_UP')) };
  }
  @Post(':id/verify')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.verify')
  async verify(@Req() r: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.issues.command(context(r), id, 'VERIFY', issueCommandInput(body, 'VERIFY')) };
  }
  @Post(':id/close')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('site.issue.view', 'site.issue.close')
  async close(@Req() r: AuthenticatedRequest, @Param('id', new ParseUUIDPipe({ version: '4' })) id: string, @Body() body: unknown) {
    return { data: await this.issues.command(context(r), id, 'CLOSE', issueCommandInput(body, 'CLOSE')) };
  }
}
