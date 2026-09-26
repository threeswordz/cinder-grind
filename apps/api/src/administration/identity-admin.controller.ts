import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  invalid,
  optionalBoolean,
  optionalTrimmedString,
  requireObject,
  requiredTrimmedString,
  validateCode,
  validateEmail,
  validateUuid,
} from './admin-validation';
import { IdentityAdminService } from './identity-admin.service';

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

function stringArray(
  value: unknown,
  field: string,
  maxItems = 100,
): string[] {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    !value.every((item) => typeof item === 'string')
  ) {
    throw invalid(field, 'Must be an array of strings.');
  }
  return value as string[];
}

function uuidArray(
  value: unknown,
  field: string,
  maxItems = 100,
): string[] {
  return stringArray(value, field, maxItems).map((item, index) =>
    validateUuid(item, field + '[' + index + ']'),
  );
}

@Controller('admin')
export class IdentityAdminController {
  constructor(private readonly identity: IdentityAdminService) {}

  @Get('user-role-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async userRoleOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.identity.listRoleOptions(authOf(request).companyId),
    };
  }

  @Get('users')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async listUsers(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.identity.listUsers(authOf(request).companyId),
    };
  }

  @Get('users/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async getUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.identity.getUser(authOf(request).companyId, id),
    };
  }

  @Post('users')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async createUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const employeeId = optionalTrimmedString(input, 'employeeId', 36);
    const roleIds =
      input.roleIds === undefined ? [] : uuidArray(input.roleIds, 'roleIds');

    return {
      data: await this.identity.createUser(auditContext(request), {
        email: validateEmail(requiredTrimmedString(input, 'email', 320)),
        displayName: requiredTrimmedString(input, 'displayName', 200),
        password: requiredTrimmedString(input, 'password', 1024),
        ...(employeeId ? { employeeId } : {}),
        roleIds,
      }),
    };
  }

  @Patch('users/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const email = optionalTrimmedString(input, 'email', 320);
    const displayName = optionalTrimmedString(input, 'displayName', 200);
    const isActive = optionalBoolean(input, 'isActive');

    let employeeId: string | null | undefined;
    if (input.employeeId === null) employeeId = null;
    else if (input.employeeId !== undefined) {
      employeeId = validateUuid(
        requiredTrimmedString(input, 'employeeId', 36),
        'employeeId',
      );
    }

    if (
      email === undefined &&
      displayName === undefined &&
      employeeId === undefined &&
      isActive === undefined
    ) {
      throw invalid('body', 'Provide at least one User field to update.');
    }

    return {
      data: await this.identity.updateUser(auditContext(request), id, {
        ...(email !== undefined ? { email: validateEmail(email) } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(employeeId !== undefined ? { employeeId } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      }),
    };
  }

  @Post('users/:id/reset-password')
  @HttpCode(204)
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async resetPassword(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ): Promise<void> {
    const input = requireObject(body);
    await this.identity.resetPassword(
      auditContext(request),
      id,
      requiredTrimmedString(input, 'password', 1024),
    );
  }

  @Put('users/:id/roles')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.users.manage')
  async replaceUserRoles(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    return {
      data: await this.identity.replaceUserRoles(
        auditContext(request),
        id,
        uuidArray(input.roleIds, 'roleIds'),
      ),
    };
  }

  @Get('roles')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.roles.manage')
  async listRoles(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.identity.listRoles(authOf(request).companyId),
    };
  }

  @Post('roles')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.roles.manage')
  async createRole(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const roleCode = validateCode(
      requiredTrimmedString(input, 'roleCode', 80),
      'roleCode',
      80,
    );
    const description = optionalTrimmedString(
      input,
      'description',
      2000,
    );

    return {
      data: await this.identity.createRole(auditContext(request), {
        roleCode,
        roleName: requiredTrimmedString(input, 'roleName', 150),
        ...(description !== undefined ? { description } : {}),
      }),
    };
  }

  @Patch('roles/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.roles.manage')
  async updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const roleName = optionalTrimmedString(input, 'roleName', 150);
    const isActive = optionalBoolean(input, 'isActive');

    let description: string | null | undefined;
    if (input.description === null) description = null;
    else if (input.description !== undefined) {
      description = requiredTrimmedString(input, 'description', 2000);
    }

    if (
      roleName === undefined &&
      description === undefined &&
      isActive === undefined
    ) {
      throw invalid('body', 'Provide at least one Role field to update.');
    }

    return {
      data: await this.identity.updateRole(auditContext(request), id, {
        ...(roleName !== undefined ? { roleName } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      }),
    };
  }

  @Get('permissions')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.permissions.assign')
  async listPermissions() {
    return { data: await this.identity.listPermissions() };
  }

  @Put('roles/:id/permissions')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.permissions.assign')
  async replaceRolePermissions(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    return {
      data: await this.identity.replaceRolePermissions(
        auditContext(request),
        id,
        stringArray(input.permissionCodes, 'permissionCodes', 500),
      ),
    };
  }
}
