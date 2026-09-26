import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
  normalizeProjectCode,
  nullableProjectDate,
  nullableProjectString,
  optionalProjectBoolean,
  optionalProjectDate,
  optionalProjectString,
  parseContractValue,
  parseProjectActive,
  parseProjectSearch,
  projectInvalid,
  requireProjectObject,
  requiredProjectString,
  validateProjectEmail,
  validateProjectUuid,
} from './project-validation';
import { ProjectsService } from './projects.service';

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

function ensureFields(data: Record<string, unknown>) {
  if (Object.keys(data).length === 0) {
    throw projectInvalid('body', 'Provide at least one field to update.');
  }
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.project.view')
  async list(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
    @Query('statusDefinitionId') rawStatusId?: string,
  ) {
    const statusDefinitionId =
      rawStatusId === undefined || rawStatusId === ''
        ? undefined
        : validateProjectUuid(rawStatusId, 'statusDefinitionId');

    return {
      data: await this.projects.listProjects(
        authOf(request),
        parseProjectSearch(search),
        parseProjectActive(active),
        statusDefinitionId,
      ),
    };
  }

  @Post()
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.project.create')
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const location = nullableProjectString(input, 'location', 500);
    const description = nullableProjectString(input, 'description', 10000);

    return {
      data: await this.projects.createProject(auditContext(request), {
        projectCode: normalizeProjectCode(
          requiredProjectString(input, 'projectCode', 50),
        ),
        projectName: requiredProjectString(input, 'projectName', 200),
        customerId: validateProjectUuid(
          requiredProjectString(input, 'customerId', 36),
          'customerId',
        ),
        statusDefinitionId: validateProjectUuid(
          requiredProjectString(input, 'statusDefinitionId', 36),
          'statusDefinitionId',
        ),
        contractValue: parseContractValue(input.contractValue),
        ...(location !== undefined ? { location } : {}),
        ...(description !== undefined ? { description } : {}),
        plannedStartDate: optionalProjectDate(input, 'plannedStartDate') ??
          (() => { throw projectInvalid('plannedStartDate', 'Is required.'); })(),
        plannedCompletionDate:
          optionalProjectDate(input, 'plannedCompletionDate') ??
          (() => {
            throw projectInvalid('plannedCompletionDate', 'Is required.');
          })(),
      }),
    };
  }

  @Get('status-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.project.view')
  async statusOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.projects.statusOptions(authOf(request)),
    };
  }

  @Get('edit-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.project.edit')
  async editOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.projects.editOptions(authOf(request)),
    };
  }

  @Get(':id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.project.view')
  async get(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.getProject(authOf(request), id),
    };
  }

  @Patch(':id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.project.edit')
  async update(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const data: Parameters<ProjectsService['updateProject']>[2] = {};

    if (input.projectCode !== undefined) {
      data.projectCode = normalizeProjectCode(
        requiredProjectString(input, 'projectCode', 50),
      );
    }
    if (input.projectName !== undefined) {
      data.projectName = requiredProjectString(input, 'projectName', 200);
    }
    if (input.customerId !== undefined) {
      data.customerId = validateProjectUuid(
        requiredProjectString(input, 'customerId', 36),
        'customerId',
      );
    }
    if (input.statusDefinitionId !== undefined) {
      data.statusDefinitionId = validateProjectUuid(
        requiredProjectString(input, 'statusDefinitionId', 36),
        'statusDefinitionId',
      );
    }
    if (input.contractValue !== undefined) {
      data.contractValue = parseContractValue(input.contractValue);
    }
    if (input.location !== undefined) {
      const value = nullableProjectString(input, 'location', 500);
      if (value !== undefined) data.location = value;
    }
    if (input.description !== undefined) {
      const value = nullableProjectString(input, 'description', 10000);
      if (value !== undefined) data.description = value;
    }
    if (input.plannedStartDate !== undefined) {
      const value = optionalProjectDate(input, 'plannedStartDate');
      if (value !== undefined) data.plannedStartDate = value;
    }
    if (input.plannedCompletionDate !== undefined) {
      const value = optionalProjectDate(input, 'plannedCompletionDate');
      if (value !== undefined) data.plannedCompletionDate = value;
    }
    if (input.actualStartDate !== undefined) {
      const value = nullableProjectDate(input, 'actualStartDate');
      if (value !== undefined) data.actualStartDate = value;
    }
    if (input.actualCompletionDate !== undefined) {
      const value = nullableProjectDate(input, 'actualCompletionDate');
      if (value !== undefined) data.actualCompletionDate = value;
    }

    ensureFields(data as Record<string, unknown>);

    return {
      data: await this.projects.updateProject(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.project.archive')
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.setProjectActive(
        auditContext(request),
        id,
        false,
      ),
    };
  }

  @Post(':id/reactivate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.project.archive')
  async reactivate(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.setProjectActive(
        auditContext(request),
        id,
        true,
      ),
    };
  }

  @Get(':id/members')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.team.view')
  async members(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.listMembers(authOf(request), id),
    };
  }

  @Get(':id/member-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.team.manage')
  async memberOptions(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.memberOptions(authOf(request), id),
    };
  }

  @Post(':id/members')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.team.manage')
  async addMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const startDate = nullableProjectDate(input, 'startDate');
    const endDate = nullableProjectDate(input, 'endDate');

    return {
      data: await this.projects.addMember(auditContext(request), id, {
        employeeId: validateProjectUuid(
          requiredProjectString(input, 'employeeId', 36),
          'employeeId',
        ),
        projectRole: requiredProjectString(input, 'projectRole', 150),
        ...(startDate !== undefined ? { startDate } : {}),
        ...(endDate !== undefined ? { endDate } : {}),
      }),
    };
  }

  @Patch(':id/members/:memberId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.team.manage')
  async updateMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const data: Parameters<ProjectsService['updateMember']>[3] = {};

    if (input.projectRole !== undefined) {
      data.projectRole = requiredProjectString(input, 'projectRole', 150);
    }
    if (input.startDate !== undefined) {
      const value = nullableProjectDate(input, 'startDate');
      if (value !== undefined) data.startDate = value;
    }
    if (input.endDate !== undefined) {
      const value = nullableProjectDate(input, 'endDate');
      if (value !== undefined) data.endDate = value;
    }
    if (input.isActive !== undefined) {
      const value = optionalProjectBoolean(input, 'isActive');
      if (value !== undefined) data.isActive = value;
    }

    ensureFields(data as Record<string, unknown>);

    return {
      data: await this.projects.updateMember(
        auditContext(request),
        id,
        memberId,
        data,
      ),
    };
  }

  @Get(':id/contacts')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('projects.team.view')
  async contacts(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.projects.listContacts(authOf(request), id),
    };
  }

  @Post(':id/contacts')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.team.manage')
  async addContact(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const organizationName = nullableProjectString(
      input,
      'organizationName',
      200,
    );
    const roleOrTitle = nullableProjectString(input, 'roleOrTitle', 150);
    const email = validateProjectEmail(
      nullableProjectString(input, 'email', 320),
    );
    const phone = nullableProjectString(input, 'phone', 50);

    return {
      data: await this.projects.addContact(auditContext(request), id, {
        contactName: requiredProjectString(input, 'contactName', 200),
        ...(organizationName !== undefined ? { organizationName } : {}),
        ...(roleOrTitle !== undefined ? { roleOrTitle } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
      }),
    };
  }

  @Patch(':id/contacts/:contactId')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('projects.team.manage')
  async updateContact(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Param('contactId', new ParseUUIDPipe({ version: '4' })) contactId: string,
    @Body() body: unknown,
  ) {
    const input = requireProjectObject(body);
    const data: Parameters<ProjectsService['updateContact']>[3] = {};

    if (input.contactName !== undefined) {
      data.contactName = requiredProjectString(input, 'contactName', 200);
    }
    if (input.organizationName !== undefined) {
      const value = nullableProjectString(input, 'organizationName', 200);
      if (value !== undefined) data.organizationName = value;
    }
    if (input.roleOrTitle !== undefined) {
      const value = nullableProjectString(input, 'roleOrTitle', 150);
      if (value !== undefined) data.roleOrTitle = value;
    }
    if (input.email !== undefined) {
      const value = validateProjectEmail(
        nullableProjectString(input, 'email', 320),
      );
      if (value !== undefined) data.email = value;
    }
    if (input.phone !== undefined) {
      const value = nullableProjectString(input, 'phone', 50);
      if (value !== undefined) data.phone = value;
    }
    if (input.isActive !== undefined) {
      const value = optionalProjectBoolean(input, 'isActive');
      if (value !== undefined) data.isActive = value;
    }

    ensureFields(data as Record<string, unknown>);

    return {
      data: await this.projects.updateContact(
        auditContext(request),
        id,
        contactId,
        data,
      ),
    };
  }
}
