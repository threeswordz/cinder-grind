import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Req,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';

import { AuthGuard } from '../auth/auth.guard';
import {
  AuthenticatedRequest,
  AuthenticatedUserContext,
} from '../auth/auth.types';
import { PermissionGuard } from '../authorization/permission.guard';
import { RequirePermissions } from '../authorization/permissions.decorator';
import { CashFlowPeriod, CashFlowService } from './cash-flow.service';

function parseDay(value: string | undefined, field: string) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new UnprocessableEntityException(
      field + ' must use YYYY-MM-DD format.',
    );
  }
  const parsed = new Date(value + 'T00:00:00.000Z');
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new UnprocessableEntityException(field + ' is not a valid date.');
  }
  return parsed;
}

function cashFlowPeriod(
  fromDateValue: string | undefined,
  toDateValue: string | undefined,
): CashFlowPeriod {
  const fromDate = parseDay(fromDateValue, 'fromDate');
  const toDate = parseDay(toDateValue, 'toDate');
  if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
    throw new UnprocessableEntityException(
      'fromDate must be on or before toDate.',
    );
  }
  return {
    ...(fromDate ? { fromDate } : {}),
    ...(toDate
      ? { toDateExclusive: new Date(toDate.getTime() + 86_400_000) }
      : {}),
  };
}

function authOf(request: AuthenticatedRequest): AuthenticatedUserContext {
  if (!request.auth) throw new Error('Authentication context is missing.');
  return request.auth;
}

@Controller('finance')
export class CashFlowController {
  constructor(private readonly cashFlow: CashFlowService) {}

  @Get('cash-flow-projects')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async projects(@Req() request: AuthenticatedRequest) {
    return { data: await this.cashFlow.projects(authOf(request)) };
  }

  @Get('projects/:projectId/cash-flow')
  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermissions('finance.payment.view')
  async projectCashFlow(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', new ParseUUIDPipe({ version: '4' }))
    projectId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return {
      data: await this.cashFlow.projectCashFlow(
        authOf(request),
        projectId,
        cashFlowPeriod(fromDate, toDate),
      ),
    };
  }
}
