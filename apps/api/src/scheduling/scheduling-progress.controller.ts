import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
  normalizeSchedulingCode,
  nullableSchedulingString,
  parsePercentComplete,
  parseSchedulingDate,
  requireSchedulingObject,
  requiredSchedulingString,
  schedulingInvalid,
  validateSchedulingUuid,
} from './scheduling-validation';
import { SchedulingProgressService } from './scheduling-progress.service';

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

@Controller('schedule-baselines')
export class ScheduleBaselinesController {
  constructor(private readonly progress: SchedulingProgressService) {}

  @Get('workflow-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.baseline.create')
  async workflowOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.progress.baselineWorkflowOptions(authOf(request)),
    };
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
  ) {
    if (!rawProjectId) {
      throw schedulingInvalid('projectId', 'Is required.');
    }
    return {
      data: await this.progress.listBaselines(
        authOf(request),
        validateSchedulingUuid(rawProjectId, 'projectId'),
      ),
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.progress.getBaseline(authOf(request), id),
    };
  }

  @Post('submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.baseline.create')
  async submit(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const projectId = validateSchedulingUuid(
      requiredSchedulingString(input, 'projectId', 36),
      'projectId',
    );
    const workflowCode = normalizeSchedulingCode(
      requiredSchedulingString(input, 'workflowCode', 80),
      'workflowCode',
    );

    return {
      data: await this.progress.submitBaseline(
        auditContext(request),
        projectId,
        workflowCode,
      ),
    };
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.baseline.approve')
  async approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const comment = nullableSchedulingString(input, 'comment', 10000);
    return {
      data: await this.progress.approveBaseline(
        auditContext(request),
        id,
        comment ?? undefined,
      ),
    };
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.baseline.approve')
  async reject(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const comment = nullableSchedulingString(input, 'comment', 10000);
    return {
      data: await this.progress.rejectBaseline(
        auditContext(request),
        id,
        comment ?? undefined,
      ),
    };
  }
}

@Controller('activity-progress')
export class ActivityProgressController {
  constructor(private readonly progress: SchedulingProgressService) {}

  @Get(':activityId')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async history(
    @Req() request: AuthenticatedRequest,
    @Param('activityId', new ParseUUIDPipe({ version: '4' }))
    activityId: string,
  ) {
    return {
      data: await this.progress.progressHistory(
        authOf(request),
        activityId,
      ),
    };
  }

  @Post(':activityId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.progress.record')
  async record(
    @Req() request: AuthenticatedRequest,
    @Param('activityId', new ParseUUIDPipe({ version: '4' }))
    activityId: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const note = nullableSchedulingString(input, 'note', 10000);
    return {
      data: await this.progress.recordProgress(
        auditContext(request),
        activityId,
        {
          progressDate: parseSchedulingDate(
            input.progressDate,
            'progressDate',
          ),
          percentComplete: parsePercentComplete(
            input.percentComplete,
          ),
          ...(note !== undefined ? { note } : {}),
        },
      ),
    };
  }
}

@Controller('schedule')
export class ScheduleComparisonController {
  constructor(private readonly progress: SchedulingProgressService) {}

  @Get('projects/:projectId/gantt')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async gantt(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.progress.presentation(
        authOf(request),
        projectId,
      ),
    };
  }

  @Get('projects/:projectId/lookahead')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async lookahead(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') rawAsOf?: string,
    @Query('days') rawDays?: string,
  ) {
    if (!rawAsOf) {
      throw schedulingInvalid('asOf', 'Is required.');
    }
    const parsedDays =
      rawDays === undefined || rawDays === '' ? 14 : Number(rawDays);
    if (parsedDays !== 14 && parsedDays !== 28) {
      throw schedulingInvalid('days', 'Must be 14 or 28.');
    }

    return {
      data: await this.progress.lookahead(
        authOf(request),
        projectId,
        parseSchedulingDate(rawAsOf, 'asOf'),
        parsedDays,
      ),
    };
  }

  @Get('projects/:projectId/comparison')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async comparison(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
  ) {
    return {
      data: await this.progress.comparison(
        authOf(request),
        projectId,
      ),
    };
  }
}
