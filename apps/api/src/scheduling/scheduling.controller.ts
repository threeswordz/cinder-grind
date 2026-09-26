import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { SchedulingService } from './scheduling.service';
import {
  ensureSchedulingFields,
  normalizeSchedulingCode,
  nullableSchedulingDate,
  nullableSchedulingString,
  nullableSchedulingUuid,
  optionalSchedulingBoolean,
  optionalSchedulingDate,
  optionalSchedulingString,
  optionalSignedWorkDays,
  optionalWorkDays,
  parseActiveFilter,
  parseDependencyType,
  parseSchedulingDate,
  parseScheduleMode,
  parseSignedWorkDays,
  parseTime,
  parseWeekdayNo,
  parseWorkDays,
  requireSchedulingObject,
  requiredSchedulingBoolean,
  requiredSchedulingString,
  schedulingInvalid,
  validateSchedulingUuid,
  validateTimePair,
  validateTimeZone,
} from './scheduling-validation';

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

function objectArray(
  value: unknown,
  field: string,
  maxItems: number,
): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw schedulingInvalid(field, 'Must be an array with at most ' + maxItems + ' items.');
  }
  return value.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw schedulingInvalid(field + '[' + index + ']', 'Must be an object.');
    }
    return item as Record<string, unknown>;
  });
}

function nestedBoolean(
  row: Record<string, unknown>,
  key: string,
  field: string,
): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') {
    throw schedulingInvalid(field, 'Must be a boolean.');
  }
  return value;
}

@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.scheduling.projects(authOf(request)) };
  }

  @Get('projects/:projectId/analysis')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async analysis(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('mode') mode?: string,
  ) {
    return {
      data: await this.scheduling.scheduleAnalysis(
        authOf(request),
        projectId,
        parseScheduleMode(mode),
      ),
    };
  }
}

@Controller('working-calendars')
export class WorkingCalendarsController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('project-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async projectOptions(@Req() request: AuthenticatedRequest) {
    return { data: await this.scheduling.projects(authOf(request)) };
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
    @Query('active') active?: string,
  ) {
    const projectId =
      rawProjectId === undefined || rawProjectId === ''
        ? undefined
        : validateSchedulingUuid(rawProjectId, 'projectId');
    return {
      data: await this.scheduling.listCalendars(
        authOf(request),
        projectId,
        parseActiveFilter(active),
      ),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const projectId = nullableSchedulingUuid(input, 'projectId');
    const description = nullableSchedulingString(input, 'description', 10000);
    const isDefault = optionalSchedulingBoolean(input, 'isDefault');

    return {
      data: await this.scheduling.createCalendar(auditContext(request), {
        ...(projectId !== undefined ? { projectId } : {}),
        calendarName: requiredSchedulingString(input, 'calendarName', 200),
        ...(description !== undefined ? { description } : {}),
        timezoneName: validateTimeZone(
          requiredSchedulingString(input, 'timezoneName', 100),
        ),
        ...(isDefault !== undefined ? { isDefault } : {}),
      }),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const data: Parameters<SchedulingService['updateCalendar']>[2] = {};

    if (input.projectId !== undefined) {
      const value = nullableSchedulingUuid(input, 'projectId');
      if (value !== undefined) data.projectId = value;
    }
    if (input.calendarName !== undefined) {
      data.calendarName = requiredSchedulingString(input, 'calendarName', 200);
    }
    if (input.description !== undefined) {
      const value = nullableSchedulingString(input, 'description', 10000);
      if (value !== undefined) data.description = value;
    }
    if (input.timezoneName !== undefined) {
      data.timezoneName = validateTimeZone(
        requiredSchedulingString(input, 'timezoneName', 100),
      );
    }
    if (input.isDefault !== undefined) {
      const value = optionalSchedulingBoolean(input, 'isDefault');
      if (value !== undefined) data.isDefault = value;
    }

    ensureSchedulingFields(data as Record<string, unknown>);
    return {
      data: await this.scheduling.updateCalendar(auditContext(request), id, data),
    };
  }

  @Put(':id/weekdays')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async weekdays(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const rows = objectArray(input.weekdays, 'weekdays', 7).map((row, index) => {
      const startTime = parseTime(
        row.startTime === undefined ? null : row.startTime,
        'weekdays[' + index + '].startTime',
      );
      const endTime = parseTime(
        row.endTime === undefined ? null : row.endTime,
        'weekdays[' + index + '].endTime',
      );
      validateTimePair(
        startTime,
        endTime,
        'weekdays[' + index + '].startTime',
        'weekdays[' + index + '].endTime',
      );
      return {
        weekdayNo: parseWeekdayNo(
          row.weekdayNo,
          'weekdays[' + index + '].weekdayNo',
        ),
        isWorking: nestedBoolean(
          row,
          'isWorking',
          'weekdays[' + index + '].isWorking',
        ),
        startTime,
        endTime,
      };
    });

    return {
      data: await this.scheduling.replaceWeekdays(
        auditContext(request),
        id,
        rows,
      ),
    };
  }

  @Put(':id/exceptions')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async exceptions(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const rows = objectArray(input.exceptions, 'exceptions', 500).map(
      (row, index) => {
        const startTime = parseTime(
          row.startTime === undefined ? null : row.startTime,
          'exceptions[' + index + '].startTime',
        );
        const endTime = parseTime(
          row.endTime === undefined ? null : row.endTime,
          'exceptions[' + index + '].endTime',
        );
        validateTimePair(
          startTime,
          endTime,
          'exceptions[' + index + '].startTime',
          'exceptions[' + index + '].endTime',
        );
        const reason =
          row.reason === undefined
            ? undefined
            : nullableSchedulingString(row, 'reason', 500);
        return {
          exceptionDate: parseSchedulingDate(
            row.exceptionDate,
            'exceptions[' + index + '].exceptionDate',
          ),
          isWorkingOverride: nestedBoolean(
            row,
            'isWorkingOverride',
            'exceptions[' + index + '].isWorkingOverride',
          ),
          startTime,
          endTime,
          ...(reason !== undefined ? { reason } : {}),
        };
      },
    );

    return {
      data: await this.scheduling.replaceExceptions(
        auditContext(request),
        id,
        rows,
      ),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setCalendarActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.calendar.manage')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setCalendarActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }
}

@Controller('activity-types')
export class ActivityTypesController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.activity_types.manage')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('active') active?: string,
  ) {
    return {
      data: await this.scheduling.listActivityTypes(
        authOf(request).companyId,
        parseActiveFilter(active),
      ),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.activity_types.manage')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    return {
      data: await this.scheduling.createActivityType(auditContext(request), {
        activityTypeCode: normalizeSchedulingCode(
          requiredSchedulingString(input, 'activityTypeCode', 80),
          'activityTypeCode',
        ),
        activityTypeName: requiredSchedulingString(
          input,
          'activityTypeName',
          150,
        ),
      }),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.activity_types.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const data: Parameters<SchedulingService['updateActivityType']>[2] = {};
    if (input.activityTypeCode !== undefined) {
      data.activityTypeCode = normalizeSchedulingCode(
        requiredSchedulingString(input, 'activityTypeCode', 80),
        'activityTypeCode',
      );
    }
    if (input.activityTypeName !== undefined) {
      data.activityTypeName = requiredSchedulingString(
        input,
        'activityTypeName',
        150,
      );
    }
    ensureSchedulingFields(data as Record<string, unknown>);
    return {
      data: await this.scheduling.updateActivityType(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.activity_types.manage')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setActivityTypeActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.activity_types.manage')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setActivityTypeActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }
}

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get('options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async options(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
  ) {
    if (!rawProjectId) throw schedulingInvalid('projectId', 'Is required.');
    const projectId = validateSchedulingUuid(rawProjectId, 'projectId');
    return {
      data: await this.scheduling.activityOptions(authOf(request), projectId),
    };
  }

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
    @Query('active') active?: string,
  ) {
    if (!rawProjectId) throw schedulingInvalid('projectId', 'Is required.');
    const projectId = validateSchedulingUuid(rawProjectId, 'projectId');
    return {
      data: await this.scheduling.listActivities(
        authOf(request),
        projectId,
        parseActiveFilter(active),
      ),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.activity.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const projectId = validateSchedulingUuid(
      requiredSchedulingString(input, 'projectId', 36),
      'projectId',
    );

    const parentActivityId = nullableSchedulingUuid(input, 'parentActivityId');
    const activityTypeId = nullableSchedulingUuid(input, 'activityTypeId');
    const statusDefinitionId = nullableSchedulingUuid(
      input,
      'statusDefinitionId',
    );
    const description = nullableSchedulingString(input, 'description', 10000);
    const isSummary = optionalSchedulingBoolean(input, 'isSummary');
    const isMilestone = optionalSchedulingBoolean(input, 'isMilestone');
    const actualStartDate = nullableSchedulingDate(input, 'actualStartDate');
    const actualFinishDate = nullableSchedulingDate(input, 'actualFinishDate');
    const forecastStartDate = nullableSchedulingDate(input, 'forecastStartDate');
    const forecastFinishDate = nullableSchedulingDate(
      input,
      'forecastFinishDate',
    );
    const responsibleEmployeeId = nullableSchedulingUuid(
      input,
      'responsibleEmployeeId',
    );
    const ownerUserId = nullableSchedulingUuid(input, 'ownerUserId');

    return {
      data: await this.scheduling.createActivity(
        auditContext(request),
        projectId,
        {
          wbsId: validateSchedulingUuid(
            requiredSchedulingString(input, 'wbsId', 36),
            'wbsId',
          ),
          workingCalendarId: validateSchedulingUuid(
            requiredSchedulingString(input, 'workingCalendarId', 36),
            'workingCalendarId',
          ),
          activityCode: normalizeSchedulingCode(
            requiredSchedulingString(input, 'activityCode', 80),
            'activityCode',
          ),
          activityName: requiredSchedulingString(input, 'activityName', 200),
          plannedDurationWorkDays: parseWorkDays(
            input.plannedDurationWorkDays,
            'plannedDurationWorkDays',
          ),
          plannedStartDate: parseSchedulingDate(
            input.plannedStartDate,
            'plannedStartDate',
          ),
          plannedFinishDate: parseSchedulingDate(
            input.plannedFinishDate,
            'plannedFinishDate',
          ),
          ...(parentActivityId !== undefined ? { parentActivityId } : {}),
          ...(activityTypeId !== undefined ? { activityTypeId } : {}),
          ...(statusDefinitionId !== undefined ? { statusDefinitionId } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(isSummary !== undefined ? { isSummary } : {}),
          ...(isMilestone !== undefined ? { isMilestone } : {}),
          ...(actualStartDate !== undefined ? { actualStartDate } : {}),
          ...(actualFinishDate !== undefined ? { actualFinishDate } : {}),
          ...(forecastStartDate !== undefined ? { forecastStartDate } : {}),
          ...(forecastFinishDate !== undefined ? { forecastFinishDate } : {}),
          ...(responsibleEmployeeId !== undefined
            ? { responsibleEmployeeId }
            : {}),
          ...(ownerUserId !== undefined ? { ownerUserId } : {}),
        },
      ),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.activity.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const data: Parameters<SchedulingService['updateActivity']>[2] = {};

    if (input.wbsId !== undefined) {
      data.wbsId = validateSchedulingUuid(
        requiredSchedulingString(input, 'wbsId', 36),
        'wbsId',
      );
    }
    if (input.parentActivityId !== undefined) {
      const value = nullableSchedulingUuid(input, 'parentActivityId');
      if (value !== undefined) data.parentActivityId = value;
    }
    if (input.activityTypeId !== undefined) {
      const value = nullableSchedulingUuid(input, 'activityTypeId');
      if (value !== undefined) data.activityTypeId = value;
    }
    if (input.workingCalendarId !== undefined) {
      data.workingCalendarId = validateSchedulingUuid(
        requiredSchedulingString(input, 'workingCalendarId', 36),
        'workingCalendarId',
      );
    }
    if (input.statusDefinitionId !== undefined) {
      const value = nullableSchedulingUuid(
        input,
        'statusDefinitionId',
      );
      if (value !== undefined) data.statusDefinitionId = value;
    }
    if (input.activityCode !== undefined) {
      data.activityCode = normalizeSchedulingCode(
        requiredSchedulingString(input, 'activityCode', 80),
        'activityCode',
      );
    }
    if (input.activityName !== undefined) {
      data.activityName = requiredSchedulingString(input, 'activityName', 200);
    }
    if (input.description !== undefined) {
      const value = nullableSchedulingString(input, 'description', 10000);
      if (value !== undefined) data.description = value;
    }
    if (input.isSummary !== undefined) {
      const value = optionalSchedulingBoolean(input, 'isSummary');
      if (value !== undefined) data.isSummary = value;
    }
    if (input.isMilestone !== undefined) {
      const value = optionalSchedulingBoolean(input, 'isMilestone');
      if (value !== undefined) data.isMilestone = value;
    }
    if (input.plannedDurationWorkDays !== undefined) {
      const value = optionalWorkDays(
        input,
        'plannedDurationWorkDays',
      );
      if (value !== undefined) data.plannedDurationWorkDays = value;
    }
    if (input.plannedStartDate !== undefined) {
      const value = optionalSchedulingDate(input, 'plannedStartDate');
      if (value !== undefined) data.plannedStartDate = value;
    }
    if (input.plannedFinishDate !== undefined) {
      const value = optionalSchedulingDate(
        input,
        'plannedFinishDate',
      );
      if (value !== undefined) data.plannedFinishDate = value;
    }
    if (input.actualStartDate !== undefined) {
      const value = nullableSchedulingDate(input, 'actualStartDate');
      if (value !== undefined) data.actualStartDate = value;
    }
    if (input.actualFinishDate !== undefined) {
      const value = nullableSchedulingDate(input, 'actualFinishDate');
      if (value !== undefined) data.actualFinishDate = value;
    }
    if (input.forecastStartDate !== undefined) {
      const value = nullableSchedulingDate(
        input,
        'forecastStartDate',
      );
      if (value !== undefined) data.forecastStartDate = value;
    }
    if (input.forecastFinishDate !== undefined) {
      const value = nullableSchedulingDate(
        input,
        'forecastFinishDate',
      );
      if (value !== undefined) data.forecastFinishDate = value;
    }
    if (input.responsibleEmployeeId !== undefined) {
      const value = nullableSchedulingUuid(
        input,
        'responsibleEmployeeId',
      );
      if (value !== undefined) data.responsibleEmployeeId = value;
    }
    if (input.ownerUserId !== undefined) {
      const value = nullableSchedulingUuid(input, 'ownerUserId');
      if (value !== undefined) data.ownerUserId = value;
    }

    ensureSchedulingFields(data as Record<string, unknown>);
    return {
      data: await this.scheduling.updateActivity(auditContext(request), id, data),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.activity.archive')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setActivityActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.activity.archive')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setActivityActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }
}

@Controller('activity-dependencies')
export class ActivityDependenciesController {
  constructor(private readonly scheduling: SchedulingService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('schedule.programme.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
    @Query('active') active?: string,
  ) {
    if (!rawProjectId) throw schedulingInvalid('projectId', 'Is required.');
    return {
      data: await this.scheduling.listDependencies(
        authOf(request),
        validateSchedulingUuid(rawProjectId, 'projectId'),
        parseActiveFilter(active),
      ),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.dependency.manage')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const projectId = validateSchedulingUuid(
      requiredSchedulingString(input, 'projectId', 36),
      'projectId',
    );
    return {
      data: await this.scheduling.createDependency(
        auditContext(request),
        projectId,
        {
          predecessorActivityId: validateSchedulingUuid(
            requiredSchedulingString(input, 'predecessorActivityId', 36),
            'predecessorActivityId',
          ),
          successorActivityId: validateSchedulingUuid(
            requiredSchedulingString(input, 'successorActivityId', 36),
            'successorActivityId',
          ),
          dependencyType: parseDependencyType(input.dependencyType),
          lagWorkDays: parseSignedWorkDays(
            input.lagWorkDays === undefined ? 0 : input.lagWorkDays,
            'lagWorkDays',
          ),
        },
      ),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.dependency.manage')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireSchedulingObject(body);
    const data: Parameters<SchedulingService['updateDependency']>[2] = {};

    if (input.predecessorActivityId !== undefined) {
      data.predecessorActivityId = validateSchedulingUuid(
        requiredSchedulingString(input, 'predecessorActivityId', 36),
        'predecessorActivityId',
      );
    }
    if (input.successorActivityId !== undefined) {
      data.successorActivityId = validateSchedulingUuid(
        requiredSchedulingString(input, 'successorActivityId', 36),
        'successorActivityId',
      );
    }
    if (input.dependencyType !== undefined) {
      data.dependencyType = parseDependencyType(input.dependencyType);
    }
    if (input.lagWorkDays !== undefined) {
      const value = optionalSignedWorkDays(input, 'lagWorkDays');
      if (value !== undefined) data.lagWorkDays = value;
    }

    ensureSchedulingFields(data as Record<string, unknown>);
    return {
      data: await this.scheduling.updateDependency(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.dependency.manage')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setDependencyActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('schedule.dependency.manage')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.scheduling.setDependencyActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }
}
