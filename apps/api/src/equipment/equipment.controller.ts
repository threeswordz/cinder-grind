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
  EquipmentAssignmentInput,
  EquipmentInput,
  EquipmentService,
  EquipmentTypeInput,
  EquipmentUsageInput,
} from './equipment.service';
import {
  equipmentBoolean,
  equipmentDate,
  equipmentInvalid,
  equipmentObject,
  equipmentStatus,
  equipmentUuid,
  nullableEquipmentString,
  optionalEquipmentHours,
  optionalEquipmentUuid,
  requiredEquipmentString,
} from './equipment-validation';

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

function typeCreate(body: unknown): EquipmentTypeInput {
  const input = equipmentObject(body);
  const description = nullableEquipmentString(input, 'description', 10000);
  return {
    equipmentTypeCode: requiredEquipmentString(
      input,
      'equipmentTypeCode',
      80,
    ),
    equipmentTypeName: requiredEquipmentString(
      input,
      'equipmentTypeName',
      150,
    ),
    ...(description !== undefined ? { description } : {}),
    ...(input.isActive !== undefined
      ? { isActive: equipmentBoolean(input.isActive, 'isActive') }
      : {}),
  };
}

function typeUpdate(body: unknown): Partial<EquipmentTypeInput> {
  const input = equipmentObject(body);
  const result: Partial<EquipmentTypeInput> = {};
  if (input.equipmentTypeCode !== undefined) {
    result.equipmentTypeCode = requiredEquipmentString(
      input,
      'equipmentTypeCode',
      80,
    );
  }
  if (input.equipmentTypeName !== undefined) {
    result.equipmentTypeName = requiredEquipmentString(
      input,
      'equipmentTypeName',
      150,
    );
  }
  if (input.description !== undefined) {
    const value = nullableEquipmentString(input, 'description', 10000);
    if (value !== undefined) result.description = value;
  }
  if (input.isActive !== undefined) {
    result.isActive = equipmentBoolean(input.isActive, 'isActive');
  }
  if (Object.keys(result).length === 0) {
    equipmentInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

function equipmentCreate(body: unknown): EquipmentInput {
  const input = equipmentObject(body);
  const description = nullableEquipmentString(input, 'description', 10000);
  return {
    equipmentTypeId: equipmentUuid(
      input.equipmentTypeId,
      'equipmentTypeId',
    ),
    equipmentCode: requiredEquipmentString(input, 'equipmentCode', 80),
    equipmentName: requiredEquipmentString(input, 'equipmentName', 200),
    operationalStatus: equipmentStatus(input.operationalStatus),
    ...(description !== undefined ? { description } : {}),
    ...(input.isActive !== undefined
      ? { isActive: equipmentBoolean(input.isActive, 'isActive') }
      : {}),
  };
}

function equipmentUpdate(body: unknown): Partial<EquipmentInput> {
  const input = equipmentObject(body);
  const result: Partial<EquipmentInput> = {};
  if (input.equipmentTypeId !== undefined) {
    result.equipmentTypeId = equipmentUuid(
      input.equipmentTypeId,
      'equipmentTypeId',
    );
  }
  if (input.equipmentCode !== undefined) {
    result.equipmentCode = requiredEquipmentString(
      input,
      'equipmentCode',
      80,
    );
  }
  if (input.equipmentName !== undefined) {
    result.equipmentName = requiredEquipmentString(
      input,
      'equipmentName',
      200,
    );
  }
  if (input.description !== undefined) {
    const value = nullableEquipmentString(input, 'description', 10000);
    if (value !== undefined) result.description = value;
  }
  if (input.operationalStatus !== undefined) {
    result.operationalStatus = equipmentStatus(input.operationalStatus);
  }
  if (input.isActive !== undefined) {
    result.isActive = equipmentBoolean(input.isActive, 'isActive');
  }
  if (Object.keys(result).length === 0) {
    equipmentInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

function assignmentCreate(body: unknown): EquipmentAssignmentInput {
  const input = equipmentObject(body);
  const remarks = nullableEquipmentString(input, 'remarks', 10000);
  return {
    projectId: equipmentUuid(input.projectId, 'projectId'),
    assignedFrom: equipmentDate(input.assignedFrom, 'assignedFrom'),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

function usageCreate(body: unknown): EquipmentUsageInput {
  const input = equipmentObject(body);
  const operatingHours = optionalEquipmentHours(
    input.operatingHours,
    'operatingHours',
  );
  const activityId = optionalEquipmentUuid(input.activityId, 'activityId');
  const wbsId = optionalEquipmentUuid(input.wbsId, 'wbsId');
  const remarks = nullableEquipmentString(input, 'remarks', 10000);
  return {
    equipmentId: equipmentUuid(input.equipmentId, 'equipmentId'),
    projectId: equipmentUuid(input.projectId, 'projectId'),
    usageDate: equipmentDate(input.usageDate, 'usageDate'),
    ...(operatingHours !== undefined ? { operatingHours } : {}),
    ...(activityId !== undefined ? { activityId } : {}),
    ...(wbsId !== undefined ? { wbsId } : {}),
    ...(remarks !== undefined ? { remarks } : {}),
  };
}

function usageUpdate(body: unknown): Partial<EquipmentUsageInput> {
  const input = equipmentObject(body);
  const result: Partial<EquipmentUsageInput> = {};
  if (input.equipmentId !== undefined) {
    result.equipmentId = equipmentUuid(input.equipmentId, 'equipmentId');
  }
  if (input.projectId !== undefined) {
    result.projectId = equipmentUuid(input.projectId, 'projectId');
  }
  if (input.usageDate !== undefined) {
    result.usageDate = equipmentDate(input.usageDate, 'usageDate');
  }
  if (input.operatingHours !== undefined) {
    const value = optionalEquipmentHours(
      input.operatingHours,
      'operatingHours',
    );
    if (value !== undefined) result.operatingHours = value;
  }
  if (input.activityId !== undefined) {
    const value = optionalEquipmentUuid(input.activityId, 'activityId');
    if (value !== undefined) result.activityId = value;
  }
  if (input.wbsId !== undefined) {
    const value = optionalEquipmentUuid(input.wbsId, 'wbsId');
    if (value !== undefined) result.wbsId = value;
  }
  if (input.remarks !== undefined) {
    const value = nullableEquipmentString(input, 'remarks', 10000);
    if (value !== undefined) result.remarks = value;
  }
  if (Object.keys(result).length === 0) {
    equipmentInvalid('body', 'Provide at least one field to update.');
  }
  return result;
}

function todayUtcDate() {
  return new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
}

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get('projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.assignment.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.equipment.projects(authOf(request)) };
  }

  @Get('types')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.type.view')
  async types(
    @Req() request: AuthenticatedRequest,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return {
      data: await this.equipment.listTypes(
        authOf(request),
        activeOnly !== 'true',
      ),
    };
  }

  @Post('types')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.type.manage')
  async createType(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.createType(
        auditContext(request),
        typeCreate(body),
      ),
    };
  }

  @Patch('types/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.type.manage')
  async updateType(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.updateType(
        auditContext(request),
        id,
        typeUpdate(body),
      ),
    };
  }

  @Get('register')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.equipment.view')
  async register(
    @Req() request: AuthenticatedRequest,
    @Query('asOf') rawAsOf?: string,
  ) {
    return {
      data: await this.equipment.listEquipment(
        authOf(request),
        rawAsOf ? equipmentDate(rawAsOf, 'asOf') : todayUtcDate(),
      ),
    };
  }

  @Post('register')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.equipment.manage')
  async createEquipment(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.createEquipment(
        auditContext(request),
        equipmentCreate(body),
      ),
    };
  }

  @Patch('register/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.equipment.manage')
  async updateEquipment(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.updateEquipment(
        auditContext(request),
        id,
        equipmentUpdate(body),
      ),
    };
  }

  @Get('projects/:projectId/available')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.equipment.view')
  async projectEquipment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('asOf') rawAsOf?: string,
  ) {
    if (!rawAsOf) equipmentInvalid('asOf', 'Is required.');
    return {
      data: await this.equipment.projectEquipment(
        authOf(request),
        projectId,
        equipmentDate(rawAsOf, 'asOf'),
      ),
    };
  }

  @Get('register/:id/assignments')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.assignment.view')
  async assignments(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.equipment.assignments(authOf(request), id) };
  }

  @Post('register/:id/assignments')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.assignment.manage')
  async assign(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.assign(
        auditContext(request),
        id,
        assignmentCreate(body),
      ),
    };
  }

  @Post('assignments/:id/release')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.assignment.manage')
  async release(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = equipmentObject(body);
    return {
      data: await this.equipment.release(
        auditContext(request),
        id,
        equipmentDate(input.assignedTo, 'assignedTo'),
      ),
    };
  }

  @Get('usage')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('equipment.usage.view')
  async usage(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') rawProjectId?: string,
    @Query('equipmentId') rawEquipmentId?: string,
    @Query('from') rawFrom?: string,
    @Query('to') rawTo?: string,
  ) {
    return {
      data: await this.equipment.usage(authOf(request), {
        ...(rawProjectId
          ? { projectId: equipmentUuid(rawProjectId, 'projectId') }
          : {}),
        ...(rawEquipmentId
          ? { equipmentId: equipmentUuid(rawEquipmentId, 'equipmentId') }
          : {}),
        ...(rawFrom ? { from: equipmentDate(rawFrom, 'from') } : {}),
        ...(rawTo ? { to: equipmentDate(rawTo, 'to') } : {}),
      }),
    };
  }

  @Post('usage')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.usage.create')
  async createUsage(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.createUsage(
        auditContext(request),
        usageCreate(body),
      ),
    };
  }

  @Patch('usage/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('equipment.usage.edit')
  async updateUsage(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.equipment.updateUsage(
        auditContext(request),
        id,
        usageUpdate(body),
      ),
    };
  }
}
