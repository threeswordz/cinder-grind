import { Injectable } from '@nestjs/common';

import { AuthenticatedUserContext } from '../auth/auth.types';

export const ALL_PROJECTS_PERMISSION = 'projects.access_all';

@Injectable()
export class AuthorizationService {
  hasPermission(auth: AuthenticatedUserContext, permission: string): boolean {
    return auth.permissions.includes(permission);
  }

  hasEveryPermission(
    auth: AuthenticatedUserContext,
    permissions: readonly string[],
  ): boolean {
    return permissions.every((permission) =>
      this.hasPermission(auth, permission),
    );
  }

  hasAllProjectsAccess(auth: AuthenticatedUserContext): boolean {
    return this.hasPermission(auth, ALL_PROJECTS_PERMISSION);
  }
}
