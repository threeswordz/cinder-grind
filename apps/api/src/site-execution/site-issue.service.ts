import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SiteIssue } from '@prisma/client';
import { createHash } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../projects/project-access.service';
import { immediateIssueEscalation, IssueAction, IssueCommand, IssueCreate, issueTransition } from './site-issue-contract';

type Tx = Prisma.TransactionClient;
type Context = { auth: AuthenticatedUserContext; correlationId?: string };
function denied(): never { throw new ForbiddenException({ code: 'SITE_ISSUE_PERMISSION_DENIED' }); }
function conflict(): never { throw new ConflictException({ code: 'SITE_ISSUE_VERSION_OR_REPLAY_CONFLICT' }); }
const permission = (action: IssueAction) => 'site.issue.' + ({ FOLLOW_UP: 'follow_up', VERIFY: 'verify', CLOSE: 'close' }[action]);
const userInclude = { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } } as const;
type LiveUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;
function userContext(user: LiveUser): AuthenticatedUserContext {
  return { userId: user.id, companyId: user.companyId, email: user.email, displayName: user.displayName,
    roleCodes: user.userRoles.filter(r => r.role.isActive).map(r => r.role.roleCode),
    permissions: [...new Set(user.userRoles.filter(r => r.role.isActive).flatMap(r => r.role.rolePermissions.map(p => p.permission.permissionCode)))],
    sessionId: '', csrfTokenHash: '' };
}

@Injectable()
export class SiteIssueService {
  constructor(private readonly db: PrismaService, private readonly access: ProjectAccessService, private readonly audit: AuditService) {}

  private async live(tx: Tx, auth: AuthenticatedUserContext, required: string[], routingOnly = false) {
    const session = await tx.userSession.findFirst({ where: { id: auth.sessionId, userId: auth.userId,
      revokedAt: null, expiresAt: { gt: new Date() }, user: { companyId: auth.companyId, isActive: true, company: { isActive: true } } },
      include: { user: { include: userInclude } } });
    if (!session) denied();
    const current = userContext(session.user);
    const permissions = current.permissions.filter(p => auth.permissions.includes(p));
    if (!(routingOnly ? permissions.includes('site.issue.routing.manage') || permissions.includes('site.issue.view')
      : permissions.includes('site.issue.view')) || !required.every(p => permissions.includes(p))) denied();
    return { ...auth, permissions, roleCodes: current.roleCodes };
  }
  private async transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await this.db.$transaction(work, { isolationLevel: 'Serializable', timeout: 20000 }); }
      catch (e) {
        // PostgreSQL serialization/deadlock errors from the explicit row lock
        // arrive as P2010; retry the entire transaction with a fresh snapshot.
        if (e instanceof Prisma.PrismaClientKnownRequestError && (['P2034', 'P2002'].includes(e.code) ||
          e.code === 'P2010' && ['40001', '40P01'].includes(String(e.meta?.code)))) {
          if (attempt < 2) continue;
          conflict();
        }
        throw e;
      }
    }
  }
  private async eligible(tx: Tx, companyId: string, projectId: string, userId: string, rights: string[]) {
    const user = await tx.user.findFirst({ where: { id: userId, companyId, isActive: true }, include: userInclude });
    if (!user) denied();
    const context = userContext(user);
    if (!rights.every(p => context.permissions.includes(p))) denied();
    await this.access.assertAccess(context, projectId, tx);
    return user;
  }
  private async find(tx: Tx, auth: AuthenticatedUserContext, id: string) {
    const issue = await tx.siteIssue.findFirst({ where: { id, companyId: auth.companyId } });
    if (!issue) throw new NotFoundException({ code: 'SITE_ISSUE_NOT_FOUND' });
    await this.access.assertAccess(auth, issue.projectId, tx);
    return issue;
  }
  async projects(auth: AuthenticatedUserContext) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, [], true);
      return tx.project.findMany({ where: { AND: [await this.access.scopeWhere(a, tx), { isActive: true }] },
        select: { id: true, projectCode: true, projectName: true }, orderBy: { id: 'asc' } });
    });
  }
  async options(auth: AuthenticatedUserContext, projectId: string) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, ['site.issue.report']); await this.access.assertAccess(a, projectId, tx);
      return { activities: await tx.activity.findMany({ where: { companyId: a.companyId, projectId, isActive: true },
        select: { id: true, activityCode: true, activityName: true }, orderBy: { id: 'asc' }, take: 200 }),
        reports: a.permissions.includes('site.daily_report.view') ? await tx.dailySiteReport.findMany({
          where: { companyId: a.companyId, projectId, createdByUserId: a.userId },
          select: { id: true, reportDate: true, status: true }, orderBy: { reportDate: 'desc' }, take: 100 }) : [] };
    });
  }
  async routing(auth: AuthenticatedUserContext, projectId: string) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, [], true); await this.access.assertAccess(a, projectId, tx);
      const row = await tx.siteIssueRouting.findUnique({ where: { projectId }, include: {
        owner: { select: { id: true, displayName: true } }, escalation: { select: { id: true, displayName: true } } } });
      if (row && row.companyId !== a.companyId) denied();
      // Command fingerprints/configurator metadata are not operational read fields.
      return row ? { projectId: row.projectId, version: row.version, owner: row.owner, escalation: row.escalation } : null;
    });
  }
  async candidates(auth: AuthenticatedUserContext, projectId: string) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, ['site.issue.routing.manage'], true);
      await this.access.assertAccess(a, projectId, tx);
      const users = await tx.user.findMany({ where: { companyId: a.companyId, isActive: true }, include: userInclude });
      const owners: Array<{ id: string; displayName: string }> = [], recipients: typeof owners = [];
      for (const user of users) {
        const context = userContext(user);
        if (!await tx.project.findFirst({ where: { AND: [await this.access.scopeWhere(context, tx), { id: projectId }] }, select: { id: true } })) continue;
        const item = { id: user.id, displayName: user.displayName }, rights = context.permissions;
        if (['site.issue.view', 'site.issue.follow_up', 'site.issue.close'].every(p => rights.includes(p))) owners.push(item);
        if (['site.issue.view', 'site.issue.escalation.view'].every(p => rights.includes(p))) recipients.push(item);
      }
      return { owners, recipients };
    });
  }
  async configure(context: Context, projectId: string, input: {
    requestKey: string; expectedVersion: number; ownerUserId: string; escalationUserId: string; reason: string;
  }) {
    return this.transaction(async tx => {
      const a = await this.live(tx, context.auth, ['site.issue.routing.manage'], true);
      await this.access.assertAccess(a, projectId, tx);
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', 'fm03-routing:' + a.companyId + ':' + projectId);
      if (input.ownerUserId === input.escalationUserId) denied();
      await this.eligible(tx, a.companyId, projectId, input.ownerUserId, ['site.issue.view', 'site.issue.follow_up', 'site.issue.close']);
      await this.eligible(tx, a.companyId, projectId, input.escalationUserId, ['site.issue.view', 'site.issue.escalation.view']);
      const before = await tx.siteIssueRouting.findUnique({ where: { projectId } });
      const digest = createHash('sha256').update(JSON.stringify(input)).digest('hex');
      if (before?.lastRequestKey === input.requestKey) {
        if (before.updatedByUserId !== a.userId || before.lastBodyDigest !== digest) conflict();
        return { projectId, version: before.version };
      }
      if ((before?.version ?? 0) !== input.expectedVersion) conflict();
      const values = { companyId: a.companyId, ownerUserId: input.ownerUserId, escalationUserId: input.escalationUserId,
        updatedByUserId: a.userId, lastRequestKey: input.requestKey, lastBodyDigest: digest, version: input.expectedVersion + 1 };
      const row = before ? await tx.siteIssueRouting.update({ where: { projectId }, data: values })
        : await tx.siteIssueRouting.create({ data: { projectId, ...values } });
      await this.audit.record({ ...context, auth: a, entityType: 'SITE_ISSUE_ROUTING', entityId: projectId, action: 'CONFIGURE',
        oldValues: before, newValues: { ...row, reason: input.reason } }, tx);
      return { projectId, version: row.version };
    });
  }
  async list(auth: AuthenticatedUserContext, projectId: string, after?: string) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, []); await this.access.assertAccess(a, projectId, tx);
      const rows = await tx.siteIssue.findMany({ where: { companyId: a.companyId, projectId, ...(after ? { id: { gt: after } } : {}) },
        select: { id: true, description: true, category: true, status: true, version: true, escalatedAt: true, createdAt: true },
        orderBy: { id: 'asc' }, take: 101 });
      return { items: rows.slice(0, 100), nextCursor: rows.length > 100 ? rows[99]!.id : null };
    });
  }
  async escalations(auth: AuthenticatedUserContext) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, ['site.issue.escalation.view']);
      const where: Prisma.SiteIssueWhereInput = { companyId: a.companyId, escalationUserId: a.userId,
        escalatedAt: { not: null }, status: { not: 'CLOSED' }, project: await this.access.scopeWhere(a, tx) };
      const total = await tx.siteIssue.count({ where });
      const rows = await tx.siteIssue.findMany({ where, select: { id: true, description: true, status: true,
        escalatedAt: true, project: { select: { id: true, projectCode: true, projectName: true } } },
        orderBy: [{ escalatedAt: 'asc' }, { id: 'asc' }], take: 100 });
      return { total, items: rows.map(r => ({ ...r, description: r.description.slice(0, 200) })) };
    });
  }
  async get(auth: AuthenticatedUserContext, id: string, beforeVersion?: number) {
    return this.transaction(async tx => {
      const a = await this.live(tx, auth, []); const issue = await this.find(tx, a, id);
      const events = await tx.siteIssueEvent.findMany({ where: { issueId: id, ...(beforeVersion ? { version: { lt: beforeVersion } } : {}) },
        orderBy: { version: 'desc' }, take: 101, select: { id: true, version: true, action: true, status: true,
          note: true, facts: true, recordedAt: true, actor: { select: { id: true, displayName: true } } } });
      const people = await tx.user.findMany({ where: { companyId: a.companyId, id: { in: [issue.reporterUserId, issue.ownerUserId, issue.escalationUserId] } },
        select: { id: true, displayName: true }, orderBy: { id: 'asc' } });
      return { ...issue, people, events: events.slice(0, 100), nextBeforeVersion: events.length > 100 ? events[99]!.version : null };
    });
  }
  private async event(tx: Tx, context: Context, issue: SiteIssue, action: string, key: string, digest: string, note: string) {
    const snapshots = await tx.$queryRawUnsafe<Array<{ facts: Prisma.InputJsonValue }>>('SELECT erp_site_issue_snapshot($1::uuid) AS facts', issue.id);
    const e = await tx.siteIssueEvent.create({ data: { companyId: issue.companyId, issueId: issue.id, actorUserId: context.auth.userId,
      version: issue.version, status: issue.status, requestKey: key, bodyDigest: digest, action, note, facts: snapshots[0]!.facts } });
    await this.audit.record({ ...context, entityType: 'SITE_ISSUE', entityId: issue.id, action,
      newValues: { version: issue.version, status: issue.status, eventId: e.id, escalated: Boolean(issue.escalatedAt) } }, tx);
    return { id: issue.id, version: issue.version, eventId: e.id };
  }
  private async replay(tx: Tx, a: AuthenticatedUserContext, key: string, digest: string, id: string | null) {
    await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', 'fm03-operation:' + a.companyId + ':' + a.userId + ':' + key);
    const old = await tx.siteIssueEvent.findUnique({ where: { companyId_actorUserId_requestKey: { companyId: a.companyId, actorUserId: a.userId, requestKey: key } } });
    if (!old) return null;
    await this.find(tx, a, old.issueId);
    if (old.bodyDigest !== digest || (id && old.issueId !== id)) conflict();
    return { id: old.issueId, version: old.version, eventId: old.id };
  }
  async create(context: Context, input: IssueCreate) {
    return this.transaction(async tx => {
      const a = await this.live(tx, context.auth, ['site.issue.report']);
      await this.access.assertAccess(a, input.projectId, tx);
      const digest = createHash('sha256').update(JSON.stringify(['REPORT', input])).digest('hex');
      const old = await this.replay(tx, a, input.requestKey, digest, null); if (old) return old;
      const routing = await tx.siteIssueRouting.findUnique({ where: { projectId: input.projectId } });
      if (!routing || routing.companyId !== a.companyId) throw new ConflictException({ code: 'SITE_ISSUE_ROUTING_REQUIRED' });
      if ([routing.ownerUserId, routing.escalationUserId].includes(a.userId)) denied();
      await this.eligible(tx, a.companyId, input.projectId, routing.ownerUserId, ['site.issue.view', 'site.issue.follow_up', 'site.issue.close']);
      await this.eligible(tx, a.companyId, input.projectId, routing.escalationUserId, ['site.issue.view', 'site.issue.escalation.view']);
      if (input.reportId && (!a.permissions.includes('site.daily_report.view') || !await tx.dailySiteReport.findFirst({
        where: { id: input.reportId, companyId: a.companyId, projectId: input.projectId, createdByUserId: a.userId }, select: { id: true } }))) denied();
      if (input.activityId && !await tx.activity.findFirst({ where: { id: input.activityId, companyId: a.companyId,
        projectId: input.projectId, isActive: true }, select: { id: true } })) denied();
      const { requestKey, ...facts } = input;
      const issue = await tx.siteIssue.create({ data: { ...facts, companyId: a.companyId, reporterUserId: a.userId,
        ownerUserId: routing.ownerUserId, escalationUserId: routing.escalationUserId,
        escalatedAt: immediateIssueEscalation(input) ? new Date() : null } });
      return this.event(tx, { ...context, auth: a }, issue, 'REPORT', requestKey, digest, input.description);
    });
  }
  async command(context: Context, id: string, action: IssueAction, input: IssueCommand) {
    return this.transaction(async tx => {
      const a = await this.live(tx, context.auth, [permission(action)]);
      // Assignment is checked before replay as well as before each new effect.
      const current = await this.find(tx, a, id);
      if (a.userId !== (action === 'VERIFY' ? current.reporterUserId : current.ownerUserId)) denied();
      const digest = createHash('sha256').update(JSON.stringify([action, id, input])).digest('hex');
      const old = await this.replay(tx, a, input.requestKey, digest, id); if (old) return old;
      await tx.$queryRawUnsafe('SELECT id FROM site_issues WHERE id=$1::uuid AND company_id=$2::uuid FOR UPDATE', id, a.companyId);
      const issue = await this.find(tx, a, id);
      if (issue.version !== input.expectedVersion) conflict();
      const status = issueTransition(issue, a.userId, action, input), now = new Date();
      if (!issue.escalatedAt && input.assetSeverity === 'SEVERE') {
        await this.eligible(tx, a.companyId, issue.projectId, issue.escalationUserId, ['site.issue.view', 'site.issue.escalation.view']);
      }
      const changed = await tx.siteIssue.update({ where: { id }, data: { status, version: issue.version + 1,
        ...(action === 'FOLLOW_UP' && input.assetSeverity ? { assetSeverity: input.assetSeverity } : {}),
        ...(!issue.escalatedAt && input.assetSeverity === 'SEVERE' ? { escalatedAt: now } : {}),
        ...(action === 'VERIFY' ? { verifiedAt: input.resolved ? now : null } : {}),
        ...(action === 'CLOSE' ? { closedAt: now } : {}) } });
      return this.event(tx, { ...context, auth: a }, changed, action, input.requestKey, digest, input.note);
    });
  }
}
