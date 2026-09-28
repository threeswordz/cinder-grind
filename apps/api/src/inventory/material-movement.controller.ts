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
import { Prisma } from '@prisma/client';

import { AuthGuard } from '../auth/auth.guard';
import { AuthenticatedRequest, AuthenticatedUserContext } from '../auth/auth.types';
import { CsrfGuard } from '../auth/csrf.guard';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import {
  inventoryInvalid,
  inventoryObject,
  inventoryUuid,
  nullableInventoryString,
  optionalInventoryUuid,
  requiredInventoryString,
} from './inventory-validation';
import { MaterialIssueService } from './material-issue.service';
import { MaterialReservationService } from './material-reservation.service';
import { MaterialReturnService } from './material-return.service';

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

function auditContext(request: AuthenticatedRequest) {
  return {
    auth: authOf(request),
    ...(request.correlationId ? { correlationId: request.correlationId } : {}),
  };
}

function quantity(value: unknown, field = 'quantity'): Prisma.Decimal {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return inventoryInvalid(field, 'Must be a positive decimal quantity.');
  }
  const input = String(value);
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,4})?$/.test(input)) {
    return inventoryInvalid(field, 'Use a positive DECIMAL(18,4) quantity.');
  }
  const result = new Prisma.Decimal(input);
  if (result.lte(0)) return inventoryInvalid(field, 'Must be greater than zero.');
  return result;
}

function dateValue(value: unknown, field: string, required = true): Date | null | undefined {
  if (value === undefined) {
    if (required) return inventoryInvalid(field, 'Is required.');
    return undefined;
  }
  if (value === null || value === '') {
    if (required) return inventoryInvalid(field, 'Is required.');
    return null;
  }
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return inventoryInvalid(field, 'Use YYYY-MM-DD.');
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    return inventoryInvalid(field, 'Use a valid calendar date.');
  }
  return parsed;
}

function optionalUuidField(
  input: Record<string, unknown>,
  field: string,
): string | null | undefined {
  return optionalInventoryUuid(input[field], field);
}

@Controller('inventory')
export class MaterialMovementController {
  constructor(
    private readonly reservations: MaterialReservationService,
    private readonly issues: MaterialIssueService,
    private readonly returns: MaterialReturnService,
  ) {}

  @Get('reservation-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async reservationProjects(@Req() request: AuthenticatedRequest) {
    return { data: await this.reservations.projects(authOf(request)) };
  }

  @Get('projects/:projectId/reservation-warehouses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async reservationWarehouses(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.reservations.warehouses(authOf(request), projectId),
    };
  }

  @Get('projects/:projectId/reservation-stock')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async reservationStock(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('warehouseId') warehouseId: unknown,
  ) {
    return {
      data: await this.reservations.stockChoices(
        authOf(request),
        projectId,
        optionalInventoryUuid(warehouseId, 'warehouseId') ?? undefined,
      ),
    };
  }

  @Get('reservation-availability')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async reservationAvailability(
    @Req() request: AuthenticatedRequest,
    @Query('projectId') projectId: unknown,
    @Query('warehouseId') warehouseId: unknown,
    @Query('materialId') materialId: unknown,
    @Query('uomId') uomId: unknown,
  ) {
    return {
      data: await this.reservations.availability(authOf(request), {
        projectId: inventoryUuid(projectId, 'projectId'),
        warehouseId: inventoryUuid(warehouseId, 'warehouseId'),
        materialId: inventoryUuid(materialId, 'materialId'),
        uomId: inventoryUuid(uomId, 'uomId'),
      }),
    };
  }

  @Get('projects/:projectId/material-reservations')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async listReservations(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.reservations.list(authOf(request), projectId),
    };
  }

  @Get('material-reservations/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.view')
  async getReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.reservations.get(authOf(request), id) };
  }

  @Post('material-reservations')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.create')
  async createReservation(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.reservations.create(auditContext(request), {
        projectId: inventoryUuid(input.projectId, 'projectId'),
        warehouseId: inventoryUuid(input.warehouseId, 'warehouseId'),
        materialId: inventoryUuid(input.materialId, 'materialId'),
        uomId: inventoryUuid(input.uomId, 'uomId'),
        wbsId: optionalUuidField(input, 'wbsId') ?? null,
        activityId: optionalUuidField(input, 'activityId') ?? null,
        quantity: quantity(input.quantity),
        requiredDate: dateValue(input.requiredDate, 'requiredDate', false) ?? null,
        remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
      }),
    };
  }

  @Patch('material-reservations/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.edit')
  async updateReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.reservations.updateDraft(auditContext(request), id, {
        ...(input.warehouseId !== undefined
          ? { warehouseId: inventoryUuid(input.warehouseId, 'warehouseId') }
          : {}),
        ...(input.materialId !== undefined
          ? { materialId: inventoryUuid(input.materialId, 'materialId') }
          : {}),
        ...(input.uomId !== undefined
          ? { uomId: inventoryUuid(input.uomId, 'uomId') }
          : {}),
        ...(input.wbsId !== undefined
          ? { wbsId: optionalUuidField(input, 'wbsId') ?? null }
          : {}),
        ...(input.activityId !== undefined
          ? { activityId: optionalUuidField(input, 'activityId') ?? null }
          : {}),
        ...(input.quantity !== undefined
          ? { quantity: quantity(input.quantity) }
          : {}),
        ...(input.requiredDate !== undefined
          ? { requiredDate: dateValue(input.requiredDate, 'requiredDate', false) ?? null }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: nullableInventoryString(input, 'remarks', 10000) ?? null }
          : {}),
      }),
    };
  }

  @Post('material-reservations/:id/activate')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.activate')
  async activateReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.reservations.activate(auditContext(request), id) };
  }

  @Post('material-reservations/:id/release')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.release')
  async releaseReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.reservations.release(
        auditContext(request),
        id,
        requiredInventoryString(inventoryObject(body), 'reason', 1000),
      ),
    };
  }

  @Post('material-reservations/:id/cancel')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.reservation.release')
  async cancelReservation(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.reservations.cancel(
        auditContext(request),
        id,
        requiredInventoryString(inventoryObject(body), 'reason', 1000),
      ),
    };
  }

  @Get('issue-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.view')
  async issueProjects(@Req() request: AuthenticatedRequest) {
    return { data: await this.reservations.projects(authOf(request)) };
  }

  @Get('projects/:projectId/issue-warehouses')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.view')
  async issueWarehouses(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.reservations.warehouses(authOf(request), projectId),
    };
  }

  @Get('projects/:projectId/issue-stock')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.view')
  async issueStock(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
    @Query('warehouseId') warehouseId: unknown,
  ) {
    return {
      data: await this.reservations.stockChoices(
        authOf(request),
        projectId,
        optionalInventoryUuid(warehouseId, 'warehouseId') ?? undefined,
      ),
    };
  }

  @Get('issue-workflows')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.submit')
  async issueWorkflows(@Req() request: AuthenticatedRequest) {
    return { data: await this.issues.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/material-issues')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.view')
  async listIssues(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.issues.list(authOf(request), projectId) };
  }

  @Get('material-issues/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.view')
  async getIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.issues.get(authOf(request), id) };
  }

  @Post('material-issues')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.create')
  async createIssue(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 200) {
      inventoryInvalid('lines', 'Provide one to 200 material lines.');
    }
    const lines = (input.lines as unknown[]).map((raw, index) => {
      const line = inventoryObject(raw);
      return {
        materialId: inventoryUuid(line.materialId, `lines[${index}].materialId`),
        quantity: quantity(line.quantity, `lines[${index}].quantity`),
        uomId: inventoryUuid(line.uomId, `lines[${index}].uomId`),
        reservationId: optionalUuidField(line, 'reservationId') ?? null,
        wbsId: optionalUuidField(line, 'wbsId') ?? null,
        costCodeId: optionalUuidField(line, 'costCodeId') ?? null,
        activityId: optionalUuidField(line, 'activityId') ?? null,
        remarks: nullableInventoryString(line, 'remarks', 10000) ?? null,
      };
    });
    return {
      data: await this.issues.create(auditContext(request), {
        projectId: inventoryUuid(input.projectId, 'projectId'),
        warehouseId: inventoryUuid(input.warehouseId, 'warehouseId'),
        issueDate: dateValue(input.issueDate, 'issueDate')!,
        issuedToEmployeeId: optionalUuidField(input, 'issuedToEmployeeId') ?? null,
        remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
        lines,
      }),
    };
  }

  @Patch('material-issues/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.edit')
  async updateIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.issues.updateDraft(auditContext(request), id, {
        ...(input.issueDate !== undefined
          ? { issueDate: dateValue(input.issueDate, 'issueDate')! }
          : {}),
        ...(input.issuedToEmployeeId !== undefined
          ? {
              issuedToEmployeeId:
                optionalUuidField(input, 'issuedToEmployeeId') ?? null,
            }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: nullableInventoryString(input, 'remarks', 10000) ?? null }
          : {}),
      }),
    };
  }

  @Patch('material-issue-items/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.edit')
  async updateIssueLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.issues.updateDraftLine(auditContext(request), id, {
        ...(input.materialId !== undefined
          ? { materialId: inventoryUuid(input.materialId, 'materialId') }
          : {}),
        ...(input.quantity !== undefined
          ? { quantity: quantity(input.quantity) }
          : {}),
        ...(input.uomId !== undefined
          ? { uomId: inventoryUuid(input.uomId, 'uomId') }
          : {}),
        ...(input.reservationId !== undefined
          ? { reservationId: optionalUuidField(input, 'reservationId') ?? null }
          : {}),
        ...(input.wbsId !== undefined
          ? { wbsId: optionalUuidField(input, 'wbsId') ?? null }
          : {}),
        ...(input.costCodeId !== undefined
          ? { costCodeId: optionalUuidField(input, 'costCodeId') ?? null }
          : {}),
        ...(input.activityId !== undefined
          ? { activityId: optionalUuidField(input, 'activityId') ?? null }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: nullableInventoryString(input, 'remarks', 10000) ?? null }
          : {}),
      }),
    };
  }

  @Post('material-issues/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.submit')
  async submitIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.issues.submit(
        auditContext(request),
        id,
        requiredInventoryString(inventoryObject(body), 'workflowCode', 80),
      ),
    };
  }

  @Post('material-issues/:id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.approve')
  async approveIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.issues.approve(
        auditContext(request),
        id,
        requiredInventoryString(input, 'postKey', 120),
        nullableInventoryString(input, 'comment', 1000) ?? undefined,
      ),
    };
  }

  @Post('material-issues/:id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.approve')
  async rejectIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.issues.reject(
        auditContext(request),
        id,
        nullableInventoryString(inventoryObject(body), 'comment', 1000) ?? undefined,
      ),
    };
  }

  @Post('material-issues/:id/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.issue.reverse')
  async reverseIssue(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.issues.reverse(
        auditContext(request),
        id,
        requiredInventoryString(input, 'reversalKey', 120),
        requiredInventoryString(input, 'reason', 1000),
      ),
    };
  }

  @Get('return-workflows')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.return.submit')
  async returnWorkflows(@Req() request: AuthenticatedRequest) {
    return { data: await this.returns.workflowOptions(authOf(request)) };
  }

  @Get('projects/:projectId/eligible-return-issue-lines')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.return.view')
  async eligibleReturnLines(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return {
      data: await this.returns.eligibleIssueLines(authOf(request), projectId),
    };
  }

  @Get('projects/:projectId/material-returns')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.return.view')
  async listReturns(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' })) projectId: string,
  ) {
    return { data: await this.returns.list(authOf(request), projectId) };
  }

  @Get('material-returns/:id')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('inventory.return.view')
  async getReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return { data: await this.returns.get(authOf(request), id) };
  }

  @Post('material-returns')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.create')
  async createReturn(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    if (!Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 200) {
      inventoryInvalid('lines', 'Provide one to 200 return lines.');
    }
    const lines = (input.lines as unknown[]).map((raw, index) => {
      const line = inventoryObject(raw);
      return {
        materialIssueItemId: inventoryUuid(
          line.materialIssueItemId,
          `lines[${index}].materialIssueItemId`,
        ),
        quantity: quantity(line.quantity, `lines[${index}].quantity`),
        remarks: nullableInventoryString(line, 'remarks', 10000) ?? null,
      };
    });
    return {
      data: await this.returns.create(auditContext(request), {
        projectId: inventoryUuid(input.projectId, 'projectId'),
        warehouseId: inventoryUuid(input.warehouseId, 'warehouseId'),
        returnDate: dateValue(input.returnDate, 'returnDate')!,
        remarks: nullableInventoryString(input, 'remarks', 10000) ?? null,
        lines,
      }),
    };
  }

  @Patch('material-returns/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.edit')
  async updateReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.returns.updateDraft(auditContext(request), id, {
        ...(input.returnDate !== undefined
          ? { returnDate: dateValue(input.returnDate, 'returnDate')! }
          : {}),
        ...(input.remarks !== undefined
          ? { remarks: nullableInventoryString(input, 'remarks', 10000) ?? null }
          : {}),
      }),
    };
  }

  @Patch('material-return-items/:id')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.edit')
  async updateReturnLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.returns.updateDraftLine(
        auditContext(request),
        id,
        quantity(input.quantity),
      ),
    };
  }

  @Post('material-returns/:id/submit')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.submit')
  async submitReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.returns.submit(
        auditContext(request),
        id,
        requiredInventoryString(inventoryObject(body), 'workflowCode', 80),
      ),
    };
  }

  @Post('material-returns/:id/approve')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.approve')
  async approveReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.returns.approve(
        auditContext(request),
        id,
        requiredInventoryString(input, 'postKey', 120),
        nullableInventoryString(input, 'comment', 1000) ?? undefined,
      ),
    };
  }

  @Post('material-returns/:id/reject')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.approve')
  async rejectReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.returns.reject(
        auditContext(request),
        id,
        nullableInventoryString(inventoryObject(body), 'comment', 1000) ?? undefined,
      ),
    };
  }

  @Post('material-returns/:id/reverse')
  @UseGuards(AuthGuard, CsrfGuard, PermissionGuard)
  @RequirePermissions('inventory.return.reverse')
  async reverseReturn(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: unknown,
  ) {
    const input = inventoryObject(body);
    return {
      data: await this.returns.reverse(
        auditContext(request),
        id,
        requiredInventoryString(input, 'reversalKey', 120),
        requiredInventoryString(input, 'reason', 1000),
      ),
    };
  }
}
