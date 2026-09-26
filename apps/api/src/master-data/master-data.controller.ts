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
import { MasterDataService } from './master-data.service';
import {
  masterInvalid,
  normalizeMasterCode,
  nullableMasterString,
  optionalMasterBoolean,
  optionalMasterInteger,
  optionalMasterString,
  parseActiveFilter,
  parseSearch,
  requiredMasterString,
  requireMasterObject,
  validateMasterUuid,
  validateOptionalEmail,
} from './master-validation';

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

function queryFilters(search?: string, active?: string) {
  return {
    search: parseSearch(search),
    active: parseActiveFilter(active),
  };
}

function ensureUpdate(fields: Record<string, unknown>): void {
  if (Object.keys(fields).length === 0) {
    throw masterInvalid('body', 'Provide at least one field to update.');
  }
}

@Controller('master-data')
export class MasterDataController {
  constructor(private readonly master: MasterDataService) {}

  @Get('customers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.customer.view')
  async customers(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const filters = queryFilters(search, active);
    return {
      data: await this.master.listCustomers(
        authOf(request).companyId,
        filters.search,
        filters.active,
      ),
    };
  }

  @Get('customers/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.customer.view')
  async customer(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.master.getCustomer(authOf(request).companyId, id),
    };
  }

  @Post('customers')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.customer.manage')
  async createCustomer(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const email = validateOptionalEmail(
      nullableMasterString(input, 'email', 320),
    );

    return {
      data: await this.master.createCustomer(auditContext(request), {
        customerCode: normalizeMasterCode(
          requiredMasterString(input, 'customerCode', 50),
          'customerCode',
          50,
        ),
        customerName: requiredMasterString(input, 'customerName', 200),
        ...(input.registrationNumber !== undefined
          ? {
              registrationNumber: nullableMasterString(
                input,
                'registrationNumber',
                100,
              ),
            }
          : {}),
        ...(input.contactName !== undefined
          ? { contactName: nullableMasterString(input, 'contactName', 200) }
          : {}),
        ...(email !== undefined ? { email } : {}),
        ...(input.phone !== undefined
          ? { phone: nullableMasterString(input, 'phone', 50) }
          : {}),
        ...(input.address !== undefined
          ? { address: nullableMasterString(input, 'address', 5000) }
          : {}),
      }),
    };
  }

  @Patch('customers/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.customer.manage')
  async updateCustomer(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const data: Parameters<MasterDataService['updateCustomer']>[2] = {};

    if (input.customerCode !== undefined) {
      data.customerCode = normalizeMasterCode(
        requiredMasterString(input, 'customerCode', 50),
        'customerCode',
        50,
      );
    }
    if (input.customerName !== undefined) {
      data.customerName = requiredMasterString(input, 'customerName', 200);
    }
    if (input.registrationNumber !== undefined) {
      data.registrationNumber = nullableMasterString(
        input,
        'registrationNumber',
        100,
      );
    }
    if (input.contactName !== undefined) {
      data.contactName = nullableMasterString(input, 'contactName', 200);
    }
    if (input.email !== undefined) {
      data.email = validateOptionalEmail(
        nullableMasterString(input, 'email', 320),
      );
    }
    if (input.phone !== undefined) {
      data.phone = nullableMasterString(input, 'phone', 50);
    }
    if (input.address !== undefined) {
      data.address = nullableMasterString(input, 'address', 5000);
    }
    if (input.isActive !== undefined) {
      data.isActive = optionalMasterBoolean(input, 'isActive');
    }

    ensureUpdate(data as Record<string, unknown>);
    return {
      data: await this.master.updateCustomer(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Get('suppliers')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.supplier.view')
  async suppliers(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const filters = queryFilters(search, active);
    return {
      data: await this.master.listSuppliers(
        authOf(request).companyId,
        filters.search,
        filters.active,
      ),
    };
  }

  @Get('suppliers/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.supplier.view')
  async supplier(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.master.getSupplier(authOf(request).companyId, id),
    };
  }

  @Post('suppliers')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.supplier.manage')
  async createSupplier(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const email = validateOptionalEmail(
      nullableMasterString(input, 'email', 320),
    );

    return {
      data: await this.master.createSupplier(auditContext(request), {
        supplierCode: normalizeMasterCode(
          requiredMasterString(input, 'supplierCode', 50),
          'supplierCode',
          50,
        ),
        supplierName: requiredMasterString(input, 'supplierName', 200),
        ...(input.registrationNumber !== undefined
          ? {
              registrationNumber: nullableMasterString(
                input,
                'registrationNumber',
                100,
              ),
            }
          : {}),
        ...(input.contactName !== undefined
          ? { contactName: nullableMasterString(input, 'contactName', 200) }
          : {}),
        ...(email !== undefined ? { email } : {}),
        ...(input.phone !== undefined
          ? { phone: nullableMasterString(input, 'phone', 50) }
          : {}),
        ...(input.address !== undefined
          ? { address: nullableMasterString(input, 'address', 5000) }
          : {}),
      }),
    };
  }

  @Patch('suppliers/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.supplier.manage')
  async updateSupplier(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const data: Parameters<MasterDataService['updateSupplier']>[2] = {};

    if (input.supplierCode !== undefined) {
      data.supplierCode = normalizeMasterCode(
        requiredMasterString(input, 'supplierCode', 50),
        'supplierCode',
        50,
      );
    }
    if (input.supplierName !== undefined) {
      data.supplierName = requiredMasterString(input, 'supplierName', 200);
    }
    if (input.registrationNumber !== undefined) {
      data.registrationNumber = nullableMasterString(
        input,
        'registrationNumber',
        100,
      );
    }
    if (input.contactName !== undefined) {
      data.contactName = nullableMasterString(input, 'contactName', 200);
    }
    if (input.email !== undefined) {
      data.email = validateOptionalEmail(
        nullableMasterString(input, 'email', 320),
      );
    }
    if (input.phone !== undefined) {
      data.phone = nullableMasterString(input, 'phone', 50);
    }
    if (input.address !== undefined) {
      data.address = nullableMasterString(input, 'address', 5000);
    }
    if (input.isActive !== undefined) {
      data.isActive = optionalMasterBoolean(input, 'isActive');
    }

    ensureUpdate(data as Record<string, unknown>);
    return {
      data: await this.master.updateSupplier(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Get('employees')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.employee.view')
  async employees(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const filters = queryFilters(search, active);
    return {
      data: await this.master.listEmployees(
        authOf(request).companyId,
        filters.search,
        filters.active,
      ),
    };
  }

  @Get('employees/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.employee.view')
  async employee(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.master.getEmployee(authOf(request).companyId, id),
    };
  }

  @Post('employees')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.employee.manage')
  async createEmployee(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const email = validateOptionalEmail(
      nullableMasterString(input, 'email', 320),
    );

    return {
      data: await this.master.createEmployee(auditContext(request), {
        employeeCode: normalizeMasterCode(
          requiredMasterString(input, 'employeeCode', 50),
          'employeeCode',
          50,
        ),
        employeeName: requiredMasterString(input, 'employeeName', 200),
        ...(input.jobTitle !== undefined
          ? { jobTitle: nullableMasterString(input, 'jobTitle', 150) }
          : {}),
        ...(email !== undefined ? { email } : {}),
        ...(input.phone !== undefined
          ? { phone: nullableMasterString(input, 'phone', 50) }
          : {}),
      }),
    };
  }

  @Patch('employees/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.employee.manage')
  async updateEmployee(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const data: Parameters<MasterDataService['updateEmployee']>[2] = {};

    if (input.employeeCode !== undefined) {
      data.employeeCode = normalizeMasterCode(
        requiredMasterString(input, 'employeeCode', 50),
        'employeeCode',
        50,
      );
    }
    if (input.employeeName !== undefined) {
      data.employeeName = requiredMasterString(input, 'employeeName', 200);
    }
    if (input.jobTitle !== undefined) {
      data.jobTitle = nullableMasterString(input, 'jobTitle', 150);
    }
    if (input.email !== undefined) {
      data.email = validateOptionalEmail(
        nullableMasterString(input, 'email', 320),
      );
    }
    if (input.phone !== undefined) {
      data.phone = nullableMasterString(input, 'phone', 50);
    }
    if (input.isActive !== undefined) {
      data.isActive = optionalMasterBoolean(input, 'isActive');
    }

    ensureUpdate(data as Record<string, unknown>);
    return {
      data: await this.master.updateEmployee(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Get('uoms')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.uom.view')
  async uoms(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const filters = queryFilters(search, active);
    return {
      data: await this.master.listUnitsOfMeasure(
        authOf(request).companyId,
        filters.search,
        filters.active,
      ),
    };
  }

  @Get('uoms/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.uom.view')
  async uom(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.master.getUnitOfMeasure(
        authOf(request).companyId,
        id,
      ),
    };
  }

  @Post('uoms')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.uom.manage')
  async createUom(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    return {
      data: await this.master.createUnitOfMeasure(auditContext(request), {
        uomCode: normalizeMasterCode(
          requiredMasterString(input, 'uomCode', 30),
          'uomCode',
          30,
        ),
        uomName: requiredMasterString(input, 'uomName', 100),
        decimalPlaces:
          optionalMasterInteger(input, 'decimalPlaces', 0, 6) ?? 0,
      }),
    };
  }

  @Patch('uoms/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.uom.manage')
  async updateUom(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const data: Parameters<
      MasterDataService['updateUnitOfMeasure']
    >[2] = {};

    if (input.uomCode !== undefined) {
      data.uomCode = normalizeMasterCode(
        requiredMasterString(input, 'uomCode', 30),
        'uomCode',
        30,
      );
    }
    if (input.uomName !== undefined) {
      data.uomName = requiredMasterString(input, 'uomName', 100);
    }
    if (input.decimalPlaces !== undefined) {
      data.decimalPlaces = optionalMasterInteger(
        input,
        'decimalPlaces',
        0,
        6,
      );
    }
    if (input.isActive !== undefined) {
      data.isActive = optionalMasterBoolean(input, 'isActive');
    }

    ensureUpdate(data as Record<string, unknown>);
    return {
      data: await this.master.updateUnitOfMeasure(
        auditContext(request),
        id,
        data,
      ),
    };
  }

  @Get('material-uom-options')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.material.view')
  async materialUomOptions(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.master.listMaterialUomOptions(
        authOf(request).companyId,
      ),
    };
  }

  @Get('materials')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.material.view')
  async materials(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    const filters = queryFilters(search, active);
    return {
      data: await this.master.listMaterials(
        authOf(request).companyId,
        filters.search,
        filters.active,
      ),
    };
  }

  @Get('materials/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('master.material.view')
  async material(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return {
      data: await this.master.getMaterial(authOf(request).companyId, id),
    };
  }

  @Post('materials')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.material.manage')
  async createMaterial(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    return {
      data: await this.master.createMaterial(auditContext(request), {
        materialCode: normalizeMasterCode(
          requiredMasterString(input, 'materialCode', 80),
          'materialCode',
          80,
        ),
        materialName: requiredMasterString(input, 'materialName', 200),
        defaultUomId: validateMasterUuid(
          requiredMasterString(input, 'defaultUomId', 36),
          'defaultUomId',
        ),
        ...(input.description !== undefined
          ? { description: nullableMasterString(input, 'description', 10000) }
          : {}),
        ...(input.materialCategory !== undefined
          ? {
              materialCategory: nullableMasterString(
                input,
                'materialCategory',
                150,
              ),
            }
          : {}),
      }),
    };
  }

  @Patch('materials/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('master.material.manage')
  async updateMaterial(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = requireMasterObject(body);
    const data: Parameters<MasterDataService['updateMaterial']>[2] = {};

    if (input.materialCode !== undefined) {
      data.materialCode = normalizeMasterCode(
        requiredMasterString(input, 'materialCode', 80),
        'materialCode',
        80,
      );
    }
    if (input.materialName !== undefined) {
      data.materialName = requiredMasterString(
        input,
        'materialName',
        200,
      );
    }
    if (input.description !== undefined) {
      data.description = nullableMasterString(input, 'description', 10000);
    }
    if (input.defaultUomId !== undefined) {
      data.defaultUomId = validateMasterUuid(
        requiredMasterString(input, 'defaultUomId', 36),
        'defaultUomId',
      );
    }
    if (input.materialCategory !== undefined) {
      data.materialCategory = nullableMasterString(
        input,
        'materialCategory',
        150,
      );
    }
    if (input.isActive !== undefined) {
      data.isActive = optionalMasterBoolean(input, 'isActive');
    }

    ensureUpdate(data as Record<string, unknown>);
    return {
      data: await this.master.updateMaterial(
        auditContext(request),
        id,
        data,
      ),
    };
  }
}
