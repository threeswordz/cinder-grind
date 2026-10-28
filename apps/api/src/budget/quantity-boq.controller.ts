import { Controller, Get, Param, ParseUUIDPipe, Req, UseGuards, Header, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { persistedBudgetActor, QUANTITY_VIEW, quantityRecord } from './budget-disclosure';
import { BudgetService } from './budget.service';

@Controller('budget/quantity')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions(QUANTITY_VIEW)
export class QuantityBoqController {
  constructor(private readonly prisma: PrismaService, private readonly budget: BudgetService) {}
  private async read(request: AuthenticatedRequest, action: (auth: NonNullable<AuthenticatedRequest['auth']>) => Promise<unknown>) {
    // The standard authenticated session is fresh; re-resolve persisted grants as
    // well so an internal call cannot claim a client-supplied disclosure mode.
    const auth = await this.prisma.$transaction((tx: Prisma.TransactionClient) => persistedBudgetActor(tx, request.auth!));
    if (!auth.permissions.includes(QUANTITY_VIEW)) throw new ForbiddenException({ code: 'BOQ_QUANTITY_PERMISSION_DENIED', detail: 'Explicit quantity-only read authority is required.' });
    return { data: await action(auth) };
  }
  @Get('projects') @Header('Cache-Control','private, no-store')
  projects(@Req() r: AuthenticatedRequest) { return this.read(r, (a) => this.budget.projects(a)); }
  @Get('projects/:projectId/boq') @Header('Cache-Control','private, no-store')
  boq(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({version:'4'})) p: string) {
    return this.read(r, async (a) => quantityRecord(await this.budget.getBoq(a,p)));
  }
  @Get('projects/:projectId/revisions') @Header('Cache-Control','private, no-store')
  revisions(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({version:'4'})) p: string) {
    return this.read(r, async (a) => quantityRecord(await this.budget.listRevisions(a,p)));
  }
  @Get('projects/:projectId/revisions/:id') @Header('Cache-Control','private, no-store')
  revision(@Req() r: AuthenticatedRequest, @Param('projectId', new ParseUUIDPipe({version:'4'})) p: string,
    @Param('id', new ParseUUIDPipe({version:'4'})) id: string) {
    return this.read(r, async (a) => { const row = await this.budget.getRevision(a,id);
      if (row.projectId !== p.toLowerCase()) throw new ForbiddenException({code:'BOQ_PROJECT_MISMATCH',detail:'Revision belongs to another Project.'});
      return quantityRecord(row); });
  }
}
