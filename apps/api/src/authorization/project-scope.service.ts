import { ForbiddenException, Injectable } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';
import { AuthorizationService } from './authorization.service';

@Injectable()
export class ProjectScopeService {
  constructor(private readonly authorization: AuthorizationService) {}

  canAccessProject(
    auth: AuthenticatedUserContext,
    isActiveProjectMember: boolean,
  ): boolean {
    return (
      this.authorization.hasAllProjectsAccess(auth) || isActiveProjectMember
    );
  }

  assertProjectAccess(
    auth: AuthenticatedUserContext,
    isActiveProjectMember: boolean,
  ): void {
    if (!this.canAccessProject(auth, isActiveProjectMember)) {
      throw new ForbiddenException({
        code: 'PROJECT_ACCESS_DENIED',
        detail: 'You do not have access to this project.',
      });
    }
  }
}
