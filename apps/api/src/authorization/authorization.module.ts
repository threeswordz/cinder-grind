import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';
import { ProjectScopeService } from './project-scope.service';

@Module({
  providers: [
    Reflector,
    AuthorizationService,
    PermissionGuard,
    ProjectScopeService,
  ],
  exports: [AuthorizationService, PermissionGuard, ProjectScopeService],
})
export class AuthorizationModule {}
