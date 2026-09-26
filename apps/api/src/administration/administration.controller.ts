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
import { Prisma } from '@prisma/client';

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
  optionalInteger,
  optionalTrimmedString,
  requireObject,
  requiredTrimmedString,
  validateCode,
  validateCurrencyCode,
  validateJsonSettingValue,
  validateSystemSettingKey,
} from './admin-validation';
import { AdministrationService } from './administration.service';

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

@Controller('admin')
export class AdministrationController {
  constructor(private readonly admin: AdministrationService) {}

  @Get('company')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.company.manage')
  async getCompany(@Req() request: AuthenticatedRequest) {
    return { data: await this.admin.getCompany(authOf(request).companyId) };
  }

  @Patch('company')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.company.manage')
  async updateCompany(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const companyCodeRaw = optionalTrimmedString(input, 'companyCode', 50);
    const companyName = optionalTrimmedString(input, 'companyName', 200);
    const currencyRaw = optionalTrimmedString(
      input,
      'baseCurrencyCode',
      3,
    );

    if (
      companyCodeRaw === undefined &&
      companyName === undefined &&
      currencyRaw === undefined
    ) {
      throw invalid('body', 'Provide at least one company setting to update.');
    }

    return {
      data: await this.admin.updateCompany(auditContext(request), {
        ...(companyCodeRaw !== undefined
          ? {
              companyCode: validateCode(
                companyCodeRaw,
                'companyCode',
                50,
              ),
            }
          : {}),
        ...(companyName !== undefined ? { companyName } : {}),
        ...(currencyRaw !== undefined
          ? { baseCurrencyCode: validateCurrencyCode(currencyRaw) }
          : {}),
      }),
    };
  }

  @Get('statuses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.status.manage')
  async listStatuses(
    @Req() request: AuthenticatedRequest,
    @Query('entityType') rawEntityType?: string,
  ) {
    const entityType =
      rawEntityType === undefined
        ? undefined
        : validateCode(rawEntityType.trim(), 'entityType', 100);

    return {
      data: await this.admin.listStatuses(
        authOf(request).companyId,
        entityType,
      ),
    };
  }

  @Post('statuses')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.status.manage')
  async createStatus(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const entityType = validateCode(
      requiredTrimmedString(input, 'entityType', 100),
      'entityType',
      100,
    );
    const statusCode = validateCode(
      requiredTrimmedString(input, 'statusCode', 80),
      'statusCode',
      80,
    );

    return {
      data: await this.admin.createStatus(auditContext(request), {
        entityType,
        statusCode,
        statusLabel: requiredTrimmedString(input, 'statusLabel', 150),
        sortOrder: optionalInteger(input, 'sortOrder', -1000000, 1000000) ?? 0,
      }),
    };
  }

  @Patch('statuses/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.status.manage')
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const statusLabel = optionalTrimmedString(input, 'statusLabel', 150);
    const sortOrder = optionalInteger(
      input,
      'sortOrder',
      -1000000,
      1000000,
    );
    const isActive = optionalBoolean(input, 'isActive');

    if (
      statusLabel === undefined &&
      sortOrder === undefined &&
      isActive === undefined
    ) {
      throw invalid('body', 'Provide at least one status field to update.');
    }

    return {
      data: await this.admin.updateStatus(auditContext(request), id, {
        ...(statusLabel !== undefined ? { statusLabel } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      }),
    };
  }

  @Get('number-sequences')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.number_sequences.manage')
  async listNumberSequences(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.admin.listNumberSequences(authOf(request).companyId),
    };
  }

  @Post('number-sequences')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.number_sequences.manage')
  async createNumberSequence(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);

    return {
      data: await this.admin.createNumberSequence(auditContext(request), {
        entityType: validateCode(
          requiredTrimmedString(input, 'entityType', 100),
          'entityType',
          100,
        ),
        sequenceCode: validateCode(
          requiredTrimmedString(input, 'sequenceCode', 80),
          'sequenceCode',
          80,
        ),
        formatTemplate: requiredTrimmedString(
          input,
          'formatTemplate',
          120,
        ),
        resetRule: requiredTrimmedString(input, 'resetRule', 30),
        startingValue:
          optionalInteger(input, 'startingValue', 1, 2147483646) ?? 1,
      }),
    };
  }

  @Patch('number-sequences/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.number_sequences.manage')
  async updateNumberSequence(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const formatTemplate = optionalTrimmedString(
      input,
      'formatTemplate',
      120,
    );
    const resetRule = optionalTrimmedString(input, 'resetRule', 30);

    if (formatTemplate === undefined && resetRule === undefined) {
      throw invalid(
        'body',
        'Provide a format template or reset rule to update.',
      );
    }

    return {
      data: await this.admin.updateNumberSequence(
        auditContext(request),
        id,
        {
          ...(formatTemplate !== undefined ? { formatTemplate } : {}),
          ...(resetRule !== undefined ? { resetRule } : {}),
        },
      ),
    };
  }

  @Get('system-settings')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('admin.system_settings.manage')
  async listSystemSettings(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.admin.listSystemSettings(authOf(request).companyId),
    };
  }

  @Put('system-settings/:settingKey')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('admin.system_settings.manage')
  async upsertSystemSetting(
    @Req() request: AuthenticatedRequest,
    @Param('settingKey') rawKey: string,
    @Body() body: unknown,
  ) {
    const input = requireObject(body);
    const settingKey = validateSystemSettingKey(rawKey);
    const settingValue = validateJsonSettingValue(input.settingValue);

    return {
      data: await this.admin.upsertSystemSetting(
        auditContext(request),
        settingKey,
        settingValue as Prisma.InputJsonValue,
      ),
    };
  }
}
