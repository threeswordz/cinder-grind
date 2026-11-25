import {
  Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CsrfGuard } from '../auth/csrf.guard';
import { AuthenticatedRequest } from '../auth/auth.types';
import { MaterialCodeRequestService } from './material-code-request.service';

const id = new ParseUUIDPipe({version:'4'});
/**
 * Permission is verified against CURRENT persisted session/employee/role grants
 * by the service because Store, PM and material creator have disjoint rights.
 * No management privilege is granted to Site Storekeepers via these endpoints.
 */
@Controller('inventory/material-code-requests')
@UseGuards(AuthGuard)
export class MaterialCodeRequestController {
  constructor(private readonly cases: MaterialCodeRequestService) {}

  @Get('projects')
  projects(@Req() req:AuthenticatedRequest) {
    return this.cases.projects(req.auth!).then(data=>({data}));
  }

  @Get('projects/:projectId')
  list(@Req() req:AuthenticatedRequest,
    @Param('projectId',id) projectId:string) {
    return this.cases.list(req.auth!,projectId).then(data=>({data}));
  }

  @Post('projects/:projectId')
  @UseGuards(CsrfGuard)
  create(@Req() req:AuthenticatedRequest,
    @Param('projectId',id) projectId:string,
    @Body() body:unknown) {
    return this.cases.create({
      auth:req.auth!,...(req.correlationId?{correlationId:req.correlationId}:{})
    },projectId,body).then(data=>({data}));
  }

  @Post('projects/:projectId/requests/:requestId/events')
  @UseGuards(CsrfGuard)
  decide(@Req() req:AuthenticatedRequest,
    @Param('projectId',id) projectId:string,
    @Param('requestId',id) requestId:string,
    @Body() body:unknown) {
    return this.cases.decide({
      auth:req.auth!,...(req.correlationId?{correlationId:req.correlationId}:{})
    },projectId,requestId,body).then(data=>({data}));
  }
}
