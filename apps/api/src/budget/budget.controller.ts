import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  budgetBoolean,
  budgetCode,
  budgetDecimal,
  budgetInteger,
  budgetNonEmpty,
  budgetNullableString,
  budgetObject,
  budgetString,
  budgetUuid,
} from './budget-validation';
import { BudgetService } from './budget.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function auditContext(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId
      ? { correlationId: request.correlationId }
      : {}),
  };
}

@Controller('budget')
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.boq.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.budget.projects(authOf(request)) };
  }

  @Get('projects/:projectId/options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.boq.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.budget.options(authOf(request), projectId),
    };
  }

  @Get('revision-workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.revision.submit')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.budget.workflowOptions(authOf(request)),
    };
  }

  @Get('projects/:projectId/boq')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.boq.view')
  async getBoq(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.budget.getBoq(authOf(request), projectId),
    };
  }

  @Post('projects/:projectId/boq')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async createBoq(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.createBoq(
        auditContext(request),
        projectId,
        budgetString(input, 'boqName', 200),
      ),
    };
  }

  @Patch('projects/:projectId/boq')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async updateBoq(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.updateBoq(
        auditContext(request),
        projectId,
        budgetString(input, 'boqName', 200),
      ),
    };
  }

  @Post('boqs/:boqId/sections')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async createSection(
    @Req() request: AuthenticatedRequest,
    @Param('boqId', new ParseUUIDPipe({ version: '4' }))
    boqId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.createSection(
        auditContext(request),
        boqId,
        {
          sectionCode: budgetCode(
            budgetString(input, 'sectionCode', 80),
            'sectionCode',
          ),
          sectionName: budgetString(input, 'sectionName', 200),
          description:
            budgetNullableString(input, 'description', 10000) ?? null,
          sortOrder:
            input.sortOrder === undefined
              ? 0
              : budgetInteger(input.sortOrder, 'sortOrder'),
        },
      ),
    };
  }

  @Patch('sections/:sectionId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async updateSection(
    @Req() request: AuthenticatedRequest,
    @Param('sectionId', new ParseUUIDPipe({ version: '4' }))
    sectionId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    const data = {
      ...(input.sectionCode !== undefined
        ? {
            sectionCode: budgetCode(
              budgetString(input, 'sectionCode', 80),
              'sectionCode',
            ),
          }
        : {}),
      ...(input.sectionName !== undefined
        ? { sectionName: budgetString(input, 'sectionName', 200) }
        : {}),
      ...(input.description !== undefined
        ? {
            description:
              budgetNullableString(input, 'description', 10000) ?? null,
          }
        : {}),
      ...(input.sortOrder !== undefined
        ? { sortOrder: budgetInteger(input.sortOrder, 'sortOrder') }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: budgetBoolean(input, 'isActive')! }
        : {}),
    };
    budgetNonEmpty(data);
    return {
      data: await this.budget.updateSection(
        auditContext(request),
        sectionId,
        data,
      ),
    };
  }

  @Post('boqs/:boqId/items')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async createItem(
    @Req() request: AuthenticatedRequest,
    @Param('boqId', new ParseUUIDPipe({ version: '4' }))
    boqId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.createItem(
        auditContext(request),
        boqId,
        {
          sectionId: budgetUuid(
            budgetString(input, 'sectionId', 36),
            'sectionId',
          )!,
          itemCode: budgetCode(
            budgetString(input, 'itemCode', 80),
            'itemCode',
          ),
          description: budgetString(input, 'description', 500),
          quantity: budgetDecimal(
            input.quantity,
            'quantity',
            'POSITIVE',
          ),
          uomId: budgetUuid(
            budgetString(input, 'uomId', 36),
            'uomId',
          )!,
          rate: budgetDecimal(input.rate, 'rate', 'NON_NEGATIVE'),
          wbsId: budgetUuid(input.wbsId, 'wbsId', true) ?? null,
          costCodeId:
            budgetUuid(input.costCodeId, 'costCodeId', true) ?? null,
          sortOrder:
            input.sortOrder === undefined
              ? 0
              : budgetInteger(input.sortOrder, 'sortOrder'),
        },
      ),
    };
  }

  @Patch('items/:itemId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.boq.manage')
  async updateItem(
    @Req() request: AuthenticatedRequest,
    @Param('itemId', new ParseUUIDPipe({ version: '4' }))
    itemId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    const data = {
      ...(input.sectionId !== undefined
        ? {
            sectionId: budgetUuid(
              budgetString(input, 'sectionId', 36),
              'sectionId',
            )!,
          }
        : {}),
      ...(input.itemCode !== undefined
        ? {
            itemCode: budgetCode(
              budgetString(input, 'itemCode', 80),
              'itemCode',
            ),
          }
        : {}),
      ...(input.description !== undefined
        ? { description: budgetString(input, 'description', 500) }
        : {}),
      ...(input.quantity !== undefined
        ? {
            quantity: budgetDecimal(
              input.quantity,
              'quantity',
              'POSITIVE',
            ),
          }
        : {}),
      ...(input.uomId !== undefined
        ? {
            uomId: budgetUuid(
              budgetString(input, 'uomId', 36),
              'uomId',
            )!,
          }
        : {}),
      ...(input.rate !== undefined
        ? {
            rate: budgetDecimal(
              input.rate,
              'rate',
              'NON_NEGATIVE',
            ),
          }
        : {}),
      ...(input.wbsId !== undefined
        ? { wbsId: budgetUuid(input.wbsId, 'wbsId', true) ?? null }
        : {}),
      ...(input.costCodeId !== undefined
        ? {
            costCodeId:
              budgetUuid(input.costCodeId, 'costCodeId', true) ?? null,
          }
        : {}),
      ...(input.sortOrder !== undefined
        ? { sortOrder: budgetInteger(input.sortOrder, 'sortOrder') }
        : {}),
      ...(input.isActive !== undefined
        ? { isActive: budgetBoolean(input, 'isActive') }
        : {}),
    };
    budgetNonEmpty(data);
    return {
      data: await this.budget.updateItem(
        auditContext(request),
        itemId,
        data,
      ),
    };
  }

  @Get('projects/:projectId/revisions')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.revision.view')
  async listRevisions(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.budget.listRevisions(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('revisions/:revisionId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.revision.view')
  async getRevision(
    @Req() request: AuthenticatedRequest,
    @Param('revisionId', new ParseUUIDPipe({ version: '4' }))
    revisionId: string,
  ) {
    return {
      data: await this.budget.getRevision(
        authOf(request),
        revisionId,
      ),
    };
  }

  @Post('projects/:projectId/revisions')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.revision.submit')
  async createRevisionDraft(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.createRevisionDraft(
        auditContext(request),
        projectId,
        budgetNullableString(input, 'revisionNote', 10000),
      ),
    };
  }

  @Post('revisions/:revisionId/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.revision.submit')
  async submitRevision(
    @Req() request: AuthenticatedRequest,
    @Param('revisionId', new ParseUUIDPipe({ version: '4' }))
    revisionId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.submitRevision(
        auditContext(request),
        revisionId,
        budgetCode(
          budgetString(input, 'workflowCode', 80),
          'workflowCode',
        ),
      ),
    };
  }

  @Post('revisions/:revisionId/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.revision.approve')
  async approveRevision(
    @Req() request: AuthenticatedRequest,
    @Param('revisionId', new ParseUUIDPipe({ version: '4' }))
    revisionId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.approveRevision(
        auditContext(request),
        revisionId,
        budgetNullableString(input, 'comment', 10000) ?? undefined,
      ),
    };
  }

  @Post('revisions/:revisionId/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('budget.revision.approve')
  async rejectRevision(
    @Req() request: AuthenticatedRequest,
    @Param('revisionId', new ParseUUIDPipe({ version: '4' }))
    revisionId: string,
    @Body() body: unknown,
  ) {
    const input = budgetObject(body);
    return {
      data: await this.budget.rejectRevision(
        auditContext(request),
        revisionId,
        budgetNullableString(input, 'comment', 10000) ?? undefined,
      ),
    };
  }

  @Get('projects/:projectId/summary')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.revision.view')
  async summary(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.budget.summary(authOf(request), projectId),
    };
  }

  @Get('projects/:projectId/approved')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('budget.revision.view')
  async approvedBudget(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.budget.approvedBudget(
        authOf(request),
        projectId,
      ),
    };
  }
}
