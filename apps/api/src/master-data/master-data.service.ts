import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { AuthenticatedUserContext } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';

type AuditContext = {
  auth: AuthenticatedUserContext;
  correlationId?: string;
};

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCustomers(
    companyId: string,
    search?: string,
    active?: boolean,
  ) {
    return this.prisma.customer.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(search
          ? {
              OR: [
                { customerCode: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { registrationNumber: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ customerName: 'asc' }, { customerCode: 'asc' }],
    });
  }

  async getCustomer(companyId: string, id: string) {
    const item = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!item) throw this.notFound('Customer');
    return item;
  }

  async createCustomer(
    context: AuditContext,
    data: {
      customerCode: string;
      customerName: string;
      registrationNumber?: string | null | undefined;
      contactName?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      address?: string | null | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createData: Prisma.CustomerUncheckedCreateInput = {
          companyId: context.auth.companyId,
          customerCode: data.customerCode,
          customerName: data.customerName,
          ...(data.registrationNumber !== undefined
            ? { registrationNumber: data.registrationNumber }
            : {}),
          ...(data.contactName !== undefined
            ? { contactName: data.contactName }
            : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
        };

        const created = await tx.customer.create({
          data: createData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'CUSTOMER',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Customer code is already in use.');
      throw error;
    }
  }

  async updateCustomer(
    context: AuditContext,
    id: string,
    data: {
      customerCode?: string | undefined;
      customerName?: string | undefined;
      registrationNumber?: string | null | undefined;
      contactName?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      address?: string | null | undefined;
      isActive?: boolean | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.customer.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound('Customer');

        const updateData: Prisma.CustomerUncheckedUpdateInput = {
          ...(data.customerCode !== undefined
            ? { customerCode: data.customerCode }
            : {}),
          ...(data.customerName !== undefined
            ? { customerName: data.customerName }
            : {}),
          ...(data.registrationNumber !== undefined
            ? { registrationNumber: data.registrationNumber }
            : {}),
          ...(data.contactName !== undefined
            ? { contactName: data.contactName }
            : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.customer.update({
          where: { id },
          data: updateData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'CUSTOMER',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Customer code is already in use.');
      throw error;
    }
  }

  listSuppliers(
    companyId: string,
    search?: string,
    active?: boolean,
  ) {
    return this.prisma.supplier.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(search
          ? {
              OR: [
                { supplierCode: { contains: search, mode: 'insensitive' } },
                { supplierName: { contains: search, mode: 'insensitive' } },
                { registrationNumber: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ supplierName: 'asc' }, { supplierCode: 'asc' }],
    });
  }

  async getSupplier(companyId: string, id: string) {
    const item = await this.prisma.supplier.findFirst({
      where: { id, companyId },
    });
    if (!item) throw this.notFound('Supplier');
    return item;
  }

  async createSupplier(
    context: AuditContext,
    data: {
      supplierCode: string;
      supplierName: string;
      registrationNumber?: string | null | undefined;
      contactName?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      address?: string | null | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createData: Prisma.SupplierUncheckedCreateInput = {
          companyId: context.auth.companyId,
          supplierCode: data.supplierCode,
          supplierName: data.supplierName,
          ...(data.registrationNumber !== undefined
            ? { registrationNumber: data.registrationNumber }
            : {}),
          ...(data.contactName !== undefined
            ? { contactName: data.contactName }
            : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
        };

        const created = await tx.supplier.create({
          data: createData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Supplier code is already in use.');
      throw error;
    }
  }

  async updateSupplier(
    context: AuditContext,
    id: string,
    data: {
      supplierCode?: string | undefined;
      supplierName?: string | undefined;
      registrationNumber?: string | null | undefined;
      contactName?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      address?: string | null | undefined;
      isActive?: boolean | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.supplier.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound('Supplier');

        const updateData: Prisma.SupplierUncheckedUpdateInput = {
          ...(data.supplierCode !== undefined
            ? { supplierCode: data.supplierCode }
            : {}),
          ...(data.supplierName !== undefined
            ? { supplierName: data.supplierName }
            : {}),
          ...(data.registrationNumber !== undefined
            ? { registrationNumber: data.registrationNumber }
            : {}),
          ...(data.contactName !== undefined
            ? { contactName: data.contactName }
            : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.address !== undefined ? { address: data.address } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.supplier.update({
          where: { id },
          data: updateData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'SUPPLIER',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Supplier code is already in use.');
      throw error;
    }
  }

  listEmployees(
    companyId: string,
    search?: string,
    active?: boolean,
  ) {
    return this.prisma.employee.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(search
          ? {
              OR: [
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { employeeName: { contains: search, mode: 'insensitive' } },
                { jobTitle: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ employeeName: 'asc' }, { employeeCode: 'asc' }],
    });
  }

  async getEmployee(companyId: string, id: string) {
    const item = await this.prisma.employee.findFirst({
      where: { id, companyId },
    });
    if (!item) throw this.notFound('Employee');
    return item;
  }

  async createEmployee(
    context: AuditContext,
    data: {
      employeeCode: string;
      employeeName: string;
      jobTitle?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const createData: Prisma.EmployeeUncheckedCreateInput = {
          companyId: context.auth.companyId,
          employeeCode: data.employeeCode,
          employeeName: data.employeeName,
          ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
        };

        const created = await tx.employee.create({
          data: createData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EMPLOYEE',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Employee code is already in use.');
      throw error;
    }
  }

  async updateEmployee(
    context: AuditContext,
    id: string,
    data: {
      employeeCode?: string | undefined;
      employeeName?: string | undefined;
      jobTitle?: string | null | undefined;
      email?: string | null | undefined;
      phone?: string | null | undefined;
      isActive?: boolean | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.employee.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound('Employee');

        if (data.isActive === false && before.isActive) {
          const activeUser = await tx.user.findFirst({
            where: { employeeId: id, isActive: true },
            select: { id: true },
          });
          if (activeUser) {
            throw new ConflictException({
              code: 'EMPLOYEE_LINKED_TO_ACTIVE_USER',
              detail:
                'Deactivate the linked application User before deactivating this Employee.',
            });
          }
        }

        const updateData: Prisma.EmployeeUncheckedUpdateInput = {
          ...(data.employeeCode !== undefined
            ? { employeeCode: data.employeeCode }
            : {}),
          ...(data.employeeName !== undefined
            ? { employeeName: data.employeeName }
            : {}),
          ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle } : {}),
          ...(data.email !== undefined ? { email: data.email } : {}),
          ...(data.phone !== undefined ? { phone: data.phone } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.employee.update({
          where: { id },
          data: updateData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'EMPLOYEE',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Employee code is already in use.');
      throw error;
    }
  }

  listUnitsOfMeasure(
    companyId: string,
    search?: string,
    active?: boolean,
  ) {
    return this.prisma.unitOfMeasure.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(search
          ? {
              OR: [
                { uomCode: { contains: search, mode: 'insensitive' } },
                { uomName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ uomName: 'asc' }, { uomCode: 'asc' }],
    });
  }

  async getUnitOfMeasure(companyId: string, id: string) {
    const item = await this.prisma.unitOfMeasure.findFirst({
      where: { id, companyId },
    });
    if (!item) throw this.notFound('Unit of Measure');
    return item;
  }

  async createUnitOfMeasure(
    context: AuditContext,
    data: {
      uomCode: string;
      uomName: string;
      decimalPlaces: number;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.unitOfMeasure.create({
          data: {
            companyId: context.auth.companyId,
            ...data,
          },
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'UNIT_OF_MEASURE',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'UOM code is already in use.');
      throw error;
    }
  }

  async updateUnitOfMeasure(
    context: AuditContext,
    id: string,
    data: {
      uomCode?: string | undefined;
      uomName?: string | undefined;
      decimalPlaces?: number | undefined;
      isActive?: boolean | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.unitOfMeasure.findFirst({
          where: { id, companyId: context.auth.companyId },
        });
        if (!before) throw this.notFound('Unit of Measure');

        if (data.isActive === false && before.isActive) {
          const activeMaterialCount = await tx.material.count({
            where: {
              companyId: context.auth.companyId,
              defaultUomId: id,
              isActive: true,
            },
          });
          if (activeMaterialCount > 0) {
            throw new ConflictException({
              code: 'UOM_IN_USE_BY_ACTIVE_MATERIAL',
              detail:
                'Deactivate or change active Materials using this UOM before deactivating it.',
            });
          }
        }

        const updateData: Prisma.UnitOfMeasureUncheckedUpdateInput = {
          ...(data.uomCode !== undefined ? { uomCode: data.uomCode } : {}),
          ...(data.uomName !== undefined ? { uomName: data.uomName } : {}),
          ...(data.decimalPlaces !== undefined
            ? { decimalPlaces: data.decimalPlaces }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.unitOfMeasure.update({
          where: { id },
          data: updateData,
        });
        await this.audit.record(
          {
            ...context,
            entityType: 'UNIT_OF_MEASURE',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'UOM code is already in use.');
      throw error;
    }
  }

  listMaterials(
    companyId: string,
    search?: string,
    active?: boolean,
  ) {
    return this.prisma.material.findMany({
      where: {
        companyId,
        ...(active !== undefined ? { isActive: active } : {}),
        ...(search
          ? {
              OR: [
                { materialCode: { contains: search, mode: 'insensitive' } },
                { materialName: { contains: search, mode: 'insensitive' } },
                { materialCategory: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        defaultUom: true,
      },
      orderBy: [{ materialName: 'asc' }, { materialCode: 'asc' }],
    });
  }

  async getMaterial(companyId: string, id: string) {
    const item = await this.prisma.material.findFirst({
      where: { id, companyId },
      include: { defaultUom: true },
    });
    if (!item) throw this.notFound('Material');
    return item;
  }

  async createMaterial(
    context: AuditContext,
    data: {
      materialCode: string;
      materialName: string;
      description?: string | null | undefined;
      defaultUomId: string;
      materialCategory?: string | null | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.assertActiveUom(
          tx,
          context.auth.companyId,
          data.defaultUomId,
        );

        const createData: Prisma.MaterialUncheckedCreateInput = {
          companyId: context.auth.companyId,
          materialCode: data.materialCode,
          materialName: data.materialName,
          defaultUomId: data.defaultUomId,
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.materialCategory !== undefined
            ? { materialCategory: data.materialCategory }
            : {}),
        };

        const created = await tx.material.create({
          data: createData,
          include: { defaultUom: true },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'MATERIAL',
            entityId: created.id,
            action: 'CREATE',
            newValues: created,
          },
          tx,
        );
        return created;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Material code is already in use.');
      throw error;
    }
  }

  async updateMaterial(
    context: AuditContext,
    id: string,
    data: {
      materialCode?: string | undefined;
      materialName?: string | undefined;
      description?: string | null | undefined;
      defaultUomId?: string | undefined;
      materialCategory?: string | null | undefined;
      isActive?: boolean | undefined;
    },
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const before = await tx.material.findFirst({
          where: { id, companyId: context.auth.companyId },
          include: { defaultUom: true },
        });
        if (!before) throw this.notFound('Material');

        if (data.defaultUomId !== undefined) {
          await this.assertActiveUom(
            tx,
            context.auth.companyId,
            data.defaultUomId,
          );
        }

        const updateData: Prisma.MaterialUncheckedUpdateInput = {
          ...(data.materialCode !== undefined
            ? { materialCode: data.materialCode }
            : {}),
          ...(data.materialName !== undefined
            ? { materialName: data.materialName }
            : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.defaultUomId !== undefined
            ? { defaultUomId: data.defaultUomId }
            : {}),
          ...(data.materialCategory !== undefined
            ? { materialCategory: data.materialCategory }
            : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        };

        const after = await tx.material.update({
          where: { id },
          data: updateData,
          include: { defaultUom: true },
        });

        await this.audit.record(
          {
            ...context,
            entityType: 'MATERIAL',
            entityId: id,
            action: 'UPDATE',
            oldValues: before,
            newValues: after,
          },
          tx,
        );
        return after;
      });
    } catch (error) {
      this.throwDuplicate(error, 'Material code is already in use.');
      throw error;
    }
  }

  private async assertActiveUom(
    tx: Prisma.TransactionClient,
    companyId: string,
    uomId: string,
  ): Promise<void> {
    const uom = await tx.unitOfMeasure.findFirst({
      where: {
        id: uomId,
        companyId,
        isActive: true,
      },
      select: { id: true },
    });
    if (!uom) {
      throw new UnprocessableEntityException({
        code: 'INVALID_DEFAULT_UOM',
        detail:
          'Material default UOM must be active and belong to the same company.',
      });
    }
  }

  private throwDuplicate(error: unknown, detail: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException({
        code: 'DUPLICATE_MASTER_CODE',
        detail,
      });
    }
  }

  private notFound(entity: string): NotFoundException {
    return new NotFoundException({
      code: 'MASTER_RECORD_NOT_FOUND',
      detail: entity + ' not found.',
    });
  }
}
